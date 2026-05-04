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
                const canvas = await html2canvas(node, {
                    backgroundColor: '#f8fafc',
                    scale: window.devicePixelRatio > 1 ? 2 : 1.5,
                    useCORS: true,
                    logging: false,
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

const triggerDownload = (dataUrl: string, fileName: string): void => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
