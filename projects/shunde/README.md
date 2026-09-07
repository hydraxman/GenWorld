# 清华大学舜德楼 · 独立 Three.js 重建

**已建模、已运行、已导出回读，不是照片平面或脚手架。** 本项目只写入 `projects/shunde/`；复用 `../../shared/` 渲染能力，旧楼源码与 shared 均未修改。

## 入口与命令

从 `/Users/bryannathan/Desktop/Courtyard3D-v6/projects/shunde` 执行：

```bash
npm test
npm run build
npm run dev
```

- 影片入口：`http://127.0.0.1:8774/index.html`
- 可旋转模型：`http://127.0.0.1:8774/viewer.html`
- HyperFrames composition id：`shunde`，46 秒、1920×1080；交付渲染使用 30 fps。
- `npm run build` 实际使用根目录 esbuild / Three.js 0.181.2，统一解析 Three.js，复制共享叶片至本项目 assets。已生成本地 `assets/scene.js`，浏览器运行不访问 CDN。
- `node scripts/qa.mjs`：自动启动局域 loopback 临时服务、GPU 浏览器、截图、GLB 导出/回读及交互验证；需要 Chrome，可通过 `CHROME_PATH` 指定。默认使用本机已安装的 Puppeteer Chrome for Testing 路径。
- `python3 scripts/verify_glb.py`：从磁盘回读 GLB；需要 Pillow。

最终渲染已完成并发送请求者私聊。复现渲染命令：

```bash
npm run render
# 等价：
npx hyperframes@0.8.24 render --fps 30 --quality high --browser-gpu --workers 1 --output output/Shunde3D.mp4
```

本机已验证可直接调用的 CLI：

```bash
node /Users/bryannathan/.npm/_npx/3c3d1ddaa008f96a/node_modules/hyperframes/bin/hyperframes.mjs check --at 4,19,27,40 --timeout 15000 --json
node /Users/bryannathan/.npm/_npx/3c3d1ddaa008f96a/node_modules/hyperframes/bin/hyperframes.mjs snapshot --at 4,19,40 --no-end --timeout 15000 --browser-gpu --output qa/hyperframes --describe false
```

## 真实产物

| 产物 | 路径 |
|---|---|
| 高清母版视频 | `output/Shunde3D.mp4` |
| 飞书同分辨率视频 | `output/Shunde3D-feishu.mp4` |
| 成片解码与交付验收 | `qa/final-video-validation.json`、`output/feishu-video-receipt.json` |
| 独立模型源代码 | `src/model.js`，`src/builder.js` |
| 场景/共享接入/导出 | `src/main.js` |
| 46秒镜头/分层时间函数 | `src/spec.js` |
| 静态闭合模型 GLB | **`output/Shunde3D.glb`** |
| GPU 浏览器验证报告 | `qa/browser-check.json` |
| 磁盘 GLB 复验 | `qa/glb-disk-check.json` |
| Node 测试真实日志 | `qa/tests.log` |
| HyperFrames检查真实日志 | `qa/hyperframes-check.log` |
| 正面／斜角／分层真实HF帧 | `qa/hyperframes/frame-00-at-4s.png`、`frame-01-at-19s.png`、`frame-02-at-40s.png` |
| 19个影片时间样本 | `qa/frames/`，清单见 browser-check.json |
| 入口细节 | `qa/frames/27s.jpg` |
| 玻璃反射开/关 | `qa/frames/glass-on.jpg`、`glass-off.jpg` |
| GLB回读渲染 | `qa/frames/glb-reloaded.jpg` |
| 交互页实测 | `qa/frames/viewer-exploded.jpg` |

GLB 文件 **19,092,900 bytes**；48 网格、15 材质、31 张嵌入图像、19,200 个实例化叶片；不依赖外部图片 URI。含 `EXT_mesh_gpu_instancing`，目标查看器需支持该扩展。实景窗玻璃 cubemap 是浏览器运行能力，标准 GLB 使用 PBR 备用材质，不把 GLB 宣称为可移植的实时反射管线。导出闭合模型，但会恢复浏览器导出前的展开状态。

SHA-256：`562ea98ac89266bf448471bc5e95aae3c3e18214423a5c43bf21a015e706e69d`

## 模型与审美

- 连续浅灰层带、规则窗格、深色石材门框、两根高圆柱、后退门厅、宽台阶与顶部窄窗/竖肋均为实际几何。
- 所有窗格使用同一个玻璃材质；颜色差异来自同一场景的局部 cubemap，而非随机窗色。一个 256px cube probe，共享反射同样有远端视差近似，不是逐窗光线追踪。
- 复用 V6 PBR纹理生成、环境/光照、确定性GTAO、CC0照片枫叶轮廓与曲面。场景12棵示意树、19,200片有轮廓的曲面叶片，不是三角形树冠。
- 48 个网格批次；包含实例后约1,466,020三角面。连续校园地面，不是浮台；建筑与圆弧基础埋入地面。
- 36–46秒为分层示意；中央高门厅不插入中间楼板；轻量隔墙仅用于可读性。末段完整回原位。

## 证据边界（必须保留）

1. **不是测绘成果。** 模型主体采用估计宽62m、进深30m、顶部约21.3m；计入台阶、圆弧、檐口后的实际模型包围盒是62.5×21.635×40.741m。场景320m见方只是保证地面连续，不是校园实测面积。
2. 开窗排布依据照片形成规则节奏，227个程序窗构件并不声称227个实测窗或真实结构柱网。`tiers`是动画层组，不是法定楼层数证明。
3. 正面用户图与两张入口公开照片对两圆柱/石材框提供较可靠参考；完整侧/后面、屋顶和室内缺证，全部为推测。
4. `sohu_old_2.jpg`支持圆弧端部存在，但方向、半径、接合方式不明。模型后侧半圆体量是**位置与半径假设**，未做闭合整圆；交互页可隐藏它，模型组与屏幕标注均保留推测说明。
5. 未将“经管新楼”的6层/30m等数据套用。参考证据见 `references/analysis.md` 与 `references/references.json`。
6. 公开建筑照片未查得开放许可，只作建模参考，**没有作为贴图或影片照片素材**。共享叶片有CC0出处，复制的 `assets/leaves/SOURCE.json` 与许可证证据随项目保留。要公开打包模型/影片时，不要顺带打包 `references/` 原照片。

## 验证结论

7项Node测试通过；模型几何测试先确认缺实现RED，再完成GREEN。Apple M4 / ANGLE Metal实拍19个时间样本、3个HyperFrames生产路径截图。重复seek和全新页面在4秒截图SHA完全相同；46秒全部层组复位。HyperFrames lint/runtime/layout/contrast均零finding，14项对比度检查通过；motion-sidecar未启用，不虚称已检测所有运动轨迹。交互页展开/闭合与圆弧切换已实点。

导出初次验证暴露了Three.js derivative-tangent法线Y处理：已为有法线贴图的导出网格写入显式tangent，叶片绿通道烘焙反转，并将断言限定到实际带normalMap的材质。磁盘复验27个有法线贴图的primitive均有tangent。正常的GLTFExporter roughness/metalness合并提示保留在报告，不属于运行错误。
