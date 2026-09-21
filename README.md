# GenWorld 工作区

唯一日常工作目录：`~/Desktop/GitHub/GenWorld`，远端：`hydraxman/GenWorld`，主分支：`main`。各子项目直接在本仓库内更新；历史版本使用 Git，不再复制 `Courtyard3D-vN` 或长期保留任务 worktree。

## 项目入口

- [开悟 Logo 特效](kaiwu-logo/README.md)：五版最新效果及历史效果源码、必要素材和离线播放器。
- [清华园十二站视频 / 普通地图与卫星图切换](projects/tsinghua-tour/README.md)：最终星空卫星版、核心素材、原速晓晓与 SSML、可复现捕获/导出命令及制作调度 skill。默认卫星底图，`--basemap standard` 切普通地图。
- [相机精细模型 V3 / xiaoxiao2](projects/canon5d/README.md)：已交付45秒成片、Blender工程、核心参数、代码、建模来源/许可和相关skills。
- [盘锦道路锚点地图导览](projects/panjin-map-tour/README.md)：MapLibre＋OSRM路线、道路入口锚点、大号编号、Azure SSML讲解、确定性相机和完整QA流程。
- [舜德楼庭院重建](projects/shunde/README.md)：北侧正门、朝中庭圆体、斜向内立面与北侧开口；[平面和照片对应依据](projects/shunde/docs/courtyard-reconstruction.md)。OSM 为伟伦楼与舜德楼组合轮廓，未见立面与尺寸保留推定边界。
- 庭院与舜德楼目录及开发入口见 [WORKSPACE.md](WORKSPACE.md)。
- 相机为独立Blender子项目，不接入建筑的Three.js构建；模型和媒体只在本地保留。

---

## 历史兼容入口：庭院建筑 V6

以下根目录 `src/`、`assets/` 和旧查看器作为冻结 V6 基线保留，供当前庭院的几何一致性回归使用。日常开发优先使用上面的 `projects/` 子项目，不再更新多份版本目录。旧版独有源码说明见 [历史增量归档](archive/courtyard/README.md)。

本版只调整最后10秒的镜头：从V5较远的高俯视，改为正面略偏侧、稍高的近景，突出展开层级和底层隔墙、楼梯。建筑几何、植被、灯光、水面、分拆顺序与收拢时刻不变。

- 视频46秒、1920×1080、30fps。
- 前36秒直接保留此前V4/V5的已交付编码帧。
- 最后10秒使用相机位置 `[8,21,32]`，目标 `[0,11.5,-3]`，垂直视场角46°；展开和收拢保持固定视角，便于比较。
- 建筑内部仍为推测示意，不是实际施工结构。

## 查看
在本目录运行：

```sh
python3 -m http.server 8768 --bind 127.0.0.1
```

打开 http://127.0.0.1:8768/viewer.html 。有五个外观视角、“分层展开”和“收拢复原”按钮，支持拖动旋转缩放。

`index.html`为46秒完整场景，`segments/ending.html`供HyperFrames以项目根目录为基准渲染最后10秒。

## 开发

```sh
npm ci
npm test
npm run build
CHROME_PATH=/path/to/chrome node qa-exploded.mjs
```

附预构建JS及全部纹理，查看器无需下载依赖即可运行。`src/camera.js`保留原36秒镜头；`src/film-camera.js`仅定义新增镜头。`src/exploded.js`与V5字节一致，校验值见qa/v5-baseline.json。

模型没有改动，因此V5的带内部GLB模型仍可使用，本次不重复发送模型压缩包。叶片为cgbookcase / Dorian Zgraggen的CC0素材，来源见assets/leaves/SOURCE.json；楼内隔墙、楼梯与柱梁为艺术补全。
