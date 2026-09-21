# 舜德楼：Blender 场景与 PBR 材质版

> 这是提交 `2f180759400e3be204e5340e0b307faa9b698882` 对应的旧版实心楔形模型的已交付 Blender 快照，不是现在 `projects/shunde/src/` 的庭院重建几何。迁移时保留了 `source/` 冻结 GLB、逐帧相机和配色基线；`verify_scene.py` 验证该冻结快照。不要直接对当前庭院版运行 `export_source.mjs` 覆盖冻结输入；若要把最新庭院模型移植到 Blender，应另立明确的迁移任务。

保留当前 Three.js 直角楔形模型、前庭、松树、远处反射树群、原46秒相机和分层动画，在 Blender 5.2.1 LTS / Cycles 中重建可编辑场景。不是另行猜建一栋楼，也不是把浏览器截图贴到平面上。

## 打开工程

- **可编辑工程**：`output/Shunde_Blender_PBR.blend`
- **对比图**：`output/ThreeJS-vs-Blender.jpg`
- **正式渲染**：`output/renders/{front,entrance,rear,top,exploded}.png`
- **素材许可与接线**：[docs/ASSET-SOURCES.md](docs/ASSET-SOURCES.md)
- **独立重开验收**：`qa/scene-verification.json`

工程约140.7 MB，包含40张已打包图像资源；打开不需要外部贴图、下载插件、MCP连接或开启Python自动执行。模型/贴图/渲染留本地并被Git忽略，代码与清单可以进入版本控制。本次没有新建工程版本目录，也没有改写原Three.js模型。

## 保留内容

- 原始GLB的全部网格与实例；建筑包围盒、直角楔形、后部圆柱接合、双层通高玻璃大厅、门廊和牌面保留。
- 6棵前景松树、12960组针叶实例，以及原场景用于反射的远处树群。Blender导入器未读取glTF自定义`_COLOR_0`时，脚本从原始accessor精确补回13716个植被实例的颜色；不以纯白或随机新颜色替代。
- 原46秒、30fps时间轴：正式范围第1–1380帧；另保留第1381帧作为46秒终点校验。共1381份源相机姿态、FOV与六组楼层位移逐帧核对。
- `Camera_Original_46s`：原动画相机；`Camera_front / entrance / rear / top`：静态检查机位。第1201帧为展开视图，第1366帧起闭合。
- 原Three.js的程序化天空作为World内可切换的参考节点保留。

## 材质与光照改变

- 浅灰小方砖和灰粉窗下板：保留原正交砖缝、原配色，在其上叠加真实矿物微纹理和粗糙度，不替换成大块抹灰墙。
- 深棕入口石材：Poly Haven扫描颗粒与OpenGL法线，独立调色到原深棕体系；原始下载不修改。
- 前庭石铺装、混凝土、草坪：2K扫描材质、真实粗糙度与法线；草地维持低饱和绿调，不额外猜改植物种类或位置。
- 玻璃：去掉浏览器为立方体反射设置的金属近似，改为Cycles光线追踪玻璃；IOR 1.52、透射0.88、粗糙度0.075，保留统一玻璃材质和实际场景反射。
- 照明：保持原太阳方向，加入CC0 `Noon Grass` HDRI用于照明/反射与柔和正面补光；补光不产生巨大白色镜面反光。相机背景使用Hosek/Wilkie大气天空，不把HDRI拍摄地点冒充校园。
- 正式静帧：Cycles / Metal GPU、128 samples、降噪、AgX；前/入口/展开为1920×1080，后/俯视为1600×1200。原相机不启用景深，便于保持结构和文字可辨识。

## 复现命令

依赖复用现有工作区Node模块（Three.js、esbuild、puppeteer-core）、Blender内置Python/NumPy。仅资产下载脚本需系统Python的requests/Pillow/NumPy，下载原文件按hash复用。

在 `projects/shunde/` 下：

```sh
# 更新源快照：先确认当前源几何和GLB导出
npm test
npm run build
npm run qa
node blender/export_source.mjs

# 如本地资产尚未准备
python3 blender/assets/acquire_cc0.py
python3 blender/assets/derive_brown_stone.py
python3 blender/assets/verify_assets.py

# 从独立、空白Blender进程创建（会更新本任务自己的输出blend）
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --disable-autoexec \
  --python-exit-code 1 --python blender/build_scene.py

# 从实际保存文件独立重开验收
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --disable-autoexec \
  blender/output/Shunde_Blender_PBR.blend \
  --python-exit-code 1 --python blender/verify_scene.py

# 真实静帧渲染，不保存/改写工程
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --disable-autoexec \
  blender/output/Shunde_Blender_PBR.blend \
  --python-exit-code 1 --python blender/render_views.py \
  -- --final front entrance rear top exploded
```

去掉`--final`可生成半分辨率24-sample预览至`qa/draft/`。不要把首轮预览当作最终渲染。`build_scene.py`会重建自己的输出；在Blender手工修改后，应先另存自己的工作文件，避免被脚本覆盖。

## 15秒360度环绕视频

- 成片：`output/orbit15/舜德楼_Blender_15秒环绕.mp4`，15秒、1280×720、24fps、360帧、H.264，无旁白、字幕或音乐。
- 可编辑环绕工程：`output/Shunde_Orbit_15s.blend`。原46秒PBR工程未改写，楼体保持闭合，只改变相机。
- 机位：完整一圈、等角速度；对全部361个采样位置（包括闭合终点）核对楼体投影留边，避免只检查四个方位造成中途裁切。
- Cycles / Metal GPU，48 samples，降噪；`output/orbit15/video-verification.json`记录完整帧序列、MP4严格解码、运动检查和文件指纹。

```sh
# 从PBR工程创建环绕工程
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --disable-autoexec \
  blender/output/Shunde_Blender_PBR.blend \
  --python-exit-code 1 --python blender/orbit15.py -- --prepare

# 从环绕工程渲染；可用 --start 1 --end 100 分批，配置指纹不匹配时拒绝复用旧帧
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --disable-autoexec \
  blender/output/Shunde_Orbit_15s.blend \
  --python-exit-code 1 --python blender/orbit15.py -- --render
python3 blender/finalize_orbit15.py
```

每个独立Blender进程都会显式启用Metal设备并回读设备列表；保存文件中的`GPU`标志不能代替进程内设备初始化。渲染代码/工程变更后应保留旧帧并使用新缓存目录，不能混合两次配置。

## 核验与边界

- 源文件SHA-256与GLB指纹在`source/scene-transfer.json`；原Three.js26项测试、完整GPU浏览器QA和GLB回读通过。
- 独立重开检查：170份源mesh数据、13884个mesh对象的网格指纹/实例数量、建筑世界包围盒、13716个植被实例颜色、相机FOV/位置/方向、六组动画和打包图像。
- 5张正式静帧已真实渲染并人工目视检查；`output/renders/render-report.json`保留实际渲染参数和用时。
- **没有重新渲染完整46秒视频**；交付的是可播放时间轴的Blender工程和正式静帧。浏览器DOM章节文字、播放控件不是3D模型，未移植为Blender HUD。
- 已知源模型近门廊左侧的深色开口、未测绘的内部和后部细节照原模型保留，没有借材质升级擅自补造结构。当前仍是照片/草图约束的建筑示意，不是测绘CAD或已经查证的真实建材清单。
- CC0覆盖本次下载的纹理/HDRI，不覆盖用户建筑照片、提取牌面字形或其他原有素材；不得将整个工程自动宣称为CC0或公开分发。
