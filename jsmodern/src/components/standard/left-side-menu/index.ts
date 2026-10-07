import { css, html, nothing, TemplateResult } from "lit";
import { LeftSideMenuAction, LeftSideMenuContext, LeftSideMenuGroup } from "./context";

// Item, group and state-action looks (including the save/cancel/undo/redo colours and icons) come from the
// shared Turnkey stylesheets (core.css and theme-default.css) through the tk-sidebar__* and tk-state-action classes.
export const leftSideMenuStyles = css`
  .view-workspace .left-actions[hidden] { display: none; }
  .left-actions { align-self: stretch; background: white; box-shadow: 0 2px 2px rgba(0,0,0,.14), 0 3px 1px -2px rgba(0,0,0,.12), 0 1px 5px rgba(0,0,0,.2); box-sizing: border-box; display: flex; flex-direction: column; max-height: 100%; overflow: hidden; padding: 0; z-index: 2; }
  .left-actions .tk-sidebar__list { flex: 1 1 auto; height: auto; min-height: 0; }
  @media (max-width: 600px) {
    .left-actions { display: block; }
    .view-workspace .left-actions[hidden] { display: none; }
  }
  @media (max-width: 760px) {
    .view-workspace .left-actions:not([hidden]) { box-shadow: 0 0.75rem 2rem #0003; box-sizing: border-box; left: 0.75rem; max-height: calc(100vh - 1.5rem); overflow: auto; position: fixed; top: 0.75rem; width: min(18rem, calc(100vw - 1.5rem)); z-index: 20; }
  }
`;

function isStateAction(action: LeftSideMenuAction): boolean {
  return /-action$/.test(action.command.Class ?? "");
}

function renderItem(context: LeftSideMenuContext, group: LeftSideMenuGroup, action: LeftSideMenuAction, state: boolean): TemplateResult {
  const { command, disabled } = action;
  const base = state ? "tk-state-action" : "tk-sidebar__item";
  return html`<button type="button" class="${base} ${command.Class ?? ""} ${disabled ? "disabled" : ""}"
    ?disabled=${disabled} title=${command.HintWhenEnabled || command.Presentation || ""}
    @click=${(event: MouseEvent) => context.onAction(command, group.targetVMClassId, event)}>
    ${command.Presentation || command.Action}
  </button>`;
}

export function renderLeftSideMenu(context: LeftSideMenuContext): TemplateResult {
  const stateActions = context.groups
    .filter(group => group.className === "GLOBAL")
    .flatMap(group => group.subgroups.flatMap(subgroup => subgroup.actions.filter(isStateAction).map(action => ({ group, action }))));
  return html`
    <aside id="view-actions-panel" class="left-actions" aria-label="View actions"
      ?hidden=${!context.open}>
      ${stateActions.length === 0 ? nothing : html`<div class="tk-sidebar__state-actions">
        ${stateActions.map(({ group, action }) => renderItem(context, group, action, true))}
      </div>`}
      <div class="tk-sidebar__list">
        ${context.groups.map(group => {
          const subgroups = group.subgroups
            .map(subgroup => ({
              ...subgroup,
              actions: group.className === "GLOBAL" ? subgroup.actions.filter(action => !isStateAction(action)) : subgroup.actions
            }))
            .filter(subgroup => subgroup.actions.length > 0);
          if (subgroups.length === 0) {
            return nothing;
          }
          return html`
            ${group.className === "GLOBAL" ? nothing : html`<div class="tk-sidebar__group-header" title=${group.name}>
              <span class="tk-sidebar__group-name">${group.name}</span>
            </div>`}
            <div class="tk-sidebar__group collapse in">
              ${subgroups.map(subgroup => html`
                ${subgroup.name && group.className !== "GLOBAL"
                  ? html`<div class="tk-sidebar__subgroup-header"><span>${subgroup.name}</span></div>`
                  : nothing}
                <div class="tk-sidebar__subgroup collapse in">
                  ${subgroup.actions.map(action => renderItem(context, group, action, false))}
                </div>
              `)}
            </div>`;
        })}
      </div>
    </aside>
  `;
}