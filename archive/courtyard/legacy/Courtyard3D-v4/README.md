# 庭院建筑 V4：照片素材叶片

本版替换树木、灌木和廊架的简化叶片。采用 Dorian Zgraggen / cgbookcase 的 **Maple Leaf 01（CC0）**，由照片颜色分离轮廓，构建 77 点裂片外形、轻微弯曲和 UV，结合叶脉颜色、法线与粗糙度贴图。并非每片只用单个三角形，也不是矩形照片牌。

来源：https://www.cgbookcase.com/textures/maple-leaf-01
原图、许可证声明快照、来源 URL 和 SHA256 随包保留。官方 2K 下载端点返回403；实际采用官方公开的 1K 贴图，不宣称用了2K素材。

## 保持不变
- 五个已认可镜头、36秒、1920×1080、30fps。
- V3 的建筑、深砖红墙、灰蓝窗、水池基座、平面倒影和环境光/接触阴影。
- 植物位置与实例数量不变，仅更换叶片几何、纹理和颜色调制。

## 两个独立压缩包
- **庭院建筑_V4_带纹理模型.zip**：含 `Courtyard3D-v4.glb`，纹理内嵌。第三方加载器须支持 `EXT_mesh_gpu_instancing`。实时水面反射由网页查看器提供，GLB中为PBR水面回退。
- **庭院建筑_V4_源码与查看器.zip**：本地查看器、程序源码、素材来源及验证脚本。不需要GLB也可查看同源场景。

## 查看
解压源码包，进入 `Courtyard3D-v4`：

```sh
python3 -m http.server 8768 --bind 127.0.0.1
```

打开 http://127.0.0.1:8768/viewer.html ，支持旋转缩放和五视角切换。预构建文件和贴图已随包，无需网络下载即可查看。

## 开发与验证

```sh
npm ci
npm test
npm run build
CHROME_PATH=/path/to/chrome node qa-browser.mjs --export
python3 repack-glb.py
```

`repack-glb.py` 对内嵌 PNG 做无损重新编码，并将叶片法线从 DirectX 方向转换为 GLTF 所需的 OpenGL 方向；不改几何或实例矩阵。Python 脚本需 Pillow，轮廓重建另需 numpy/scipy。

## 边界
本项目仍是两张照片指导的美术重建，不是测绘模型。枫叶用于本次外观改善，未认定现场树种或藤本品种。植被分布沿用原版；没有把校园树木全部重新做成植物学精确模型。
