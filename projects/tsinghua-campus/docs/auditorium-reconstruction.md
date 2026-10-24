# 大礼堂：本地照片参照重建

本批次只细化一座建筑，不修改校园冻结数据。几何、纹理和参考均留在本地工程；
没有复制到 OneDrive，没有上传参考照片，也没有把照片作为模型贴图。

## 身份核验

- 导出常量 `AUDITORIUM_ID`：
  `building:geometry:ba46ccc8cc43f04fe38fc0ba`。
- 从 `data/campus.json` 按 `properties.name === '大礼堂'` 查到唯一建筑。
  `kind=building`，`nameSource=osm-local-extract-building-overlap`，
  `nameSourceFeatureId=osm:way:33457842`，`nameConfidence=0.993`。
- 冻结轮廓实际来自 OpenFreeMap `20261004_113936_pt`、z14 tile
  `14/13485/6202`。其 `sourceFeatureId=null`、ID 策略为规范化轮廓
  SHA256-96。`upstreamBatchFeatureIds=['103278700']` 是批量矢量渲染 ID，
  **不是这座建筑的单体 ID**。OSM way 只用于已有名称匹配，不替换轮廓。
- 一个 Polygon、一个闭合 13 点环（12 条边）、无孔洞，面积约
  **1107.88 m²**；轮廓是略倾斜且不完全对称的十字形，不是矩形盒子。
  模块逐点核对冻结经纬度及拓扑；变更、孔洞、歧义 ID 或错误放置都会抛错，
  不悄悄使用通用模型兜底。

## 参考与实际观察

已实际查看完整本地官方斜俯图 **1920 × 900**：
[`../references/auditorium-oblique.jpg`](../references/auditorium-oblique.jpg)。
本次没有额外下载照片。

- 官方目录：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm
- 该目录原图：
  https://www.tsinghua.edu.cn/__local/E/C5/CB/171B5114C0D43E853B94AA5CE46_0BACEE5A_191A51.jpg
- 用途：本地比例和形态参照；版权属于原权利人，不声称有再分发授权。
  可交付模型的两张贴图为代码生成的小型砖缝/红瓦 DataTexture，
  不含参考照片像素。

**可见、用于约束几何：**

1. 红砖体量上是交叉的红色坡屋顶，山墙和屋脊有浅色压顶，不是平屋顶。
2. 中央砖鼓座向上露出坡屋顶，上缘有小型浅色菱形装饰；
   多层灰色环檐向上收退。
3. 灰绿色金属穹顶是低矮的曲面帽，带清晰径向肋纹；
   不是半球，也不是放在方盒上的光滑球。
4. 入口有白色古典柱廊、宽横向额枋及中央高起的矩形栏板，
   不是三角形希腊式门廊。可辨认拱形窗和台阶。
5. 大量树木遮住低处及局部柱、门窗；不可把树遮挡处当作精确立面证据。

**估算或不可见：** 米制高度、坡角、柱间距、柱槽形式、肋数（模型 64）、
精确环檐截面、瓦/砖尺寸、门窗数量和背面立面。模型四柱布局为
对可见柱廊节奏的简化推定，不宣称单张照片能核准全部柱脚。
后方窗格按主立面节奏补全；不建内部空间、结构系统或机电设施。
窗使用真实拱形面板与边框表现嵌入外观，不进行外墙布尔穿孔。

## 方向与地图放置

坐标遵循校园模块：**X 东、Y 上、Z 南，单位米**。
建筑父 Group 保持冻结 bbox 中心 `[-150.96655693, -89.02086095]`
（相对于 `data.metadata.center=[116.32003975,40.00164005]`）。
细节在该父 Group 的本地坐标内创建，不搬到原点、不按照片缩放整座建筑。

入口方向不是默默假定 `+Z`：

- 冻结南侧凸出边为
  `[116.318162084,40.002236331] → [116.318414211,40.002248659]`。
  投影后边长约 **21.54 m**，其外法线为
  **`[0.063701,0.997969]`**，即南偏东约 **3.65°**。
- 同份地图的草地 `landcover:807161562` 位于建筑南侧，
  相对大礼堂 bbox 原点范围约 X `-25.16…40.26 m`、
  Z `56.49…185.49 m`，与照片入口前开敞地的关系相容。
  北侧约 140 m 的复合图书馆轮廓及南方科学馆/清华学堂名称位置
  也没有把此布局反转。
- 因单张照片没有指北标且草地是社区地图数据，
  元数据明确写 **“入口方向推定，非测绘”**；不声称摄影机方位已测定。
  东西轴由上述实际轮廓边计算，保留各侧轮廓的细微不规则。

## 本次几何和尺度

轮廓米制数值是地图投影结果；以下建筑高度及构件尺寸是
**照片比例推定，非测绘**：

| 项目 | 约值 |
| --- | ---: |
| 冻结 X/Z bbox | 31.11 × 45.29 m |
| 主墙檐口 | 9.20 m |
| 交叉坡屋顶脊 | 14.40 m |
| 砖鼓座上缘 | 18.20 m |
| 穹顶起点 | 19.48 m |
| 穹顶直径 / 升高 | 22.90 / 4.85 m |
| 升高 / 直径 | 0.212（浅球冠，非半球） |
| 白色柱廊宽 / 开敞深 | 21.54 / 3.90 m |
| 全部网格实际本地 Y 顶 | 24.430 m |

- 主墙沿真实轮廓挤出；入口最前约 3.9 m 切开，柱廊下方真正开敞，
  不保留实心墙体然后贴柱子。
- 屋顶在轮廓三角形内按四条坡面交线细分，生成交叉屋脊及谷线；
  不以 bbox 填平十字凹口。山墙同时在坡面变化处细分，吻合屋顶。
- 八角砖鼓座、多层八角环檐、圆形穹顶起圈和低球冠组成连续层级，
  不是穹顶直接落在盒子上。径向金属肋合并为一份网格。
- 四柱、柱础和柱头使用实例化；砖缝和瓦片是确定性 CPU 小纹理。
  Node 环境不需要 DOM 或 Canvas。约 **154 mesh / 29,700 triangles**，
  无逐砖网格、无成千上万 draw calls。照片不作纹理。
- 台阶和压顶可略超出冻结轮廓；台阶向前约 2.8 m。
  原有凹角保持空，不以矩形基座封实。

## 集成接口

```js
import {AUDITORIUM_ID, refineAuditorium} from './auditorium-refinement.js';

const campus = createCampusModel(data);
const auditorium = refineAuditorium(campus, data);
// auditorium === campus.buildings.get(AUDITORIUM_ID)
```

`refineAuditorium(campus, data)`：

- 唯一匹配冻结 ID，校验源几何及目标本地原点、位置、旋转、缩放；
  调用 `replaceBuilding`，返回 **原建筑 Group**（对象身份不变）。
- 原 `base` 设为不可见。再次调用移除旧 detail，只留一份新 detail；
  不重叠显示双重模型、不修改其他建筑或冻结数据。
- 设置 `name='大礼堂'`、`heightSource='照片比例推定，非测绘'`、
  中文 `refinementSummary`、`referenceSite='auditorium'`、
  `referencePages`、`referenceImages`、`limits`。
- `baseRenderHeight=5` 保留原高度；`renderHeight=24.430` 从细节网格
  **本地 Y** 的实际包围盒获得，不把父 Group 的世界变换当作建筑高度。
- `estimatedDimensionsMeters` 和 detail 的 `observed`/方向元数据
  可供 viewer/说明面板显示。
- 可选纯函数 `createAuditoriumDetail(feature, center, localOriginMeters)`
  返回未附着 Group，便于测试或本地预览。

## 回归

在 `projects/tsinghua-campus` 执行：

```powershell
node --test tests/auditorium.test.mjs
```

覆盖真实数据唯一身份、只替换一栋、隐藏 base、重复调用、变更轮廓及
新增孔洞拒绝、有限网格/UV/法线/实例矩阵、浅球冠比例、与南侧草地
一致的入口方向、真实凹口及屋顶三角形不越界、开敞柱廊、可变本地
原点、合理包围盒高度、父世界高度不污染 `renderHeight`、
不使用照片贴图。此模块不改 viewer、build、QA、catalog 或校园数据；
浏览器截图和导出由父任务接入后执行。

实际执行结果：大礼堂专项 **12/12 通过**；
同期 `node --test tests/*.test.mjs` 校园整套回归 **40/40 通过**
（含父任务接入的批次、SEM 和连廊测试）。
