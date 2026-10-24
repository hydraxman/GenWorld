# GenWorld

用三维场景探索知识、建筑与视觉叙事。各项目独立维护，共享渲染工具与素材。

[在线探索](https://hydraxman.github.io/GenWorld/)：通过统一导航打开三维场景，以及可创作、导出的生成艺术页面。

## 项目

| 项目 | 内容 |
| --- | --- |
| [知识学院](projects/knowledge-tower/README.md) | 可探索的软件工程知识大楼，包含学习热力图与概念测评 |
| [校园重建](projects/tsinghua-campus/README.md) | 地图与照片约束的校园模型、逐栋细化与模型导出 |
| [舜德楼](projects/shunde/README.md) | 建筑、庭院与周边环境重建 |
| [庭院建筑](projects/courtyard/) | 建筑查看器与分层构造示意 |
| [风向印刷所](projects/wind-print/) | p5.js 风场文字、叶片生长与海报导出 |
| [Logo 视觉研究](projects/kaiwu-logo/README.md) | 徽章、粒子、光照与校园镜头实验 |
| [清华园导览](projects/tsinghua-tour/README.md) | 地图、景点与旁白组成的视频制作工具 |
| [盘锦地图导览](projects/panjin-map-tour/README.md) | 道路锚点、路线与确定性镜头 |
| [相机结构](projects/canon5d/README.md) | Blender 相机结构与光路教学 |

## 快速开始

安装 Node.js 与 npm，在仓库根目录运行：

```sh
npm ci
npm run build:knowledge
npm run dev:knowledge
```

按终端提示打开知识学院。其他项目的依赖和命令见各自说明；地图、语音及视频制作可能还需要在线服务、Python、浏览器或 FFmpeg。

```sh
npm test
npm run build
```

根命令覆盖共享建筑项目和知识学院，不代替每个独立项目的验证。Windows 上运行 Python 测试时请启用 UTF-8。

`npm run build:pages` 生成带导航的静态预览站点，`npm run test:pages` 检查发布内容。Pages 从 `gh-pages` 分支发布，主分支相关文件更新后自动构建；只打包精选场景及必要的许可素材，不发布参考照片或视频制作素材。

构建后可运行 `npm run qa:pages`，用 Chrome 或 Edge 检查场景交互与移动端导航；浏览器位置可通过 `CHROME_PATH` 指定。

风向印刷所的构图逻辑可用 `npm run test:wind` 验证。其 p5.js 库独立分发，保留 LGPL 许可与源码；浏览器无需从第三方 CDN 加载脚本。

## 目录约定

- `projects/`：独立项目；`courtyard-baseline/` 仅作为庭院回归基准。
- `shared/`：共用的渲染与素材处理代码。

历史通过 Git 保存。生成文件、依赖缓存、凭据和受限参考素材不提交；不在文档中记录个人机器路径、交付过程或重复的版本清单。

## 许可

原创代码采用 [MIT License](LICENSE)。第三方代码、地图数据、字体、照片、模型与品牌素材**不因本仓库采用 MIT 而重新授权**，请遵守各项目随附的来源与许可说明。

部分素材尚无公开再分发授权；MIT 声明不代表整库素材均可商用或再分发，复用前请核对来源。建筑模型与学习测评均为示意，不用于工程设计或能力认证。
