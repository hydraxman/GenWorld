# 舜德楼 Blender：CC0 纹理与 HDRI 来源台账

## 交付范围与事实边界

资产根目录：`projects/shunde/blender/assets/`。本次只为当前模型取得 **3 套建筑材质 + 1 套草地材质 + 1 个晴天 HDRI**，没有安装插件、下载无关资源库、改动模型或替代参考照片。

已先读取本项目 `README.md`、`src/pbr.js`，并核对 `src/model.js` 的色彩与用途：浅灰方砖 `[181,179,169]`、灰粉窗下板 `[151,138,134]`、深棕入口 `[63,48,40]`、灰地面 `[127,132,130]`、低饱和草地 `[84,99,65]`。这些是模型设计参数，不是建筑测绘数据。

素材名称“granite / plaster / grass”是提供方的资产分类，**不是对舜德楼真实石材、矿物、植物品种或产地的声明**。HDRI 是其他户外地点的环境光源，不是清华校园实景复原证据。未将棕灰原图冒充原生深棕石材：深棕入口另有明确标记的调色派生文件，下载原图保持不变。

## 官方来源与 CC0 证明

- 官方资产许可：<https://polyhaven.com/license>。已真实回读 HTTP 200；原文明确 `Our assets are all licensed as CC0`，允许商用、再分发、不强制署名。
- CC0 1.0 Universal：<https://creativecommons.org/publicdomain/zero/1.0/>，已真实回读。
- 法律文本链接：<https://creativecommons.org/publicdomain/zero/1.0/legalcode>。本次许可核验依据是官方资产许可页及 CC0 deed，并未声称逐段法律审查。
- **许可边界**：CC0 只覆盖所下载的资产，不延伸至 Poly Haven 商标、网站头像、示例渲染图，以及项目中的公开建筑照片或用户照片。没有把网站示例渲染图打包成 CC0 素材。
- `assets/evidence/license-verification.json` 保存回读时间、许可原文短引、URL、响应状态及响应哈希；`assets/evidence/<asset_id>.json` 保存官方 info/files API 回读，以及对应资产页标题、HTTP 状态、CC0 标识和页面响应哈希。HTML 响应哈希仅作该次回读定位，不代表页面以后不变。

| 接线键 | 官方资产 | 用途与限制 |
|---|---|---|
| `concrete` | [White Plaster 02](https://polyhaven.com/a/white_plaster_02)，Rob Tuytel | 浅灰矿物微纹理。只作细节层；必须保留原有正交方砖缝，不得把小方砖立面改为大块抹灰或砖红墙。 |
| `stone` | [Granite Tile 03](https://polyhaven.com/a/granite_tile_03)，Charlotte Baglioni | 入口颗粒与真实粗糙度/法线。原图棕灰，已派生深棕配色；源图自带大板缝，UV 须避免把门框改成小灰砖拼砌。 |
| `paving` | [Granite Tile](https://polyhaven.com/a/granite_tile)，Charlotte Baglioni | 深灰方形铺装，仅用于地面；保留现有深色分隔条和台阶。 |
| `grass` | [Leafy Grass](https://polyhaven.com/a/leafy_grass) | 真实草叶、少量枯叶的地表细节；不能取代近景立体植被，不宣称植物种类。 |
| `hdri` | [Noon Grass](https://polyhaven.com/a/noon_grass)，Greg Zaal | 晴天正午草地 HDRI，2048×1024。优先用于照明与玻璃反射，背景是否显示由主线程决定。 |

上述五个具体资产页均已成功真实回读，详见各自 evidence JSON，非仅凭搜索摘要或名称推断。

## 可直接接线的文件

`assets/materials.json` 为主线程接线入口。以下路径全部相对于 `blender/assets/`。

### 入口石材 `stone`

- 使用的深棕 Albedo：`derived/granite_tile_03/granite_tile_03_dark_brown_diff_2k.png`
- 未改动的原始 Albedo：`textures/granite_tile_03/granite_tile_03_diff_2k.jpg`
- Roughness：`textures/granite_tile_03/granite_tile_03_rough_2k.jpg`
- Normal OpenGL：`textures/granite_tile_03/granite_tile_03_nor_gl_2k.png`

派生算法：原图 sRGB 解码为线性值 → 逐通道乘色 → sRGB 编码，无空间滤波、不生成新矿物纹理，保持原颗粒和板缝。线性乘色为 `[0.3720871707729074, 0.2727247314612623, 0.24033803513457597]`，以原模型 sRGB `[63,48,40]` 对应的线性平均值为目标；派生图实际平均 sRGB 约 `[61.06,46.53,38.69]`。**接入派生图后不要再施加这组乘色，否则会二次变暗。** Roughness 和 OpenGL Normal 均未改动，直接使用原始下载。

### 浅灰微纹理 `concrete`

- Albedo：`textures/white_plaster_02/white_plaster_02_diff_2k.jpg`
- Roughness：`textures/white_plaster_02/white_plaster_02_rough_2k.jpg`
- Normal OpenGL：`textures/white_plaster_02/white_plaster_02_nor_gl_2k.png`

### 灰地面 `paving`

- Albedo：`textures/granite_tile/granite_tile_diff_2k.jpg`
- Roughness：`textures/granite_tile/granite_tile_rough_2k.jpg`
- Normal OpenGL：`textures/granite_tile/granite_tile_nor_gl_2k.png`

### 草地 `grass`

- Albedo：`textures/leafy_grass/leafy_grass_diff_2k.jpg`
- Roughness：`textures/leafy_grass/leafy_grass_rough_2k.jpg`
- Normal OpenGL：`textures/leafy_grass/leafy_grass_nor_gl_2k.png`

### 户外 HDRI

- `hdri/noon_grass_2k.hdr`

## Blender 接线建议

1. Albedo 使用 **sRGB**；Roughness 与 Normal 使用 **Non-Color**。Normal 经过 **Normal Map** 节点接入 BSDF Normal，采用 OpenGL +Y，不翻绿色通道，不把 normal 图当颜色直接接入 BSDF。
2. HDRI 是 Radiance scene-linear RGB 数据，使用 **Environment Texture**、等距柱状投影；选择版本对应的 Linear/Linear Rec.709 色彩空间，不标成 sRGB。已完整解码验证其高动态范围，不是 JPG 伪 HDR。
3. `white_plaster_02` 是细节来源，不是整套外墙分格方案。保持原 `squareGridAt()` 的 0.105 工作尺度正交小方砖和灰粉窗下板；微法线强度宜弱，避免墙面像粗砺水泥块。原尺度是比例建模，不是实测。
4. 入口源图带大板缝。深棕调色已经解决变灰风险，但仍要合理 UV/材质尺寸，避免缝线改变门框辨识性。没有擅自制作不带来源的“真实大理石扫描”。
5. 草地含小草叶与枯叶，宜按地表尺度重复，不要将一张图铺满整个大草坪；保留原低饱和色调及现有植物几何。
6. 官网材质尺寸可在 `manifest.json` 的 `source_dimensions_mm` 查到，仅代表纹理拍摄/建材样片尺度，不能作为舜德楼实际尺寸依据。

## 验证与可复现记录

- `assets/manifest.json`：13 个下载原文件逐项记录 `asset_id / url / license / local_relative_path / sha256 / kind / colorspace / bytes / dimensions_px`；`derivatives` 单独记录深棕调色图、来源哈希、算法、乘色值及结果哈希。
- `assets/materials.json`：`stone / concrete / paving / grass / hdri` 五项本地接线映射，路径已离线逐项验证；入口 `color` 已指向深棕派生图，另留 `color_original`。
- `assets/verification.json`：真实执行的尺寸、数量、哈希、解码结果。12 张原始材质图均为 2048×2048；HDRI 2048×1024；原始下载合计 **120019753 字节**。另有 1 张 2048×2048 深棕派生图，未计入原始下载数量与字节。
- 原始下载的文件大小、提供方 MD5 和本地 SHA-256 全部一致；Pillow 完整解码全部普通贴图。HDRI 完整逐行 RLE 解码、消耗所有字节、像素有限，线性 RGB 最大值实测 91136，确实具有 HDR 动态范围。
- `assets/evidence/downloaded-map-contact-sheet.jpg`：由本地实际贴图及 HDRI 解码生成的质检拼图，不是提供方网站示例渲染。
- `assets/acquire_cc0.py`：只下载本清单，已有原文件哈希匹配时复用；保留派生记录。
- `assets/derive_brown_stone.py`：重建独立深棕配色，保持原文件不变。
- `assets/verify_assets.py`：离线验证，包括 `materials.json` 的真实引用路径。

可复跑：

```sh
python3 projects/shunde/blender/assets/acquire_cc0.py
python3 projects/shunde/blender/assets/derive_brown_stone.py
python3 projects/shunde/blender/assets/verify_assets.py
```

脚本已在本机 Python 的现有 requests、Pillow、NumPy 环境实际运行，没有额外安装软件或插件。最初浏览器 CDP 前置检测未连接，未开启或更改浏览器设置；公开官网/API 直接访问及下载成功，不构成最终阻塞。

**剩余工作仅为主线程接入 Blender、调整 UV/曝光/法线强度并渲染验收。本文不声称模型已接线或完成渲染。**
