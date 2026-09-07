# 两栋楼共用工作目录

工程根为桌面 `Courtyard3D-v6`，不以 `.hermes/artifacts` 为项目入口。根目录原 `src/`、`index.html` 和既有视频保留。

## 目录

- `shared/`：两楼共用叶片轮廓和CC0纹理、PBR、光照、环境及局部场景玻璃反射；契约见 `shared/API.md`。
- `projects/courtyard/`：旧楼反射更新版，原建筑几何及相机保持一致。
- `projects/shunde/`：舜德楼独立项目，模型及视频已完成；`references/analysis.md` 记录照片证据和缺失视角。

## 旧楼更新版

在本工程根运行：

```sh
npm --prefix projects/courtyard run build
node --test shared/*.test.js projects/courtyard/src/*.test.js projects/shunde/src/*.test.js
python3 -m http.server 8773 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8773/projects/courtyard/index.html`。

完整反射A/B、非顺序seek与GLB导出验证（服务器先启动）：

```sh
cd projects/courtyard
node qa-glass.mjs --export
```

可用 `QA_URL` 覆盖页面地址、`CHROME_PATH` 指定Chrome路径。测试/截图报告在 `projects/courtyard/qa/glass/`。

## 状态与边界

- 已在桌面工程根合跑33项测试通过；两楼均成功构建，并通过HyperFrames严格浏览器检查。
- 旧楼46秒、1920×1080、30fps反射更新视频已渲染完成，1380帧；母版和飞书版完整解码通过，抽帧检查通过。
- 母版：`projects/courtyard/output/Courtyard-reflections-46s.mp4`；飞书版：`projects/courtyard/output/Courtyard-reflections-46s-feishu.mp4`（19,679,028字节，同分辨率）。
- 飞书版已发送当前请求者私聊，消息回读成功，回执 `projects/courtyard/output/feishu-video-receipt.json`；原生视频仅验证消息存在，未下载远端视频逐字节比对。
- 舜德楼母版 `projects/shunde/output/Shunde3D.mp4`、飞书版 `projects/shunde/output/Shunde3D-feishu.mp4` 已完成；46秒、1920×1080、30fps、1380帧，均完整解码通过。飞书版已发送请求者私聊并回读消息，回执在同目录 `feishu-video-receipt.json`。
- 舜德楼模型 `projects/shunde/output/Shunde3D.glb`；通过上述8773服务可访问 `/projects/shunde/viewer.html` 交互查看。
- 玻璃使用局部CubeCamera采集真实场景，但单探针有视差近似；GLB仅保留PBR fallback，不包含动态反射渲染管线。
- 舜德楼米制尺寸、隐藏立面、圆弧体量与主立面的接合、室内布局没有测绘依据，不宣称实测。公开参考图未发现开放许可，不作为可自由再分发贴图。
