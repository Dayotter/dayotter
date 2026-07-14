# DayOtter Enterprise Edition (EE) License

**The code in any `ee/` directory is NOT open source and is NOT covered by the
repository's AGPL-3.0 license (see the root `LICENSE`).**

Copyright © DayOtter. All rights reserved.

## What this covers

Every file under an `ee/` directory (currently `apps/web/lib/ee/`) implements
**cloud-only** capabilities of DayOtter Cloud (the hosted product at
dayotter.com):

- **Managed AI** - Otter running on DayOtter's own model provider, so you don't
  configure an API key.
- **SSO** - SAML / Google Workspace sign-in.
- **White-label** - remove the "Powered by DayOtter" mark and serve booking pages
  on a custom domain.
- **Hosted messaging** - SMS / WhatsApp on DayOtter's Twilio with included credits.

These are inert unless `DAYOTTER_CLOUD=1` is set. **The open-source edition of
DayOtter - everything outside `ee/` - is the whole product and is fully
functional on its own, including all of Otter's AI features.**

## Grant

You may **read** this source for transparency and reference.

You may **not**, without a separate written commercial agreement with DayOtter:
use, run, deploy, copy, modify, create derivative works of, sublicense, sell, or
redistribute any `ee/` code, in whole or in part, as part of any self-hosted,
internal, or third-party product or service.

This restriction exists so the open-source community cannot resell DayOtter's
commercial features. It does not restrict anything outside `ee/`.

## Contributions

Contributions to `ee/` are accepted only under this license and assign the
necessary rights to DayOtter. Most contributors will never need to touch `ee/` -
the open-source core is where the product lives.

## Commercial licensing

Want to run these features in your own deployment? Email **hello@dayotter.com**.
