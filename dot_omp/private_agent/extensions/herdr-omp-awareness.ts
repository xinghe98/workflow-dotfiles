// Herdr 现场感知扩展：在 agent 开始处理每次用户提交前，把「自己是谁、同工作区还有哪些 agent、
// 他们各自在做什么」作为一条隐藏上下文消息注入，使 agent 不需要用户提醒就知道自己在 Herdr 里，
// 并主动查看、等待或直接协调其他 agent。
//
// 行为：仅在 HERDR_ENV=1 且存在 HERDR_SOCKET_PATH 与 HERDR_PANE_ID 时生效；
//      读取 `herdr agent list` 与 `herdr pane list`；仅当现场签名变化或距上次注入超过刷新间隔时注入，
//      避免每轮重复占用上下文。
// 副作用：只读调用 herdr CLI（不写状态、不切焦点、不改布局）；任何失败都静默跳过，绝不阻塞会话。
// 前置条件：herdr 可执行文件在 PATH 中，且本进程运行在 Herdr 面板内。

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";

/** 同一现场最多每 5 分钟重注入一次，避免上下文堆叠重复快照。 */
const REFRESH_MS = 5 * 60 * 1000;
/** 快照里最多列出的其他 agent 数量。 */
const MAX_AGENTS = 12;
/** 快照里最多列出的空闲终端面板数量。 */
const MAX_SHELL_PANES = 6;
/** 单条快照的最大字符数。 */
const MAX_CHARS = 1400;

const selfPaneId = process.env.HERDR_PANE_ID;
const workspaceId = process.env.HERDR_WORKSPACE_ID;
const tabId = process.env.HERDR_TAB_ID;
const ENABLED = process.env.HERDR_ENV === "1" && !!selfPaneId && !!process.env.HERDR_SOCKET_PATH;

let lastSignature = "";
let lastInjectedAt = 0;

/** 运行一次 herdr CLI 并解析 JSON 输出；启动失败、超时或输出非法 JSON 时返回 undefined。 */
async function herdrJson(args: string[], timeoutMs = 4000): Promise<unknown> {
  const { promise, resolve } = Promise.withResolvers<string | undefined>();
  execFile(
    "herdr",
    args,
    { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout) => resolve(error ? undefined : String(stdout)),
  );
  const stdout = await promise;
  if (stdout === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    return undefined;
  }
}

/** 现场快照中的一行 agent；字段全部来自 herdr CLI 输出，缺失时为空串。 */
type RosterAgent = {
  /** pane 标识，如 `w1H:p4`；协调命令的目标。 */
  paneId: string;
  /** agent 种类，如 `omp`、`codex`。 */
  kind: string;
  /** 生命周期状态：working / idle / blocked / done / unknown。 */
  status: string;
  /** 会话标题或终端标题，用于判断对方在做什么。 */
  title: string;
  /** 对方工作目录。 */
  cwd: string;
};

/** 解析后的现场快照。 */
type Roster = {
  /** 同工作区内识别到的 agent。 */
  agents: RosterAgent[];
  /** 同工作区内没有 agent 的终端面板标识。 */
  shellPaneIds: string[];
};

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function readRows(payload: unknown, key: string): Record<string, unknown>[] {
  const rows = readRecord(readRecord(payload)?.result)?.[key];
  return Array.isArray(rows) ? rows.map(readRecord).filter((row) => row !== undefined) : [];
}

function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/** 压平空白并截断，避免把多行标题灌进上下文。 */
function clip(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** 把 herdr CLI 输出解析成现场快照；结构与字段都不可信，缺失按空值处理。 */
function parseRoster(agentPayload: unknown, panePayload: unknown): Roster {
  const agents = readRows(agentPayload, "agents").map((row) => ({
    paneId: readText(row.pane_id, "?"),
    kind: readText(row.agent, "unknown"),
    status: readText(row.agent_status, "unknown"),
    title: clip(readText(row.title) || readText(row.terminal_title_stripped), 60),
    cwd: readText(row.cwd),
  }));
  const occupied = new Set(agents.map((agent) => agent.paneId));
  const shellPaneIds = readRows(panePayload, "panes")
    .map((row) => readText(row.pane_id, "?"))
    .filter((paneId) => !occupied.has(paneId));
  return { agents, shellPaneIds };
}

/** 组装注入文本：面板身份、其他 agent 的进度、以及可直接执行的协调命令。 */
function buildMessage(roster: Roster): string {
  const others = roster.agents.filter((agent) => agent.paneId !== selfPaneId).slice(0, MAX_AGENTS);
  const self = roster.agents.find((agent) => agent.paneId === selfPaneId);
  const shellPanes = roster.shellPaneIds.slice(0, MAX_SHELL_PANES);

  const lines = [
    "Herdr 现场（自动注入，可能已过期；需要准确状态时自己跑 `herdr agent list`）",
    self
      ? `你在 Herdr 面板 ${self.paneId}（工作区 ${workspaceId ?? "?"}，标签页 ${tabId ?? "?"}），当前状态 ${self.status}。`
      : `你在 Herdr 面板 ${selfPaneId}（工作区 ${workspaceId ?? "?"}，标签页 ${tabId ?? "?"}）。`,
  ];

  if (others.length === 0) {
    lines.push("同工作区当前没有其他 agent。");
  } else {
    lines.push(`同工作区其他 agent ${others.length} 个：`);
    lines.push(
      ...others.map((agent) =>
        [`- ${agent.kind} · ${agent.paneId} · ${agent.status}`, agent.title, agent.cwd]
          .filter(Boolean)
          .join(" · "),
      ),
    );
  }
  if (shellPanes.length > 0) {
    lines.push(`同工作区无 agent 的终端面板：${shellPanes.join("、")}`);
  }

  lines.push(
    "协作方式：`herdr agent read <面板ID> --source recent-unwrapped --lines 80` 看对方最新输出；" +
      '`herdr agent wait <面板ID> --timeout 120000` 等它空闲或阻塞；`herdr agent prompt <面板ID> "..." --wait` 直接传话；' +
      '`herdr pane run <面板ID> "命令"` 在空闲面板跑命令。' +
      "不请用户代为转达，也不要仅凭这份快照断言别人已完成——以实时 `herdr agent list` / `herdr agent read` 为准。",
  );

  const text = lines.join("\n");
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
}

/** 注入消息契约，字段含义与 omp 扩展自定义消息一致。 */
type AwarenessMessage = {
  /** 消息类型标识，用于在会话记录中区分注入内容。 */
  customType: string;
  /** 注入给模型的正文。 */
  content: string;
  /** 是否在界面上立即渲染；现场快照为隐藏上下文，故为 false。 */
  display: boolean;
  /** 归属方；现场快照由扩展生成，不算用户输入。 */
  attribution: string;
};

/** 扩展注册接口的最小结构，只依赖本文件用到的事件与返回值。 */
type AwarenessApi = {
  on(
    event: "before_agent_start",
    handler: () => Promise<{ message: AwarenessMessage } | undefined>,
  ): void;
};

export default function herdrAwareness(pi: AwarenessApi): void {
  if (!ENABLED) {
    return;
  }

  pi.on("before_agent_start", async () => {
    const [agentPayload, panePayload] = await Promise.all([
      herdrJson(["agent", "list"]),
      workspaceId ? herdrJson(["pane", "list", "--workspace", workspaceId]) : Promise.resolve(undefined),
    ]);

    // herdr 不可用或输出不可解析：静默跳过，不向会话注入半成品现场。
    const roster = parseRoster(agentPayload, panePayload);
    if (roster.agents.length === 0) {
      return;
    }

    const signature = createHash("sha1")
      .update(
        JSON.stringify(
          roster.agents.map((agent) => [agent.paneId, agent.kind, agent.status, agent.title]),
        ),
      )
      .digest("hex");

    const now = Date.now();
    if (signature === lastSignature && now - lastInjectedAt < REFRESH_MS) {
      return;
    }
    lastSignature = signature;
    lastInjectedAt = now;

    return {
      message: {
        customType: "herdr-awareness",
        content: buildMessage(roster),
        display: false,
        attribution: "agent",
      },
    };
  });
}
