import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { CustomEditor } from "@oh-my-pi/pi-coding-agent/modes/components";
import { canonicalKeyId, parseKey } from "@oh-my-pi/pi-tui";

const DOUBLE_ESCAPE_WINDOW_MS = 500;

/**
 * Colemak-DH relabeling for the native Vim state machine (`tui.vimMode` is
 * enabled by config). Applied only where Vim owns the keyboard — Normal mode,
 * Visual mode, or a half-typed operator/count — never in Insert mode.
 *
 * Entries keep strict `noremap` semantics, matching the reference nvim config:
 * - one printable ASCII byte → one Vim key. `h→e` makes `yh` yank to word end;
 *   `k→i` reaches the text-object "inside" prefix (`dkw` = `diw`,
 *   `ck"` = `ci"`), deliberately without exempting operator-pending/Visual
 *   `i`/`k`, exactly as nvim behaves for these mappings;
 * - `U`/`E` expand to `5k`/`5j`, fed as one chunk that the Vim replay consumes
 *   grapheme by grapheme (count, then motion); the generated keys are never
 *   themselves translated;
 * - digits (Vim counts), multi-char sequences (CSI chords, bracketed paste,
 *   batched runs), and non-ASCII bytes pass through untouched; Ctrl chords
 *   never match this map (they arrive as multi-char sequences).
 */
const COLEMAK_VIM_KEYS: Record<string, string> = {
  n: "h", // left
  e: "j", // down
  u: "k", // up
  i: "l", // right
  h: "e", // end of word (so `yh` = `ye`)
  k: "i", // insert / text-object "inside" (so `dkw` = `diw`, `ck"` = `ci"`)
  K: "I", // insert at line start
  l: "u", // undo
  N: "0", // line start
  I: "$", // line end
  W: "b", // previous word
  U: "5k", // five lines up
  E: "5j", // five lines down
};

/**
 * Make editor shortcuts context-sensitive:
 * - autocomplete open  → navigate / confirm / cancel as usual
 * - native Vim mode    → Colemak-DH Normal/Visual/operator keys
 * - running agent      → require two Esc presses to interrupt
 * - normal editor input → Tab toggles write/plan and Enter submits
 *
 * CustomEditor's interception pass — host-registered custom chords (Tab plan
 * toggle, Enter follow-up) and built-in app actions (Escape interrupt, clear,
 * exit, …) — runs ahead of the base Editor dispatch. This subclass bypasses
 * that pass via `handleDraftEdit` where the editor must win (Tab/Enter with an
 * open popup), delays the interrupt behind a double-Esc window, and relabels
 * Vim keys for Colemak.
 */
class TabPlanToggleEditor extends CustomEditor {
  #lastInterruptEscape = 0;
  #escapeAfterFocusReturn = false;
  // CustomEditor replays input after an async image paste. Queue original
  // keys while that paste is pending, then translate against the replayed mode.
  #asyncPasteDepth = 0;
  #hostOnPasteImage?: () => Promise<boolean>;
  #hostOnPasteImagePath?: (path: string) => void | Promise<void>;

  shouldConfirmInterrupt = () => false;
  onInterruptArmed = () => {};

  constructor(...args: ConstructorParameters<typeof CustomEditor>) {
    super(...args);
    let focused = this.focused;
    Object.defineProperty(this, "focused", {
      configurable: true,
      enumerable: true,
      get: () => focused,
      set: (value: boolean) => {
        if (focused && !value) {
          this.#lastInterruptEscape = 0;
          // TUI also toggles this flag when refocusing the same component.
          // Only an editor still unfocused after the turn has truly lost focus.
          queueMicrotask(() => {
            if (!focused) this.#escapeAfterFocusReturn = true;
          });
        }
        focused = value;
      },
    });

    const wrapImagePaste = async (): Promise<boolean> => {
      this.#asyncPasteDepth++;
      try {
        return await this.#hostOnPasteImage?.() ?? false;
      } finally {
        this.#asyncPasteDepth--;
      }
    };
    const wrapPathPaste = async (path: string): Promise<void> => {
      this.#asyncPasteDepth++;
      try {
        await this.#hostOnPasteImagePath?.(path);
      } finally {
        this.#asyncPasteDepth--;
      }
    };
    // These public callbacks are assigned by the host after construction.
    // Mirroring their lifetime keeps mode changes ordered behind attachments.
    Object.defineProperty(this, "onPasteImage", {
      configurable: true,
      enumerable: true,
      get: () => (this.#hostOnPasteImage === undefined ? undefined : wrapImagePaste),
      set: fn => {
        this.#hostOnPasteImage = fn;
      },
    });
    Object.defineProperty(this, "onPasteImagePath", {
      configurable: true,
      enumerable: true,
      get: () => (this.#hostOnPasteImagePath === undefined ? undefined : wrapPathPaste),
      set: fn => {
        this.#hostOnPasteImagePath = fn;
      },
    });
  }

  override handleInput(data: string): void {
    if (this.#asyncPasteDepth > 0) {
      super.handleInput(data);
      return;
    }

    const parsed = parseKey(data);
    const canonical = parsed !== undefined ? canonicalKeyId(parsed) : undefined;
    const isEscape = canonical === "escape";

    if (isEscape) {
      const afterFocusReturn = this.#escapeAfterFocusReturn;
      this.#escapeAfterFocusReturn = false;
      // Priority: an open popup dismisses first, then the native Vim claim
      // (leaving Insert, cancelling Visual or a half-typed operator). Both
      // consume the escape inside the editor, so the interrupt timer resets —
      // arming only ever starts from a quiet Normal mode, and an escape spent
      // on the editor never prompts or arms termination.
      if (this.isShowingAutocomplete() || this.vimConsumesEscape()) {
        this.#lastInterruptEscape = 0;
        super.handleInput(data);
        return;
      }
      if (afterFocusReturn) {
        this.#lastInterruptEscape = 0;
        return;
      }
      if (this.shouldConfirmInterrupt()) {
        const now = Date.now();
        if (now - this.#lastInterruptEscape >= DOUBLE_ESCAPE_WINDOW_MS) {
          this.#lastInterruptEscape = now;
          this.onInterruptArmed();
          return;
        }
        this.#lastInterruptEscape = 0;
        super.handleInput(data);
        return;
      }
      this.#lastInterruptEscape = 0;
      super.handleInput(data);
      return;
    }

    // Any real keystroke between two Escapes breaks the interrupt sequence.
    this.#lastInterruptEscape = 0;
    this.#escapeAfterFocusReturn = false;

    // CSI-u may encode ordinary letters too; translate only unmodified letters
    // or Shift+letter, leaving Ctrl/Alt chords and pasted text to the host.
    const printableKey = data.length === 1
      ? data
      : canonical?.match(/^(?:shift\+)?[a-z]$/)
        ? canonical.startsWith("shift+") ? canonical.slice(6).toUpperCase() : canonical
        : undefined;
    if (this.vimMode !== "insert" && printableKey !== undefined) {
      const translated = COLEMAK_VIM_KEYS[printableKey];
      if (translated !== undefined) {
        super.handleInput(translated);
        return;
      }
    }

    if (canonical === "tab" && this.isShowingAutocomplete()) {
      // Skip CustomEditor app/custom shortcut interception so Tab reaches
      // Editor autocomplete navigation (tui.select.down).
      this.handleDraftEdit(data);
      return;
    }
    if ((canonical === "enter" || canonical === "return") && this.isShowingAutocomplete()) {
      // Keep Enter as autocomplete confirm; queuing a follow-up stays on
      // Ctrl+Enter (app.message.followUp), never on this Enter.
      this.handleDraftEdit(data);
      return;
    }
    super.handleInput(data);
  }

}

export default function tabPlanToggleExtension(pi: ExtensionAPI) {
  // Existing Herdr panes can predate shell/terminal editor configuration.
  // Loading the extension supplies defaults even in an older Herdr pane.
  if (!process.env.VISUAL && !process.env.EDITOR) {
    process.env.VISUAL = "nvim";
    process.env.EDITOR = "nvim";
  }

  let agentRunning = false;

  pi.on("agent_start", async () => {
    agentRunning = true;
  });
  pi.on("agent_end", async event => {
    if (event.isTerminal !== false) {
      agentRunning = false;
    }
  });
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setEditorComponent((tui, theme, _keybindings) => {
      const editor = new TabPlanToggleEditor(tui, theme);
      editor.shouldConfirmInterrupt = () => agentRunning;
      editor.onInterruptArmed = () => ctx.ui.notify("再按一次 Esc 终止当前任务", "warning");
      return editor;
    });
  });
}
