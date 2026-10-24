# 相机结构与光路

基于 Blender 的相机教学场景，展示外观、分层结构、光路与旁白。它不是厂商 CAD、维修手册或精密尺寸模型。

## 开发

- [参数说明](docs/CORE-PARAMETERS.md)
- [依赖与运行](docs/CODE-AND-RUN.md)
- [模型来源与许可](docs/MODELING-SOURCES.md)
- [制作流程](docs/SKILLS.md)

在本目录运行测试：

```sh
python3 -m unittest discover -s tests -v
```

完整验收依赖 Blender、模型、音频及生产帧；纯源码检出不能运行所有媒体检查。请按运行说明准备有权使用的素材，不将历史输出当作新代码的验证结果。

## 许可

原创代码采用仓库 MIT 许可。第三方模型为 Royalty Free，**不是 CC0**，不随代码重新分发；模型、贴图和媒体的使用仍受原授权约束。
