# Workflow Dotfiles

使用 chezmoi 和 Git 管理 Windows 原生终端工作流配置。

当前管理的软件：

- Zellij
- Oh My Pi（OMP）
- Alacritty

仓库位置：

```text
C:\Users\mysta\Documents\workflow-dotfiles
```

## 工作原理

chezmoi 将仓库中的 source state 渲染到软件实际读取的配置路径：

```text
workflow-dotfiles（Git 仓库）
    │
    │ chezmoi apply
    ▼
用户目录中的实际配置
    │
    ▼
Zellij / OMP / Alacritty
```

Git 只跟踪 `workflow-dotfiles` 中的 source state，不直接跟踪用户目录中的目标文件。

## 当前管理范围

| 软件 | 实际配置路径 | chezmoi source state |
|---|---|---|
| Zellij | `~/.config/zellij/config.kdl` | `dot_config/zellij/config.kdl` |
| OMP | `~/.omp/agent/` | `dot_omp/agent/` |
| Alacritty | `%APPDATA%\alacritty\alacritty.toml` | `AppData/Roaming/alacritty/alacritty.toml` |

仓库结构：

```text
workflow-dotfiles/
├── .chezmoi.toml.tmpl
├── .chezmoiignore
├── .gitattributes
├── dot_config/
│   └── zellij/
│       └── config.kdl
├── dot_omp/
│   └── agent/
│       ├── config.yml
│       ├── keybindings.yml
│       ├── extensions/
│       └── rules/
└── AppData/
    └── Roaming/
        └── alacritty/
            └── alacritty.toml
```

## OMP 安全边界

只管理 OMP 的声明式配置：

- `config.yml`
- `keybindings.yml`
- `extensions/`
- `rules/`

以下运行时状态和敏感文件通过 `.chezmoiignore` 排除，不得加入 Git：

```text
.omp/agent/*.db
.omp/agent/*.db-wal
.omp/agent/*.db-shm
.omp/agent/sessions/
.omp/agent/terminal-sessions/
.omp/agent/blobs/
.omp/agent/cache/
.omp/agent/secrets.yml
.omp/agent/secret-placeholder.key
.omp/agent/last-changelog-version
.omp/agent/settings.json.bak
```

提交前仍应执行 `git diff --staged`，确认没有 Token、API Key、密码或本机运行数据。

## 日常修改配置

推荐始终通过 `chezmoi edit --apply` 修改。该命令编辑 source state，并在退出编辑器后更新实际配置。

### Zellij

```powershell
chezmoi edit --apply "$HOME/.config/zellij/config.kdl"
```

### OMP

```powershell
chezmoi edit --apply "$HOME/.omp/agent/config.yml"
chezmoi edit --apply "$HOME/.omp/agent/keybindings.yml"
```

规则和扩展较多时，可以直接打开 source state：

```powershell
chezmoi cd
nvim dot_omp/agent
```

修改后应用：

```powershell
chezmoi apply
```

### Alacritty

```powershell
chezmoi edit --apply "$env:APPDATA/alacritty/alacritty.toml"
```

Alacritty 默认启用配置热重载；部分字段仍需重启 Alacritty 才能生效。

## 检查并提交到 Git

检查 chezmoi 将要应用的目标变化：

```powershell
chezmoi diff
```

检查 source state 的 Git 变化：

```powershell
chezmoi git status
chezmoi git diff
```

提交：

```powershell
chezmoi git add .
chezmoi git -- commit -m "update terminal configuration"
chezmoi git push
```

也可以进入仓库使用普通 Git：

```powershell
chezmoi cd
git status
git diff
git add .
git diff --staged
git commit -m "update terminal configuration"
git push
```

## 如果直接修改了实际配置

如果没有使用 `chezmoi edit`，而是直接修改用户目录中的实际配置，需要把变化重新导入 source state。

导入单个文件：

```powershell
chezmoi add "$HOME/.config/zellij/config.kdl"
chezmoi add "$HOME/.omp/agent/config.yml"
chezmoi add "$env:APPDATA/alacritty/alacritty.toml"
```

然后检查和提交：

```powershell
chezmoi diff
chezmoi git diff
chezmoi git add .
chezmoi git -- commit -m "sync local configuration changes"
chezmoi git push
```

如果目标文件以后改成 `.tmpl` 模板，不要使用 `chezmoi re-add` 覆盖模板，应使用：

```powershell
chezmoi edit --apply <目标文件>
```

或：

```powershell
chezmoi merge <目标文件>
```

## 从远端同步到本机

拉取 Git 变化并立即应用：

```powershell
chezmoi update
```

需要先预览时：

```powershell
chezmoi git pull -- --autostash --rebase
chezmoi diff
chezmoi apply
```

`chezmoi diff` 没有输出表示实际配置已经与 source state 一致。

## 配置远端仓库

当前仓库已完成本地初始化。如尚未配置远端：

```powershell
git -C "$HOME/Documents/workflow-dotfiles" remote add origin <远端仓库地址>
git -C "$HOME/Documents/workflow-dotfiles" push -u origin main
```

检查远端：

```powershell
git -C "$HOME/Documents/workflow-dotfiles" remote -v
```

## 新 Windows 机器初始化

先安装 Git 和 chezmoi，然后克隆仓库：

```powershell
git clone <远端仓库地址> "$HOME/Documents/workflow-dotfiles"
chezmoi -S "$HOME/Documents/workflow-dotfiles" init --apply
```

验证：

```powershell
chezmoi source-path
chezmoi managed
chezmoi verify
chezmoi diff
```

## macOS 注意事项

当前仓库以 Windows 原生环境为基准：

- Alacritty 配置包含 Windows 路径、Nu Shell 路径和 Windows 字体，并已在非 Windows 平台忽略。
- OMP 的 `config.yml` 当前包含 Windows `shellPath`，直接应用到 macOS 前需要改造成 chezmoi 模板。
- Zellij 的基础 KDL 可以复用，但其中调用的外部命令仍需检查 Windows/macOS 差异。

在完成平台模板拆分前，不要在 macOS 上直接执行无预览的 `chezmoi apply`。应先运行：

```sh
chezmoi diff
```

确认渲染结果后再应用。

## 常用诊断命令

```powershell
# 查看 source state 目录
chezmoi source-path

# 查看已管理目标
chezmoi managed

# 查看未管理目标
chezmoi unmanaged

# 查看目标差异
chezmoi diff

# 验证目标状态
chezmoi verify

# 应用 source state
chezmoi apply

# 拉取远端并应用
chezmoi update
```
