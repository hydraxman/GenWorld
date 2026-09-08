# 代码结构与运行

所有命令从 `~/Desktop/Courtyard3D-v6/projects/canon5d` 执行。该子项目是 **原生Blender + Python/Pillow + FFmpeg**，不是Three.js或HyperFrames；无需改变建筑项目的npm配置。

## 代码地图

| 文件 | 职责 / 输入与输出 |
|---|---|
| `build_camera.py` | 早期程序化机身、镜组、镜箱、五棱镜、快门、CMOS和电路；初建，不含全部后期修正 |
| `materials_v2.py` | 早期材质调整；只在对应静态场景运行 |
| `film45/build_film.py` | 基于静态场景建立45秒动画和逐帧三维投影时间轴 |
| `film45/replacement-v3/assets/acquire_blenderkit.py` | 官方公开API下载模型；会联网，不是日常验收命令 |
| `.../assets/inspect_asset.py` | 原始资产几何、图片、独立前后渲染检查 |
| `.../export_asset_glb.py` | 原始blend→data-only GLB，自动脚本禁用 |
| `.../integrate_model.py` | 复制旧场景、替换外壳、单位/光轴配准、按区域拆分、保持教学动画 |
| `.../polish_materials.py` | 镜片透明/涂层、深色机身、顶部LCD UV修复，保存production.blend |
| `.../compose.py` | 读取1080张PNG、timeline和旁白；实际叠加中文标签/字幕，并通过FFmpeg编码 |
| `.../audio/prepare_voice.py` | 新生成11段xiaoxiao2，测量时长、保音调适配、建立45秒WAV |
| `film45/xiaoxiao2/synthesize_azure.py` | prepare_voice依赖的Azure请求、PCM和JSON辅助函数；同时保留早期音轨替换流程 |
| `.../verify_scene.py` | 从blend检查环绕、包围盒、网格、逐帧光路/快门及旧动画保持 |
| `.../verify_final.py` | 整片解码、A/V参数、逐段音轨关联、原文时槽、旧基线hash、画面差异 |
| `tools/render_frame.py` | 从最终保存工程安全渲染本地QA帧，输出新目录，不保存或改写blend |
| `tests/test_project.py` | 迁移契约与真实字幕合成测试，不联网、不生成付费语音 |

表中的 `.../` 均为 `film45/replacement-v3/`。`mcp_run.py`及旧音频验证脚本保留供参考，但不是当前标准运行入口。

## 依赖

- 实测Blender `5.2.1 LTS`：`/Applications/Blender.app/Contents/MacOS/Blender`
- 实测Python：`/usr/local/bin/python3`；Pillow 12.1.1、NumPy 2.4.2。
- `ffmpeg`、`ffprobe`；原合成/验收脚本固定Homebrew路径 `/opt/homebrew/bin/`。
- macOS中文字体：`/System/Library/Fonts/STHeiti Medium.ttc`。
- 仅需要重新合成时：Azure CLI登录、Speech资源权限；不要把Key写进项目。
- 可选MCP：`requirements-optional.txt`；历史mcp_run脚本使用本机MCP安装绝对路径，换机需先配置。最终渲染不依赖MCP服务。

可选隔离环境安装：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

本次归档使用现有环境实测，未重新安装依赖、调用Azure或启用MCP。

## 1. 不改变交付文件的常规验证

```sh
python3 -m unittest discover -s tests -v
```

会生成 `qa/compositor-{1,481,1080}.jpg`，验证原Pillow字幕叠加代码实际可运行。只读检查V3的1080张原渲染帧，以及WAV字节和已交付MP4。

## 2. 从新目录重开模型、核对场景并真正渲染

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --disable-autoexec \
  film45/replacement-v3/canon5d-v3-production.blend \
  --python-exit-code 1 \
  --python film45/replacement-v3/verify_scene.py \
  --python tools/render_frame.py -- 481
```

输出 `qa/render-481.png` 和 `qa/scene-runtime.json`。可以换为第1、289或1080帧。脚本覆盖仅QA同名图，不保存blend；场景里残留的旧渲染路径在内存中重定向到新项目。

## 3. 整片验收

```sh
python3 film45/replacement-v3/verify_final.py
```

重新生成 `film45/replacement-v3/final-verification.json` 和 `final-qa/`；**该脚本会把visual_review/remote_delivery写成pending**，不表示本次重新发送过视频。原交付证据保存在 `evidence/original-delivery-verification.json`；迁移验收的事实记录另见 `qa/integration-verification.json`。视觉检查与远端交付核对不可用程序通过冒充。

## 4. 继续建模 / 重新渲染

优先打开最终production.blend继续编辑；先另存工作文件，保留已交付版本。第1帧合装，第289帧展开。不要从初建脚本重跑后声称得到了完全相同的成片。

全片重渲染到独立目录（**耗时任务，本次未重渲染整片**）：

```sh
mkdir -p qa/rerender
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --disable-autoexec \
  film45/replacement-v3/canon5d-v3-production.blend \
  -S Canon5D_Replacement_V3 -o "$PWD/qa/rerender/frame_" -F PNG \
  -s 1 -e 1080 -a
```

`compose.py`默认把输出写回V3交付文件，因此**不要直接无参数运行它**。需新片时，把该脚本、timeline、旁白目录与选定的完整frames作为独立构建目录的输入后运行；先修改输出名，并重跑验证。不要通过覆盖已交付MP4来做测试。

## 5. 语音重生成

本项目已保留全部付费原始音频，无需联网即可复用。`prepare_voice.py`会拒绝覆盖已有raw WAV；需要新声音时先新建独立输出，检查实际语音列表，确认额度与输出目录，再调用。旧辅助脚本中的订阅/资源名是历史配置，换环境须改成自己的配置，禁止提交密钥。

历史音频manifest中的 `raw_wav/fitted_wav/final_wav` 是旧路径，原字节保留用于哈希追溯；当前测试按当前项目+文件名重新定位。旧 `verify_voice.py` 是当时的音轨调查，不可当作脱离旧目录后的验收入口。

## 迁移与复现边界

- 生成脚本的项目输出目录已改为基于 `__file__`；通过Blender CLI执行时无需旧桌面目录。通过MCP直接传脚本文本时必须提供正确文件上下文，不要依赖服务进程的 `__file__`。
- 冻结基线的 `film45/compose.py`、原旁白manifest、原blend、原MP4和timeline保持原SHA-256；没有为迁移而重写历史证据。
- 生产blend保留原字节；实际打开+渲染已确认没有缺失外部图片。未重新证明“所有初建脚本从零重建等价”，也未重新生成或试听旁白。
