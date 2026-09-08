# Courtyard 3D 项目工作区

工程根：桌面 `Courtyard3D-v6`（沿用已经找到的文件夹名称，不再新建版本编号目录）。

## 当前入口

- `projects/courtyard/`：庭院旧楼的当前反射更新版。
- `projects/shunde/`：舜德楼唯一工作目录，最新照片修订已覆盖到这里。
- `projects/canon5d/`：相机精细模型V3的工作入口，包含成片、Blender模型、代码、参数、建模来源及相关skills；见该目录README。原桌面Canon5D-Cutaway仅保留为旧快照。
- `shared/`：可共用的渲染、光照、反射与叶片素材。

相机子项目独立使用Blender/Python/FFmpeg，不影响下方建筑npm命令。相机验收：`cd projects/canon5d && python3 -m unittest discover -s tests -v`。Git仓库包含相机代码、参数、文档与skills；相机资产为Royalty Free，模型/贴图/媒体只留本地，不随代码推送。

`projects/shunde-v2/` 已移除。后续修改直接更新对应项目，历史通过 Git 提交保存，不通过复制文件夹保存。

## 本地 Git

仓库已在本工程根初始化，分支为 `main`。首个提交保存整合前源码基线，后续提交记录舜德楼修订与目录归并。未配置 remote，未创建 GitHub 仓库，未推送。

模型参考图、视频/GLB、运行截图/报告、投递回执、依赖及缓存均留在本地并被 `.gitignore` 排除。用于回归校验的少量哈希基线 JSON 例外，纳入版本控制。

## 构建和验证

从工程根执行：

```sh
npm test
npm run build
npm run dev
```

- `http://127.0.0.1:8773/projects/courtyard/index.html`
- `http://127.0.0.1:8773/projects/shunde/index.html`
- `http://127.0.0.1:8773/projects/shunde/viewer.html`

目录归并后：庭院26项、舜德楼16项测试通过，两楼构建通过。舜德楼最新修订仍需在唯一目录完成最终浏览器/GLB及成片检查；先前发送的舜德楼视频是修订前结果，不能冒充当前最新成片。

详细照片依据、纹理和几何边界见 `projects/shunde/README.md` 与 `DESIGN.md`。实际可见窗组不等于已经查证的法定楼层；隐藏立面、屋面、内部构造与米制尺寸仍为估计。
