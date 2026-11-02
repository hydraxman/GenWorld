# 建筑历史与知识卡数据

核验日期：2026-11-02。本页由 `data/building-history.json` 生成；事实以短篇原创中文转述，不复制来源文章。

## 读取契约与范围

`src/building-history.js` 导出 `historyForSite(site)`、`HISTORY_SOURCES`（sources的同一只读数组）、`sources`、`entries`、`reviewedAt`、`validateBuildingHistory(data, {knownSites})`。只按精确 `referenceSite` / `appearanceReferenceSite` 查找；未知或缺失返回 `null`，不做名称模糊匹配。错误记录在模块加载时抛出，已导出的数据深冻结。

UI先读取对象的referenceSite，再读取appearanceReferenceSite；使用textContent渲染纯文本，以sourceIds解析来源链接。null显示“尚无已核实建筑史”，不能显示成“没有历史”。同一site可对应多个地图根，但组团事实不能变成每栋的竣工年份。

本次限定19个主要地点；未核实的照片外观地点不附会年代。无建筑文字证据时architecture为空，并在limitations明确说明。source.accessedAt是本次读取日期，reviewedAt是数据审阅日期，不是网页发表或建筑完成日期。

校方公开网页在web_fetch中遇到本机DNS地址限制后，使用Python HTTPS读取同一公开URL核验；没有依赖搜索摘要作为事实证据。部分来源仅有建筑概况，没有准确开工或开馆日，保持未知。

照片权限、完整逐文件表及离线核验见 [参考照片库](REFERENCE-LIBRARY.md)；文字可引用不意味着照片可转载。模型形体与历史事实分别核验，本数据不提高照片重建覆盖率。

## 逐处事实

### 大礼堂

键：`auditorium`

早期校园的集会建筑，与老图书馆、西体育馆、科学馆并称“四大建筑”。

- **建成**：档案馆记述大礼堂于1920年建成；此后同方部继续承担小礼堂功能。（[清华第一个礼堂 · 清华大学档案馆](https://dag.tsinghua.edu.cn/info/1062/2581.htm)）
- **校园地位**：大礼堂属于早期“四大建筑”，长期用于会议、讲座和演出。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **建筑**：穹顶与开敞的大跨空间构成主体，入口采用爱奥尼克柱式门廊。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **边界／未知**：本条未核实奠基日期、历次修缮和实测尺寸；建成年份不代表照片拍摄年份。

### 二校门

键：`second-gate`

清华早期正门的纪念性重建；今天所见不是1911年的原构件。

- **原门落成**：原校门于1911年落成，那桐题写“清华园”匾额。（[清华大学二校门的沧桑往事 · 清华大学校史馆](https://xsg.tsinghua.edu.cn/info/1003/3153.htm)）
- **名称变化**：1933年西校门修建后，原正门被称为“二校门”。（[清华大学二校门的沧桑往事 · 清华大学校史馆](https://xsg.tsinghua.edu.cn/info/1003/3153.htm)）
- **拆毁与重建**：原门1966年被拆毁；校友支持的重建于1991年4月八十周年校庆前完成。（[清华大学二校门的沧桑往事 · 清华大学校史馆](https://xsg.tsinghua.edu.cn/info/1003/3153.htm)）
- **建筑**：三个拱券门洞以中央大、两侧小组织立面，校史馆将其样式归为巴洛克式。（[清华大学二校门的沧桑往事 · 清华大学校史馆](https://xsg.tsinghua.edu.cn/info/1003/3153.htm)）
- **边界／未知**：现门为依据旧照片重建的建筑，不能将原门建成年份当作现存构件年代；本条不认定模型字形等同原题字。

### 清华学堂（老学堂）

键：`tsinghua-school`

清华早期教学建筑，承载留美预备教育与国学研究的历史。

- **早期建筑**：档案馆将一院大楼（清华学堂）列入1911年建成的首批校舍。（[清华第一个礼堂 · 清华大学档案馆](https://dag.tsinghua.edu.cn/info/1062/2581.htm)；[清华大学二校门的沧桑往事 · 清华大学校史馆](https://xsg.tsinghua.edu.cn/info/1003/3153.htm)）
- **办学沿革**：清华学堂于1911年4月29日开学；1925年设立大学部和国学研究院。开学与机构设立不等于建筑新建。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **建筑**：校方将老学堂的外观概括为具有德国古典风格，位置在工字厅东侧。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **边界／未知**：不是百年校庆期间建成的新清华学堂；未核实各次扩建、火灾修复及现存构件年代。

### 老图书馆（一期、二期）

键：`old-library`

1919年一期与1931年二期共同组成老馆，不能将今天相连的馆舍整体归入同一年代。

- **一期**：一期1916年动工、1919年建成，由亨利·墨菲设计。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **二期**：杨廷宝主持的二期扩建于1931年竣工，与一期合称老馆。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **后续馆舍**：逸夫馆（西馆）1991年建成，李文正馆（北馆）2016年投入使用，均为关肇邺设计。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **建筑**：相连馆舍分期建设，校方强调各期风格协调，同时保留不同时期的建筑细节。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **边界／未知**：场景根为历史与现代连通组团；本条老馆年代只适用于一期、二期，不适用于整个根。模型只细化老馆入口及邻翼。

### 西体育馆

键：`west-gym`

早期“四大建筑”之一，由前馆与后馆分期形成。

- **前馆**：前馆建于1916—1919年，墨菲设计，泰来洋行施工。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **后馆**：后馆建于1931—1932年，不应把两期合并为一次建成。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **修缮与再利用**：2009年启动加固维修，2010年竣工；原室内游泳馆改作体育荣誉室，2011年4月开放。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **建筑**：前馆原设篮球场、80码悬空跑道等运动设施，并附室内游泳池。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **边界／未知**：不与2000年建成的综合体育馆混同；前后馆年代分界和各期立面未在模型中逐面复核。

### 工字厅与水木清华

键：`gongzi-shuimu`

工字厅为建校前园林建筑；水木清华正廊是其北侧后厦临池部分，不是另一座新楼。

- **早期用途**：工字厅原称工字殿，是建校前清华园的主体建筑。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **学校历史**：1911年4月29日清华学堂开学仪式在工字厅举行；1924年泰戈尔访校时曾在此下榻。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **建筑**：前后两殿由短廊相连，平面近似“工”字，名称由此而来。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **建筑**：水木清华位于工字厅北侧，荷池南岸的正廊原为工字厅后厦。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **边界／未知**：主殿与南门房两个场景根共享此组团史；不把组团历史自动归给每个构件。未确认精确始建年代、匾额作者争议与各期修复界线。

### 科学馆

键：`science-hall`

大礼堂西南的历史科学馆，是清华早期理科教学科研的重要场所。

- **落成**：科学馆由墨菲设计，于1919年落成。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **学科沿革**：1929年清华理学院在此成立；科学馆长期作为物理系馆使用。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **建筑**：校方记载其为钢筋混凝土框架结构，外观采用红墙、灰顶和黄铜大门。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **边界／未知**：不是生物学馆、伟伦生命科学馆或科学博物馆；本条不将院系创立年份当作建筑竣工年份。

### 老生物学馆

键：`biology-hall`

1930年建成的生物学馆，与今天北侧伟伦馆保持独立身份。

- **学科成立**：清华生物系于1926年秋正式成立，首任系主任为钱崇澍。（[历史沿革 · 清华大学生命科学学院](https://life.tsinghua.edu.cn/xygk/lsyg.htm)）
- **建成**：生命学院历史沿革明确记载：1930年夏建成生物学馆，同期正式成立理科研究所生物学部。（[历史沿革 · 清华大学生命科学学院](https://life.tsinghua.edu.cn/xygk/lsyg.htm)）
- **名称辨别**：生命学院历史图片栏目将“生物学馆”和“伟伦馆”分别列出。（[三张图片 · 清华大学生命科学学院](https://life.tsinghua.edu.cn/xygk/lsyg/sztp.htm)）
- **边界／未知**：本次一手文字语料未确认设计师、结构体系或各立面尺度，故不补造建筑风格说明。不是1998年伟伦生命科学馆；原Courtyard复用范围和约34米模型宽度不能代替约70米地图轮廓的测绘。

### 老化学馆

键：`chemistry-hall`

化学系百年系庆史料中的1932年老馆，不是新化学馆或何添楼。

- **建成**：化学系照片历史栏目明确记载：化学馆于1932年12月建成。（[1932年 · 清华大学化学系百年系庆专题网](https://100.chem.tsinghua.edu.cn/info/1017/1030.htm)）
- **边界／未知**：该史料未给出设计师、开工日期或结构体系，故不据照片猜测。页面配图的拍摄日期未确认；1932年12月是建筑建成年月。

### 同方部

键：`tongfang`

清华最早的礼堂，后成为讲演、社团与小型集会场所。

- **建成**：档案馆将同方部列为1911年建成的首批建筑。（[清华第一个礼堂 · 清华大学档案馆](https://dag.tsinghua.edu.cn/info/1062/2581.htm)）
- **命名**：1923年学校成立德育指导部后，这处建筑有了“同方部”的名称。（[清华第一个礼堂 · 清华大学档案馆](https://dag.tsinghua.edu.cn/info/1062/2581.htm)）
- **校史事件**：1914年梁启超在这里作《君子》演讲，以自强不息、厚德载物勉励学生。（[清华第一个礼堂 · 清华大学档案馆](https://dag.tsinghua.edu.cn/info/1062/2581.htm)）
- **建筑**：灰砖墙、红瓦坡顶；西部单层，东部两层。南侧是正面门廊，匾额悬于朝向草坪的西门。（[清华第一个礼堂 · 清华大学档案馆](https://dag.tsinghua.edu.cn/info/1062/2581.htm)）
- **边界／未知**：西门照片不能证明南门廊细部；不将建筑与清华同方公司混为一体。

### 主楼组团

键：`main-building`

西、东、中央主楼分期建设，三部分经连接体组成校园东区的主楼组团。

- **分期动工**：西主楼1956年动工，东主楼1957年动工，中央主楼1960年开始施工。（[《清华风物》之“主楼” · 清华大学](https://www.tsinghua.edu.cn/info/2060/61191.htm)）
- **中央楼建成**：中央主楼于1966年5月建成；2001年又加盖两层。（[《清华风物》之“主楼” · 清华大学](https://www.tsinghua.edu.cn/info/2060/61191.htm)）
- **设计参与**：清华多个专业、跨七个年级的师生参与设计，校方列举高亦兰、关肇邺、殷一和等代表。（[《清华风物》之“主楼” · 清华大学](https://www.tsinghua.edu.cn/info/2060/61191.htm)）
- **建筑**：组团坐北朝南，校方将其归为苏联风格，由西、东、中央三部分及四个过街楼联系。（[《清华风物》之“主楼” · 清华大学](https://www.tsinghua.edu.cn/info/2060/61191.htm)）
- **边界／未知**：三个独立场景根可共享组团史；1966年5月是中央楼建成时间，不等于东西楼各自竣工时间。模型未核实的连接体仍不补造。

### 舜德楼及相邻伟伦楼

键：`shunde-building`

舜德楼2003年投入使用；相邻经管伟伦楼更早建成，不能混用两楼年代。

- **舜德楼**：舜德楼于2000年奠基、2003年投入使用，伍舜德捐赠了部分建设资金。（[经管家园变迁记 · 清华大学经济管理学院](https://yuanqing.sem.tsinghua.edu.cn/sem30/info/1033/1310.htm)）
- **相邻伟伦楼**：经管伟伦楼1995年开工奠基，1997年5月落成，由清华大学建筑设计研究院设计。（[经管家园变迁记 · 清华大学经济管理学院](https://yuanqing.sem.tsinghua.edu.cn/sem30/info/1033/1310.htm)）
- **边界／未知**：场景是舜德／伟伦组合院落，资料中的伟伦楼设计单位不能直接套给舜德楼；不是生命学院的伟伦馆。本次未核实舜德楼设计师及建筑结构。

### 新经管楼（建华楼／李华楼）

键：`sem-complex`

建华楼与李华楼共同组成新经管楼，2022年正式启用。

- **组团组成**：建华楼以教学及清华x-lab空间为主；李华楼以科研办公为主。（[基建项目|经济管理学院新楼 · 清华大学教育基金会](https://www.tuef.tsinghua.edu.cn/info/1072/2664.htm)）
- **正式启用**：教育基金会记载新楼2022年正式启用，同年获得LEED金级认证。（[基建项目|经济管理学院新楼 · 清华大学教育基金会](https://www.tuef.tsinghua.edu.cn/info/1072/2664.htm)）
- **建筑**：官方组团数据为总建筑面积66000平方米、地上六层、地下三层、建筑高度30米。（[基建项目|经济管理学院新楼 · 清华大学教育基金会](https://www.tuef.tsinghua.edu.cn/info/1072/2664.htm)）
- **边界／未知**：面积、层数和高度是新楼组团数据，不是每个局部体块的独立测绘；本条不将通舜德的模型连廊认作建华—李华之间的连桥，也不推断其精确尺寸。

### 清华大学艺术博物馆

键：`art-museum`

马里奥·博塔主持建筑设计的大学博物馆，兼顾陈列、收藏保护、研究与交流。

- **建设支持**：2013年1月，世纪金源集团出资支持艺术博物馆建设；此日期是捐助事件，不是开馆日期。（[建筑概况 · 清华大学艺术博物馆](https://www.artmuseum.tsinghua.edu.cn/aboutus/cgxx/jz/)）
- **建筑**：馆舍由马里奥·博塔主持设计，功能空间同时服务展示、收藏保护、研究和文化交流。（[建筑概况 · 清华大学艺术博物馆](https://www.artmuseum.tsinghua.edu.cn/aboutus/cgxx/jz/)）
- **建筑**：库房环境可以分区控制温湿度，以适应不同藏品的保护需要。（[建筑概况 · 清华大学艺术博物馆](https://www.artmuseum.tsinghua.edu.cn/aboutus/cgxx/jz/)）
- **边界／未知**：本条所核实建筑概况页未给出开工、竣工或开馆的精确日期，不以捐助年份代替；不等同美术学院教学楼。

### 综合体育馆

键：`sports-center`

2000年建成的综合体育馆，曾承担世界大学生运动会比赛及北京奥运会训练任务。

- **建成**：综合体育馆于2000年建成。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **赛事用途**：2001年用作第21届世界大学生运动会男子篮球比赛场馆；2008年用作男子篮球和轮椅篮球训练场馆。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **建筑**：官方介绍给出的总建筑面积为12547.85平方米，观众席为4502个。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **边界／未知**：不是西体育馆或陈明游泳馆；本次文字来源没有确认设计师、拱架剖面和屋顶结构尺寸。

### 蒙民伟音乐厅

键：`music-hall`

专业演出与会议场馆，与百年校庆文化设施新清华学堂同期落成使用。

- **捐建**：由香港信兴教育及慈善基金会捐资建设，该基金会前主席为校友蒙民伟。（[蒙民伟音乐厅（场地资料） · 清华大学艺术教育中心演出官网](https://www.hall.tsinghua.edu.cn/column/cdzl_mmwyyt)）
- **落成关系**：场馆官网说明音乐厅与新清华学堂同期落成并投入使用；校方将后者列为百年校庆期间建成的设施。（[蒙民伟音乐厅（场地资料） · 清华大学艺术教育中心演出官网](https://www.hall.tsinghua.edu.cn/column/cdzl_mmwyyt)；[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **建筑**：李道增主持设计，观众厅设491席，并配置专业灯光、音响和舞台机械。（[蒙民伟音乐厅（场地资料） · 清华大学艺术教育中心演出官网](https://www.hall.tsinghua.edu.cn/column/cdzl_mmwyyt)）
- **边界／未知**：不将“同期”推成未经核实的具体开馆日；不是蒙民伟人文楼或学生活动中心，也不包含照片中的相邻新清华学堂。

### 紫荆学生公寓区

键：`zijing-dormitories`

校园北部的住宿组团；W形博士生公寓与国际学生公寓应区分理解。

- **组团用途**：校方校园景观介绍区分本科生、研究生、留学生等住宿区域，并说明W楼因平面排列形似字母W得名。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **国际公寓范围**：英文住宿说明将紫荆19—23号楼列入国际学生公寓，同时另列亚洲青年交流中心6号楼。（[Housing & Dining · 清华大学](https://www.tsinghua.edu.cn/en/Campus/Student_Life/Housing___Dining.htm)）
- **建筑**：校方将紫荆主体建筑概括为徽派建筑，W形排列是其中博士生公寓组团的特点。（[校园景观 · 清华大学](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)）
- **边界／未知**：这是组团介绍，不证明每栋采用同一造型或建成于同一年。本次未核实各楼开工、竣工及设计师；亚洲青年交流中心6号楼不是紫荆6号楼，18号楼不自动归入19—23国际公寓组。

### 紫荆园食堂

键：`zijing-dining`

位于紫荆学生公寓区的餐饮设施，官方层数包含地下层。

- **服务位置**：饮食服务中心将紫荆园食堂定位于校园东北角的紫荆学生公寓区。（[学生食堂 · 清华大学饮食服务中心](https://www.tsinghua.edu.cn/ysfwzx/info/1004/1007.htm)）
- **建筑**：官方记载共五层，其中一层地下；地上层数因此为四层，不能把五层全部建到地面上。（[学生食堂 · 清华大学饮食服务中心](https://www.tsinghua.edu.cn/ysfwzx/info/1004/1007.htm)）
- **边界／未知**：该来源未给出开业、竣工或设计师资料，本条不猜建造年份；小幅识别图不证明完整立面与入口朝向。

### 桃李园食堂

键：`taoli-dining`

2004年开始正式供餐的校园食堂；供餐时间不自动等同工程竣工日。

- **开始供餐**：桃李园于2004年8月6日开始正式供餐。（[学生食堂 · 清华大学饮食服务中心](https://www.tsinghua.edu.cn/ysfwzx/info/1004/1007.htm)）
- **建筑**：官方记载面积9696平方米，共四层、含地下一层，即地上三层。（[学生食堂 · 清华大学饮食服务中心](https://www.tsinghua.edu.cn/ysfwzx/info/1004/1007.htm)）
- **边界／未知**：未核实开工、竣工和设计师；供餐日与工程完成日分开处理，模型不包含地下室。

## 来源登记

- `campus-landscape`：[校园景观](https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm)；清华大学；访问：2026-11-02。
- `first-auditorium`：[清华第一个礼堂](https://dag.tsinghua.edu.cn/info/1062/2581.htm)；清华大学档案馆；访问：2026-11-02。
- `second-gate-history`：[清华大学二校门的沧桑往事](https://xsg.tsinghua.edu.cn/info/1003/3153.htm)；清华大学校史馆；访问：2026-11-02。
- `main-building-history`：[《清华风物》之“主楼”](https://www.tsinghua.edu.cn/info/2060/61191.htm)；清华大学；访问：2026-11-02。
- `biology-timeline`：[历史沿革](https://life.tsinghua.edu.cn/xygk/lsyg.htm)；清华大学生命科学学院；访问：2026-11-02。
- `biology-identities`：[三张图片](https://life.tsinghua.edu.cn/xygk/lsyg/sztp.htm)；清华大学生命科学学院；访问：2026-11-02。
- `chemistry-1932`：[1932年](https://100.chem.tsinghua.edu.cn/info/1017/1030.htm)；清华大学化学系百年系庆专题网；访问：2026-11-02。
- `sem-homes`：[经管家园变迁记](https://yuanqing.sem.tsinghua.edu.cn/sem30/info/1033/1310.htm)；清华大学经济管理学院；访问：2026-11-02。
- `sem-new-building`：[基建项目|经济管理学院新楼](https://www.tuef.tsinghua.edu.cn/info/1072/2664.htm)；清华大学教育基金会；访问：2026-11-02。
- `museum-building`：[建筑概况](https://www.artmuseum.tsinghua.edu.cn/aboutus/cgxx/jz/)；清华大学艺术博物馆；访问：2026-11-02。
- `music-venue`：[蒙民伟音乐厅（场地资料）](https://www.hall.tsinghua.edu.cn/column/cdzl_mmwyyt)；清华大学艺术教育中心演出官网；访问：2026-11-02。
- `housing-dining`：[Housing & Dining](https://www.tsinghua.edu.cn/en/Campus/Student_Life/Housing___Dining.htm)；清华大学；访问：2026-11-02。
- `student-dining`：[学生食堂](https://www.tsinghua.edu.cn/ysfwzx/info/1004/1007.htm)；清华大学饮食服务中心；访问：2026-11-02。
