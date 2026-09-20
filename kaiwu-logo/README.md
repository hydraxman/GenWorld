# 开悟 / 清华 MEM Logo 特效源码

集中保存历次 Logo 动效的可编辑源码、原始 SVG/几何、必要运行素材、离线播放器与参考许可记录。原项目不改动；本目录是按批次保留的源码快照，不做效果重写。

## 最新五版：5 秒、1920×1080

| 效果 | 工程目录 | 离线预览 |
|---|---|---|
| 01 星际穿越 | [five-effects-a/01](latest/tsinghua-mem-five-effects-a/01/) | [打开 HTML](latest/tsinghua-mem-five-effects-a/01/deliverables/Tsinghua-MEM-01.html) |
| 02 极光织带 | [five-effects-a/02](latest/tsinghua-mem-five-effects-a/02/) | [打开 HTML](latest/tsinghua-mem-five-effects-a/02/deliverables/Tsinghua-MEM-02.html) |
| 03 星尘凝徽 | [five-effects-b/03](latest/tsinghua-mem-five-effects-b/03/) | [打开 HTML](latest/tsinghua-mem-five-effects-b/03/deliverables/Tsinghua-MEM-03.html) |
| 04 折光涟漪 | [five-effects-b/04](latest/tsinghua-mem-five-effects-b/04/) | [打开 HTML](latest/tsinghua-mem-five-effects-b/04/deliverables/Tsinghua-MEM-04.html) |
| 05 蓝天云启 | [five-effects-cloud](latest/tsinghua-mem-five-effects-cloud/) | [打开 HTML](latest/tsinghua-mem-five-effects-cloud/deliverables/05-Blue-Sky-Cloud-Opening.html) |

## 历史版本

| 工程 | 内容 | 离线预览 |
|---|---|---|
| [badge-motion](history/tsinghua-mem-badge-motion/) | A 背景发光、B 镂空透光、C 虹彩扫光，各 6 秒 | [三版播放器](history/tsinghua-mem-badge-motion/deliverables/Tsinghua-MEM-Light-Studies.html) |
| [seven-studies](history/tsinghua-mem-seven-studies/) | 星空金属、星云虹彩、极光玻璃、银河透光、星轨轮廓、流星闪光、晨曦珍珠，各 6 秒 | [七版播放器](history/tsinghua-mem-seven-studies/deliverables/Seven-Studies.html) |
| [3d-starlight](history/tsinghua-mem-3d-starlight/) | 真 3D 金属星光 / 整徽倾转，6 秒 | [播放器](history/tsinghua-mem-3d-starlight/deliverables/Tsinghua-MEM-3D-Starlight.html) |
| [3d-book-opening](history/tsinghua-mem-3d-book-opening/) | 方形真 3D 开书，12 秒 | [播放器](history/tsinghua-mem-3d-book-opening/deliverables/Tsinghua-MEM-3D-Book-Opening.html) |
| [open-world](history/tsinghua-mem-open-world/) | 开卷见天地，12 秒 | [播放器](history/tsinghua-mem-open-world/deliverables/Tsinghua-MEM-Open-World.html) |
| [awakening-wide](history/tsinghua-mem-awakening-wide/) | 星河开悟横屏，12 秒 | [播放器](history/tsinghua-mem-awakening-wide/deliverables/Tsinghua-MEM-Awakening-Wide.html) |
| [starlight-v2](history/tsinghua-mem-starlight-v2/) | **未完成草稿**：四方向 brief、局部脚本及素材；没有完整 HTML/成片 | 不适用 |

## 使用方式

### 直接预览

下载 / 克隆仓库，在本地浏览器打开上述 `deliverables/*.html`。这些文件包含已交付版本的脚本与素材，无需服务器或联网。GitHub 文件页面只显示源码，不直接播放。

### 修改源码

- 3D 特效：修改各工程 `scripts/scene.js`、`background.js` / `effects.js` / `clouds.js`。
- 早期平面效果：保留工程 `assets/`、`scripts/`、`inputs/` 和 `index.html` 一起使用。
- 原徽章轮廓、文字镂空和语义几何在 `inputs/`，不要重画或覆盖原稿。

在任意完整 **3D 工程目录**内重新打包（Node.js / npm）：

```bash
npx --yes esbuild@0.25.12 scripts/scene.js --bundle --format=iife --minify --loader:.svg=text --loader:.jpg=dataurl --alias:three=./vendor/three/build/three.module.js --outfile=assets/scene.bundle.js
python3 -m http.server 8080 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8080/index.html`。制作入口采用暂停时间轴，可在浏览器控制台执行 `Object.values(window.__timelines)[0].play()` 播放。

**注意：**已交付的离线 HTML 内嵌旧 bundle，修改源码并打包不会自动更新它。需要使用原工程的 `scripts/build.py`（若有），03/04 使用所在 `five-effects-b/build.py`，或重新生成离线播放器。优先用制作入口验证修改，不把旧播放器当成新结果。

原构建 / 渲染 / QA 脚本原样存档：部分依赖旧机器的 Puppeteer、Chrome、esbuild 缓存绝对路径、历史 QA 文件或输出视频；迁移环境须先调整路径并创建输出目录。这次只验证了场景入口编译与离线播放器，不声称所有历史辅助脚本跨机器直接可用，也没有重渲染所有视频。各旧 README 中提到但本库未收录的视频、QA 帧及 ZIP 是原交付记录，不是缺失源代码。

## 原稿与渲染前置文件

- `source-art/` 保存原始透明 SVG、矢量化脚本 `vectorize.py` 和预览脚本 `render.mjs`。矢量化依赖 Pillow / Potrace；脚本引用的最初 JPG 已不在本机，因此只能保留生成流程，不能宣称现在可从原始 JPG 重建。现有 SVG 完整可用。
- 保留各工程 `qa/render-input-freeze.json` 以及必要的离线验证脚本。8 份冻结清单引用的文件均已逐项重新校验哈希；不把这些渲染前置文件误当普通 QA 截图删除。
- `open-world/scripts/setup.py` 是会覆盖场景的历史派生脚本，不是安装步骤；通常无需运行。

## 归档与许可边界

- `archive-manifest.json` 记录原项目名、每个归档文件的相对路径、字节数和 SHA-256；源文件保持原样。
- `verification.json` 记录本次 11 个离线入口的浏览器检查及 9 个 3D 场景编译结果。
- 保留 Three.js 实际使用的模块、SVGLoader、噪声代码及 MIT 许可证；不复制整套无关示例和依赖缓存。
- GSAP 文件保留原版权 / 许可头；Logo 及品牌素材不因本归档自动授权第三方使用。
- React Bits / Codrops 只保留我们写的参考机制与许可记录，不收录受限或未明确授权的参考组件源码。
- 蓝天云启的 Poly Haven 天空素材及 CC0 来源记录随工程保留。
- 不纳入 MP4、逐帧 PNG、ZIP、虚拟环境、依赖缓存、发送回执、凭据。成片仍保留于原交付位置和 OneDrive。
- 本次与 OneDrive 的「五版可编辑源码.zip」「开悟横屏动画源码.zip」进行了文件哈希比对，两份 ZIP 的代码均已覆盖。
