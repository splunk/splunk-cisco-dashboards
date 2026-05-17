/**
 * Animations toggle context — Build 115.12.
 *
 * A single page-level kill switch for every animated SVG element
 * in the diagram canvas. Currently fans out to:
 *   • `AnimatedEdge` — flowing-dot `<animateMotion>` and the
 *     marching-ants `<animate stroke-dashoffset>` for live-status
 *     edges.
 *   • Any future "ambient" canvas effects (e.g. region pulsing on
 *     status change, the Build 115.10 LED ping wrapper).
 *
 * Why a context instead of a prop:
 *   • Edges are rendered by React Flow with a fixed `EdgeProps`
 *     contract — we can't add a new prop without forking the
 *     edgeType plumbing or stuffing the flag into edge `data`,
 *     which then has to be kept in sync on every save / hydrate.
 *   • A context keeps the wiring at the page level (single
 *     localStorage read on mount, single setter on toggle),
 *     decouples the toggle UI from the consumer, and gives us a
 *     trivial path to add per-page overrides later (the canvas
 *     could wrap a child subtree in its own provider if some
 *     widget needs to keep animating regardless of the global
 *     toggle).
 *
 * Why default `true`:
 *   • The animations have always been on. Defaulting to `true`
 *     means existing operators who never touch the toggle see no
 *     behaviour change — only operators who explicitly silence
 *     the canvas pay the difference.
 *   • Operators with `prefers-reduced-motion` set still get the
 *     animations unless they flip this toggle. That's a defensible
 *     default for a topology authoring tool (the dots COMMUNICATE
 *     direction; killing them removes signal); but a future build
 *     could honour `matchMedia('(prefers-reduced-motion)')` as a
 *     hint, defaulting the toggle to off when the OS is set that
 *     way.
 */

import { createContext, useContext } from 'react';

/** Default to `true` — the canvas animates by default; the toggle
 *  is opt-out, not opt-in. */
const AnimationsEnabledContext = createContext<boolean>(true);

export const AnimationsEnabledProvider = AnimationsEnabledContext.Provider;

/** Read the current animations-enabled flag from context. Falls
 *  back to `true` (the context default) when no provider is
 *  mounted — this keeps `<AnimatedEdge>` rendering correctly when
 *  it's reused outside the network diagram page (e.g. inside a
 *  unit test, or eventually inside the operations canvas). */
export const useAnimationsEnabled = (): boolean =>
    useContext(AnimationsEnabledContext);
