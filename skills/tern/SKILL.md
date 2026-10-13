---
name: tern
description: "Use when working inside Tern panes or coordinating agents through Tern. Resolve session identity, exchange durable requests and replies, and install omp terminal awareness."
metadata:
  version: "1.0.0"
---

# Tern agent coordination

Use this skill when the user asks to identify a Tern pane, coordinate agents, or install automatic terminal awareness. It includes an omp extension supporting Tern and Herdr. Do not control a terminal solely because its CLI is installed.

## Install automatic awareness

A skill installation alone does not activate omp extensions. When the user requests setup, run the bundled installer from this skill directory:

```sh
node scripts/install.mjs
```

Requires Node.js 24 or newer and `tern` in PATH for Tern operations. The installer defaults to `PI_CODING_AGENT_DIR` or `~/.omp/agent`; pass `--agent-dir <absolute-path>` for a separate profile. It installs this skill, the awareness extension, and global coordination rules. Existing differing files are backed up. Repeated installation with unchanged content performs no writes. It never changes terminal layouts, credentials, model settings, or running sessions.

Restart omp and resume the session, or reload extensions using the installed omp version's supported command. Existing running agents retain their loaded extension until reloaded. Other agent products may follow these instructions but cannot load the omp-specific extension.

## Identify before communicating

1. Read environment markers. `TERM_PROGRAM=tern` OR an existing `TERN_PANE` makes Tern a candidate; absence of `TERN_PANE` does not exclude it.
2. Read `tern --help` and command-specific help. Run `tern inspect --json`.
3. Match the current omp session file to exactly one live pane's `omp_session_file`. Never identify yourself by title, directory, focus, or inherited pane variable alone. If no unique match exists, stop targeted terminal operations and report the missing identity evidence. Tool subagents use their parent agent channel instead of impersonating the parent's pane.
4. Check related agents by repository and task scope. Read their output before editing shared files. Do not repair another agent's incomplete work without coordinating ownership.
5. Use explicit verified IDs, never `@focused`. Recheck identity before sending. Multiple windows require the installed CLI's `--window` selection. Do not send into a shell or approval dialog.

## Durable communication

Read [the complete protocol](references/coordination.md) before sending requests. This reference also defines Herdr safeguards; use Herdr only inside a verified Herdr environment.

The default mailbox is `~/.omp/agent/coordination/`, relative to the active agent data directory. Obtain both full session paths from live identity evidence. Generate a UUID and write a complete UTF-8 JSON request, at most 32 KiB:

```json
{"requestId":"<UUID>","fromSession":"<sender session absolute path>","toSession":"<recipient session absolute path>","body":"Task, affected files, precise question; no secrets."}
```

Save as `<UUID>.request.json` before notifying the recipient:

```sh
tern send <verified-pane-id> paste "Coordination request <UUID>: read <absolute request path>, verify toSession, write the matching reply file before notifying me."
tern send <same-pane-id> keys enter
```

Quote arguments for the actual shell. A successful send proves transport only. The recipient checks session identity and existing replies, then writes `<UUID>.reply.json`:

```json
{"requestId":"<UUID>","fromSession":"<recipient session absolute path>","toSession":"<sender session absolute path>","status":"answered","body":"Concrete conclusion and evidence."}
```

`status` is `answered`, `blocked`, or `rejected`. A blocked/rejected reply does not mean the requested task succeeded. A repeated request reuses the existing reply and never repeats business mutations. Request and reply are immutable once fully written; follow-up questions use a new UUID referring to the original.

The sender reads the reply and verifies both session paths and request ID, then writes `<UUID>.seen.json`:

```json
{"requestId":"<UUID>","session":"<sender session absolute path>"}
```

No further acknowledgment notification is necessary. The extension reminds the current session of pending incoming requests, unanswered outgoing requests, and unread replies at each task start. During long tasks, check known reply paths at independent step boundaries, when blocked, and before delivery.

## Waiting and recovery

- Do not use `sleep 45; tern capture ... | tail` as a response protocol. Fast replies remain in the mailbox regardless of terminal scrolling.
- `tern capture <ID> --surfaces` is for observing the surface. A request string appearing there is not an answer.
- A short `tern wait <ID> --until idle=1000 --timeout 30` is allowed only when no independent work remains; idle is not completion. Read the reply afterward.
- On timeout, check the reply and the recipient's live session before considering another notification with the same UUID. Never resend a business action under a new ID merely because no reply was observed.
- For older screen-only conversations, use the verified `omp_session_file` to locate the actual reply associated with a unique request marker. Request occurrence counts are not evidence of a reply.
- Malformed, partially written, oversized, or mismatched files are not completion. The next scan retries readable records; read exact paths when automatic scan limits are reached.
- There is no background watcher or automatic wake-up. Terminal notification remains necessary for an idle recipient. Local files are not a cross-machine transport.
- Keep the mailbox out of Git/chezmoi. Do not store secrets or business-sensitive payloads. Do not delete unacknowledged messages; archive acknowledged records as needed.
