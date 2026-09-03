---
type: Added
title: Strict and in-line-keyed IndexedDB stores
---

`createIdbDatabase` declares several stores under one schema (IndexedDB
versions the database, not the store), `createInlineIdbStore` keys records off
a field they already carry, and `strict: true` makes a store reject a failed
write instead of swallowing it — the three things that stopped a real backend,
rather than a cache, from being built on this.
