# 配音与字时序

## 默认使用已有音频

普通版和卫星版共用 `audio/approved-narration.m4a`，不需要 Azure 凭据，也不会因切换底图重新配音。15 段源 WAV、实际 SSML、边界 JSON 与 `audio/manifest.json` 用于追溯文本、读音、时长和合成设置。`narration.json` 是旁白脚本，`timing.json` 记录批准版的插入帧和对联字时序。

角色固定为 `zh-CN-XiaoxiaoNeural`。日常导览采用 `friendly` / `gentle`，对联采用 `poetry-reading`。各段 rate、pitch 与停顿以已保存的 SSML 为准；“原速”指保留批准的合成结果，不是把已有 SSML 的语速参数全部改成零。

以下起始帧来自 `timing.json`，24 fps，以第 0 帧为时间原点。它们是批准版的音频位置，不是景点画面开始帧。

| ID | 内容 | 风格 | 音频起始帧 |
| --- | --- | --- | ---: |
| `intro` | 开场 | friendly | 12 |
| `main` | 新主楼 | friendly | 493 |
| `shunde` | 舜德楼 | friendly | 1130 |
| `gate` | 二校门 | friendly | 1688 |
| `sundial` | 日晷 | gentle | 2219 |
| `school` | 清华学堂 | friendly | 2768 |
| `auditorium` | 大礼堂 | friendly | 3334 |
| `shuimu` | 水木清华 | gentle | 3926 |
| `couplet` | 水木清华对联 | poetry-reading | 4482 |
| `gongzi` | 工字厅 | gentle | 5036 |
| `jinchun` | 近春园 | gentle | 5615 |
| `gym` | 西体育馆 | friendly | 6189 |
| `library` | 老图书馆 | gentle | 6792 |
| `canteen` | 紫荆园食堂 | friendly | 7452 |
| `outro` | 收尾 | friendly | 7957 |

17 秒前快后慢只作用于开场镜头。音频不跟随 `intro-remap.json` 重映射，不使用 `atempo` 或整体变速；开场旁白可在聚焦镜头结束后继续播放。无声音修改时，导出复制原 AAC，并验证音轨比特流保持不变。

## 对联正文和发音

观者右列为上联、左列为下联；先右后左，每列由上至下。正文共 34 字，不包括标点：

> 槛外山光历春夏秋冬万千变幻都非凡境
>
> 窗中云影任东西南北去来澹荡洵是仙居

出处见 [SOURCES.md](SOURCES.md)。书法使用 Ma Shan Zheng 字体做逐字动画，不冒充原木联手迹。保留“槛”“澹荡”“洵”的正文，不能为读音方便把画面文字替换成同音字。

已批准 SSML 通过 `<sub>` 调整读音：

| 正文 | SSML alias | 读音 |
| --- | --- | --- |
| 槛 | 剑 | jiàn |
| 澹荡 | 淡荡 | dàn dàng |
| 洵 | 寻 | xún |

对联使用 `rate="-12%"`、句间停顿与上下联间较长停顿。完整设置读 `audio/couplet.ssml`；不要仅凭正文标点重建。`timing.json` 的 `couplet.characters` 以 Azure WordBoundary 为锚点，在多字词事件内部等分，并将 alias 还原为规范正文。因此它是经音频边界辅助的字级显示时间，不是服务返回了每个字的独立精确对齐。

检查每个字的显示边界、上下联交接、末字保留时长以及“槛、澹荡、洵”的实际发音。自动计数正确仍需看编码画面并听完整段落。

## 必须保留的实用提醒

收尾原文包含：

> 实际游览请提前确认入校预约，并遵守校园现场的开放与通行安排。食堂的访客用餐方式，也请提前向校方确认。

食堂段还保留：

> 如果当天允许访客用餐，就选一份合口味的饭菜，坐下来歇歇。

增补历史介绍或调整语气时保留这些批准文本和最终音频内容。不能为了缩短时长删掉预约提醒，不能改写成保证入校或保证访客可用餐。实际开放与支付安排仍需向校方确认。

## 可选：重新合成

**重新配音是另一次制作，不是复现原 V5 的必需步骤。** 可选再合成客户端固定为 Speech SDK 1.51.0，已避开旧版 `uuid` 的安全公告；原有 WAV / AAC 不因客户端升级而重做。即使文本、角色和 SSML 不变，服务重新生成的时长与边界也可能变化，不能声称与原音轨逐字节相同。

1. 在当前进程的安全环境中提供 `AZURE_SPEECH_KEY` 与 `AZURE_SPEECH_REGION`，不把值写进源码、日志、文档或命令示例。不需要合成时不要设置凭据或调用服务。
2. 在项目目录执行显式合成，产物写入新目录，避免覆盖批准版：

   ```sh
   node tools/synthesize.cjs --output output/new-audio --synthesize
   ```

3. 按新 WAV 的真实时长建立时间表，再按新表混音：

   ```sh
   python3 tools/build_timing.py --audio-dir output/new-audio --output output/new-timing.json
   python3 tools/mix_audio.py --timing output/new-timing.json --output output/new-narration.wav
   ```

4. 检查全部十五段合成结果、风格、读音和时槽。重建对联边界，确认 `couplet.characters` 与新音频匹配，不复制旧字时序凑数。核对 34 字正文、停顿、句尾和提醒。没有有效边界数据时应停止逐字动画制作并报告缺项。
5. 上述命令生成的是独立的新音频和时间表，**不会自动把已批准视频替换为新版**。确认新时序如何接入捕获和导出后，再按新输入重新冻结、捕获、编码；不能让新 WAV 配旧 `timing.json`，也不能让导出仍复制旧 `approved-narration.m4a`。如需替换批准输入，先单独保存原版并取得确认。

新版本的总时长与帧数必须重新测量，不能继续套用 V5 的 8525 帧验收值。

## 音频验收

验证本次编码文件中的每一段，按对应版本的起始帧定位并与源 WAV 比较波形；容器中有 AAC 流只能证明存在音轨，不能证明内容和位置正确。逐段听完，检查开头、句尾、静音间隔、串段、削波与对联读音。保留 ID 对应的实际检查结果，不用单段抽检代替十五段全量检查。

只改画面的版本还需比较提取后原 AAC 与导出 AAC 的比特流哈希。重新配音的版本应保存自己的 WAV / SSML / 边界 JSON、时间表及新混音结果，并明确注明原 AAC 相等检查不适用。测试与当前运行结果以实际命令输出为准，不从旧验收记录推断新版本已通过。
