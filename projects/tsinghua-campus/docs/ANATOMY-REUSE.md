# Anatomy：室内与展台打磨

来源：[wheresryan22/anatomy](https://github.com/wheresryan22/anatomy)，固定提交 [`1482e8469b0a9e0d8cc18ea2740a01423d29ae80`](https://github.com/wheresryan22/anatomy/tree/1482e8469b0a9e0d8cc18ea2740a01423d29ae80)，MIT，Copyright (c) 2026 Ryan。

## 采用与复用

- `kit/turn.mjs` 的 `T3_MATERIALS`：直接复用 gold、steel、gunmetal、rubber 中选定的颜色，集中在 `shared/knowledge-labs/anatomy-finishes.js`，保留完整 MIT 声明并随构建内嵌。金属度、粗糙度、照明和几何是本项目的 Three.js 实现，不把 SVG 色阶当作实测 PBR。
- `references/craft.md` 的支承、底座、凹槽、倒角及铭牌层次：展台采用圆角石台面、金属收边、承托底座和固定平面铭牌；荷塘增加盆沿与有厚度的荷叶，链表区分值与指针区。不是把原示例图贴到三维展台上。
- `references/walkthrough.md` 的“一个真实状态驱动所有读数”：继续共用 `experiments.js` 的算法状态；未展开时只保留必要节点标识，展开后显示完整权重、概率和指针说明。没有为了画面好看改动概率、路径或题目答案。
- `references/3d.md` 的局部明暗层次：墙体木格栅、石地拼缝和吸音顶板使用真实几何；独立 AO 通道表达固定支座接触，三个无投影面光源表达顶光及地面反射补光。原有太阳、天空和相机外观设置不被覆盖。

## 不迁移的部分

Anatomy 是 SVG／WebGL 技术图解工具，其 `turn` 系统主要处理图形投影、绘制顺序和部件转动，不是可进入建筑的 Three.js 室内引擎。不迁入第二套渲染器、CSS 色阶阴影、整页界面、示例资产或无关的波动水槽物理模型。保持 Three.js r181、现有碰撞、知识状态、导出与离线入口。

## 范围与验收

舜德门厅和建华北门中庭的饰面只在漫游时挂接；建华保留高空间和开放侧面，不复制舜德低顶。退出移除饰面与局部灯光，原校园建筑树、650个身份和单栋GLB保持不变。两套木／石PBR由宿主缓存；每个门厅独立的128px AO和铭牌随室内实例释放，Three.js面光源查找表只初始化一次。

`interior-check.mjs` 留存同机位的进门、斜视、三种照明及三个展台近景，覆盖桌面、手机和离线。`interior-finishes.test.mjs` 检查实际门洞净空、预算、材质通道和资源释放；共用实验回归继续检查三种算法、九道题、实际拾取、减少动态偏好与重复进出。
