# dayotter Commercial / Enterprise Edition (`ee/`)

**This directory is NOT covered by the open-source license of the rest of this
repository.**

The code under `apps/web/lib/ee/` (and any other `ee/` directory) implements
features exclusive to **dayotter Cloud** (the hosted product at dayotter.com). It
is provided source-available for transparency but is licensed **only** for use
in Anthropic/​dayotter's own hosted deployment.

You may read this code. You may **not** use, run, copy, modify, or redistribute
it as part of a self-hosted or third-party deployment without a commercial
license from dayotter.

The open-source edition of dayotter (everything outside `ee/`) is fully
functional on its own — these features simply do not activate when
`DAYOTTER_CLOUD` is unset. See `docs/EDITIONS.md`.

Everything else in this repository remains under the repository's open-source
license (see the root `LICENSE`).
