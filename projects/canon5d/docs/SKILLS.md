# 相关skills

只收与本片直接相关的工作流，不把所有3D/视频技能搬进项目，也不更改全局Hermes配置。

| 项目内skill | 来源 | 用途 |
|---|---|---|
| [blender-cutaway](../skills/blender-cutaway/SKILL.md) | 全局 `blender-mcp` 的工程剖视、原生影片、BlenderKit三份参考 | 真实网格、拆分、光路、标签、授权与Blender验收 |
| [azure-hd-narration](../skills/azure-hd-narration/SKILL.md) | 全局 `azure-tts` 的HD Flash参考 | xiaoxiao2、固定原文/时槽、付费WAV保留、atempo、音轨核验 |

这些是**项目专用入口+原参考快照**，不是声称复制了全部上游skill。参考文件按原字节保存，来源和SHA-256见下表；以后可以独立随项目维护。

`threejs-rendered-film`适用于工作区里的建筑项目，但不是本片渲染后端；HyperFrames/视频生成模型也不是本片依赖，因此不重复纳入。MCP安装说明只需在需要重新配置环境时读取全局 `blender-mcp`/`hermes-agent`，归档不自动安装。飞书投递工作流仅在用户要求再次发送时使用，不包含本次项目资料范围。

本地使用时让Agent先读本项目README和对应 `SKILL.md` 即可；没有自动注册到其他配置或账号。

## 参考快照指纹

- `skills/blender-cutaway/references/engineering-cutaway.md`
  - 来源：`creative/blender-mcp/references/engineering-cutaway.md`
  - SHA-256：`2e4bb65c9b2f7f5c94c873a1eeb8fbee4b2f72f54e64ba975ab733459c1d5465`
- `skills/blender-cutaway/references/narrated-cutaway-film.md`
  - 来源：`creative/blender-mcp/references/narrated-cutaway-film.md`
  - SHA-256：`fc2b37962b42e51c6bfedf96bd1e85489f22293a9d07de66692e349ea77cb0a6`
- `skills/blender-cutaway/references/public-blenderkit-assets.md`
  - 来源：`creative/blender-mcp/references/public-blenderkit-assets.md`
  - SHA-256：`2ad3f381b9e5c3af6814ae6781441cfbc6a4636e0c2a331549a1d0375ae031fb`
- `skills/azure-hd-narration/references/hd-flash-word-timing.md`
  - 来源：`openclaw-imports/azure-tts/references/hd-flash-word-timing.md`
  - SHA-256：`38918c65b8095d25e01c07e81679e6130aa8ce982a1ebe1df8de66148a35eb03`
