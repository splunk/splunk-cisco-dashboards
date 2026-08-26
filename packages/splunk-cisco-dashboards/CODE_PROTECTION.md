# Code protection roadmap

Status: partially enforced in source as of August 26, 2026. The controls below
were verified with static and temporary-fixture tests; no new production archive
was created or inspected during this source audit.

This document tracks defense-in-depth measures for reducing unnecessary source
exposure in production packages. It does not claim that JavaScript installed on
a customer-controlled Splunk system can be made impossible to inspect or reverse
engineer.

## Enforced release controls

- The standard SplunkBase profile always invokes the production build with
  `--minify`. Fast, unminified output remains available only for explicitly
  labeled developer builds and watch mode.
- SplunkBase packaging rejects `--from-stage`, so watcher output cannot become a
  public release artifact.
- `webpack.config.js` explicitly sets `devtool: false`.
- `bin/verify_production_assets.js` rejects `.map`, `.ts`, `.tsx`, and `.jsx`
  files; Python bytecode/cache artifacts; development React markers; and both
  external and embedded source-map directives in JavaScript bundles.
- Packaging verifies the exact temporary directory about to be archived, then
  re-extracts the final archive and verifies it again before calculating its
  checksum and publishing the immutable artifact. The archive check fails on
  source files, source maps, or source-map directives.
- Production React is used for both release and developer-package builds.
- The repository and packaged app declare the Apache License 2.0 in `LICENSE`,
  `NOTICE`, the root package manifest, and the app package manifest.

## Remaining work and decisions

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

- [x] Running the standard SplunkBase packaging command always requests
  minified JavaScript without requiring developers to remember a special flag.
- [x] Watch mode and developer packages remain available without the release
  build's minification cost and are clearly identified as non-release artifacts.
- [x] `--from-stage` cannot silently turn watcher output into a release artifact.
- [x] The exact directory and final archive intended for distribution are
  checked for original source files, separate source maps, and embedded
  source-map directives.
- [x] Documentation and automated tests cover the supported development and
  release paths.

## Non-goals

- Claiming that shipped client-side code cannot be recovered.
- Treating minification or obfuscation as a substitute for access control,
  secret management, licensing, or patent strategy.
- Making an engineering-only licensing decision.
