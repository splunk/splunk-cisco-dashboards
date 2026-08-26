/**
 * Compile-time app identity for UI-side display.
 *
 * Source of truth:
 *   • APP_BUILD is a unique marker emitted by webpack. The canonical package
 *     workflow replaces it in its temporary archive copy only after selecting
 *     the final package `[install] build`. A staged/watch bundle deliberately
 *     retains the marker because it is not a released archive.
 *   • APP_VERSION is read by webpack from the repo-root `VERSION` file. That
 *     file is the Splunk app release version; package.json's version belongs
 *     to the JavaScript workspace and is intentionally independent.
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

// DefinePlugin replaces these exact expressions with string literals before
// the browser executes the bundle. Do not add a `typeof process` guard: it
// would bypass that substitution in a browser, where `process` is absent.
export const APP_BUILD: string = process.env.APP_BUILD || 'dev';

export const APP_VERSION: string = process.env.APP_VERSION || '0.0.0';

/** Pre-formatted "v1.0.10 · Build 1171" string for compact UI
 *  badges. Kept here so every call site agrees on the format
 *  and the dot separator. */
export const APP_VERSION_LABEL: string = `v${APP_VERSION} · Build ${APP_BUILD}`;
