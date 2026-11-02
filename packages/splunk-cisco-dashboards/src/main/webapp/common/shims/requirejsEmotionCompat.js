const EMOTION_MODULE = '@emotion/is-prop-valid';
const COMPAT_MARKER = '__scdEmotionCompat';
const LEGACY_MARKER = '__ciscoDashboardsRequirePatched';

/**
 * C3 currently contains two Motion copies with optional synchronous requires.
 * Splunk's loader emits onCustomError before Motion catches a missing module,
 * so one missing dependency produces two dashboard error notifications.
 *
 * Supply the real bundled validator immediately, then register and prime a
 * named AMD module for captured loader references. A define() alone is queued
 * by RequireJS and does not satisfy an immediate synchronous require().
 * Never replace an existing provider or change the loader's error handler.
 */
export function installRequireJsEmotionCompat(host, isPropValid) {
    if (!host || typeof host.require !== 'function') {
        return false;
    }
    const target = host;
    const original = host.require;
    if (original[COMPAT_MARKER]) {
        return true;
    }

    // Splunk's forwarding shim omits defined/specified. Its public config API
    // returns the default-context loader without changing existing settings.
    const loader = typeof original.config === 'function'
        ? original.config({})
        : original;
    const canInspect = typeof loader.defined === 'function'
        && typeof loader.specified === 'function';
    if (canInspect && loader.defined(EMOTION_MODULE)) {
        return true;
    }

    const emotionModule = { default: isPropValid, __esModule: true };
    function patchedRequire(...args) {
        if (args.length === 1 && args[0] === EMOTION_MODULE) {
            return canInspect && loader.defined(EMOTION_MODULE)
                ? loader(EMOTION_MODULE)
                : emotionModule;
        }
        return original.apply(this, args);
    }

    // Forward helpers rather than copying stale values such as onError.
    Object.keys(original).forEach((key) => {
        Object.defineProperty(patchedRequire, key, {
            configurable: true,
            enumerable: true,
            get: () => original[key],
            set: (value) => { original[key] = value; },
        });
    });
    Object.defineProperty(patchedRequire, COMPAT_MARKER, { value: true });
    target.require = patchedRequire;
    if (target.requirejs === original) {
        target.requirejs = patchedRequire;
    }
    // Older page bundles recognize this flag and leave the early bridge intact.
    target[LEGACY_MARKER] = true;

    if (canInspect && typeof host.define === 'function' && host.define.amd) {
        if (!loader.specified(EMOTION_MODULE)) {
            host.define(EMOTION_MODULE, [], () => emotionModule);
        }
        loader([EMOTION_MODULE], () => {});
    }
    return true;
}
