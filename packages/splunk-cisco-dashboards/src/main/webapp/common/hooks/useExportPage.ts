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
 * Build 1185 — export chrome guard. Some pages have editor UI inside
 * the capture target (React Flow minimap, zoom controls, help bubble).
 * Components can mark those affordances with `data-export-exclude`, and
 * this hook also skips known React Flow panel/background classes so PNG
 * / PDF output stays diagram-only even if the live editor chrome is
 * visible on screen.
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
                setExporting(false);
            }
        },
        [targetRef, fileName]
    );

    return { exporting, error, exportAs };
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
