# Panjin V3 case study

## Failure observed

The first delivery looked mechanically valid, but numbered markers did not visually correspond to the road route. Some labels appeared to float by themselves, and the route seemed to pass near rather than through the intended stops.

## Root causes

1. POI centroids were used as visible marker coordinates while OSRM snapped routing waypoints to nearby roads. The largest POI-to-road displacement was 249 metres.
2. One Amap coordinate for 广厦艺术街 was GCJ-02 and had been mixed with WGS84 OpenStreetMap/OSRM geometry.
3. During the larger-marker redesign, `.pin { position: relative }` overrode MapLibre's `.maplibregl-marker { position: absolute }`. The 88px-tall markers entered document flow and accumulated vertical errors of 88px per stop, reaching 792px.

## Repair

- Preserve the original POI point separately.
- Convert the Amap coordinate to WGS84.
- Route and display the OSRM road-access point as `route_anchor_wgs84`.
- Make route waypoint, WebGL anchor circle, and custom marker connector endpoint consume the same coordinate.
- Restore absolute positioning for the marker outer element.
- Add per-cluster badge offsets, but keep the connector endpoint fixed.
- Replace per-road-node camera steering with five regional cameras and fixed bearing.
- Build the final schedule from 12 measured Azure TTS segments.

## Measured result

- 10 stops; 142.5km; 162 minutes of route metadata; 658 route geometry points.
- Marker-to-route distance: 0m for all 10 stops.
- Live DOM connector error against `map.project()`: maximum 0.0000244px.
- Badges: 56px normal, 64px active.
- 3351 sampled frames at 24fps; 139.625 seconds.
- Bearing range and maximum per-frame bearing delta: 0°.
- Centre jumps above 500m: 0.
- Route progress: monotonic.
- Maximum per-frame zoom delta: 0.028626.
- Maximum per-frame pitch delta: 0.165566°.
- Azure voice: `zh-CN-XiaoxiaoNeural`, `friendly`, style degree 1.06, rate +2%, pitch +0%.
- Final derivative loudness: -16.1 LUFS; true peak -2.6dBFS.
- Delivery derivative to master mean SSIM: 0.974463.
- Feishu round-trip SHA-256 matched the local delivery file.

## General lesson

A correct geographic API call is not enough. Route truth, coordinate-system truth, DOM anchor truth, final-pixel truth, and delivery truth require separate checks.
