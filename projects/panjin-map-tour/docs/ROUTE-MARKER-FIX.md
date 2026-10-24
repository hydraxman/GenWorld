# 路线与标点修复说明

## 根因

1. **道路入口与景点中心混用。** V1使用景点中心作为编号坐标，但OSRM把驾车路线吸附到附近道路，最大偏差249米；画面上就会出现路线经过景点附近、编号却停在另一处的情况。
2. **一处坐标系混用。** 广厦艺术街来自高德的GCJ-02坐标，直接叠加到WGS84的OSM/OSRM会产生明显偏移。
3. **自定义标点CSS覆盖MapLibre定位。** `.pin { position: relative }` 覆盖了MapLibre marker的绝对定位，使第2至第10个标点按每个标点88像素累积向下漂移。真实浏览器检测曾测得最大漂移792像素。
4. **编号尺寸与聚类处理不足。** 北部城区的多个景点在全域视角下接近，原36像素编号无法清晰辨认，也没有引线解释编号和坐标的对应关系。

## 修复

- 每个景点保留 `poi_coordinates`，同时保存OSRM返回的 `coordinates` 道路入口锚点。
- 路线、WebGL锚点圆、HTML编号引线底点统一使用道路入口锚点。
- 广厦艺术街先执行GCJ-02→WGS84转换，再重新生成OSRM路线。
- 标点改为56像素常态、64像素激活态的大号圆形编号；用白色引线连接10像素锚点。
- 北部聚类使用独立水平偏移，但引线底点不移动。
- 恢复 `.pin { position: absolute }`，不覆盖MapLibre marker定位契约。

## 验证

- 10个道路锚点到路线距离：全部0米。
- 10个DOM编号底点与 `map.project(道路锚点)` 的最大误差：小于0.001像素。
- 10个激活编号尺寸：64×64像素。
- 10个分区镜头中编号均处于安全可见区。
- 全程bearing固定，路线进度单调，不倒退。

证据：

- `qa/route-validation.json`
- `qa/marker-anchor-validation.json`
- `qa/motion-validation.json`
- `qa/v3-narrated-contact-sheet.jpg`
