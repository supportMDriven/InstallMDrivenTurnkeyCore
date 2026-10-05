// Cell selection for the data grid: drag/shift-select ranges, arrow-key navigation,
// copy to and paste from the clipboard in Excel (tab separated) format.
// Counterpart of the AngularJS client's js/mdriven.cellselect.js, written for shadow DOM.

interface CellPoint { row: number; col: number; }

interface SelectionState {
  anchor?: CellPoint;
  last?: CellPoint;
  dragging: boolean;
}

const states = new WeakMap<HTMLTableElement, SelectionState>();
let activeTable: HTMLTableElement | undefined;

const selectionClasses = ["cellselect", "cellselect_top", "cellselect_left", "cellselect_right", "cellselect_bottom"];

function stateOf(table: HTMLTableElement): SelectionState {
  let state = states.get(table);
  if (!state) {
    state = { dragging: false };
    states.set(table, state);
  }
  return state;
}

function bodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.tBodies[0]?.rows ?? []);
}

function lastDataColumn(table: HTMLTableElement): number {
  const headerCells = table.tHead?.rows[0]?.cells.length ?? 0;
  return Math.max(0, headerCells - 2); // the final column holds the row menu
}

function cellFromEvent(table: HTMLTableElement, event: Event): HTMLTableCellElement | undefined {
  for (const node of event.composedPath()) {
    if (node === table) {
      return undefined;
    }
    if (node instanceof HTMLTableCellElement && node.tagName === "TD") {
      return node.classList.contains("row-menu-cell") ? undefined : node;
    }
  }
  return undefined;
}

function pointOf(cell: HTMLTableCellElement): CellPoint {
  return { row: (cell.parentElement as HTMLTableRowElement).sectionRowIndex, col: cell.cellIndex };
}

function clearSelectionClasses(table: HTMLTableElement): void {
  table.querySelectorAll(".cellselect").forEach(cell => cell.classList.remove(...selectionClasses));
}

function paint(table: HTMLTableElement): void {
  if (activeTable && activeTable !== table) {
    clearSelectionClasses(activeTable);
  }
  activeTable = table;
  clearSelectionClasses(table);
  const state = stateOf(table);
  if (!state.anchor || !state.last) {
    return;
  }
  const rows = bodyRows(table);
  const minRow = Math.min(state.anchor.row, state.last.row);
  const maxRow = Math.min(Math.max(state.anchor.row, state.last.row), rows.length - 1);
  const minCol = Math.min(state.anchor.col, state.last.col);
  const maxCol = Math.max(state.anchor.col, state.last.col);
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell = rows[row]?.cells[col];
      if (!cell) {
        continue;
      }
      cell.classList.add("cellselect");
      if (row === minRow) { cell.classList.add("cellselect_top"); }
      if (row === maxRow) { cell.classList.add("cellselect_bottom"); }
      if (col === minCol) { cell.classList.add("cellselect_left"); }
      if (col === maxCol) { cell.classList.add("cellselect_right"); }
    }
  }
}

function setSelection(table: HTMLTableElement, point: CellPoint, extend: boolean): void {
  const state = stateOf(table);
  if (extend && state.anchor) {
    state.last = point;
  } else {
    state.anchor = point;
    state.last = point;
  }
  paint(table);
}

function cellText(cell: HTMLTableCellElement): string {
  const input = cell.querySelector<HTMLInputElement | HTMLSelectElement>("input,select");
  if (input instanceof HTMLSelectElement) {
    return input.selectedOptions[0]?.textContent?.trim() ?? "";
  }
  if (input) {
    return input.type === "checkbox" ? String(input.checked) : input.value;
  }
  return (cell.innerText ?? "").replace(/\u00A0/g, " ").trim();
}

function copySelection(table: HTMLTableElement): void {
  const { anchor, last } = stateOf(table);
  if (!anchor || !last) {
    return;
  }
  const rows = bodyRows(table);
  const minRow = Math.min(anchor.row, last.row);
  const maxRow = Math.min(Math.max(anchor.row, last.row), rows.length - 1);
  let minCol = Math.min(anchor.col, last.col);
  const maxCol = Math.max(anchor.col, last.col);
  const dataRows = (list: HTMLTableRowElement[], from: number, to: number): string[] => {
    const lines: string[] = [];
    for (let row = from; row <= to; row++) {
      const cells = Array.from(list[row]?.cells ?? []).slice(minCol, maxCol + 1);
      lines.push(cells.map(cell => cell.classList.contains("row-selection-cell") ? undefined : cellText(cell))
        .filter((text): text is string => text !== undefined).join("\t"));
    }
    return lines;
  };
  const lines: string[] = [];
  const headerRow = table.tHead?.rows[0];
  if (headerRow && minCol <= 0 && maxCol >= lastDataColumn(table)) {
    const headers = Array.from(headerRow.cells).slice(minCol, maxCol + 1)
      .filter(cell => !cell.querySelector("input"))
      .map(cell => (cell.textContent ?? "").replace(/[▲▼]/g, "").trim());
    lines.push(headers.join("\t"));
  }
  minCol = Math.max(0, minCol);
  lines.push(...dataRows(rows, minRow, maxRow).filter(line => line.replace(/\t/g, "") !== ""));
  void navigator.clipboard.writeText(lines.join("\r\n"));
  table.dispatchEvent(new CustomEvent("tk-notify", {
    bubbles: true,
    composed: true,
    detail: { message: "Added to clipboard", icon: "content_copy" }
  }));
}

function toDateInputValue(text: string, withTime: boolean): string {
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  return withTime ? `${date}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` : date;
}

function pasteIntoCells(table: HTMLTableElement, text: string): void {
  const { anchor } = stateOf(table);
  if (!anchor) {
    return;
  }
  const rows = bodyRows(table);
  text.split(/\r?\n/).forEach((line, rowOffset) => {
    if (line === "") {
      return;
    }
    line.split("\t").forEach((value, colOffset) => {
      const input = rows[anchor.row + rowOffset]?.cells[anchor.col + colOffset]
        ?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select");
      if (!input || input.disabled || (input as HTMLInputElement).readOnly) {
        return;
      }
      if (input instanceof HTMLSelectElement) {
        const index = Array.from(input.options).findIndex(option => option.textContent?.trim() === value);
        if (index < 0) {
          return;
        }
        input.selectedIndex = index;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (input.type === "checkbox") {
        input.checked = value.toLowerCase() === "true";
      } else if (input.type === "date" || input.type === "datetime-local") {
        input.value = toDateInputValue(value, input.type === "datetime-local");
      } else {
        input.value = value;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function selectAll(table: HTMLTableElement): void {
  const rows = bodyRows(table);
  if (rows.length === 0) {
    return;
  }
  const state = stateOf(table);
  state.anchor = { row: 0, col: 0 };
  state.last = { row: rows.length - 1, col: lastDataColumn(table) };
  paint(table);
}

function focusCell(table: HTMLTableElement, point: CellPoint): void {
  bodyRows(table)[point.row]?.cells[point.col]?.focus();
}

export function onCellSelectMouseDown(event: MouseEvent): void {
  if (event.button !== 0) {
    return;
  }
  const table = event.currentTarget as HTMLTableElement;
  const cell = cellFromEvent(table, event);
  if (!cell) {
    return;
  }
  const state = stateOf(table);
  setSelection(table, pointOf(cell), event.shiftKey);
  state.dragging = true;
  window.addEventListener("mouseup", () => { state.dragging = false; }, { once: true });
  const target = event.target as HTMLElement;
  if (!target.closest("input,select,textarea,button,a")) {
    cell.focus({ preventScroll: true });
  }
}

export function onCellSelectMouseMove(event: MouseEvent): void {
  const table = event.currentTarget as HTMLTableElement;
  const state = stateOf(table);
  if (!state.dragging || (event.buttons & 1) === 0) {
    state.dragging = false;
    return;
  }
  const cell = cellFromEvent(table, event);
  if (!cell) {
    return;
  }
  const point = pointOf(cell);
  if (state.last?.row !== point.row || state.last?.col !== point.col) {
    state.last = point;
    paint(table);
  }
  event.preventDefault();
}

export function onCellSelectKeyDown(event: KeyboardEvent): void {
  const table = event.currentTarget as HTMLTableElement;
  const cell = event.target instanceof HTMLTableCellElement && event.target.tagName === "TD"
    ? event.target
    : undefined;
  if (!cell || event.defaultPrevented) {
    return;
  }
  const rows = bodyRows(table);
  const current = pointOf(cell);
  const lastCol = lastDataColumn(table);
  let next: CellPoint | undefined;
  switch (event.key) {
    case "ArrowUp": next = { row: Math.max(0, current.row - 1), col: current.col }; break;
    case "ArrowDown": next = { row: Math.min(rows.length - 1, current.row + 1), col: current.col }; break;
    case "ArrowLeft": next = { row: current.row, col: Math.max(0, current.col - 1) }; break;
    case "ArrowRight": next = { row: current.row, col: Math.min(lastCol, current.col + 1) }; break;
    case "Enter": {
      const input = cell.querySelector<HTMLElement>("input,select,textarea");
      if (input) {
        input.focus();
        event.preventDefault();
      }
      return;
    }
    default:
      break;
  }
  if (next) {
    setSelection(table, next, event.shiftKey);
    focusCell(table, next);
    event.preventDefault();
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) {
    return;
  }
  switch (event.key.toLowerCase()) {
    case "c":
      copySelection(table);
      event.preventDefault();
      break;
    case "v":
      event.preventDefault();
      void navigator.clipboard.readText().then(text => pasteIntoCells(table, text));
      break;
    case "a":
      selectAll(table);
      event.preventDefault();
      break;
    default:
      break;
  }
}
