# 清华园 · 三维重建工作台

基于 OpenFreeMap 冻结轮廓的北京清华主校区 Three.js 工作台，支持逐栋照片参照建模、独立地标与 GLB 导出。地图基模、局部重建和全轮廓估算明确区分，**不是实测模型，也不代表全校园已完整复刻**。身份依据、朝向推定与建模约束见 [MODELING.md](MODELING.md)。

快捷视角覆盖历史馆舍、主楼与经管组团，也包括艺术博物馆、综合体育馆和蒙民伟音乐厅等现代建筑；每处都保留独立地图身份与建模限制。

## 运行

从完整仓库使用本项目：校园会复用兄弟项目的庭院／舜德源码与定位数据，但默认运行不需要任何项目的参考照片。

```sh
cd projects/tsinghua-campus
npm ci
npm test
npm run build
npm run dev
```

访问 <http://127.0.0.1:8786/>；`?view=old-library` 等参数可直接打开已注册视角。Windows 可运行 `start-preview.cmd` 并保持窗口打开，关闭窗口即停止服务。

默认构建生成 `output/tsinghua-campus-offline.html` 单文件工作台和 `output/reference-photos.html` 来源元数据页。模型与地图内嵌，无在线地图或 CDN 依赖；来源链接仅在点击时访问。来源页不读取或复制照片，明确标注图像字节未校验。

## 使用与验证

- 拖动旋转、右键平移、滚轮缩放；平面模式北向上。搜索名称／编号或点选对象，可查看来源、估高依据与局部原点。
- “建筑目录”和“图层”可收起；手机默认让出画面，通过横向滑动快捷栏切换地标。视角根据未被工具栏遮挡的区域取景，近景阴影随关注范围调整。
- 快捷视角、地图图层和“只看已重建建筑与地标”筛选可组合使用。紫荆／教学片区是工作区段，不是行政分区。
- “基模窗格（示意）”可关闭；未核实的窗位与楼层不计作照片重建。“三维细节阴影”增强近景接触层次，手机默认关闭；程序天空与环境反射为展示光照，并非实地时刻。
- 校园 GLB 导出当前图层和筛选后可见对象；单栋／地标导出采用自身局部原点，米制、Y 向上，保留身份和来源。
- `npm test` 覆盖几何、身份、来源元数据、冻结输入哈希和离线重放；照片字节检查默认明确跳过，不计作照片验证通过。
- `npm run qa` 是可选浏览器／GLB 验收，检查实际渲染的窗墙明暗差与外观开关，生成截图汇总、覆盖报告和待完善清单；需要本地 Edge，或通过 `CHROME_PATH` 指定浏览器。明暗指标、几何测试和导出成功均不能代替照片对照。

仅在合法持有所需本地参考文件时，显式运行：

```sh
npm run test:references
npm run build:references
```

严格测试保留原有哈希、尺寸与字节断言，涵盖独立来源记录及审阅衍生图；缺图或不符即失败，不联网补图。严格构建校验共享索引中的照片哈希后才复制到本地图册。它们不授予再发布许可。

**默认构建不会清除旧的 `output/references/`。公开分发时不要携带本地照片、旧图库或参考截图。**

## 数据与扩展

- `data/` 保存冻结地图与匹配证据；`source-cache.json` 是必要的离线输入，不是可删临时缓存。保留原字节、哈希和 `.gitattributes` 的 LF 规则。
- `npm run data -- --offline` 从冻结输入重建数据，不依赖原始 PBF 或网络；只有明确更新来源时才使用 `--refresh`，并重新审核身份匹配。
- `reference-catalog.json` 是工作台使用的照片来源索引；独立 `data/*-references.json` 还保留补充证据及审阅图记录，不能按图库数量删减。
- `src/model.js` 提供地图模型与替换接口，`src/refinements.js` 注册建筑，`src/landmarks.js` 注册独立地标。新增模型遵循 [建模约束](MODELING.md#建模约束)。

### 独立庭院预览

`node scripts/courtyard-preview.mjs` 生成 `output/library-courtyard-source-preview.html`，通过上述预览服务打开。它复用 `../courtyard/src/model.js` 的建筑、三段干石池和双廊架，并可导出 `library-courtyard-reused-unplaced.glb`。**该模型尚未完成校园定位**，不是老馆东翼入口；石池及既有造型不能当作实测现状。

## 许可

本工程自有源码适用仓库根目录的 [MIT 许可证](../../LICENSE)。MIT 不替代第三方内容的许可：

- 地图保留 [OpenFreeMap](https://openfreemap.org/)／[OpenMapTiles](https://openmaptiles.org/)／**© OpenStreetMap contributors** 署名；OSM 数据适用 [ODbL 1.0](https://www.openstreetmap.org/copyright)，社区边界不是法定界线。
- 二校门字形来自 LXGW WenKai，适用 SIL OFL 1.1；完整版权与许可证保留在 [src/second-gate-font-OFL.txt](src/second-gate-font-OFL.txt)。
- 照片授权和署名见来源索引。官方发布不代表开放再分发许可；本仓库不打包参考照片，不移除水印，不将照片作为模型纹理。

发布地图截图、导出模型或其他派生产物前，应核对相应数据、字形和媒体许可及署名要求，不能统一标为 MIT。
