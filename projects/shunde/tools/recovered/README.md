# 舜德楼历史本地工具

从旧工作目录中被忽略的 `projects/shunde/review/` 与
`projects/shunde/output/i2v-shunde/` 恢复。这些是针对当时模型和文案的一次性工具，
不是通用生产管线；保留原算法、尺寸、文字和输出命名，仅将固定系统字体路径改成
显式 `--font`，将依赖工作目录的 GLB 默认路径改成必填输入输出参数，并补充 CLI 描述。

所有相对参数路径都相对**调用时的工作目录**。不读取个人配置，不包含发送目标，
不发送消息，不调用远程生成。不会下载模型、字体或媒体。输入素材不随源码入库。

## 工具与边界

| 脚本 | 原位置（相对项目目录） | 用途与限制 |
| --- | --- | --- |
| `make-comparison.py` | `review/make-comparison.py` | 完整画幅照片/模型并排图，1920×738；支持左右标题 |
| `make-plan-comparison.py` | `review/make-plan-comparison.py` | 历史俯视对比图，1920×930；固定将 before 旋转 180°；文字描述当时直角三角形方案 |
| `verify-plan-glb.py` | `review/verify-plan-glb.py` | 读取嵌入 GLB 的屋顶 POSITION；要求唯一 `Nonrectangular roof cap`、无祖先变换、float32 VEC3；仅检查该历史屋顶角点，不能代替通用 GLB 校验或实测认证 |
| `compose.py` | `output/i2v-shunde/compose.py` | 本地裁剪、字幕、旁白合成；固定 5 秒、24 fps、120 帧与“这里是清华大学舜德楼”字幕，不生成 H3 素材或旁白 |

依赖：Python 3、Pillow（图像和合成工具）；合成还需 PATH 中的 `ffmpeg` 和
`ffprobe`（支持 libx264/AAC）。自行指定支持中文的 TTF/OTF/TTC 字体，避免无字形输出。
GLB 校验仅使用标准库。不要以 `python -O` 运行：历史校验包含 `assert`。

## 使用

以下命令从仓库根目录运行；先将 `FONT` 设置为本机中文字体文件路径。

```sh
python projects/shunde/tools/recovered/make-comparison.py \
  --reference reference.png --candidate candidate.png \
  --font "$FONT" --output projects/shunde/review/comparison.jpg

python projects/shunde/tools/recovered/make-plan-comparison.py \
  --before before.png --after after.png \
  --font "$FONT" --output projects/shunde/review/plan-comparison.jpg

python projects/shunde/tools/recovered/verify-plan-glb.py \
  --glb projects/shunde/output/Shunde3D.glb \
  --output projects/shunde/qa/right-triangle-glb-geometry.json

python projects/shunde/tools/recovered/compose.py \
  --video footage.mp4 --crop 0 0 1280 720 --font "$FONT" \
  --out projects/shunde/output/i2v-shunde/final.mp4
```

合成前须创建输出目录，并在该目录放置 `narration.mp3`；视频至少覆盖 5 秒，裁剪宽高须为偶数且位于原视频范围内。
该脚本使用 `ffmpeg -y`，会覆盖目标视频及同目录的 `caption.png`、`compose.log`、
`final-probe.json`、`final-0s.jpg`、`final-1s.jpg`、`final-2.5s.jpg`、`final-4.9s.jpg`。
每次合成应使用独立目录。图像和 JSON 工具也会覆盖指定输出。

## 回归验证

```sh
RECOVERED_TEST_FONT="$FONT" \
  python projects/shunde/tools/recovered/tests/test_recovered.py -v
```

六项专项回归覆盖 CLI 字体接口、强制 GLB 路径、真实图片生成、GLB accessor 正例、
含变换 GLB 拒绝，以及 FFmpeg 本地合成/解码/ffprobe/抽帧。
测试视频、正弦波音频与 GLB 均为明确构造的测试夹具，不是历史项目成果。
夹具和输出只写入 `tests/` 下临时目录，退出时清理。
缺字体环境变量或 FFmpeg 时，渲染测试会跳过；要验证全部六项，需安装依赖并设置字体。

迁移前已对旧脚本复现：三项 CLI 不允许指定字体；GLB 工具从其他目录运行时误读
`output/Shunde3D.glb` 并产生 `FileNotFoundError`。可设置
`RECOVERED_SOURCE_ROOT` 为旧项目目录重复路径接口测试。

## 明确未恢复

- `review/send-one-image.py`、`review/send-reference-images.py`：依赖私人投递模块、
  身份配置和消息发送 API；留在本地忽略区，不应提交。没有运行发送脚本或读取发送回执。
- 忽略的 `assets/scene.js`（旧根目录、courtyard、shunde 共三份）是包含 Three.js 的
  构建 bundle，不作为独立源码恢复；对应项目保留了源文件和构建入口。

这里只验证恢复工具的专项行为，不宣称整个仓库测试通过，也不宣称历史模型或原始视频已重新验收。
