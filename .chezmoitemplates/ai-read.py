#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ai-read.py — 用 Neovim 阅读 Herdr 窗格滚屏与 AI 会话（OMP / OpenCode）。

部署（chezmoi 模板展开，同一份脚本两个落点）:
    macOS/Linux: ~/.config/herdr/read-session.py
    Windows:     %APPDATA%/herdr/read-session.py

用法（由 Herdr 自定义命令 type=popup 调用，也可手动运行）:
    read-session.py --scrollback [--pane <PANE_ID>] [--output <PATH>]
    read-session.py --session   [--pane <PANE_ID>] [--output <PATH>]

目标窗格解析优先级:
    1. --pane 显式指定；
    2. 环境变量 HERDR_ACTIVE_PANE_ID（Herdr popup 注入，指回原焦点窗格，
       见 herdr 源码 src/app/custom_commands.rs）。
    绝不猜测"最新会话"；解析结果是弹窗自身时直接拒绝（退出码 1）。

模式:
    --scrollback  herdr pane read <target> --source recent-unwrapped
                  --lines 200000 --format text，原文写入阅读文件。
    --session     herdr agent get <target> 取 agent_session，再按 kind 分发:
                    kind=path   -> OMP:      omp render <会话文件> --plain
                                              （显式传路径，不使用 omp 的
                                              "默认取 cwd 最近会话" 行为）
                    kind=id     -> OpenCode: opencode export <session_id>
                                              （cwd 用 foreground_cwd/cwd，
                                              输出 JSON 转完整 Markdown）
                  其他 kind、无会话、找不到 agent 一律明确报错退出，
                  绝不降级为快照伪装完整。

--output <PATH> 写文件后退出（不启动 nvim），供非交互验收；
否则写入临时文件，用 `nvim -R -n <file>` 打开：
只读（可 yank/搜索）、不产生 swap、加载用户默认 nvim 配置
（不加 --clean、不设 -u，保留 Colemak 键位），退出后删除临时文件。
不读 server EDITOR，nvim 为显式调用。

远程窗格（--machine 转发）不受支持：本脚本从不指定机器，herdr 在本机
找不到目标窗格时其自身会报错（非 0 退出），原样转达。

仅依赖 Python 标准库。所有子进程调用使用参数列表，绝不经过 shell 拼接
session id / 路径。macOS/Linux 用 python3，Windows 用 py -3 运行同一脚本。
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

# herdr pane read 单次请求的行数。实测 0.9.3 接受 200000 并返回窗格全部
# 可用滚屏（实际由宿主 scrollback 上限决定）。
SCROLLBACK_LINES = "200000"
SUBPROCESS_TIMEOUT = 300

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_USAGE = 2

USAGE_EXAMPLES = """示例（Herdr popup 自定义命令调用）:
  python3 ~/.config/herdr/read-session.py --scrollback
  python3 ~/.config/herdr/read-session.py --session
  py -3 "%APPDATA%/herdr/read-session.py" --session

非交互导出（验收/脚本用，不启动 nvim）:
  read-session.py --session --pane w1:p2 --output /tmp/session.md
  read-session.py --scrollback --pane w1:p2 --output /tmp/scrollback.txt"""


def fail(message):
    """打印用户可读错误并退出（非 0）。"""
    sys.stderr.write("ai-read: %s\n" % message)
    sys.exit(EXIT_ERROR)


def run_capture(argv, cwd=None, timeout=SUBPROCESS_TIMEOUT):
    """运行子进程（参数列表，不经 shell），返回 (returncode, stdout, stderr) 文本。

    输出按 UTF-8 解码（无法解码的字节替换为 U+FFFD），保证中文与多行内容
    完整；stderr 单独捕获，不与 stdout 混流（opencode export 会在 stderr
    打印 "Exporting session: ..." 日志行，不能混入数据）。
    """
    try:
        proc = subprocess.run(
            argv,
            cwd=cwd,
            timeout=timeout,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError:
        fail("找不到可执行程序: %s" % argv[0])
    except subprocess.TimeoutExpired:
        fail("命令超时（>%ss）: %s" % (timeout, " ".join(map(str, argv))))
    out = proc.stdout.decode("utf-8", errors="replace")
    err = proc.stderr.decode("utf-8", errors="replace")
    return proc.returncode, out, err


def find_binary(name, extra_candidates=()):
    """在 PATH 与显式候选路径中定位可执行文件；找不到则报错退出。"""
    for candidate in extra_candidates:
        if candidate:
            path = Path(candidate).expanduser()
            if path.is_file():
                return str(path)
    found = shutil.which(name)
    if found:
        return found
    fail("找不到可执行程序 %r：请确认已安装并在 PATH 中" % name)


def find_herdr():
    # HERDR_BIN_PATH 由 Herdr 注入，优先级高于 PATH。
    return find_binary("herdr", [os.environ.get("HERDR_BIN_PATH", "")])


def find_omp():
    return find_binary("omp", [str(Path.home() / ".local" / "bin" / "omp")])


def resolve_target(explicit_pane):
    """确定目标窗格：--pane 优先，其次 HERDR_ACTIVE_PANE_ID；绝不猜最新会话。"""
    if explicit_pane:
        target = explicit_pane.strip()
        if not target:
            fail("--pane 不能为空字符串")
        return target
    target = (os.environ.get("HERDR_ACTIVE_PANE_ID") or "").strip()
    if not target:
        fail(
            "未指定目标窗格：没有 --pane，也没有 HERDR_ACTIVE_PANE_ID"
            "（popup 环境变量）。本脚本不会猜测最新会话。"
        )
    return target


def pretty_cli_error(err, out):
    """把 herdr CLI 的 JSON 错误（stderr，exit 1）整理成可读文本。"""
    text = (err or "").strip() or (out or "").strip()
    try:
        return json.dumps(json.loads(text), ensure_ascii=False, indent=2)
    except ValueError:
        return text


def fmt_time(ms):
    """epoch 毫秒 -> 本地时间字符串；无效输入原样返回。"""
    try:
        return datetime.fromtimestamp(int(ms) / 1000.0).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
    except (TypeError, ValueError, OSError, OverflowError):
        return str(ms)


def pretty_json(value):
    return json.dumps(value, ensure_ascii=False, indent=2, default=str)


def doc_header(title, rows):
    lines = ["# " + title, ""]
    for key, value in rows:
        lines.append("- %s: %s" % (key, value))
    return "\n".join(lines) + "\n\n"


# ---------------------------------------------------------------------------
# --scrollback
# ---------------------------------------------------------------------------


def fetch_scrollback(target):
    """herdr pane read 原文（text，已合并软换行）。失败时以 herdr 报错退出。"""
    herdr = find_herdr()
    argv = [
        herdr,
        "pane",
        "read",
        target,
        "--source",
        "recent-unwrapped",
        "--lines",
        SCROLLBACK_LINES,
        "--format",
        "text",
    ]
    returncode, out, err = run_capture(argv)
    if returncode != 0:
        fail(
            "herdr pane read %s 失败（exit %d）：\n%s"
            % (target, returncode, pretty_cli_error(err, out))
        )
    return out


def build_scrollback_doc(target):
    text = fetch_scrollback(target)
    active_cwd = (os.environ.get("HERDR_ACTIVE_PANE_CWD") or "").strip()
    header = doc_header(
        "Herdr 窗格滚屏（recent-unwrapped）",
        [
            ("目标窗格", target),
            ("窗格目录", active_cwd or "未知"),
            ("生成时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            (
                "来源",
                "herdr pane read %s --source recent-unwrapped --lines %s"
                " --format text" % (target, SCROLLBACK_LINES),
            ),
            ("说明", "以下为该窗格最近渲染输出的原文（软换行已合并）。"),
        ],
    )
    body = text if text.strip() else "(滚屏内容为空)"
    return header + body, ".txt"


# ---------------------------------------------------------------------------
# --session
# ---------------------------------------------------------------------------


def fetch_agent(target):
    """herdr agent get <pane>，返回 result.agent 字典；失败/无 agent 明确报错。"""
    herdr = find_herdr()
    returncode, out, err = run_capture([herdr, "agent", "get", target])
    if returncode != 0:
        fail(
            "herdr agent get %s 失败（exit %d）：\n%s"
            % (target, returncode, pretty_cli_error(err, out))
        )
    try:
        payload = json.loads(out)
    except ValueError as exc:
        fail("herdr agent get 输出不是合法 JSON：%s\n原始输出开头: %s" % (exc, out[:300]))
    if isinstance(payload, dict) and payload.get("error"):
        fail(
            "herdr agent get %s 返回错误：\n%s"
            % (target, pretty_json(payload["error"]))
        )
    agent = (payload.get("result") or {}).get("agent")
    if not agent:
        fail(
            "窗格 %s 上没有已识别的 agent（herdr agent get 无 agent 字段），"
            "没有会话可读。\n原始输出: %s" % (target, out[:500])
        )
    return agent


def build_session_doc(agent, target):
    """按 agent_session.kind 分发；未知 kind / 无会话明确失败，不伪装完整。"""
    session = agent.get("agent_session")
    if not session:
        fail(
            "窗格 %s 的 agent（%s）没有 agent_session：尚未产生会话或未被识别。"
            % (target, agent.get("agent") or "未知")
        )
    kind = session.get("kind")
    value = session.get("value")
    if not value:
        fail(
            "agent_session 缺少 value 字段：\n%s" % pretty_json(session)
        )
    if agent.get("agent") == "omp" and kind == "path":
        return render_omp(value, agent, target)
    if agent.get("agent") == "opencode" and kind == "id":
        return render_opencode(value, agent, target)
    fail(
        "未知的 agent_session.kind=%r（agent=%r）；仅支持 OMP（kind=path）与"
        " OpenCode（kind=id），不做降级快照。\n%s"
        % (kind, agent.get("agent"), pretty_json(session))
    )


def render_omp(session_path, agent, target):
    """OMP: 显式传会话文件路径渲染完整 transcript（绝不依赖默认最近会话）。"""
    path = Path(session_path).expanduser()
    if not path.is_file():
        fail("OMP 会话文件不存在: %s（窗格 %s）" % (session_path, target))
    omp = find_omp()
    # 显式传路径；omp render 不带参数时会"取 cwd 最近会话"，那正是要避免的。
    returncode, out, err = run_capture([omp, "render", str(path), "--plain"])
    if returncode != 0:
        fail(
            "omp render %s 失败（exit %d）：%s" % (path, returncode, err.strip())
        )
    header = doc_header(
        "OMP 完整会话记录",
        [
            ("目标窗格", target),
            ("agent", agent.get("agent") or "omp"),
            ("会话文件", str(path)),
            ("窗格目录", agent.get("foreground_cwd") or agent.get("cwd") or "未知"),
            ("生成时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            ("来源", "omp render <会话文件> --plain（显式传入路径）"),
        ],
    )
    return header + out, ".txt"


def render_opencode(session_id, agent, target):
    """OpenCode: export 完整会话 JSON 并转 Markdown；不截断、不丢 tool 错误。"""
    opencode = find_binary("opencode")
    # 让 export 与会话解析到同一 project：优先 foreground_cwd（前台进程实际
    # 目录），退回 agent cwd；都没有则用调用目录并注明。
    cwd_value = (agent.get("foreground_cwd") or agent.get("cwd") or "").strip()
    cwd_arg = None
    cwd_note = "未提供（使用调用目录）"
    if cwd_value:
        if Path(cwd_value).is_dir():
            cwd_arg = cwd_value
            cwd_note = cwd_value
        else:
            cwd_note = "%s（目录不存在，使用调用目录）" % cwd_value
    returncode, out, err = run_capture(
        [opencode, "export", session_id], cwd=cwd_arg
    )
    if returncode != 0:
        fail(
            "opencode export %s 失败（exit %d，cwd=%s）：\n%s"
            % (
                session_id,
                returncode,
                cwd_arg or os.getcwd(),
                pretty_cli_error(err, out),
            )
        )
    try:
        data = json.loads(out)
    except ValueError as exc:
        fail(
            "opencode export %s 输出不是合法 JSON：%s\n原始输出开头: %s"
            % (session_id, exc, out[:300])
        )
    return (
        opencode_to_markdown(data, session_id, agent, target, cwd_note),
        ".md",
    )


def opencode_to_markdown(data, session_id, agent, target, cwd_note):
    """opencode export JSON -> 完整可读 Markdown。

    实测 1.18.34 契约: 顶层为 info + messages[]，每条消息 info(role/agent/
    model/time/...) + parts[]。part 类型: text / reasoning / tool（state 含
    input/output/error/metadata/title/time）/ step-start / step-finish /
    patch / file / compaction。正文与错误逐字保留，仅跳过纯记账（step-*）
    与 provider 侧重复元数据；未知类型整体 JSON 落盘，绝不静默丢弃。
    """
    info = data.get("info") or {}
    messages = data.get("messages") or []
    lines = ["# OpenCode 会话导出", ""]
    header_rows = [
        ("目标窗格", target),
        ("agent", agent.get("agent") or "未知"),
        ("会话 ID", session_id),
    ]
    if info.get("title"):
        header_rows.append(("标题", info["title"]))
    if info.get("directory"):
        header_rows.append(("项目目录", info["directory"]))
    if info.get("version"):
        header_rows.append(("OpenCode 版本", info["version"]))
    time_info = info.get("time") or {}
    if time_info.get("created"):
        header_rows.append(("开始时间", fmt_time(time_info["created"])))
    header_rows.append(("export cwd", cwd_note))
    header_rows.append(("消息数", len(messages)))
    lines.extend("- %s: %s" % (key, value) for key, value in header_rows)
    lines.append("")
    if not messages:
        lines.append("(该会话没有任何消息)")
        return "\n".join(lines).rstrip() + "\n"

    for index, message in enumerate(messages, 1):
        message_info = message.get("info") or {}
        role = message_info.get("role") or "unknown"
        created = (message_info.get("time") or {}).get("created")
        head = "## [%d/%d] %s" % (index, len(messages), role.upper())
        if created:
            head += "  %s" % fmt_time(created)
        extras = []
        if message_info.get("agent"):
            extras.append("agent=%s" % message_info["agent"])
        model = message_info.get("model")
        if isinstance(model, dict) and model.get("modelID"):
            extras.append("model=%s" % model["modelID"])
        elif message_info.get("modelID"):
            extras.append("model=%s" % message_info["modelID"])
        if message_info.get("finish"):
            extras.append("finish=%s" % message_info["finish"])
        if extras:
            head += "  (" + ", ".join(extras) + ")"
        lines.append(head)
        lines.append("")
        summary = message_info.get("summary")
        diffs = summary.get("diffs") if isinstance(summary, dict) else None
        if diffs:
            lines.append("会话摘要涉及的 diff 文件:")
            for diff in diffs:
                lines.append(
                    "- %s (+%s/-%s)"
                    % (diff.get("file"), diff.get("additions"), diff.get("deletions"))
                )
            lines.append("")
        parts = message.get("parts") or []
        if not parts:
            lines.append("(本消息没有 part)")
            lines.append("")
            continue
        for part in parts:
            lines.extend(render_opencode_part(part))
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_opencode_part(part):
    """单条 part -> 文本行列表；正文逐字保留，未知类型整体输出。"""
    part_type = part.get("type")
    if part_type == "text":
        text = part.get("text")
        return [text if isinstance(text, str) and text else "(空文本)"]
    if part_type == "reasoning":
        text = part.get("text")
        body = text if isinstance(text, str) and text else "(空思考)"
        return ["### 思考（reasoning）", "", body]
    if part_type == "tool":
        return render_opencode_tool(part)
    if part_type == "file":
        return render_opencode_file(part)
    if part_type == "patch":
        files = part.get("files") or []
        lines = ["### 变更（patch）"]
        lines.extend("- %s" % item for item in files)
        return lines
    if part_type in ("step-start", "step-finish"):
        # 纯步骤记账（token/快照/计费），非用户可见正文。
        return []
    # 未知类型（如 compaction）：完整 JSON 落盘，绝不静默丢弃。
    return [
        "### 其他 part（type=%s，完整 JSON）" % part_type,
        "",
        pretty_json(part),
    ]


def render_opencode_tool(part):
    """tool part：状态/输入/输出/错误完整呈现，错误绝不丢弃。"""
    tool = part.get("tool") or "unknown"
    state = part.get("state") or {}
    status = state.get("status") or "unknown"
    lines = ["### 工具调用: %s  状态: %s" % (tool, status)]
    if state.get("title"):
        lines.append("标题: %s" % state["title"])
    if part.get("callID"):
        lines.append("callID: %s" % part["callID"])
    time_info = state.get("time") or {}
    if time_info.get("start"):
        duration = ""
        if time_info.get("end"):
            duration = "  耗时 %.2fs" % max(
                0.0, (int(time_info["end"]) - int(time_info["start"])) / 1000.0
            )
        lines.append("时间: %s%s" % (fmt_time(time_info["start"]), duration))
    tool_input = state.get("input")
    if tool_input:
        lines.extend(["", "输入:", pretty_json(tool_input)])
    output = state.get("output")
    if not output and isinstance(state.get("metadata"), dict):
        # bash 工具的输出可能只存在于 state.metadata.output。
        output = state["metadata"].get("output")
    lines.extend(["", "输出:", output if output else "(空输出)"])
    error = state.get("error")
    if error:
        lines.extend(["", "错误:", str(error)])
    metadata = state.get("metadata")
    if isinstance(metadata, dict):
        if metadata.get("exit") is not None:
            lines.append("退出码: %s" % metadata["exit"])
        if metadata.get("truncated"):
            lines.append(
                "注意: 工具自身报告输出被截断（state.metadata.truncated=true），"
                "本文件未做任何额外截断。"
            )
    if error is None and status == "error":
        lines.append("注意: 状态为 error 但缺少 error 字段，原始 state 见下。")
        lines.append(pretty_json(state))
    return lines


def render_opencode_file(part):
    """附件：只呈现路径/媒体元信息，不伪造图片内容。"""
    lines = ["### 附件（file）"]
    if part.get("filename"):
        lines.append("文件名: %s" % part["filename"])
    lines.append("类型: %s" % (part.get("mime") or "未知"))
    url = part.get("url") or ""
    if url.startswith("data:"):
        lines.append("数据 URL: <内联数据，%d 字节，不在此展开>" % len(url))
    elif url:
        lines.append("URL: %s" % url)
    source = part.get("source")
    if isinstance(source, dict) and source.get("path"):
        lines.append("路径: %s" % source["path"])
    if str(part.get("mime") or "").startswith("image/"):
        lines.append("(图片附件仅显示路径/元信息，不伪造图片内容)")
    return lines


# ---------------------------------------------------------------------------
# 输出与查看
# ---------------------------------------------------------------------------


def write_output(content, output_path):
    """--output：UTF-8 写文件后退出，不启动 nvim。"""
    path = Path(output_path).expanduser()
    parent = path.parent
    if str(parent) and not parent.exists():
        parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(content)
    sys.stderr.write(
        "ai-read: 已导出 %d 字节到 %s\n" % (path.stat().st_size, path)
    )


def view_in_nvim(content, file_suffix):
    """写临时文件并用 nvim -R -n 打开，退出后删除临时文件。

    -R: 只读模式（可 yank、搜索；:w 需显式覆盖）；-n: 不产生 swap 文件；
    不加 --clean、不设 -u：加载用户默认配置（含 Colemak 键位与主题）。
    """
    nvim = shutil.which("nvim")
    if not nvim:
        fail("找不到 nvim，无法打开阅读窗口（可改用 --output 导出）")
    handle, temp_name = tempfile.mkstemp(
        prefix="herdr-ai-read-", suffix=file_suffix
    )
    temp_path = Path(temp_name)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="") as file_obj:
            file_obj.write(content)
        proc = subprocess.run([
            nvim, "-R", "-n", "-c", "setlocal readonly nomodifiable", str(temp_path)
        ])
        if proc.returncode != 0:
            sys.stderr.write(
                "ai-read: nvim 退出码 %d（临时文件已删除）\n" % proc.returncode
            )
    finally:
        try:
            temp_path.unlink()
        except FileNotFoundError:
            pass
    return proc.returncode


def main(argv=None):
    if os.name == "nt":
        # Windows 控制台默认非 UTF-8；错误信息中的中文不至乱码。
        for stream in (sys.stdout, sys.stderr):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (AttributeError, ValueError):
                pass
    parser = argparse.ArgumentParser(
        prog="read-session.py",
        description="在 Neovim 中阅读 Herdr 窗格滚屏与 AI 会话（OMP / OpenCode）。",
        epilog=USAGE_EXAMPLES,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--scrollback",
        action="store_true",
        help="读取窗格最近滚屏（herdr pane read --source recent-unwrapped）",
    )
    mode.add_argument(
        "--session",
        action="store_true",
        help="读取窗格 agent 的完整会话（OMP render / OpenCode export）",
    )
    parser.add_argument(
        "--pane",
        metavar="PANE_ID",
        help="显式指定目标窗格；默认用 HERDR_ACTIVE_PANE_ID（popup 注入）",
    )
    parser.add_argument(
        "--output",
        metavar="PATH",
        help="写入该文件后退出（不启动 nvim），供非交互验收",
    )
    args = parser.parse_args(argv)

    target = resolve_target(args.pane)
    if args.scrollback:
        content, file_suffix = build_scrollback_doc(target)
    else:
        agent = fetch_agent(target)
        content, file_suffix = build_session_doc(agent, target)

    if args.output:
        write_output(content, args.output)
        return EXIT_OK
    return view_in_nvim(content, file_suffix)


if __name__ == "__main__":
    sys.exit(main())
