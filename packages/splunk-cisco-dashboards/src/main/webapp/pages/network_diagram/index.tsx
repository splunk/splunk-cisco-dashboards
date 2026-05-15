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
import {
    listDiagrams,
    loadDiagram,
    saveDiagram,
    deleteDiagram,
    type DiagramSummary,
    type SavedDiagramPayload,
    InvalidDiagramNameError,
} from '@/common/services/diagramPersistenceService';
import {
    fetchAssetInventory,
    type TopologyDiscoveredNode,
} from '@/common/services/topologyDiscovery';
import { DiagramHeader } from '@/common/components/diagram/DiagramHeader';
import { DiagramPalette } from '@/common/components/diagram/DiagramPalette';
import { NetworkDiagramCanvas } from '@/common/components/diagram/NetworkDiagramCanvas';

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

    // Status messages auto-clear after a short timer so the
    // header stays uncluttered between saves. Errors stick
    // around longer than info messages to give the operator
    // time to read.
    useEffect(() => {
        if (!statusMessage) return undefined;
        const ttl = statusMessage.kind === 'error' ? 8000 : 3500;
        const timer = window.setTimeout(() => setStatusMessage(null), ttl);
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
                if (!cancelled) setAvailableDiagrams(list);
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
        fetchAssetInventory()
            .then((rows) => {
                if (cancelled) return;
                const map = new Map<string, TopologyDiscoveredNode>();
                for (const r of rows) map.set(r.id, r);
                setAssetIndex(map);
            })
            .catch(() => {
                // Asset inventory not available is OK — the canvas
                // still renders generic shape nodes from the saved
                // payload; we just lose the live re-bind.
                if (!cancelled) setAssetIndex(new Map());
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
        },
        [activePayload]
    );

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
        setStatusMessage({ kind: 'info', text: 'Started new blank diagram.' });
    }, [dirty]);

    const handleOpen = useCallback(
        async (name: string) => {
            if (dirty) {
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
                setStatusMessage({ kind: 'info', text: `Opened "${name}".` });
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

    const persist = useCallback(
        async (name: string) => {
            setBusy(true);
            try {
                const payload = livePayloadRef.current;
                const summary = await saveDiagram(name, payload);
                setDiagramName(summary.name);
                setActivePayload(payload);
                setDirty(false);
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

    const handleDelete = useCallback(async () => {
        if (!diagramName) return;
        setBusy(true);
        try {
            await deleteDiagram(diagramName);
            setStatusMessage({
                kind: 'info',
                text: `Deleted "${diagramName}".`,
            });
            setDiagramName(null);
            setActivePayload(BLANK_PAYLOAD);
            livePayloadRef.current = BLANK_PAYLOAD;
            setDirty(false);
            refreshDirectory();
        } catch (err) {
            setStatusMessage({
                kind: 'error',
                text:
                    err instanceof Error
                        ? `Delete failed: ${err.message}`
                        : 'Delete failed.',
            });
        } finally {
            setBusy(false);
        }
    }, [diagramName, refreshDirectory]);

    const diagramExistsOnServer = Boolean(
        diagramName &&
            availableDiagrams &&
            availableDiagrams.some((d) => d.name === diagramName)
    );

    return (
        <div className="flex flex-col w-full h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <DiagramHeader
                diagramName={diagramName}
                dirty={dirty}
                busy={busy}
                availableDiagrams={availableDiagrams}
                diagramExistsOnServer={diagramExistsOnServer}
                statusMessage={statusMessage}
                onNew={handleNew}
                onOpen={(name) => void handleOpen(name)}
                onSave={handleSave}
                onSaveAs={handleSaveAs}
                onDelete={() => void handleDelete()}
                onRefreshDirectory={refreshDirectory}
            />
            <main className="flex-1 min-h-0 flex">
                <DiagramPalette className="flex-shrink-0" />
                <div className="flex-1 min-w-0 p-3">
                    <NetworkDiagramCanvas
                        initialPayload={activePayload}
                        assetIndex={assetIndex}
                        onChange={handleCanvasChange}
                        className="h-full"
                    />
                </div>
            </main>
        </div>
    );
};

export default NetworkDiagramPage;
