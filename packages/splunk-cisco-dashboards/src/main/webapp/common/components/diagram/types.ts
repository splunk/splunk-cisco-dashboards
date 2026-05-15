/**
 * Shared types for the Network Diagram authoring page (Build 106).
 *
 * Kept in their own file so the palette, canvas, persistence
 * service, and properties panel can all import without picking up
 * cyclic dependencies. The `PaletteDragPayload` type in
 * particular is the contract between the palette tabs (drag
 * sources) and the canvas (drop target) — every shape, region,
 * and inventory row that becomes a node on the canvas comes
 * across this type.
 */

import type { DeviceShapeId } from '@/common/services/topologyDiscovery';

/** MIME type used to round-trip a palette drag through the
 *  HTML5 DnD `dataTransfer` channel. We pick a custom mime so
 *  arbitrary text drops (e.g. a user dragging in a URL from
 *  another tab) don't accidentally trigger node creation. */
export const PALETTE_DND_MIME = 'application/x-scd-palette-payload';

/** Tagged union of payloads the palette can hand off to the
 *  canvas. Each variant maps to a distinct node-creation
 *  pathway in the canvas drop handler:
 *    • `shape`  — a generic Cisco shape (router, switch, ...)
 *                  with an editable label, no asset binding.
 *    • `region` — a parent/group container (labelled site or zone),
 *                  used to organise child devices visually.
 *    • `asset`  — a real device pulled from `asset_inventory`,
 *                  with a stable `assetId` so live health/KPI
 *                  overlays attach automatically. */
export type PaletteDragPayload =
    | {
          variant: 'shape';
          shape: DeviceShapeId;
          /** Default label shown on the new node; the inspector
           *  lets the operator rename it. */
          defaultLabel: string;
      }
    | {
          variant: 'region';
          /** Default region label (operator can rename in the
           *  properties panel after drop). */
          defaultLabel: string;
          /** Default size in pixels — the customer can resize via
           *  React Flow's selection-resizer once we wire it. */
          defaultWidth: number;
          defaultHeight: number;
      }
    | {
          variant: 'asset';
          /** Lowercased `device_name` from `asset_inventory`. Used
           *  as the React Flow node id AND the persisted
           *  `assetId`, so re-loads can rebind to live data. */
          assetId: string;
          /** The shape category derived from `device_type` /
           *  `device_family`. */
          shape: DeviceShapeId;
          /** Display name shown on the node. */
          label: string;
          /** Compact alias for the secondary label line. */
          shortLabel: string;
          /** Optional site label for tooltip context. */
          siteLabel?: string;
      };

/** Size presets used by the canvas when spawning a new node
 *  from a palette drop. Centralised so the visual rhythm
 *  (icon card vs region container) stays consistent. */
export const NODE_SIZE_PRESETS = {
    device: { width: 100, height: 110 },
    region: { width: 360, height: 220 },
} as const;
