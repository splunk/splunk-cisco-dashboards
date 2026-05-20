/**
 * Network Diagram page (Build 106) — customer-facing authoring
 * surface for the Visio-style network diagrams referenced in the
 * Florida DEM v8 PDF.
 *
 * Composition:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ DiagramHeader (Open / Save / SaveAs / New / Delete)     │
 *   ├──────────┬──────────────────────────────────────────────┤
 *   │ Palette  │  NetworkDiagramCanvas                        │
 *   │ (left)   │  (drop targets, ReactFlow, props panel)      │
 *   │          │                                              │
 *   └──────────┴──────────────────────────────────────────────┘
 *
 * Responsibilities owned here (NOT the canvas):
 *   • Tracking the active diagram name, dirty bit, and busy
 *     state. The canvas is "dumb" — it only knows nodes/edges.
 *   • Listing / loading / saving / deleting via the
 *     `diagramPersistenceService` (lookup-backed).
 *   • Loading the live `asset_inventory` index ONCE on mount
 *     and threading it into the canvas so asset-bound saved
 *     nodes get fresh display data.
 *   • Beforeunload guard so an operator who closes the tab
 *     mid-edit gets a "you have unsaved changes" prompt.
 *
 * Persistence model: lookup-edit (full-CSV replace) per save.
 * One row = one diagram. See `transforms.conf` /
 * `diagramPersistenceService.ts` for full schema.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/common/lib/utils';
import {
    listDiagrams,
    loadDiagram,
    saveDiagram,
    deleteDiagram,
    isFactoryDiagram,
    type DiagramSummary,
    type SavedDiagramPayload,
    InvalidDiagramNameError,
} from '@/common/services/diagramPersistenceService';
import {
    fetchAssetInventory,
    fetchSplunkInventory,
    type TopologyDiscoveredNode,
} from '@/common/services/topologyDiscovery';
import {
    fetchHostVisibility,
    type HostVisibilityIndex,
} from '@/common/services/hostVisibilityService';
import { DiagramHeader } from '@/common/components/diagram/DiagramHeader';
import { DiagramPalette } from '@/common/components/diagram/DiagramPalette';
import {
    NetworkDiagramCanvas,
    type DiagramMode,
    type NetworkDiagramCanvasHandle,
} from '@/common/components/diagram/NetworkDiagramCanvas';
import { useTheme } from '@/common/hooks/useTheme';
import { ThemeToggle } from '@/common/components/florida/ThemeToggle';
import { AnimationsEnabledProvider } from '@/common/contexts/AnimationsEnabledContext';
import { IpAddressVisibilityProvider } from '@/common/contexts/IpAddressVisibilityContext';
import { useExportPage } from '@/common/hooks/useExportPage';

const BLANK_PAYLOAD: SavedDiagramPayload = {
    version: 1,
    nodes: [],
    edges: [],
    groups: [],
};

interface StatusMessage {
    kind: 'info' | 'error';
    text: string;
}

/** Strip noisy quotes/whitespace from prompt-supplied names. */
const sanitizeName = (raw: string): string => raw.trim().replace(/^"+|"+$/g, '');

/** Build 115.6 — current diagram is mirrored into the URL hash so
 *  a browser refresh (or a copy-paste of the URL into another
 *  tab) lands the operator back on the same diagram instead of
 *  the empty picker. We use the hash (not a query string)
 *  because Splunk Web's app routing already owns the path; the
 *  fragment is uniquely ours and never round-trips to the
 *  server. Format: `#diagram=<encoded-name>`. Empty hash means
 *  "no diagram" (blank canvas). */
const HASH_KEY = 'diagram';

const readDiagramHash = (): string | null => {
    if (typeof window === 'undefined') return null;
    const raw = window.location.hash;
    if (!raw || raw.length < 2) return null;
    // Strip the leading `#` and split on `&` to tolerate future
    // additional hash params without breaking parsing.
    const params = raw.slice(1).split('&');
    for (const part of params) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        const key = part.slice(0, eq);
        if (key !== HASH_KEY) continue;
        try {
            const value = decodeURIComponent(part.slice(eq + 1));
            return value.length > 0 ? value : null;
        } catch {
            return null;
        }
    }
    return null;
};

const writeDiagramHash = (name: string | null): void => {
    if (typeof window === 'undefined') return;
    const next = name
        ? `#${HASH_KEY}=${encodeURIComponent(name)}`
        : '';
    // Only write when the hash actually changed — assigning the
    // same value still pushes a history entry on some browsers.
    if (window.location.hash === next) return;
    // Use replaceState so navigating back doesn't walk the user
    // through every diagram they touched mid-session.
    if (window.history.replaceState) {
        const url = new URL(window.location.href);
        url.hash = next;
        window.history.replaceState(null, '', url.toString());
    } else {
        window.location.hash = next;
    }
};

const NetworkDiagramPage: React.FC = () => {
    const [diagramName, setDiagramName] = useState<string | null>(null);
    const [activePayload, setActivePayload] = useState<SavedDiagramPayload | null>(
        BLANK_PAYLOAD
    );
    /** Mirrors the canvas's current payload (live as the user
     *  edits). Distinct from `activePayload` (which is what's on
     *  disk, or null for "no diagram loaded yet") — this is what
     *  Save will write. */
    const livePayloadRef = useRef<SavedDiagramPayload>(BLANK_PAYLOAD);
    /** Build 113: tracks whether the live payload currently has an
     *  on-canvas title. Drives the header's Title-button label
     *  (Add vs Edit). Updated from `handleCanvasChange`. */
    const [hasTitle, setHasTitle] = useState<boolean>(
        Boolean(BLANK_PAYLOAD.title)
    );
    const [dirty, setDirty] = useState<boolean>(false);
    const [busy, setBusy] = useState<boolean>(false);
    const [availableDiagrams, setAvailableDiagrams] = useState<
        DiagramSummary[] | null
    >(null);
    const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
    const [assetIndex, setAssetIndex] = useState<Map<
        string,
        TopologyDiscoveredNode
    > | null>(null);
    /** Build 114: lightweight Splunk-host visibility index. Built
     *  from `| metadata type=hosts`. Threaded into the canvas so
     *  each device's status dot folds in "is Splunk currently
     *  seeing events from this host?". `null` until the search
     *  resolves; the canvas tolerates `null` by falling back to
     *  asset-only status. */
    const [hostVisibility, setHostVisibility] =
        useState<HostVisibilityIndex | null>(null);

    /** Build 113: edit (default) vs view (read-only / cinematic).
     *  In view mode we (a) hide the palette, (b) flip the canvas
     *  to read-only, and (c) request the browser fullscreen API.
     *  Esc → fullscreenchange listener auto-flips back to edit. */
    const [mode, setMode] = useState<DiagramMode>('edit');

    /** Build 115.10 — light / dark theme manager mirroring the
     *  Florida overview dashboard. Defaults to `system` so we
     *  follow the operator's OS preference unless they explicitly
     *  pick a side via the header toggle (persisted to
     *  localStorage by `useTheme`). */
    const { theme, resolvedTheme, cycle: cycleTheme } = useTheme();

    /** Build 115.12 — page-level animations kill switch. Drives
     *  every flowing-dot / marching-ants effect inside the canvas
     *  via `AnimationsEnabledProvider`. Persisted to localStorage
     *  so the operator's choice survives page reloads (and survives
     *  the URL-hash diagram switch, since the toggle is page-level
     *  not per-diagram). Default = on, matching pre-115.12
     *  behaviour for fresh installs.
     *
     *  Storage key is namespaced with `ndg-` (network-diagram-page)
     *  to keep the localStorage shared between this page and the
     *  rest of the app coherent (the theme manager uses `theme-`,
     *  the host-visibility cache uses `hv-`, etc.). */
    const ANIMATIONS_STORAGE_KEY = 'ndg-animations';
    const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        try {
            const raw = window.localStorage.getItem(ANIMATIONS_STORAGE_KEY);
            // Persisted value is the literal string 'off' for OFF,
            // anything else (including missing) means ON. We keep
            // the negative-encoded form so legacy reads default to
            // ON without an explicit migration.
            return raw !== 'off';
        } catch {
            return true;
        }
    });
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                ANIMATIONS_STORAGE_KEY,
                animationsEnabled ? 'on' : 'off'
            );
        } catch {
            // localStorage write can throw in private mode / when
            // the quota is full — failing silently is fine here,
            // the toggle still works for the duration of the
            // session, just won't survive a reload.
        }
    }, [animationsEnabled]);
    const toggleAnimations = useCallback((): void => {
        setAnimationsEnabled((prev) => !prev);
    }, []);

    /** Build 115.13 — IP-address visibility. Same plumbing as the
     *  animations toggle: localStorage-backed boolean, default ON
     *  for back-compat with diagrams authored before this build,
     *  flipped via the header's eye / eye-off pill, fanned out to
     *  every device card via `IpAddressVisibilityProvider`. */
    const IP_VISIBILITY_STORAGE_KEY = 'ndg-show-ips';
    const [ipAddressesVisible, setIpAddressesVisible] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        try {
            const raw = window.localStorage.getItem(IP_VISIBILITY_STORAGE_KEY);
            return raw !== 'off';
        } catch {
            return true;
        }
    });
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                IP_VISIBILITY_STORAGE_KEY,
                ipAddressesVisible ? 'on' : 'off'
            );
        } catch {
            // Same private-mode tolerance as the animations toggle —
            // a write failure is acceptable; the toggle still works
            // for the duration of the session.
        }
    }, [ipAddressesVisible]);
    const toggleIpAddresses = useCallback((): void => {
        setIpAddressesVisible((prev) => !prev);
    }, []);

    /** The DOM element we hand to `requestFullscreen()`. We ask the
     *  whole page wrapper to go fullscreen (instead of just the
     *  canvas) so the slim header stays available for the Exit
     *  button, while the OS chrome — taskbar, menu bar — drops
     *  away for a true cinematic look. */
    const pageWrapperRef = useRef<HTMLDivElement | null>(null);
    /** Build 115.13 — separate ref for PNG / PDF export. We
     *  capture only the canvas surface (not the header) so the
     *  exported artefact is a clean topology, the same way an
     *  operator would screen-grab the diagram for a slide deck.
     *  The hook is generic, so a future "include header" toggle
     *  could swap this for `pageWrapperRef` without code churn. */
    const exportTargetRef = useRef<HTMLDivElement | null>(null);
    const sanitizedExportName =
        diagramName?.trim().replace(/[^a-zA-Z0-9._-]+/g, '_') ?? 'diagram';
    const { exporting, exportAs } = useExportPage({
        targetRef: exportTargetRef,
        fileName: `network-diagram-${sanitizedExportName || 'untitled'}`,
    });
    const handleExport = useCallback(
        (format: 'png' | 'pdf'): void => {
            void exportAs(format);
        },
        [exportAs]
    );
    /** Imperative handle to the canvas — header's Title button uses
     *  it to insert / focus the diagram-title node without the page
     *  having to thread title state through props. */
    const canvasHandleRef = useRef<NetworkDiagramCanvasHandle | null>(null);
    /** Build 115.6 — held across renders so the initial-load
     *  effect (which only fires once) can call the latest version
     *  of handleOpen without depending on it. The ref is updated
     *  on every render via the assignment further down. */
    const handleOpenRef = useRef<
        ((name: string, options?: { silent?: boolean }) => Promise<void>) | null
    >(null);

    /** Build 115.20 — info messages still auto-clear after 3.5s
     *  ("Saved 'foo' at 3:21pm" doesn't deserve permanent real
     *  estate). Errors now stay put until the operator either
     *  dismisses them explicitly (X in the banner) or triggers
     *  another operation that replaces the message.
     *
     *  Why we removed the 8-second error auto-dismiss:
     *
     *    • CSRF errors prompt the operator to reload — they may
     *      need ~30s to glance at the canvas, decide whether to
     *      copy unsaved work first, then click Reload. An 8s
     *      timer was eating the banner mid-decision and leaving
     *      them with no breadcrumb of why the save failed.
     *
     *    • Generic save errors (validation, network) deserve
     *      the same patience — disappearing error toasts are an
     *      anti-pattern in any tool you'd commit changes from.
     *
     *  The next save / open / delete writes a new statusMessage,
     *  which naturally evicts the old one. */
    useEffect(() => {
        if (!statusMessage) return undefined;
        if (statusMessage.kind === 'error') return undefined;
        const timer = window.setTimeout(() => setStatusMessage(null), 3500);
        return () => window.clearTimeout(timer);
    }, [statusMessage]);

    // Beforeunload guard. Returning a string in the handler is
    // legacy behaviour but still triggers the browser's native
    // "leave site?" dialog in Chrome / Firefox / Safari.
    useEffect(() => {
        if (!dirty) return undefined;
        const handler = (e: BeforeUnloadEvent): string => {
            e.preventDefault();
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    // Initial load: warm the diagrams directory and the
    // asset_inventory index in parallel.
    useEffect(() => {
        let cancelled = false;
        listDiagrams()
            .then((list) => {
                if (cancelled) return;
                setAvailableDiagrams(list);
                // Build 115.6 — once the directory is loaded,
                // reopen whatever diagram the URL hash points
                // at. We do it here (not in a separate effect)
                // so the picker and the open call see the same
                // list — autoreopening a diagram that has just
                // been deleted is silently a no-op rather than
                // an "open failed" error toast.
                const wanted = readDiagramHash();
                if (!wanted) return;
                if (!list.some((d) => d.name === wanted)) {
                    // Stale hash (diagram deleted or renamed).
                    // Clear it so the next refresh lands on the
                    // empty picker instead of repeatedly trying
                    // to open the missing diagram.
                    writeDiagramHash(null);
                    return;
                }
                void handleOpenRef.current?.(wanted, { silent: true });
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setAvailableDiagrams([]);
                setStatusMessage({
                    kind: 'error',
                    text:
                        err instanceof Error
                            ? `Couldn't load diagrams directory: ${err.message}`
                            : "Couldn't load diagrams directory.",
                });
            });
        // Build 115.4 — fetch Cisco asset_inventory AND
        // splunk_inventory in parallel, then merge into a single
        // assetIndex. Both fetchers reject on network failure but
        // we treat each independently (a Splunk-Cloud customer
        // might have asset_inventory empty; an Enterprise ops
        // team might have splunk_inventory empty until the
        // discovery saved search finishes its first run). The
        // canvas hydrates whichever source landed; the
        // InventoryTab and Bind-to-host typeahead see whatever
        // is in the merged map.
        Promise.allSettled([fetchAssetInventory(), fetchSplunkInventory()]).then(
            ([ciscoResult, splunkResult]) => {
                if (cancelled) return;
                const map = new Map<string, TopologyDiscoveredNode>();
                if (ciscoResult.status === 'fulfilled') {
                    for (const r of ciscoResult.value) map.set(r.id, r);
                }
                if (splunkResult.status === 'fulfilled') {
                    // Splunk hosts win on a key collision — they
                    // carry the live `is_connected` health signal
                    // and the role-aware model string, both more
                    // useful for diagramming than the
                    // asset_inventory equivalent. Genuine
                    // collisions should be rare (Splunk hostnames
                    // and Cisco device_names are independently
                    // namespaced in practice).
                    for (const r of splunkResult.value) map.set(r.id, r);
                }
                setAssetIndex(map);
            }
        );
        // Build 114: kick off the metadata fetch in parallel with
        // asset_inventory. The two are independent — neither
        // blocks the other and the canvas hydrates incrementally
        // as each lands. fetchHostVisibility resolves to an empty
        // index on failure (never rejects), so we don't need a
        // catch handler here.
        fetchHostVisibility().then((index) => {
            if (!cancelled) setHostVisibility(index);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const refreshDirectory = useCallback(() => {
        listDiagrams()
            .then(setAvailableDiagrams)
            .catch(() => {
                // Don't clobber a working directory listing on a
                // transient error — just leave the previous list
                // visible.
            });
    }, []);

    const handleCanvasChange = useCallback(
        (payload: SavedDiagramPayload) => {
            livePayloadRef.current = payload;
            // Mark dirty only when the live payload actually
            // diverges from the persisted one. We use a cheap
            // JSON-string compare; for typical diagram sizes this
            // is microseconds.
            const persisted = JSON.stringify(activePayload ?? BLANK_PAYLOAD);
            const live = JSON.stringify(payload);
            setDirty(persisted !== live);
            // Build 113: refresh the "has title" flag so the header
            // button label (Add vs Edit) stays in sync as the
            // operator inserts or removes the title.
            setHasTitle(Boolean(payload.title));
        },
        [activePayload]
    );

    /** Build 113: when a diagram is loaded (or a brand new one is
     *  started), the `activePayload` change above doesn't run
     *  through `handleCanvasChange`. Re-derive `hasTitle` from
     *  whatever payload is now active so the Title button label
     *  reflects the loaded state. */
    useEffect(() => {
        setHasTitle(Boolean(activePayload?.title));
    }, [activePayload]);

    /** Build 113: enter / leave view (presentation) mode.
     *
     *  Entering view mode also requests browser fullscreen so the
     *  diagram fills the entire display. We attempt fullscreen on a
     *  best-effort basis — if the browser refuses (e.g. iOS Safari,
     *  permission denied), we still flip to view mode so the
     *  read-only experience works regardless. */
    const enterViewMode = useCallback(() => {
        setMode('view');
        const el = pageWrapperRef.current;
        if (!el) return;
        const req =
            el.requestFullscreen ??
            (el as unknown as { webkitRequestFullscreen?: () => Promise<void> })
                .webkitRequestFullscreen;
        if (req) {
            try {
                const result = req.call(el);
                if (result && typeof (result as Promise<void>).catch === 'function') {
                    (result as Promise<void>).catch(() => {
                        // Ignored — view mode still works without
                        // fullscreen, and surfacing a permission
                        // error here would distract from the
                        // primary goal.
                    });
                }
            } catch {
                // Same rationale as above.
            }
        }
    }, []);

    const exitViewMode = useCallback(() => {
        setMode('edit');
        if (document.fullscreenElement) {
            try {
                void document.exitFullscreen?.();
            } catch {
                // Browser will eventually drop fullscreen; ignore.
            }
        }
    }, []);

    /** Build 113: react to fullscreen exits triggered outside our
     *  control — pressing Esc, the OS gesture, or another tab
     *  stealing focus. We treat any "fullscreen lost" event as an
     *  implicit "exit view" so the UI never gets stuck in
     *  presentation mode without a way out. */
    useEffect(() => {
        const onFsChange = (): void => {
            if (!document.fullscreenElement) {
                setMode('edit');
            }
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const handleModeChange = useCallback(
        (next: DiagramMode) => {
            if (next === 'view') enterViewMode();
            else exitViewMode();
        },
        [enterViewMode, exitViewMode]
    );

    const handleAddOrSelectTitle = useCallback(() => {
        canvasHandleRef.current?.addOrSelectTitle();
    }, []);

    const handleNew = useCallback(() => {
        if (dirty) {
            const confirm = window.confirm(
                'Discard unsaved changes and start a new blank diagram?'
            );
            if (!confirm) return;
        }
        setDiagramName(null);
        setActivePayload(BLANK_PAYLOAD);
        livePayloadRef.current = BLANK_PAYLOAD;
        setDirty(false);
        writeDiagramHash(null);
        setStatusMessage({ kind: 'info', text: 'Started new blank diagram.' });
    }, [dirty]);

    const handleOpen = useCallback(
        async (name: string, options?: { silent?: boolean }) => {
            const silent = options?.silent === true;
            // Build 115.6 — silent opens skip the dirty-prompt
            // because the auto-reopen on page load can't
            // possibly conflict with unsaved work (we just
            // mounted), and skip the success toast because the
            // operator didn't initiate the action.
            if (!silent && dirty) {
                const confirm = window.confirm(
                    'Discard unsaved changes and load a different diagram?'
                );
                if (!confirm) return;
            }
            setBusy(true);
            try {
                const payload = await loadDiagram(name);
                if (!payload) {
                    setStatusMessage({
                        kind: 'error',
                        text: `Diagram "${name}" not found.`,
                    });
                    return;
                }
                setDiagramName(name);
                setActivePayload(payload);
                livePayloadRef.current = payload;
                setDirty(false);
                writeDiagramHash(name);
                if (!silent) {
                    setStatusMessage({
                        kind: 'info',
                        text: `Opened "${name}".`,
                    });
                }
            } catch (err) {
                setStatusMessage({
                    kind: 'error',
                    text:
                        err instanceof Error
                            ? `Open failed: ${err.message}`
                            : 'Open failed.',
                });
            } finally {
                setBusy(false);
            }
        },
        [dirty]
    );

    // handleOpenRef is updated below — declared at the top of
    // the component so the directory-load effect can read it.
    handleOpenRef.current = handleOpen;

    const persist = useCallback(
        async (name: string) => {
            setBusy(true);
            try {
                const payload = livePayloadRef.current;
                const summary = await saveDiagram(name, payload);
                setDiagramName(summary.name);
                setActivePayload(payload);
                setDirty(false);
                writeDiagramHash(summary.name);
                setStatusMessage({
                    kind: 'info',
                    text: `Saved "${summary.name}" at ${new Date(
                        summary.updatedAt
                    ).toLocaleTimeString()}.`,
                });
                refreshDirectory();
            } catch (err) {
                setStatusMessage({
                    kind: 'error',
                    text:
                        err instanceof InvalidDiagramNameError
                            ? err.message
                            : err instanceof Error
                              ? `Save failed: ${err.message}`
                              : 'Save failed.',
                });
            } finally {
                setBusy(false);
            }
        },
        [refreshDirectory]
    );

    const handleSave = useCallback(() => {
        if (!diagramName) return;
        void persist(diagramName);
    }, [diagramName, persist]);

    const handleSaveAs = useCallback(
        (rawName: string) => {
            const name = sanitizeName(rawName);
            if (!name) return;
            void persist(name);
        },
        [persist]
    );

    /** Build 115.7 — "delete" semantics differ depending on the
     *  diagram's layer presence:
     *    • Factory + local override → DELETE clears the local
     *      stanza; on success we reload the underlying default
     *      ("revert to factory") instead of dropping to a blank
     *      canvas. The persistence service's REST DELETE only
     *      removes from `local/`, so the very next listDiagrams()
     *      will surface the OOB version again.
     *    • Custom diagram → DELETE removes the only copy; we
     *      drop to a blank canvas as before.
     *  Disabled for factory-without-override; the header should
     *  never invoke this in that state. */
    const handleDelete = useCallback(async () => {
        if (!diagramName) return;
        const isFactory = isFactoryDiagram(diagramName);
        setBusy(true);
        try {
            await deleteDiagram(diagramName);
            if (isFactory) {
                // Reload the (now-default-only) version of the
                // diagram so the canvas shows the OOB layout
                // immediately. We surface a "Reverted" toast
                // rather than "Deleted" because the diagram is
                // still very much there from the user's POV.
                const payload = await loadDiagram(diagramName);
                if (payload) {
                    setActivePayload(payload);
                    livePayloadRef.current = payload;
                    setDirty(false);
                    writeDiagramHash(diagramName);
                    setStatusMessage({
                        kind: 'info',
                        text: `Reverted "${diagramName}" to factory.`,
                    });
                } else {
                    // Defensive: if the default version somehow
                    // can't be loaded, fall through to the blank
                    // state so the operator isn't stuck on a
                    // stale local payload.
                    setDiagramName(null);
                    setActivePayload(BLANK_PAYLOAD);
                    livePayloadRef.current = BLANK_PAYLOAD;
                    setDirty(false);
                    writeDiagramHash(null);
                    setStatusMessage({
                        kind: 'info',
                        text: `Reverted "${diagramName}" — factory copy not found, opened blank canvas.`,
                    });
                }
            } else {
                setStatusMessage({
                    kind: 'info',
                    text: `Deleted "${diagramName}".`,
                });
                setDiagramName(null);
                setActivePayload(BLANK_PAYLOAD);
                livePayloadRef.current = BLANK_PAYLOAD;
                setDirty(false);
                writeDiagramHash(null);
            }
            refreshDirectory();
        } catch (err) {
            setStatusMessage({
                kind: 'error',
                text:
                    err instanceof Error
                        ? `${isFactory ? 'Revert' : 'Delete'} failed: ${err.message}`
                        : `${isFactory ? 'Revert' : 'Delete'} failed.`,
            });
        } finally {
            setBusy(false);
        }
    }, [diagramName, refreshDirectory]);

    const activeDiagramSummary = availableDiagrams?.find(
        (d) => d.name === diagramName
    );
    const diagramExistsOnServer = Boolean(
        diagramName && activeDiagramSummary
    );
    /** Build 115.7 — distinguishes the three Delete-button states
     *  without mixing them up in render-side branching. */
    const isFactoryActive = isFactoryDiagram(diagramName);
    /** Whether splunkd would actually accept a DELETE on the
     *  active diagram. Falls back to `diagramExistsOnServer` when
     *  the directory listing pre-dates the 115.7 metadata —
     *  pre-115.7 saves get treated as removable, which matches
     *  the legacy behaviour. */
    const activeHasLocalOverride =
        activeDiagramSummary?.hasLocalOverride ??
        // For brand-new (never-saved) diagrams we have no row in
        // availableDiagrams yet → behave as "no override".
        (diagramExistsOnServer ? true : false);

    const isViewMode = mode === 'view';

    return (
        <div
            ref={pageWrapperRef}
            className={cn(
                'scd-network-diagram-page flex flex-col w-full h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100',
                // Build 115.10 — Tailwind runs in `class` darkMode,
                // so we need the literal `dark` class on a wrapper
                // when the resolved theme is dark. The wrapper-level
                // application here mirrors the overview dashboard so
                // the diagram page picks up the same styles. The
                // `dark:` utilities listed above on this wrapper take
                // care of body / text base colours; the rest of the
                // tree was already authored with `dark:` variants
                // for the Cyber-NOC palette.
                resolvedTheme === 'dark' && 'dark'
            )}
        >
            <DiagramHeader
                diagramName={diagramName}
                dirty={dirty}
                busy={busy}
                availableDiagrams={availableDiagrams}
                diagramExistsOnServer={diagramExistsOnServer}
                isFactoryDiagram={isFactoryActive}
                hasLocalOverride={activeHasLocalOverride}
                statusMessage={statusMessage}
                onDismissStatus={() => setStatusMessage(null)}
                mode={mode}
                hasTitle={hasTitle}
                onNew={handleNew}
                onOpen={(name) => void handleOpen(name)}
                onSave={handleSave}
                onSaveAs={handleSaveAs}
                onDelete={() => void handleDelete()}
                onRefreshDirectory={refreshDirectory}
                onAddOrSelectTitle={handleAddOrSelectTitle}
                onModeChange={handleModeChange}
                animationsEnabled={animationsEnabled}
                onToggleAnimations={toggleAnimations}
                ipAddressesVisible={ipAddressesVisible}
                onToggleIpAddresses={toggleIpAddresses}
                onExport={handleExport}
                exporting={exporting}
                themeSlot={
                    <ThemeToggle theme={theme} onCycle={cycleTheme} iconOnly />
                }
            />
            <main className="flex-1 min-h-0 flex">
                {/* Build 113: hide the device palette entirely in view
                 *  mode. The whole point of view mode is to show the
                 *  diagram as a finished artefact — exposing the
                 *  drag-source palette would break the illusion. */}
                {!isViewMode && <DiagramPalette className="flex-shrink-0" />}
                <div
                    ref={exportTargetRef}
                    className={cn(
                        'flex-1 min-w-0',
                        // In view mode we drop the inset padding so the
                        // canvas fills edge-to-edge, giving the
                        // presentation a true "fullscreen diagram"
                        // feel without a narrow gutter around it.
                        isViewMode ? 'p-0' : 'p-3'
                    )}
                >
                    {/* Build 115.12 — fan the page-level animations
                     *  toggle out to every <AnimatedEdge> via context.
                     *  Wrapping just the canvas (not the whole page)
                     *  keeps the provider scope minimal — the header
                     *  toggle button doesn't need to read its own
                     *  state from context, it gets the value through
                     *  the prop pair above.
                     *  Build 115.13 — same pattern adopted for the
                     *  IP-visibility toggle so the canvas's device
                     *  cards (deep in React Flow's node-type tree)
                     *  see the flag without us forking node data. */}
                    <AnimationsEnabledProvider value={animationsEnabled}>
                        <IpAddressVisibilityProvider value={ipAddressesVisible}>
                            <NetworkDiagramCanvas
                                initialPayload={activePayload}
                                assetIndex={assetIndex}
                                hostVisibility={hostVisibility}
                                onChange={handleCanvasChange}
                                mode={mode}
                                handleRef={canvasHandleRef}
                                /* Build 115.23 — pipe the export flag
                                 * down so the canvas can hide the dot
                                 * grid + force a white wrapper while
                                 * html2canvas is rasterising. */
                                exporting={exporting}
                                className={cn('h-full', isViewMode && 'rounded-none border-0')}
                            />
                        </IpAddressVisibilityProvider>
                    </AnimationsEnabledProvider>
                </div>
            </main>
        </div>
    );
};

export default NetworkDiagramPage;
