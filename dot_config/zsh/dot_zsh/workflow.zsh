# WSL command highlighting probes PATH on each keystroke. Avoid scanning Windows
# application directories over DrvFS; retain System32 for cmd.exe and wsl.exe.
if [[ -n ${WSL_DISTRO_NAME-} ]]; then
  typeset -a _workflow_path=()
  for _workflow_dir in "${path[@]}"; do
    if [[ ${_workflow_dir:l} == /mnt/[a-z]/* &&
          ${_workflow_dir:l} != /mnt/[a-z]/windows/system32 &&
          ${_workflow_dir:l} != /mnt/[a-z]/windows/system32/ ]]; then
      continue
    fi
    _workflow_path+=("$_workflow_dir")
  done
  path=("${_workflow_path[@]}")
  export PATH
  unset _workflow_path _workflow_dir
fi

# User-installed tools such as Herdr live here; do not share application state.
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  export PATH="$HOME/.local/bin:$PATH"
fi

# External editors (OpenCode editor_open via ctrl+g, git, etc.): Colemak nvim.
export EDITOR=nvim
export VISUAL=nvim
