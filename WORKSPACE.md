# GenWorld 项目工作区

工程根：`~/Desktop/GitHub/GenWorld`，也是唯一保留的本地 GenWorld 仓库。仓库可整体迁移，维护脚本不依赖桌面的旧 Courtyard3D 目录。

## 当前入口

- `kaiwu-logo/`：开悟 Logo 最新五版与历史特效源码、离线播放器、渲染前置清单。
- `projects/tsinghua-tour/`：清华园十二站导览，独立 Node/MapLibre/Python/FFmpeg 子项目；普通与卫星底图共用时间线、原速配音及星空背景。按本次要求将审核后的核心素材和最终卫星视频纳入私有仓库，其余渲染帧、缓存和凭据排除。运行与切换见该目录 README。
- `projects/courtyard/`：庭院旧楼的当前反射更新版。
- `projects/shunde/`：舜德楼庭院重建版；`blender/` 单独标注为旧版楔形模型的冻结交付快照，不冒充当前几何。
- `projects/canon5d/`：相机精细模型V3的工作入口，包含成片、Blender模型、代码、参数、建模来源及相关skills；见该目录README。原桌面Canon5D-Cutaway仅保留为旧快照。
- `projects/panjin-map-tour/`：盘锦MapLibre道路导览，包含冻结路线、道路锚点、Azure SSML旁白、确定性相机、验证脚本和项目内skill；生成音频、逐帧缓存与MP4不进入Git。
- `shared/`：可共用的渲染、光照、反射与叶片素材。
- `archive/courtyard/`：旧版独有源码增量与可恢复清单，不是重复的可运行工程副本。
- `local-assets/`：不进入 Git 的必要历史媒体、研究/诊断证据；授权受限素材仍只用于原有私有归档用途。

相机子项目独立使用Blender/Python/FFmpeg，不影响下方建筑npm命令。相机验收：`cd projects/canon5d && python3 -m unittest discover -s tests -v`。Git仓库包含相机代码、参数、文档与skills；相机资产为Royalty Free，模型/贴图/媒体只留本地，不随代码推送。

`projects/shunde-v2/` 已移除。后续修改直接更新对应项目，历史通过 Git 提交保存，不通过复制文件夹保存。

## 本地 Git

仓库远端为私有项目 `hydraxman/GenWorld`，默认分支为 `main`。后续修改直接更新对应项目，历史通过Git提交保存，不通过复制版本目录保存。

模型参考图、视频/GLB、运行截图/报告、投递回执、依赖及缓存默认留在本地并被 `.gitignore` 排除。用于回归校验的少量哈希基线 JSON，以及清华项目按用户要求明确归档的核心素材和 `final/` 成片，作为限定例外纳入版本控制。

## 构建和验证

从工程根执行：

```sh
npm test
npm run build
npm run dev
```

- `http://127.0.0.1:8773/projects/courtyard/index.html`
- `http://127.0.0.1:8773/projects/shunde/index.html`
- `http://127.0.0.1:8773/projects/shunde/viewer.html`
- `http://127.0.0.1:8773/projects/panjin-map-tour/public/index.html`

迁移后已在新目录运行盘锦、庭院、舜德楼源码测试及建筑构建；庭院 parity 改为仓库内冻结基线并固定输入哈希，不再读取旧桌面目录。舜德楼实际浏览器 GPU 检查、GLB 导出/回读与重复 seek 通过；Blender 冻结旧版独立重开通过。本次是源码整合与目录清理，没有重新制作所有项目的整段视频。

其他验证入口：`npm --prefix projects/tsinghua-tour ci`、`npm --prefix projects/tsinghua-tour test`，以及在清华子目录运行 `python3 -m unittest discover -s tests -v`。恢复的对比/合成脚本见 `projects/shunde/tools/recovered/README.md`。清华在线地图捕获仍依赖第三方瓦片服务，离线测试通过不代表在线全片重新渲染通过。

详细照片依据、纹理和几何边界见 `projects/shunde/README.md` 与 `DESIGN.md`。实际可见窗组不等于已经查证的法定楼层；隐藏立面、屋面、内部构造与米制尺寸仍为估计。
