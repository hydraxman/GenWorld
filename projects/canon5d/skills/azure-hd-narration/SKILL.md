---
name: azure-hd-narration
description: Use when regenerating this project's Xiaoxiao2 narration. Preserve approved text, slots and paid audio.
---

# Xiaoxiao2固定时槽旁白

项目当前已有完整付费WAV，默认复用，不因归档或验证再次请求Azure。

1. 先读 `../../docs/CORE-PARAMETERS.md` 与 `../../docs/CODE-AND-RUN.md`。执行代码是项目内 `film45/replacement-v3/audio/prepare_voice.py`，辅助客户端是 `film45/xiaoxiao2/synthesize_azure.py`。
2. Voice ID固定为 `zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural`；新生成前查询实际region语音目录，不构造ID、不偷偷回退其他音色。
3. 精确保留原11段文案/时槽，使用支持的最小SSML。服务默认语速与后处理atempo必须区分。
4. 付费原始WAV、SSML和请求元数据先保存；新任务单独目录，不覆盖已有raw。测量后用保音调atempo适配，上限1.45，超限停下而不是删字、截尾。
5. 48kHz单声道16bit PCM按样本定位，保留尾部停顿和峰值余量；最终视频逐段与源WAV关联验证。
6. 不导出密钥。CLI登录、资源权限、语音可用性和实际合成成功是不同检查。
7. Provider Female、请求来源、音轨一致、人工听感、远端文件一致分别记录，不能互相替代。

[原Azure HD时序与审计参考快照](references/hd-flash-word-timing.md)
