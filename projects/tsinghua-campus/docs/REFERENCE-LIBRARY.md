# 清华校园参考照片库

审阅：2026-11-02。共 **96** 个本地照片文件（按路径计，含2张审阅衍生图），**3** 张已核实开放许可原图纳入文档档案；**5** 个文件有明确开放许可（含衍生图）；**15** 个文件来源未解决。

## 路径、权限与用途

机器清单：[reference-photo-inventory.json](../data/reference-photo-inventory.json)。所有localPath相对于projects/tsinghua-campus；尺寸为文件编码尺寸而非EXIF转正后的显示尺寸。SHA256覆盖文件原始字节，不因换行、元数据或转正而忽略差异。相同哈希的不同路径仍逐项登记。

扫描整个references/照片目录，而非只列已经接入模型的图片；来源汇合reference-catalog.json、data中的照片/外观/来源记录，以及原有忽略目录中的appearance下载日志。日志中的有效证据已固化在每条provenance中，因此全新克隆不需要那些日志。path-and-hash表示路径与哈希匹配；byte-identical-alias表示另一个路径字节完全相同，不凭文件名推断来源。

受限及未知照片原件保持在被Git忽略的references/，不移动、不删除、不去水印；缺失是允许的，缺失不等于照片已通过检验。官方公开网页、可下载、文件名中的official/commons均不是再发布许可。默认未确认摄影作者；文章作者或记者不自动认定为摄影作者。

仅docs/reference-photos/内的三张原图是明确批准的版本化照片档案。它们不受源码MIT覆盖，适用各自CC BY-SA许可；复制、改编须保留署名、来源、许可链接及修改说明，改编另须遵守相同方式共享，不暗示作者为本项目背书。许可可能不涵盖其他独立权利；仅归档许可明确的文件。

该档案是仓库文档，不是网站图库。禁止将任何参考像素加入Pages、离线应用或纹理；现有Pages显式复制清单不包含docs/reference-photos/，无需放宽.gitignore或把references/改为public目录。本工具从不联网，普通build不复制档案。

## 开放许可档案及完整署名

以下副本逐字节保留原文件；没有新制作的照片衍生图。已有两个化学馆审阅衍生图只登记于本地清单，不复制到文档档案。

### 3 Tsinghua.jpg / Department of Biology, Tsinghua

- 文件：[docs/reference-photos/biology-hall-commons.jpg](../docs/reference-photos/biology-hall-commons.jpg)
- 作者：**cabbagezs**；来源：[Commons文件页](https://commons.wikimedia.org/wiki/File:3_Tsinghua.jpg)。
- 许可：[CC-BY-SA-2.0](https://creativecommons.org/licenses/by-sa/2.0/)；核验日期：2026-11-02。
- 修改说明：无改动；从已保存研究原图逐字节复制，未裁切、转正、压缩或去除水印。
- SHA256：`fc73f07e93bbc2b8d84f2f4399a63fab2435a94f61f10160e59f25ae46ebc671`。

### Chemistry Building of Tsinghua University.jpg

- 文件：[docs/reference-photos/chemistry-hall-2024-commons.jpg](../docs/reference-photos/chemistry-hall-2024-commons.jpg)
- 作者：**HoweyYuan**；来源：[Commons文件页](https://commons.wikimedia.org/wiki/File:Chemistry_Building_of_Tsinghua_University.jpg)。
- 许可：[CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)；核验日期：2026-11-02。
- 修改说明：无改动；从已保存研究原图逐字节复制，未裁切、缩放、压缩或去除水印。
- SHA256：`8c50cee3be1d46b2eedd7f64db132766bf1efbf4b09aaba8ff5c4f1697685b95`。

### 清華大學化學館.jpg

- 文件：[docs/reference-photos/chemistry-hall-front-commons.jpg](../docs/reference-photos/chemistry-hall-front-commons.jpg)
- 作者：**葉又嘉**；来源：[Commons文件页](https://commons.wikimedia.org/wiki/File:%E6%B8%85%E8%8F%AF%E5%A4%A7%E5%AD%B8%E5%8C%96%E5%AD%B8%E9%A4%A8.jpg)。
- 许可：[CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)；核验日期：2026-11-02。
- 修改说明：无改动；保留原JPEG编码与EXIF Orientation=6。编码尺寸4032×3024，按EXIF显示为3024×4032；不是已转正的审阅衍生图。
- SHA256：`95589700e08e41894d02a3d099d8941741cdf64d051b470b0f885d5ccec743d8`。

## 全部照片逐文件登记

每项均记录来源页／原图（如已知）、作者／许可、归属／用途及限制。来源未解决者不能进入许可档案；以后核实需保存来源页证据、对比下载文件SHA256并单独审阅授权，不能以补猜URL关闭未知。

### appearance-arts-academy-official

- 本地路径：`references/appearance-arts-academy-official.jpg`（研究副本可缺失）
- SHA256：`9016de84b32f28e93e0b3e533856479a3b5eb17249256e781450668414565458`；1920×900；915490字节。
- 建筑／地点：美术学院；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/F/88/B7/BD2CF43BDEABF3E8770B3597E82_3C826603_DF822.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-class-1115-official

- 本地路径：`references/appearance-class-1115-official.jpg`（研究副本可缺失）
- SHA256：`f483007591f60923b8ff70f6bf88c11c911433775a9e2d7918a7d5cdcfefe281`；1920×1281；453524字节。
- 建筑／地点：第二教学楼 / 第二教学楼全景浏览；site：appearance-teaching-2。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1115.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/1511255831l1.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1116-official

- 本地路径：`references/appearance-class-1116-official.jpg`（研究副本可缺失）
- SHA256：`1831e5e1795fd17e0274dc8062d2daa92df2830715c9079cbe785475fa264ea0`；1920×1281；463319字节。
- 建筑／地点：法律图书馆／廖凯原楼 / 法律图书馆地下一层全景浏览；site：appearance-law-library。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1116.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/15112527f3vl.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1117-official

- 本地路径：`references/appearance-class-1117-official.jpg`（研究副本可缺失）
- SHA256：`ea770544050924436e51a13395d28af6f42d48201cf851476c31e40a41e8dca8`；1920×1281；459014字节。
- 建筑／地点：清华学堂全景浏览；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1117.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/15112327oanu.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-class-1118-official

- 本地路径：`references/appearance-class-1118-official.jpg`（研究副本可缺失）
- SHA256：`6f71380fc444e618e70a62aa2694310dd477710379c4d812116e6cdde79affed`；1920×1281；365857字节。
- 建筑／地点：第四教学楼 / 第四教学楼全景浏览；site：appearance-teaching-4。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1118.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/15112240nal2.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1119-official

- 本地路径：`references/appearance-class-1119-official.jpg`（研究副本可缺失）
- SHA256：`6b1f29d6a3e9ca03daca582d028443be706d0257fc7c6c62395297dd62380da2`；1920×1281；379611字节。
- 建筑／地点：西阶梯教室全景浏览；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1119.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/15112147caeb.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-class-1120-official

- 本地路径：`references/appearance-class-1120-official.jpg`（研究副本可缺失）
- SHA256：`5a48cc3260e1deedb73bb995a3009306973a603ccb694285dc459214f90c3e0d`；1920×1281；308574字节。
- 建筑／地点：建筑馆报告厅 / 建筑馆报告厅全景浏览；site：appearance-architecture-lecture。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1120.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/15112048mwo3.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1121-official

- 本地路径：`references/appearance-class-1121-official.jpg`（研究副本可缺失）
- SHA256：`ae3f14e61798bc620ca4b4f5772a9c79dce252a00e3008e96a37532502901cd0`；1920×1281；373887字节。
- 建筑／地点：东阶梯教室全景浏览；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1121.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/15112022ecz7.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-class-1122-official

- 本地路径：`references/appearance-class-1122-official.jpg`（研究副本可缺失）
- SHA256：`5fd7f682650356cf76d9e0e7258b93ab7ce9ad1eccaf8fadb9a00b02ed9bc947`；574×432；80552字节。
- 建筑／地点：第一教学楼；site：appearance-teaching-1。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1122.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/17102249arr3.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1123-official

- 本地路径：`references/appearance-class-1123-official.jpg`（研究副本可缺失）
- SHA256：`77238d0dcb6a108b5ad3df6739f86fb9aa8336d9efa61a6d38929bff39813ba6`；1920×1281；712624字节。
- 建筑／地点：旧经管报告厅；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1123.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/17132005mqv8.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-class-1124-official

- 本地路径：`references/appearance-class-1124-official.jpg`（研究副本可缺失）
- SHA256：`fc941fa1b55fa35f019055dcdb558b5fb447ee9e74cb7bc39b5f43cb61b88a31`；1920×1281；541598字节。
- 建筑／地点：旧水利馆；site：appearance-old-hydraulic。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1124.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/17132554zipe.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1125-official

- 本地路径：`references/appearance-class-1125-official.jpg`（研究副本可缺失）
- SHA256：`0508f68b64f57799429bde35af67bb15f146dc81794d7277c6c656e6f1b08dff`；1920×1281；576077字节。
- 建筑／地点：新水利馆；site：appearance-new-hydraulic。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1125.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/17133002xdnl.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1126-official

- 本地路径：`references/appearance-class-1126-official.jpg`（研究副本可缺失）
- SHA256：`206e65e1f0fe1e357c4418dfe924589b97da0d176873231dd731adb366ba7082`；1920×1281；542122字节。
- 建筑／地点：明理楼／法学院 / 明理楼；site：appearance-mingli。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1126.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/17135453t4fg.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1127-official

- 本地路径：`references/appearance-class-1127-official.jpg`（研究副本可缺失）
- SHA256：`496af0190b5eb694bf91dc1ade588be6321742439c2f98c8513e7dbbc2e6bbc0`；1706×1279；1218363字节。
- 建筑／地点：逸夫技术科学楼；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1127.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/08104332uubc.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-class-1133-official

- 本地路径：`references/appearance-class-1133-official.jpg`（研究副本可缺失）
- SHA256：`658e928f0af920c8a8a86f5aec24bd5eb956cd9dbd39b23f29e1303ad9975992`；1920×1281；599611字节。
- 建筑／地点：舜德楼；site：shunde-building。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1133.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/23095758a7g3.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1136-official

- 本地路径：`references/appearance-class-1136-official.jpg`（研究副本可缺失）
- SHA256：`a2c9c055bb1ff0e7778937d6cdf67569c47d73b2f317c83cc5c5215a5caebf08`；1200×801；276540字节。
- 建筑／地点：建华楼全景浏览；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1136.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202503/27161159omm4.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-class-1137-official

- 本地路径：`references/appearance-class-1137-official.jpg`（研究副本可缺失）
- SHA256：`af4f466fa46ae9b08734487a5b01f2452b133bdec84aa5a6967b4c1903d157b6`；1200×771；405445字节。
- 建筑／地点：第六教学楼组团 / 第六教学楼C座 / 第六教学楼B座 / 第六教学楼A座；site：appearance-teaching-6。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1137.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202504/14110640xhsk.jpg。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1166.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/181159007g71.jpg。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1164.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/080940365xdt.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1157-official

- 本地路径：`references/appearance-class-1157-official.jpg`（研究副本可缺失）
- SHA256：`f0fd85f581123ba7b074ef368a29bb6e976135c8963be966fbeec5de20e770b0`；1200×800；240137字节。
- 建筑／地点：第五教学楼 / 第五教学楼全景浏览；site：appearance-teaching-5。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1157.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/012001390upe.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1161-official

- 本地路径：`references/appearance-class-1161-official.png`（研究副本可缺失）
- SHA256：`2efe4e0763ea53c735327e07224d392ac0c1e7cf80d5e6bc3421b034e699538e`；1686×971；1784270字节。
- 建筑／地点：自强楼全景浏览；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1161.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/08161403mwmd.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-class-1162-official

- 本地路径：`references/appearance-class-1162-official.png`（研究副本可缺失）
- SHA256：`56c2003e1a6302fd2de7adc0a45e9a0e5ef5bd92c5a915a0c6e572d3400621b4`；1425×569；1173504字节。
- 建筑／地点：第三教学楼一段全景浏览；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1162.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/06191950nexp.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-class-1163-official

- 本地路径：`references/appearance-class-1163-official.png`（研究副本可缺失）
- SHA256：`ab02276f5a83d19a6c29339b562bbb8b57866536c3a5690dc2f7cec8be943efe`；1808×835；2053894字节。
- 建筑／地点：第三教学楼三段 / 第三教学楼三段全景浏览；site：appearance-teaching-3-3。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1163.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/05155200blxg.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1164-official

- 本地路径：`references/appearance-class-1164-official.jpg`（研究副本可缺失）
- SHA256：`af4f466fa46ae9b08734487a5b01f2452b133bdec84aa5a6967b4c1903d157b6`；1200×771；405445字节。
- 建筑／地点：第六教学楼组团 / 第六教学楼C座 / 第六教学楼B座 / 第六教学楼A座；site：appearance-teaching-6。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1137.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202504/14110640xhsk.jpg。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1166.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/181159007g71.jpg。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1164.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/080940365xdt.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1165-official

- 本地路径：`references/appearance-class-1165-official.png`（研究副本可缺失）
- SHA256：`ff5947bca3503df4bd49df7c602dc2c655b5e1e8548ff22b4b931921585e451f`；1425×569；1174013字节。
- 建筑／地点：第三教学楼一、二段 / 第三教学楼二段全景浏览；site：appearance-teaching-3-12。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1165.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/171042175wky.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-class-1166-official

- 本地路径：`references/appearance-class-1166-official.jpg`（研究副本可缺失）
- SHA256：`af4f466fa46ae9b08734487a5b01f2452b133bdec84aa5a6967b4c1903d157b6`；1200×771；405445字节。
- 建筑／地点：第六教学楼组团 / 第六教学楼C座 / 第六教学楼B座 / 第六教学楼A座；site：appearance-teaching-6。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1137.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202504/14110640xhsk.jpg。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1166.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/181159007g71.jpg。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1164.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202509/080940365xdt.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-guest-houses-official

- 本地路径：`references/appearance-guest-houses-official.jpg`（研究副本可缺失）
- SHA256：`c626d717506f51603423dd6a8a6b64023ea759bbf9408c132d69fb439503790f`；1920×900；2097590字节。
- 建筑／地点：甲所、丙所及园林；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/8/3A/BB/92131D488776E063D599A283A37_BF51C7B0_2001B6.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-guyue-hall-official

- 本地路径：`references/appearance-guyue-hall-official.jpg`（研究副本可缺失）
- SHA256：`4dfcd21de01e4446f8eaed963c598ef0ff858f106f4ca65f8d712d10bd5588a3`；1920×900；1401665字节。
- 建筑／地点：古月堂；site：appearance-guyue。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/5/97/6F/584D8F3F4F3A8D802F9BE8AA707_A2D69FD8_156341.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-humanities-exterior-1-official

- 本地路径：`references/appearance-humanities-exterior-1-official.png`（研究副本可缺失）
- SHA256：`556e9f815559a210c6d5cbda6daafb61b346b03851d65f3bcc0e76f8d6ce53b2`；300×200；149049字节。
- 建筑／地点：人文社科图书馆官方馆舍风貌图；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://lib.tsinghua.edu.cn/hs/gk/gsfm.htm；原图：https://lib.tsinghua.edu.cn/__local/E/9C/25/3E5E7F9F70831387D6432EE65FB_7076DA29_24639.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-humanities-exterior-2-official

- 本地路径：`references/appearance-humanities-exterior-2-official.png`（研究副本可缺失）
- SHA256：`54b3bfcd276fdcf4f51d4549cfc890951b79759a5bc6653669350a98c4596507`；300×200；157253字节。
- 建筑／地点：人文社科图书馆官方馆舍风貌图；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://lib.tsinghua.edu.cn/hs/gk/gsfm.htm；原图：https://lib.tsinghua.edu.cn/__local/9/BC/E7/55F1E04B8ED172FFD9D64BF5FA8_E79D5433_26645.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-humanities-exterior-3-official

- 本地路径：`references/appearance-humanities-exterior-3-official.png`（研究副本可缺失）
- SHA256：`83430a483c29986f745b693f07cc71b59a182f06336740101431f37772701ce0`；300×200；142421字节。
- 建筑／地点：人文社科图书馆／凯风楼 / 人文社科图书馆官方馆舍风貌图；site：appearance-humanities-library。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://lib.tsinghua.edu.cn/hs/gk/gsfm.htm；原图：https://lib.tsinghua.edu.cn/__local/F/8F/6D/5E6F0D168A6B4B87249EEA6B3CA_2CBA6BBF_22C55.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-humanities-exterior-4-official

- 本地路径：`references/appearance-humanities-exterior-4-official.png`（研究副本可缺失）
- SHA256：`c9bdd1f975978bfcfc803dfe82499345693545913ff2502edd615155c660c946`；300×200；121863字节。
- 建筑／地点：人文社科图书馆／凯风楼 / 人文社科图书馆官方馆舍风貌图；site：appearance-humanities-library。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://lib.tsinghua.edu.cn/hs/gk/gsfm.htm；原图：https://lib.tsinghua.edu.cn/__local/4/52/79/F84CA0E03623A00BEE2CBC3B6B1_F36C260F_1DC07.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-humanities-exterior-5-official

- 本地路径：`references/appearance-humanities-exterior-5-official.jpg`（研究副本可缺失）
- SHA256：`076d3de2eb1c15ce159519b5c5959e0e0c3668e6e2c5a0e31a6a8f0581e68594`；1024×682；135577字节。
- 建筑／地点：人文社科图书馆官方馆舍风貌图；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://lib.tsinghua.edu.cn/hs/gk/gsfm.htm；原图：https://lib.tsinghua.edu.cn/__local/7/8E/56/931CADC36DB903AA1D428423654_4C1DE4A3_21199.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-humanities-exterior-6-official

- 本地路径：`references/appearance-humanities-exterior-6-official.jpg`（研究副本可缺失）
- SHA256：`158fb66c65ac58575b1b65d7c55f64f8a6f5f72a63a45c25f4bb39f621add0c1`；1024×719；155083字节。
- 建筑／地点：人文社科图书馆官方馆舍风貌图；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://lib.tsinghua.edu.cn/hs/gk/gsfm.htm；原图：https://lib.tsinghua.edu.cn/__local/3/EB/0C/40AEA2D74AD884EE5F5A9C48DA8_54ED5CA2_25DCB.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-humanities-library-official

- 本地路径：`references/appearance-humanities-library-official.jpg`（研究副本可缺失）
- SHA256：`c28bbad0807bb361d9838e460d0db6b6a235d8ca0fb9924062ddcb9b1a3420c5`；1920×900；856195字节。
- 建筑／地点：人文社科图书馆；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/4/E4/FE/7A1B27F0E935153244D5CD631BE_0C1A44E7_D1083.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-law-library-official

- 本地路径：`references/appearance-law-library-official.jpg`（研究副本可缺失）
- SHA256：`14a2e17e37cc61d11771c46cae827ec5108149aab477cf12715e252bb135e9bd`；1920×900；803072字节。
- 建筑／地点：法律图书馆／廖凯原楼 / 法律图书馆；site：appearance-law-library。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/1/95/79/BE6722693B3BC46415290CC514C_60689166_C4100.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-lee-shau-kee-official

- 本地路径：`references/appearance-lee-shau-kee-official.jpg`（研究副本可缺失）
- SHA256：`31dc4547c0e2e9a9d86689d13a928ea2419289854945187f268e71df62782220`；1920×900；1078117字节。
- 建筑／地点：李兆基科技大楼；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/8/17/A4/2492FB474A7906383B460BAEFB5_0C124750_107365.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-mingzhai-official

- 本地路径：`references/appearance-mingzhai-official.jpg`（研究副本可缺失）
- SHA256：`ce390d344a09211fb41bc048ec8af84f6a74342a5dd0c93d81cc21769fc3df74`；675×900；125218字节。
- 建筑／地点：明斋 / 明斋官方文章首图，需视觉确认外景；site：appearance-mingzhai。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.sss.tsinghua.edu.cn/info/1223/3363.htm；原图：https://www.sss.tsinghua.edu.cn/__local/3/85/89/D66255E301EB4138F8CC8493945_36B6AD2C_1E922.jpg?e=.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-new-tsinghua-hall-official

- 本地路径：`references/appearance-new-tsinghua-hall-official.jpg`（研究副本可缺失）
- SHA256：`1c649c4cc905b076a9b1e9d08c2e41ddfe4a76f2bc7c5df396acfecec86a4028`；1920×900；866449字节。
- 建筑／地点：新清华学堂；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/E/A0/37/715D9B175FBEA3C3741CBA0776C_97CFE0CF_D3891.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-science-complex-official

- 本地路径：`references/appearance-science-complex-official.jpg`（研究副本可缺失）
- SHA256：`9f5bd4a1c47cff2bef8034edb9319c06f3b01516502d5a5eea594b0315f2856e`；1920×900；2076314字节。
- 建筑／地点：理学院楼；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/7/67/AF/E65BC413EDEF385BFFDBB1E283E_E3D43574_1FAE9A.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-sixth-teaching-official

- 本地路径：`references/appearance-sixth-teaching-official.jpg`（研究副本可缺失）
- SHA256：`c54826f6a780c5abbb860c10d7b518bb3af9262c0014e4cfc4b36aff04f46eb5`；1920×900；1655009字节。
- 建筑／地点：第六教学楼组团 / 六教；site：appearance-teaching-6。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/F/95/58/C5BEF6F156647FDA67D23E093CA_F1B1226E_1940E1.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### appearance-teaching-overview-official

- 本地路径：`references/appearance-teaching-overview-official.png`（研究副本可缺失）
- SHA256：`1c6c0d3cf6ae171ec3d1bd920e954c9e1368aa2795a0f5e092db498264f73da2`；1920×900；3960838字节。
- 建筑／地点：教学楼官方介绍配图，未逐栋标注，需确认；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://iiis.tsinghua.edu.cn/info/1033/4178.htm；原图：https://iiis.tsinghua.edu.cn/__local/6/15/3A/C753B107EA270C168DA6F9A62A0_40B81CD7_3C7006.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### appearance-water-hall-historic-official

- 本地路径：`references/appearance-water-hall-historic-official.jpg`（研究副本可缺失）
- SHA256：`01aab2b4f036e1c5a3af952548ba269675a1416605e7b8d3c0e50b3b402d02be`；454×303；225795字节。
- 建筑／地点：2005年新水利馆／电机馆／同方部配图之一，需确认；site：未确认／未注册。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/info/1966/76622.htm；原图：https://www.tsinghua.edu.cn/_mediafile/qh2021b/publish/news/images/upload/pic/2005/05/10/2005051018.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### art-museum-gallery

- 本地路径：`references/art-museum-gallery.jpg`（研究副本可缺失）
- SHA256：`86e47b41e1ee3f67d35ca97c867b33a662b17f389ffa29247d05b58d90669941`；1920×900；590278字节。
- 建筑／地点：清华大学艺术博物馆；site：art-museum。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/0/E9/B5/123588172AED93BD0193C0D83FA_DED4F3EB_901C6.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### art-museum-official-overview

- 本地路径：`references/art-museum-official-overview.jpg`（研究副本可缺失）
- SHA256：`5353ce7257410a15677dd2be06ccf86615950186849e38e9ba5edeb39b25dd02`；890×300；326532字节。
- 建筑／地点：清华大学艺术博物馆；site：art-museum。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.artmuseum.tsinghua.edu.cn/aboutus/cgxx/jz/；原图：https://www.artmuseum.tsinghua.edu.cn/aboutus/cgxx/jz/201605/W020170622517968625488.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### auditorium-oblique

- 本地路径：`references/auditorium-oblique.jpg`（研究副本可缺失）
- SHA256：`90dafe849f950eb1d3105d996e047ddeda7bbe1e60b41de41f1fbe1e718a76c7`；1920×900；1645137字节。
- 建筑／地点：大礼堂；site：auditorium。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/E/C5/CB/171B5114C0D43E853B94AA5CE46_0BACEE5A_191A51.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### biology-hall-commons

- 本地路径：`references/biology-hall-commons.jpg`（研究副本可缺失）
- SHA256：`fc73f07e93bbc2b8d84f2f4399a63fab2435a94f61f10160e59f25ae46ebc671`；800×600；453834字节。
- 建筑／地点：生物学馆 · Courtyard原模型直接复用；site：biology-hall。
- 作者：cabbagezs；许可：CC-BY-SA-2.0（https://creativecommons.org/licenses/by-sa/2.0/）。
- 来源状态：已记录（不等于授权）。
- 来源页：https://commons.wikimedia.org/wiki/File:3_Tsinghua.jpg；原图：https://upload.wikimedia.org/wikipedia/commons/d/db/3_Tsinghua.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### chemistry-hall-2008-official

- 本地路径：`references/chemistry-hall-2008-official.jpg`（研究副本可缺失）
- SHA256：`146551c8445e792c821973b9f7a068333219c591b577136ca38c49872dd0259a`；369×281；24190字节。
- 建筑／地点：化学馆（1932年老馆）；site：chemistry-hall。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://polymers.chemeng.tsinghua.edu.cn/info/1504/2656.htm；原图：https://polymers.chemeng.tsinghua.edu.cn/__local/9/20/C7/70D48804DA2F9ED8E6369706773_EBA39597_5E7E.jpg?e=.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### chemistry-hall-2024-commons-review

- 本地路径：`references/chemistry-hall-2024-commons-review.jpg`（研究副本可缺失）
- SHA256：`c5359590e6c3b60737e2f0efdca4e666557003f8e15ea360449f7697718e144c`；2400×1800；1807825字节。
- 建筑／地点：化学馆（1932年老馆）；site：chemistry-hall。
- 作者：HoweyYuan；许可：CC-BY-SA-4.0（https://creativecommons.org/licenses/by-sa/4.0/）。
- 来源状态：已记录（不等于授权）。
- 来源页：https://commons.wikimedia.org/wiki/File:Chemistry_Building_of_Tsinghua_University.jpg；原图：https://upload.wikimedia.org/wikipedia/commons/4/46/Chemistry_Building_of_Tsinghua_University.jpg。
- 文件说明：本地审阅衍生图：按EXIF转正（若有）、等比缩小并以JPEG quality94编码；无内容修补，作者及CC BY-SA 4.0沿用原图。 原图：`references/chemistry-hall-2024-commons.jpg`。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：衍生图不重复算作新的原发布照片；这里只记录、不复制到跟踪档案。

### chemistry-hall-2024-commons

- 本地路径：`references/chemistry-hall-2024-commons.jpg`（研究副本可缺失）
- SHA256：`8c50cee3be1d46b2eedd7f64db132766bf1efbf4b09aaba8ff5c4f1697685b95`；8167×6125；11483733字节。
- 建筑／地点：化学馆（1932年老馆）；site：chemistry-hall。
- 作者：HoweyYuan；许可：CC-BY-SA-4.0（https://creativecommons.org/licenses/by-sa/4.0/）。
- 来源状态：已记录（不等于授权）。
- 来源页：https://commons.wikimedia.org/wiki/File:Chemistry_Building_of_Tsinghua_University.jpg；原图：https://upload.wikimedia.org/wikipedia/commons/4/46/Chemistry_Building_of_Tsinghua_University.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### chemistry-hall-front-commons-review

- 本地路径：`references/chemistry-hall-front-commons-review.jpg`（研究副本可缺失）
- SHA256：`789927df2ccf01efdd57ce552c5a6af9787716608715b51981d2c1dc7103bb54`；1800×2400；1800781字节。
- 建筑／地点：化学馆（1932年老馆）；site：chemistry-hall。
- 作者：葉又嘉；许可：CC-BY-SA-4.0（https://creativecommons.org/licenses/by-sa/4.0/）。
- 来源状态：已记录（不等于授权）。
- 来源页：https://commons.wikimedia.org/wiki/File:%E6%B8%85%E8%8F%AF%E5%A4%A7%E5%AD%B8%E5%8C%96%E5%AD%B8%E9%A4%A8.jpg；原图：https://upload.wikimedia.org/wikipedia/commons/c/c3/%E6%B8%85%E8%8F%AF%E5%A4%A7%E5%AD%B8%E5%8C%96%E5%AD%B8%E9%A4%A8.jpg。
- 文件说明：本地审阅衍生图：按EXIF转正（若有）、等比缩小并以JPEG quality94编码；无内容修补，作者及CC BY-SA 4.0沿用原图。 原图：`references/chemistry-hall-front-commons.jpg`。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：衍生图不重复算作新的原发布照片；这里只记录、不复制到跟踪档案。

### chemistry-hall-front-commons

- 本地路径：`references/chemistry-hall-front-commons.jpg`（研究副本可缺失）
- SHA256：`95589700e08e41894d02a3d099d8941741cdf64d051b470b0f885d5ccec743d8`；4032×3024；4005099字节。
- 建筑／地点：化学馆（1932年老馆）；site：chemistry-hall。
- 作者：葉又嘉；许可：CC-BY-SA-4.0（https://creativecommons.org/licenses/by-sa/4.0/）。
- 来源状态：已记录（不等于授权）。
- 来源页：https://commons.wikimedia.org/wiki/File:%E6%B8%85%E8%8F%AF%E5%A4%A7%E5%AD%B8%E5%8C%96%E5%AD%B8%E9%A4%A8.jpg；原图：https://upload.wikimedia.org/wikipedia/commons/c/c3/%E6%B8%85%E8%8F%AF%E5%A4%A7%E5%AD%B8%E5%8C%96%E5%AD%B8%E9%A4%A8.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### chemistry-hall-historic-official

- 本地路径：`references/chemistry-hall-historic-official.jpg`（研究副本可缺失）
- SHA256：`3dfb1ef940ee652ea966b7c6d96a6c5aff27660bf09774309d4ee5a2759d1e55`；305×235；27932字节。
- 建筑／地点：化学馆（1932年老馆）；site：chemistry-hall。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://100.chem.tsinghua.edu.cn/info/1017/1030.htm；原图：https://100.chem.tsinghua.edu.cn/__local/A/73/9C/1F8B82D313944AFD9921C54FB1D_F39A8BD6_6D1C.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### gongzi-entrance

- 本地路径：`references/gongzi-entrance.jpg`（研究副本可缺失）
- SHA256：`beedb2c36506279decd69edb82081326f9a06102950ecdf87ded1692cc8d083e`；1920×900；1880156字节。
- 建筑／地点：工字厅 · 水木清华；site：gongzi-shuimu。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/6/EE/80/9A065A38DF72F3F9F59F642B3BD_50D53E6D_1CB05C.jpg。
- 来源页：未确认；原图：https://www.tsinghua.edu.cn/__local/6/EE/80/9A065A38DF72F3F9F59F642B3BD_50D53E6D_1CB05C.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### library-courtyard-official

- 本地路径：`references/library-courtyard-official.png`（研究副本可缺失）
- SHA256：`d7fd42506465cebbd1303d0780b780ae705736f77afcf9612f6ab1941c0ef191`；1920×900；681632字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### life-hall-commons

- 本地路径：`references/life-hall-commons.jpg`（研究副本可缺失）
- SHA256：`4b32af6434ec03fe74fbbd7d85482ca8255c49f4e33c94dddc5fa7ddf69da9ab`；4032×3024；3476353字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### main-building-front

- 本地路径：`references/main-building-front.jpg`（研究副本可缺失）
- SHA256：`e744ad295f62abbee4c4c0cb2493ee3da0a375abb0a2bcea5880c7c0de9114fc`；1920×900；1444530字节。
- 建筑／地点：清华主楼；site：main-building。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/6/CD/0C/A270492322A02D71B51E60271CA_72BC2495_160AB2.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### music-hall-official

- 本地路径：`references/music-hall-official.jpg`（研究副本可缺失）
- SHA256：`80f960d006131ff74740acf5b3d34ab92a0952b939b5157d01ef33dbf43728ee`；750×335；113415字节。
- 建筑／地点：蒙民伟音乐厅；site：music-hall。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.hall.tsinghua.edu.cn/column/cdzl_mmwyyt；原图：https://www.hall.tsinghua.edu.cn/upload_files/image/1396753073355_3F.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### old-library-arch-snow

- 本地路径：`references/old-library-arch-snow.jpg`（研究副本可缺失）
- SHA256：`f32582e4270719e6e7c45fd2005291fbfba1728f58d0a20fc91a1c6541689b3a`；1600×1067；384241字节。
- 建筑／地点：老图书馆；site：old-library。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://lib.tsinghua.edu.cn/gk/gsfm/lg.htm；原图：https://lib.tsinghua.edu.cn/images/tushuguanlaoguanwaijingshuiyin.jpeg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### old-library-front

- 本地路径：`references/old-library-front.jpg`（研究副本可缺失）
- SHA256：`5e2e0a90bed2c98b349c92c3c3e072ba27d9a30de1aba0ae625cf10f442952f7`；1600×1067；290434字节。
- 建筑／地点：老图书馆；site：old-library。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://lib.tsinghua.edu.cn/gk/gsfm/lg.htm；原图：https://lib.tsinghua.edu.cn/images/laoguanwaijingshuiyin.jpeg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### old-library-night

- 本地路径：`references/old-library-night.jpg`（研究副本可缺失）
- SHA256：`3b0ad1ad785138248ac97dd806240f6185c0d96b75c85fbae89f24bb578a8530`；1600×1067；252772字节。
- 建筑／地点：老图书馆；site：old-library。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://lib.tsinghua.edu.cn/gk/gsfm/lg.htm；原图：https://lib.tsinghua.edu.cn/images/laoguanyejingshuiyin.jpeg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### science-hall-official-east

- 本地路径：`references/science-hall-official-east.png`（研究副本可缺失）
- SHA256：`abebdca24686de98f168ba47ebc258d97c271f0672ad8844e4c92100936f88db`；1920×900；669486字节。
- 建筑／地点：清华科学馆（1919年）；site：science-hall。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/C/0B/77/28AE6C8C1B44A60206B4268D9C5_F6A46B23_A372E.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### second-gate-front-official

- 本地路径：`references/second-gate-front-official.jpg`（研究副本可缺失）
- SHA256：`282d7d4d536acd7bf07a106f6dc85721cffa3789c885fe870aab4a342a9356ad`；1200×400；767421字节。
- 建筑／地点：二校门；site：second-gate。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/info/2116/81037.htm；原图：https://www.tsinghua.edu.cn/_mediafile/qh2021b/publish/newthu/9352/20150123092401876250100/20150123092417347995313.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### second-gate-gallery-b

- 本地路径：`references/second-gate-gallery-b.jpg`（研究副本可缺失）
- SHA256：`94b5f0cb22a8c0db86c2827ae81d205136656bb89581ca4f4372807f3c3a073b`；1500×1000；689531字节。
- 建筑／地点：二校门；site：second-gate。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/info/1183/94394.htm；原图：https://www.tsinghua.edu.cn/__local/1/63/BE/E6DAC008600170338C51AF67AA2_A30DA786_A857B.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### second-gate-modern-complete

- 本地路径：`references/second-gate-modern-complete.jpg`（研究副本可缺失）
- SHA256：`29e1ccd497e514329881f4bc8acd3fd8a7344e323f60ffb9eea703f478a44173`；3264×2448；2557300字节。
- 建筑／地点：二校门；site：second-gate。
- 作者：贾珺；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://xsg.tsinghua.edu.cn/info/1003/3153.htm；原图：https://xsg.tsinghua.edu.cn/__local/9/E9/9F/95C7625C7EEB88D4E0FAEEFB833_EB0EC5BE_270574.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### second-gate-official

- 本地路径：`references/second-gate-official.png`（研究副本可缺失）
- SHA256：`de4c267a4659bc6ad8264ee3c36ca84aac706cd8044c45c19dd2323a2171c04f`；1920×900；783180字节。
- 建筑／地点：二校门；site：second-gate。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/8/D3/34/464269BEDDBDCE7FE229998697D_A96F2368_BF34C.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### sem-campus-paper

- 本地路径：`references/sem-campus-paper.jpg`（研究副本可缺失）
- SHA256：`3303cf44821acabfc60772301a01813a5818be2cb9f77c93c860f885cef9ff0a`；1535×2087；2257427字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-exterior-official

- 本地路径：`references/sem-exterior-official.jpg`（研究副本可缺失）
- SHA256：`d6b25a2e7e9f13f4e33ca69f0750b1ed5f2b4fa688ede3c6aebbb9fb5a7aff9d`；9588×5295；41403860字节。
- 建筑／地点：新经管楼 · 建华／李华组团；site：sem-complex。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tuef.tsinghua.edu.cn/info/1072/2664.htm；原图：https://www.tuef.tsinghua.edu.cn/__local/6/EF/BF/674CB4C9F380C0671EF1EAC94B1_1FF450B3_277C5D4.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### sem-gensler-01

- 本地路径：`references/sem-gensler-01.jpg`（研究副本可缺失）
- SHA256：`a51676bfc46f8b4e9c9fdfee5709ce8176202b6d3ebca762ed1e670d864ab279`；2000×1125；504098字节。
- 建筑／地点：新经管楼 · 建华／李华组团；site：sem-complex。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.gensler.com/projects/tsinghua-university-school-of-economics-management；原图：https://static2.gensler.com/uploads/image/76194/project-tsinghua-university-school-of-economics-management-01-2000x1125_1656356061.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### sem-gensler-02

- 本地路径：`references/sem-gensler-02.jpg`（研究副本可缺失）
- SHA256：`43863be004c8f1d4223caf754b0503d92d3e18b4305eaa8ce959b880e227a767`；2000×1125；499590字节。
- 建筑／地点：新经管楼 · 建华／李华组团；site：sem-complex。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.gensler.com/projects/tsinghua-university-school-of-economics-management；原图：https://static2.gensler.com/uploads/image/76195/project-tsinghua-university-school-of-economics-management-02-2000x1125_1656356457.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### sem-gensler-03

- 本地路径：`references/sem-gensler-03.jpg`（研究副本可缺失）
- SHA256：`a3315ed509a25d7592ab34d688da7e9f322c89e40cc86f9d6c8b2e51f285560d`；2000×1334；476388字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-gensler-04

- 本地路径：`references/sem-gensler-04.jpg`（研究副本可缺失）
- SHA256：`7c8bbfdb0fc89370fa4b5aba99089e4cd5740438b4a447ea8b78c11e3f60e41a`；2000×1334；473620字节。
- 建筑／地点：新经管楼 · 建华／李华组团；site：sem-complex。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.gensler.com/projects/tsinghua-university-school-of-economics-management；原图：https://static1.gensler.com/uploads/image/76197/project-tsinghua-university-school-of-economics-management-04-2000x_1656356545.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### sem-gensler-05

- 本地路径：`references/sem-gensler-05.jpg`（研究副本可缺失）
- SHA256：`6e6fc3450ea95b633e27f424988ff7d2fde496ca2fe3af11c02bd954b5a7c4f5`；2000×1334；530991字节。
- 建筑／地点：新经管楼 · 建华／李华组团；site：sem-complex。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.gensler.com/projects/tsinghua-university-school-of-economics-management；原图：https://static1.gensler.com/uploads/image/76198/project-tsinghua-university-school-of-economics-management-05-2000x_1656356668.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### sem-gensler-06

- 本地路径：`references/sem-gensler-06.jpg`（研究副本可缺失）
- SHA256：`08d5a0930156af20ccf008e8b7a0339943b294cac1f1767586cd6d467ee62cd5`；1293×2000；588926字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-official-2

- 本地路径：`references/sem-official-2.jpg`（研究副本可缺失）
- SHA256：`abdb3593901a1280be88ad71466f8ed3597776aa825af3f19dd1835421c996f5`；3200×2133；2801645字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-official-3

- 本地路径：`references/sem-official-3.jpg`（研究副本可缺失）
- SHA256：`9d394f35cb62e080ea77a6af7bdedb28613391c581dbc570e4aa0c09bc2c1826`；3200×2133；2657811字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-official-4

- 本地路径：`references/sem-official-4.jpg`（研究副本可缺失）
- SHA256：`a2cbba6831d51e33aa5bbf38e930378e96159f2e4560afb26420bd1b3364a252`；3200×2133；3704136字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-official-north

- 本地路径：`references/sem-official-north.jpg`（研究副本可缺失）
- SHA256：`289e10715047503904badd97629b9e0944c6cb77bd349b7eff81f23fead12676`；5760×3840；12367578字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-tour-552

- 本地路径：`references/sem-tour-552.jpg`（研究副本可缺失）
- SHA256：`a2972ba1ad2e92f57a60999bc21d8aaa00e4c73434a3eb6a2c364239630c4edb`；500×543；16580字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-tour-553

- 本地路径：`references/sem-tour-553.jpg`（研究副本可缺失）
- SHA256：`01971d387670cfaca561a3026c2a0737473c48f5ff2ff8afb3d591948a70de73`；506×338；37875字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-tour-554

- 本地路径：`references/sem-tour-554.jpg`（研究副本可缺失）
- SHA256：`d38f22ccbbd3b79c4d0e0701dff9794d14bbbafa6f3c6b50ed3653c326581502`；530×354；35381字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-tour-566

- 本地路径：`references/sem-tour-566.jpg`（研究副本可缺失）
- SHA256：`f5b1aa3781e79a17a70cae4fb65eda37dca6c693ce0dce99cb84bec6a396332a`；548×365；20966字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-tour-567

- 本地路径：`references/sem-tour-567.jpg`（研究副本可缺失）
- SHA256：`48699b72c41b1c467f67ade2427f2fbf415a055822331999e97736d6bfb5d93d`；386×582；31477字节。
- 建筑／地点：新经管楼 · 建华／李华组团；site：sem-complex。
- 作者：李宙；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.thepaper.cn/newsDetail_forward_28552771；原图：https://imagepphcloud.thepaper.cn/pph/image/319/808/567.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### sem-tour-568

- 本地路径：`references/sem-tour-568.jpg`（研究副本可缺失）
- SHA256：`cd9e21ad1c977c10227d6ac5f79aac4197c0566cc0da6a05c45af7c78085411c`；551×368；44237字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### sem-tour-575

- 本地路径：`references/sem-tour-575.jpg`（研究副本可缺失）
- SHA256：`b42216b4d2c1418d0df30849363aad526b658c0ce5bca8e79f905a3eeb7371f8`；1080×1619；202571字节。
- 建筑／地点：未确认；文件名仅为查找线索；site：未确认／未注册。
- 作者：未确认；许可：未确认。
- 来源状态：未解决。
- 来源页／原图URL：均未确认，不臆造链接。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。
- 限制：未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。

### shuimu-pond-facade

- 本地路径：`references/shuimu-pond-facade.png`（研究副本可缺失）
- SHA256：`2308899a5680e1bd5a7342cbec37caa03e3954efeb499a8bfa89be9f17afada9`；1920×900；949347字节。
- 建筑／地点：工字厅 · 水木清华；site：gongzi-shuimu。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/D/AA/A5/A74F70F8B9CC639E5E2A3D1107B_5E7C943D_E7C63.png。
- 来源页：未确认；原图：https://www.tsinghua.edu.cn/__local/D/AA/A5/A74F70F8B9CC639E5E2A3D1107B_5E7C943D_E7C63.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### shunde-courtyard-oblique

- 本地路径：`references/shunde-courtyard-oblique.jpg`（研究副本可缺失）
- SHA256：`117f7e1c42e14852089bb6bd405c23364e6689b5b3742baa90f7c29c75bce53d`；1080×810；126604字节。
- 建筑／地点：舜德楼；site：shunde-building。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.sohu.com/a/462907673_641792；原图：https://p5.itc.cn/q_70/images03/20210425/5aa805cd596b4f3ca72eaff3450fb2dd.jpeg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### shunde-north-official

- 本地路径：`references/shunde-north-official.jpg`（研究副本可缺失）
- SHA256：`658e928f0af920c8a8a86f5aec24bd5eb956cd9dbd39b23f29e1303ad9975992`；1920×1281；599611字节。
- 建筑／地点：舜德楼；site：shunde-building。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://vr.tsinghua.edu.cn/jsdl1/1133.jhtml；原图：https://vr.tsinghua.edu.cn/u/cms/www/202410/23095758a7g3.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### sports-center-official

- 本地路径：`references/sports-center-official.jpg`（研究副本可缺失）
- SHA256：`7f1f55674dc0c5fce1e65e877be68b141e7cf53f1819e57a8a894b219aca4856`；1920×900；1569147字节。
- 建筑／地点：综合体育馆；site：sports-center。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/F/F9/68/A5A677B7D9B84F28D44A2452AFF_D369F59E_17F17B.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### taoli-dining-official

- 本地路径：`references/taoli-dining-official.png`（研究副本可缺失）
- SHA256：`b50977f44a242b5a0605c3ef44d8e962e2a05064d9f97ef718b68cb583ad5f09`；283×422；125756字节。
- 建筑／地点：桃李园餐厅；site：taoli-dining。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/ysfwzx/info/1004/1007.htm；原图：https://www.tsinghua.edu.cn/__local/F/99/FC/654E6DBFE7F3D3BDA100D2BE5E9_EA2CE88A_1EB3C.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### tongfang-history-massing

- 本地路径：`references/tongfang-history-massing.jpg`（研究副本可缺失）
- SHA256：`3d0cea9e54c8fe0c8993ad38f898a6482d5324133d80e56aa89be034e1b633d6`；551×396；103006字节。
- 建筑／地点：同方部；site：tongfang。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://xsg.tsinghua.edu.cn/info/1005/1128.htm；原图：https://xsg.tsinghua.edu.cn/__local/7/4B/C7/8468B9281B3B58A7D004CC38BF1_CE0CC824_1925E.jpg?e=.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### tongfang-official-2018

- 本地路径：`references/tongfang-official-2018.jpg`（研究副本可缺失）
- SHA256：`01ea63bab7a5cd9a39a6537b750a486e5a3705311be30adcc688b9d565a1b04a`；1920×900；2468341字节。
- 建筑／地点：同方部；site：tongfang。
- 作者：李派（摄影）；任帅（图片设计）；校史馆（素材）；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/info/1367/81660.htm；原图：https://www.tsinghua.edu.cn/_mediafile/qh2021b/publish/thu2018/11499/20180806120755067157037/20180806120918497951616.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### tsinghua-school-oblique

- 本地路径：`references/tsinghua-school-oblique.jpg`（研究副本可缺失）
- SHA256：`17ad9410b72c3cebc938c37d8b8594523d638bdacfa1a7b1fc3de66273707da1`；1920×900；803881字节。
- 建筑／地点：清华学堂；site：tsinghua-school。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/3/D6/43/55D1EDFDEEAC5CC4720BCF830F2_6E1BFFB2_C4429.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### west-gym-front

- 本地路径：`references/west-gym-front.jpg`（研究副本可缺失）
- SHA256：`5dcf310f80d92bbc95242af61a92d8866de77d990b55203f540b848a3d49d74c`；1920×900；1348420字节。
- 建筑／地点：西体育馆；site：west-gym。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/9/1E/D7/C040DA1D46F11C38237F81F8EF8_B3CC4C54_149344.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### zijing-dining-official

- 本地路径：`references/zijing-dining-official.png`（研究副本可缺失）
- SHA256：`7bb5ba997925ccb5ac07d7fe7e24013bd103b3b551ace99010160720782c16d3`；294×406；146624字节。
- 建筑／地点：紫荆园餐厅；site：zijing-dining。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/ysfwzx/info/1004/1007.htm；原图：https://www.tsinghua.edu.cn/__local/E/F2/39/31CF8CF6D736EEE08D7FC4D85F9_B14674D7_23CC0.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### zijing-dormitories-official

- 本地路径：`references/zijing-dormitories-official.jpg`（研究副本可缺失）
- SHA256：`281404088e289dc31ca8a7f7dc51b71062a374979fd3e1464a4a1388d8761e1d`；1920×900；2023812字节。
- 建筑／地点：紫荆学生公寓区；site：zijing-dormitories。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm；原图：https://www.tsinghua.edu.cn/__local/F/FD/71/5EF14317EE5BA6793F7B04DF53C_A4B2B5AD_1EE184.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### zijing-high-rise-official

- 本地路径：`references/zijing-high-rise-official.png`（研究副本可缺失）
- SHA256：`593ab29b1a5047b37e9d65dd8d85535ccab6d15f1a937ffb8cfd8b3b52aa4d88`；1024×468；931460字节。
- 建筑／地点：紫荆学生公寓区；site：zijing-dormitories。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/en/Campus/Student_Life/Housing___Dining.htm；原图：https://www.tsinghua.edu.cn/__local/1/04/88/40D809D18C7FA5B0E4B4490C5F9_6896CFF7_E3684.png。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

### zijing-w-official

- 本地路径：`references/zijing-w-official.jpg`（研究副本可缺失）
- SHA256：`88a06af40ee38544035b156a6d45c14d292b28f8388052bc8d3a0a97f6d5b82d`；650×420；279739字节。
- 建筑／地点：紫荆学生公寓区；site：zijing-dormitories。
- 作者：未确认；许可：未查得开放再分发许可。
- 来源状态：已记录（不等于授权）。
- 来源页：https://www.tsinghua.edu.cn/info/1708/70290.htm；原图：https://www.tsinghua.edu.cn/_mediafile/qh2021b/publish/thunews/9658/20190423101508247661875/1555986664346.jpg。
- 文件说明：原始保存字节；是否相机原片未知。
- 用途：仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。
- 限制：记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。
- 限制：照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。

## 邻项目与范围排除

references/下全部JPEG/PNG，包括未接入模型的研究照片与两张审阅衍生图；不包括字体、XML、自动生成截图和output/图库重复副本。

- `../shunde/references/sohu_old_2.jpg`：本机目录不存在；对应同SHA256照片已列为references/shunde-courtyard-oblique.jpg，未新增缺失副本。 线索：`../shunde/docs/courtyard/photo-correspondence.json`。
- `user_front`：metadata只有user_front标识及哈希，未记录原文件名；本机邻项目references目录不存在，不臆造本地路径或来源。 线索：`../shunde/docs/courtyard/photo-correspondence.json`。

同目录的字体/OFL及OSM XML不是照片，继续沿用原有许可和测试；output/的截图、拼图和图库副本不是新增原发布照片。

## 离线复核与更新

从仓库根执行：

```sh
node projects/tsinghua-campus/scripts/reference-library.mjs
node projects/tsinghua-campus/scripts/reference-library.mjs --require-local
node --test projects/tsinghua-campus/tests/building-history.test.mjs projects/tsinghua-campus/tests/reference-library.test.mjs
```

默认核验：每张仍存在的研究照片都验证SHA256、字节数和尺寸；缺失研究照片明确计入optionalMissing；三张文档档案必须存在并匹配；新出现但未登记照片或未批准档案会失败。--require-local要求全部研究原件在场。

维护者确认新增照片证据后才运行--snapshot；--archive仅复制预先批准的原图且校验哈希；--write-docs从冻结JSON生成本页及BUILDING-HISTORY.md。不要把这些维护操作加入普通构建或测试。

发布完成构建后可额外运行`node projects/tsinghua-campus/scripts/reference-library.mjs --published output/pages`排查已登记原始像素或reference-photos目录泄漏。该检查不替代人工检查二次压缩、重命名衍生图和打包内嵌图像。
