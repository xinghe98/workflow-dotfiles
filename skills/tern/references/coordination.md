# 终端协作（Tern / Herdr）

- 每次任务开始必须识别当前终端，不能因缺少 `TERN_PANE` 就跳过 Tern：`TERM_PROGRAM=tern` 或存在 `TERN_PANE` 时，用 `tern inspect --json` 的 `omp_session_file` 与当前 omp 会话文件唯一匹配自身窗格；不得按标题、工作目录或焦点猜测自身。Herdr 候选为 `HERDR_ENV=1` 且存在 `HERDR_PANE_ID`，再用实时面板信息确认。两组标记同时存在时优先采用当前会话匹配的证据，无法确认就标记身份未知，禁止误操作外层终端。
- 全局 `extensions/herdr-omp-awareness.ts` 每轮注入 `terminal-awareness` 并注册 `coord_peers` / `coord_send` / `coord_reply` 三个工具（仅顶层会话；工具子 agent 用 `agent://` 向父会话汇报，不冒充父窗格）。扩展失败或未加载时主动执行上述识别；快照不是完成证明。已在运行的 omp 进程保留旧扩展，必须重启或 `omp --resume <会话文件>` 后才能收发实时投递。
- 主动通信是工作步骤：同仓库有其他 agent 时，在首次修改前读取其输出，并向相关 agent 声明本任务、涉及文件和依赖；发生共享文件、接口交叉、测试被中间状态阻塞时立即协调归属，不把对方未完成改动当作自己的修复任务。阻塞时及交付前复查，并向有依赖的 agent 汇报结果。无关联任务不广播。
- 不要把「问用户对方进展如何」「请用户转达」当作协调手段；只有用户本身是决策点时（要不要改需求、要不要合并等）才找用户。
- 别人窗格的结论只算线索，不算证据：跨 agent 的事实（谁改了什么、是否通过）要自己复验或以文件与命令输出为准。

## 信箱协议（同机 omp agent）

- 通信只使用扩展提供的三个工具，禁止再对 omp agent 使用 `tern send` paste/keys、Herdr prompt 或任何键入通知；消息直接注入对方会话，空闲即唤醒，不与用户草稿冲突。
- `coord_peers()`：只读。列出本机存活的 omp agent（窗格、标题、cwd、是否同仓库、状态 `idle|working|blocked`、是否有可实时投递的信箱），以及本会话的待答请求和等待回执的外发请求。目标显示无信箱 = 旧进程，须重启/恢复后才能接收。
- `coord_send({ to, intent, body, files?, reply? = true, replyTo? })`：`to` 用 `coord_peers` 给出的 Tern 窗格 ID、Herdr 面板 ID 或完整会话文件路径（会话身份优先于可复用窗格 ID）。`intent` 一句话（不超过 200 字）说明你在做什么、需要对方做什么；去掉 ID、路径、文件名后没有实际内容会被拒绝。`body` 写背景、已做决定、具体问题或交付结果，只给路径会被拒绝。`files` 列受影响文件。`reply: false` 表示纯通知（交付完成、FYI），对方不得回复，回执套回执到此为止。补充追问用 `replyTo` 关联原请求 ID，不新建无关请求。同一发送方相同内容且未答复的请求自动去重，返回已有 ID。
- `coord_reply({ requestId, status, body, files? })`：`status` 为 `answered` / `blocked` / `rejected`；blocked/rejected 不表示对方任务成功。拒绝回复纯通知和发给他人的请求；已有回执不可改写，重复回复返回原回执。
- 投递语义：每个顶层 omp 进程轮询信箱（约 1s）；新请求作为可见消息注入（含 intent、发送方窗格/标题/cwd、files、body、回复方式），空闲即开始新一轮，工作中在步骤边界注入，对方有审批或 ask 对话框时延后投递。回执到达时同样注入发送方并自动写 `<ID>.seen.json`——不要手写 `.seen.json`。接收方侧写 `<ID>.delivered.json` 标记已投递；离线期间的条目在下次启动时进入上下文但不触发新轮次。
- 等待与重发：超时只表示未确认，先用 `coord_peers` 核实对方会话是否存活、回执是否已写。重复发送相同请求自动去重；禁止因为没看到答复就换一个新 ID 重发相同业务动作，也禁止重复执行业务操作。
- 信箱为本机 `~/.omp/agent/coordination/`（随 `PI_CODING_AGENT_DIR` 变化）：单个文件一次完整写入、最多 32KiB；不写密钥和业务敏感正文；不纳入 Git/chezmoi；未确认记录不自动删除。文件缺失、半写入、JSON 无效或 `toSession` 不符均不算完成。跨机器不得假定本机路径互通。

## Tern（确认当前属于 Tern 时适用）

- 你运行在 Tern 中，自身窗格以当前会话文件和实时 `inspect` 唯一匹配为准，`TERN_PANE` 只是候选身份。命令以当前安装版本为准：先看 `tern --help`，具体用法看 `tern <命令> --help`；不要假设存在专用 agent 命令或自动共享的会话上下文。
- 用 `tern ls --json` 确认会话、标签页、窗格和工作目录；用 `tern inspect --json` 查看 `panes` 中的 `omp_session_file`、`working`、`quiet_ms` 等信息。结合会话与工作目录识别相关 agent，排除自己和普通 shell；旧快照、标题和输出安静时长只能作为线索。
- 接活前、被阻塞时、收尾前各确认一次相关 agent 的进度。用 `tern capture <窗格ID> --surfaces` 读取对方输出；`--surfaces` 用来包含 OMP 原生界面的文字。安静、`working=false` 或 `tern wait` 的 idle 都不等于答复或完成。
- 定向操作必须使用已核对的明确窗格 ID，不用 `@focused` 或易变的标题定位对方。有多个窗口时，按 `tern <命令> --help` 的 `--window KEY` 说明限定目标窗口。
- 只对非 omp agent（Claude Code、Codex 等无信箱的 agent）使用键入通知，且在一条 bash 命令内完成：先用 `tern capture` 核实目标仍在 agent 输入界面，再 `tern send <ID> paste "<完整消息：发送方窗格、任务、文件、具体请求>" && tern send <ID> keys enter`。目标输入框有未发送内容或无法确认时延后，不粘贴、不按 Enter、不代发用户草稿。
- `tern run <窗格ID> <命令>` 会输入命令并回车，仅对已确认回到 shell 提示符的目标使用；不要把 shell 命令送进 agent 对话，也不要中断无关窗格的任务。

## Herdr（确认当前属于 Herdr 时适用）

- 你运行在 Herdr 面板里，`HERDR_PANE_ID` 是自己的面板 ID，`HERDR_WORKSPACE_ID` 是工作区 ID。先读取 `skill://herdr`，并核对当前安装版本的 `herdr --help` 与相关命令组用法；不要在 Herdr 环境外控制其会话。
- 上下文可能出现 `herdr-awareness` 现场快照（谁在哪个面板、什么状态、在做什么）。它可能过期，需要准确状态时自己跑 `herdr agent list`，限定到同工作区的相关 agent，排除自己。
- 接活前、被阻塞时、收尾前各确认一次相关 agent 的进度。用 `herdr agent read <面板ID> --source recent-unwrapped --lines 80` 读取对方输出；操作使用已核对的面板 ID 或唯一 agent 名，不依赖当前焦点。
- omp agent 之间只用信箱工具协调。`herdr agent prompt <面板ID> "<消息>"` 仅用于非 omp agent，消息说明发送方、任务、涉及文件及期望回复；只有依赖对方且没有独立工作可继续时，才加 `--wait --timeout 30000` 或用 `herdr agent wait <面板ID> --timeout 30000` 等待（单位毫秒）。
- 等待返回、超时或 `agent_prompt_stalled` 都不能单独证明任务完成或消息未投递。读取 `herdr agent get <面板ID>` 和最新输出再判断，不盲目重发；出现 `blocked` 时先看清问题或审批内容，不自动替用户批准。
- 需要运行 shell 命令时，用 `herdr pane run <面板ID> "<命令>"`，但先确认目标已回到 shell 提示符；不要把命令送进 agent 对话，也不要中断无关面板的任务。
