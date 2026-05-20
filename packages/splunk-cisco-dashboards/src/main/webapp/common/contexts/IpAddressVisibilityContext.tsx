/**
 * IP-address visibility context — Build 115.13.
 *
 * Page-level toggle that controls whether device cards render their
 * IP address row. The card always KNOWS its IP (when the operator
 * supplied one in the inspector or a bound asset_inventory row
 * carries one); this context lets the operator hide every IP at
 * once before sharing the diagram screenshot with an audience that
 * shouldn't see internal addressing.
 *
 * Why a context (mirroring `AnimationsEnabledContext`):
 *   • Cards are rendered deep inside React Flow's node-type
 *     registry; threading a prop through every shape would mean
 *     forking React Flow's `NodeProps` contract or stuffing the
 *     flag into each node's `data`, which then has to be
 *     re-serialised on save/load. A context skips both.
 *   • Operators expect the toggle to flip every card simultaneously
 *     — a context broadcast is exactly that, with no per-node
 *     re-render bookkeeping in the canvas.
 *
 * Default `true`: existing operators who never touch the toggle
 * see IPs by default. Hiding them is a deliberate, opt-in privacy
 * action — surfacing IPs more aggressively than today is the
 * value-add.
 */

import { createContext, useContext } from 'react';

const IpAddressVisibilityContext = createContext<boolean>(true);

export const IpAddressVisibilityProvider = IpAddressVisibilityContext.Provider;

/** Read the current "show IP addresses" flag from context. Falls
 *  back to `true` when no provider is mounted, so device cards
 *  rendered outside the diagram page (e.g. a future ops canvas or
 *  a unit test) still display IPs by default. */
export const useIpAddressVisibility = (): boolean =>
    useContext(IpAddressVisibilityContext);
