# 校园俯冲与金属徽章

四秒校园镜头，复用[天空样片](../sky-fusion/README.md)的徽章与原创合成音乐。校园背景和透明金属徽章分别渲染，再做风格处理与合成，避免背景滤镜改变徽章。

建筑依据照片与地图作参考重建，不是实景航拍或测绘数字孪生。立面、无源高度、窗内细节、连廊接口与补充树位含示意；地图主轮廓组合了伟伦楼和舜德楼，不宣称其为单栋。

## 开发与源场景验证

先安装仓库依赖并完成天空样片的构建，再在本目录运行：

```sh
npm run build
npm test
npm run proof
```

构建复用[舜德模型](../../../shunde/README.md)与共享素材，音乐缺失时调用原生成器。`proof` 需要 Chrome / Edge（可用 `CHROME_PATH` 指定），检查镜头、入口居中、真实透明徽章、开场像素及非顺序 seek。源场景入口是 `passes/scene.html`；报告与截图写入忽略的 `output/`。

## 可选风格处理

需要 FFmpeg、HyperFrames，以及对应的本地 G'MIC 或 CUDA / PyTorch 环境。它们不是构建和单元测试的前置依赖；外部工具、上游模型源码与权重须自行按许可准备，源码仓库不包含它们。

1. `npm run render:background` 和 `npm run render:badge` 导出独立背景与真实 alpha 徽章。
2. `scripts/compare-gmic.py` 的 `test` / `render`，或 `scripts/compare-neural.py` 的 `--phase preview` / `--phase render` 处理背景。神经工具的直接依赖锁定在 `scripts/compare-neural-requirements.txt`；上游来源与权重标识记录在处理脚本中。
3. `npm run render:comparison -- --soundtrack <四秒音轨或带音轨视频>` 合成；`python scripts/recolor-reconet.py --soundtrack <音轨>` 可恢复 ReCoNet 背景的源场景色度。音轨直接复制，须提供兼容 MP4 的已混合四秒音轨。不传参数仍使用脚本内的历史音轨输入；该视频不在 Git 中，缺失会明确报错，不会静默换音乐。
4. 有实际成片时运行 `npm run verify:comparison`。已知比较中第 40 帧的背景平均 RGB 误差为 **3.37，超过 3.0 阈值**，统一数值验收尚未通过；没有放宽阈值，也不声称完整媒体验收通过。

`npm run preview` / `check` / `render` 使用当前 HTML 合成入口，需要先生成背景；默认是 G'MIC 候选，不表示最终选定该风格。`render:comparison:browser` 保留变量驱动的浏览器合成。参数清单在 `scripts/comparison-variants.json`；已有成片不会被离线合成脚本覆盖。

## 许可与来源

原创代码适用根目录 [MIT](../../../../LICENSE)，第三方资产不重新授权。完整署名及模型限制见 [ATTRIBUTION.txt](ATTRIBUTION.txt)：包括 GSAP Standard License、Three.js MIT、CC0 天空与植物，以及 **© OpenStreetMap contributors / ODbL 1.0**。照片仅作参考，不随本项目分发；品牌标识的使用权须另行确认。神经权重的独立再分发或商业授权尚未确认，不随源码或输出打包。
