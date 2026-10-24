# 开卷见天地 · 清华 MEM 徽章动画样片

## 交付
- `deliverables/Tsinghua-MEM-Open-World-12s.mp4` — 1920×1080，30fps，360帧，12秒，无音轨。
- `deliverables/Tsinghua-MEM-Open-World.html` — 自包含离线播放器；直接浏览器打开，点击播放或拖动进度条。Three.js、GSAP、几何全部内嵌，无外部网络请求。
- `qa/encoded-contact-sheet.jpg` — 从正式MP4解码抽取的7关键帧。
- `qa/contact-sheet.jpg` — 最终冻结前7帧原型审查图。

## 验证
- `qa/hyperframes-check.log`：实际HyperFrames check通过；lint/runtime/layout/motion零错误与警告，6个时间采样。
- `qa/final-verification.json`：360帧完整且唯一，ffprobe规格正确、整片decode无错误；源与bundle冻结哈希未改变。
- `qa/render-input-freeze.json`：21个源、供应商依赖、几何、bundle及离线HTML的SHA256冻结清单。
- `qa/source-topology-verification.json`：源SVG确为53 paths，原始闭孔164；semantic-geometry.json与旧项目逐字节一致。语义切割会把部分闭孔变成边缘连通开口，因此各拆件闭孔数不等于原闭孔数。
- `qa/prototype/qa.json`：乱序repeat seek逐像素一致；最终左右书页、环带和外圈归位误差0，镜头正面，金属光源恰好绕行一周。
- `qa/offline-verification.json`：file://离线打开成功，零外部请求、零浏览器错误，重载页面后的最终3D层像素一致。
- 尾段11s→11.966s左背景区域像素平均绝对差12.868/255；徽章姿态保持而星云持续流动。

## 实现与边界
真实挤出几何、两侧对向书页铰链、紫色珐琅PBR表面、抛光侧壁、环境反射及实体灯光扫光；原镂空文字未重绘。三层程序化星云噪声、连续云幕分离、开场空间放大平移、远景翻卷光幕；交错光流在5–8秒变为清晰定向折线路径。流星只在左右外围快速穿行。

星云是GPU程序化分层体积感视觉，不是离线体积路径追踪。前半段采用暗色轮廓光，书页在开至正面后更清晰。为保持源标志轮廓及细字孔，切边严格克制；正面停驻以紫珐琅观感为主，并保留左上局部金属反光。

正式制作只使用一条渲染路径：Chrome150 Metal逐帧确定性PNG → FFmpeg H.264；未使用录屏，也未跑第二条正式HF渲染。

## 可复现
源已冻结，交付后不再修改。`scripts/build.py`为最终构建入口，`scripts/render.mjs`按冻结清单渲染，`scripts/verify.py`核验输出。`scripts/setup.py`仅保留首次派生过程记录，不应再次运行覆盖当前成片源。

MP4 SHA256：`3be6296f9d33b1d7b2b4579d7b389d3b136fc39b43cc3aeccb5bc6e70234835e`

## 制作经验
- 云幕分离不能使用离散sign(x)映射，否则画面中心出现硬竖缝；使用带宽足够的连续softsign流场。
- 平面珐琅不宜靠全场强正面反射提亮；弱宽卡确保可读，窄条环境反射加局部固定灯点负责金属辨识。
- 几何的原始闭孔数与语义拆件闭孔数需分开报告，源保真以原始拓扑计数及字节一致证明为准。
