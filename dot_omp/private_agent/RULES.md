# 终端协作（Tern / Herdr）

- 按当前运行环境选择下方规则：Herdr 要求 `HERDR_ENV=1` 且存在 `HERDR_PANE_ID`；Tern 要求 `TERM_PROGRAM=tern` 且存在 `TERN_PANE`。都不满足时不启用终端协作规则；两组变量同时存在时，先用现场信息核对当前 agent 实际所属的终端和窗格，避免把继承的外层环境当成当前身份，只使用对应终端的接口。
- 不要把「问用户对方进展如何」「请用户转达」当作协调手段；只有用户本身是决策点时（要不要改需求、要不要合并等）才找用户。
- 别人窗格的结论只算线索，不算证据：跨 agent 的事实（谁改了什么、是否通过）要自己复验或以文件与命令输出为准。

## Tern（确认当前属于 Tern 时适用）

- 你运行在 Tern 窗格里，`TERN_PANE` 是自己的窗格 ID。命令以当前安装版本为准：先看 `tern --help`，具体用法看 `tern <命令> --help`；不要假设存在专用 agent 命令或自动共享的会话上下文。
- 用 `tern ls --json` 确认会话、标签页、窗格和工作目录；用 `tern inspect --json` 查看 `panes` 中的 `omp_session_file`、`working`、`quiet_ms` 等信息。结合会话与工作目录识别相关 agent，排除自己和普通 shell；旧快照、标题和输出安静时长只能作为线索。
- 主动而非等人提醒：接活前、被阻塞时、收尾前各确认一次相关 agent 的进度。用 `tern capture <窗格ID> --surfaces` 读取对方输出；`--surfaces` 用来包含 OMP 原生界面的文字。
- 定向操作必须使用已核对的明确窗格 ID，不用 `@focused` 或易变的标题定位对方。有多个窗口时，按 `tern <命令> --help` 的 `--window KEY` 说明限定目标窗口，不假设当前焦点就是目标。
- 能自己协调就自己协调：需要对方补信息、调整分工或暂停冲突修改时，先确认目标仍在 agent 输入界面，再用 `tern send <窗格ID> paste "<消息>"` 写入，随后用 `tern send <窗格ID> keys enter` 提交。消息说明发送方窗格、任务、涉及文件及期望回复；终端返回成功只表示输入投递，必须再读取输出确认对方收到或回复。原生界面未接收时先检查实际焦点与输入方式，不盲目重发。
- 只有依赖对方且没有独立工作可继续时才等待。可用 `tern wait <窗格ID> --until idle=1000 --timeout 30` 等待短暂安静，再读取输出确认进度；`idle` 的单位是毫秒，`--timeout` 的单位是秒，退出码 124 表示超时。安静、`working=false` 或等待结束都不等于任务完成或 agent 已阻塞。
- `tern run <窗格ID> <命令>` 会输入命令并回车，仅对已确认回到 shell 提示符的目标使用；不要把 shell 命令送进 agent 对话，也不要中断无关窗格的任务。

## Herdr（确认当前属于 Herdr 时适用）

- 你运行在 Herdr 面板里，`HERDR_PANE_ID` 是自己的面板 ID，`HERDR_WORKSPACE_ID` 是工作区 ID。先读取 `skill://herdr`，并核对当前安装版本的 `herdr --help` 与相关命令组用法；不要在 Herdr 环境外控制其会话。
- 上下文可能出现 `herdr-awareness` 现场快照（谁在哪个面板、什么状态、在做什么）。它可能过期，需要准确状态时自己跑 `herdr agent list`，限定到同工作区的相关 agent，排除自己。
- 主动而非等人提醒：接活前、被阻塞时、收尾前各确认一次相关 agent 的进度。用 `herdr agent read <面板ID> --source recent-unwrapped --lines 80` 读取对方输出；操作使用已核对的面板 ID 或唯一 agent 名，不依赖当前焦点。
- 能自己协调就自己协调：需要对方补信息、调整分工或暂停冲突修改时，用 `herdr agent prompt <面板ID> "<消息>"` 直接传话，消息说明发送方、任务、涉及文件及期望回复。只有依赖对方且没有独立工作可继续时，才加 `--wait --timeout 30000`，或用 `herdr agent wait <面板ID> --timeout 30000` 等待。
- Herdr 的 `--timeout` 单位是毫秒；等待返回、超时或 `agent_prompt_stalled` 都不能单独证明任务完成或消息未投递。读取 `herdr agent get <面板ID>` 和最新输出再判断，不盲目重发；出现 `blocked` 时先看清问题或审批内容，不自动替用户批准。
- 需要运行 shell 命令时，用 `herdr pane run <面板ID> "<命令>"`，但先确认目标已回到 shell 提示符；不要把命令送进 agent 对话，也不要中断无关面板的任务。
