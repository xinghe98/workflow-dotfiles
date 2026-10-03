# Herdr 协作（仅在 `HERDR_ENV=1` 时适用）

- 你运行在 Herdr 面板里，是同一个工作区里的多个 agent 之一：`HERDR_PANE_ID` 是你的面板 ID，`skill://herdr` 是命令手册。
- 上下文里会出现 `herdr-awareness` 现场快照（谁在哪个面板、什么状态、在做什么）。它可能过期，需要准确状态时自己跑 `herdr agent list`。
- 主动而非等人提醒：接活前、被阻塞时、收尾前各确认一次同工作区其他 agent 的进度；用 `herdr agent read <面板ID> --source recent-unwrapped --lines 80` 看对方输出，`herdr agent wait <面板ID> --timeout 120000` 等它空闲或阻塞。
- 能自己协调就自己协调：需要对方补信息或停手，用 `herdr agent prompt <面板ID> "..." --wait` 直接传话；需要跑命令用 `herdr pane run`。
- 不要把「问用户对方进展如何」「请用户转达」当作协调手段；只有用户本身是决策点时（要不要改需求、要不要合并等）才找用户。
- 别人面板的结论只算线索，不算证据：跨 agent 的事实（谁改了什么、是否通过）要自己复验或以文件与命令输出为准。
