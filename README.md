# Workflow Dotfiles

使用 chezmoi 和 Git 管理 Zellij、OMP、Alacritty、Kitty、OpenCode 和 Zeron 配置。

| 平台 | 默认 Shell | Alacritty 配置位置 | Kitty 配置位置 |
|---|---|---|---|
| Windows | Nushell | `%APPDATA%\alacritty\alacritty.toml` | 不管理 |
| macOS | zsh | `~/.config/alacritty/alacritty.toml` | `~/.config/kitty/kitty.conf` |
| Linux | zsh | `~/.config/alacritty/alacritty.toml` | `~/.config/kitty/kitty.conf` |

应用前请确保 `nu` 或 `zsh` 已安装并位于 `PATH`。

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

Windows 原生 Zellij 的实际配置路径以 `zellij setup --check` 为准。本机为
`%APPDATA%\Zellij\config\config.kdl`，由 chezmoi 仅在 Windows 上部署。
它与 `~/.config/zellij/config.kdl` 独立管理，保留 Windows 原生版本的设置。

Windows PowerShell：

```powershell
chezmoi edit --apply "$env:APPDATA\Zellij\config\config.kdl"
```

### OMP

```sh
chezmoi edit --apply ~/.omp/agent/config.yml
chezmoi edit --apply ~/.omp/agent/keybindings.yml
```

### Alacritty

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
