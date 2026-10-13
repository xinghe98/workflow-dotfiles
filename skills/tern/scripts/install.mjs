// Install the Tern skill and omp awareness without changing models, credentials or live sessions.
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('node scripts/install.mjs [--agent-dir <absolute-path>]\nDefaults to PI_CODING_AGENT_DIR or ~/.omp/agent. Requires Node.js >=24.');
  process.exit(0);
}
if (args.length !== 0 && !(args.length === 2 && args[0] === '--agent-dir')) {
  throw new Error('Usage: node scripts/install.mjs [--agent-dir <absolute-path>]');
}
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 or newer is required.');
const agentDir = args[1] || process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.omp', 'agent');
if (!path.isAbsolute(agentDir)) throw new Error('Agent directory must be an absolute path.');
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageFiles = ['SKILL.md', 'scripts/install.mjs', 'assets/herdr-omp-awareness.ts', 'references/coordination.md', 'README.md'];
// Read all package assets before changing destination files.
const assets = new Map(await Promise.all(packageFiles.map(async (name) => [name, await readFile(path.join(packageDir, name))])));
const targets = new Map(packageFiles.map((name) => [path.join('skills', 'tern', name), assets.get(name)]));
targets.set(path.join('extensions', 'herdr-omp-awareness.ts'), assets.get('assets/herdr-omp-awareness.ts'));
const protocol = assets.get('references/coordination.md');
let existingRules;
try { existingRules = await readFile(path.join(agentDir, 'RULES.md')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
// Existing installations already containing the exact protocol do not need a duplicate rule file.
if (!existingRules?.equals(protocol)) targets.set(path.join('rules', 'tern-coordination.md'), protocol);
const backupRoot = path.join(agentDir, 'backups', 'tern', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`);
let changed = 0;
for (const [relative, content] of targets) {
  const target = path.join(agentDir, relative);
  let previous;
  try { previous = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous?.equals(content)) continue;
  if (previous) {
    const backup = path.join(backupRoot, relative);
    await mkdir(path.dirname(backup), { recursive: true });
    await writeFile(backup, previous, { flag: 'wx', mode: 0o600 });
    console.log(`Backup: ${backup}`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
  changed += 1;
  console.log(`Installed: ${target}`);
}
console.log(`Tern skill ready: ${changed} file(s) changed. Agent directory: ${agentDir}`);
console.log('Reload omp extensions or restart omp and resume your session. Running sessions are not modified.');
console.log('Keep coordination/ and backups/ local; exclude them from Git and chezmoi.');
