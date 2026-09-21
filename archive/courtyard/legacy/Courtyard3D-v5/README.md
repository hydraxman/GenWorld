# 庭院建筑 V5：分层展开与收拢

在V4外观展示后新增10秒内部构造示意，总时长46秒。前36秒直接保留V4已交付视频编码数据；最后10秒为真实三维分层动画。

## 查看
解压源码包进入工程目录，运行：

```sh
python3 -m http.server 8768 --bind 127.0.0.1
```

打开 http://127.0.0.1:8768/viewer.html 。保留五个原视角，新增“分层展开”“收拢复原”按钮，展开后仍可拖动旋转和缩放。

## 新增内容
- 底层与主层的简化楼板、隔墙、楼梯及柱梁。
- 屋顶与天窗整体先向上展开，主层随后抬升，展示内部后依次复原。
- 继续使用原建筑的砖石与窗框材质，保留V4枫叶和V3水面倒影。
- 新镜头内明确标注“室内布局为推测 · 非实测构造”。

**推测边界：**无室内平面图或实测资料。本版内部结构只用于说明分层关系，不认定实际房间用途、层数分隔、楼梯位置或承重体系，不用于工程设计。按既有高窗主厅组织底层、主层、屋顶/天窗，不另把高窗大厅切成多个楼层。

## 工程入口
- `index.html`：46秒完整可seek场景。
- `segments/ending.html`：10秒追加镜头，局部时间映射到完整时间36–46秒。
- `src/camera.js`：原36秒相机，不改。
- `src/film-camera.js`：仅补充新镜头的相机。
- `src/exploded.js`：可分解构件、简化室内和绝对时间动画。
- `qa-exploded.mjs`：检查展开、收拢与跳转复原。
- `finalize-video.py`：拼接既有V4与新镜头，并逐帧验证前1080帧完全一致。

## 开发

```sh
npm ci
npm test
npm run build
CHROME_PATH=/path/to/chrome node qa-exploded.mjs
```

已带预构建 `assets/scene.js`、纹理与本地GSAP，查看不需要安装依赖。叶片素材及来源详见 `assets/leaves/SOURCE.json`（cgbookcase / Dorian Zgraggen，CC0）。GLB需要支持 `EXT_mesh_gpu_instancing`；实时水反射与爆炸动画以本地网页为准。
