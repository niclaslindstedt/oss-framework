// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The self-hosted storage client: one per app and server. It pairs this
// device, holds its keys in a `KeyVault`, sets up or recovers the account
// key, approves new devices, and hands out `Namespace` handles — everything
// key material touches happens here, on the device (SPEC §4, §8).

import { AuthError } from "../adapter.ts";
import type { FetchImpl } from "../http-utils.ts";
import { type Logger, noopLogger } from "../logger.ts";
import {
  b64u,
  deriveNamespaceKeys,
  formatRecoveryKey,
  fromUtf8,
  generateAccountKey,
  generateDeviceKeys,
  importAccountPrivate,
  type NamespaceKeySet,
  newRecoveryKey,
  openEnvelope,
  openSealed,
  openWithKey,
  parseRecoveryKey,
  randomBytes,
  recoveryKeyFor,
  safetyCode,
  sealEnvelope,
  sealToPublic,
  sealWithKey,
  secretCode,
  secretKey,
  signMessage,
  unb64u,
  utf8,
  aad,
} from "./crypto.ts";
import {
  DecryptError,
  KeysMissingError,
  NotFoundError,
  RollbackError,
} from "./errors.ts";
import {
  Namespace,
  type NamespaceContext,
  type NamespaceInfo,
  type NamespaceMeta,
  type RawNamespace,
} from "./namespace.ts";
import {
  formatPayload,
  type InvitePayload,
  type PairingPayload,
  parsePayload,
} from "./payload.ts";
import { type ServerEvent, Transport } from "./transport.ts";
import type { KeyVault } from "./vault.ts";

export type ClientState = "signed-out" | "needs-keys" | "ready";

export type Session = {
  serverUrl: string;
  serverId: string;
  serverName?: string;
  deviceId: string;
  accountId: string;
  dskPublic: string;
  dekPublic: string;
};

export type DeviceInfo = {
  id: string;
  name: string;
  platform: string;
  dskPublic: string;
  dekPublic: string;
  hasAccountKey: boolean;
  createdAt: number;
  lastSeenAt: number | null;
  revokedAt: number | null;
};

export type AccountInfo = {
  id: string;
  name: string;
  role: "admin" | "member" | "guest";
  quotaBytes: number | null;
  usedBytes: number;
  hasKeys: boolean;
};

export type SelfHostedClientOptions = {
  vault: KeyVault;
  /** The app id namespaces are created under and listed for, e.g. "meds". */
  app: string;
  fetchImpl?: FetchImpl;
  logger?: Logger;
};

type MeResponse = {
  account: AccountInfo;
  deviceId: string;
  keys: {
    aekPublic: string | null;
    recoveryWrap: string | null;
    deviceWrap: string | null;
  };
};

const V = {
  session: "session",
  dsk: "device:dsk",
  dek: "device:dek",
  aek: "account:aek",
  floors: "floors",
  ns: (id: string, epoch: number) => `ns:${id}:${epoch}`,
};

const aekContext = (accountId: string, deviceId: string) =>
  `aek|${accountId}|${deviceId}`;
const nkContext = (ns: string, epoch: number, accountId: string) =>
  `nk|${ns}|${epoch}|${accountId}`;
const transferContext = (accountId: string) => `transfer|${accountId}`;
const recoveryContext = (accountId: string) => `recovery|${accountId}`;
export const inviteContext = (ns: string) => `invite|${ns}`;

export class SelfHostedClient {
  readonly app: string;
  private readonly vault: KeyVault;
  private readonly fetchImpl?: FetchImpl;
  private readonly log: Logger;
  private transportRef: Transport | null = null;
  private sessionRef: Session | null = null;
  private dsk: CryptoKey | null = null;
  private dek: CryptoKey | null = null;
  private aek: CryptoKey | null = null;
  private floors = new Map<string, number>();
  private readonly nsKeys = new Map<string, Promise<NamespaceKeySet>>();
  private readonly listeners = new Set<(e: ServerEvent) => void>();
  private eventsAbort: AbortController | null = null;
  private stateRef: ClientState = "signed-out";

  constructor(options: SelfHostedClientOptions) {
    this.vault = options.vault;
    this.app = options.app;
    this.fetchImpl = options.fetchImpl;
    this.log = options.logger ?? noopLogger;
  }

  get state(): ClientState {
    return this.stateRef;
  }

  get session(): Session | null {
    return this.sessionRef;
  }

  get transport(): Transport {
    if (!this.transportRef) throw new AuthError("this device is not paired");
    return this.transportRef;
  }

  // ---- vault helpers ---------------------------------------------------------

  private async putJson(id: string, value: unknown): Promise<void> {
    await this.vault.put(id, utf8(JSON.stringify(value)));
  }

  private async getJson<T>(id: string): Promise<T | null> {
    const v = await this.vault.get(id);
    return v instanceof Uint8Array ? (JSON.parse(fromUtf8(v)) as T) : null;
  }

  /** Store a private key: as a CryptoKey where the vault can, else as PKCS#8. */
  private async putPrivate(
    id: string,
    key: CryptoKey,
    pkcs8?: Uint8Array,
  ): Promise<void> {
    if (this.vault.kind === "cryptokey") {
      await this.vault.put(id, key);
      return;
    }
    const bytes =
      pkcs8 ?? new Uint8Array(await crypto.subtle.exportKey("pkcs8", key));
    await this.vault.put(id, bytes);
  }

  private async getPrivate(
    id: string,
    alg: "ECDSA" | "ECDH",
  ): Promise<CryptoKey | null> {
    const v = await this.vault.get(id);
    if (v === null) return null;
    if (!(v instanceof Uint8Array)) return v;
    return crypto.subtle.importKey(
      "pkcs8",
      new Uint8Array(v),
      { name: alg, namedCurve: "P-256" },
      false,
      alg === "ECDSA" ? ["sign"] : ["deriveBits"],
    );
  }

  private connect(session: Session): void {
    this.sessionRef = session;
    this.transportRef = new Transport(session.serverUrl, {
      fetchImpl: this.fetchImpl,
      logger: this.log,
    });
    const dsk = this.dsk!;
    this.transportRef.setSigner({
      serverId: session.serverId,
      deviceId: session.deviceId,
      sign: (m) => signMessage(dsk, m),
    });
  }

  // ---- lifecycle ---------------------------------------------------------------

  /** Load a previous session from the vault (no network). */
  async restore(): Promise<ClientState> {
    const session = await this.getJson<Session>(V.session);
    if (!session) return (this.stateRef = "signed-out");
    this.dsk = await this.getPrivate(V.dsk, "ECDSA");
    this.dek = await this.getPrivate(V.dek, "ECDH");
    if (!this.dsk || !this.dek) return (this.stateRef = "signed-out");
    this.connect(session);
    this.floors = new Map(
      Object.entries(
        (await this.getJson<Record<string, number>>(V.floors)) ?? {},
      ),
    );
    this.aek = await this.getPrivate(V.aek, "ECDH");
    return (this.stateRef = this.aek ? "ready" : "needs-keys");
  }

  private async enrol(
    server: string,
    device: { name: string; platform?: string },
    redeem: (
      body: Record<string, unknown>,
      t: Transport,
    ) => Promise<{ deviceId: string; accountId: string }>,
  ): Promise<{ deviceId: string; accountId: string }> {
    const bootstrap = new Transport(server, {
      fetchImpl: this.fetchImpl,
      logger: this.log,
    });
    const info = await bootstrap.json<{
      serverId: string;
      name: string;
      protocol: number;
    }>("GET", "/v1/info", { auth: false });
    if (info.protocol !== 1)
      throw new Error(`unsupported server protocol ${info.protocol}`);
    const keys = await generateDeviceKeys(this.vault.kind === "bytes");
    const body = {
      name: device.name,
      platform: device.platform ?? "web",
      dskPublic: keys.dskPublic,
      dekPublic: keys.dekPublic,
    };
    const out = await redeem(body, bootstrap);
    await this.vault.clear();
    await this.putPrivate(V.dsk, keys.dsk.privateKey);
    await this.putPrivate(V.dek, keys.dek.privateKey);
    // Work with non-extractable copies from here on.
    this.dsk = (await this.getPrivate(V.dsk, "ECDSA"))!;
    this.dek = (await this.getPrivate(V.dek, "ECDH"))!;
    this.aek = null;
    this.nsKeys.clear();
    this.floors.clear();
    const session: Session = {
      serverUrl: server,
      serverId: info.serverId,
      serverName: info.name,
      deviceId: out.deviceId,
      accountId: out.accountId,
      dskPublic: keys.dskPublic,
      dekPublic: keys.dekPublic,
    };
    await this.putJson(V.session, session);
    this.connect(session);
    this.stateRef = "needs-keys";
    return out;
  }

  /**
   * Pair this device from a scanned / pasted pairing code. A code made by
   * another device carries the account key (sealed under the QR's secret),
   * so the device is ready at once; a server-made code leaves it in
   * `needs-keys` — then `createAccountKeys()` (first device of a new
   * account), `recover()`, or approval from another device.
   */
  async pair(
    payload: string | PairingPayload,
    device: { name: string; platform?: string },
  ): Promise<ClientState> {
    const p = typeof payload === "string" ? parsePayload(payload) : payload;
    if (p.kind !== "pair")
      throw new Error("that is an invite, not a pairing code");
    const code = p.code ?? (await secretCode(p.secret!));
    let transfer: string | null = null;
    const out = await this.enrol(p.server, device, async (d, t) => {
      const r = await t.json<{
        deviceId: string;
        accountId: string;
        transfer: string | null;
      }>("POST", "/v1/pair", {
        auth: false,
        json: { code, device: d },
      });
      transfer = r.transfer;
      return r;
    });
    if (transfer && p.secret) {
      const pkcs8 = await openWithKey(
        await secretKey(p.secret),
        transfer,
        transferContext(out.accountId),
      );
      await this.adoptAccountKey(pkcs8);
      return this.stateRef;
    }
    return this.refreshKeys();
  }

  private async me(): Promise<MeResponse> {
    return this.transport.json<MeResponse>("GET", "/v1/me");
  }

  async account(): Promise<AccountInfo> {
    return (await this.me()).account;
  }

  /** Whether the account already has an account key (on some device). */
  async accountHasKeys(): Promise<boolean> {
    return (await this.me()).keys.aekPublic !== null;
  }

  /** Keep the account key on this device and seal a copy to it on the server. */
  private async adoptAccountKey(pkcs8: Uint8Array): Promise<void> {
    const s = this.sessionRef!;
    const aek = await importAccountPrivate(pkcs8, this.vault.kind === "bytes");
    await this.putPrivate(V.aek, aek, pkcs8);
    this.aek = await this.getPrivate(V.aek, "ECDH");
    const me = await this.me();
    if (me.keys.deviceWrap === null) {
      await this.transport.json("PUT", "/v1/me/keys", {
        json: {
          deviceWraps: {
            [s.deviceId]: await sealToPublic(
              s.dekPublic,
              pkcs8,
              aekContext(s.accountId, s.deviceId),
            ),
          },
        },
      });
    }
    this.stateRef = "ready";
  }

  /** Check whether another device has approved this one; adopt the key if so. */
  async refreshKeys(): Promise<ClientState> {
    const me = await this.me();
    if (this.aek) return (this.stateRef = "ready");
    if (me.keys.deviceWrap) {
      const s = this.sessionRef!;
      const pkcs8 = await openSealed(
        this.dek!,
        me.keys.deviceWrap,
        aekContext(s.accountId, s.deviceId),
      );
      await this.adoptAccountKey(pkcs8);
    }
    return this.stateRef;
  }

  /** Poll until another device approves this one (or `signal` aborts). */
  async waitForApproval(
    opts: { signal?: AbortSignal; intervalMs?: number } = {},
  ): Promise<ClientState> {
    while (!opts.signal?.aborted) {
      if ((await this.refreshKeys()) === "ready") return "ready";
      await new Promise((r) => setTimeout(r, opts.intervalMs ?? 3000));
    }
    return this.stateRef;
  }

  /**
   * First device of an account: create the account key and return the
   * recovery key — show it ONCE; it is the only way back if every device is
   * lost, and the server never sees it.
   */
  async createAccountKeys(): Promise<string> {
    const s = this.sessionRef!;
    const me = await this.me();
    if (me.keys.aekPublic)
      throw new Error(
        "this account already has a key: recover it or approve this device",
      );
    const acc = await generateAccountKey();
    const rk = newRecoveryKey();
    await this.transport.json("PUT", "/v1/me/keys", {
      json: {
        aekPublic: acc.publicRaw,
        recoveryWrap: await sealWithKey(
          await recoveryKeyFor(rk, s.accountId),
          acc.pkcs8,
          recoveryContext(s.accountId),
        ),
        deviceWraps: {
          [s.deviceId]: await sealToPublic(
            s.dekPublic,
            acc.pkcs8,
            aekContext(s.accountId, s.deviceId),
          ),
        },
      },
    });
    await this.adoptAccountKey(acc.pkcs8);
    return formatRecoveryKey(rk);
  }

  /** Recover the account key on this device from the recovery key. */
  async recover(recoveryKey: string): Promise<void> {
    const s = this.sessionRef!;
    const rk = await parseRecoveryKey(recoveryKey);
    const me = await this.me();
    if (!me.keys.recoveryWrap || !me.keys.aekPublic)
      throw new KeysMissingError("this account has no recovery key");
    let pkcs8: Uint8Array;
    try {
      pkcs8 = await openWithKey(
        await recoveryKeyFor(rk, s.accountId),
        me.keys.recoveryWrap,
        recoveryContext(s.accountId),
      );
    } catch (err) {
      if (err instanceof DecryptError) {
        throw new Error("that recovery key does not belong to this account", {
          cause: err,
        });
      }
      throw err;
    }
    await this.assertMatchesAccount(pkcs8, me.keys.aekPublic);
    await this.adoptAccountKey(pkcs8);
  }

  /** Refuse a key that is not the account's (a server swapping key material). */
  private async assertMatchesAccount(
    pkcs8: Uint8Array,
    aekPublic: string,
  ): Promise<void> {
    const k = await crypto.subtle.importKey(
      "pkcs8",
      new Uint8Array(pkcs8),
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const jwk = await crypto.subtle.exportKey("jwk", k);
    const raw = new Uint8Array(65);
    raw[0] = 4;
    raw.set(unb64u(jwk.x!), 1);
    raw.set(unb64u(jwk.y!), 33);
    if (b64u(raw) !== aekPublic)
      throw new DecryptError("the account key does not match the account");
  }

  /** The account key's private bytes, reconstructed from this device's sealed copy. */
  private async accountPkcs8(): Promise<Uint8Array> {
    const s = this.sessionRef!;
    const me = await this.me();
    if (!me.keys.deviceWrap) throw new KeysMissingError();
    return openSealed(
      this.dek!,
      me.keys.deviceWrap,
      aekContext(s.accountId, s.deviceId),
    );
  }

  /** Replace the recovery key; the old one stops working. */
  async regenerateRecoveryKey(): Promise<string> {
    const s = this.sessionRef!;
    const pkcs8 = await this.accountPkcs8();
    const rk = newRecoveryKey();
    await this.transport.json("PUT", "/v1/me/keys", {
      json: {
        recoveryWrap: await sealWithKey(
          await recoveryKeyFor(rk, s.accountId),
          pkcs8,
          recoveryContext(s.accountId),
        ),
      },
    });
    return formatRecoveryKey(rk);
  }

  /** This device's safety code, to compare with the approving device. */
  async safetyCode(): Promise<string> {
    const s = this.sessionRef!;
    return safetyCode(s.dskPublic, s.dekPublic);
  }

  /** Devices of this account waiting for the account key, with codes computed HERE. */
  async pendingDevices(): Promise<(DeviceInfo & { safetyCode: string })[]> {
    const { devices } = await this.transport.json<{ devices: DeviceInfo[] }>(
      "GET",
      "/v1/me/pending-devices",
    );
    return Promise.all(
      devices.map(async (d) => ({
        ...d,
        safetyCode: await safetyCode(d.dskPublic, d.dekPublic),
      })),
    );
  }

  /** Give a pending device the account key — only after comparing safety codes. */
  async approveDevice(deviceId: string): Promise<void> {
    const s = this.sessionRef!;
    const { devices } = await this.transport.json<{ devices: DeviceInfo[] }>(
      "GET",
      "/v1/me/pending-devices",
    );
    const d = devices.find((x) => x.id === deviceId);
    if (!d) throw new NotFoundError("no such pending device");
    const pkcs8 = await this.accountPkcs8();
    await this.transport.json("PUT", "/v1/me/keys", {
      json: {
        deviceWraps: {
          [deviceId]: await sealToPublic(
            d.dekPublic,
            pkcs8,
            aekContext(s.accountId, deviceId),
          ),
        },
      },
    });
  }

  /**
   * A QR payload that adds a device to this account with nothing typed: it
   * carries a secret X; the server sees only HKDF(X, "code"), and the account
   * key travels sealed under HKDF(X, "key").
   */
  async addDevicePayload(
    opts: { ttlSeconds?: number; appUrl?: string } = {},
  ): Promise<{ payload: string; expiresAt: number }> {
    const s = this.sessionRef!;
    const x = randomBytes(32);
    const pkcs8 = await this.accountPkcs8();
    const r = await this.transport.json<{ expiresAt: number }>(
      "POST",
      "/v1/pairings",
      {
        json: {
          accountId: s.accountId,
          code: await secretCode(x),
          transfer: await sealWithKey(
            await secretKey(x),
            pkcs8,
            transferContext(s.accountId),
          ),
          ttlSeconds: opts.ttlSeconds,
        },
      },
    );
    return {
      payload: formatPayload(
        { kind: "pair", server: s.serverUrl, secret: x, name: s.serverName },
        opts.appUrl,
      ),
      expiresAt: r.expiresAt,
    };
  }

  async devices(): Promise<DeviceInfo[]> {
    return (
      await this.transport.json<{ devices: DeviceInfo[] }>(
        "GET",
        "/v1/me/devices",
      )
    ).devices;
  }

  async renameDevice(deviceId: string, name: string): Promise<void> {
    await this.transport.json(
      "PATCH",
      `/v1/devices/${encodeURIComponent(deviceId)}`,
      { json: { name } },
    );
  }

  /** Revoke a device (a lost phone): its sessions and its copy of the account key die at once. */
  async revokeDevice(deviceId: string): Promise<void> {
    await this.transport.request(
      "DELETE",
      `/v1/devices/${encodeURIComponent(deviceId)}`,
    );
  }

  /** Sign out; `forget` also erases this device's keys (it must pair again). */
  async signOut(opts: { forget?: boolean } = {}): Promise<void> {
    this.eventsAbort?.abort();
    this.eventsAbort = null;
    try {
      await this.transportRef?.request("POST", "/v1/auth/logout");
    } catch {
      // offline or already revoked — signing out locally is what matters
    }
    if (opts.forget) await this.vault.clear();
    this.transportRef = null;
    this.sessionRef = null;
    this.dsk = this.dek = this.aek = null;
    this.nsKeys.clear();
    this.stateRef = "signed-out";
  }

  // ---- namespaces ----------------------------------------------------------------

  private requireReady(): void {
    if (!this.aek) throw new KeysMissingError();
  }

  /** Remember the newest seq seen per namespace; a lower one is a rollback. */
  observeSeq(nsId: string, seq: number): void {
    const floor = this.floors.get(nsId) ?? 0;
    if (seq < floor) throw new RollbackError(nsId, floor, seq);
    if (seq > floor) {
      this.floors.set(nsId, seq);
      void this.putJson(V.floors, Object.fromEntries(this.floors)).catch(
        () => {},
      );
    }
  }

  /** Forget a namespace's floor (after an intentional server restore). */
  resetSeq(nsId: string): void {
    this.floors.delete(nsId);
    void this.putJson(V.floors, Object.fromEntries(this.floors)).catch(
      () => {},
    );
  }

  private async storeNamespaceKey(
    nsId: string,
    epoch: number,
    nk: Uint8Array,
  ): Promise<NamespaceKeySet> {
    const keys = await deriveNamespaceKeys(nk, nsId, epoch);
    if (this.vault.kind === "cryptokey") {
      await this.vault.put(`${V.ns(nsId, epoch)}:content`, keys.content);
      await this.vault.put(`${V.ns(nsId, epoch)}:nameMac`, keys.nameMac);
      await this.vault.put(`${V.ns(nsId, epoch)}:nameEnc`, keys.nameEnc);
    } else {
      await this.vault.put(V.ns(nsId, epoch), nk);
    }
    return keys;
  }

  private async loadNamespaceKey(
    nsId: string,
    epoch: number,
  ): Promise<NamespaceKeySet | null> {
    if (this.vault.kind === "bytes") {
      const nk = await this.vault.get(V.ns(nsId, epoch));
      return nk instanceof Uint8Array
        ? deriveNamespaceKeys(nk, nsId, epoch)
        : null;
    }
    const [content, nameMac, nameEnc] = await Promise.all(
      ["content", "nameMac", "nameEnc"].map((k) =>
        this.vault.get(`${V.ns(nsId, epoch)}:${k}`),
      ),
    );
    if (
      !(content instanceof CryptoKey) ||
      !(nameMac instanceof CryptoKey) ||
      !(nameEnc instanceof CryptoKey)
    )
      return null;
    return { epoch, content, nameMac, nameEnc };
  }

  /** The namespace keys for an epoch: memory, then vault, then unwrap from the server. */
  keysFor(
    nsId: string,
    epoch: number,
    wraps?: Record<string, string>,
  ): Promise<NamespaceKeySet> {
    const id = `${nsId}:${epoch}`;
    let p = this.nsKeys.get(id);
    if (!p) {
      p = (async () => {
        const local = await this.loadNamespaceKey(nsId, epoch);
        if (local) return local;
        this.requireReady();
        const w =
          wraps ??
          (
            await this.transport.json<RawNamespace>(
              "GET",
              `/v1/namespaces/${nsId}`,
            )
          ).keys;
        const wrap = w[String(epoch)];
        if (!wrap)
          throw new KeysMissingError(
            `no key for epoch ${epoch} of namespace ${nsId}`,
          );
        const nk = await openSealed(
          this.aek!,
          wrap,
          nkContext(nsId, epoch, this.sessionRef!.accountId),
        );
        return this.storeNamespaceKey(nsId, epoch, nk);
      })();
      this.nsKeys.set(id, p);
      p.catch(() => this.nsKeys.delete(id));
    }
    return p;
  }

  /** Raw namespace key bytes for every epoch (for invites and rotation). */
  async namespaceKeyBytes(nsId: string): Promise<Record<string, Uint8Array>> {
    this.requireReady();
    const raw = await this.transport.json<RawNamespace>(
      "GET",
      `/v1/namespaces/${nsId}`,
    );
    const out: Record<string, Uint8Array> = {};
    for (const [epoch, wrap] of Object.entries(raw.keys)) {
      out[epoch] = await openSealed(
        this.aek!,
        wrap,
        nkContext(nsId, Number(epoch), this.sessionRef!.accountId),
      );
    }
    return out;
  }

  /** Seal a namespace key to an account (for rotation and sharing). */
  wrapForAccount(
    nsId: string,
    epoch: number,
    accountId: string,
    aekPublic: string,
    nk: Uint8Array,
  ): Promise<string> {
    return sealToPublic(aekPublic, nk, nkContext(nsId, epoch, accountId));
  }

  async adoptNamespaceKey(
    nsId: string,
    epoch: number,
    nk: Uint8Array,
  ): Promise<void> {
    const keys = await this.storeNamespaceKey(nsId, epoch, nk);
    this.nsKeys.set(`${nsId}:${epoch}`, Promise.resolve(keys));
  }

  private context(): NamespaceContext {
    return {
      client: this,
      transport: this.transport,
      accountId: this.sessionRef!.accountId,
      serverUrl: this.sessionRef!.serverUrl,
      serverName: this.sessionRef!.serverName,
      log: this.log,
    };
  }

  async decryptMeta(raw: RawNamespace): Promise<NamespaceMeta> {
    const bytes = unb64u(raw.meta);
    const plain = await openEnvelope(
      (e) => this.keysFor(raw.id, e, raw.keys),
      bytes,
      aad.nsmeta(raw.id),
    );
    return JSON.parse(fromUtf8(plain)) as NamespaceMeta;
  }

  /** Namespaces this account can use in this app (or `app`), names decrypted. */
  async namespaces(app: string = this.app): Promise<NamespaceInfo[]> {
    this.requireReady();
    const { namespaces } = await this.transport.json<{
      namespaces: RawNamespace[];
    }>("GET", "/v1/namespaces", {
      query: { app },
    });
    const out: NamespaceInfo[] = [];
    for (const raw of namespaces) {
      this.observeSeq(raw.id, Number(raw.seq));
      out.push({ ...toInfo(raw), meta: await this.decryptMeta(raw) });
    }
    return out;
  }

  /** Create a namespace; its key is born here and never leaves in the clear. */
  async createNamespace(
    meta: NamespaceMeta,
    app: string = this.app,
  ): Promise<Namespace> {
    this.requireReady();
    const s = this.sessionRef!;
    const id = `ns_${b64u(randomBytes(16))}`;
    const nk = randomBytes(32);
    const keys = await this.storeNamespaceKey(id, 1, nk);
    this.nsKeys.set(`${id}:1`, Promise.resolve(keys));
    const me = await this.me();
    const raw = await this.transport.json<RawNamespace>(
      "POST",
      "/v1/namespaces",
      {
        json: {
          id,
          app,
          meta: b64u(
            await sealEnvelope(
              keys,
              utf8(JSON.stringify(meta)),
              aad.nsmeta(id),
            ),
          ),
          wrap: await this.wrapForAccount(
            id,
            1,
            s.accountId,
            me.keys.aekPublic!,
            nk,
          ),
        },
      },
    );
    return new Namespace(this.context(), { ...toInfo(raw), meta });
  }

  async namespace(id: string): Promise<Namespace> {
    this.requireReady();
    const raw = await this.transport.json<RawNamespace>(
      "GET",
      `/v1/namespaces/${encodeURIComponent(id)}`,
    );
    this.observeSeq(raw.id, Number(raw.seq));
    return new Namespace(this.context(), {
      ...toInfo(raw),
      meta: await this.decryptMeta(raw),
    });
  }

  /**
   * Join a namespace from an invite. Without a session on the invite's server
   * this device first becomes a guest account (give `accountName` and
   * `device`); the returned recovery key must then be shown once.
   */
  async acceptInvite(
    payload: string | InvitePayload,
    opts: {
      accountName?: string;
      device?: { name: string; platform?: string };
    } = {},
  ): Promise<{ namespace: Namespace; recoveryKey?: string }> {
    const p = typeof payload === "string" ? parsePayload(payload) : payload;
    if (p.kind !== "invite")
      throw new Error("that is a pairing code, not an invite");
    const code = await secretCode(p.secret);
    let result: { namespaceId: string; payload: string };
    let recoveryKey: string | undefined;
    if (
      this.sessionRef &&
      this.sessionRef.serverUrl === p.server &&
      this.stateRef === "ready"
    ) {
      result = await this.transport.json("POST", "/v1/invites/accept", {
        json: { code },
      });
    } else {
      if (!opts.accountName || !opts.device) {
        throw new Error("to join as a guest, give accountName and device");
      }
      let joined: { namespaceId: string; payload: string } | null = null;
      await this.enrol(p.server, opts.device, async (d, t) => {
        const r = await t.json<{
          namespaceId: string;
          payload: string;
          deviceId: string;
          accountId: string;
        }>("POST", "/v1/invites/accept", {
          auth: false,
          json: { code, device: d, accountName: opts.accountName },
        });
        joined = r;
        return r;
      });
      result = joined!;
      recoveryKey = await this.createAccountKeys();
    }
    const epochs = JSON.parse(
      fromUtf8(
        await openWithKey(
          await secretKey(p.secret),
          result.payload,
          inviteContext(result.namespaceId),
        ),
      ),
    ) as { epochs: Record<string, string> };
    const me = await this.me();
    for (const [epoch, nkText] of Object.entries(epochs.epochs)) {
      const nk = unb64u(nkText);
      await this.adoptNamespaceKey(result.namespaceId, Number(epoch), nk);
      await this.transport.json(
        "POST",
        `/v1/namespaces/${result.namespaceId}/keys`,
        {
          json: {
            epoch: Number(epoch),
            wraps: {
              [me.account.id]: await this.wrapForAccount(
                result.namespaceId,
                Number(epoch),
                me.account.id,
                me.keys.aekPublic!,
                nk,
              ),
            },
          },
        },
      );
    }
    return { namespace: await this.namespace(result.namespaceId), recoveryKey };
  }

  /**
   * A per-device AES-256-GCM key for encrypting local caches (e.g.
   * `createIdbRecordCache({ encryptWith })`), created on first use and kept
   * non-extractable in the vault — so cached health data is not left in the
   * browser in the clear either.
   */
  async localCacheKey(): Promise<CryptoKey> {
    const existing = await this.vault.get("cache:key");
    if (existing instanceof CryptoKey) return existing;
    if (existing instanceof Uint8Array) {
      return crypto.subtle.importKey(
        "raw",
        new Uint8Array(existing),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"],
      );
    }
    if (this.vault.kind === "cryptokey") {
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      await this.vault.put("cache:key", key);
      return key;
    }
    const raw = randomBytes(32);
    await this.vault.put("cache:key", raw);
    return crypto.subtle.importKey(
      "raw",
      new Uint8Array(raw),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    );
  }

  // ---- live events ----------------------------------------------------------------

  /** Listen to server events (one shared stream per client). */
  subscribe(listener: (event: ServerEvent) => void): () => void {
    this.listeners.add(listener);
    if (!this.eventsAbort && this.transportRef) {
      const ac = new AbortController();
      this.eventsAbort = ac;
      void this.transportRef.events(
        (e) => {
          if (
            e.type === "device" &&
            e.revoked &&
            e.deviceId === this.sessionRef?.deviceId
          ) {
            this.log.warn("this device was revoked");
          }
          for (const l of [...this.listeners]) l(e);
        },
        {
          signal: ac.signal,
          onError: (err) => this.log.warn("event stream interrupted", err),
        },
      );
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.eventsAbort?.abort();
        this.eventsAbort = null;
      }
    };
  }
}

function toInfo(raw: RawNamespace): Omit<NamespaceInfo, "meta"> {
  return {
    id: raw.id,
    app: raw.app,
    role: raw.role,
    epoch: raw.epoch,
    seq: Number(raw.seq),
    ownerAccountId: raw.ownerAccountId,
    usedBytes: raw.usedBytes,
    keys: raw.keys,
  };
}

export function createSelfHostedClient(
  options: SelfHostedClientOptions,
): SelfHostedClient {
  return new SelfHostedClient(options);
}
