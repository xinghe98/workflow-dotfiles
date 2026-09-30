# Workflow Dotfiles

使用 chezmoi 和 Git 管理 Zellij、Herdr、OMP、Alacritty、Kitty、OpenCode 和 Zeron 配置。

| 平台 | 终端默认启动 | Alacritty 配置位置 | Kitty 配置位置 |
|---|---|---|---|
| Windows | Herdr（窗格为 WSL 默认发行版） | `%APPDATA%\alacritty\alacritty.toml` | 不管理 |
| macOS | Herdr（窗格为 zsh） | `~/.config/alacritty/alacritty.toml` | `~/.config/kitty/kitty.conf` |
| Linux | zsh | `~/.config/alacritty/alacritty.toml` | `~/.config/kitty/kitty.conf` |

Windows 需安装 WSL 并设置默认发行版，macOS / Linux 使用 zsh。Windows 与 macOS 的 Alacritty
直接启动 `herdr`，因此这两个系统的 `herdr` 必须位于 `PATH`。
Windows 的 Alacritty 启动目录和 Herdr 新窗格默认目录均为用户的 `Documents`；
`wsl.exe` 将该 Windows 路径映射为 `/mnt/c/Users/<用户名>/Documents/`。
macOS 保持原有主目录与 Herdr 的 `follow` 目录策略。

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

macOS 可先安装命令行依赖和终端：

```zsh
brew install chezmoi herdr neovim
brew install --cask alacritty
```

Kitty 为可选终端；使用现有 Kitty 配置时，另行安装 `Maple Mono NF CN` 字体。
不要复制 Windows 的 `chezmoi.toml`（其中包含 `C:\Users\...` 路径）；下面的初始化
命令会从仓库模板生成本机路径。先恢复原有 age 私钥，再执行：

```zsh
git clone https://github.com/xinghe98/workflow-dotfiles.git ~/Documents/workflow-dotfiles
chezmoi -S ~/Documents/workflow-dotfiles init --apply
```

如果目标位置已有同名配置，chezmoi 会显示冲突并询问是否覆盖；确认前先保留需要的本机内容。

### WSL：共用 Windows 源仓库

WSL 使用原生 chezmoi，并直接读取 Windows 上的同一份源仓库，不再维护第二个 Git 副本。
初始化模板保留 `-S` 指定的源目录；Windows 和 WSL 各自保存 chezmoi 状态及生成配置。
以下为本机 Arch WSL 的路径，其他机器需替换 Windows 用户名：

```zsh
sudo pacman -S --needed chezmoi
install -d -m 700 ~/.config/chezmoi
install -m 600 /mnt/c/Users/mysta/.config/chezmoi/age-key.txt ~/.config/chezmoi/age-key.txt
chezmoi -S /mnt/c/Users/mysta/Documents/workflow-dotfiles init
chezmoi apply
chezmoi verify
```

私钥只在本机复制，仍不进入仓库。应用前备份已有配置；不要直接复制 Windows 的
chezmoi 配置文件，也不要将 WSL 的整个 `.omp/agent` 指向 Windows。

WSL 部署 OpenCode、OMP、Herdr、Zellij、Alacritty、Kitty 和共用技能；
`AppData` 下的 Windows 专用配置全部跳过。OMP 的 Linux 模板直接生成
`shellPath: /usr/bin/zsh`，不再需要 `omp` 包装函数、`PI_CONFIG_FILES` 或单独的 WSL 覆盖文件。
OMP 的规则、键位和仓库内扩展也一并部署；登录数据库、会话、用量统计和缓存仍各自独立。
源目录 `dot_omp/private_agent` 保持 Linux 的 `~/.omp/agent` 权限为 `0700`，
与 OMP 自身的权限要求一致，避免每次启动后出现 chezmoi 权限差异。
WSL 没有本地凭据时，OMP 会提示没有可用模型，需要在 WSL 内执行 `/login`。
OpenCode 主配置中原有的 API Key 随 age 加密配置恢复，但本地登录凭据与 `service.json` 不同步。

用户级 Herdr 安装在 `~/.local/bin` 时，在实际加载的 zsh 配置中添加一次：

```zsh
source "$HOME/.config/zsh/.zsh/workflow.zsh"
```

该片段由 chezmoi 管理，不覆盖原有 zsh 配置：补充 `~/.local/bin`，并仅在 WSL 中
过滤 `/mnt/<盘符>/...` 的 PATH 项，保留 Windows `System32`。这样高亮插件不再
逐字扫描大量 Windows 应用目录，同时仍可直接调用 `cmd.exe`、`wsl.exe`；
其他被移出 PATH 的 Windows 程序需使用完整路径。Linux 原生 PATH 项保持原顺序，
非 WSL 环境不做过滤。语法高亮、自动建议与补全均保留。
本机入口为 `~/.config/zsh/.zshrc`（`~/.zshenv` 设置了 `ZDOTDIR`）。
应用后新开终端，或执行上面的 `source` 命令让当前 zsh 生效。
应用配置不会安装 Alacritty、Kitty 或 Zellij；需要使用时另行安装对应 Linux 程序。

OpenCode 依赖按仓库的 npm 锁文件安装：在 `~/.config/opencode` 下执行
`npm ci --ignore-scripts --no-audit --no-fund`。若旧 `opencode.jsonc` 仅含 schema，
备份后移除，避免后续设置写入这个优先级更高的旧文件；包含实际设置时应先合并。
Herdr 的本机集成使用 `herdr integration install omp` 和
`herdr integration install opencode` 安装，不复制 Windows 运行时文件。
OpenCode V2 首次启动完成后再执行一次集成安装，并用 `herdr integration status`
确认 OMP 与 OpenCode 均为 `current`。

**共用源仓库不是实时同步生成文件。** 修改公共源后，Windows 与 WSL 分别运行
`chezmoi apply`；不要同时在两端修改同一个源文件。Windows Herdr 与 WSL 原生 Herdr
也仍是两个独立运行时，此处不建立跨系统会话或 socket 桥接。

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

Herdr、Alacritty、Zellij 在所有系统上各自只有一份公共源配置。系统目录中的文件
由同一模板生成；平台差异只在公共源内条件化，不维护两份主题、键位或 UI 设置。

| 应用 | 唯一公共源配置（相对仓库根目录） |
|---|---|
| Herdr | `.chezmoitemplates/herdr.toml` |
| Alacritty | `.chezmoitemplates/alacritty.toml` |
| Zellij | `.chezmoitemplates/zellij.kdl` |

下面的公共源编辑命令在 Windows Nushell / PowerShell 与 macOS / Linux 上相同。
`chezmoi cd` 会进入当前机器的源仓库，不依赖用户名或绝对路径。
**不要用 `chezmoi edit` 编辑上述应用的生成文件**：它打开的是一行部署包装模板，
不是公共配置正文。也不要对生成文件执行 `chezmoi add` / `re-add`，以免形成独立副本。
直接在应用设置界面改动生成文件只影响本机；需要同步的改动必须写回对应公共源。

其他没有公共包装模板的文件仍使用 `chezmoi edit --apply`，退出 Neovim 后自动应用。

### Zellij

```sh
chezmoi cd
nvim .chezmoitemplates/zellij.kdl
chezmoi apply
```

Tab 快捷键：`Ctrl+1`～`Ctrl+9` 切换到第 1～9 个 tab，`Ctrl+0` 切换到第 10 个；
锁定模式下不拦截这些按键。Alacritty 模板显式发送 CSI-u 编码，避免传统
`Ctrl+数字` 编码歧义；Zellij 在所有非锁定模式下通过 `GoToTab` 处理。
同样的编码由 Herdr 识别，而 Alacritty 现已默认启动 Herdr，不再启动 Zellij；
要在 Alacritty 中进入 Zellij，手动执行 `zellij attach --create main`。

关闭标签统一为 `Ctrl+t`，松开后按 `w`：进入 tab 模式后关闭当前标签并回到 normal。
公共 Zellij 配置移除 `Ctrl+Shift+w` 关闭标签和原 tab 模式的 `x` 关闭绑定；
窗格关闭保留 `Ctrl+p` 后按 `x`，移除容易误触的 `Alt+Shift+w`。

Windows 原生 Zellij 的实际配置路径以 `zellij setup --check` 为准。本机为
`%APPDATA%\Zellij\config\config.kdl`，由 chezmoi 仅在 Windows 上部署。
它与 `~/.config/zellij/config.kdl` 都从 `.chezmoitemplates/zellij.kdl` 生成，
现有平台差异在同一源文件内保留。两边修改都使用上面的公共源编辑命令。

保留的现有差异：Windows 使用 Nushell、Catppuccin Mocha、关闭增强键盘协议与启动提示，
`Alt+=` 增大窗格；macOS / Linux 使用 zsh、默认主题、开启增强键盘协议，
`Alt+=` 减小窗格。日后修改这些偏好也只编辑公共源内相应分支。
Windows 同时存在的 `~/.config/zellij/config.kdl` 现在生成与原生 AppData 路径相同的
Windows 配置；原生 Zellij 仍按 `setup --check` 给出的路径读取。

### Herdr

Windows 部署到 `%APPDATA%\herdr\config.toml`，macOS / Linux 部署到
`~/.config/herdr/config.toml`，均从 `.chezmoitemplates/herdr.toml` 生成。
公共设置包括 Catppuccin Mocha（Herdr 名称为 `catppuccin`）、
Colemak 方向键、底部标签栏与常驻快捷键提示、窗格边框、鼠标选中即复制。
新标签直接创建，不弹出命名对话框；保留 Herdr 侧栏、声音和应用内通知。

Windows 与 macOS 下 Alacritty 默认启动 Herdr（`program = "herdr"`，无参数），附加到已存在的
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

当前底部提示为 `prefix ^T  ^T ? help  ^T o tab  ^T q detach`。
本次快捷键配置经服务端热重载返回 `applied`，无配置诊断错误；
尚未在客户端逐项实按验证。

```sh
chezmoi cd
nvim .chezmoitemplates/herdr.toml
chezmoi apply
herdr server reload-config
```

服务端热重载不重启现有窗格；Windows 使用 `wsl.exe` 进入 WSL 默认发行版，macOS 使用 `/bin/zsh`，
Linux 使用 `zsh`，仅影响新建窗格。Windows 新窗格默认从 `Documents` 启动，不再跟随当前窗格目录。
重新打开 Alacritty 仍可能附加到原有 Nushell 窗格；新建标签即可使用 WSL，无需停止现有会话。已打开的客户端可通过
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
| 关闭当前窗格 | `Ctrl+w`、`prefix+w` |
| 重命名窗格 | `prefix+c` |
| 新建标签 | `prefix+o` |
| 上 / 下一个标签 | `Ctrl+Shift+Tab` / `Ctrl+Tab`；或 `prefix+,` / `prefix+.` |
| 第 1～9 个标签 | `Ctrl+1`～`Ctrl+9`；或 `prefix+1`～`prefix+9` |
| 关闭整个标签及其中所有窗格 | `prefix+Shift+w`（已移除直接按 `Ctrl+Shift+w` 和旧 `prefix+Shift+x`） |
| 调整窗格大小 | `Ctrl+n` 进入 Herdr resize 模式；`Ctrl+Alt+n/e/u/i` 直接按方向调整 |
| 新建工作区 | `prefix+Shift+o`；也可 `Ctrl+o` 进入工作区导航后按 `Shift+o` |
| 重命名工作区 | `prefix+Shift+c`（从 `prefix+Shift+w` 移走，避免关闭标签冲突） |
| 上 / 下一个工作区（Space） | `prefix+u` / `prefix+e` |
| 打开工作区导航 | `Ctrl+o`，再按 `u/e` 或 `↑/↓` 选择，`Enter` 确认 |
| 打开 Agents / 终端列表 | `Ctrl+g`、`prefix+g`；用 `↑/↓` 或 `k/j` 选择，`Enter` 确认，不支持 `u/e` |
| 编辑滚屏 / 跳转通知目标 | `prefix+Shift+v` / `prefix+Shift+a` |
| 查看键位 / 分离客户端 | `prefix+?` / `prefix+q` |

`Ctrl+t` 后的 `u/e` 切换 Space，不再用于窗格上下移动。前缀命令执行一次后退出，
连续切换时每次重新按 `Ctrl+t`；也可通过 `Ctrl+o` 进入持续的 navigate 模式。
在 navigate 模式中，`u/e` 和 `↑/↓` 选择 Space，`Enter` 确认，`Esc` 取消；
窗格左右移动使用 `n/i`，上下移动使用 `Alt+u/e`，避免与 Space 选择冲突。
copy/resize 模式内部按键仍使用 Herdr 自身规则；`Ctrl+Alt+n/e/u/i` 提供普通模式下的
Colemak 方向缩放。标签页切换仍为 `Ctrl+Tab` / `Ctrl+Shift+Tab`，与 Space 切换分开。
`Ctrl+w` 或 `prefix+w` 只关闭当前 Pane，`prefix+Shift+w` 关闭整个 Tab；关闭最后一个 Pane
仍可能使所在 Tab 消失。工作区导航使用 `Ctrl+o`，工作区重命名使用 `prefix+Shift+c`。
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

从 Herdr 设置界面修改后，将需要同步的字段手工写回 `.chezmoitemplates/herdr.toml`，
再执行 `chezmoi apply`；不要重新纳管生成文件，否则会破坏单一公共源。

不纳入会话、日志、socket、插件锁、安装包或 agent-detection 缓存。
Agent 集成属于本机安装产物，不同步 Windows 的 `.ps1` 与 `C:\Users\...` 钩子。
macOS 安装好相应 Agent CLI 后，按需生成本机集成，例如：

```sh
herdr integration install omp
herdr integration install claude
herdr integration install codex
herdr integration install cursor
herdr integration install opencode
herdr integration status
```

安装集成不等于迁移 Agent 登录凭据；新机器仍需登录自己的账户。
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

Windows 与 macOS 默认启动 Herdr 并附加到默认持久会话，窗格内分别为 Nushell 与 zsh；
Linux 保留直接启动 zsh。首次启动前确认 `herdr` 位于 `PATH`，否则窗口会立即退出。
macOS 保留 `option_as_alt = "Both"`；Kitty 将左 Option 作为 Alt。

验证：以独立 Alacritty 窗口启动后，进程树中出现 `conhost.exe` 与命令行仅为
`herdr` 的 `herdr.exe`，`herdr status client` 确认客户端已附加，且默认会话的
工作区、标签和窗格数量与验证前一致；随后结束窗口进程树，无残留客户端。
`Ctrl+Tab`、`Ctrl+Shift+Tab` 和 `Ctrl+1`～`Ctrl+9` 的 CSI-u 序列在临时命名
会话中逐一触发标签切换，验证后已停止并删除该会话。

所有平台编辑同一公共源：

```sh
chezmoi cd
nvim .chezmoitemplates/alacritty.toml
chezmoi apply
```

不编辑 `AppData/Roaming/alacritty/alacritty.toml.tmpl` 或
`dot_config/alacritty/alacritty.toml.tmpl`；它们只负责引用公共源。

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
同一应用在每台机器编辑的是同一个仓库相对路径；生成文件的系统路径可以不同。
Git 不提供实时双向同步：改动前先拉取，改动后提交推送，再在另一台机器拉取应用。
不要在两台机器同时离线修改后直接覆盖；出现 Git 冲突时先合并公共源再应用。


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

## 跨平台适配验证（2026-09-30）

- Windows、macOS、Linux 分支均经 chezmoi 展开；Herdr 与 Alacritty 的生成 TOML 可解析，
  两套部署入口分别引用同一个公共源。临时源仓库的一次 Herdr 前缀修改同时进入三平台结果。
- Windows 的 Herdr 与 Alacritty 所有有效配置值与迁移前一致；Zellij 保留各平台已有有效设置，
  仅统一插件声明顺序、等价字符串写法与说明性注释。三平台生成 KDL 均由本机 Zellij 0.44.3
  `setup --check` 接受，此项证明语法，不证明 macOS 运行时。
- 平台选路与运行时污染沙箱验证：每个平台仅管理其对应 Herdr 配置，不纳入会话、恢复备份、
  快照、日志、socket、锁或版本提示文件。
- 已在 Windows 应用 Herdr、Alacritty、Zellij 生成文件并通过针对性 `chezmoi verify`；
  Herdr 服务端重载返回 `applied`、诊断为空。实际启动独立 Alacritty 窗口后出现 Herdr 客户端，
  原工作区、标签与窗格 ID 保持不变；验证窗口已关闭，原服务端未重启。
- 未在 Mac 真机启动终端或逐项实按快捷键。`joinPath` 等路径操作在 Windows 模拟中仍遵循宿主
  系统规则，因此本次平台分支验证不替代 Mac 原生初始化；Mac 还需验证 Homebrew PATH、
  Option/Control 组合键、字体及本机 Agent 状态回报。
