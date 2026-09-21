# V4 叶片专项修订

素材为 cgbookcase / Dorian Zgraggen 的 CC0 Maple Leaf 01，使用其官方公开1K颜色、DirectX法线、粗糙度图。详见 assets/leaves/SOURCE.json，许可证原页快照为 qa/sources/maple.html。

叶片有从照片分离的77点轮廓与真实UV，保留枫叶裂片和锯齿边缘，添加轻微弯曲；实例化复用同一几何、贴图。颜色图使用sRGB，法线/粗糙度为线性数据。网页通过负Y normalScale转换DirectX方向；交付GLB将绿色通道反转烘入叶片法线，保证导出方向一致。叶片双面、不使用半透明混合排序，alphaTest只裁去边缘。

树、灌木、廊架共享枫叶素材是用户授权的美术补全，不代表现场植物鉴定。草地的细草叶几何不属于阔叶树叶，本版保留。

V3 的三池基座、平面反射、灯光、环境贴图、GTAO和镜头不变。保留原有工程版本。
