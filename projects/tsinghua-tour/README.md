# 清华园地图导览

沿校园道路串联景点的地图视频工具，支持矢量与卫星底图，共用路线、镜头和旁白。路线快照不代表实时开放、入校资格或通行条件。

## 安装

在本目录执行：

```sh
npm ci
python3 -m pip install -r requirements.txt
```

捕获与导出还需要 Chromium、FFmpeg 及可访问的地图服务。可用 `CHROME_PATH` 指定浏览器。已有音频可直接使用，只有重新合成旁白才需要 Azure Speech 凭据。

## 预览与导出

```sh
npm run preview -- --basemap standard
npm run capture -- --basemap standard
python3 tools/export.py --basemap standard
```

将 `standard` 改为 `satellite` 可使用卫星底图。捕获和导出应选择相同模式；卫星影像不代表高清校园实景或实时画面。

```sh
npm run serve -- --basemap standard
npm test
python3 -m unittest discover -s tests -v
```

服务地址由终端输出。完整媒体验收需要相应素材与产物，不应把源码测试通过等同于成片通过。在线图源限流或不可用时应停止重复请求，不用旧帧掩盖缺失。

## 制作资料

- [旁白](docs/SCRIPT.md)
- [制作流程](docs/PRODUCTION.md)
- [配音流程](docs/VOICEOVER.md)
- [来源与授权](docs/SOURCES.md)

## 许可

原创代码采用仓库 MIT 许可，第三方素材不适用统一 MIT 授权。卫星影像涉及非商业、相同方式共享条款；字体与照片分别遵循各自许可，部分历史照片尚未取得公开再分发授权。公开仓库或发布视频前须单独审核这些素材及历史记录。
