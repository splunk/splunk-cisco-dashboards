/**
 * useExportPage — capture an arbitrary DOM subtree to PDF or PNG.
 *
 * Implementation uses html2canvas (rasterizes the DOM via a synthetic
 * canvas) and jsPDF (wraps the resulting PNG in an A4 landscape PDF).
 * Both libraries are dynamically imported on the first export so we
 * don't pay their bundle cost (~250 KiB combined) on initial page load.
 *
 * Why not @microsoft/playwright / a screenshot service? html2canvas is
 * fully client-side, so the export works in air-gapped Splunk
 * environments without a backend dependency.
 *
 * Build 1174 — animation freeze + opt-out swap. html2canvas walks the
 * DOM and rebuilds it on a synthetic canvas; it does NOT play through
 * SMIL animations (`<animate>`, `<animateTransform>`) or Leaflet's
 * compositor transforms. The result on the live topology map was a
 * mangled raster: dashed flow lines snapping to t=0, marker pulses
 * frozen mid-keyframe, and tile transforms drawn at the wrong scale
 * so links extended past the panel bounds. Two-pronged fix:
 *
 *   1. Pause SVG SMIL animations on every `<svg>` under the target
 *      before rasterising, then resume after — `pauseAnimations()` is
 *      a real Web API on SVGSVGElement and is what every "freeze
 *      animation for screenshot" recipe uses.
 *   2. Set `data-exporting` on `<html>` so CSS can swap any element
 *      tagged `[data-export-hide]` for its sibling
 *      `[data-export-placeholder]`. Components that html2canvas can't
 *      faithfully render (Leaflet maps, animated SVG flows) opt in by
 *      pairing the two attributes — see CustomerTopologyMap. Once the
 *      capture finishes the attribute is cleared and the live element
 *      reappears.
 *
 * The two mechanisms are complementary: SMIL pause keeps non-hidden
 * animated SVGs (sparkline tweens, status pulses) from being captured
 * mid-frame; the substitute swap is for content that's fundamentally
 * un-rasterisable.
 *
 * Build 1185 — export chrome guard. Some pages have editor UI inside
 * the capture target (React Flow minimap, zoom controls, help bubble).
 * Components can mark those affordances with `data-export-exclude`, and
 * this hook also skips known React Flow panel/background classes so PNG
 * / PDF output stays diagram-only even if the live editor chrome is
 * visible on screen.
 *
 * Build 1192 — topology link freeze. `pauseAnimations()` from
 * Build 1174 freezes SMIL on the LIVE document, but html2canvas works
 * by cloning the DOM into a sandbox iframe and re-parsing it; the
 * cloned `<animate>` children re-trigger from t=0 in that fresh
 * document, so the rasterised path renders at whatever frame the new
 * SMIL clock has reached when html2canvas decides to paint. With a 1.6s
 * dur on `stroke-dashoffset` 0 → -24, that's enough variance for the
 * dashes to land on a phase where most of the visible curve is gap
 * rather than ink, and the exported map looks like the line vanished.
 *
 * Stronger fix: bake the topology link `<path>`s into a known-good
 * static state for the duration of html2canvas — remove the SMIL
 * `<animate>` children, force `stroke-dasharray` off (solid line),
 * `stroke-dashoffset=0`, `stroke-opacity=1`. Snapshot the originals
 * first and reverse every change in `finally` so the live map is
 * pixel-identical after the export. The packet circles use
 * `<animateMotion>`, which html2canvas can't position at all (the
 * `<circle cx=0 cy=0>` only acquires a real x/y from the running motion
 * animation, so without it they all rasterise at the layer origin).
 * Hide the entire packet group during export and reveal it again in
 * `finally`.
 *
 * Leaflet clone geometry guard — Leaflet positions its tiles, marker
 * icons, and SVG overlay with several nested translate3d transforms.
 * Browsers compose those transforms correctly, but html2canvas applies
 * the cloned SVG viewBox and pane transforms in different coordinate
 * spaces. The exported basemap and markers therefore looked plausible
 * while the connectivity paths were shifted away from their sites.
 *
 * Before capture, record the painted rectangle of each Leaflet visual
 * relative to its map. In html2canvas's cloned document, remove the pane
 * transforms and place each visual at that recorded rectangle. This
 * preserves the exact live viewport without mutating or reinitialising
 * the interactive Leaflet map.
 */

import { useCallback, useState } from 'react';

export type ExportFormat = 'png' | 'pdf';

export interface UseExportPageOptions {
    /** DOM ref pointing at the element to capture. */
    targetRef: React.RefObject<HTMLElement | null>;
    /** File-name stem (no extension). */
    fileName?: string;
}

export interface UseExportPageResult {
    exporting: boolean;
    error: string | null;
    exportAs: (format: ExportFormat) => Promise<void>;
}

export const useExportPage = ({
    targetRef,
    fileName = 'overview-dashboard',
}: UseExportPageOptions): UseExportPageResult => {
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const exportAs = useCallback(
        async (format: ExportFormat) => {
            const node = targetRef.current;
            if (!node) {
                setError('Nothing to export yet.');
                return;
            }
            setExporting(true);
            setError(null);
            // Build 1174 — flag the document as exporting BEFORE we
            // start the dynamic-import await above. This lets CSS
            // rules (and any consuming component reading the
            // attribute) swap to export-safe variants ahead of the
            // rAF tick below, so by the time html2canvas reads the
            // DOM the substitute placeholders are already laid out.
            // Cleared in `finally` regardless of capture outcome so a
            // failed export can never leave the page in "permanently
            // exporting" mode.
            const root = typeof document !== 'undefined' ? document.documentElement : null;
            if (root) root.setAttribute('data-exporting', 'true');
            // Track every SVG we paused so we can resume only those
            // exact elements in `finally`. Naively pausing every SVG
            // under the target and resuming via a separate query
            // would re-resume SVGs that were already paused for
            // unrelated reasons (e.g. a chart that explicitly stops
            // its own animations on hover) and is fragile.
            const pausedSvgs: SVGSVGElement[] = [];
            // Build 1192 — topology link freeze + packet group hide.
            // We mutate the live DOM in-place (cheaper than cloning the
            // whole map subtree) and reverse every change in `finally`,
            // including on the error path. Each entry captures enough
            // state to put the element back exactly as we found it.
            interface FrozenLink {
                element: SVGPathElement;
                animates: Array<{ node: SVGElement; index: number }>;
                strokeDasharray: string | null;
                strokeDashoffset: string | null;
                strokeOpacity: string | null;
            }
            const frozenLinks: FrozenLink[] = [];
            const hiddenPacketGroups: Array<{
                element: SVGGElement;
                display: string | null;
            }> = [];
            let preparedLeafletMaps: PreparedLeafletMaps | null = null;
            try {
                const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                    import('html2canvas'),
                    import('jspdf'),
                ]);
                /* Build 115.23 — wait one rAF after `setExporting(true)`
                 * so the consumer's tree has actually re-rendered with
                 * `exporting=true` BEFORE html2canvas reads the DOM.
                 * Otherwise the dynamic-import await above is fast
                 * enough on warm caches that we'd rasterise the
                 * pre-update layout (dot grid still showing, etc.).
                 * One frame is enough — React commits + the browser
                 * paints in the same frame for a single state flip. */
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => resolve());
                });
                // Build 1174 — pause SVG SMIL animations across the
                // entire capture target so every animated SVG freezes
                // at its current frame instead of being rasterised
                // mid-tween (or, worse, snapped back to t=0 by
                // html2canvas's clone). `pauseAnimations()` is the
                // standard SVGSVGElement method and is a no-op on
                // SVGs that have no SMIL content, so blanket-applying
                // it is safe. We guard the call because the method
                // can throw on detached / not-yet-loaded SVGs in some
                // browsers — a single failure shouldn't abort the
                // export; we just keep that one SVG animating.
                const svgList = node.querySelectorAll('svg');
                svgList.forEach((svg) => {
                    const svgEl = svg as SVGSVGElement;
                    try {
                        if (typeof svgEl.pauseAnimations === 'function') {
                            svgEl.pauseAnimations();
                            pausedSvgs.push(svgEl);
                        }
                    } catch {
                        /* See above — keep going on per-element failure. */
                    }
                });
                // Build 1192 — bake topology link <path>s into a solid,
                // fully-opaque static state so html2canvas's clone has
                // nothing animated to mis-render. Prefer the semantic
                // class from TopologyLinkPath, but also discover the
                // actual parent of each SMIL node.
                // react-leaflet does not consistently retain a
                // pathOptions.className when it applies later setStyle
                // updates, while the animate child is authoritative.
                const linkPaths = new Set<SVGPathElement>();
                node.querySelectorAll('path.customer-topology-link-shell')
                    .forEach((path) => {
                        linkPaths.add(path as SVGPathElement);
                    });
                node.querySelectorAll(
                    'animate[data-customer-topology-flow]'
                ).forEach((animate) => {
                    const parent = animate.parentNode;
                    if (parent instanceof SVGPathElement) {
                        linkPaths.add(parent);
                    }
                });
                linkPaths.forEach((path) => {
                    try {
                        const animateNodes = Array.from(
                            path.querySelectorAll(
                                'animate[data-customer-topology-flow]'
                            )
                        ) as SVGElement[];
                        // Snapshot the index of each <animate> so we can
                        // reattach in the same order after the capture.
                        const childList = Array.from(path.childNodes);
                        const animates = animateNodes.map((node) => ({
                            node,
                            index: childList.indexOf(node),
                        }));
                        frozenLinks.push({
                            element: path,
                            animates,
                            strokeDasharray:
                                path.getAttribute('stroke-dasharray'),
                            strokeDashoffset:
                                path.getAttribute('stroke-dashoffset'),
                            strokeOpacity: path.getAttribute('stroke-opacity'),
                        });
                        animateNodes.forEach((animate) => {
                            try {
                                animate.parentNode?.removeChild(animate);
                            } catch {
                                /* Best effort. */
                            }
                        });
                        // Solid line, no offset, fully opaque — these win
                        // against Leaflet's pathOptions because they're
                        // set as DOM attributes after Leaflet has
                        // already drawn the path for this paint.
                        path.setAttribute('stroke-dasharray', '');
                        path.setAttribute('stroke-dashoffset', '0');
                        path.setAttribute('stroke-opacity', '1');
                    } catch {
                        /* If a single path fails, keep going — the rest
                         * of the export is still useful. */
                    }
                });
                // Build 1192 — hide the packet group. Packets use
                // <animateMotion> to ride the bezier path; without the
                // running motion their <circle cx=0 cy=0> renders at
                // the SVG layer origin, which appears in the export as
                // a stray dot bunch in the top-left of the map. Hiding
                // the entire group is cleaner than per-circle freezing.
                const packetGroups = node.querySelectorAll(
                    'g.customer-topology-packets-group'
                );
                packetGroups.forEach((rawGroup) => {
                    const group = rawGroup as SVGGElement;
                    try {
                        hiddenPacketGroups.push({
                            element: group,
                            display: group.getAttribute('display'),
                        });
                        group.setAttribute('display', 'none');
                    } catch {
                        /* See above. */
                    }
                });
                preparedLeafletMaps = prepareLeafletMapsForExport(node);
                const canvas = await html2canvas(node, {
                    /* Build 115.23 — pure white instead of the prior
                     * `#f8fafc` (slate-50). Exports are shareable
                     * artefacts and the off-white tint read as
                     * "dirty" against the surrounding white of slide
                     * decks / PDFs / docs. */
                    backgroundColor: '#ffffff',
                    scale: window.devicePixelRatio > 1 ? 2 : 1.5,
                    useCORS: true,
                    logging: false,
                    ignoreElements: shouldIgnoreExportElement,
                    onclone: (clonedDocument) => {
                        if (preparedLeafletMaps) {
                            flattenLeafletCloneGeometry(
                                clonedDocument,
                                preparedLeafletMaps.maps
                            );
                        }
                    },
                });
                const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                const base = `${fileName}-${stamp}`;

                if (format === 'png') {
                    const dataUrl = canvas.toDataURL('image/png');
                    triggerDownload(dataUrl, `${base}.png`);
                    return;
                }

                // PDF: A4 landscape, fit the canvas into the page while
                // preserving aspect ratio.
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'pt',
                    format: 'a4',
                });
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const ratio = Math.min(
                    pageWidth / canvas.width,
                    pageHeight / canvas.height
                );
                const renderWidth = canvas.width * ratio;
                const renderHeight = canvas.height * ratio;
                const offsetX = (pageWidth - renderWidth) / 2;
                const offsetY = (pageHeight - renderHeight) / 2;
                pdf.addImage(
                    canvas.toDataURL('image/png'),
                    'PNG',
                    offsetX,
                    offsetY,
                    renderWidth,
                    renderHeight
                );
                pdf.save(`${base}.pdf`);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Export failed.');
            } finally {
                // Build 1192 — reverse the topology link freeze and
                // packet hide BEFORE resuming SMIL. Reattach the
                // <animate> children at their original indices and
                // restore the original attribute values; if the
                // attribute wasn't present originally we strip the
                // override we added rather than leaving a stale value.
                frozenLinks.forEach((entry) => {
                    try {
                        const restoreAttr = (
                            name: string,
                            original: string | null
                        ) => {
                            if (original === null) {
                                entry.element.removeAttribute(name);
                            } else {
                                entry.element.setAttribute(name, original);
                            }
                        };
                        restoreAttr('stroke-dasharray', entry.strokeDasharray);
                        restoreAttr(
                            'stroke-dashoffset',
                            entry.strokeDashoffset
                        );
                        restoreAttr('stroke-opacity', entry.strokeOpacity);
                        entry.animates.forEach(({ node, index }) => {
                            const children = entry.element.childNodes;
                            const target = children[index] ?? null;
                            try {
                                entry.element.insertBefore(node, target);
                            } catch {
                                /* As a last resort, append — the
                                 * <animate> only needs to be a child of
                                 * the path, position within children
                                 * doesn't change rendering. */
                                try {
                                    entry.element.appendChild(node);
                                } catch {
                                    /* No-op. */
                                }
                            }
                        });
                    } catch {
                        /* If restoration fails for one path the others
                         * still get cleaned up. The next React re-render
                         * of TopologyLinkPath will rebuild the
                         * <animate> children from scratch via its
                         * effect, so even total failure here self-heals
                         * on the next zoom/pan/state change. */
                    }
                });
                hiddenPacketGroups.forEach((entry) => {
                    try {
                        if (entry.display === null) {
                            entry.element.removeAttribute('display');
                        } else {
                            entry.element.setAttribute('display', entry.display);
                        }
                    } catch {
                        /* No-op. */
                    }
                });
                preparedLeafletMaps?.cleanup();
                // Build 1174 — resume only the SVGs we paused, then
                // clear the document-level export flag. Order
                // matters: resuming animations BEFORE removing the
                // attribute means any CSS rule that disables motion
                // via `[data-exporting] *` doesn't briefly re-apply
                // to a now-resuming SVG. Both steps are wrapped in
                // try/catch so a freak DOM detach can't strand the
                // page in exporting mode.
                pausedSvgs.forEach((svg) => {
                    try {
                        if (typeof svg.unpauseAnimations === 'function') {
                            svg.unpauseAnimations();
                        }
                    } catch {
                        /* No-op — page reload restores motion. */
                    }
                });
                if (root) {
                    try {
                        root.removeAttribute('data-exporting');
                    } catch {
                        /* No-op. */
                    }
                }
                setExporting(false);
            }
        },
        [targetRef, fileName]
    );

    return { exporting, error, exportAs };
};

const LEAFLET_EXPORT_MAP_ATTRIBUTE = 'data-scd-export-leaflet-map';

/**
 * Leaflet's map pane supplies one translation while each painted layer
 * supplies another. Capture the final browser-composited rectangles so
 * the html2canvas clone can use one unambiguous coordinate system.
 */
const LEAFLET_EXPORT_LAYER_SELECTOR = [
    '.leaflet-tile',
    '.leaflet-image-layer',
    '.leaflet-marker-icon',
    '.leaflet-marker-shadow',
    '.leaflet-tooltip',
    '.leaflet-popup',
    '.leaflet-overlay-pane > svg',
    '.leaflet-pane > canvas',
].join(', ');

interface LeafletLayerGeometry {
    index: number;
    left: number;
    top: number;
    width: number;
    height: number;
    isSvg: boolean;
}

interface LeafletMapGeometry {
    index: number;
    width: number;
    height: number;
    layers: LeafletLayerGeometry[];
}

interface PreparedLeafletMaps {
    maps: LeafletMapGeometry[];
    cleanup: () => void;
}

const prepareLeafletMapsForExport = (
    captureRoot: HTMLElement
): PreparedLeafletMaps => {
    const mapElements = Array.from(
        captureRoot.querySelectorAll<HTMLElement>('.leaflet-container')
    );
    const originalMapAttributes = mapElements.map((map) =>
        map.getAttribute(LEAFLET_EXPORT_MAP_ATTRIBUTE)
    );

    const maps = mapElements.map((map, mapIndex): LeafletMapGeometry => {
        map.setAttribute(LEAFLET_EXPORT_MAP_ATTRIBUTE, String(mapIndex));
        const mapRect = map.getBoundingClientRect();
        const layers = Array.from(
            map.querySelectorAll<HTMLElement | SVGElement>(
                LEAFLET_EXPORT_LAYER_SELECTOR
            )
        )
            .map((layer, index): LeafletLayerGeometry => {
                const rect = layer.getBoundingClientRect();
                return {
                    index,
                    left: rect.left - mapRect.left,
                    top: rect.top - mapRect.top,
                    width: rect.width,
                    height: rect.height,
                    isSvg: layer.tagName.toLowerCase() === 'svg',
                };
            })
            .filter((layer) => layer.width > 0 && layer.height > 0);

        return {
            index: mapIndex,
            width: mapRect.width,
            height: mapRect.height,
            layers,
        };
    });

    return {
        maps,
        cleanup: () => {
            mapElements.forEach((map, index) => {
                const original = originalMapAttributes[index];
                if (original === null) {
                    map.removeAttribute(LEAFLET_EXPORT_MAP_ATTRIBUTE);
                } else {
                    map.setAttribute(LEAFLET_EXPORT_MAP_ATTRIBUTE, original);
                }
            });
        },
    };
};

const flattenLeafletCloneGeometry = (
    clonedDocument: Document,
    maps: LeafletMapGeometry[]
): void => {
    maps.forEach((snapshot) => {
        const clonedMap = clonedDocument.querySelector<HTMLElement>(
            `[${LEAFLET_EXPORT_MAP_ATTRIBUTE}="${snapshot.index}"]`
        );
        if (!clonedMap) return;

        // Lock the viewport used by the live map. A ResizeObserver cannot
        // run inside html2canvas's sandbox clone, so percentage sizing is
        // otherwise vulnerable to a one-frame relayout.
        clonedMap.style.width = `${snapshot.width}px`;
        clonedMap.style.height = `${snapshot.height}px`;
        clonedMap.style.overflow = 'hidden';

        clonedMap
            .querySelectorAll<HTMLElement>('.leaflet-map-pane, .leaflet-pane')
            .forEach((pane) => {
                pane.style.transform = 'none';
                pane.style.left = '0px';
                pane.style.top = '0px';
            });

        const clonedLayers = Array.from(
            clonedMap.querySelectorAll<HTMLElement | SVGElement>(
                LEAFLET_EXPORT_LAYER_SELECTOR
            )
        );

        snapshot.layers.forEach((layerSnapshot) => {
            const clonedLayer = clonedLayers[layerSnapshot.index];
            if (!clonedLayer) return;

            const { style } = clonedLayer;
            style.position = 'absolute';
            style.left = `${layerSnapshot.left}px`;
            style.top = `${layerSnapshot.top}px`;
            style.right = 'auto';
            style.bottom = 'auto';
            style.width = `${layerSnapshot.width}px`;
            style.height = `${layerSnapshot.height}px`;
            style.margin = '0';
            style.transform = 'none';
            style.transformOrigin = '0 0';

            // html2canvas reads SVG presentation attributes in addition
            // to CSS dimensions. Keep both representations in agreement
            // while retaining Leaflet's viewBox for path coordinates.
            if (layerSnapshot.isSvg) {
                clonedLayer.setAttribute('width', String(layerSnapshot.width));
                clonedLayer.setAttribute(
                    'height',
                    String(layerSnapshot.height)
                );
            }
        });
    });
};

const EXPORT_EXCLUDE_SELECTOR = [
    '[data-export-exclude="true"]',
    '.scd-export-exclude',
    '.react-flow__background',
    '.react-flow__controls',
    '.react-flow__minimap',
    '.react-flow__panel',
].join(', ');

const shouldIgnoreExportElement = (element: Element): boolean => {
    return element.closest(EXPORT_EXCLUDE_SELECTOR) !== null;
};

const triggerDownload = (dataUrl: string, fileName: string): void => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
