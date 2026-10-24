# 盘锦地图导览

地图视频制作工具，包含道路锚点、路线、确定性镜头、旁白和渲染验证。景点位置与驾车入口分开记录，避免镜头和路线标点脱离道路。

## 运行与验证

在本目录执行：

```sh
npm test
npm run serve
```

测试使用冻结数据，不访问语音或路由服务，也不要求已有音频。预览需要在线地图服务。

浏览器捕获使用 Chromium 的远程调试连接；可用 `CDP_HOST`、`TOUR_URL` 配置地址：

```sh
npm run capture
npm run qa:markers
```

## 制作

```sh
npm run route
npm run voice
npm run render:frames
npm run encode
```

路线重建使用 OSRM；配音需要 Azure Speech 凭据，放在环境变量或忽略的配置文件中，不得提交。渲染与编码还需要 Python、浏览器和 FFmpeg。生成的音频、帧与视频不入库。

路线与旁白在 `data/`，运行页面在 `public/`，制作与验证入口在 `scripts/`。具体流程见项目内 [制作说明](skills/routed-map-tour-video/SKILL.md)。

## 许可

原创代码采用仓库 MIT 许可。地图与路线归属见 [数据许可](LICENSE-DATA.md)，MapLibre 保留随附许可证。在线地图和影像服务各有条款，可预览不代表允许批量缓存或离线导出。
