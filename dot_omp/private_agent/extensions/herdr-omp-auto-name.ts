// custom companion to herdr-omp-agent-state.ts (herdr-managed; do not edit that one).
// Reports a content-derived task name to Herdr so sidebar agent rows show what
// each omp session is working on, via `herdr pane report-metadata`.
// Name source: latest explicit session title record if set, else first user message.

import { execFile } from "node:child_process";
import fs from "node:fs";

const bin = process.env.HERDR_BIN_PATH;
const paneId = process.env.HERDR_PANE_ID;
// Nested omp sessions spawned from a parent session's shell must not overwrite
// the pane title owned by the root session (same rule as the managed extension).
const enabled =
  process.env.HERDR_ENV === "1" &&
  typeof bin === "string" &&
  bin.length > 0 &&
  typeof paneId === "string" &&
  paneId.length > 0 &&
  process.env.OMPCODE !== "1";

const source = "custom:omp-auto-name";
const maxTitleLength = 24;

interface SessionManagerLike {
	getSessionFile?: () => unknown;
}

interface ExtensionContext {
	hasUI?: unknown;
	sessionManager?: SessionManagerLike;
}

interface OmpExtensionHost {
	on(event: string, handler: (event: unknown, ctx: ExtensionContext) => void): void;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (value === null || typeof value !== "object") return undefined;
	return value as Record<string, unknown>;
}

function report(title: string): void {
	if (!enabled || !bin || !paneId) return;
	try {
		const child = execFile(
			bin,
			["pane", "report-metadata", paneId, "--source", source, "--title", title, "--token", `task=${title}`],
			{ timeout: 4000 },
			() => {},
		);
		child.unref?.();
	} catch {
		// Best-effort display metadata; never let reporting break the session.
	}
}

function readSessionTitle(ctx: ExtensionContext): string | undefined {
	let file: unknown;
	try {
		file = ctx.sessionManager?.getSessionFile?.();
	} catch {
		return undefined;
	}
	if (typeof file !== "string" || file.length === 0) return undefined;

	let lines: string[];
	try {
		lines = fs.readFileSync(file, "utf8").split("\n");
	} catch {
		return undefined;
	}

	let lastTitle: string | undefined;
	let firstUserText: string | undefined;
	for (const line of lines) {
		if (!line) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		const record = asRecord(parsed);
		if (!record) continue;

		if (record.type === "title" && typeof record.title === "string" && record.title.trim().length > 0) {
			lastTitle = record.title.trim();
			continue;
		}

		if (firstUserText === undefined && record.type === "message") {
			const message = asRecord(record.message);
			if (!message || message.role !== "user" || !Array.isArray(message.content)) continue;
			const texts: string[] = [];
			for (const part of message.content) {
				const p = asRecord(part);
				if (p && p.type === "text" && typeof p.text === "string") texts.push(p.text);
			}
			const joined = texts.join(" ").replace(/\s+/g, " ").trim();
			if (joined.length > 0) firstUserText = joined;
		}
	}
	return lastTitle ?? firstUserText;
}

export default function (pi: OmpExtensionHost): void {
	if (!enabled) return;

	let lastReported: string | undefined;
	const update = (_event: unknown, ctx: ExtensionContext): void => {
		if (ctx?.hasUI !== true) return;
		const title = readSessionTitle(ctx);
		if (!title) return;
		const short = title.length > maxTitleLength ? `${title.slice(0, maxTitleLength - 1)}…` : title;
		if (short === lastReported) return;
		lastReported = short;
		report(short);
	};

	pi.on("session_start", update);
	pi.on("session_switch", update);
	pi.on("agent_end", update);
}
