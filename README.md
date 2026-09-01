# Workflow Dotfiles

使用 chezmoi 和 Git 管理以下配置：

- Zellij
- Oh My Pi（OMP）
- Alacritty

仓库位置：

```text
C:\Users\mysta\Documents\workflow-dotfiles
```

## 配置位置

| 软件 | 实际配置 |
|---|---|
| Zellij | `~/.config/zellij/config.kdl` |
| OMP | `~/.omp/agent/` |
| Alacritty | `%APPDATA%\alacritty\alacritty.toml` |

查看已经管理的文件：

```powershell
chezmoi managed
```

将仓库配置应用到实际位置：

```powershell
chezmoi apply
```

## 修改配置

推荐使用 `chezmoi edit --apply`。退出编辑器后，chezmoi 会自动更新实际配置。

### Zellij

```powershell
chezmoi edit --apply "$HOME/.config/zellij/config.kdl"
```

### OMP

```powershell
chezmoi edit --apply "$HOME/.omp/agent/config.yml"
chezmoi edit --apply "$HOME/.omp/agent/keybindings.yml"
```

### Alacritty

```powershell
chezmoi edit --apply "$env:APPDATA/alacritty/alacritty.toml"
```

也可以直接打开 chezmoi 仓库修改：

```powershell
chezmoi cd
nvim .
chezmoi apply
```

如果直接修改了实际配置文件，使用 `chezmoi add` 将变化同步回仓库：

```powershell
chezmoi add "$HOME/.config/zellij/config.kdl"
chezmoi add "$HOME/.omp/agent/config.yml"
chezmoi add "$env:APPDATA/alacritty/alacritty.toml"
```

不要把 OMP 的数据库、会话、缓存、`secrets.yml` 或其他凭据加入 Git。

## 更新并同步到 Git

修改配置后检查变化：

```powershell
chezmoi diff
chezmoi git status
chezmoi git diff
```

提交并推送：

```powershell
chezmoi git add .
chezmoi git -- commit -m "update workflow config"
chezmoi git push
```

第一次配置远端仓库：

```powershell
git -C "$HOME/Documents/workflow-dotfiles" remote add origin <远端仓库地址>
git -C "$HOME/Documents/workflow-dotfiles" push -u origin main
```

## 从 Git 同步到本机

拉取远端更新并应用：

```powershell
chezmoi update
```

如果需要先查看变化：

```powershell
chezmoi git pull -- --autostash --rebase
chezmoi diff
chezmoi apply
```

## 新机器使用

安装 Git 和 chezmoi，然后执行：

```powershell
git clone <远端仓库地址> "$HOME/Documents/workflow-dotfiles"
chezmoi -S "$HOME/Documents/workflow-dotfiles" init --apply
```

验证配置：

```powershell
chezmoi verify
chezmoi diff
```
