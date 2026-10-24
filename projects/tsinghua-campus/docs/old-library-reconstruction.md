# 老图书馆：冻结组团内的东翼西向入口

验证方式更新：默认测试保留OSM/路线点/冻结缓存匹配、几何及来源断言，3张官方照片的原有SHA256检查单独由 `npm run test:references` 执行；默认模式明确跳过照片字节检查，显式模式缺图或哈希变化即失败。默认构建仍提供来源元数据页，但不读取、复制或分发照片。

## 交付范围与 Interface

新增 `src/old-library-refinement.js`、`tests/old-library.test.mjs`、本文件及约 5 KB 的 `data/old-library-match.json`。另外在 `references/old-library-*.jpg` 保存两张官方参考照片，原文件不裁切、不缩放、不去水印。未修改父级 registry/UI/catalog/QA、其他历史建筑、原地图数据或路线；未执行 OneDrive 操作、提交或子代理任务。

这是一个小 Interface 的深 Module，调用方不需要操作内部分区、窗孔、瓦面或材质批次：

```js
import {
  OLD_LIBRARY_IDS,
  createOldLibraryDetail,
  refineOldLibrary,
} from './src/old-library-refinement.js';

// data 为原冻结 campus.json，campus 为 createCampusModel(data) 的结果。
const root = refineOldLibrary(campus, data, OLD_LIBRARY_IDS[0]);
// root === campus.buildings.get(OLD_LIBRARY_IDS[0])

// 也可单独生成未挂接 Object3D；origin 必须是冻结源轮廓的投影原点。
const detail = createOldLibraryDetail(feature, data.metadata.center, localOrigin);
```

`OLD_LIBRARY_IDS` 是冻结数组，仅有一个已核实根：

`building:geometry:3065e70be1ca6052ab77a739`

不得复制出新的“老馆建筑 ID”。根保留原地图地址、位置、源名称（空字符串）、源标签及来源属性；只有根拥有 `featureId`。显示名称说明这是“图书馆组团 · 老馆东翼入口细化”，不是把全组团重新命名为老图书馆。调用返回原根对象。匹配、源属性、几何、投影原点及根变换异常会在改动场景前抛错，不尝试最近建筑降级。对同一根重复调用只保留一个 detail，并释放之前的独占几何、材质和程序纹理。

## 为什么这个匹配可靠，而路线点本身不可靠

核实日期：2026-10-12。

1. `projects/tsinghua-tour/route.json` 的“老图书馆”停靠点为 `node/7072425636`，WGS84 `[116.3183857, 40.0031247]`。
   - 官方核对：<https://api.openstreetmap.org/api/0.6/node/7072425636.json>，节点 version 3，实际名称“清华大学图书馆”，而非独立“老图书馆建筑”。
   - <https://api.openstreetmap.org/api/0.6/node/7072425636/ways.json> 返回空数组。
   - 冻结校园中没有建筑轮廓包含该点；它在入口西侧绿地/接近路径区域。**不能拿它做建筑内含匹配，更不能据此选最近楼。**
2. 冻结候选根未命名：`name: ""`，`nameSource: "unknown"`，`sourceFeatureId: null`。`osm-names.json` 未提供老馆的命名 polygon 关联；它包含李文正馆等别的馆舍。不得强加虚构的源建筑名称或源 way ID。
3. `source-cache.json` 中，`14/13485/6202` 的 `poi` 记录：
   - label ID `207797653`，名称“老馆”，`name:en: "Old Library"`。
   - tile grid point `[55237917, 25405171]`；按 zoom 14 / extent 4096 解码为 `[116.31927788257599, 40.00347731245368]`。
   - 该点确实在本根轮廓实体内（非庭院孔洞），也在下述官方 OSM 老馆 relation 内。
   - 同一根还有逸夫馆、李文正馆等标签，直接说明不能把它整体视作一座独立原老馆。
4. 官方 OSM 小范围 map 请求发现 **relation `20779765`**，而不是同号直接 way：
   - <https://api.openstreetmap.org/api/0.6/map.json?bbox=116.3181,40.0028,116.31965,40.0038>
   - 完整几何：<https://api.openstreetmap.org/api/0.6/relation/20779765/full.json>
   - relation version 1，timestamp `2026-05-30T17:55:52Z`，`name=老馆`，`name:en=Old Library`，`type=multipolygon`，`building=yes`，`amenity=library`。
   - 外环 way `852646109` version 5；内环 way `1524715356` version 1。
   - POI 数字尾缀与 relation 编码吻合，但**匹配依据是核实后的名称、成员、包含关系及轮廓重合，不是单靠尾缀猜 ID**。`207797653` 不能直接当 OSM way ID。
5. 用真实 polygon intersection 而不是近邻距离计算：
   - 官方 relation 实体面积被冻结组团轮廓覆盖 **99.4708405687%**。
   - 与全组团 IoU 仅 **38.3333067269%**：证实全轮廓远大于 relation 老馆。
   - 东翼入口的凹凸轮廓与官方外环的连续顶点逐段吻合；冻结环 `[32] → [33]` 是所建入口外立面。
   - 官方内环对应冻结东侧庭院。冻结组团还保留两个西侧孔洞，一共三个。
   - 本次官方返回外环、内环坐标与冻结几何都写入独立小匹配文件；运行时不会联网，也不会用官方几何覆盖原地图。

缓存批次 ID `103278700` 是 batched-vector-feature ID，**不是建筑 OSM ID**。源 `sourceTiles`、`idStrategy`、`sourceIdScope` 和 `upstreamProperties` 原样保留。匹配文件里的 `expectedOSMId: osm:relation:20779765` 是独立的重建证据，不覆盖 `sourceFeatureId: null`。

测试重新解码缓存标签、检查真实包含、计算官方几何重叠率，并严格比较完整源外环及三个内环；几何/孔洞/名称/来源发生变化时必须重新审核。即使被改成听起来“更正确”的源名称“老图书馆”，也会拒绝静默套用。

## 历史部分与未考证部分的处理

官方历史说明：<https://www.tsinghua.edu.cn/info/2965/108059.htm>

该页明确：东翼是 1916–1919 年初建部分；中部大厅和西翼为 1930–1931 年扩建，今天图书馆是新老建筑衔接的楼群。

冻结源轮廓把老馆、逸夫馆、李文正馆以及相连部分合并，还包含与档案馆外形对应的连接片区。这里不拆分或更换地图地址，也不假称每一部分已经考证完成：

- 使用原 Polygon 的全部外环及三个内环做薄基础。
- 以真实入口 edge 为坐标轴，只裁取东翼西向入口和紧邻南北低翼的保守前侧条带，深度约 19.7 m。
- 南北范围由冻结环 `[30]` 和 `[35]` 限定；实际条带与完整含孔 footprint 求交，绝不画一块完整矩形替代其轮廓。
- 中央入口与低翼分别取交集做墙壳、穿孔窗、分区屋顶。
- 其余部分为 `footprint − photoPlan`，保留上游 5 m 中性基础体量，明确标为 `unrefined-remainder`。东侧庭院后面的未知体量也不做照片推断。
- 所有薄基础、屋顶坡面和屋脊/斜脊装饰线均经过真实源轮廓裁切；没有把孔洞或开口庭院填成平台。

这不是完成了全部“老馆”的重建，更不是整个现代图书馆组团的高保真模型；它是原地图地址内部、有证据约束的历史入口扩展。

## 正面方向、比例及照片观察

入口外边：

`[116.319047213, 40.003263635] → [116.319057941, 40.003111595]`

入口边中点 WGS84：`[116.319052577, 40.003187615]`。

地图轴为 X 东、Y 上、Z 南，法线：

`facadeNormal = [-0.9985424329113116, 0.0539723047086081]`

即**朝西、略偏南约 3.09°**（方位角约 266.91°），不是朝南。路线点在入口西侧只是辅助空间一致性证据，不是源匹配条件。

| 维度 | 值 | 依据 |
|---|---:|---|
| 入口中央立面总宽 | 16.9497 m | 冻结正面 edge 实测投影长度 |
| 所支持前侧总跨度 | 56.3551 m | 冻结边界顶点的正面轴投影，不是照片中的透视宽度 |
| 保守前侧条带深度 | 19.7 m | 源边界内的重建裁取范围；不是认证原建筑进深 |
| 中央檐口 / 瓦面脊高 | 14.15 / 16.25 m | 照片比例估计；中央完整屋脊未获照片直接证实 |
| 实际新可见几何最高点 | 16.3600006 m | 未挂接 detail 的可见 mesh 包围盒，包含薄脊帽 |
| 低翼檐口 / 脊高 | 9.35 / 11.5 m | 较完整夜景坡顶及与中央立面的比例推定 |
| 主拱窗宽 | 2.25 m | 正面照片比例估计，三扇 |
| 主拱窗下缘 / 起拱高度 | 6.35 / 8.55 m | 比例估计；半圆半径 1.125 m |
| 中央门宽 | 1.95 m | 比例估计 |
| 正中立面退进 | 0.55 m | 照片中与两侧方形突出角楼的关系 |
| 窗玻璃退进 | 0.31 m | 建模估计，非实测窗洞深度 |
| 入口台阶宽 | 8.8 m | 比例估计 |
| 台阶 | 9 级，踢面 0.18 / 踏面 0.36 m | 下部在首张照片中被裁切；级数和尺寸推定 |

照片直接支持：暖红砖、三扇高半圆拱窗、拱圈多重砖券、细竖窗棂和横向分格、下部中央凹入入口、两侧方形突出角体、顶部三扇矩形窗、角体矩形窗列、深挑薄檐与密集托木，以及宽入口阶梯两侧实心墙。

Implementation 使用带孔 `Shape`/`ExtrudeGeometry` 构建墙体，玻璃放在洞内更深位置；没有在实心盒墙前贴“拱形窗”。扇窗竖棂高度按半圆方程裁切，横棂也随拱顶缩短。拱圈分成有实体缝隙的径向砖块并批处理。中央入口的背景比窗玻璃更深，凹槽没有原盒体遮挡。两侧角体有实际转折侧墙；托木有水平与斜向支撑。九扇低翼拱窗沿源西向立面排布，其他隐藏侧后窗明确是推定延续。

中央四坡瓦顶为**明确标记的估计**，不是从首张裁切照片伪称得到完整屋顶测量。补充夜景能够支持低侧翼的坡屋顶与整体前立面关系，仍不能确定中央屋脊、隐藏东面及历史各期完整平面；这些限制写入根和 detail 的 metadata。

## 参考照片：本地留存，不作照片纹理

下列官方页面提供观看参考，不等于授予再分发许可证。本次没有作任何“可自由再分发/开放许可”声明，没有裁切水印，没有从照片提取贴图；照片只在本地查看，模型只使用自编砖缝/瓦缝 DataTexture 和纯色材质。

### 1. 原有正面照片

- 文件：`references/old-library-front.jpg`
- 发布页：<https://lib.tsinghua.edu.cn/gk/gsfm/lg.htm>
- 图片：<https://lib.tsinghua.edu.cn/images/laoguanwaijingshuiyin.jpeg>
- 尺寸：1600 × 1067；290,434 bytes。
- SHA-256：`5e2e0a90bed2c98b349c92c3c3e072ba27d9a30de1aba0ae625cf10f442952f7`
- 已实际查看。原右下清华大学图书馆水印保留。用于三主拱窗、角体、矩形窗 tier、托木和入口比例；它裁掉了中央完整屋顶和部分台阶。

### 2. 新增雪景拱窗近照

- 文件：`references/old-library-arch-snow.jpg`
- 发布页：<https://lib.tsinghua.edu.cn/gk/gsfm/lg.htm>
- 图片：<https://lib.tsinghua.edu.cn/images/tushuguanlaoguanwaijingshuiyin.jpeg>
- 尺寸：1600 × 1067；384,241 bytes。
- SHA-256：`f32582e4270719e6e7c45fd2005291fbfba1728f58d0a20fc91a1c6541689b3a`
- 直接下载原 JPEG 字节。已实际查看，左下水印保留。用于核实多层砖拱、金属窗分格、拱脚石饰及入口上方石板；**不是完整建筑/屋顶照片**。

### 3. 新增更宽的入口及低翼夜景

- 文件：`references/old-library-night.jpg`
- 发布页：<https://lib.tsinghua.edu.cn/gk/gsfm/lg.htm>
- 图片：<https://lib.tsinghua.edu.cn/images/laoguanyejingshuiyin.jpeg>
- 尺寸：1600 × 1067；252,772 bytes。
- SHA-256：`3b0ad1ad785138248ac97dd806240f6185c0d96b75c85fbae89f24bb578a8530`
- 直接下载原 JPEG 字节。已实际查看，右下水印保留。相比首张照片，更完整展示低翼坡瓦顶、成列拱窗、台阶接地与中央入口关系。不能把夜景黄色照明当作真实砖色；砖色仍依据白天照片。

### 排除的现代馆舍照片

官方校园景观页 <https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm> 的“图书馆”照片实为现代连接组团庭院，不是目标原老馆入口。实际查看后删除本次临时 `old-library-gallery.jpg`，未用于任何模型形体/材料，也不需父级收录：

- 图片 URL：<https://www.tsinghua.edu.cn/__local/B/AE/01/EBE46D66EF6F456C9AD90AA0C64_1C90A235_A66A0.png>
- 原图 1920 × 900，681,632 bytes；原 PNG SHA-256：`d7fd42506465cebbd1303d0780b780ae705736f77afcf9612f6ab1941c0ef191`。
- 临时 JPEG 转换文件 844,611 bytes；SHA-256：`7c028fc6aad00541b4f5e005bb5ca79863db5fe6425261695b7908b79f086af7`，已删除。
- 不把该图的屋顶或现代玻璃入口移植到老馆。

## 根高度、导出与性能

- `baseRenderHeight = 5`、`baseHeightSource = openfreemap-render-height` 留存。
- 新 `renderHeight` 取未挂接 detail 中 `traverseVisible` 的 mesh 几何最高点，不取整个根的 Box3；隐藏基座或校园祖先变换不会污染真实本地显示高度。
- 替换后原 `base` 保留空的不可见源标记，原 mesh/edges 几何被释放和清空。完整源 footprint 转存根的 `sourceFootprintGeometry`；即使导出器 `onlyVisible:false`，也没有隐藏的旧基座实体重复导出。
- 13 个 batched meshes，74,928 个 position vertices。砖券小片只用低分段曲线；完整拱窗保留更细曲线分段。两个程序生成 DataTexture，无 JPEG/PNG 加载、远程材质或照片像素。
- 单个重建不增加 campus 的 building 数，不修改 root 的 meter placement，也不把特征 ID 放到 child 上。

## 定向回归

只运行：

```powershell
node --test projects/tsinghua-campus/tests/old-library.test.mjs
```

结果：**11/11 通过**（Node test runner；最近一次约 0.84 s）。测试覆盖：

1. 冻结未命名身份、标签解码、路线点排除与官方 OSM polygon 重叠。
2. WGS84 入口中点、原根/地址/来源不变和朝西法线。
3. 三主半圆洞口的玻璃退进、扇形内外光线与真实窗棂。
4. 深入口、双突出角体窗、顶部矩形 tier、九扇低翼拱窗及深檐托木。
5. 实体面积分区守恒、三个庭院（含重建条带邻近点）和路线绿地无填充、现代余部仍为基础体量。
6. 四坡顶坡度、几何屋脊、九级实际台阶及斜侧墙。
7. 全部 position/normal/uv 数值有限、网格/顶点预算及程序纹理确定性、无照片加载。
8. 故意增加 300 m 隐藏基座、变换祖先仍不影响本地高度；包括不可见对象的序列化没有旧 mesh。
9. 重复调用无积累并释放旧几何/材质/纹理。
10. 几何、孔洞、名称、源属性、异常坐标、重复根和根变换变化均在场景修改前拒绝。
11. 三张保留的官方照片 SHA-256 与原水印字节一致。

未跑全校园测试、build、浏览器 QA、渲染或父级登记。父级可通过上述 Interface 接入，并把两张新增照片收录参考目录；无需改动原冻结数据。
