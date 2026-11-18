/** Responsive layout used only by Minimal Enterprise and Prism Pulse. */
export function refinedSignalRailLayout(count: number, width: number, minimum: number, rows: number) {
    const capacity = Math.max(1, Math.floor((width + 8) / (minimum + 8)));
    const rowCount = Math.min(Math.max(1, count), 2, Math.max(rows, Math.ceil(count / capacity)));
    const columns = Math.max(1, Math.ceil(count / rowCount));
    return { columns, rowCount, overflow: width > 0 && columns * minimum + (columns - 1) * 8 > width };
}

export const isRetiredSignalRailStyle = (value: string | null): boolean =>
    value === 'signal-orbit' || value === 'event-horizon';

/** Search shortcuts may use an app-relative path or an explicit HTTP(S) URL. */
export const isSignalRailSearchHref = (href: string | undefined): href is string =>
    Boolean(href && (/^\/(?!\/)/.test(href) || /^https?:\/\//i.test(href)) && !/[\u0000-\u0020\\]/.test(href));
