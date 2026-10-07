import { css, html, nothing, TemplateResult } from "lit";
import { ToolbarAction, ToolbarContext, ToolbarEntry } from "./context";

// Layout, colours, state-action icons and the save/cancel/undo/redo colours come from the shared
// Turnkey stylesheets (core.css and theme-default.css); only the <details> drop-down wiring lives here.
export const toolbarStyles = css`
  #contentToolbar { box-sizing: border-box; padding: 0 0 0.5rem; top: 0; }
  #contentToolbar ul { margin: 0; padding: 0; }
  #contentToolbar .toolbar__container { align-items: center; }
  #contentToolbar .toolbar__item { width: auto; }
  #contentToolbar details { position: relative; }
  #contentToolbar summary { cursor: pointer; list-style: none; }
  #contentToolbar summary::-webkit-details-marker { display: none; }
  #contentToolbar details[open] > .dropdown__menu { display: flex; }
  #contentToolbar .dropdown__menu { list-style: none; z-index: 60; }
  #contentToolbar .dropdown__item { width: 100%; }
  #contentToolbar .vmactions__item { display: flex; }
`;

function actionClass(action: ToolbarAction, base: string): string {
  return [base, action.command.Class ?? "", action.disabled ? "disabled" : ""].filter(Boolean).join(" ");
}

function title(action: ToolbarAction): string {
  return action.command.HintWhenEnabled ?? action.command.Presentation ?? "";
}

function renderEntries(context: ToolbarContext, entries: readonly ToolbarEntry[]): TemplateResult {
  const menus = entries.filter(entry => entry.name !== "");
  const buttons = entries.filter(entry => entry.name === "").flatMap(entry => entry.actions);
  return html`
    ${menus.map(menu => html`<li class="toolbar__item dropdown">
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
        <summary class="toolbar__link"><span class="tk-sidebar__group-name">${menu.name}</span><span class="mi">arrow_drop_down</span></summary>
        <ul class="dropdown__menu toolbar">
          ${menu.actions.map(action => html`<li class="dropdown__item">
            <button type="button" class=${actionClass(action, "toolbar-drop__button")} ?disabled=${action.disabled}
              title=${title(action)}
              @click=${(event: MouseEvent) => {
                (event.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
                context.onAction(action, event);
              }}>${action.command.Presentation || action.command.Action}</button>
          </li>`)}
        </ul>
      </details>
    </li>`)}
    ${buttons.map(action => html`<li class="toolbar__item">
      <button type="button" class=${actionClass(action, "tk-toolbar__button")} ?disabled=${action.disabled}
        title=${title(action)}
        @click=${(event: MouseEvent) => context.onAction(action, event)}>
        ${action.command.Presentation || action.command.Action}
      </button>
    </li>`)}`;
}

function renderStateActions(context: ToolbarContext, entries: readonly ToolbarEntry[]): TemplateResult {
  return html`${entries.flatMap(entry => entry.actions).map(action => html`<li class="vmactions__item">
    <button type="button" class=${actionClass(action, "tk-state-action")} ?disabled=${action.disabled}
      title=${title(action)}
      @click=${(event: MouseEvent) => context.onAction(action, event)}>
      ${action.command.Presentation || action.command.Action}
    </button>
  </li>`)}`;
}

export function renderToolbar(context: ToolbarContext): TemplateResult | typeof nothing {
  if (context.left.length === 0 && context.right.length === 0) {
    return nothing;
  }
  return html`<div id="contentToolbar" role="navigation" aria-label="View toolbar">
    <div class="toolbar__container">
      <ul class="toolbar__list">${renderEntries(context, context.left)}</ul>
      <ul class="vmactions__list">${renderStateActions(context, context.right)}</ul>
    </div>
  </div>`;
}