# 云光凝徽组合样片

独立试验入口，原五版不变。视觉比较、推荐组合和时间线见 [PROPOSAL.md](PROPOSAL.md)。

[舜德楼俯冲试验](../shunde-dive/README.md) 通过 `startSkyFusion({createBackground})` 复用本徽章引擎；本项目入口 `scripts/entry.js` 不传背景扩展，保持纯天空动作、画面与交付不变。

当前预览为2026年份的4秒快版，1920×1080、30fps：原8秒画面整体以2倍速度走完，保留全部特效而非截掉后半段。内层书本/电路、中层文字环、外层编织边框独立错向旋转与错时归位；1.45–1.755秒左右书页绕固定书脊快速翻合，无分离平移。

已导出 [2026 · 4秒柔和收尾版 MP4](output/kaiwu-sky-fusion-2026-4s-soft-ending.mp4)，约8.6MB，并复制到 OneDrive 的 `清华\开悟-2026-4秒徽章动画\清华MEM-开悟徽章-2026-4秒-柔和收尾.mp4`。年份只修改末位“3”为真正的镂空“6”，保留原“202”、位置、厚度与金属材质；四秒编排和配乐不变。

经用户同意，已导出 [4秒快版 MP4](output/kaiwu-sky-fusion-4s.mp4)：120帧、H.264视频、48kHz AAC立体声，约8.6MB。原 [8秒首版 MP4](output/kaiwu-sky-fusion.mp4) 保留不覆盖。

书页及三层归位后，2.225–3.255秒由光粒子依次勾画“清、工、開、悟”的原始轮廓，再进行金属扫光。3.475–3.65秒柔和过渡到均衡补光，压低左侧强反射，保留细倒角和紫色平面金属质感。

音乐收尾修订：不再截掉结束和弦，而是将原8秒完整乐句以2倍速保音高压入4秒。最后和弦在3.275秒落下，之后不再起新音，余音按100%→80%→40%→8%→0渐弱，3.98秒到达静音。相比上一版的60毫秒硬收尾，现在留有约0.7秒渐进收束，描字音符与扫光提示音恢复同步。之前导出的 [2023年份柔和收尾版 MP4](output/kaiwu-sky-fusion-4s-soft-ending.mp4) 也保留，不覆盖历史文件。

## 生成与查看

在仓库根先安装已有工具依赖 `npm ci`，然后：

```powershell
npm --prefix kaiwu-logo\studies\sky-fusion run build
npm --prefix kaiwu-logo\studies\sky-fusion run music
npm --prefix kaiwu-logo\studies\sky-fusion test
npm --prefix kaiwu-logo\studies\sky-fusion run proof
python kaiwu-logo\studies\sky-fusion\scripts\contact-sheet.py
python kaiwu-logo\studies\sky-fusion\scripts\contact-sheet.py --book
python kaiwu-logo\studies\sky-fusion\scripts\contact-sheet.py --glyphs
python kaiwu-logo\studies\sky-fusion\scripts\check-hold-lighting.py
```

需要 Node.js 22+、Python 3、FFmpeg、Chrome/Edge；联系表脚本另需 Pillow。`CHROME_PATH` 可覆盖本地浏览器自动发现。

在本目录：

```powershell
npm run check
npm run preview
npm run render
```

`index.html` 为单暂停时间轴、4秒、1080p30的HyperFrames项目；音乐由框架播放与混音。`output/kaiwu-sky-fusion-2026-4s-soft-ending.mp4` 为当前渲染目标，`output/sample-contact.jpg` 为实际GPU画面联系表。导出后运行 `python scripts/check-music-ending.py` 检查实际编码音频的完整乐句、保音高速度与递减尾音；`--video` 可指定其他导出文件。`npm run study` 可重新捕获原五版对照，随后用 `python scripts/contact-sheet.py --study` 生成对照表。

## 实现与来源

- 复用 `latest/tsinghua-mem-five-effects-cloud` 的原始语义几何、选择性倒角、真实天空和前景薄云；仅通过 `scripts/year-2026.js` 替换年份末位轮廓，并增加“6”的实体内岛，不修改原素材。修订后68个多边形、157个孔洞；原始素材仍是67个多边形、157个孔洞。构建后浏览器脚本自包含，不请求外网。
- 使用03粒子成形的视觉思路，针对亮底重新实现共用到达场的实体显形与表面采样粒子；不是把03的暗底片段贴在云上。
- 三层分别翻转／反向旋转／正向旋转，粒子挂在各自层内同步运动；1.8、2.025、2.2秒依次归位，之后描字、扫光。
- 左右书页在内层节点内绕同一固定书脊翻约59°再展平，无任何平移偏移；0.305秒内完成，电路纹样不参与翻页，1.755秒书页恢复精确原姿态。
- 四字光粒子直接采样原稿的22条闭合轮廓（含镂空中的实体小岛），每条单独行进、不跨笔画连线；书页归位前不发光，描边结束才扫光。单元测试核对每个采样点到真实源轮廓的距离，浏览器验收检查实际发光画面。
- 正面没有扰动法线或粗糙度贴图；3D厚度、轮廓细倒角、镂空仍在。一次斜向珠光宽带为艺术化光泽。
- `scripts/music.py` 只用Python标准库生成固定种子的8秒立体声源素材。`assets/music-provenance.json` 记录源素材的来源与原时间点；4秒编排的2倍速和渐弱音量包络由 `index.html` 声明，WAV可重建、不进入Git。
- `scripts/scene.js` 将4秒合成时间映射到原8秒动作时钟，统一驱动旋转、书页、粒子、描字、扫光、云层及打光。`scripts/capture.mjs` 检查4秒根节点/时间轴/音轨、实际最后一帧全部动作完成、音乐保留完整结束和弦且逐渐静音，并核对浏览器错误、语义几何、真实节点变换及非顺序seek。新截图以 `study-2026-4s-` 命名，旧截图不覆盖；年份单元测试确保仅改末位轮廓，浏览器射线检查“6”的真实镂空与内岛。
- 书脊验收比较左右页在三个轴向点的世界坐标，要求始终重合、页面无平移。非顺序seek要求相机和每个场景节点矩阵完全一致；截图仅容许最多64个像素出现每通道1/255的量化差异（本机ANGLE/MSAA在不改变时间的连续绘制中也观察到此差异），实际差异写入 `output/proof.json`，不声称PNG字节恒等。
- `scripts/check-hold-lighting.py` 按原书页轮廓排除镂空、倒角和背景，在最终停留的实际画面中测量左右镜像实体区域的线性亮度；左右平均相对差异应小于12%，同时避免压成黑色。指标不是镂空文字的WCAG对比度，文字仍需看实图。
- 原素材许可与来源见 `../../latest/tsinghua-mem-five-effects-cloud/references.json`；品牌原稿不因本样片自动授权再分发。

生成bundle、音频、截图和视频留在本地；源码、提案与合成参数进入版本控制。
