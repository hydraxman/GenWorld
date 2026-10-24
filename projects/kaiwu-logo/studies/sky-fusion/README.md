# 云光凝徽

可编辑的四秒天空徽章动画：粒子成形、三层错向旋转、固定书脊翻页和原稿轮廓描边。校园试验直接复用本项目的徽章引擎。

## 开发

先按[仓库说明](../../../../README.md)安装依赖，再在本目录运行：

```sh
npm run build
npm run music
npm test
npm run proof
```

构建需要 Node.js 和 Python；浏览器验证需要 Chrome / Edge，可用 `CHROME_PATH` 指定。`proof` 检查真实节点、原稿镂空、书脊、灯光、音乐编排和非顺序 seek，并在忽略的 `output/` 中生成截图与报告。

可选 `npm run check`、`npm run preview`、`npm run render` 使用项目锁定的 HyperFrames CLI，渲染另需 FFmpeg。浏览器截图生成后，可用 `python scripts/check-hold-lighting.py` 检查左右书页亮度（需要 Pillow）；视频导出后，可用 `python scripts/check-music-ending.py --video <视频路径>` 检查实际编码音频。源场景验证不等于成片验收。

## 实现与来源

`scripts/scene.js` 驱动全部动作，`year-2026.js` 仅替换年份末位的真实镂空轮廓；原始几何不变。`scripts/music.py` 用标准库生成原创合成音乐，由时间轴保音高加速并渐弱收尾；来源见 [music-provenance.json](assets/music-provenance.json)。

原创代码适用根目录 [MIT](../../../../LICENSE)；品牌原稿不因此获得第三方使用授权。Three.js 为 MIT，GSAP 为 **GSAP Standard License**，Poly Haven 天空为 CC0。保留[素材来源](../../latest/tsinghua-mem-five-effects-cloud/references.json)及[项目许可边界](../../README.md#许可与来源)。生成的 bundle、音乐与视频不进入 Git。
