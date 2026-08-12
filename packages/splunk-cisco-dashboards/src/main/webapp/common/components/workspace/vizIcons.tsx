/**
 * vizIcons — visualisation-type → Splunk React icon mapping.
 *
 * Resolves a Splunk Dashboard Studio viz id (e.g. `splunk.area`) to
 * the matching glyph from `@splunk/react-icons/enterprise`, so the
 * picker, picker preview, and any future "what kind of chart is
 * this?" affordance can render a small visual hint next to each
 * search.
 *
 * Mapping rules:
 *   * Direct hits (area / line / column / bar / pie / bubble /
 *     scatter / table / events / map / single-value / gauges) use
 *     the obvious Splunk icon.
 *   * Choropleth → ChoroplethMap.
 *   * Single-value radial → GaugeRadial.
 *   * Sankey, parallel coordinates, punchcard, timeline, link graph
 *     don't have one-to-one icons in @splunk/react-icons today, so
 *     they fall back to the closest *visual* analogue (Tree / Line /
 *     ChartScatter / Activity / Link respectively) rather than the
 *     generic ChartBasic — keeps the UI hint informative even when
 *     the icon isn't a perfect match.
 *   * Anything else → ChartBasic ("some kind of chart").
 *
 * Case-insensitive and whitespace-tolerant on the input so a stray
 * `default_viz = SPLUNK.AREA` from a hand-edited conf still resolves
 * cleanly.
 */

import React from 'react';
import Activity from '@splunk/react-icons/enterprise/Activity';
import ChartArea from '@splunk/react-icons/enterprise/ChartArea';
import ChartBar from '@splunk/react-icons/enterprise/ChartBar';
import ChartBasic from '@splunk/react-icons/enterprise/ChartBasic';
import ChartBubble from '@splunk/react-icons/enterprise/ChartBubble';
import ChartColumn from '@splunk/react-icons/enterprise/ChartColumn';
import ChartLine from '@splunk/react-icons/enterprise/ChartLine';
import ChartPie from '@splunk/react-icons/enterprise/ChartPie';
import ChartScatter from '@splunk/react-icons/enterprise/ChartScatter';
import ChoroplethMap from '@splunk/react-icons/enterprise/ChoroplethMap';
import Events from '@splunk/react-icons/enterprise/Events';
import GaugeFiller from '@splunk/react-icons/enterprise/GaugeFiller';
import GaugeMarker from '@splunk/react-icons/enterprise/GaugeMarker';
import GaugeRadial from '@splunk/react-icons/enterprise/GaugeRadial';
import Link from '@splunk/react-icons/enterprise/Link';
import MapIcon from '@splunk/react-icons/enterprise/Map';
import SingleValue from '@splunk/react-icons/enterprise/SingleValue';
import Table from '@splunk/react-icons/enterprise/Table';
import Tree from '@splunk/react-icons/enterprise/Tree';

import { cn } from '@/common/lib/utils';

// Splunk React icons accept `size` and standard svg props; we don't
// need to pull the proper d.ts type here because every icon in this
// package shares the same signature.
//
// CRITICAL: the icons treat a *bare number* as ems, not pixels (the
// default of 0.75 = 0.75em ≈ 12px on a 16px base). Passing
// `size={14}` renders a 14em icon (≈ 224px), which is what bit me
// the first time around. Always pass a string with explicit units
// from `<VizIcon>` so the icon's intrinsic dimensions match the
// pixel size the caller asked for.
type SplunkIconComponent = React.ComponentType<{
    size?: string | number;
    width?: string | number;
    height?: string | number;
    screenReaderText?: string | null;
    hideDefaultTooltip?: boolean;
    inline?: boolean;
}>;

interface VizMapping {
    /** Human-readable label, used in tooltips. */
    label: string;
    /** Icon component from @splunk/react-icons. */
    Icon: SplunkIconComponent;
}

const FALLBACK: VizMapping = {
    label: 'Visualisation',
    Icon: ChartBasic as SplunkIconComponent,
};

/**
 * Strip the leading `splunk.` namespace and lower-case the rest so
 * `Splunk.Area` and `splunk.area` both hit the same key. Tolerant of
 * non-string input so we don't have to gate every call site.
 */
const normalizeVizKey = (raw: unknown): string => {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.startsWith('splunk.')) return trimmed.slice('splunk.'.length);
    return trimmed;
};

const VIZ_MAPPINGS: Readonly<Record<string, VizMapping>> = Object.freeze({
    area: { label: 'Area chart', Icon: ChartArea as SplunkIconComponent },
    bar: { label: 'Bar chart', Icon: ChartBar as SplunkIconComponent },
    bubble: { label: 'Bubble chart', Icon: ChartBubble as SplunkIconComponent },
    choroplethsvg: { label: 'Choropleth', Icon: ChoroplethMap as SplunkIconComponent },
    column: { label: 'Column chart', Icon: ChartColumn as SplunkIconComponent },
    events: { label: 'Events', Icon: Events as SplunkIconComponent },
    fillergauge: { label: 'Filler gauge', Icon: GaugeFiller as SplunkIconComponent },
    line: { label: 'Line chart', Icon: ChartLine as SplunkIconComponent },
    linkgraph: { label: 'Link graph', Icon: Link as SplunkIconComponent },
    map: { label: 'Map', Icon: MapIcon as SplunkIconComponent },
    markergauge: { label: 'Marker gauge', Icon: GaugeMarker as SplunkIconComponent },
    parallelcoordinates: {
        label: 'Parallel coordinates',
        Icon: ChartLine as SplunkIconComponent,
    },
    pie: { label: 'Pie chart', Icon: ChartPie as SplunkIconComponent },
    punchcard: { label: 'Punchcard', Icon: ChartScatter as SplunkIconComponent },
    sankey: { label: 'Sankey diagram', Icon: Tree as SplunkIconComponent },
    scatter: { label: 'Scatter plot', Icon: ChartScatter as SplunkIconComponent },
    singlevalue: { label: 'Single value', Icon: SingleValue as SplunkIconComponent },
    singlevalueradial: { label: 'Single value (radial)', Icon: GaugeRadial as SplunkIconComponent },
    table: { label: 'Table', Icon: Table as SplunkIconComponent },
    timeline: { label: 'Timeline', Icon: Activity as SplunkIconComponent },
});

export const resolveVizMapping = (splunkViz?: string | null): VizMapping => {
    const key = normalizeVizKey(splunkViz);
    if (!key) return FALLBACK;
    return VIZ_MAPPINGS[key] ?? FALLBACK;
};

interface VizIconProps {
    /** The `default_viz` field from `searchbase.conf` (e.g. `splunk.area`). */
    splunkViz?: string | null;
    /** Pixel size of the icon. Defaults to 14 to fit picker rows. */
    size?: number;
    /** Optional Tailwind class names applied to the wrapping span (colour, opacity, etc.). */
    className?: string;
    /**
     * When true, the wrapping span carries `title` and aria-label so
     * a hover/focus surfaces the human-readable viz name. The picker
     * uses this so a user can hover the icon to confirm what the
     * search is going to render as. Defaults to true; pass false
     * when the icon sits next to a label that already names the
     * viz.
     */
    showTooltip?: boolean;
}

/**
 * Small wrapper that resolves the right Splunk icon for a given
 * `splunkViz` string and renders it at the requested *pixel* size.
 * Handles null / missing / unknown viz strings gracefully via the
 * fallback `ChartBasic` icon — so the picker can render *something*
 * for every row even when an entry's `default_viz` is unset.
 *
 * The `size` prop is always pixels at this layer, even though Splunk
 * icons natively expect ems. We convert internally so callers don't
 * need to think about it.
 */
export const VizIcon: React.FC<VizIconProps> = ({
    splunkViz,
    size = 14,
    className,
    showTooltip = true,
}) => {
    const { Icon, label } = resolveVizMapping(splunkViz);
    // Pixel string with explicit units. Splunk icons read a bare
    // number as ems (default 0.75em ≈ 12px), so passing `size={14}`
    // would render a 14em (≈ 224px) icon. Always pass `"14px"`.
    const pxSize = `${size}px`;
    return (
        <span
            className={cn(
                // inline-flex with explicit size keeps the icon
                // baseline-consistent with adjacent text — avoids
                // the 1–2px vertical drift that's common when
                // sticking SVG icons into flex rows.
                'inline-flex items-center justify-center flex-shrink-0',
                className
            )}
            style={{ width: pxSize, height: pxSize }}
            title={showTooltip ? label : undefined}
            aria-label={showTooltip ? label : undefined}
            role={showTooltip ? 'img' : undefined}
        >
            <Icon
                size={pxSize}
                width={pxSize}
                height={pxSize}
                inline={false}
                screenReaderText={showTooltip ? label : ''}
                hideDefaultTooltip
            />
        </span>
    );
};
