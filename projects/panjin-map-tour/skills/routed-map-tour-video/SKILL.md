---
name: routed-map-tour-video
description: Build road-anchored narrated MapLibre tour videos.
version: 0.1.0
author: Bryan (hydraxman), Hermes Agent
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [MapLibre, OSRM, Maps, Video, Azure-TTS]
    related_skills: []
---

# Routed Map Tour Video Skill

Build a deterministic narrated map-tour video whose route, stop markers, camera, captions, attribution, and final delivery can be verified independently. The workflow separates a scenic POI from its drivable access point instead of hiding the difference with visual offsets.

## When to Use

- A city tour, road trip, campus shuttle, scenic drive, or regional itinerary needs an animated map video.
- The route must follow a real road network and numbered stops must visibly touch it.
- A MapLibre composition needs deterministic frame seeking, narration, captions, and final MP4 QA.
- A prior map video has floating markers, mixed coordinate systems, route/POI separation, camera shake, or unreadable labels.

Do not use this workflow to draw protected-area shortcuts, imply unavailable roads, or bulk-cache tile services whose policies forbid automated downloading.

## Prerequisites

- Python 3.9+ for routing and validation scripts.
- Node.js 22+ for native WebSocket CDP automation.
- FFmpeg and ffprobe for audio/video assembly and media QA.
- A Chromium-compatible browser with a remote-debugging port for browser capture.
- Network access to the selected map style, imagery provider, route service, and TTS provider.
- Provider permissions and attribution suitable for the intended distribution.

For Azure narration, provide `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` through environment variables, project `.env`, or `AZURE_SPEECH_ENV_FILE`. Never commit real credentials.

## How to Run

From `projects/panjin-map-tour`, use `terminal` with:

```sh
npm test
npm run serve
npm run capture
npm run qa:markers
```

Regenerate external artifacts only when needed:

```sh
npm run route
npm run voice
npm run render:frames
npm run encode
```

The checked-in route, schedule, SSML, and camera baseline allow source validation without paid TTS or live routing.

## Procedure

### 1. Freeze the content contract

Record the intended audience, route mode, stop order, duration range, frame rate, aspect ratio, voice language, and required attribution. Classify each stop as a point, building, park, town, visitor center, parking area, or scenic corridor.

Completion criterion: every stop has a stable name, day/order, source URL, declared coordinate system, and travel-mode justification.

### 2. Maintain three coordinate concepts

For every stop, keep:

- `poi_coordinate_wgs84`: the landmark, polygon centroid, or sourced POI point;
- `route_anchor_wgs84`: the road entrance, parking access, or reasonable drop-off point used by the router;
- router input/output metadata: input coordinate, snapped waypoint, and snap distance.

If a source provides GCJ-02 or BD-09, convert explicitly before mixing it with OpenStreetMap, OSRM, GeoJSON, or MapLibre data. Preserve the source coordinate and conversion note.

Completion criterion: longitude/latitude order is `[longitude, latitude]`, coordinate systems are explicit, and no unconverted Chinese encrypted coordinate enters WGS84 routing.

### 3. Build and inspect the route

Route the ordered access points with the chosen travel profile. Save the router geometry and waypoint response rather than keeping only a screenshot. Compute:

- POI-to-road-anchor distance;
- displayed marker-to-route distance;
- total distance and duration;
- geometry point count and stop order.

A router response of `Ok` is not sufficient. Large attractions can legitimately have distant centroids, but the displayed road-stop marker must use the access coordinate and the documentation must retain the centroid distance.

Completion criterion: every displayed route marker is within 2 metres of the route polyline, and each access point is plausible on satellite/vector road context.

### 4. Bind every visual layer to one route coordinate

For a road-tour stop, use `route_anchor_wgs84` for all three visual objects:

1. route geometry waypoint;
2. WebGL anchor circle;
3. custom marker connector endpoint.

The numbered badge may be offset for legibility, but its connector must terminate at the exact projected map point. Keep the POI coordinate in data and show a separate semantic connector only when the distinction teaches something.

For custom MapLibre markers, preserve absolute positioning. A custom `.pin { position: relative }` rule overrides `.maplibregl-marker` and puts markers into document flow. Use an absolutely positioned outer element and place relative children inside it.

Completion criterion: a live-browser check shows `distance(map.project(anchor), markerBottomCenter) <= 1px` for every stop.

### 5. Design labels for the final destination

At 1920×1080, start with a 56px badge and a 64px active badge. Use a high-contrast connector, an explicit 8–12px anchor dot, and fixed marker outer dimensions so active-state changes do not read as map jitter.

Apply bounded per-stop offsets to dense clusters. Inspect the final overview and all focused scenes; collision-free focused frames do not prove the overview is readable.

Completion criterion: every number is distinguishable at normal playback size, connectors can be traced to anchors, and no badge is hidden under title, route list, caption, or attribution panels.

### 6. Author a deterministic camera

Expose pure `cameraAt(t)`, `progressAt(t)`, and `renderAt(t)` functions. Keep bearing fixed unless rotation has a specific narrative purpose. Prefer a few regional camera anchors joined by smooth zero-velocity easing over tangent-following a dense road polyline.

Keep the map stable during narration within a region. For long transfers, zoom out slightly, move once, then hold. Route progress must be monotonic and should reach each route anchor during that stop's narration.

Completion criterion: frame-rate sampling reports zero unintended bearing jumps, zero centre jumps above the declared scale threshold, bounded zoom/pitch deltas, and monotonic route progress.

### 7. Generate narration from measured media

Write one semantic TTS segment per intro, stop, and outro. Query the provider's live voice catalog before synthesis; do not assume a remembered voice/style combination still exists.

Use SSML to declare voice, style, style degree, rate, pitch, and authored pauses. Generate segments serially, reject implausibly small payloads, decode each file, measure duration with ffprobe, then rebuild the timeline from measured media. Captions must read the exact scheduled narration text.

Completion criterion: source text, SSML text, schedule text, and captions match; the assembled audio duration equals the frame-aligned timeline.

### 8. Prewarm, capture, and render

Start the local server and CDP browser. Prewarm only providers whose policies allow normal interactive loading; never build a prohibited offline cache. Capture one midpoint per semantic segment before rendering the full frame sequence.

Render each frame through `renderAt(frame / fps)`. Save camera states alongside representative images so source motion and final pixels can be audited separately.

Completion criterion: browser exceptions and log errors are empty, all representative frames contain loaded tiles and attribution, and the frame count equals `round(duration * fps)`.

### 9. Encode and validate the exact deliverables

Encode a high-quality master and a bounded delivery derivative. Check both files independently:

- ffprobe stream contract;
- full decode;
- sustained black frames;
- integrated loudness and true peak;
- frame liveness;
- representative contact sheet;
- derivative-to-master SSIM as a regression signal.

After external delivery, read back the exact message/resource. If storage is byte-preserving, download it and require SHA-256 equality; otherwise validate decoded parity.

Completion criterion: the exact delivered file passes the same final-media gate as the local derivative.

## Pitfalls

- **Centroid presented as entrance.** A park or scenic corridor centre may be hundreds of metres from a drivable road.
- **GCJ-02 mixed with WGS84.** The route and imagery appear consistently shifted even though every API call succeeds.
- **CSS positioning overrides MapLibre.** Markers accumulate vertical offsets in DOM flow while `setLngLat` remains correct.
- **Router success treated as geographic truth.** `code=Ok` says a route exists, not that the selected waypoint is the intended entrance.
- **Dense-road tangent drives bearing.** Small road bends become visible camera oscillation.
- **Final overview skipped.** Focused stop scenes pass while clustered overview markers overlap.
- **TTS schedule guessed from character count.** Real segment durations drift, causing captions and camera beats to miss.
- **Attribution cropped by UI or encoding.** MapLibre is a renderer, not the imagery or road-data copyright owner.
- **Generated media committed.** Keep frames, audio masters, MP4s, receipts, credentials, and provider caches outside Git unless rights and repository policy explicitly permit them.

## Verification

Run `terminal(command="npm test", workdir="projects/panjin-map-tour")`. Then, with the server and CDP browser active, run `terminal(command="npm run capture && npm run qa:markers", workdir="projects/panjin-map-tour")`.

Required gates:

- 10/10 or N/N route markers within 2m of route geometry;
- marker connector endpoint within 1px of `map.project(route_anchor)`;
- active badge meets the declared pixel floor and remains visible;
- route progress is monotonic;
- no unexpected bearing or centre hard jumps;
- narration, SSML, schedule, and captions agree;
- encoded master, derivative, and round-trip copy decode cleanly;
- attribution and source ledger remain present.

See `references/panjin-v3-case-study.md` for the production failure modes and measured fix that produced this skill.
