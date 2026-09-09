# Map data and online service notices

## OpenStreetMap-derived data

The checked-in files `data/itinerary.json` and `data/route.geojson` contain coordinates and route geometry derived from OpenStreetMap data.

- Attribution: **© OpenStreetMap contributors**
- Database license: **Open Data Commons Open Database License 1.0 (ODbL)**
- Copyright and attribution page: https://www.openstreetmap.org/copyright
- ODbL legal text: https://opendatacommons.org/licenses/odbl/1-0/

The road geometry was calculated through the public OSRM routing service. OSRM is the routing engine; it does not replace the OpenStreetMap data attribution or license notice.

If these data files are modified and redistributed as a derivative database, review the ODbL share-alike requirements before publication.

## OpenFreeMap and OpenMapTiles

The interactive page loads vector map content from OpenFreeMap/OpenMapTiles at runtime. No vector tile cache is included in this repository. Preserve the providers' visible attribution and recheck their current service terms before deployment.

- OpenFreeMap: https://openfreemap.org/
- OpenMapTiles: https://openmaptiles.org/

## Esri World Imagery

No Esri imagery tiles are stored in this repository. The page accesses Esri World Imagery online and reads the service's current `copyrightText` metadata at runtime, with a frozen fallback matching the service metadata checked on 2026-09-09. The rendered map continuously displays **Powered by Esri** and the returned source credit.

- Service metadata: https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson
- World Imagery information and terms: https://goto.arcgisonline.com/maps/World_Imagery

Online accessibility does not grant offline tile export, bulk caching, or unrestricted redistribution. Recheck the applicable Esri terms for each publication context.

## MapLibre GL JS

The frozen MapLibre GL JS 5.24.0 browser bundle is redistributed under its upstream license. See `public/vendor/LICENSE-maplibre-gl-js.txt`.
