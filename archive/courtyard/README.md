# Courtyard 历史源码增量

当前维护入口是 `projects/courtyard/` 和 `shared/`。这里不是五个可运行工程副本，只保存清理前尚未进入 Git 的独有历史源码、说明和小型验收记录；重复文件通过 Git blob 引用，不再复制。

- `legacy/`：去重后的历史文本，保留原字节和文件名，不覆盖当前实现。旧脚本可能引用历史布局，不应在当前位置直接运行。
- `source-snapshots.json`：五个版本的逐文件恢复清单；`archive_file` 指向仓库相对路径，`git_blob` 用 `git cat-file blob <oid>`读取，`local_only_asset` 指向被忽略的本地参考图。恢复到单独临时目录后逐项检查 SHA-256。
- `archive-manifest.json`：本次导入文本的指纹。

旧版相机、池底结构和叶片方案均不代表当前批准版本。V4 的36秒原编码片段仍被根目录历史 `finalize-video.py` 使用，放在 `local-assets/courtyard/legacy-v4/`；V5已交付GLB放在 `local-assets/courtyard/deliverables/`。这些媒体和用户参考图只留本地，不进入Git。
