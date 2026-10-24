# 运行与验证

在相机项目目录执行命令。依赖为 Blender、Python、Pillow、NumPy、FFmpeg 和可用的中文字体；Python 依赖见 `requirements.txt`。

部分历史脚本保留平台专用的工具或字体路径，使用前须调整为当前环境。模型和媒体不随源码分发，需自行准备有权使用的输入。

## 源码与合成检查

```sh
python3 -m unittest discover -s tests -v
```

其中部分检查需要模型、音频和生产帧，不是纯源码测试。

## 场景与单帧

```sh
blender --background --factory-startup --disable-autoexec \
  film45/replacement-v3/canon5d-v3-production.blend \
  --python-exit-code 1 \
  --python film45/replacement-v3/verify_scene.py \
  --python tools/render_frame.py -- 481
```

此入口验证已保存场景并输出验收图，不改写模型。初建脚本不包含全部后期修正，不能保证从零重建相同场景。

## 整片

```sh
python3 film45/replacement-v3/verify_final.py
```

该检查依赖完整输入与编码视频。自动检查不代替视觉检查、完整试听或素材授权审核。

继续编辑时另存模型，将新帧与成片输出到独立目录。历史合成脚本默认可能覆盖原输出，运行前先确认路径。重新合成语音须准备自己的 Speech 配置、确认费用并使用新输出目录，不提交凭据。
