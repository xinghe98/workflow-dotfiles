# Workflow Dotfiles

使用 chezmoi 和 Git 管理 Zellij、OMP、Alacritty 配置。

| 平台 | 默认 Shell | Alacritty 配置位置 |
|---|---|---|
| Windows | Nushell | `%APPDATA%\alacritty\alacritty.toml` |
| macOS | zsh | `~/.config/alacritty/alacritty.toml` |
| Linux | zsh | `~/.config/alacritty/alacritty.toml` |

应用前请确保 `nu` 或 `zsh` 已安装并位于 `PATH`。

## 新机器配置

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

不要把 OMP 的数据库、会话、缓存、`secrets.yml` 或其他凭据加入 Git。
