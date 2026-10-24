---
name: blender-cutaway
description: Use when editing the Canon5D cutaway project. Preserve its delivered Blender scene and validate optical timing.
---

# 相机剖视项目工作流

项目内的专用skill，不安装全局配置、不修改Hermes/MCP设置。先读 `../../README.md` 和 `../../docs/CODE-AND-RUN.md`。

1. 从 `film45/replacement-v3/canon5d-v3-production.blend` 的 `Canon5D_Replacement_V3` 场景继续，保留已交付MP4和冻结基线。
2. 查明官方外观、真实拆机和教学推测的边界；模型下载、版本及Royalty Free出处见建模来源文档。
3. 外壳替换需真实授权网格，校准单位与光轴，按语义拆分；禁止用换材质冒充模型替换。
4. 保持原11段文案、镜头、字幕、投影标签、光路、高亮；如需求改变了其中任何一项，明确列出改动。
5. 在全部帧检查抬镜、快门与曝光光路门控；投影标签来自当前动画部件；蓝色取景、橙色曝光、绿色电信号分开。
6. 使用禁自动执行的独立Blender后台进程验证；MCP安全模式拒绝加载外部blend时走data-only GLB或离线流程，不关安全模式。
7. 从最终新目录运行项目测试、verify_scene和单帧实渲染；整片解码、音轨核对和视觉验收分开记录。
8. 模型、贴图、blend、参考照片和视频只留本地；公开源码前单独复核许可与凭据。不要自动群发或上传工程。

## 原技能参考快照

- [工程剖视](references/engineering-cutaway.md)
- [带旁白的原生Blender影片](references/narrated-cutaway-film.md)
- [BlenderKit授权资产获取](references/public-blenderkit-assets.md)

参考中的Cycles是静态图场景建议；本V3影片实际为Eevee。以项目参数和当前保存工程为准。
