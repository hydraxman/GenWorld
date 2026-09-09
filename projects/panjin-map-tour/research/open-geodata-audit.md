## 核实结果

通过 Nominatim 核实盘锦市 OSM 行政关系为 [relation/2771970](https://www.openstreetmap.org/relation/2771970)，再以 Overpass 按元素 ID 查询 `out meta center tags`，并用 OSM 官方 API 回读元素名称与标签。以下坐标均为 **WGS84，经度在前、纬度在后**；节点为 OSM 原生坐标，面状要素为 Overpass `center`，不是景区入口。

| 顺序 | OSM 名称 | 经度 | 纬度 | 坐标依据 / 元素 |
|---:|---|---:|---:|---|
| 1 | 辽河碑林 | 122.0165433 | 41.1861591 | way 中心：[279938664](https://www.openstreetmap.org/way/279938664) |
| 2 | 盘锦市动物园 | 122.0173151 | 41.1840275 | way 中心：[279938665](https://www.openstreetmap.org/way/279938665) |
| 3 | 雙臺子舊址 | 122.0577408 | 41.1796855 | node 原生坐标：[2857660003](https://www.openstreetmap.org/node/2857660003) |
| 4 | 盤山縣公署舊址 | 122.0533782 | 41.1865481 | node 原生坐标：[2841490378](https://www.openstreetmap.org/node/2841490378) |
| 5 | 日本關東軍護路守備隊舊址（小紅樓） | 122.0564066 | 41.1884442 | node 原生坐标：[2841490371](https://www.openstreetmap.org/node/2841490371) |
| 6 | 兴隆台（明烽火台遗址） | 122.0584942 | 41.1298025 | way 中心：[466912108](https://www.openstreetmap.org/way/466912108) |
| 7 | 红海滩旅游风景区 | 121.9710709 | 40.9671785 | node 原生坐标：[6833728086](https://www.openstreetmap.org/node/6833728086) |
| 8 | 辽河醉美湿地 | 121.8565746 | 40.9762663 | way 中心：[993673948](https://www.openstreetmap.org/way/993673948) |
| 9 | 红海滩国家风景廊道 | 121.8872609 | 40.8482666 | way 中心：[993607123](https://www.openstreetmap.org/way/993607123) |
| 10 | 甲午战争末战纪念馆 | 122.1149992 | 40.8228412 | way 中心：[466912144](https://www.openstreetmap.org/way/466912144) |
| 11 | 田庄台古镇 | 122.1316053 | 40.8315494 | node 原生坐标：[4616138133](https://www.openstreetmap.org/node/4616138133) |
| 12 | 关帝庙 | 122.1328396 | 40.8338054 | way 中心：[466912145](https://www.openstreetmap.org/way/466912145) |

OSM 中前三处历史点使用繁体名称，表内保持数据库原值；视频字幕可显示简体别名，但应保留 OSM ID 以便追溯。

## 推荐路线顺序

建议分两段拍摄，避免把城市历史点与滨海景区硬塞入单日：

- **城区历史线**：辽河碑林 → 盘锦市动物园 → 双台子旧址 → 盘山县公署旧址 → 小红楼 → 兴隆台明烽火台遗址
- **湿地滨海线**：红海滩旅游风景区 → 辽河醉美湿地 → 红海滩国家风景廊道 → 甲午战争末战纪念馆 → 田庄台古镇 → 关帝庙

这是基于点位空间分布的推荐顺序，不是已返回的 OSRM 最优解。面状景区中心可能位于湿地、建筑内部或不可通车区域，正式生成路线前应补采停车场或入口节点，不能直接把所有 way 中心当导航终点。

## OSRM 公开服务评估

- 官方文档确认 Route API 支持按给定顺序生成驾车路线，坐标格式为 `{longitude},{latitude}`，可用 `geometries=geojson&overview=full` 输出 MapLibre 可直接加载的 GeoJSON。
- 对上述 12 点调用 `router.project-osrm.org/route/v1/driving/...` 时，本次公开演示实例请求超时，未取得 `code=Ok`、道路几何、距离或时长，因此**不能声称已成功生成盘锦全路线**。
- 结论：**OSRM 协议和软件能力适用，但 `router.project-osrm.org` 公开演示服务不可作为视频生产的稳定依赖**。重试时应先逐点调用 `nearest` 检查吸附距离，再分城区/滨海两段请求；生产流程宜自托管 OSRM 或使用有明确 SLA 的服务。
- 必须检查返回的 `waypoints[].distance`；若出现 `NoSegment`、异常远距离吸附或路线穿越湿地，应改用真实入口坐标。

官方 API 文档：<https://project-osrm.org/docs/v5.24.0/api>

## 地图归因要求

- 使用 OSM POI、道路或 OSRM 路线时，画面中应清晰显示：
  **© OpenStreetMap contributors**
  并注明数据按 **ODbL** 提供；不可点击的视频可在画面或片尾写完整网址：<https://www.openstreetmap.org/copyright>
- 卫星影像归因必须按实际影像提供商条款另行显示。MapLibre 只是渲染库，不是影像来源，不能用“MapLibre”代替卫星底图版权声明。
- MapLibre 可用 `AttributionControl` 展示各 source 的 attribution；成片裁切时不能把归因裁掉或用 UI 覆盖。
- 不建议用 `tile.openstreetmap.org` 批量预取或进行离线/自动化视频瓦片扫描：OSMF 明确禁止批量下载和离线预取，且服务无 SLA。应使用明确允许视频渲染的底图源或自托管瓦片。
- 可选技术说明：`Routing: OSRM`；但它不能替代 OSM 数据归因。

## 交付文件

候选点核验结果已收敛到本项目的 `data/itinerary.json` 与 `data/route.geojson`；每站保留OSM/官方来源和坐标依据。
