import { css, html, nothing, TemplateResult } from "lit";
import { ToolbarContext, ToolbarEntry } from "./context";

export const toolbarStyles = css`
  .view-toolbar { align-items: center; background: white; border: 1px solid #dce1e5; border-radius: 0.4rem; display: flex; gap: 0.5rem; justify-content: space-between; margin-bottom: 0.5rem; padding: 0.25rem 0.5rem; position: sticky; top: 0; z-index: 25; }
  .view-toolbar ul { align-items: center; display: flex; flex-wrap: wrap; gap: 0.25rem; list-style: none; margin: 0; padding: 0; }
  .view-toolbar button, .view-toolbar summary { background: transparent; border: 0; border-radius: 0.25rem; color: #263746; cursor: pointer; font: inherit; list-style: none; padding: 0.4rem 0.7rem; white-space: nowrap; }
  .view-toolbar summary::-webkit-details-marker { display: none; }
  .view-toolbar summary::after { content: " \\25BE"; }
  .view-toolbar button:hover:not(:disabled), .view-toolbar summary:hover, .view-toolbar button:focus-visible, .view-toolbar summary:focus-visible { background: #edf1f4; }
  .view-toolbar button:disabled { color: #818a90; cursor: default; }
  .view-toolbar details { position: relative; }
  .view-toolbar .toolbar-dropdown { background: white; border: 1px solid #dce1e5; border-radius: 0.3rem; box-shadow: 0 0.4rem 1rem #0003; display: flex; flex-direction: column; gap: 0; left: 0; min-width: 10rem; position: absolute; top: 100%; z-index: 30; }
  .view-toolbar .toolbar-right .toolbar-dropdown { left: auto; right: 0; }
  .view-toolbar .toolbar-dropdown button { text-align: left; width: 100%; }
`;

function renderEntries(context: ToolbarContext, entries: readonly ToolbarEntry[]): TemplateResult {
  const menus = entries.filter(entry => entry.name !== "");
  const buttons = entries.filter(entry => entry.name === "").flatMap(entry => entry.actions);
  return html`
    ${menus.map(menu => html`<li>
      <details @focusout=${(event: FocusEvent) => {
        const details = event.currentTarget as HTMLDetailsElement;
        if (!details.contains(event.relatedTarget as Node | null)) {
          details.open = false;
        }
      }} @keydown=${(event: KeyboardEvent) => {
        if (event.key === "Escape") {
          (event.currentTarget as HTMLDetailsElement).open = false;
        }
      }}>
        <summary>${menu.name}</summary>
        <ul class="toolbar-dropdown">
          ${menu.actions.map(action => html`<li>
            <button type="button" ?disabled=${action.disabled}
              title=${action.command.HintWhenEnabled ?? action.command.Presentation ?? ""}
              @click=${(event: MouseEvent) => {
                (event.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
                context.onAction(action, event);
              }}>${action.command.Presentation || action.command.Action}</button>
          </li>`)}
        </ul>
      </details>
    </li>`)}
    ${buttons.map(action => html`<li>
      <button type="button" class=${action.command.Class ?? ""} ?disabled=${action.disabled}
        title=${action.command.HintWhenEnabled ?? action.command.Presentation ?? ""}
        @click=${(event: MouseEvent) => context.onAction(action, event)}>
        ${action.command.Presentation || action.command.Action}
      </button>
    </li>`)}`;
}

export function renderToolbar(context: ToolbarContext): TemplateResult | typeof nothing {
  if (context.left.length === 0 && context.right.length === 0) {
    return nothing;
  }
  return html`<nav class="view-toolbar" aria-label="View toolbar">
    <ul class="toolbar-left">${renderEntries(context, context.left)}</ul>
    <ul class="toolbar-right">${renderEntries(context, context.right)}</ul>
  </nav>`;
}
