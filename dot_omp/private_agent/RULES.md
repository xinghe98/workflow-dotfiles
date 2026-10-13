# 终端协作（Tern / Herdr）

- 每次任务开始必须识别当前终端，不能因缺少 `TERN_PANE` 就跳过 Tern：`TERM_PROGRAM=tern` 或存在 `TERN_PANE` 时，用 `tern inspect --json` 的 `omp_session_file` 与当前 omp 会话文件唯一匹配自身窗格；不得按标题、工作目录或焦点猜测自身。Herdr 候选为 `HERDR_ENV=1` 且存在 `HERDR_PANE_ID`，再用实时面板信息确认。两组标记同时存在时优先采用当前会话匹配的证据，无法确认就标记身份未知，禁止误操作外层终端。
- 全局 `extensions/herdr-omp-awareness.ts` 在每次任务前注入 `terminal-awareness`：当前终端、自身身份、相关 agent 与通信方式。扩展失败或未加载时主动执行上述识别；快照不是完成证明。新进程自动加载；已经运行的进程需重载扩展或重启后恢复会话。工具子 agent 不冒充父窗格，使用 `agent://` 通信。
- 主动通信是工作步骤：同仓库有其他 agent 时，在首次修改前读取其输出，向相关 agent 声明本任务、涉及文件和依赖；发生共享文件、接口交叉、测试被中间状态阻塞时立即协调归属，不把对方未完成改动当作自己的修复任务。阻塞时及交付前复查，并向有依赖的 agent 汇报结果。纯回执只确认一次，不回执套回执；无关联任务不广播。
- 不要把「问用户对方进展如何」「请用户转达」当作协调手段；只有用户本身是决策点时（要不要改需求、要不要合并等）才找用户。
- 别人窗格的结论只算线索，不算证据：跨 agent 的事实（谁改了什么、是否通过）要自己复验或以文件与命令输出为准。

## Tern（确认当前属于 Tern 时适用）

- 你运行在 Tern 中，自身窗格以当前会话文件和实时 `inspect` 唯一匹配为准，`TERN_PANE` 只是候选身份。命令以当前安装版本为准：先看 `tern --help`，具体用法看 `tern <命令> --help`；不要假设存在专用 agent 命令或自动共享的会话上下文。
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
