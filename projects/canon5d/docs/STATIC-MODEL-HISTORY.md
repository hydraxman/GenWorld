# 佳能 EOS 5D Mark IV 风格：单反相机剖视模型

## 怎么看

- `canon5d-exterior.png`：完整外观，2100 × 1575。
- `canon5d-cutaway.png`：剖视与分层结构，2100 × 1400。
- `canon5d-cutaway-labelled.jpg`：中文编号说明图。
- `canon5d-cutaway.blend`：Blender 5.2.1 制作的可编辑工程。

打开 `.blend`，选择 `Canon5D_Educational_Cutaway` 场景：

1. 时间轴设为 **1**：完整机身和镜头外壳。
2. 时间轴设为 **90**：外壳剖开，顶盖、快门、CMOS、主板和后壳分层展开。
3. 中键旋转、滚轮缩放，数字键盘 0 切换相机视图。键盘没有数字键盘时可从「视图 → 相机 → 活动相机」切换。
4. 右上 Outliner 按 8 个 `CC_` 集合分类，可单独隐藏外壳、镜片组、反光镜箱、取景器、成像组件、电路、摄影棚和光路。隐藏仅影响查看；渲染请同时设置相应相机图标。
5. `CC_Exterior` 和 `CC_Cutaway` 为两台成品构图相机。请勿把场景中的相机对象与建模出来的相机混淆。

为了没有原生程序驱动或事件处理器，模型只使用普通关键帧和可见性属性。文件里关闭了 Blender MCP 随文件自动开启。新工程没有覆盖原先的 Red Cube 文件。

## 结构和准确性边界

真实建立了外壳、镜片/光圈示意、主反光镜、辅助对焦结构、对焦屏、五棱镜、目镜、快门、36:24 比例 CMOS、主板、卡槽和电池等几何物体。使用原生 Blender MCP 建模与 Cycles 渲染，不是将相机照片贴在平面上。

这是**受 EOS 5D Mark IV 外观启发的风格化教学模型**，不是佳能官方 CAD 或尺寸准确的逆向复刻。外形被简化，标志文字也不是原厂商标矢量。机身尺寸参考官方资料；镜头是通用 EF 风格示意，不声称对应某支具体镜头的镜片数量/曲率。芯片布置、排线、棱镜内光线路径和分层距离均作了教学简化，不能作为维修或制造依据。

蓝线表示取景状态：镜头 → 主反光镜 → 对焦屏 → 五棱镜 → 目镜。取景时主反光镜与关闭的快门阻挡光线到达 CMOS；实际拍照时反光镜抬起、快门开启，再使光线到达传感器。这里的展开动画不是工作时序仿真。

## 参考照片 / 资料

1. 佳能官方外观照片（前、后、顶部、侧面）：
   https://snapshot.canon-asia.com/article/eng/eos-5d-mark-iv-a-review-in-pictures-1-exterior-design
2. Lensrentals EOS 5D Mark IV 拆机照片：
   https://www.lensrentals.com/blog/2016/09/lensrentals-canon-5d-mk-iv-teardown/
3. 佳能相机博物馆规格：
   https://global.canon/en/c-museum/product/dslr849.html

照片仅作为外形和相对布局研究参考，没有把第三方照片当作本模型渲染图交付。品牌归其权利人所有。

制作：2026-09-08。最终工程以 `.blend` 为准；目录里的 `build_camera.py` 保留初始生成过程，不包含后续所有视觉修正。
