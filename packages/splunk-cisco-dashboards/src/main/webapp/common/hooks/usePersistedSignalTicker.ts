import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    EXECUTIVE_WORKSPACE_SOURCE_ID,
    workspaceStorageKey,
    type WorkspaceId,
} from '@/common/config/insightsWorkspaces';
import {
    applySignalTickerPreferencePatch,
    createSignalTickerPreferencePatch,
    getDefaultSignalTickerConfig,
    migrateSignalTickerConfig,
    sanitizeSignalTickerConfig,
    signalTickerConfigsEqual,
    type SignalTickerConfig,
} from '@/common/config/signalTicker';
import {
    deleteSignalTickerPreference,
    getSignalTickerPreferenceOwner,
    loadSignalTickerPreference,
    saveSignalTickerPreference,
} from '@/common/services/signalTickerPreferenceService';

export {
    DEFAULT_SIGNAL_TICKER_CONFIG,
    MAX_SIGNAL_TICKER_SPEED,
    MAX_SIGNAL_TICKER_ITEMS,
    MIN_SIGNAL_TICKER_SPEED,
    NORMAL_SIGNAL_TICKER_SPEED,
    SIGNAL_TICKER_SPEED_STEP,
    getDefaultSignalTickerConfig,
    makeSignalTickerItemId,
    sanitizeSignalTickerConfig,
} from '@/common/config/signalTicker';
export type {
    SignalTickerConfig,
    SignalTickerDensity,
    SignalTickerFontSize,
    SignalTickerItem,
    SignalTickerRows,
    SignalTickerSpeed,
    SignalTickerThresholdDirection,
} from '@/common/config/signalTicker';

const LEGACY_STORAGE_KEY = 'splunk-cisco-dashboards.signalTicker.v1';
const LEGACY_STORAGE_VERSION = 2;
const SAVE_DEBOUNCE_MS = 650;

interface PersistedShape {
    v: number;
    config: SignalTickerConfig;
}

export type SignalTickerPersistenceStatus =
    | 'loading'
    | 'saving'
    | 'account'
    | 'browser';

const legacyStorageKeyForWorkspace = (workspaceId?: WorkspaceId): string =>
    workspaceStorageKey(
        LEGACY_STORAGE_KEY,
        workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID
    );

const browserStorageKey = (legacyKey: string): string => {
    const owner = getSignalTickerPreferenceOwner() ?? 'anonymous';
    return `${legacyKey}.user.${encodeURIComponent(owner)}`;
};

const readStoredConfig = (
    storageKey: string,
    workspaceId: WorkspaceId
): SignalTickerConfig | null => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== LEGACY_STORAGE_VERSION) return null;
        const sanitized = sanitizeSignalTickerConfig(parsed.config);
        return sanitized
            ? migrateSignalTickerConfig(
                  sanitized,
                  getDefaultSignalTickerConfig(workspaceId)
              )
            : null;
    } catch {
        return null;
    }
};

const readBrowserFallback = (
    userStorageKey: string,
    legacyStorageKey: string,
    workspaceId: WorkspaceId
): SignalTickerConfig | null => {
    const userScoped = readStoredConfig(userStorageKey, workspaceId);
    if (userScoped) return userScoped;

    const legacy = readStoredConfig(legacyStorageKey, workspaceId);
    if (!legacy) return null;
    const packagedDefault = getDefaultSignalTickerConfig(workspaceId);
    return signalTickerConfigsEqual(legacy, packagedDefault) ? null : legacy;
};

const writeBrowserFallback = (
    storageKey: string,
    config: SignalTickerConfig
): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = {
            v: LEGACY_STORAGE_VERSION,
            config,
        };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
        // Browser storage is a last-resort fallback. The in-memory preference
        // still applies for the current page if storage is unavailable.
    }
};

const clearBrowserStorage = (...storageKeys: string[]): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        for (const storageKey of storageKeys) {
            window.localStorage.removeItem(storageKey);
        }
    } catch {
        // Storage can be unavailable in private mode. Server persistence is
        // authoritative whenever the authenticated preference endpoint works.
    }
};

export interface UsePersistedSignalTickerResult {
    config: SignalTickerConfig;
    setConfig: (config: SignalTickerConfig) => void;
    resetAll: () => void;
    isWorkspaceDefault: boolean;
    itemCount: number;
    persistenceStatus: SignalTickerPersistenceStatus;
    persistenceError?: string;
}

export const usePersistedSignalTicker = (
    workspaceId: WorkspaceId = EXECUTIVE_WORKSPACE_SOURCE_ID,
    workspaceDefault?: SignalTickerConfig
): UsePersistedSignalTickerResult => {
    const legacyStorageKey = legacyStorageKeyForWorkspace(workspaceId);
    const userStorageKey = browserStorageKey(legacyStorageKey);
    const defaultConfig = useMemo(() => {
        const sanitized = sanitizeSignalTickerConfig(workspaceDefault);
        return sanitized ?? getDefaultSignalTickerConfig(workspaceId);
    }, [workspaceDefault, workspaceId]);
    const [config, setConfigState] = useState<SignalTickerConfig>(defaultConfig);
    const [persistenceStatus, setPersistenceStatus] =
        useState<SignalTickerPersistenceStatus>('loading');
    const [persistenceError, setPersistenceError] = useState<string>();

    const activeRef = useRef(true);
    const configRef = useRef(config);
    const dirtySinceLoadRef = useRef(false);
    const remoteAvailableRef = useRef<boolean | null>(null);
    const pendingConfigRef = useRef<SignalTickerConfig | null>(null);
    const saveTimerRef = useRef<number | null>(null);
    const saveGenerationRef = useRef(0);
    const writeChainRef = useRef<Promise<void>>(Promise.resolve());

    useEffect(() => {
        activeRef.current = true;
        return () => {
            activeRef.current = false;
        };
    }, []);

    const persistNow = useCallback(
        (nextConfig: SignalTickerConfig) => {
            const generation = saveGenerationRef.current + 1;
            saveGenerationRef.current = generation;
            const patch = createSignalTickerPreferencePatch(
                defaultConfig,
                nextConfig
            );
            if (activeRef.current) {
                setPersistenceStatus('saving');
                setPersistenceError(undefined);
            }

            writeChainRef.current = writeChainRef.current
                .catch(() => undefined)
                .then(async () => {
                    try {
                        const saved = patch
                            ? await saveSignalTickerPreference(workspaceId, patch)
                            : await deleteSignalTickerPreference(workspaceId);
                        if (!saved) {
                            throw new Error(
                                'Authenticated Splunk preference storage is unavailable.'
                            );
                        }
                        clearBrowserStorage(userStorageKey, legacyStorageKey);
                        if (
                            activeRef.current &&
                            generation === saveGenerationRef.current
                        ) {
                            dirtySinceLoadRef.current = false;
                            setPersistenceStatus('account');
                            setPersistenceError(undefined);
                        }
                    } catch (error) {
                        writeBrowserFallback(userStorageKey, nextConfig);
                        if (
                            activeRef.current &&
                            generation === saveGenerationRef.current
                        ) {
                            setPersistenceStatus('browser');
                            setPersistenceError(
                                error instanceof Error
                                    ? error.message
                                    : String(error)
                            );
                        }
                    }
                });
        },
        [defaultConfig, legacyStorageKey, userStorageKey, workspaceId]
    );

    const flushPending = useCallback(() => {
        if (saveTimerRef.current !== null && typeof window !== 'undefined') {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        const pending = pendingConfigRef.current;
        pendingConfigRef.current = null;
        if (pending) persistNow(pending);
    }, [persistNow]);

    const schedulePersist = useCallback(
        (nextConfig: SignalTickerConfig) => {
            pendingConfigRef.current = nextConfig;
            if (saveTimerRef.current !== null && typeof window !== 'undefined') {
                window.clearTimeout(saveTimerRef.current);
            }
            if (typeof window === 'undefined') {
                flushPending();
                return;
            }
            setPersistenceStatus('saving');
            saveTimerRef.current = window.setTimeout(
                flushPending,
                SAVE_DEBOUNCE_MS
            );
        },
        [flushPending]
    );

    useEffect(() => {
        let cancelled = false;
        configRef.current = defaultConfig;
        dirtySinceLoadRef.current = false;
        remoteAvailableRef.current = null;
        pendingConfigRef.current = null;
        setConfigState(defaultConfig);
        setPersistenceStatus('loading');
        setPersistenceError(undefined);

        const browserFallback = readBrowserFallback(
            userStorageKey,
            legacyStorageKey,
            workspaceId
        );

        loadSignalTickerPreference(workspaceId)
            .then((result) => {
                if (cancelled) return;
                remoteAvailableRef.current = result.available;
                if (!result.available) {
                    if (!dirtySinceLoadRef.current) {
                        const next = browserFallback ?? defaultConfig;
                        configRef.current = next;
                        setConfigState(next);
                    }
                    setPersistenceStatus('browser');
                    return;
                }

                if (dirtySinceLoadRef.current) {
                    schedulePersist(configRef.current);
                    return;
                }

                if (result.patch) {
                    const next = applySignalTickerPreferencePatch(
                        defaultConfig,
                        result.patch
                    );
                    configRef.current = next;
                    setConfigState(next);
                    clearBrowserStorage(userStorageKey, legacyStorageKey);
                    setPersistenceStatus('account');
                    return;
                }

                if (browserFallback) {
                    configRef.current = browserFallback;
                    setConfigState(browserFallback);
                    dirtySinceLoadRef.current = true;
                    schedulePersist(browserFallback);
                    return;
                }

                configRef.current = defaultConfig;
                setConfigState(defaultConfig);
                clearBrowserStorage(userStorageKey, legacyStorageKey);
                setPersistenceStatus('account');
            })
            .catch((error) => {
                if (cancelled) return;
                remoteAvailableRef.current = false;
                if (!dirtySinceLoadRef.current) {
                    const next = browserFallback ?? defaultConfig;
                    configRef.current = next;
                    setConfigState(next);
                }
                setPersistenceStatus('browser');
                setPersistenceError(
                    error instanceof Error ? error.message : String(error)
                );
            });

        return () => {
            cancelled = true;
            if (pendingConfigRef.current && remoteAvailableRef.current) {
                flushPending();
            } else if (
                saveTimerRef.current !== null &&
                typeof window !== 'undefined'
            ) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    }, [
        defaultConfig,
        flushPending,
        legacyStorageKey,
        schedulePersist,
        userStorageKey,
        workspaceId,
    ]);

    const setConfig = useCallback(
        (nextConfig: SignalTickerConfig) => {
            const sanitized = sanitizeSignalTickerConfig(nextConfig);
            if (!sanitized) return;
            configRef.current = sanitized;
            dirtySinceLoadRef.current = true;
            setConfigState(sanitized);

            if (remoteAvailableRef.current === true) {
                schedulePersist(sanitized);
                return;
            }

            writeBrowserFallback(userStorageKey, sanitized);
            if (remoteAvailableRef.current === false) {
                setPersistenceStatus('browser');
            }
        },
        [schedulePersist, userStorageKey]
    );

    const resetAll = useCallback(() => {
        if (saveTimerRef.current !== null && typeof window !== 'undefined') {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        pendingConfigRef.current = null;
        configRef.current = defaultConfig;
        dirtySinceLoadRef.current = true;
        setConfigState(defaultConfig);
        clearBrowserStorage(userStorageKey, legacyStorageKey);

        if (remoteAvailableRef.current === true) {
            persistNow(defaultConfig);
        } else if (remoteAvailableRef.current === false) {
            setPersistenceStatus('browser');
        }
    }, [defaultConfig, legacyStorageKey, persistNow, userStorageKey]);

    const itemCount = useMemo(() => config.items.length, [config.items.length]);
    const isWorkspaceDefault = useMemo(
        () => signalTickerConfigsEqual(config, defaultConfig),
        [config, defaultConfig]
    );

    return {
        config,
        setConfig,
        resetAll,
        isWorkspaceDefault,
        itemCount,
        persistenceStatus,
        persistenceError,
    };
};
