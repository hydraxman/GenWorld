# Canon 5D：精细模型 V3 / xiaoxiao2 女声

Courtyard 3D 工作区的独立 Blender 相机教学子项目。后续在本目录维护，不改动 `projects/courtyard/` 或 `projects/shunde/`。

## 直接打开

以下成片、Blender工程和画面总览仅在本地工作区可用，不包含在Git仓库中。仓库提供代码、参数、文档与skills；下方完整验收依赖本地模型、生产帧和音频，纯源码克隆不能直接运行全部测试。

- **已交付成片**：[Canon5D-NewModel-Xiaoxiao2-V3.mp4](film45/replacement-v3/Canon5D-NewModel-Xiaoxiao2-V3.mp4)
- **最终可编辑模型**：[canon5d-v3-production.blend](film45/replacement-v3/canon5d-v3-production.blend)
- Blender 场景：`Canon5D_Replacement_V3`。第1帧为完整外观，第289帧为展开状态；总帧数1080。
- **最终画面总览**：[contact.jpg](film45/replacement-v3/final-qa/contact.jpg)

飞书显示名是 `相机新版_V3_新模型_xiaoxiao2女声.mp4`；本地使用上面的英文名，**两者指向同一交付内容**。视频45秒、1280×720、24fps；保留原文案、字幕、光路、高亮和悬浮标签。

## 四项资料入口

1. [核心参数](docs/CORE-PARAMETERS.md) / [机器可读参数](parameters.json)
2. [代码结构、依赖与运行命令](docs/CODE-AND-RUN.md)
3. [关键建模链接、依据与许可](docs/MODELING-SOURCES.md)
4. [相关 skills 与使用边界](docs/SKILLS.md)

## 验证

```sh
cd ~/Desktop/Courtyard3D-v6/projects/canon5d
python3 -m unittest discover -s tests -v
```

包含本地视频指纹、格式、1080张生产帧、11段原始/适配音轨、冻结源文件、代码路径和真实字幕合成检查。Blender重开、场景数值验证、真实单帧渲染与整片音频关联另见运行文档和 `qa/`。

## 归档边界

- 保留实际成片、最终/中间blend、资产原件及贴图、V3全量渲染帧、原始和适配WAV、时间轴、生成与验证代码。
- 原始代码中的生成输出目录改为相对脚本定位；没有改模型几何、文案、动画或成片。旧基线哈希涉及的文件保持原字节。
- 历史manifest及原验收报告中的绝对路径是当时的记录，不代表当前运行入口。旧音频调查脚本仅作为历史代码，不作为迁移验收入口。
- 旧版逐帧缓存、性能测试帧、日志、blend自动备份与聊天列表/发送脚本未复制。V3生产帧完整保留。
- 原桌面 `Canon5D-Cutaway` 未删除，作为旧快照保留；以本目录作为之后的工作入口。
- 原始生成脚本不能独自重建全部后期修正；**最终production.blend与生产帧是复现基准**。
- 资产是 **Royalty Free，不是CC0**。仅本地整合，不上传或重新分发模型资产；模型/贴图/媒体被Git忽略。此项目不是佳能官方CAD或维修手册。
