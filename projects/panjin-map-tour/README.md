# 盘锦道路锚点地图导览

这是盘锦两日自驾地图视频的可复用源码归档。项目保留路线数据、MapLibre页面、Azure SSML旁白生成、确定性相机、逐帧渲染和QA脚本；生成音频、逐帧缓存和MP4不进入Git。

## 功能

- 10站、约142.5公里的OSRM驾车路线。
- POI原始坐标与道路入口锚点分离保存。
- 编号、WebGL锚点和路线共享同一WGS84道路坐标。
- 大号编号、引线、防重叠偏移和固定方向分区镜头。
- `zh-CN-XiaoxiaoNeural` 中文女声；SSML固定 `friendly`、`styledegree=1.06`、语速 `+2%`。
- 139.625秒、3351帧、24fps确定性时间线。

## 目录

- `public/index.html`：地图与时间线运行时。
- `public/vendor/`：冻结的MapLibre GL JS 5.24.0及许可证。
- `data/`：景点、路线、旁白与来源账本。
- `scripts/build-route.py`：OSRM路由及道路入口锚点生成。
- `scripts/build-azure-voice.py`：实时语音目录核验、逐段SSML合成与48kHz母版。
- `scripts/capture-tour.mjs`：CDP截图、camera state导出与逐帧渲染。
- `scripts/validate-*.{py,mjs}`：路线、旁白、运动和标点像素锚定验证。
- `skills/routed-map-tour-video/`：从调研到交付的复用流程。

## 源码验证

```sh
cd projects/panjin-map-tour
npm test
```

该命令不使用Azure、不访问OSRM，也不要求已有音频；它验证归档路线、SSML/字幕一致性、冻结camera state和源码完整性。

## 本地预览与浏览器QA

先启动静态服务：

```sh
npm run serve
```

打开 `http://127.0.0.1:8768/public/index.html`。如需自动截图和标点像素QA，另行启动任意Chromium兼容浏览器的远程调试端口9225，再运行：

```sh
npm run capture
npm run qa:markers
```

可通过 `CDP_HOST` 和 `TOUR_URL` 覆盖默认地址。

## 重建路线

```sh
npm run route
npm test
```

OSRM只负责路由，底层道路数据仍需归因OpenStreetMap。不得将景点面中心直接当作驾车入口；重建后必须检查 `route_anchor_wgs84`、`poi_to_route_anchor_m` 和每站到路线的距离。

## 生成旁白

将Azure配置放在环境变量、项目 `.env`，或通过 `AZURE_SPEECH_ENV_FILE` 指向项目外凭据文件：

```sh
npm run voice
python3 scripts/validate-narration.py
```

脚本会先查询实时Azure voice catalog，确认中文女声及 `friendly` 风格可用，再串行生成12段语音。仓库不会保存密钥。

## 渲染与编码

```sh
npm run render:frames
npm run encode
```

需要FFmpeg、Node.js 22+、静态服务和CDP浏览器。完整渲染会生成3351张1920×1080 JPEG，再输出母版和飞书压缩版。

## 验证基线

盘锦V3的已验证结果保存在 `baselines/` 和 `docs/FINAL-QA.md`：

- 10个编号到路线距离均为0米；
- DOM引线底点与 `map.project()` 最大误差小于0.001像素；
- bearing变化0°，中心硬跳0次，路线进度单调；
- 最终成片139.625秒、1920×1080、24fps；
- 飞书往返下载与上传文件SHA-256一致。

地图影像和瓦片均为在线服务。使用前重新核验服务条款、许可、地区覆盖和归因要求；不要批量缓存 `tile.openstreetmap.org`。

## 数据与运行时许可

- 本仓库中的OSM衍生点位和路线数据注明 `© OpenStreetMap contributors`，按 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) 使用；完整说明见 [LICENSE-DATA.md](LICENSE-DATA.md)。
- 页面运行时读取Esri World Imagery服务当前 `copyrightText`，并持续显示 `Powered by Esri`。
- MapLibre GL JS 5.24.0许可证随冻结bundle保存在 `public/vendor/LICENSE-maplibre-gl-js.txt`。
- 影像瓦片不进入仓库；在线服务可用不代表允许离线导出或批量缓存。
