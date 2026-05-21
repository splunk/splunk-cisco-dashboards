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
import type { CustomStencilAsset } from '@/common/services/diagramPersistenceService';

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
      }
    | {
          /** Build 115.21 — user-imported SVG/PNG stencil. Treated
           *  as a device-like node for drag, resize, connect, save,
           *  and export, but its artwork comes from the imported
           *  asset rather than the built-in icon registry. */
          variant: 'customStencil';
          asset: CustomStencilAsset;
      }
    | {
          /** Build 115.1 — free-placement annotation. Spawns a
           *  TextBoxNode at the drop point with default styling.
           *  The operator can re-style via the inspector after
           *  drop (font size, colour, optional card background /
           *  border, alignment). Distinct from the singleton
           *  `diagramTitle` node — multiple textboxes coexist
           *  per diagram (used for protocol-gateway labels,
           *  callouts, port-number boxes, etc.). */
          variant: 'textbox';
          /** Default text shown when the textbox is first dropped.
           *  Empty string is OK — the node renders a placeholder
           *  hint until the operator types something. */
          defaultText: string;
      };

/** Size presets used by the canvas when spawning a new node
 *  from a palette drop. Centralised so the visual rhythm
 *  (icon card vs region container) stays consistent. */
export const NODE_SIZE_PRESETS = {
    device: { width: 100, height: 110 },
    wideDevice: { width: 420, height: 42 },
    region: { width: 360, height: 220 },
} as const;

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

export const nodeSizeForCustomStencil = (
    asset: Pick<CustomStencilAsset, 'width' | 'height'> | undefined
): { width: number; height: number } => {
    const width = asset?.width;
    const height = asset?.height;
    if (!width || !height || width <= 0 || height <= 0) {
        return NODE_SIZE_PRESETS.wideDevice;
    }
    const ratio = width / height;
    if (ratio >= 2.5) {
        const targetWidth = 420;
        return {
            width: targetWidth,
            height: Math.round(clamp(targetWidth / ratio, 28, 140)),
        };
    }
    if (ratio <= 0.75) {
        const targetHeight = 140;
        return {
            width: Math.round(clamp(targetHeight * ratio, 54, 160)),
            height: targetHeight,
        };
    }
    const targetWidth = 120;
    return {
        width: targetWidth,
        height: Math.round(clamp(targetWidth / ratio, 80, 140)),
    };
};

const WIDE_DEVICE_SHAPES = new Set<DeviceShapeId>([
    'catalyst_3850_24_front',
    'catalyst_3850_24_rear',
]);

export const nodeSizeForShape = (
    shape: DeviceShapeId | undefined
): { width: number; height: number } =>
    shape === 'custom_stencil'
        ? NODE_SIZE_PRESETS.wideDevice
        : shape && WIDE_DEVICE_SHAPES.has(shape)
          ? NODE_SIZE_PRESETS.wideDevice
          : NODE_SIZE_PRESETS.device;
