# Cisco Spaces Space Manager Plan

## Goal

Build a Dashboard Studio custom visualization that consumes real Cisco Spaces map data instead of drawing synthetic floor polygons. The current prototype is useful as a shell, but the next version should render Cisco Spaces floor maps, zones, access points, and firehose device/occupancy overlays from the real map payload.

## What the Cisco API Provides

- Cisco Spaces Location Cloud API v2 is a REST API for maps, devices, and history.
- Authentication is Bearer-token based.
- Floor map payloads include `locationHierarchy`, `maps`, `maps[].imagePath`, `maps[].imageWidth`, `maps[].imageHeight`, floor dimensions, `maps[].zones[]`, zone colors, zone polygon coordinates, access points, AP coordinates, and AP metadata.
- The API appears to provide the map data and floor image assets, not an embeddable copy of the Cisco Spaces 3D UI.

## Proposed Architecture

1. Add a Splunk-side data retrieval path for Cisco Spaces map APIs.
2. Store the Cisco Spaces API token in Splunk secure storage or a protected setup endpoint, never in Dashboard Studio JSON.
3. Fetch and cache map hierarchy, floor payloads, and floor image assets by tenant/site/floor.
4. Normalize API floor payloads into a compact dashboard datasource shape:
   - map image URL or cached local image path
   - image width/height
   - zones with coordinates, color, name, and location IDs
   - APs with x/y/z, name, model, channel, angle
   - floor/site hierarchy labels
5. Join live or demo firehose data from `index=netops sourcetype=cisco:spaces:firehose`:
   - `DEVICE_LOCATION_UPDATE` for device points using `xPos`, `yPos`, floor/location IDs
   - `SPACE_OCCUPANCY` for room, desk, and area occupancy
   - `DEVICE_COUNT`, `CAMERA_COUNT`, and `IOT_TELEMETRY` for summary metrics
6. Render in React:
   - actual floor image as the base layer
   - zone polygons as overlays
   - AP and device markers
   - heat/occupancy layer
   - zoom/pan controls
   - right-side selected object details
   - optional time playback/history strip
7. Consider Three.js or a CSS transform camera only after the 2D map/image overlay is correct. The first real milestone is accurate map consumption; 3D polish comes after data fidelity.

## Open Questions

- Which Cisco Spaces region should the app target by default: US, EU, or Singapore?
- Where should customers configure the Bearer token?
- Should we cache floor images under the Splunk app, a KV Store collection, or an indexed lookup-like artifact?
- Do we want one visualization that accepts a pre-normalized datasource only, or should it call a custom backend endpoint directly?
- Can demo data provide enough `mapId` and `floorId` coverage to create an offline sample without a live Cisco Spaces token?

## References

- https://developer.cisco.com/docs/cisco-spaces-location/
- https://developer.cisco.com/docs/cisco-spaces-location/v2/v2mapflooritem/
- https://developer.cisco.com/docs/cisco-spaces-location/authentication/
