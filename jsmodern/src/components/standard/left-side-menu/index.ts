import { css, html, nothing, TemplateResult } from "lit";
import { LeftSideMenuContext } from "./context";

export const leftSideMenuStyles = css`
  .view-workspace .left-actions[hidden] { display: none; }
  .left-actions { align-self: start; background: white; border: 1px solid #dce1e5; border-radius: 0.4rem; max-height: 100%; overflow-y: auto; padding: 0.5rem; position: sticky; top: 0; }
  .left-actions h2 { color: #53616b; font-size: 0.85rem; margin: 0.4rem 0.5rem; }
  .left-action-group + .left-action-group { border-top: 1px solid #e1e5e8; margin-top: 0.4rem; padding-top: 0.35rem; }
  .left-actions button { background: transparent; border: 0; border-radius: 0.25rem; color: #263746; display: block; padding: 0.45rem 0.55rem; text-align: left; width: 100%; }
  .left-actions button:hover:not(:disabled), .left-actions button:focus-visible { background: #edf1f4; }
  .left-actions button:disabled { color: #818a90; cursor: default; }
  .left-actions button { align-items: center; display: flex; gap: 0.45rem; }
  .left-actions .left-action-icon { font-size: 1.1rem; }
  .left-actions button.save-action:not(:disabled), .left-actions button.cancel-action:not(:disabled) { font-weight: 500; }
  .left-actions button.save-action:not(:disabled), .left-actions button.save-action:hover:not(:disabled) { background: rgb(var(--primary-color, 245, 156, 26)); color: rgb(var(--text-on-primary, 0, 0, 0)); }
  .left-actions button.cancel-action:not(:disabled), .left-actions button.cancel-action:hover:not(:disabled) { background: rgb(var(--error-clr, 211, 47, 47)); color: rgb(var(--text-on-error, 255, 255, 255)); }
  .left-actions button.save-action:hover:not(:disabled), .left-actions button.cancel-action:hover:not(:disabled) { filter: brightness(0.92); }
  .left-action-subgroup { color: #75818a; font-size: 0.78rem; margin: 0.35rem 0.5rem 0.1rem; }
  @media (max-width: 600px) {
    .left-actions { display: block; }
    .view-workspace .left-actions[hidden] { display: none; }
  }
  @media (max-width: 760px) {
    .view-workspace .left-actions:not([hidden]) { box-shadow: 0 0.75rem 2rem #0003; box-sizing: border-box; left: 0.75rem; max-height: calc(100vh - 1.5rem); overflow: auto; position: fixed; top: 0.75rem; width: min(18rem, calc(100vw - 1.5rem)); z-index: 20; }
  }
`;

export function renderLeftSideMenu(context: LeftSideMenuContext): TemplateResult {
  return html`
    <aside id="view-actions-panel" class="left-actions" aria-label="View actions"
      ?hidden=${!context.open}>
      ${context.groups.map(group => html`
        <div class="left-action-group">
          ${group.className === "GLOBAL" ? nothing : html`<h2>${group.name}</h2>`}
          ${group.subgroups.map(subgroup => html`
            ${subgroup.name && group.className !== "GLOBAL"
              ? html`<div class="left-action-subgroup">${subgroup.name}</div>`
              : nothing}
            ${subgroup.actions.map(({ command, disabled }) => html`
              <button type="button" class=${command.Class ?? ""} ?disabled=${disabled}
                @click=${(event: MouseEvent) => context.onAction(command, group.targetVMClassId, event)}>
                ${command.Icon ? html`<span class="material-icons left-action-icon" aria-hidden="true">${command.Icon}</span>` : nothing}
                ${command.Presentation || command.Action}
              </button>
            `)}
          `)}
        </div>
      `)}
    </aside>
  `;
}
