import { css, html, nothing, TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { DataGridContext, DataGridPaging } from "./context";
import { ViewMetaControl } from "../../../view-meta";
import { VmObject } from "../../../../core/view-state";
import { appendOuterCSSGridClass, getStyleAndThis } from "../presentation";
import { onCellSelectKeyDown, onCellSelectMouseDown, onCellSelectMouseMove } from "./cell-select";

export type { DataGridContext, DataGridActionGroup } from "./context";

export const dataGridStyles = css`
  .tk-data-table { transform: none; }
  .tk-data-table__cell { outline: none; }
  .tk-data-table__cell.cellselect { background-color: rgba(var(--primary-color, 245, 156, 26), 0.1); user-select: none; }
  .tk-data-table__cell.cellselect_top { border-top: 2px solid gray; }
  .tk-data-table__cell.cellselect_left { border-left: 2px solid gray; }
  .tk-data-table__cell.cellselect_right { border-right: 2px solid gray; }
  .tk-data-table__cell.cellselect_bottom { border-bottom: 2px solid gray; }
  .tk-data-table__paging .show-actions { margin-right: auto; }
  .tk-data-table__no-records { left: 50%; pointer-events: none; position: absolute; top: 50%; transform: translate(-50%, -50%); }
  .tk-data-table__paging { align-items: center; display: flex; flex: 0 0 auto; gap: 0.25rem; justify-content: flex-end; padding: 0.35rem 0.25rem 0; }
  .tk-data-table__page-size { align-items: center; display: flex; gap: 0.4rem; margin: 0 0.75rem 0 0; }
  .tk-data-table__page-size select { width: auto; }
  .tk-data-table__page-info { min-width: 7rem; text-align: center; white-space: nowrap; }
  .tk-data-table__page-button { align-items: center; background: transparent; border: 0; border-radius: 50%; cursor: pointer; display: inline-flex; height: 2rem; justify-content: center; padding: 0; width: 2rem; }
  .tk-data-table__page-button:hover:not(:disabled) { background: #edf1f4; }
  .tk-data-table__page-button:disabled { cursor: default; opacity: 0.35; }
  .tk-data-table__content--advanced { min-width: 0; position: relative; }
  .tk-data-table__content--advanced .tk-data-table__native {
    inset: auto;
    max-width: none;
    position: relative;
    width: calc(100% - 1px);
  }
`;

function renderRow(
  context: DataGridContext,
  columns: readonly ViewMetaControl[],
  row: VmObject
): TemplateResult {
  const isCurrent = context.selectedRowId
    ? context.selectedRowId === row.vmClassId
    : row.attributes.vCurrent === true;
  return html`<tr
    class=${isCurrent
      ? "current-row tk-data-table__row tk-data-table__row--current"
      : "tk-data-table__row"}
    @click=${() => context.onSelectRow(row)}
    @contextmenu=${(event: MouseEvent) => context.onOpenRowMenu(event, row)}
    @dblclick=${(event: MouseEvent) => context.onDoubleClickRow(event, row)}>
    ${context.multiSelect ? html`<td class="row-selection-cell tk-data-table__cell">
      <input type="checkbox" aria-label=${`Select ${row.className} ${row.id}`}
        .checked=${row.attributes.vSelected === true}
        @click=${(event: MouseEvent) => event.stopPropagation()}
        @change=${(event: Event) => context.onToggleSelection(
          row,
          (event.currentTarget as HTMLInputElement).checked
        )}>
    </td>` : nothing}
    ${columns.map(control => html`
      <td class="tk-data-table__cell" tabindex="-1">${context.renderCell(control, row)}</td>
    `)}
    <td class="row-menu-cell tk-data-table__cell">
      <button type="button" class="row-menu-trigger" aria-haspopup="menu"
        aria-label=${`Actions for ${row.className} ${row.id}`}
        aria-expanded=${context.rowMenu?.rowVMClassId === row.vmClassId}
        @click=${(event: MouseEvent) => context.onOpenRowMenu(event, row)}>⋮</button>
    </td>
  </tr>`;
}

function renderRowMenu(context: DataGridContext): TemplateResult | typeof nothing {
  const menu = context.rowMenu;
  if (!menu) {
    return nothing;
  }
  return html`<div class="row-context-menu" role="menu"
    aria-label=${menu.label}
    style=${`left:${menu.x}px;top:${menu.y}px`}
    @click=${(event: Event) => event.stopPropagation()}
    @keydown=${(event: KeyboardEvent) => {
      if (event.key === "Escape") {
        context.onDismissRowMenu();
      }
    }}>
    ${context.rowMenuGroups.length > 0
      ? context.rowMenuGroups.map(group => html`
          ${group.name ? html`<div class="row-menu-group">${group.name}</div>` : nothing}
          ${group.actions.map(action => html`
            <button type="button" role="menuitem" ?disabled=${!action.Enable}
              @click=${(event: MouseEvent) => {
                event.stopPropagation();
                context.onDismissRowMenu();
                context.onExecuteRowAction(action, menu.rowVMClassId, event);
              }}>${action.Presentation || action.Action}</button>
          `)}
        `)
      : html`<button type="button" role="menuitem" disabled>No actions available</button>`}
  </div>`;
}

function renderSelectAll(context: DataGridContext): TemplateResult {
  const rows = context.sortedCollection;
  const selectedCount = rows.filter(row => row.attributes.vSelected === true).length;
  const all = rows.length > 0 && selectedCount === rows.length;
  return html`<th class="row-selection-cell tk-data-table__header-cell" aria-label="Row selection">
    <input type="checkbox" aria-label="Select all rows"
      .checked=${all}
      .indeterminate=${selectedCount > 0 && !all}
      ?disabled=${rows.length === 0}
      @click=${(event: MouseEvent) => event.stopPropagation()}
      @change=${(event: Event) => {
        const checked = (event.currentTarget as HTMLInputElement).checked;
        rows.forEach(row => {
          if ((row.attributes.vSelected === true) !== checked) {
            context.onToggleSelection(row, checked);
          }
        });
      }}>
  </th>`;
}

function pageInfoText(paging: DataGridPaging): string {
  const { page, pageSize, totalCount } = paging;
  if (totalCount > 0 && pageSize > 0 && page >= 0) {
    const first = pageSize * page + 1;
    return `${first}-${Math.min(first + pageSize - 1, totalCount)} of ${totalCount}`;
  }
  return totalCount === 0 ? "No results" : "";
}

function renderPaging(context: DataGridContext): TemplateResult | typeof nothing {
  const paging = context.paging;
  if (!paging) {
    return nothing;
  }
  const atStart = paging.page < 1;
  const atEnd = paging.page >= paging.pageCount - 1;
  const button = (
    action: "__SM_FULLBACK" | "__SM_BACK" | "__SM_FORWARD" | "__SM_FULLFORWARD",
    icon: string,
    label: string,
    disabled: boolean
  ) => html`<button type="button" class="tk-data-table__page-button" aria-label=${label}
    ?disabled=${disabled} @click=${() => context.onPageAction(action)}><span class="mi">${icon}</span></button>`;
  return html`<div class="tk-data-table__seekmore tk-data-table__paging">
    <button type="button" class="tk-data-table__page-button show-actions context-actions"
      aria-label="More" aria-haspopup="menu" aria-expanded=${paging.moreMenu !== undefined}
      @click=${(event: MouseEvent) => { event.stopPropagation(); context.onOpenPagingMenu(event); }}>
      <span class="mi">more_vert</span>
    </button>
    ${paging.moreMenu ? html`<div class="row-context-menu" role="menu" aria-label="More"
      style=${`left:${paging.moreMenu.x}px;top:${paging.moreMenu.y}px`}
      @click=${(event: Event) => event.stopPropagation()}
      @keydown=${(event: KeyboardEvent) => { if (event.key === "Escape") { context.onDismissPagingMenu(); } }}>
      ${paging.moreActions.map(action => html`<button type="button" role="menuitem"
        @click=${() => { context.onDismissPagingMenu(); context.onPagingMenuAction(action.id); }}>${action.label}</button>`)}
    </div>` : nothing}
    <label class="tk-data-table__page-size">Page Size:
      <select aria-label="Page size"
        @change=${(event: Event) => context.onPageSize(Number((event.currentTarget as HTMLSelectElement).value))}>
        ${paging.pageSizes.map(size => html`<option value=${size} ?selected=${size === paging.pageSize}>${size}</option>`)}
      </select>
    </label>
    ${button("__SM_FULLBACK", "first_page", "First page", atStart)}
    ${button("__SM_BACK", "chevron_left", "Previous page", atStart)}
    <span class="tk-data-table__page-info">${pageInfoText(paging)}</span>
    ${button("__SM_FORWARD", "chevron_right", "Next page", atEnd)}
    ${button("__SM_FULLFORWARD", "last_page", "Last page", atEnd)}
  </div>`;
}

export function renderDataGrid(context: DataGridContext): TemplateResult {
  const control = context.metadata;
  const columns = control.columns.filter(item => item.attributes.NotVisible?.toLowerCase() !== "true");
  return html`
    <div class="view-control ${appendOuterCSSGridClass(
      context,
      getStyleAndThis(context, "tk-component tk-data-table"),
      ["full-height"]
    )}"
      style=${control.wrapperStyle || nothing}>
      ${context.label ? html`<label class=${getStyleAndThis(context, "tk-data-table__label tk-label")}>${context.label}</label>` : nothing}
      <div class=${getStyleAndThis(context, "tk-data-table__content tk-data-table__content--advanced editable")}>
        <table class=${getStyleAndThis(context, "tk-data-table__native")}
          @mousedown=${onCellSelectMouseDown} @mousemove=${onCellSelectMouseMove} @keydown=${onCellSelectKeyDown}>
          <colgroup>
            ${context.multiSelect ? html`<col style="width:2.5rem">` : nothing}
            ${columns.map((_, index) => {
              const width = context.columnWidths.get(index);
              return html`<col data-column-index=${index} style=${width ? `width:${width}px` : nothing}>`;
            })}
            <col style="width:3rem">
          </colgroup>
          <thead><tr class="tk-data-table__header-row">
            ${context.multiSelect ? renderSelectAll(context) : nothing}
            ${columns.map((item, index) => {
              const columnName = item.attributes.BindInfoColumn;
              const activeSort = context.sort?.column === columnName;
              const dynamicLabelColumn = context.metadata.attributes.BindInfoColumn && columnName
                ? `${context.metadata.attributes.BindInfoColumn}_${columnName}_Label`
                : undefined;
              const dynamicLabel = dynamicLabelColumn
                ? context.object?.attributes[dynamicLabelColumn]
                : undefined;
              const label = typeof dynamicLabel === "string" && dynamicLabel.trim() !== ""
                ? dynamicLabel
                : item.attributes.StaticLabel || columnName || "";
              return html`<th class="tk-data-table__header-cell"
                aria-sort=${activeSort ? context.sort?.direction ?? "none" : "none"}>
                ${columnName
                  ? html`<button type="button" class="grid-sort-button tk-data-table__header-button"
                      aria-label=${`Sort by ${label}`}
                      @click=${() => context.onSort(columnName)}>
                      ${label}${activeSort
                        ? context.sort?.direction === "ascending" ? " ▲" : " ▼"
                        : ""}
                    </button>`
                  : label}
                <span class="grid-resize-handle" role="separator" aria-orientation="vertical"
                  aria-label=${`Resize ${label || "column"} column`}
                  tabindex="0"
                  @pointerdown=${(event: PointerEvent) => context.onBeginResize(event, index)}
                  @pointermove=${context.onMoveResize}
                  @pointerup=${context.onEndResize}
                  @pointercancel=${context.onEndResize}
                  @keydown=${(event: KeyboardEvent) => context.onResizeByKeyboard(event, index)}></span>
              </th>`;
            })}
            <th class="row-menu-cell" aria-hidden="true"></th>
          </tr></thead>
          <tbody>
            ${repeat(context.sortedCollection, row => row.vmClassId, row => renderRow(context, columns, row))}
          </tbody>
        </table>
        ${context.noResultsBackdrop ? html`<div class="tk-data-table__no-records"><img src="/Content/icons/tkSearchNoRecords.svg" class="tkSearchNoRecords" alt="No results"></div>` : nothing}
      </div>
      ${renderPaging(context)}
      ${renderRowMenu(context)}
    </div>
  `;
}
