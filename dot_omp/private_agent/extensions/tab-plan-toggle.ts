import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { CustomEditor } from "@oh-my-pi/pi-coding-agent/modes/components";
import { canonicalKeyId, parseKey } from "@oh-my-pi/pi-tui";

const DOUBLE_ESCAPE_WINDOW_MS = 500;

/**
 * Make editor shortcuts context-sensitive:
 * - autocomplete open  → navigate / confirm / cancel as usual
 * - running agent      → require two Esc presses to interrupt
 * - normal editor input → Tab toggles write/plan and Enter queues a follow-up
 *
 * OMP registers app.plan.toggle, app.message.followUp, and app.interrupt as
 * custom key handlers that consume their chords before the base editor sees
 * them. This subclass only bypasses or delays those handlers where needed.
 */
class TabPlanToggleEditor extends CustomEditor {
  #lastInterruptEscape = 0;
  shouldConfirmInterrupt = () => false;
  onInterruptArmed = () => {};

  override handleInput(data: string): void {
    const parsed = parseKey(data);
    const canonical = parsed !== undefined ? canonicalKeyId(parsed) : undefined;
    const isEscape = canonical === "escape";

    if (isEscape && this.shouldConfirmInterrupt() && !this.isShowingAutocomplete()) {
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

    if (!isEscape) {
      this.#lastInterruptEscape = 0;
    }

    if (canonical === "tab" && this.isShowingAutocomplete()) {
      // Skip CustomEditor app/custom shortcut interception so Tab reaches
      // Editor autocomplete navigation (tui.select.down).
      this.handleDraftEdit(data);
      return;
    }
    if (
      (canonical === "enter" || canonical === "return") &&
      this.isShowingAutocomplete()
    ) {
      // Keep Enter as autocomplete confirm; followUp is bound to Enter globally.
      this.handleDraftEdit(data);
      return;
    }
    super.handleInput(data);
  }
}

export default function tabPlanToggleExtension(pi: ExtensionAPI) {
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
