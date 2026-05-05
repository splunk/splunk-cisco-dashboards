/**
 * RequireJS interop shim for @emotion/is-prop-valid.
 *
 * Why this exists
 * ---------------
 * `framer-motion` (loaded transitively via `motion/react`) contains an
 * optional fallback in `dist/es/render/dom/utils/filter-props.mjs` that
 * looks like:
 *
 *     try {
 *         const emotionPkg = "@emotion/is-prop-" + "valid";
 *         loadExternalIsValidProp(require(emotionPkg).default);
 *     } catch {}
 *
 * The string concatenation is intentional (per the comment in their
 * source) to hide the require call from webpack's static analyzer so the
 * dependency stays optional. Webpack therefore leaves a runtime
 * `require(...)` call in our bundle. Terser then constant-folds the two
 * literals at minify time, so the final bundle ships with a hard
 * `require("@emotion/is-prop-valid")`.
 *
 * Inside Splunk Web, app bundles are loaded under RequireJS, which means
 * the global `require` is RequireJS's loader. RequireJS's synchronous
 * `require("name")` form throws when the module hasn't been registered
 * yet:
 *
 *     Error: Module name "@emotion/is-prop-valid" has not been loaded yet
 *     for context: _. Use require([])
 *
 * The throw IS caught by framer-motion's surrounding try/catch (so the
 * dashboard still renders), but Splunk's React DevTools-style hook
 * (`installHook.js`) logs the error to the console anyway, producing
 * noisy and misleading red errors.
 *
 * The fix
 * -------
 * We import `@emotion/is-prop-valid` ourselves (webpack bundles it
 * normally) and patch the global `window.require` so that exactly that
 * one module name resolves to our bundled copy. Everything else falls
 * through to the original RequireJS loader.
 *
 * This file MUST be the first import in any page entry that pulls in
 * `motion`, so the patch is in place before `filter-props.mjs` evaluates.
 */

import isPropValid from '@emotion/is-prop-valid';

type AnyFn = (...args: unknown[]) => unknown;

interface RequireJsLike extends AnyFn {
    [key: string]: unknown;
}

declare global {
    interface Window {
        require?: RequireJsLike;
        __ciscoDashboardsRequirePatched?: boolean;
    }
}

(function patchRequireJsGlobal() {
    if (typeof window === 'undefined') return;
    const w = window;
    if (typeof w.require !== 'function') return;
    if (w.__ciscoDashboardsRequirePatched) return;
    w.__ciscoDashboardsRequirePatched = true;

    const original = w.require;

    // Allow-list of module names we resolve locally. We do NOT proxy
    // arbitrary names through here — anything not in this map falls
    // through to RequireJS untouched.
    const localModules: Record<string, unknown> = {
        '@emotion/is-prop-valid': { default: isPropValid, __esModule: true },
    };

    const patched = function patchedRequire(this: unknown, ...args: unknown[]): unknown {
        if (args.length === 1 && typeof args[0] === 'string') {
            const name = args[0];
            if (Object.prototype.hasOwnProperty.call(localModules, name)) {
                return localModules[name];
            }
        }
        return (original as AnyFn).apply(this, args);
    } as unknown as RequireJsLike;

    // Preserve attached helpers and config (require.config, require.s,
    // require.toUrl, etc.) so RequireJS-internal callers still work.
    for (const key in original) {
        try {
            patched[key] = (original as RequireJsLike)[key];
        } catch {
            // Some properties on RequireJS's require are read-only;
            // copying them best-effort is fine.
        }
    }

    (w as { require?: RequireJsLike }).require = patched;
})();

export {};
