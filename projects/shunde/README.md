# 舜德楼庭院结构重建

在原 `projects/shunde/` 中更新的照片与地图约束三维模型。重点还原北侧正门、朝中庭突出的圆体及较低的玻璃厅，保留庭院与北侧通道。旧实心楔形版本可从 Git 历史恢复，不再维护平行版本目录。

**范围说明：** 地图源是伟伦楼与舜德楼的组合轮廓，不是单栋舜德楼的测绘数据。两栋楼分界、门洞精确偏移、未见立面和楼高仍有推定部分。

## 已保留的 Blender 快照

[Blender 脚本与可编辑工程](blender/README.md) 来自旧版 `2f18075` 实心楔形模型，包含46秒原相机、CC0扫描PBR、Cycles玻璃/照明和15秒环绕工程。冻结源数据、贴图、`.blend` 与成片保留在本地并被 Git 忽略；脚本和清单进入 Git。它不是下方最新庭院几何的 Blender 重建版，二者不可混称。

## 安装与运行

需要 Node.js 22+、Python 3、Pillow、FFmpeg，以及支持 WebGL2 的本地 Chrome/Chromium。

```sh
cd projects/shunde
npm install
python3 -m pip install Pillow
npm test
npm run build
npm run dev
```

打开 http://127.0.0.1:8778/viewer.html ，可拖动旋转、缩放，选择北入口／高位／庭院视角，或下载 GLB。

在第二个终端、同一目录运行：

```sh
npm run qa       # 浏览器检查、正交俯视图、GLB 导出与重载
npm run render   # 生成三视角视频，并检查渲染输入未变化
python3 scripts/verify_glb.py  # 回读实际 GLB 文件和嵌入纹理
npm run check    # 固定版本 HyperFrames composition 检查
```

`index.html` 是唯一 HyperFrames composition，使用单一暂停时间轴和绝对时间相机。视频为 **24 秒、1920×1080、24 fps、576 帧、无声**，依次展示北侧入口、庭院整体与北口、院内圆体及玻璃厅。画面由真实 Three.js 几何经本地浏览器 GPU 渲染，再由 FFmpeg 编码，不是照片幻灯片或生成式视频。

### 可配置项

- `SHUNDE_OUTPUT`：输出目录，默认 `~/.hermes/outputs/shunde-courtyard-rebuild/delivery/`。成片、模型和检查文件不进入 Git。
- `SHUNDE_URL`：已启动的本地 `index.html` 地址，默认 `http://127.0.0.1:8778/index.html`。
- `CHROME_PATH`：Chrome 可执行文件路径；默认使用本机 Puppeteer Chrome-for-Testing 150 的 macOS 缓存路径，其他机器应覆盖。
- `SHUNDE_FONT_FILES`：用于输入指纹的实际字体文件列表，以平台路径分隔符分隔。macOS 默认值对应 CoreText 查得的 PingFang SC、Kaiti、Georgia；系统字体不随工程分发，其他机器应指定实际使用的字体文件。
- `PYTHON`：Node 回归测试调用的 Python 可执行文件，默认 `python3`。

`npm run build` 将项目与共享照明模块的 `three` / `three/addons` 解析到同一依赖实例。依赖版本在项目包中固定，根工作区也有兼容版本。

## 结构与依据

完整来源、方位与不确定性说明见 [庭院重建依据](docs/courtyard-reconstruction.md)。

| 文件 | 用途 |
|---|---|
| `docs/courtyard/source-footprint.json` | OSM way 84653293 v9 的原始 WGS84、ENU、节点与许可记录 |
| `docs/courtyard/footprint-plan.svg` | 北向平面图；同目录有 PNG 与院内拍摄方向图 |
| `src/footprint.js` | 坐标映射：x=东、y=估计高度、z=−北，保留源平面 24 个顶点 |
| `src/model.js` | 凹形楼体、开放中庭、圆体、低玻璃厅、栏架与环境 |
| `src/north-facade.js` | 复用照片参照的北立面、双柱门廊、窗排、牌匾和台阶 |
| `src/spec.js` | 照片比例参数与三段确定性相机 |
| `scripts/capture.mjs` | 浏览器验收、模型导出和视频逐帧捕获 |

- 西侧 s12–s15 保留各自的直线分段，不压成一条新斜边。圆体仅对顶点 v3–v11 插值平滑，并穿过源顶点；s11 平直接合面不纳入圆弧。
- 庭院下方不残留旧矩形或楔形体块。屋面、基础与立面共同遵守开放的凹形轮廓；北侧缺口不补无依据的连廊。
- 北门组件的 `frontZ=5` 只是旧组件局部坐标，放入新场景后朝地理北侧。保留短地面窗带、三组常规上层窗带、屋顶窄窗，而不是按合并 OSM 的 `levels=6` 统一造六层。
- 低玻璃厅沿 s11–s15 布置：**14.8 米屋面、8 米内退深度**为工作估计，玻璃覆盖范围与后方高体量分界也是推定；圆体与其余高屋面约 22 米，非测绘高度。
- 圆体照片左侧已补红褐竖片、薄挑檐、叠层小平台与浅色栏杆，下端为细柱和开敞空间；玻璃厅增加示意通园门、低门槛及接入原步道的支路。门洞同步切除玻璃背板和抬高基础，不以深色窗格冒充通道。尺寸、门数、门扇及连接点的推定边界见[细节依据](docs/courtyard-reconstruction.md#照片确认后的庭院局部细节)。
- 南侧和东侧楼翼为较低细节的组合环境。绿化、步道、石头、座椅和庭院灯为示意补全，不能视为原场地逐物测绘。

## 验证与输出

`npm test` 检查实际 Three.js 几何，包括开放庭院与北通道、源顶点、圆体法线与窄窗、玻璃朝向、独立接合面、低厅内部无中间楼板、短边封闭、北立面细节、相机和植物确定性、输入文件变化时拒绝通过，以及 GLB 共享网格资源的正确计数。旧楔形与分层动画断言已按新需求替换，不静默跳过。

`npm run qa` 导出 `Shunde-courtyard-context.glb`，用 GLTFLoader 重载，回读边界、网格、材质、纹理和实例数，并对庭院／北口做射线检查。`verify_glb.py` 另外检查真实文件的长度、嵌入图片、法线纹理切线与实例数量；区分共享网格资源数和场景中的网格对象数。

捕获脚本记录 CDP GPU 设备信息、浏览器错误、真正北向上正交俯视图和重复跳转的像素一致性。渲染前后用 SHA-256 检查源码、构建产物、平面输入、资源、共享照明与实际字体文件；发现变化即失败，不将旧成片算作新源码的结果。

标准 GLB 保存几何和 PBR 材质，并使用 `EXT_mesh_gpu_instancing` 保存植物实例，但不保存查看器的天空、灯光、阴影设置和屏幕空间 AO。需要完整画面效果时使用项目查看器。

本项目的验证不等同于根工作区所有其他项目测试通过。

## 许可

平面数据：© OpenStreetMap contributors，ODbL 1.0，详见 https://www.openstreetmap.org/copyright 。

参考网络照片及用户照片仅用于本地视觉比对，不嵌入模型立面、仓库图片资源或成片；归档的是来源链接、校验值与对应关系。既有植物和字形资源的来源记录保留在 `assets/`。
