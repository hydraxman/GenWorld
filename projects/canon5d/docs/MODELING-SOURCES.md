# 关键建模链接、文档与许可

以下是本项目既有来源记录的整理，并非对所有链接进行新一轮在线可用性检查。来源网页与本地制作证据分开；官方外观/规格不能证明模型内部布局精确。

## 1. 实际用于V3的精细模型

- **Canon EOS 5D Mark IV Digital Camera / sotilrac Asmat**
  https://www.blenderkit.com/asset-gallery-detail/a5be7449-3b42-4ae4-9275-3c67907ac973/
- 资产base ID：`a5be7449-3b42-4ae4-9275-3c67907ac973`
- 实际版本ID：`c71ed1a5-0c66-41af-9894-a5fd3ffdeb01`
- 下载方法：官方搜索API解析版本→官方downloadUrl（传scene_uuid）→返回的授权下载地址。不要把gallery ID当版本ID，也不要抓取受限查看器网格。
- 本地原件：`film45/replacement-v3/assets/canon_eos5d_mark_iv_original.blend`
- 数据交换：`film45/replacement-v3/assets/canon_eos5d_mark_iv.glb`
- 下载证据：该目录的 `source-api.json`、`source-license-metadata.json`、`artifact-manifest.json`。
- 模型检查：`inspection.json`、`HANDOFF.md`、`validation_front.png`、`validation_rear.png`，以及 `textures/`。

## 2. 外观、规格和内部结构依据

| 来源 | 用途 | 边界 |
|---|---|---|
| 佳能亚洲官方外观图文 | 正面、背面、顶部、侧面和按钮 | 外观依据，不是内部CAD |
| 佳能相机博物馆 | 产品规格及机身尺度参考 | 不能把艺术配准值当规格 |
| Lensrentals拆机记录 | 主板、传感器、镜箱等相对布局 | 第三方照片，非官方维修手册 |

佳能外观：
https://snapshot.canon-asia.com/article/eng/eos-5d-mark-iv-a-review-in-pictures-1-exterior-design

佳能规格：
https://global.canon/en/c-museum/product/dslr849.html

Lensrentals拆机：
https://www.lensrentals.com/blog/2016/09/lensrentals-canon-5d-mk-iv-teardown/

本地参考照片与对应来源：`references/sources.json`、`references/exterior-contact.jpg`、`references/internal-contact.jpg`。候选模型调研见 `references/asset-research/RESOURCE-REVIEW.md`；候选列表不代表实际使用授权资产。

## 3. 许可边界

BlenderKit许可：
https://www.blenderkit.com/docs/licenses/

官方FAQ：
https://www.blenderkit.com/docs/licenses/licensing-faq/

原项目已保存条文摘录和下载方式，见 [LICENSE-SOURCE.md](../film45/replacement-v3/assets/LICENSE-SOURCE.md)。资产为 **Royalty Free**，不是CC0或CC BY；允许渲染视频等高层次衍生作品，不可把独立模型、贴图库或含资产的blend作为库存资产任意再分发或转售。此处只在原用户本地整合，未发布工程。Canon商标归其权利人所有，资产授权不代表佳能背书。

## 4. 技术文档

- Blender Python API：https://docs.blender.org/api/current/
- Blender glTF导入导出：https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
- Blender MCP上游：https://github.com/ahujasid/blender-mcp
- FFmpeg滤镜（atempo等）：https://ffmpeg.org/ffmpeg-filters.html
- Azure HD语音：https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices
- Azure语音支持：https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support

技术链接是继续开发入口；`current/latest`文档可能随时间变化，本地实际运行版本以依赖说明和验证报告为准。
