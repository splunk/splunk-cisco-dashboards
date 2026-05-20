/**
 * AnimatedEdge — custom React Flow edge for the Network Diagram
 * page (Build 114).
 *
 * Replaces the React Flow built-in animated dash with a flowing
 * coloured dot riding the edge's bezier path — same SVG
 * `<animateMotion>` + `<mpath>` recipe used by the Florida overview
 * dashboard's customer-topology map (`CustomerTopologyMap.tsx`),
 * adapted for an in-canvas edge.
 *
 * Why a custom edge type instead of `animated: true`:
 *   • RF's built-in animation is a stroke-dashoffset cycle. It
 *     reads as "data is moving" but doesn't communicate
 *     direction, and there's no way to colour-shift it without
 *     restyling the entire stroke.
 *   • A coloured dot riding the path is unambiguous: the dot's
 *     direction shows traffic direction, the dot's colour is a
 *     free axis we can map to "kind" (physical / synthetic /
 *     logical) or expose to the operator as a per-edge inspector
 *     control.
 *
 * Direction semantics:
 *   • `direction === 'none'`     → no dot rendered. Edge is
 *                                   passive (still has the right
 *                                   stroke style for its kind).
 *   • `direction === 'forward'`  → dot moves source → target
 *                                   (target end has the
 *                                   arrowhead).
 *   • `direction === 'backward'` → dot moves target → source.
 *   • `direction === 'both'`     → two dots, one each direction,
 *                                   offset in time so they don't
 *                                   visually collide at the
 *                                   midpoint.
 *
 * `data.animationColor` overrides the default colour. Falls back
 * to a sensible per-kind default (sky for synthetic, slate for
 * physical, slate-light for logical).
 *
 * Implementation details:
 *   • We render our own `<path>` instead of `<BaseEdge>` because
 *     we need a stable id (`edge-path-${id}`) for the
 *     `<animateMotion>`'s `<mpath href>` reference. RF's
 *     `BaseEdge` doesn't expose its inner path id, so wrapping it
 *     would force us to re-derive geometry ourselves anyway.
 *   • `markerStart` / `markerEnd` come in as already-resolved
 *     marker URL strings (e.g. `url(#1__type=arrowclosed&...)`),
 *     so we attach them directly as SVG attributes on the path.
 *   • The dot's `<animateMotion keyPoints="0;1" keyTimes="0;1">`
 *     anchors the start/end of the path; flipping `keyPoints` to
 *     `1;0` reverses direction without re-deriving the path.
 *   • A lightweight drop-shadow (`filter: drop-shadow(...)`)
 *     gives the dot a soft glow that reads at default zoom
 *     without needing extra `<feGaussianBlur>` filters.
 */

import React from 'react';
import {
    EdgeLabelRenderer,
    getBezierPath,
    useStore,
    type EdgeProps,
} from '@xyflow/react';
import type { EdgeDirection } from '@/common/components/topology/PropertiesPanel';
import type { SavedDiagramEdge } from '@/common/services/diagramPersistenceService';
import type { HealthStatus } from '@/common/services/topologyDiscovery';
import { useAnimationsEnabled } from '@/common/contexts/AnimationsEnabledContext';

/** Default animation colour by kind. Used when the edge has no
 *  explicit `animationColor` — keeps existing diagrams looking
 *  the way they did, while letting operators override. */
const DEFAULT_ANIMATION_COLOR_BY_KIND: Record<SavedDiagramEdge['kind'], string> = {
    physical: '#0ea5e9',
    synthetic_a2a: '#0ea5e9',
    logical: '#94a3b8',
};

/** Animation period. 2s feels like a steady "data heartbeat" —
 *  fast enough to read as motion at default zoom, slow enough to
 *  not feel like packet-flood when 20+ edges animate together. */
const DEFAULT_DURATION_MS = 2000;

/** Dot radius in SVG units (pre-zoom). 4px gives the dot enough
 *  presence to read across a long edge without overwhelming the
 *  shorter ones. */
const DOT_RADIUS = 4;

interface AnimatedEdgeData {
    kind?: SavedDiagramEdge['kind'];
    direction?: EdgeDirection;
    animationColor?: string;
    /** Build 115.11 — when true, the stroke colour is driven by
     *  the live `| metadata` reporting status of the bound
     *  endpoints (green / red), and the line renders as
     *  marching-ants dashes mirroring the Florida overview
     *  dashboard's site connector animation. */
    liveStatus?: boolean;
    /** Build 115.11 — arrow tip glyph the edge inspector
     *  selected. We don't actually render the marker here (React
     *  Flow's marker resolver does that via `markerStart` /
     *  `markerEnd`), but we keep the field in the interface for
     *  parity with the SavedDiagramEdge schema. */
    arrowStyle?: SavedDiagramEdge['arrowStyle'];
    notes?: string;
    layer?: string;
}

/** Build 115.11 — palette for the live-status mode. Mirrors the
 *  Florida overview dashboard's site connector colours: emerald
 *  when both ends are reporting, rose when either end is silent
 *  in `| metadata`. Amber bridges the "we don't know yet" middle
 *  state (one end has no status info). */
const LIVE_STATUS_PALETTE = {
    healthy: '#10b981', // emerald-500
    warning: '#f59e0b', // amber-500
    critical: '#f43f5e', // rose-500
    unknown: '#94a3b8', // slate-400
} as const;

/** Reduce two endpoint statuses to a single edge status:
 *    • both healthy           → 'healthy'
 *    • either critical        → 'critical'
 *    • either warning         → 'warning' (unless overridden by critical)
 *    • either unknown         → 'warning' (we have one signal but not both)
 *    • both unknown           → 'unknown' */
const reduceEndpointStatus = (
    a: HealthStatus | undefined,
    b: HealthStatus | undefined
): HealthStatus => {
    if (a === 'critical' || b === 'critical') return 'critical';
    if (a === 'warning' || b === 'warning') return 'warning';
    if (a === 'healthy' && b === 'healthy') return 'healthy';
    if (a === 'healthy' || b === 'healthy') return 'warning';
    return 'unknown';
};

interface FlowingDotProps {
    pathId: string;
    color: string;
    /** Reverse motion (target→source). */
    reverse?: boolean;
    /** Phase offset so paired dots in `both` mode don't collide
     *  visually at the midpoint. Pass `-${durationMs / 2}ms` on
     *  the second dot to keep them on opposite halves of the
     *  cycle. */
    beginOffsetMs?: number;
    durationMs?: number;
}

const FlowingDot: React.FC<FlowingDotProps> = ({
    pathId,
    color,
    reverse,
    beginOffsetMs = 0,
    durationMs = DEFAULT_DURATION_MS,
}) => (
    <circle
        r={DOT_RADIUS}
        fill={color}
        // Drop-shadow uses the dot's own colour so the glow
        // matches whatever the operator picked. `1.5px` blur is
        // tight enough that the dot stays a discrete object at
        // zoom; bumps to `4px` would spill onto the path and read
        // as a halo.
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        // The circle's `cx`/`cy` are overridden every frame by
        // animateMotion — these are just the static fallback for
        // browsers that don't process SMIL (vanishingly rare in
        // 2026, but harmless to set).
        cx={0}
        cy={0}
    >
        <animateMotion
            dur={`${durationMs}ms`}
            repeatCount="indefinite"
            // `keyPoints` + `keyTimes` lets us reverse direction
            // without redrawing the path. `0;1` runs source →
            // target, `1;0` runs target → source.
            keyPoints={reverse ? '1;0' : '0;1'}
            keyTimes="0;1"
            // `begin` accepts a negative value to phase-shift —
            // an offset of `-1000ms` on a 2s cycle starts the dot
            // halfway along the path, useful for paired
            // bidirectional dots.
            begin={beginOffsetMs ? `${beginOffsetMs}ms` : '0s'}
            rotate="auto"
        >
            <mpath href={`#${pathId}`} />
        </animateMotion>
    </circle>
);

export const ANIMATED_EDGE_TYPE = 'animated';

export const AnimatedEdge: React.FC<EdgeProps> = ({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    style,
    markerStart,
    markerEnd,
    label,
    selected,
}) => {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const d = (data ?? {}) as AnimatedEdgeData;
    const direction: EdgeDirection = d.direction ?? 'none';
    const kind = d.kind ?? 'physical';
    // Build 115.12 — page-level animations kill switch. When OFF
    // we still render arrows + line colour (those are signal,
    // not motion), but we suppress flowing dots and marching-ants
    // SMIL animations. This is a presentation / quiet-canvas
    // affordance for operators with busy diagrams; per-edge
    // direction='none' / liveStatus=false still work for picking
    // off individual edges.
    const animationsAllowed = useAnimationsEnabled();
    const animationEnabled = animationsAllowed && direction !== 'none';
    const animationColor =
        d.animationColor ?? DEFAULT_ANIMATION_COLOR_BY_KIND[kind] ?? '#0ea5e9';

    // Build 115.11 — pull endpoint statuses out of the React Flow
    // store. The store's `nodeLookup` reflects the latest patched
    // device data (the "patch effect" on the canvas keeps it in
    // sync with `assetIndex` / `hostVisibility` without a full
    // re-render), so this selector reactively recolours the edge
    // whenever a bound host flips between reporting and silent.
    // We keep two separate selectors so React Flow's shallow
    // comparison fires only when THIS edge's endpoints change,
    // not on every status update for unrelated nodes.
    const sourceStatus = useStore((s) => {
        const node = s.nodeLookup.get(source);
        if (!node) return undefined;
        const innerData = node.data as { node?: { status?: HealthStatus } };
        return innerData?.node?.status;
    });
    const targetStatus = useStore((s) => {
        const node = s.nodeLookup.get(target);
        if (!node) return undefined;
        const innerData = node.data as { node?: { status?: HealthStatus } };
        return innerData?.node?.status;
    });
    const liveStatusEnabled = d.liveStatus === true;
    const reducedStatus = liveStatusEnabled
        ? reduceEndpointStatus(sourceStatus, targetStatus)
        : undefined;
    const liveStrokeColor = reducedStatus
        ? LIVE_STATUS_PALETTE[reducedStatus]
        : undefined;
    // When live mode is active we override the stroke colour
    // and force a marching-ants dash; otherwise keep what the
    // canvas computed (kind palette + optional lineColor).
    //
    // Build 115.12 — split the "show dashes" flag into two:
    //   • `showLiveDashes`     — render the dashed stroke pattern
    //                            (always when live mode is on,
    //                            regardless of the global toggle —
    //                            the colour change is signal).
    //   • `animateLiveDashes`  — also run the <animate> motion
    //                            (only when the global toggle is
    //                            ON; otherwise the dashes sit
    //                            still, still red/green, but no
    //                            "marching" effect).
    const liveStrokeDasharray = '6 4';
    const showLiveDashes = liveStatusEnabled && reducedStatus !== 'unknown';
    const animateLiveDashes = showLiveDashes && animationsAllowed;

    // Stable id so <mpath href> can reference the rendered path.
    // RF re-renders this whole component on viewport change so the
    // id stays addressable as long as the edge exists.
    const pathId = `edge-path-${id}`;

    // When the edge is selected we bump the stroke a hair so the
    // operator can confirm they grabbed the right edge — but we
    // don't change colour, so the kind-based palette stays
    // recognisable.
    const baseStrokeWidth =
        typeof style?.strokeWidth === 'number'
            ? (style.strokeWidth as number) + (selected ? 0.75 : 0)
            : selected
              ? 2.25
              : 1.5;
    // Live-status edges read better with a slightly bolder stroke
    // because the dashes break up the line. Bump from 1.5 → 2 so
    // the marching-ants pattern stays legible at default zoom.
    const strokeWidth = liveStatusEnabled
        ? baseStrokeWidth + 0.5
        : baseStrokeWidth;

    return (
        <>
            {/* Build 115.10 — invisible wide "hit area" path. The
             *  visible stroke is 1.5–2.25px which is murder to
             *  click; a 20px transparent overlay gives the operator
             *  a generous corridor (≈10px on either side of the
             *  line) without changing the look. `cursor: pointer`
             *  signals that the corridor is interactive — operators
             *  reported they couldn't tell the line was clickable
             *  until they got pixel-perfect, so the cursor change
             *  makes the affordance discoverable.
             *
             *  We don't put `id` on this path because <mpath> needs
             *  the geometry on the visible path — but the geometry
             *  is identical, so clicks land in the same band. */}
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                strokeLinecap="round"
                pointerEvents="stroke"
                style={{ cursor: 'pointer' }}
                className="react-flow__edge-interaction"
            />
            <path
                id={pathId}
                d={edgePath}
                fill="none"
                stroke={
                    liveStrokeColor ??
                    ((style?.stroke as string | undefined) ?? '#64748b')
                }
                strokeWidth={strokeWidth}
                strokeDasharray={
                    showLiveDashes
                        ? liveStrokeDasharray
                        : ((style?.strokeDasharray as string | undefined) ?? undefined)
                }
                strokeLinecap={liveStatusEnabled ? 'butt' : 'round'}
                markerStart={markerStart}
                markerEnd={markerEnd}
                // The visible stroke stays out of the click path —
                // the wide transparent path above handles selection
                // — so this stays purely cosmetic.
                pointerEvents="none"
                style={{ cursor: 'pointer' }}
            >
                {/* Build 115.11 — marching-ants animation when live
                 *  status is engaged. We animate the dashoffset so
                 *  the pattern slides along the path; direction
                 *  follows the edge's `direction` (forward → flow
                 *  toward target, backward → flow toward source).
                 *  When direction is 'none' or 'both' we default to
                 *  forward so the line still feels alive. The
                 *  cycle length matches the dot animation so the
                 *  two visuals look intentional together.
                 *
                 *  Build 115.12 — gated on `animateLiveDashes` so
                 *  the page-level animations toggle can freeze the
                 *  pattern in place without removing the colour
                 *  signal. */}
                {animateLiveDashes && (
                    <animate
                        attributeName="stroke-dashoffset"
                        from={direction === 'backward' ? '0' : '20'}
                        to={direction === 'backward' ? '20' : '0'}
                        dur={`${DEFAULT_DURATION_MS / 2}ms`}
                        repeatCount="indefinite"
                    />
                )}
            </path>
            {animationEnabled && (
                <>
                    {(direction === 'forward' || direction === 'both') && (
                        <FlowingDot
                            pathId={pathId}
                            color={animationColor}
                        />
                    )}
                    {(direction === 'backward' || direction === 'both') && (
                        <FlowingDot
                            pathId={pathId}
                            color={animationColor}
                            reverse
                            // Half-cycle offset so the two dots in
                            // `both` mode stay on opposite halves of
                            // the path instead of stacking at the
                            // midpoint.
                            beginOffsetMs={
                                direction === 'both' ? -DEFAULT_DURATION_MS / 2 : 0
                            }
                        />
                    )}
                </>
            )}
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            background: 'rgba(255, 255, 255, 0.92)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 500,
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                            pointerEvents: 'all',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                        className="nodrag nopan"
                    >
                        {label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
};
