# 实际资产交付 / Canon EOS 5D Mark IV

## 可直接导入
- 原始且未修改：`canon_eos5d_mark_iv_original.blend`（5,311,760 bytes）。所有 7 张贴图已 packed，无外部缺图。
- 独立检查场景：`canon_eos5d_mark_iv_review.blend`（只增补参考灯光/相机；未改原材质）。
- 原始贴图解包：`textures/`，6 PNG + 1 JPEG；最大 1807×1808。
- 实际本地 Cycles 参考渲染：`validation_front.png` / `validation_rear.png`，1200×1000。`author-preview.jpg` 仅作者预览，勿混同。
- 完整对象/几何/材质/贴图审计：`inspection.json`，运行日志 `inspection.log`，校验和 `artifact-manifest.json`。

## 几何和方向（实际独立 headless Blender 检查）
- 75 对象：74 mesh + 根 Empty；原始多边形共 84,646，23 材质，7 packed images。
- 根 Empty：`Canon EOS 5D Mark IV Digital Camera`，Body / Lens Body / Screen 等为其子对象。
- 前向/镜头指向 -Y，后屏面朝 +Y，Z 向上。
- 全部网格世界 bbox：min=(-0.11004347,-0.09089629,-0.00913751)，max=(0.07853965,0.13315761,0.15528852)。整体 dimensions=(0.18858311,0.22405390,0.16442603) Blender units。导入后需与项目比例匹配，不宜把这些数值冒充实物精确尺寸。
- 独立对象包括 `Body`, `Body Center`, `Body Feature`, `Screen`, `LCD`, `Visor`, `Visor Lens`, `Scroll`, `Scroll.001`, `Selector`, `Button.*`, `Flash Shoe`, `Ports`, `Lens Body`, `Lens Mount`, `Lens Glass*`, `Lens Internal*`, `Labels*`, `Sensor`, `Camera Internal`。
- 并非现成完整机械剖解模型；部分内部名称存在不等于功能/结构正确。后壳是否能完整独立拆开仍需按拓扑分离，切勿直接声称外壳每片均可拆。

## 质量检查
本地正反两面图已视觉检查：眼罩、取景器、热靴、LCD及背屏、左排按键、SET速控拨轮、握柄颗粒、各处标签/接口、镜头环齿和镜片均实际存在。明显超出简化外壳几何质量，可用于影片外观替换。

仍需整合阶段调整：原始黑壳材质较光亮，有塑料/金属感；建议结合影片灯光提升粗糙度、检查 metallic，不把高光灰白误判成缺纹理。渲染只是独立资产检查，未修改 GUI Blender 场景，未与影片合成。

## 许可
BlenderKit Royalty Free，作者 sotilrac Asmat。官方明确允许商业 renders/animations；不允许把模型/改编场景当库存3D素材转售。不是 CC0 / CC BY。证据与来源见 `LICENSE-SOURCE.md`, `source-api.json`, `source-license-metadata.json`。

下载为官方匿名 API 授予的原始 .blend，非 Sketchfab viewer-rip，未登录、未付费、未绕过登录/下载权限。
