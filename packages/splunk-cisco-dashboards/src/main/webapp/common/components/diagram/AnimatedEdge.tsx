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
 *   • Arrowheads are rendered directly in this component instead
 *     of using React Flow markers. That keeps the tip colour
 *     bound to the computed connector stroke, including custom
 *     line colours and live-status overrides.
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
    Position,
    getBezierPath,
    getStraightPath,
    useReactFlow,
    useStore,
    type EdgeProps,
    type XYPosition,
} from '@xyflow/react';
import type { EdgeDirection } from '@/common/components/topology/PropertiesPanel';
import type {
    DiagramEdgeAnchor,
    SavedDiagramEdge,
} from '@/common/services/diagramPersistenceService';
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

export type EdgeEndpoint = 'source' | 'target';
export type EdgeEndpointDragPhase = 'start' | 'preview' | 'commit' | 'cancel';
export type EdgeBendDragPhase = 'start' | 'preview' | 'commit' | 'cancel';

export interface EdgeEndpointDragArgs {
    edgeId: string;
    endpoint: EdgeEndpoint;
    phase: EdgeEndpointDragPhase;
    point?: XYPosition;
}

export interface EdgeBendDragArgs {
    edgeId: string;
    phase: EdgeBendDragPhase;
    point?: XYPosition;
}

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
    /** Build 115.11 — arrow tip glyph the edge inspector selected. */
    arrowStyle?: SavedDiagramEdge['arrowStyle'];
    notes?: string;
    layer?: string;
    sourceAnchor?: DiagramEdgeAnchor;
    targetAnchor?: DiagramEdgeAnchor;
    bendPoint?: XYPosition;
    onEndpointDrag?: (args: EdgeEndpointDragArgs) => void;
    onBendDrag?: (args: EdgeBendDragArgs) => void;
}

const isFiniteAnchor = (anchor: unknown): anchor is DiagramEdgeAnchor => {
    if (!anchor || typeof anchor !== 'object') return false;
    const a = anchor as Partial<DiagramEdgeAnchor>;
    return Number.isFinite(a.x) && Number.isFinite(a.y);
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const isFinitePoint = (point: unknown): point is XYPosition => {
    if (!point || typeof point !== 'object') return false;
    const p = point as Partial<XYPosition>;
    return Number.isFinite(p.x) && Number.isFinite(p.y);
};

type ArrowStyleKey = NonNullable<SavedDiagramEdge['arrowStyle']>;

const resolveArrowStyle = (
    style: SavedDiagramEdge['arrowStyle'] | undefined
): ArrowStyleKey => {
    if (
        style === 'closed' ||
        style === 'open' ||
        style === 'thin' ||
        style === 'dot' ||
        style === 'diamond'
    ) {
        return style;
    }
    return 'thin';
};

const angleBetween = (from: XYPosition, to: XYPosition): number =>
    (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

const anchorSide = (
    anchor: DiagramEdgeAnchor | undefined,
    fallback: Position
): Position => {
    if (!isFiniteAnchor(anchor)) return fallback;
    const distances = [
        { side: Position.Left, value: anchor.x },
        { side: Position.Right, value: 1 - anchor.x },
        { side: Position.Top, value: anchor.y },
        { side: Position.Bottom, value: 1 - anchor.y },
    ];
    return distances.reduce((best, candidate) =>
        candidate.value < best.value ? candidate : best
    ).side;
};

const resolveAnchorPoint = (
    node: unknown,
    anchor: DiagramEdgeAnchor | undefined
): XYPosition | null => {
    if (!isFiniteAnchor(anchor) || !node || typeof node !== 'object') {
        return null;
    }
    const n = node as {
        internals?: { positionAbsolute?: XYPosition };
        measured?: { width?: number; height?: number };
        width?: number;
        height?: number;
        initialWidth?: number;
        initialHeight?: number;
    };
    const absolute = n.internals?.positionAbsolute;
    const width = n.measured?.width ?? n.width ?? n.initialWidth;
    const height = n.measured?.height ?? n.height ?? n.initialHeight;
    if (
        !absolute ||
        !Number.isFinite(absolute.x) ||
        !Number.isFinite(absolute.y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
    ) {
        return null;
    }
    const resolvedWidth = width as number;
    const resolvedHeight = height as number;
    return {
        x: absolute.x + resolvedWidth * clamp01(anchor.x),
        y: absolute.y + resolvedHeight * clamp01(anchor.y),
    };
};

const isStencilShape = (shape: unknown): boolean =>
    shape === 'custom_stencil';

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
    label,
    selected,
}) => {
    const reactFlow = useReactFlow();
    const [hovered, setHovered] = React.useState(false);
    const d = (data ?? {}) as AnimatedEdgeData;
    const sourceAnchor = isFiniteAnchor(d.sourceAnchor)
        ? d.sourceAnchor
        : undefined;
    const targetAnchor = isFiniteAnchor(d.targetAnchor)
        ? d.targetAnchor
        : undefined;
    const bendPoint = isFinitePoint(d.bendPoint) ? d.bendPoint : undefined;
    const sourceAnchorPoint = useStore((s) =>
        resolveAnchorPoint(s.nodeLookup.get(source), sourceAnchor)
    );
    const targetAnchorPoint = useStore((s) =>
        resolveAnchorPoint(s.nodeLookup.get(target), targetAnchor)
    );
    const anchoredSourceX = sourceAnchorPoint?.x ?? sourceX;
    const anchoredSourceY = sourceAnchorPoint?.y ?? sourceY;
    const anchoredTargetX = targetAnchorPoint?.x ?? targetX;
    const anchoredTargetY = targetAnchorPoint?.y ?? targetY;
    const anchoredSourcePosition = anchorSide(sourceAnchor, sourcePosition);
    const anchoredTargetPosition = anchorSide(targetAnchor, targetPosition);
    const sourceShape = useStore(
        (s) =>
            (
                s.nodeLookup.get(source)?.data as
                    | { node?: { shape?: string } }
                    | undefined
            )?.node?.shape
    );
    const targetShape = useStore(
        (s) =>
            (
                s.nodeLookup.get(target)?.data as
                    | { node?: { shape?: string } }
                    | undefined
            )?.node?.shape
    );
    const shouldUseStraightPath =
        (sourceAnchor || targetAnchor) &&
        (isStencilShape(sourceShape) || isStencilShape(targetShape));
    const midpointX = (anchoredSourceX + anchoredTargetX) / 2;
    const midpointY = (anchoredSourceY + anchoredTargetY) / 2;
    const [edgePath, labelX, labelY] = bendPoint
        ? [
              `M ${anchoredSourceX},${anchoredSourceY} L ${bendPoint.x},${bendPoint.y} L ${anchoredTargetX},${anchoredTargetY}`,
              bendPoint.x,
              bendPoint.y,
          ]
        : shouldUseStraightPath
        ? getStraightPath({
              sourceX: anchoredSourceX,
              sourceY: anchoredSourceY,
              targetX: anchoredTargetX,
              targetY: anchoredTargetY,
          })
        : getBezierPath({
              sourceX: anchoredSourceX,
              sourceY: anchoredSourceY,
              sourcePosition: anchoredSourcePosition,
              targetX: anchoredTargetX,
              targetY: anchoredTargetY,
              targetPosition: anchoredTargetPosition,
          });

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
    const strokeColor =
        liveStrokeColor ?? ((style?.stroke as string | undefined) ?? '#64748b');
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
    const arrowStyle = resolveArrowStyle(d.arrowStyle);
    const endpointDragEnabled = typeof d.onEndpointDrag === 'function';
    const bendDragEnabled = typeof d.onBendDrag === 'function';
    const showEndpointGrabbers = endpointDragEnabled && (selected || hovered);
    const showBendGrabber = bendDragEnabled && (selected || hovered);

    const handleEndpointPointerDown = (
        endpoint: EdgeEndpoint,
        event: React.PointerEvent<Element>
    ): void => {
        if (!d.onEndpointDrag || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const toFlowPoint = (evt: PointerEvent): XYPosition =>
            reactFlow.screenToFlowPosition({
                x: evt.clientX,
                y: evt.clientY,
            });
        const onMove = (evt: PointerEvent): void => {
            d.onEndpointDrag?.({
                edgeId: id,
                endpoint,
                phase: 'preview',
                point: toFlowPoint(evt),
            });
        };
        const finish =
            (phase: EdgeEndpointDragPhase) =>
            (evt: PointerEvent): void => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onCancel);
                document.body.style.cursor = '';
                d.onEndpointDrag?.({
                    edgeId: id,
                    endpoint,
                    phase,
                    point: phase === 'cancel' ? undefined : toFlowPoint(evt),
                });
            };
        const onUp = finish('commit');
        const onCancel = finish('cancel');
        document.body.style.cursor = 'grabbing';
        d.onEndpointDrag({
            edgeId: id,
            endpoint,
            phase: 'start',
        });
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
    };

    const handleBendPointerDown = (
        event: React.PointerEvent<Element>
    ): void => {
        if (!d.onBendDrag || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const toFlowPoint = (evt: PointerEvent): XYPosition =>
            reactFlow.screenToFlowPosition({
                x: evt.clientX,
                y: evt.clientY,
            });
        const onMove = (evt: PointerEvent): void => {
            d.onBendDrag?.({
                edgeId: id,
                phase: 'preview',
                point: toFlowPoint(evt),
            });
        };
        const finish =
            (phase: EdgeBendDragPhase) =>
            (evt: PointerEvent): void => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onCancel);
                document.body.style.cursor = '';
                d.onBendDrag?.({
                    edgeId: id,
                    phase,
                    point: phase === 'cancel' ? undefined : toFlowPoint(evt),
                });
            };
        const onUp = finish('commit');
        const onCancel = finish('cancel');
        document.body.style.cursor = 'grabbing';
        d.onBendDrag({
            edgeId: id,
            phase: 'start',
            point: bendPoint ?? { x: midpointX, y: midpointY },
        });
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
    };

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

    const renderArrowhead = (
        tip: XYPosition,
        tail: XYPosition,
        key: string
    ): React.ReactNode => {
        const length = Math.hypot(tip.x - tail.x, tip.y - tail.y);
        if (length < 0.5) return null;
        const transform = `translate(${tip.x}, ${tip.y}) rotate(${angleBetween(
            tail,
            tip
        )})`;
        if (arrowStyle === 'dot') {
            return (
                <circle
                    key={key}
                    cx={tip.x}
                    cy={tip.y}
                    r={3.8}
                    fill={strokeColor}
                    pointerEvents="none"
                />
            );
        }
        if (arrowStyle === 'diamond') {
            return (
                <path
                    key={key}
                    d="M 0 0 L -5 -4.5 L -10 0 L -5 4.5 Z"
                    transform={transform}
                    fill={strokeColor}
                    stroke={strokeColor}
                    strokeLinejoin="round"
                    pointerEvents="none"
                />
            );
        }
        if (arrowStyle === 'closed') {
            return (
                <path
                    key={key}
                    d="M 0 0 L -10 -5 L -7 0 L -10 5 Z"
                    transform={transform}
                    fill={strokeColor}
                    stroke={strokeColor}
                    strokeLinejoin="round"
                    pointerEvents="none"
                />
            );
        }
        return (
            <path
                key={key}
                d="M -10 -5 L 0 0 L -10 5"
                transform={transform}
                fill="none"
                stroke={strokeColor}
                strokeWidth={arrowStyle === 'open' ? 2.2 : 1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
            />
        );
    };

    const sourceTangentPoint = bendPoint ?? {
        x: anchoredTargetX,
        y: anchoredTargetY,
    };
    const targetTangentPoint = bendPoint ?? {
        x: anchoredSourceX,
        y: anchoredSourceY,
    };

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
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            />
            <path
                id={pathId}
                d={edgePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={
                    showLiveDashes
                        ? liveStrokeDasharray
                        : ((style?.strokeDasharray as string | undefined) ?? undefined)
                }
                strokeLinecap={liveStatusEnabled ? 'butt' : 'round'}
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
            {(direction === 'backward' || direction === 'both') &&
                renderArrowhead(
                    { x: anchoredSourceX, y: anchoredSourceY },
                    sourceTangentPoint,
                    'source-arrow'
                )}
            {(direction === 'forward' || direction === 'both') &&
                renderArrowhead(
                    { x: anchoredTargetX, y: anchoredTargetY },
                    targetTangentPoint,
                    'target-arrow'
                )}
            {(showEndpointGrabbers || showBendGrabber || label) && (
                <EdgeLabelRenderer>
                    {showBendGrabber && (
                        <button
                            type="button"
                            aria-label="Move connector bend"
                            title="Drag to bend this connector"
                            className="nodrag nopan"
                            onMouseEnter={() => setHovered(true)}
                            onMouseLeave={() => setHovered(false)}
                            onPointerDown={handleBendPointerDown}
                            style={{
                                position: 'absolute',
                                transform: `translate(-50%, -50%) translate(${bendPoint?.x ?? midpointX}px, ${bendPoint?.y ?? midpointY}px)`,
                                width: 14,
                                height: 14,
                                borderRadius: 999,
                                border: '2px solid #ffffff',
                                background: '#38bdf8',
                                cursor: 'grab',
                                pointerEvents: 'all',
                                zIndex: 38,
                                boxShadow:
                                    '0 1px 4px rgba(14,165,233,0.45)',
                            }}
                        />
                    )}
                    {showEndpointGrabbers && (
                        <>
                            <button
                                type="button"
                                aria-label="Move connector source"
                                title="Drag to move connector endpoint"
                                className="nodrag nopan"
                                onMouseEnter={() => setHovered(true)}
                                onMouseLeave={() => setHovered(false)}
                                onPointerDown={(event) =>
                                    handleEndpointPointerDown('source', event)
                                }
                                style={{
                                    position: 'absolute',
                                    transform: `translate(-50%, -50%) translate(${anchoredSourceX}px, ${anchoredSourceY}px)`,
                                    width: 12,
                                    height: 12,
                                    borderRadius: 999,
                                    border: '2px solid #ffffff',
                                    background: '#0ea5e9',
                                    cursor: 'grab',
                                    pointerEvents: 'all',
                                    zIndex: 40,
                                    boxShadow:
                                        '0 1px 4px rgba(14,165,233,0.45)',
                                }}
                            />
                            <button
                                type="button"
                                aria-label="Move connector target"
                                title="Drag to move connector endpoint"
                                className="nodrag nopan"
                                onMouseEnter={() => setHovered(true)}
                                onMouseLeave={() => setHovered(false)}
                                onPointerDown={(event) =>
                                    handleEndpointPointerDown('target', event)
                                }
                                style={{
                                    position: 'absolute',
                                    transform: `translate(-50%, -50%) translate(${anchoredTargetX}px, ${anchoredTargetY}px)`,
                                    width: 12,
                                    height: 12,
                                    borderRadius: 999,
                                    border: '2px solid #ffffff',
                                    background: '#0ea5e9',
                                    cursor: 'grab',
                                    pointerEvents: 'all',
                                    zIndex: 40,
                                    boxShadow:
                                        '0 1px 4px rgba(14,165,233,0.45)',
                                }}
                            />
                        </>
                    )}
                    {label && (
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
                                zIndex: 30,
                            }}
                            className="nodrag nopan"
                        >
                            {label}
                        </div>
                    )}
                </EdgeLabelRenderer>
            )}
        </>
    );
};
