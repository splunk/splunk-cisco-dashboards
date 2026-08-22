# Code protection roadmap

Status: queued; implementation has not started.

This document tracks defense-in-depth measures for reducing unnecessary source
exposure in production packages. It does not claim that JavaScript installed on
a customer-controlled Splunk system can be made impossible to inspect or reverse
engineer.

## Verified baseline

The following state was verified on August 21, 2026:

- The latest `1.0.42` Splunkbase archive was minified.
- The staged app, Splunkbase archive, and developer archive contained no
  separate or embedded source-map payloads and no `.map`, `.ts`, `.tsx`, or
  `.jsx` files.
- `bin/verify_production_assets.js` rejects source files and separate source
  maps before `bin/package_app.sh` creates the release archive.
- Production React is used for both release and development-package builds.
- Minification is opt-in. A normal Splunkbase build and the `--from-stage` path
  can package unminified production bundles without failing validation.
- The repository and packaged app declare the Apache License 2.0 in `LICENSE`,
  `NOTICE`, the root package manifest, and the app package manifest.

## Prioritized to-do list

### Release controls

- [ ] Make minification mandatory for every Splunkbase package while keeping
  watch mode and explicitly labeled developer packages fast and unminified.
- [ ] Prevent `--from-stage` from producing a Splunkbase package unless the
  staged bundles carry verified minified-build provenance.
- [ ] Set `devtool: false` explicitly in `webpack.config.js` so production
  source-map policy does not rely on inherited or default webpack behavior.
- [ ] Extend `bin/verify_production_assets.js` to reject external and embedded
  source maps and to require minified-build provenance for the Splunkbase
  profile.
- [ ] Add a release-pipeline check that inspects the final archive and fails if
  it contains source files, source maps, or unverified JavaScript bundles.

### Intellectual-property and licensing review

- [ ] Ask Legal/IP to confirm that Apache-2.0 is the intended license for all
  first-party code and any patented implementation shipped in this app.
- [ ] Document the approved licensing and patent posture. Do not change or
  remove the current license without copyright-owner and Legal/IP approval, and
  do not assume that rights already granted to recipients can be revoked.
- [ ] Inventory client-side logic that is considered proprietary, patented, or
  trade-secret-sensitive and identify its actual confidentiality requirement.

### Architectural and operational hardening

- [ ] Keep credentials, tokens, private keys, and other secrets out of browser
  bundles regardless of minification or obfuscation.
- [ ] For logic that genuinely must remain confidential, evaluate running it in
  a service controlled by the product owner. Code shipped as JavaScript,
  Python, or a native binary on a customer-controlled system remains available
  for inspection to varying degrees.
- [ ] Evaluate package signing, restricted release-artifact access, and durable
  build provenance as integrity and distribution controls. These measures do
  not provide code confidentiality by themselves.
- [ ] Consider stronger JavaScript obfuscation only after the release and
  licensing controls above. Any trial must measure build time, bundle size,
  runtime performance, Splunk compatibility, debugging impact, and rollback.

## Acceptance criteria for enforced release minification

- Running the standard Splunkbase packaging command always produces minified
  JavaScript without requiring developers to remember a special flag.
- Watch mode and developer packages remain available without the release build's
  minification cost and are clearly identified as non-release artifacts.
- `--from-stage` cannot silently turn watcher output into a release artifact.
- The exact directory and final archive intended for distribution contain no
  original source files, separate source maps, or embedded source-map payloads.
- Validation fails closed when the build profile or minification provenance
  cannot be established.
- Documentation and automated tests cover the supported development and release
  paths.

## Non-goals

- Claiming that shipped client-side code cannot be recovered.
- Treating minification or obfuscation as a substitute for access control,
  secret management, licensing, or patent strategy.
- Making an engineering-only licensing decision.
