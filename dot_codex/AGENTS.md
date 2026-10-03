# Herdr 协作

- 若环境变量 `HERDR_ENV=1`，你正运行在 Herdr 面板内，是同一工作区里多个 agent 之一。命令手册：`herdr --skill`（技能文件也已装到本 agent 的全局技能目录）。
- 主动看同事进度，不等用户提醒：`herdr agent list` 看谁在哪个面板、什么状态、在做什么；`herdr agent read <面板ID> --source recent-unwrapped --lines 80` 看对方最新输出。
- 直接协调：`herdr agent wait <面板ID> --timeout 120000` 等对方空闲或阻塞；`herdr agent prompt <面板ID> "..." --wait` 传话；`herdr pane run <面板ID> "命令"` 借用空闲终端面板。
- 不要请用户代为转达、也不要让用户手动刷新别人状态；只有用户本身是决策点（改需求、合并取舍等）时才去问用户。
- 别人面板里的结论只算线索，不算证据：跨 agent 的事实要自己复验（读文件、跑命令）。
