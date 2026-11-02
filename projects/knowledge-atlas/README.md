# 知序 · 知识体系可视化

基于同一份人工整理数据，展示 24 个知识点、30 条先修关系、5 条跨域关联和三个项目。

- `index.html?view=cosmos|city|metro|radial|river|lab`：3D 星团、3D 知识城、学习地铁、径向轮、跨域知识流和机制实验台。
- `knowledge-prototype.html?variant=A|B|C`：知识图谱、目标学习路线和项目能力矩阵。
- `sources.html`：教学材料书目、引用边界和八篇论文的作者公开入口。

通过根目录 `npm run build:pages` 集成到 `output/pages/scenes/knowledge-atlas/`，从 GenWorld 首页导航进入。也可以直接用静态服务器打开本目录，不需安装单独依赖。`npm run test:pages` 检查发布白名单、数据和链接；构建后 `PAGES_SCENE=knowledge-atlas npm run qa:pages` 检查九种展示的桌面、手机交互（Windows PowerShell 使用 `$env:PAGES_SCENE='knowledge-atlas'; npm run qa:pages`）。

## 公开发布边界

仅包含交互代码、人工概念整理、书目及原创 SVG 示意图。不包含教学 PDF、课程整理稿、报告截图、录音视频、下载的论文或本地研究笔记。材料链接进入书目锚点，不制造不存在的原文下载链接。论文链接指向作者、大学、实验室或 arXiv；不重新分发全文或插图。

知识分类、先修、路线和评价问题是整理建议，不是官方课程或实测能力。报告记载、教学推演和未来目标明确区分。空间距离、建筑高度、流量计数与理想串行模型不表示熟练度、人数、学习时间或实际系统性能。没有学生日志，不推断掌握度；自查、选择和参数仅在页面内存中保存。

3D 由 Canvas 的 XYZ 旋转和透视投影实现，无 WebGL 或第三方渲染依赖；支持拖动、缩放、键盘替代及减少运动设置。所有页面资源来自本站，无账号、数据上传、分析追踪或第三方 CDN。
