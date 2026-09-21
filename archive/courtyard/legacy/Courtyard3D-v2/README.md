# 庭院建筑 · V2 模型与视频

本版按用户意见改为**深砖红主楼、统一灰蓝窗玻璃、浅蓝绿色水面和连续校园绿地**。镜头路径、推进速度、顺序和总时长保持 V1 不变。

这是两张照片参考的外观近似模型，非测绘或施工模型。背面、部分屋顶、外围校园绿地和路网为合理补全；水面为本次指定的视觉修改。

## 交付内容

- `Courtyard3D-v2.glb`：含纹理、植被和水面的新版三维模型。
- `viewer.html`：可旋转、缩放和切换五个视角的查看器。
- `index.html`：36 秒视频的 HyperFrames 入口。
- `src/`：完整参数化建模、校园环境、水面、镜头与渲染源码。
- `assets/scene.js` 与 `assets/gsap.min.js`：预编译脚本，查看时无需联网。
- `assets/reference-*.jpg`：用户提供的建模参考照片。
- `MODEL_NOTES.md`：修改说明与还原边界。

## 本地查看（无需 npm 安装）

解压后在本目录运行：

```bash
python3 -m http.server 8768 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8768/viewer.html`。

左键拖动旋转，滚轮缩放，右键拖动平移。请使用本地服务器，不要直接双击 HTML。

GLB 植被依赖 `EXT_mesh_gpu_instancing`；选择支持该扩展的 glTF 查看器。已用 Three.js GLTFLoader 实际重新加载验证。

## 修改和重新渲染

需要 Node.js 22+、FFmpeg，以及 Chromium：

```bash
npm ci
npm test
npm run build
npm run check
npm run render
```

HyperFrames 固定 0.8.24，Three.js 固定 0.181.2。必要时用 `CHROME_PATH` 指定本机 Chromium 可执行文件。`npm run render` 输出 `output/Courtyard3D.mp4`。

镜头：0–8 秒正面推进；8–15 秒斜侧环绕；15–22 秒廊下穿行；22–28 秒立面横移；28–36 秒庭院俯瞰。成片无音乐、口播和字幕。

V1 原工程及视频保留，本包不覆盖旧版。
