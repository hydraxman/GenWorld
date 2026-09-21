---
name: campus-map-video
description: Use when making narrated campus map videos.
version: 0.1.0
author: Bryan Nathan (hydraxman), Hermes Agent
license: MIT
platforms: [macos, linux, windows]
metadata:
  hermes:
    tags: [maps, campus, narration, video, verification]
    related_skills: []
---

# 校园地图导览视频

将已核实的校园路线、照片和旁白制作成可恢复捕获、可验收的视频。此流程直接使用项目工具，不要求路由 skill、GPU 云服务或 HyperFrames；MIT 声明仅针对本 skill 文本，不重授权视频中的第三方素材。

## 何时使用

- 制作校园多站导览、地球到校园聚焦，或在普通 / 卫星底图之间切换。
- 在保留原旁白、路线和照片的前提下重做画面，或单独制作重配音版本。
- 不用于证明实时通行、卫星实时状态或高精度建筑外观。

## 前置条件

使用 `read_file` 读取项目 `README.md`、`docs/PRODUCTION.md`、`docs/VOICEOVER.md` 和 `docs/SOURCES.md`。本例工作目录为仓库相对路径 `projects/tsinghua-tour`；移植时先通过 `search_files` 找到目标项目，不写死机器路径。

需要 Python、Node/npm、FFmpeg/ffprobe，以及可运行 WebGL 的 Chrome、Edge 或 Chromium。浏览器可通过环境变量 `CHROME_PATH` 指定。跨平台 CLI 设计支持 macOS / Linux / Windows，但本项目实际只在 macOS 制作测试；其他平台需验证浏览器和字体，Windows 按环境使用 `python` 或 `python3`。

安装与地图捕获需要联网，在线瓦片、glyphs、sprite 并未因保存 `campus.osm` 而自动离线化。默认复用已有配音；仅用户要求重新合成时使用 `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`，凭据不落库。

## 通过 terminal 运行

以下调用以仓库根目录为起点，使用 `terminal` 工具；若工具当前目录不同，先定位仓库，再设置相对项目工作目录。

```python
terminal(command="npm ci", workdir="projects/tsinghua-tour", timeout=600)
terminal(command="python3 -m pip install -r requirements.txt", workdir="projects/tsinghua-tour", timeout=600)
terminal(command="npm run preview -- --basemap satellite", workdir="projects/tsinghua-tour", timeout=600)
terminal(command="npm run capture -- --basemap satellite", workdir="projects/tsinghua-tour", background=True, notify=True, timeout=3600)
```

捕获完成且帧缓存检查通过后，再单独调用：

```python
terminal(command="python3 tools/export.py --basemap satellite", workdir="projects/tsinghua-tour", background=True, notify=True, timeout=1800)
```

长任务用进程管理工具查询状态；超时后先确认旧进程已退出，禁止重复启动。`--basemap standard` 切换 OpenFreeMap 普通矢量地图；默认 `satellite` 是 EOxCloudless 2025 约 10 米影像加 OSM 道路 / 楼块辅助，最终版不是 Esri。两模式都用星空，分别输出到 `output/standard/` 与 `output/satellite/`；预览、捕获、导出三步的模式必须一致。

浏览器检查通过 `terminal(command="npm run serve -- --basemap standard", workdir="projects/tsinghua-tour", background=True)` 启动，再打开其打印的本地地址；同页 `?basemap=standard` 选择普通模式，在控制台用 `window.setTime(30)` 检查指定时刻。检查页不自动播放旁白。分段捕获支持 `--from N --to N --out 路径`，起点包含、终点不包含，输出到本模式的独立目录。

## 制作步骤

1. **核实来源与坐标。** 区分原始景点、建筑和路上停留点，保留 WGS84 `[经度, 纬度]`、OSM 引用与吸附距离。用路网检查每段连续性和通行限制，不画穿楼直线；保存每站照片来源与许可。完成条件：所有请求站点均有对应记录，未核实项明确列出，不宣称全局最短或实时可通行。
2. **冻结素材和语音。** 按清单核对照片、水印、字体、文本与独立 WAV，测真实时长再排时槽。清华基线为 12 站 / 12 照片 / 15 段晓晓 / 34 字对联；保留原预约与食堂提醒。只改画面就复制原 AAC。完成条件：输入版本可追溯，素材无缺项；重配音使用新目录并重建时槽与对联字边界，不套旧时序。
3. **建立绝对时间镜头。** 由目标帧确定镜头、路线进度、照片与字显隐，不累加运行时间。清华保留前快后慢 17 秒聚焦，Python / JS 共用 409 项 `intro-remap.json`，音轨不重映射、不加速。完成条件：随机跳帧可复现，聚焦衔接、上下联交接与首末帧经过实际预览。
4. **串行捕获并保留恢复点。** 等待地图、瓦片、字体和照片就绪，保存失败证据与完成范围；一个浏览器任务完成后再启动下一个。重复姿态只在页面、素材、样式、时序、视口和映射指纹一致时复用。完成条件：当前模式的完整帧序列可解码；中断恢复前确认旧进程退出，异模式或旧指纹缓存不混用。
5. **导出母片和聊天编码。** 完整冻结画面后用 FFmpeg 导出，短 GOP 母片 / 中间片便于预览，例如 24 fps 时 `-g 24 -keyint_min 24`。聊天版另存，可两遍码率分配；不删内容、降尺寸或加速声音，保留原版。完成条件：产物路径明确、满足目标渠道限制，画面改版的 AAC 比特流与批准版相同。
6. **逐段与逐帧验收。** 用本次产物检查格式、严格解码、帧数与时长；抽取实际编码后的首帧、每站、所有段落边界、对联字边界、片尾与最后一帧。逐段比较全部源 WAV 与最终音轨对应波形，并听完每段。完成条件：数量按程序去重核对、无漏项，自动与人工结果分别记录；旧证据不充当新测试。
7. **投递并回读。** 获得用户授权后发送明确的已验证聊天文件；保存母片，记录目标消息和附件。回读该消息并下载实际附件比对哈希，才报告送达验证。完成条件：回读匹配同一文件；若工具不足则明确只完成本地交付，不伪造发送结果，账户与会话标识不写入仓库。

仅将互不依赖的资料收集、来源核查与独立 review 并行分派。素材冻结、时序、捕获、导出按依赖串行，不开多个浏览器抢捕获；没有授权不覆盖原版、不 commit/push、不公开发布。

## 常见误区

- 卫星近景中的楼块是 OSM 辅助，不是 10 米影像中恢复出的高清屋顶；星空是装饰，不是实时星图。
- 普通底图和背景颜色是独立选择，不能把历史白底当成 `standard` 的必要条件。
- Python 与 JavaScript 的半帧舍入可能不同，不能两边重算映射后放宽验收掩盖差异。
- 重配音会改变时长与词边界，即使 SSML 相同也不能沿用原字时序或原成片帧数。
- 私有仓库整理素材不产生第三方公开 / 商用授权；保留各自来源与许可，不给整部视频套用 skill 的 MIT。

## 验证入口

通过 `terminal` 执行并保存真实输出：

```python
terminal(command="npm test", workdir="projects/tsinghua-tour", timeout=600)
terminal(command="python3 -m unittest discover -s tests -v", workdir="projects/tsinghua-tour", timeout=600)
terminal(command="python3 tools/verify.py --video final/tsinghua-v5-satellite-stars.mp4", workdir="projects/tsinghua-tour", timeout=600)
```

新导出必须将 `--video` 改成实际产物路径。批准版基线是 1280×720 / 24 fps / 8525 帧 / 355.208333 秒；改时序的版本另测。最终短报列出交付文件、实测结果、继承证据与未验收项，不因工具退出成功就省略实际帧、全部语音或投递回读。
