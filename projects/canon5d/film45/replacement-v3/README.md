# 相机讲解 V3：精细模型与 xiaoxiao2

## 成片

`Canon5D-NewModel-Xiaoxiao2-V3.mp4`：45秒，1280×720，24fps，1080帧，H.264/AAC。原11段中文解说、字幕、悬浮tag、光路和镜头动画保留。

## 本次替换

- 精细机身与镜头：BlenderKit 的 Canon EOS 5D Mark IV Digital Camera，作者 sotilrac Asmat。原资产为74个mesh、84,646多边形；通过数据格式转换、单位校准、拆分外壳整合到教学动画，机顶LCD UV与玻璃/涂层另作适配。
- 女生旁白：Azure Speech `zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural`，11段重新请求合成，保留原文与时槽；不是此前云希音轨。Azure标为Female，未声称进行了人工试听。
- 内部光学/机械结构仍为教学示意，非制造商精密拆机资料。

## 文件

- `canon5d-v3-production.blend`：最终渲染工程。
- `integrate_model.py`、`export_asset_glb.py`、`polish_materials.py`：模型整合脚本。
- `compose.py`、`timeline.json`：原标签/字幕逻辑及固定时间轴。
- `audio/`：新原始WAV、适配WAV、manifest及语音/旧发送审计。
- `verify_scene.py`、`blend-verification.json`：场景/尺寸/全环视/光路验证。
- `verify_final.py`、`final-verification.json`：成片全部解码、音轨逐段关联、原文/时槽/源文件一致性、新旧画面差异与视觉验收。
- `final-qa/contact.jpg`：最终成片18帧抽查。
- `../../evidence/original-delivery-verification.json`：原交付的文件指纹和验收记录；聊天列表、上传发送脚本与含消息绑定的投递回执不纳入本建模工程。当前完整入口见 `../../README.md`。

最终文件SHA-256：`449ef099d879970670bd4129fd44b30d6bc7b76b9249d62774cab25ecc76b1ba`。

## 许可与运行边界

资产为Royalty Free，允许影片渲染；不得将下载模型/贴图/工程作为库存模型转售或任意再分发。详见 `assets/LICENSE-SOURCE.md`。本次只交付视频。

GUI MCP 的外部blend库加载被安全模式拒绝，已改用禁用自动执行的离线导出和data-only GLB。GUI导入该GLB时阻塞于文件打开，未关闭安全模式；最终整合与完整渲染由独立Blender后台进程完成，不依赖该GUI进程。旧影片及原始静态工程未覆盖。
