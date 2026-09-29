# Workflow Dotfiles

使用 chezmoi 和 Git 管理 Zellij、Herdr、OMP、Alacritty、Kitty、OpenCode 和 Zeron 配置。

| 平台 | 终端默认启动 | Alacritty 配置位置 | Kitty 配置位置 |
|---|---|---|---|
| Windows | Herdr（窗格为 Nushell） | `%APPDATA%\alacritty\alacritty.toml` | 不管理 |
| macOS | zsh | `~/.config/alacritty/alacritty.toml` | `~/.config/kitty/kitty.conf` |
| Linux | zsh | `~/.config/alacritty/alacritty.toml` | `~/.config/kitty/kitty.conf` |

应用前请确保 `nu` 或 `zsh` 已安装并位于 `PATH`；Windows 上 Alacritty 直接启动
`herdr`，因此 `herdr` 也必须位于 `PATH`。

## 新机器配置

仓库中的 OpenCode 主配置使用 age 加密。首次应用前，先从独立备份恢复原有
`~/.config/chezmoi/age-key.txt` 私钥；重新生成密钥无法解密已有文件。
私钥不加入本仓库，应单独保存在密码管理器或离线备份中。

### Windows（Nushell）

```nu
git clone https://github.com/xinghe98/workflow-dotfiles.git ($nu.home-path | path join 'Documents' 'workflow-dotfiles')
chezmoi -S ($nu.home-path | path join 'Documents' 'workflow-dotfiles') init --apply
```

### macOS / Linux（zsh）

```zsh
git clone https://github.com/xinghe98/workflow-dotfiles.git ~/Documents/workflow-dotfiles
chezmoi -S ~/Documents/workflow-dotfiles init --apply
```

如果目标位置已有同名配置，chezmoi 会显示冲突并询问是否覆盖；确认前先保留需要的本机内容。

## 使用配置

查看已管理文件：

```sh
chezmoi managed
```

应用仓库配置：

```sh
chezmoi apply
```

验证实际配置与仓库一致：

```sh
chezmoi verify
chezmoi diff
```

## 修改配置

推荐通过 `chezmoi edit --apply` 修改，退出 Neovim 后自动应用。

### Zellij

```sh
chezmoi edit --apply ~/.config/zellij/config.kdl
```

Tab 快捷键：`Ctrl+1`～`Ctrl+9` 切换到第 1～9 个 tab，`Ctrl+0` 切换到第 10 个；
锁定模式下不拦截这些按键。Alacritty 模板显式发送 CSI-u 编码，避免传统
`Ctrl+数字` 编码歧义；Zellij 在所有非锁定模式下通过 `GoToTab` 处理。
同样的编码由 Herdr 识别，而 Alacritty 现已默认启动 Herdr，不再启动 Zellij；
要在 Alacritty 中进入 Zellij，手动执行 `zellij attach --create main`。

关闭标签统一为 `Ctrl+t`，松开后按 `w`：进入 tab 模式后关闭当前标签并回到 normal。
两份 Zellij 配置均移除 `Ctrl+Shift+w` 关闭标签和原 tab 模式的 `x` 关闭绑定；
窗格关闭保留 `Ctrl+p` 后按 `x`，移除容易误触的 `Alt+Shift+w`。

Windows 原生 Zellij 的实际配置路径以 `zellij setup --check` 为准。本机为
`%APPDATA%\Zellij\config\config.kdl`，由 chezmoi 仅在 Windows 上部署。
它与 `~/.config/zellij/config.kdl` 独立管理，保留 Windows 原生版本的设置。

Windows PowerShell：

```powershell
chezmoi edit --apply "$env:APPDATA\Zellij\config\config.kdl"
```

### Herdr

目前仅部署 Windows 的 `%APPDATA%\herdr\config.toml`，参照 Windows 原生
Zellij 配置：Catppuccin Mocha（Herdr 名称为 `catppuccin`）、`nu.exe`、
Colemak 方向键、底部标签栏与常驻快捷键提示、窗格边框、鼠标选中即复制。
新标签直接创建，不弹出命名对话框；保留 Herdr 侧栏、声音和应用内通知。

Windows 下 Alacritty 默认启动 Herdr（`program = "herdr"`，无参数），附加到已存在的
默认持久会话；会话未运行时自动创建。工作区、标签和窗格由后台服务持有，
关闭终端或分离客户端不会结束其中的进程。

常驻提示（对齐 Zellij 底部状态栏）：把标签行移到窗格下方，并在其右侧固定显示
prefix 与常用命令，配置在 `[ui]`：

```toml
tab_bar_position = "bottom"
tab_bar_right = [
  { type = "text", text = "prefix ^T" },
  { type = "text", text = "^T ? help" },
  { type = "text", text = "^T o tab" },
  { type = "text", text = "^T q detach" },
]
tab_bar_right_separator = "  "
```

可用条目类型为 `zoom`（缩放时显示 `ZOOM`）、`hostname`、`datetime`（strftime 格式）、
`text`、`command`（按 `interval_seconds` 定期执行并取最后一行输出，失败或超时清空）。
`text` 条目只接受 `text` 字段，颜色跟随主题，不能单独设色或加粗；条目互不显示时
分隔符也会省略，窄窗口下整块状态区让位于标签行。`tab_bar_position = "bottom"`
同时把标签行放到窗格下方，Herdr 的模式提示（prefix / navigate / copy / resize）
也占用这一行。完整键位表仍由内置帮助面板提供（`prefix+?`）。

标签行与提示属于客户端本地设置：`herdr server reload-config` 只重载服务端配置，
已打开的客户端需在全局菜单选择 `reload config`，或分离后重新连接。

验证：在默认会话上附加新客户端后，底部标签行右侧出现
`prefix ^T  ^T ? help  ^T o tab  ^T q detach`；在临时命名会话中确认
`prefix+o` 新建标签。关闭键现为 `prefix+w` 关闭当前窗格、`prefix+Shift+w` 关闭整个标签，
已在独立多标签、多窗格会话中验证关闭范围，验证后删除测试会话。

```powershell
chezmoi edit --apply "$env:APPDATA\herdr\config.toml"
herdr server reload-config
```

服务端热重载不重启现有窗格；`nu.exe` 只影响新建窗格。已打开的客户端可通过
全局菜单选择 `reload config`，同时重载客户端和服务端配置；也可分离后重新连接。
应用新键位后，`Ctrl+t` 再按 `Shift+r` 可重载。

`prefix` 表示先按 `Ctrl+t`，松开后再按下一键：
例如新建标签：按住 Ctrl 按一下 t，松开 Ctrl 和 t，再按一下字母 o；不是一直按住 Ctrl。
字母以当前布局输出为准，使用 Colemak 中输出字母 o 的键。
前缀后的字母须在英文输入状态下输入；中文输入法的拼音组合会截获字母，不能触发命令。

| 操作 | 快捷键 |
|---|---|
| 左 / 下 / 上 / 右切换窗格 | `Alt+n/e/u/i`、`Alt+方向键`；或 `prefix` 后按方向键（`prefix+n/i` 也可左右切换） |
| 左 / 下 / 上 / 右交换窗格 | `Alt+Shift+n/e/u/i`；或 `prefix` 后按 `Shift+n/e/u/i` |
| 向右分屏 | `Alt+o`、`prefix+r` |
| 向下分屏 | `prefix+d` |
| 最大化 / 还原窗格 | `Alt+f`、`prefix+f` |
| 关闭当前窗格 | `prefix+w`（已移除 `Alt+Shift+w` 和旧 `prefix+x`） |
| 重命名窗格 | `prefix+c` |
| 新建标签 | `prefix+o` |
| 上 / 下一个标签 | `Ctrl+Shift+Tab` / `Ctrl+Tab`；或 `prefix+,` / `prefix+.` |
| 第 1～9 个标签 | `Ctrl+1`～`Ctrl+9`；或 `prefix+1`～`prefix+9` |
| 关闭整个标签及其中所有窗格 | `prefix+Shift+w`（已移除直接按 `Ctrl+Shift+w` 和旧 `prefix+Shift+x`） |
| 调整窗格大小 | `Ctrl+n` 进入 Herdr resize 模式；`Ctrl+Alt+n/e/u/i` 直接按方向调整 |
| 新建工作区 | `prefix+Shift+o` |
| 重命名工作区 | `prefix+Shift+c`（从 `prefix+Shift+w` 移走，避免关闭标签冲突） |
| 上 / 下一个工作区（Space） | `prefix+u` / `prefix+e` |
| 打开工作区导航 | `prefix+Space`（空格），再按 `u/e` 或 `↑/↓` 选择，`Enter` 确认 |
| 编辑滚屏 / 跳转通知目标 | `prefix+Shift+v` / `prefix+Shift+a` |
| 查看键位 / 分离客户端 | `prefix+?` / `prefix+q` |

`Ctrl+t` 后的 `u/e` 切换 Space，不再用于窗格上下移动。前缀命令执行一次后退出，
连续切换时每次重新按 `Ctrl+t`；也可通过 `prefix+Space`（空格）进入持续的 navigate 模式。
在 navigate 模式中，`u/e` 和 `↑/↓` 选择 Space，`Enter` 确认，`Esc` 取消；
窗格左右移动使用 `n/i`，上下移动使用 `Alt+u/e`，避免与 Space 选择冲突。
copy/resize 模式内部按键仍使用 Herdr 自身规则；`Ctrl+Alt+n/e/u/i` 提供普通模式下的
Colemak 方向缩放。标签页切换仍为 `Ctrl+Tab` / `Ctrl+Shift+Tab`，与 Space 切换分开。
`prefix+w` 只关闭当前 Pane，`prefix+Shift+w` 关闭整个 Tab；关闭最后一个 Pane 仍可能使
所在 Tab 消失。工作区导航保持 `prefix+Space`，工作区重命名改为 `prefix+Shift+c`。
Windows Terminal 仍保持 `Ctrl+Shift+w` 的外层关闭动作解绑；Herdr 不再将直接按下的
`Ctrl+Shift+w` 用作关闭标签。注意先按并松开前缀，再按 `Shift+w`，不是三个键同时按。

与 Zellij 的区别：

- Herdr 使用单前缀，未模拟 `Ctrl+p/t/h/o/s` 多模式和 `Ctrl+l` 锁定模式。
- `Alt+n/i` 只在窗格间移动，边缘不会自动跨标签；`Alt+o` 固定向右分屏，
  不自动选择布局。交换窗格也不等同于 Zellij 的所有移动布局行为。
- 索引跳转仅配置 1～9，未绑定 `Ctrl+0`；浮动/堆叠窗格、布局轮换、
  `Alt++/-/=` 通用缩放未映射。`Alt+q` 不绑定，使用 `prefix+q` 分离，
  保留后台进程，不把 Zellij 的 Quit 偷换成停止 Herdr 服务端。
- 直达键需要外层终端发送可区分的编码，单纯取消终端默认绑定并不足够。
  Windows Terminal 与 Alacritty 均显式发送 `Ctrl+Tab`（`ESC[9;5u`）、
  `Ctrl+Shift+Tab`（`ESC[9;6u`）和 `Ctrl+1`～`Ctrl+9` 的 CSI-u 编码；
  其他终端可使用上述 prefix 备选。两个终端都不再保留 Zellij 的
  `Ctrl+t` 多模式序列。

从 Herdr 设置界面修改后，只更新配置文件：

```powershell
chezmoi re-add "$env:APPDATA\herdr\config.toml"
```

不纳入会话、日志、socket、插件锁、安装包或 agent-detection 缓存。
macOS / Linux 不部署此 Windows 配置；原有 Agent 集成文件不在本次纳管范围。
配置契约参见 [Herdr 配置文档](https://herdr.dev/docs/configuration/)。

### Windows Terminal

管理稳定版 Store/MSIX 的完整设置文件（保留现有配置档和外观）：

```powershell
chezmoi edit --apply "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json"
```

使用 `sendInput` 动作将 `Ctrl+Tab`、`Ctrl+Shift+Tab` 分别发送为
`ESC[9;5u`、`ESC[9;6u`，`Ctrl+1`～`Ctrl+9` 发送为 `ESC[49;5u`～`ESC[57;5u`。
Herdr 接收后执行标签切换；这些键不再用于切换 Windows Terminal 自身标签。
`Ctrl+Alt+n/e/u/i` 分别发送 `ESC[110;7u`、`ESC[101;7u`、`ESC[117;7u`、`ESC[105;7u`，
保留 Ctrl+Alt 修饰信息，由 Herdr 在普通模式直接执行方向缩放，无需先按 `Ctrl+n`。
缩放需要已有分屏；单窗格或已到尺寸边界时不会有可见变化。这里不修改 resize 模式内部键位。
Windows Terminal 的快捷键是全局设置，所有配置档都会发送上述编码，
不支持这些编码的其他终端程序不保证能处理它们。

修改通常会热加载；没有生效时重新打开终端窗口。原有 Herdr 窗格由后台服务
保留，不必停止服务。Preview、非打包版和其他平台的设置路径不在本次部署范围。
安装后仍需具备设置文件所引用的 Nushell、字体等本机依赖。

验证使用独立 Windows Terminal 窗口，经 Windows 键盘事件触发 11 个标签组合键，
核对 Herdr 实际标签焦点；另以 Colemak 键位触发四个 `Ctrl+Alt` 缩放组合键，
在横向和纵向分屏中核对窗格宽高变化。不是仅向 Herdr 注入转义序列。
测试窗口和会话已清理。
参考 [Windows Terminal sendInput](https://learn.microsoft.com/en-us/windows/terminal/customize-settings/actions#send-input)。


### OMP

```sh
chezmoi edit --apply ~/.omp/agent/config.yml
chezmoi edit --apply ~/.omp/agent/keybindings.yml
```

### Alacritty

Windows 默认启动 Herdr 并附加到默认持久会话，窗格内为 Nushell；macOS / Linux
默认启动 zsh。首次启动前确认 `herdr` 位于 `PATH`，否则窗口会立即退出。

验证：以独立 Alacritty 窗口启动后，进程树中出现 `conhost.exe` 与命令行仅为
`herdr` 的 `herdr.exe`，`herdr status client` 确认客户端已附加，且默认会话的
工作区、标签和窗格数量与验证前一致；随后结束窗口进程树，无残留客户端。
`Ctrl+Tab`、`Ctrl+Shift+Tab` 和 `Ctrl+1`～`Ctrl+9` 的 CSI-u 序列在临时命名
会话中逐一触发标签切换，验证后已停止并删除该会话。

Windows Nushell：

```nu
chezmoi edit --apply ($env.APPDATA | path join 'alacritty' 'alacritty.toml')
```

macOS / Linux：

```zsh
chezmoi edit --apply ~/.config/alacritty/alacritty.toml
```

### Kitty

macOS / Linux：

```zsh
chezmoi edit --apply ~/.config/kitty/kitty.conf
chezmoi edit --apply ~/.config/kitty/current-theme.conf
```

Windows 不部署 Kitty。

### OpenCode

所有平台管理 `~/.config/opencode/` 下的这些内容：

- `opencode.json`：供应商与模型设置，包含 API Key，因此加密保存。
- `tui.json`：主题选择与快捷键。
- `commands/`：自定义斜杠命令，包含 `/commit`。
- `themes/`：自定义主题。
- `package.json`、`bun.lock`、`package-lock.json`：插件依赖声明与现有锁文件。
- `skills/impeccable`：保留指向 `~/.cc-switch/skills/impeccable` 的链接，并备份链接目标正文。

技能链接按当前用户目录生成。Windows 恢复链接需要启用开发者模式或以具备创建
符号链接权限的账户运行 chezmoi。`node_modules` 不备份，需要时在配置目录重新安装依赖。
供应商的本地服务地址仍需在新机器提供相应服务；复制配置不会安装该服务。

```sh
chezmoi edit --apply ~/.config/opencode/opencode.json
chezmoi edit --apply ~/.config/opencode/tui.json
chezmoi edit --apply ~/.config/opencode/commands/commit.md
```

OpenCode 的登录凭据和历史数据不在配置备份中，新机器需要重新登录。

### Zeron

目前只部署 Windows 的 `%LOCALAPPDATA%\Zeron\ui-settings.json` 和
`composer-defaults.json`，分别保存界面偏好与模型、输入默认设置。
恢复前退出 Zeron，避免运行中的程序把旧设置写回磁盘。
默认设置含原机器的设备、项目标识，新机器首次打开时需重新选择设备与项目。

Windows PowerShell：

```powershell
chezmoi edit --apply "$env:LOCALAPPDATA\Zeron\ui-settings.json"
chezmoi edit --apply "$env:LOCALAPPDATA\Zeron\composer-defaults.json"
```

Zeron 的账户、设备身份、会话、日志和下载缓存不纳入本仓库；macOS / Linux
不会部署这些 Windows 配置路径。

### 从应用更新备份

直接在软件中修改配置后，退出 Zeron，再将已管理文件更新到仓库：

```powershell
chezmoi re-add "$env:USERPROFILE\.config\opencode" "$env:LOCALAPPDATA\Zeron"
chezmoi re-add "$env:USERPROFILE\.cc-switch\skills\impeccable"
```

`re-add` 保留加密属性，且不会覆盖模板。新增命令、主题或技能文件需要另行
`chezmoi add <文件路径>`；主配置首次纳管或重新添加时使用
`chezmoi add --encrypt ~/.config/opencode/opencode.json`。

## 更新并同步

修改后检查、提交并推送：

```sh
chezmoi diff
chezmoi git status
chezmoi git diff
chezmoi git add .
chezmoi git -- commit -m "update workflow config"
chezmoi git push
```

在其他机器拉取并应用：

```sh
chezmoi update
```

不要把 OMP 的数据库、会话、缓存、`secrets.yml`、OpenCode / Zeron 的登录凭据
或 age 私钥加入 Git。OpenCode 主配置仅以 `encrypted_*.age` 密文进入仓库。
