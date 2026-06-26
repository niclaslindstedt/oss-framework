# Standard developer entry points (OSS_SPEC §9). CI invokes these exact
# targets so local and CI environments stay in sync.

.PHONY: build release test lint fmt fmt-check clean candidates clone-apps bump changelog check-changeset

build: ## Developer build (ESM + CJS + d.ts)
	npm run build

release: build ## Optimized/publishable build

test: ## Run the full test suite
	npm test

lint: ## Lint with zero-warning policy + typecheck
	npm run lint

fmt: ## Format the codebase in place
	npm run fmt

fmt-check: ## Verify formatting without modifying files
	npm run fmt:check

clean: ## Remove build artifacts
	rm -rf dist

clone-apps: ## Clone/refresh the source apps into .reference/ (needs MIRROR_* env)
	npm run clone-apps

candidates: ## Rank framework refactoring candidates across the source apps
	npm run candidates

bump: ## Print the semver bump the unreleased changeset fragments imply
	@node scripts/release/compute-bump.mjs

changelog: ## Collate .changes/unreleased/ fragments into CHANGELOG.md (VERSION=X.Y.Z)
	node scripts/release/collate-changelog.mjs $(VERSION)

check-changeset: ## Verify the branch added a changelog fragment (BASE_SHA=<sha>)
	node scripts/release/check-changeset.mjs
