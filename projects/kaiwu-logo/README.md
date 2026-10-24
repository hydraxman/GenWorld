# 开悟 / 清华 MEM Logo 动效

可编辑的徽章动画、原始矢量与几何，以及保留原效果的离线播放器。

## 当前试验

- [云光凝徽](studies/sky-fusion/README.md)：天空、粒子成形、三层旋转、固定书脊翻页与轮廓描边。
- [校园俯冲](studies/shunde-dive/README.md)：复用同一徽章引擎，分离校园背景与金属徽章后合成。建筑为参考重建，不是实景航拍。

两项试验均有独立的构建和测试命令，不覆盖下方归档。

## 效果与离线预览

| 工程 | 离线播放器 |
|---|---|
| [星际穿越](latest/tsinghua-mem-five-effects-a/01/) | [打开](latest/tsinghua-mem-five-effects-a/01/deliverables/Tsinghua-MEM-01.html) |
| [极光织带](latest/tsinghua-mem-five-effects-a/02/) | [打开](latest/tsinghua-mem-five-effects-a/02/deliverables/Tsinghua-MEM-02.html) |
| [星尘凝徽](latest/tsinghua-mem-five-effects-b/03/) | [打开](latest/tsinghua-mem-five-effects-b/03/deliverables/Tsinghua-MEM-03.html) |
| [折光涟漪](latest/tsinghua-mem-five-effects-b/04/) | [打开](latest/tsinghua-mem-five-effects-b/04/deliverables/Tsinghua-MEM-04.html) |
| [蓝天云启](latest/tsinghua-mem-five-effects-cloud/) | [打开](latest/tsinghua-mem-five-effects-cloud/deliverables/05-Blue-Sky-Cloud-Opening.html) |
| [背景发光 / 镂空透光 / 虹彩扫光](history/tsinghua-mem-badge-motion/) | [打开](history/tsinghua-mem-badge-motion/deliverables/Tsinghua-MEM-Light-Studies.html) |
| [七种光效](history/tsinghua-mem-seven-studies/) | [打开](history/tsinghua-mem-seven-studies/deliverables/Seven-Studies.html) |
| [三维星光](history/tsinghua-mem-3d-starlight/) | [打开](history/tsinghua-mem-3d-starlight/deliverables/Tsinghua-MEM-3D-Starlight.html) |
| [三维开书](history/tsinghua-mem-3d-book-opening/) | [打开](history/tsinghua-mem-3d-book-opening/deliverables/Tsinghua-MEM-3D-Book-Opening.html) |
| [开卷见天地](history/tsinghua-mem-open-world/) | [打开](history/tsinghua-mem-open-world/deliverables/Tsinghua-MEM-Open-World.html) |
| [星河开悟横屏](history/tsinghua-mem-awakening-wide/) | [打开](history/tsinghua-mem-awakening-wide/deliverables/Tsinghua-MEM-Awakening-Wide.html) |

下载后可在浏览器直接打开离线播放器；GitHub 文件页面只展示源码。[starlight-v2](history/tsinghua-mem-starlight-v2/) 是未完成草稿，没有完整播放器。

## 编辑与构建

原稿在 `source-art/`，各工程的 `inputs/` 保存轮廓与语义几何，`scripts/` 保存动效源码。先按[仓库说明](../../README.md)安装依赖；当前试验使用各自 README 的命令。

归档中的三维工程可在其目录内打包制作入口：

```sh
npx --no-install esbuild scripts/scene.js --bundle --format=iife --minify --loader:.svg=text --loader:.jpg=dataurl --alias:three=./vendor/three/build/three.module.js --outfile=assets/scene.bundle.js
python -m http.server 8080 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8080/index.html`。暂停时间轴可通过浏览器控制台的 `Object.values(window.__timelines)[0].play()` 播放。

离线播放器内嵌构建结果，修改源码不会自动更新它；重新打包后优先检查制作入口。历史辅助脚本可能依赖未收录的本地输入，并不保证全部可直接运行。原始位图未收录，不能仅凭矢量化脚本从头重建；已有 SVG 可编辑。`open-world/scripts/setup.py` 会覆盖场景，不是安装步骤。

`archive-manifest.json`、`verification.json` 和归档中的冻结清单保留原始来源及验证证据，不随本次整理重写。生成视频、截图和依赖缓存不进入源码。

## 许可与来源

原创代码采用仓库根目录的 [MIT 许可证](../../LICENSE)。第三方代码、素材及品牌图形仍适用各自许可；MIT 不授予校名、标识或原始徽章的商标权和未获授权的使用权。

- Three.js 及复用的示例实现：MIT，保留工程内的许可证与版权声明。
- GSAP：适用 [GSAP Standard License](https://gsap.com/standard-license)，不是 MIT；原版权头保留。
- 天空：Poly Haven，CC0；见[来源记录](latest/tsinghua-mem-five-effects-cloud/references.json)。
- 校园数据、植物和可选风格处理工具：见[校园试验署名](studies/shunde-dive/ATTRIBUTION.txt)。神经模型代码的许可不代表权重已获再分发授权。
- 其他来源与使用限制以各归档的许可记录为准；参考组件、官方参考照片和外部模型权重不因本仓库开源而自动取得授权。
