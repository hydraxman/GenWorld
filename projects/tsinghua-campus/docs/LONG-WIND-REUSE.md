# Long Wind：参考核验与本轮落地

参考仓库：[jbang2004/long-wind](https://github.com/jbang2004/long-wind)，固定提交
`9390889b7b293c9f983dca7e1b1ef4e629274009`。
[官方演示](https://jbang2004.github.io/long-wind/)由该仓库 README 指向；已核对部署 HTML 与入口 bundle，未对上游画面或帧率作浏览器验收。下列性能建议不是上游与本项目的跑分对比。

## 核实结论

Long Wind 是完整第三人称游戏，不是默认仅使用程序人物的模型演示。角色先建立程序身体，再默认加载 Tripo GLB 外观；`?skin=0` 才保留程序身体。动画注册表还涉及 Mixamo 与参考视频姿态，不能因为仓库源码是 MIT 就整体移植。

古镇也不是可直接复用的楼内漫游系统：街区被圆形碰撞体封住，“door”分支在完整墙上加门板，角色每帧落在单一地表高度上。这与本项目真实门洞、叠置楼层、有界室内的要求不同。

| 可借鉴项 | 上游实际做法 | 本轮在 GenWorld 的落实 |
|---|---|---|
| 材质与 UV | 颜色、normal、ARM 分离；纹理缓存与米制 UV | 复用本仓库 Courtyard PBR 生成器，增加原创木纹；木材每 2.4×1.2m、石材每 1.2×1.2m 重复。保留材质身份和学习热力颜色，按几何尺寸缓存 UV 副本，不改共享 unit box。 |
| 输入 | 键鼠／触摸归一为移动、环视、动作状态 | 继续共用键盘／屏幕按钮；平滑加速和减速，解析积分使不同帧率下位移一致；失焦、打开展项、退出时清空输入。 |
| 进入与相机 | 上游有相机阻尼，但无适配本项目的室内系统 | 新增源坐标入口终点，沿原真实门洞完成短入楼过渡；移动或拖动随时接管。减少动态偏好保留手动行走，不自动推进；不增加头部摇晃。 |
| 近身交互 | 动作与相机状态分开 | 靠近并面向展台时显示桌边提示与 F／触屏互动按钮；展开实验暂停移动，收起恢复原访客位置。原名称按钮继续可用。 |
| 画质预算与释放 | 分档、降级冷却、静态与角色阴影分开 | 不照搬全游戏后期。每个教学宿主缓存两套共六张共享程序图，宿主关闭时释放；舜德内衬、导览、桌台只在进入时建立，退出释放临时几何和材质。 |

塔楼真实接缝也在本轮修复：原玻璃底比楼板高 0.1m，檐口顶比下一楼板低 0.25m。围护改用同一层高／楼板基准，檐口与顶盖接合；保留正面教学剖开、中央中庭及主动分层展开。

## 不能直接搬的部分

上游锁定 Three.js **0.186.0**，本项目保留 **0.181.2**。其自定义 HDR／TAA／SSAO／Bloom 管线和全局 `ShaderChunk`、`Material.prototype`、矩阵原型修改不能直接放进共享 Three 实例，未经验证也不能声称能提高本项目性能。

上游完整应用没有适合本项目的卸载契约；章节转换依赖页面重新加载，输入的匿名监听和资源缓存也需要单独审查。不能用上游 stub 掉碰撞的玩法测试替代本地真实门洞检查。

本轮**没有复制 Long Wind 的源码、角色、动画、照片或纹理文件**，只参考经过核实的技术思路，并用现有代码和原创程序材质实现。没有新增渲染器、物理引擎或联网素材依赖。

## 授权边界

| 内容 | 核实范围 | 处理 |
|---|---|---|
| 源码 | MIT，`Copyright (c) 2026 jbang2004`；第三方资产排除在外 | 将来复制／实质改编时，必须附完整版权与 MIT 通知、源路径及固定提交；本轮不复制。 |
| Poly Haven 纹理／石头模型 | 资产 CC0；原站 weathered_planks、japanese_stone_wall、ceramic_roof_01 已逐项核对 | 可作为后续候选，但古镇风化材质不是清华建筑照片证据；不下载整包。 |
| 七个 Tripo 角色 GLB | 仓库明确排除 MIT，并要求勿单独提取或再分发 | 不复制。生成工具元数据不证明作者方案或额外再许可权。 |
| `mixamo.glb` | 明确受 Adobe Mixamo 条款约束，排除 MIT | 不复制上游动画包。 |
| `mocap/jian-demo.js` | 参考视频提取姿态；具体视频许可链未明确 | 不迁入。 |
| 字体 | 仓库说明 OFL，页面从 Google Fonts 联网加载 | 不继承联网依赖；若后续自托管需固定字体和许可。 |

Tripo 条款页与 Adobe FAQ 在此次核验中返回 403；没有因此推断额外权限。上游许可也不自动覆盖 Poly Haven 网站的 Logo 或示例渲染。

## 固定来源

- [入口](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/main.js#L6-L15)、[默认外观](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/character/character.js#L471-L483)、[动画依赖](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/character/clips/index.js#L3-L35)。
- [材质通道与缓存](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/core/assets.js#L12-L64)、[几何／米制 UV](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/world/town-geo.js#L39-L80)。
- [输入](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/game/input.js#L134-L246)、[相机遮挡恢复](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/game/camera.js#L388-L429)、[阻尼](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/game/util.js#L14-L22)。
- [街区碰撞](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/world/town.js#L50-L63)、[门与完整墙](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/world/town-arch.js#L288-L332)、[地表约束](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/game/actor.js#L184-L193)。
- [渲染管线](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/core/pipeline.js#L27-L64)、[画质](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/core/quality.js#L10-L40)、[应用生命周期](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/core/app.js#L67-L167)。
- [全局 shader 修改](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/core/chunks.js#L136-L157)、[矩阵原型修改](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/src/core/matrixFix.js#L12-L21)、[Three 版本](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/package-lock.json#L750-L754)。
- [LICENSE](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/LICENSE#L3-L26)、[第三方声明](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/CREDITS.md#L4-L48)、[资产 manifest](https://github.com/jbang2004/long-wind/blob/9390889b7b293c9f983dca7e1b1ef4e629274009/public/assets/ph/manifest.json#L3-L124)。
- [Poly Haven 许可](https://polyhaven.com/license)、[木板](https://polyhaven.com/a/weathered_planks)、[石墙](https://polyhaven.com/a/japanese_stone_wall)、[屋瓦](https://polyhaven.com/a/ceramic_roof_01)。

## 仍有的边界

楼内陈设的教学用途和非实测性质保存在源元数据，按用户要求不以免责声明占用场景画面；校园仍只支持舜德／建华有限门厅。知识大厦仍以整楼、分层和单层展厅浏览为主，本轮未增加 16 层自由行走、第三人称角色或楼梯寻路。图、链表、马尔可夫三个实验的确定性状态和原有题目保持共用。
