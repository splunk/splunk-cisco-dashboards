/**
 * Build 115.21 — compile-time build / version constants for
 * UI-side display.
 *
 * Source of truth:
 *   • APP_BUILD   — read from `default/app.conf`'s `build = NNNN`
 *                   line by webpack at compile time and injected
 *                   via `DefinePlugin` (see `webpack.config.js`).
 *   • APP_VERSION — read from `package.json#version` the same way.
 *
 * Why these are baked into the bundle (not fetched at runtime):
 * the whole point of surfacing a build number in the UI is to
 * tell the operator "are you actually running the bundle you
 * think you are?". A runtime fetch from splunkd would defeat
 * that — the answer would describe the SERVER's app.conf, not
 * the bundle in the browser, and a stale cached bundle would
 * lie about its own identity. Compile-time injection guarantees
 * the displayed value MATCHES the JavaScript bytes that printed
 * it, which is the property we actually want for cache-bust
 * diagnostics.
 *
 * Fallbacks ('dev' / '0.0.0') are only hit when the bundle is
 * served outside of webpack (very rare; tests, ad-hoc node
 * scripts) so they're tagged as obviously unofficial.
 */

declare const process: { env: { [key: string]: string | undefined } };

/** Build 115.22 — DROP the `typeof process` defensive guard.
 *
 *  Earlier (115.21) we wrote:
 *      (typeof process !== 'undefined' && process.env &&
 *       process.env.APP_BUILD) || 'dev'
 *
 *  …reasoning that we should be safe if the bundle ever ran
 *  outside webpack. That was wrong. Splunk Web bundles run in
 *  the BROWSER, where `process` is not a defined global. So
 *  the guard `typeof process !== 'undefined'` evaluates to
 *  false at runtime, and the chain short-circuits to 'dev'
 *  BEFORE DefinePlugin's substituted literal can be returned.
 *  The 115.21 build pill rendered "Build dev" for that exact
 *  reason — a defensive-coding miss-step.
 *
 *  Trust the substitution. DefinePlugin does an exact string
 *  match on `process.env.APP_BUILD` and replaces the entire
 *  expression with the JSON-stringified literal at compile
 *  time. After substitution, the runtime code becomes:
 *
 *      "1171" || 'dev'
 *
 *  Which evaluates trivially to `"1171"`. No `process` global
 *  ever needs to exist at runtime; the reference is gone by
 *  the time the bundle is shipped.
 *
 *  The fallback ('dev' / '0.0.0') is only hit if webpack runs
 *  WITHOUT our DefinePlugin — typically a unit test harness
 *  or an ad-hoc `node` script eval. In those contexts node's
 *  `process` IS a real global, so `process.env.APP_BUILD`
 *  resolves to undefined (the env var isn't set) and the OR
 *  fallback kicks in. No throw, no surprise. */
export const APP_BUILD: string = process.env.APP_BUILD || 'dev';

export const APP_VERSION: string = process.env.APP_VERSION || '0.0.0';

/** Pre-formatted "v1.0.10 · Build 1171" string for compact UI
 *  badges. Kept here so every call site agrees on the format
 *  and the dot separator. */
export const APP_VERSION_LABEL: string = `v${APP_VERSION} · Build ${APP_BUILD}`;
