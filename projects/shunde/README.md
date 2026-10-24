# 舜德楼庭院重建

根据地图轮廓与参考照片构建的三维建筑，包含北入口、开放庭院、圆体与玻璃厅。地图表示伟伦楼与舜德楼的组合轮廓；楼栋分界、隐藏立面、内部空间及部分尺寸仍为推定，不是测绘或施工模型。

## 运行

先在仓库根目录安装依赖，再进入本目录：

```sh
npm test
npm run build
npm run dev
```

通过终端显示的地址打开 `viewer.html`，可旋转、切换视角和导出 GLB。`index.html` 是影片入口。

```sh
npm run qa
npm run render
```

浏览器验收和视频制作还需要 Chromium、Python、Pillow 与 FFmpeg。用 `CHROME_PATH` 指定浏览器，`PYTHON` 指定解释器；输出目录和预览地址分别可用 `SHUNDE_OUTPUT`、`SHUNDE_URL` 覆盖。渲染输入校验还需通过 `SHUNDE_FONT_FILES` 指定实际字体文件。

## 模型与复用

来源、方位和推定范围见 [重建依据](docs/courtyard-reconstruction.md)。模型保持原凹形轮廓及庭院通道，不以完整盒体填补未证实空间。

校园和 [Logo 俯冲研究](../kaiwu-logo/studies/shunde-dive/README.md)复用此模型。立面细化需显式开启 `refinedFront`；周边建筑、硬地前场、树林与悬空连廊由独立模块装配，不改变原查看器的默认行为。连廊的位置及高度仍为示意。

[Blender 工具](blender/README.md)保留的是独立历史模型，不应与当前庭院几何混同。GLB 保存几何与材质，不包含查看器的全部灯光及屏幕空间效果。

## 许可

原创代码采用仓库 MIT 许可。平面数据为 © OpenStreetMap contributors，遵循 [ODbL](https://www.openstreetmap.org/copyright)。植物、字形及其他资源保留各自来源与许可；参考照片仅用于比对，不因代码开源获得再分发权。
