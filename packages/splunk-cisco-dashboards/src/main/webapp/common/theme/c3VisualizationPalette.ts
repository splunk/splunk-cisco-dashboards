/**
 * Cisco Cloud Control / Splunk 1CD visualization colors.
 *
 * These values are intentionally separate from product-brand accents. They
 * were sampled from the signed-in C3 Inventory, Topology, and Meraki views so
 * operational state reads consistently across our React tiles and Dashboard
 * Studio stories: blue for information, green for healthy, yellow/orange for
 * attention, and red for critical conditions. Lavender and purple are the
 * supporting comparison-series colors used by C3 data visualizations.
 */
export const C3_VISUALIZATION_COLORS = {
    info: '#649ef5',
    cyan: '#049fd9',
    cyanBright: '#00bceb',
    positive: '#4cbf7f',
    caution: '#f0c243',
    orange: '#f7782f',
    critical: '#fa5762',
    lavender: '#9ca6ff',
    purple: '#9b5ff5',
    neutral: '#a6adb6',
} as const;

export const C3_SERIES_PALETTE = [
    C3_VISUALIZATION_COLORS.info,
    C3_VISUALIZATION_COLORS.positive,
    C3_VISUALIZATION_COLORS.caution,
    C3_VISUALIZATION_COLORS.critical,
    C3_VISUALIZATION_COLORS.lavender,
    C3_VISUALIZATION_COLORS.purple,
    C3_VISUALIZATION_COLORS.cyan,
    C3_VISUALIZATION_COLORS.cyanBright,
    C3_VISUALIZATION_COLORS.orange,
] as const;
