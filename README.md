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

```nu
chezmoi apply
```

## 修改配置

推荐使用 `chezmoi edit --apply`。退出编辑器后，chezmoi 会自动更新实际配置。

### Zellij

```nu
chezmoi edit --apply ~/.config/zellij/config.kdl
```

### OMP

```nu
chezmoi edit --apply ~/.omp/agent/config.yml
chezmoi edit --apply ~/.omp/agent/keybindings.yml
```

### Alacritty

```nu
chezmoi edit --apply ($env.APPDATA | path join 'alacritty' 'alacritty.toml')
```

也可以直接打开 chezmoi 仓库修改：

```nu
chezmoi cd
nvim .
chezmoi apply
```

如果直接修改了实际配置文件，使用 `chezmoi add` 将变化同步回仓库：

```nu
chezmoi add ~/.config/zellij/config.kdl
chezmoi add ~/.omp/agent/config.yml
chezmoi add ($env.APPDATA | path join 'alacritty' 'alacritty.toml')
```

不要把 OMP 的数据库、会话、缓存、`secrets.yml` 或其他凭据加入 Git。

## 更新并同步到 Git

修改配置后检查变化：

```nu
chezmoi diff
chezmoi git status
chezmoi git diff
```

提交并推送：

```nu
chezmoi git add .
chezmoi git -- commit -m "update workflow config"
chezmoi git push
```

第一次配置远端仓库：

```nu
git -C ($nu.home-path | path join 'Documents' 'workflow-dotfiles') remote add origin <远端仓库地址>
git -C ($nu.home-path | path join 'Documents' 'workflow-dotfiles') push -u origin main
```

## 从 Git 同步到本机

拉取远端更新并应用：

```nu
chezmoi update
```

如果需要先查看变化：

```nu
chezmoi git pull -- --autostash --rebase
chezmoi diff
chezmoi apply
```

## 新机器使用

安装 Git 和 chezmoi，然后执行：

```nu
git clone <远端仓库地址> ($nu.home-path | path join 'Documents' 'workflow-dotfiles')
chezmoi -S ($nu.home-path | path join 'Documents' 'workflow-dotfiles') init --apply
```

验证配置：

```nu
chezmoi verify
chezmoi diff
```
