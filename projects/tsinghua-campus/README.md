# 清华园 · Three.js 校园重建

独立的北京清华主校区建模工程，范围包含教学区、紫荆宿舍区与校内生活区。第一阶段从 **OpenFreeMap 矢量瓦片**提取建筑轮廓、道路、绿地与水系，用 Three.js 建立可逐栋替换的三维基模；不修改旧导览、舜德楼或徽章工程。

当前冻结 `20261004_113936_pt` 的6张原生 z14 瓦片：**650个建筑轮廓体块、95条道路要素、29个水系要素、115片绿地**，其中327个建筑关联了名称。校园范围来自 OSM university relation `7469216` v13；社区地图边界不是法定界线。跨瓦片的25个建筑已拼接，保留18个内院孔洞。

**601个建筑的上游显示高度仅为5米**，当前忠实保留并标注，不按未知楼层擅自拉高。OpenFreeMap把部分不相连建筑打包到同一要素中，因此拆分后的649个建筑使用规范化轮廓哈希编号，另1个保留可用独立要素编号；它们不是650个已核实的独立楼号。

首个试点为已有的**舜德／伟伦组合院落**照片参照模型，使用素色材质、真实门窗几何，非实测精模。对应 `building:geometry:6bd0154b26cfe7cf654cdd3b`，与原 OSM way84653293 轮廓 IoU 99.3034%，新旧中心偏差0.108米；不误替换西侧新经管楼。`src\shunde-refinement.js` 从原模型 ENU 坐标转换到校园坐标，不凭目测缩放对齐。

## 第二批：经管红楼与大礼堂

本批**只更新当前工程，不写入 OneDrive**。全校地图数据不重新下载，不改变650个轮廓编号；在原位置接入更多照片参照模型，其余建筑仍为基模。

| 地点 | 本批内容 | 依据与精度 |
|---|---|---|
| 经管新楼 · 建华／李华组团 | 复用既有砖红陶板、拱窗、凹进玻璃和上部玻璃体量，灰色空中连廊接到舜德楼 | OSM way937482182 匹配对应校园轮廓；与舜德共用原 ENU 坐标。官方组团总高30米，低区分界、隐藏立面和连廊构造仍为推定 |
| 大礼堂 | 根据官方斜视照片构建砖墙、浅穹顶、鼓座、坡屋面及白色入口柱廊 | 平面来自校园轮廓；照片可见部分优先，尺寸比例和隐藏构件不冒称测绘结果，具体说明见 `docs\auditorium-reconstruction.md` |

经管对应 `building:geometry:62d3ed181227f777a3fc0e1f`，名称来源关联 `osm:way:937482182`；不是原名“经济管理学院”的伟伦—舜德组合院落。连廊下缘约13.2米，即用户指定的约四层尺度，下面保持悬空；不混称为官方建华—李华“知识之桥”。

照片新增一张清华教育基金会 **9588×5295** 经管外观原图，保存于 `references\sem-exterior-official.jpg`，仅观察，不贴到楼体。经管模型的表面微纹理由本地程序生成。工作台现在有“舜德楼／经管红楼／大礼堂”快捷视角，点选后显示各自的重建说明与参考照片，而不是所有楼都显示舜德说明。

当前产物位于本工程 `output`：

- `tsinghua-campus-offline.html`：可双击打开的最新交互工作台。
- `tsinghua-campus-refined.glb`：全校园模型，包含本批照片参照重建；原第一版 `tsinghua-campus-base.glb` 不覆盖。
- `sem-reconstruction.png`、`auditorium-reconstruction.png`：工作台截图。
- `reference-photos.html`：默认仅含可分发的参考来源元数据；显式 `npm run build:references` 才复制照片生成仅本地使用的图库。
- `reconstruction-index.json`：从实际模型生成的已接入建筑编号、来源与重建说明。
- `buildings\`：已重建建筑的单独 GLB，局部米制坐标，可用于逐栋编辑；具体文件对应关系见上述索引。

第三批继续处理主楼和清华学堂，详见下节；老图书馆与紫荆公寓仍在后续队列，暂未宣称完成精细模型。

## 第三批：主楼组团与清华学堂

主楼不合并成一个虚构编号：**中央、西、东三栋各自保留原轮廓与坐标**，共用官方正面照片和经校方文字核实的南向入口。中央楼加入阶梯体量、顶部高窗带、凹进窗列、底层柱廊和台阶；低侧翼保留凹入庭院，补列窗和檐线。“主楼组团”快捷视角同时显示三个地图对象，点选仍可分别导出。

中央楼的41米只取上游显示高作比例基准，肩部和低翼楼高按照片推定；没有将单张正面图之外的侧后立面包装为已核实细节，也没有凭空补出未经逐一核对的四座过街楼。详细依据与限制见 `docs\main-building-reconstruction.md`。

清华学堂使用**老学堂**原有开放轮廓，不是新清华学堂；灰砖墙、白色线脚、红色坡屋顶、入口及侧翼按本地官方斜视照片制作，方向和尺寸限制见 `docs\school-reconstruction.md`。两处都不使用照片作为外墙贴图，当前是可继续细化的照片参照重建，不是实测精模。

此批完成后，注册模型为**5处地点、7个建筑轮廓对象**（主楼占3个，其余各1个），全校总数仍为650。快捷视角分成单独一行；每个已重建对象显示自己的来源与说明。

最新版仍在 `output\tsinghua-campus-offline.html`，主楼／学堂截图为 `output\main-building-reconstruction.png`、`output\school-reconstruction.png`，全校园 GLB 为 `output\tsinghua-campus-refined.glb`。单栋 GLB 与具体编号对应关系见 `output\reconstruction-index.json`。**不更新 OneDrive 中的旧版。**

预览启动后访问 `http://127.0.0.1:8786/`；修改模型并 `npm run build` 后刷新页面。后台服务因会话停止而退出时，在本工程重新运行 `npm run dev`，不把失效地址当成仍在运行。

Windows 上需要持续预览时，双击本目录 `start-preview.cmd` 并保持该窗口打开。它直接启动本机8786端口的服务，不依赖助手的临时后台会话，不设置开机自启；关闭窗口即停止，服务报错退出时窗口保留退出码和错误信息。也可在自己的终端运行上述 `npm run dev`。助手临时启动的服务不保证对话结束后存活；不想保持服务窗口时，直接双击 `output` 中的单文件离线 HTML。

## 第四批：清华二校门

二校门作为**独立地标**接入：冻结的 OpenFreeMap 数据没有它的建筑轮廓，因此不借用旁边招生办公室的编号。位置通过 OSM API 核对 `node941370305` v5（`116.3182903, 39.9997127`），保存在 `data\second-gate-anchor.json`；650个原地图建筑编号全部保留，新增 `landmark:osm:node:941370305`。这是社区地图点位，不是测绘中心。

三维形制参照本地官方现貌照片：中间大拱与两侧小拱为真实开放门洞，补青砖墩、白色圆柱、石基、分级檐线、弧形肩部和题字。另存一张官方文章中的历史全高照片辅助观察比例，**不把历史照片当作当前现貌，也不恢复已拆除的两翼短墙**。题字用开放许可字体的矢量字形近似，不声称复制那桐手迹；尺寸、背面和局部装饰仍是照片比例推定，详见 `docs\second-gate-reconstruction.md`。

工作台点击“二校门”，或搜索“二校门／清华园”即可查看和导出；“地标”图层可单独开关。当前累计**6处地点、7个替换轮廓及1个独立地标**。单独模型为 `output\landmarks\tsinghua-second-gate.glb`，局部原点归零、单位米，可独立复制到其他三维场景；校园导出中保留它的地理位置。截图为 `output\second-gate-reconstruction.png`，索引将 `buildings` 与 `landmarks` 分开记录。所有产物仍只放当前工程，不更新 OneDrive。

按用户要求进行现貌对照后，另存校史馆 **3264×2448完整正面照片**与官方低机位斜视照片，补足最初照片裁掉的冠部与石基。校正重点为阶梯式平顶（不是三角山花）、柱墩独立多层檐口、粗圆柱及较高石基、侧拱白色墙面和卷涡肩部。二校门快捷视角改为较低的观察机位，其他建筑仍保持原有俯视方式。

`output\second-gate-comparison.html` 将**现貌照片／修改前／修改后**并排显示，正面与斜视各一组；模型前后固定同一相机和照明，不用换光源掩盖形制差异。`output\second-gate-comparison.png` 是可直接查看的对照截图。照片和模型不是严格像素配准，仍不代表测绘验收。模型的顶部标高包含旗杆，门体高度与旗杆总高分别记录在导出元数据中。

对照脚本在导出 GLB 后运行：`node scripts\second-gate-compare.mjs after`。首次保存修改前模型为 `output\second-gate-review-before.glb`，再运行同一脚本的 `before` 模式即可保留修改前视图；不要用新模型覆盖这份对照快照。

## 第五批：扩展老校园建筑

继续以真实照片逐个接入，不批量套通用窗户就宣布全校复刻完成。本批范围为西体育馆、老图书馆，以及工字厅南门房／工字形主殿／水木清华临池后厦。**具体已接入对象，以实际运行生成的 `output\reconstruction-index.json` 为准**；参考照片已准备不等于模型已完成。

西体育馆使用 `osm:way:226623363` 匹配的原轮廓，优先还原官方运动场侧照片可见的三山墙拱窗、低侧翼暖色坡屋面、高馆顶长天窗与开放石柱廊。背部增建和被遮挡部分明确标注推定。老图书馆优先做三联高拱窗、砖墙、外凸角部、入口台阶及深檐；不把连接的新馆和老馆误当同一年代的统一立面。

工字厅主殿是保留原凹形平面的 `building:6598261612`。南门房另占一个未命名地图轮廓，经 OSM way1059165164 v1 验证重叠 IoU **96.6351%** 后接入；“工字厅门房”是照片／位置解释，不冒称 OSM 原名。官方说明水木清华正廊为工字厅后厦，因此临池立面作为同一主殿的北侧视角，不凭空多造一栋建筑或重复编号。隐蔽侧院、彩绘和石狮精雕等未充分核实部分，不宣称完全复刻。

工作台新增**“只看已重建建筑与地标”**：同时筛选搜索结果与三维场景，临时隐藏未重建体块，不删除原轮廓。取消勾选恢复整个校园；校园 GLB 导出当前开启图层及筛选后可见对象。状态区明确显示照片模型覆盖了多少地图轮廓、还有多少基模／局部重建，原有327个地图名称计数不会因人工补显示名而虚增。老馆连通组团及西体育馆后部仍有未细化区域，因此将这两处标为**局部重建**，仍保留在待完善清单里。

| 持久文件 | 用途 |
|---|---|
| `output\campus-coverage.json` | 每个原轮廓的基模／照片推定阶段、原地图高度与现模型高度、来源和限制 |
| `output\campus-backlog.csv` | 仍待重建及局部待完善的轮廓编号／名称清单，保留未命名对象 |
| `output\reconstruction-index.json` | 当前实际接入并成功导出的建筑与地标，不按照片数量虚报完成 |
| `output\campus-reconstruction-gallery.html` | 实际工作台截图汇总；点击图片直接打开对应三维视角 |

覆盖率是**阶段覆盖，不是还原度评分**。没有实测、完整立面或室内依据的地方仍为估算；即使未来所有轮廓都有照片模型，也不能把这项比例直接等同于完全忠实的测绘复原。当前工程会持续保留剩余清单，校区外观尚未完整复刻。

## 第六批：科学馆与历史馆舍

科学馆使用原轮廓 `building:geometry:91ba4cc6c7a0d501736a0fec`，名称关联 OSM way79701310；是1919年、中心草坪西侧的科学馆，**不是生命科学馆或科学博物馆**。根据已保存的官方东立面照片，还原三层红砖、交错的三联／单窗、中央跨两层圆拱入口及小山墙、铜色双门、四坡顶和两条低屋顶采光窗。约61.44米的长立面与21.54米进深取自冻结轮廓；约18.27米顶部标高为照片比例估算，背面仅做外壳，不宣称逐窗复刻。依据及限制见 `docs\science-hall-refinement.md`。

直接打开 `http://127.0.0.1:8786/?view=science-hall`，或点击“科学馆”。汇总页的每张卡片都有“对照实景照片”，整页截图 `output\campus-reconstruction-gallery.png` 与实际输出同步生成，不沿用上一批截图。已完成与仍待建的数量以当前 `output\campus-coverage.json` 为准。

同方部保留 `building:geometry:767c29087b14fbf65879f219`（名称来源 OSM way226633636），用两张官方西门照片还原灰砖山墙、红瓦双坡、小圆通气口、蓝灰高窗与装饰窗棂、层叠砖墩、双壁灯及匾额。西门朝中心草坪，与朝南的正门廊不同；南门廊、东部两层及遮挡面仅有文字／估算依据，因此明确记为**局部重建**，仍列入待完善清单。快捷视角 `?view=tongfang` 从西北方向观察，避免南侧清华学堂挡住入口；依据与限制见 `docs\tongfang-refinement.md`。

老化学馆对应 `building:geometry:ad7b725c774db745829afef8`（OSM way83801034），不是北侧新化学馆或东侧何添楼。官方历史与2008年老馆照片核对身份，2019／2024年摄影者发布的入口照片支持南侧中央红砖肋柱、阶梯女儿墙、上下三联窗、贝壳顶浅龛、石门额、木双门及宽台阶。完整保留原多边形和东端连接体，但两翼／背面／女儿墙后屋顶未充分采集，因此同样列为**局部重建**；`?view=chemistry-hall` 聚焦已有照片支持的南侧入口。约19.32米顶部为估算，详见 `docs\chemistry-hall-refinement.md`。

第六批新增三个原轮廓模型，没有改变冻结地图的650个对象或327个原地图名称。累计为**12处地点、14个照片模型轮廓和1个独立地标**；**636个仍为基模，4个只完成局部**，待重建／待完善清单保留640个对象，绝不把整栋估算外壳或局部入口说成全校完整复刻。图库新增7张原发布照片，审阅用转正／缩小衍生图单独存档、不重复计数。

## 打开与使用

已有的三段石池庭院楼位于 `projects\courtyard\src\model.js`，不是本工程东翼拱窗入口的新模型。`src\courtyard-reuse.js` 直接复用旧建筑、露台、石池与双廊架的几何，跳过旧场景的大面积地板、植物和相机，不重新绘制一套楼体。独立预览为 `http://127.0.0.1:8786/output/library-courtyard-source-preview.html`，对应恢复模型保存在 `output\library-courtyard-reused-unplaced.glb`。该文件名的 `unplaced` 表示尚未完成地图定位，不能当作已经接入校园的建筑；三段水面是过去按要求添加的效果，不视为实测现状。

恢复预览的命令为 `node scripts\courtyard-preview.mjs`。旧模型默认查看器不变；只在复用时传入 `architectureOnly: true`，几何测试可传入 `textured: false`，无需浏览器画布或植物素材。

```powershell
Set-Location projects\tsinghua-campus
npm install
npm test
npm run build
npm run dev
```

访问 `http://127.0.0.1:8786`。工作台支持 `?view=old-library` 等已注册视角参数，便于直接打开新建筑。干净检出使用已冻结的 `data\campus.json`、`source-cache.json`、`osm-names.json` 和 `provenance.json`，不需要校园或兄弟工程的任何照片，也不需要再次下载瓦片。需要离线重放时运行 `npm run data -- --offline`；只有明确刷新来源时才用 `--refresh`。`data\diagnostics.json` 是可再生诊断输出，不纳入提交；冻结缓存、边界与TileJSON来源证据保留。

本目录 `.gitattributes` 将 `data\*.json`、`data\*.geojson` 和工字厅OSM XML声明为 `text eol=lf`；Windows 即使设置 `core.autocrlf=true`，新检出的冻结输入也保留LF和原始字节哈希。它们仍是可审阅文本，不用 `-text` 伪装二进制，也不修改任何期望SHA256。此规则仅限校园数据，不改变其他工程的既有输入。

`npm run build` 生成 `assets\scene.js`、可双击打开的 **`output\tsinghua-campus-offline.html`**，以及 `output\reference-photos.html` 参考来源页。地图、几何与程序内嵌，不请求在线地图或CDN。默认来源页列出每张照片的公开页面、原图链接、尺寸、哈希、许可和未知项，明确提示**照片未打包、字节未校验**；不会读取或复制本机照片，也不会产生坏图片标签。来源链接仅在用户点击时访问原站。

### 可选的严格本地参考验证

默认 `npm test` 始终运行几何、编号、来源元数据、冻结数据哈希与OSM XML断言；6项照片字节检查显示明确跳过原因，不将跳过说成照片通过。工字厅XML固定在 `data\gongzi-entrance-osm.xml`，以LF保留原始SHA256及ODbL署名；不依赖忽略的 `references`。跨工程的舜德/庭院源码与定位JSON仍需随仓库存在，但不读取兄弟工程照片。

仅在自己合法持有目录中指定的本地参考资料时，显式运行：

```powershell
npm run test:references
npm run build:references
```

`test:references` 严格核对共享目录24张原发布照片、各独立SITE及化学馆审阅图的原有哈希/尺寸/字节断言；缺图或哈希不符即失败，不联网补图。工字厅检查使用校园 `references\gongzi-entrance.jpg` 与 `shuimu-pond-facade.png`，不再读取兄弟工程照片。`build:references` 在SHA256通过后才复制共享目录图片并生成本地图库，缺图、路径异常或哈希不符均失败。图库与复制照片**仅限本地使用，不代表获得再发布授权，不纳入PR或模型发布**。默认构建不会清理之前显式生成的图库照片，分发时勿携带旧的 `output\references`。

`npm run qa` 才会生成截图汇总页 `output\campus-reconstruction-gallery.html`、GLB与覆盖报告；二校门前后对照还需相应GLB快照及 `build:references` 的本地图册。它们需要本地浏览器，是独立的可选渲染/导出验收，不是默认构建要求。

- 鼠标左键旋转、右键平移、滚轮缩放；平面模式固定北向上。
- 点选体块或搜索建筑名称／编号，查看来源、占地、顶部／底部标高与局部原点。
- “全校／紫荆片区／教学片区”切换观察范围；后两项是工作区段，不是校方行政分区。第二行列出已接入建筑与地标的快捷视角；截图汇总中可直接打开对应模型或对照实景照片。
- 道路、水系、绿地、建筑和独立地标可分别开关。地图名称不完整，未关联名称的建筑仍有编号。
- 校园 GLB 导出当前开启图层；单栋 GLB 在自身局部原点导出，米制、Y 向上。导出保留建筑来源与编号，不导出选中高亮。
- “参考来源”打开来源元数据页；选中已重建地点可直接打开对应章节。仅显式本地图册包含照片，图片不进入地图基模或被拿来贴建筑外墙。

## 坐标与精度边界

原始平面保留 WGS84 经纬度。渲染采用以 `metadata.center` 为原点的局部等距圆柱投影：**X 东、Y 高、Z 南，单位米**。校园尺度近似适合体块建模，不是测绘坐标系。地面暂时为平面，没有高程 DEM、地下结构或建筑内部。

`renderHeight` 是建筑顶部相对平地的标高，`minHeight` 是底部标高；拉伸厚度为两者之差。OpenFreeMap 的 `render_height` 可能由上游楼层或默认值生成，**不能当作实测高度**。数据缺失时的估算策略与实际工作边界记在冻结数据的 `metadata` 和每栋楼的 `heightSource` 中。屋顶目前为平顶，墙面为中性基模材质，不伪造窗户和历史建筑细节。

Polygon 内环保留为孔洞，MultiPolygon 保持一个可寻址记录。跨瓦片拼接和去重由采集脚本处理。编号标识地图数据中的对象；除非来源明确验证，不把矢量瓦片编号冒称为 OSM way 编号。地图源刷新后仍需核对对象分裂／合并，不能保证所有编号永久不变。

## 逐栋重建

1. 在工作台中找到建筑，记录稳定编号和局部原点；保存它的平面、照片视角与来源。
2. `reference-catalog.json` 管理照片：建筑名称、原图链接、发布页面、本地文件、尺寸、哈希、可见结构与未知部分。实际照片保存在忽略 Git 的 `references\`，公开来源不等于允许再发布。
3. 按屋顶／主体体量、门窗节奏、材质与局部构件逐步细化。缺失背面照片、测量尺寸时明确标为推定，不通过任意拉伸“做得像”。
4. 通过 `replaceBuilding(buildings, featureId, detailGroup)` 在原位置替换：`detailGroup` 以该楼的局部原点为基准，X 东、Y 上、Z 南，单位米。基模隐藏但保留，编号和地图位置不变。调用发生在工程源码中，刷新后仍需由源码重新注册，不把临时浏览器操作冒称为已保存修改。
5. 在 `src\refinements.js` 注册重建模块，再 `npm run build` 更新离线工作台、导出该栋或全校园 GLB。照片库里的地点不代表对应精模都已完成。

`src\model.js` 的 `createCampusModel(data)` 是地图数据到模型的入口，返回整体组、图层和以编号索引的建筑组；每栋楼的 `userData` 保留来源和原点。`buildings` 只保存冻结地图建筑，`landmarks` 只保存独立地标，`objects` 提供两者统一的搜索、拾取和导出入口。`applyCampusLandmarks(campus, data)` 将二校门按经核对的坐标放置，重复调用替换而不叠加。几何、查找和 GLB 导出使用同一组对象，不维护另一套不一致的“展示模型”。

## 本地文件

| 路径 | 用途 |
|---|---|
| `data\campus.json` | 冻结的 WGS84 校园数据与来源信息 |
| `scripts\fetch-campus.mjs` | OpenFreeMap 数据采集、拼接与去重 |
| `src\geo.js`、`src\model.js` | 坐标、轮廓拉伸、图层、精模替换 |
| `src\main.js` | Three.js 工作台、搜索、拾取、GLB 导出 |
| `src\refinements.js` | 已接入重建模块的统一注册与快捷视角 |
| `src\sem-refinement.js` | 经管模型复用、轮廓校验、连廊与校园坐标放置 |
| `src\main-building-refinement.js` | 独立的中央／东西主楼，阶梯式体量和真实凹窗 |
| `src\school-refinement.js` | 老清华学堂的开放平面、坡屋顶与入口重建 |
| `src\second-gate.js`、`src\landmarks.js` | 二校门几何与独立地标身份、坐标放置 |
| `src\west-gym-refinement.js` | 西体育馆照片参照立面、三山墙、坡屋顶与开放柱廊 |
| `src\old-library-refinement.js` | 经实际组团匹配的历史入口、拱窗、低翼、檐口与台阶 |
| `src\gongzi-refinement.js` | 工字形主殿、南门房及北后厦临池立面，共用真实身份 |
| `src\science-hall-refinement.js` | 1919年科学馆东侧长立面、圆拱入口、四坡顶与低采光窗 |
| `src\tongfang-refinement.js` | 同方部西门灰砖山墙、蓝灰门窗与装饰；隐藏区域明确推定 |
| `src\chemistry-hall-refinement.js` | 1932年老化学馆南侧局部入口、原长条轮廓与东端连接体 |
| `src\view-bounds.js` | 用局部照片支持区域聚焦，避免大连通轮廓把已重建入口缩成小点 |
| `src\coverage.js` | 原轮廓／照片估算／独立地标的真实阶段覆盖统计 |
| `data\second-gate-anchor.json` | 经核对的 OSM 点位、版本与来源 |
| `data\gongzi-entrance-osm.xml` | 默认回归必需的冻结OSM门房fixture，含ODbL署名，LF原始字节 |
| `reference-catalog.json` | 可追溯的逐建筑照片索引 |
| `references\` | 仅本地保留的参考照片 |
| `output\reference-photos.html` | 默认无图片的来源页；仅显式严格构建后为本地图册 |
| `output\tsinghua-campus-offline.html` | 无网络依赖的单文件交互工作台 |
| `output\tsinghua-campus-refined.glb` | 当前校园模型，保留已接入照片参照重建与来源 |
| `output\landmarks\tsinghua-second-gate.glb` | 可独立使用的二校门局部米制模型 |

`npm test` 还回归无照片来源页、严格图库缺失/变更拒绝与哈希通过后的本地复制；`npm run test:references` 才执行真实本地照片字节检查。`npm run qa` 做浏览器加载、搜索、离线打开与GLB导出。导出不包含被替换模型的隐藏基模；单元回归不等同于截图像素验收。

## 来源与许可

- 地图服务：[OpenFreeMap](https://openfreemap.org/)，[当前 TileJSON](https://tiles.openfreemap.org/planet)。
- 矢量模式：[OpenMapTiles](https://openmaptiles.org/)，地理数据：**© OpenStreetMap contributors，ODbL 1.0**，见 [OSM 版权说明](https://www.openstreetmap.org/copyright)。
- 页面和导出几何的元数据保留署名。发布地图截图、模型或派生数据库时需遵守各自许可；照片的许可与地图／程序许可分别处理。
- 参考照片默认仅本地研究使用，不嵌入离线模型，不去除水印，不因下载成功而宣称已获贴图或再分发许可。
