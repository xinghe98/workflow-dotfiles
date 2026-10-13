# Tern skill for omp

Tern pane identity, proactive agent coordination, and durable replies that survive fast output and scrolling. Includes the verified omp awareness extension with Tern and Herdr detection.

## Install from GitHub

Requires Git and Node.js 24+. Run in a directory where `workflow-dotfiles` does not already exist:

```sh
git clone --depth 1 --branch tern-v1.0.0 https://github.com/xinghe98/workflow-dotfiles.git
node workflow-dotfiles/skills/tern/scripts/install.mjs
```

For an existing checkout, update it and rerun the installer. For a separate omp profile:

```sh
node workflow-dotfiles/skills/tern/scripts/install.mjs --agent-dir /absolute/path/to/agent
```

The installer copies the skill to `skills/tern`, installs `extensions/herdr-omp-awareness.ts`, and installs global coordination rules when the existing global rules do not already contain the exact protocol. It defaults to `PI_CODING_AGENT_DIR` or `~/.omp/agent`. Different existing files are backed up under `backups/tern`; identical files are not rewritten. It makes no network requests and does not configure Tern itself.

Restart omp and resume your session, or reload extensions using your installed omp version. Installing a skill alone does not automatically activate an extension. Other coding agents can use the skill instructions, but the bundled extension is omp-specific.

## Behavior

- Resolve a Tern pane by matching the current omp session file against live `tern inspect --json` data, even without `TERN_PANE`.
- Inject terminal identity, peers, communication instructions, and mailbox notices at each task start.
- Persist requests, replies, and read receipts in the agent data directory's `coordination/` directory; terminal messages carry notifications and file paths.
- Match both session identities and request IDs before accepting a reply. Repeated scans preserve unread replies until the sender records receipt.
- Do not use long sleeps or captured screen tails to confirm replies. No background polling, automatic message sending, or business-operation retries.

See [SKILL.md](SKILL.md) and [the protocol](references/coordination.md). `blocked` and `rejected` replies do not mean task success. Long-running tasks must check known reply paths at step boundaries; an idle recipient still needs a terminal notification. Cross-machine mailboxes require an explicitly shared transport and are not implemented here.

## Local data and updates

Do not commit or sync `coordination/` or `backups/`. Do not put secrets or business-sensitive content in coordination messages. Archive acknowledged records as needed; unacknowledged records are not automatically deleted. Automatic scanning is bounded to 500 requests and 32 KiB per file; limit/error notices require reading exact paths rather than assuming no reply exists.

To update, install a newer package and rerun `scripts/install.mjs`. To disable, remove the installed `extensions/herdr-omp-awareness.ts` and the installed `rules/tern-coordination.md` if present, then reload omp. Restore any replaced files from the installer backup if needed; existing `RULES.md` is never modified by this installer.
