class PivotDataGrid extends HTMLElement {
  constructor() {
    super();
    this._context = undefined;
    this._rowsByCell = new Map();
    this._handleClick = this.handleClick.bind(this);
  }

  connectedCallback() {
    this.addEventListener("click", this._handleClick);
    this.render();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._handleClick);
  }

  set context(value) {
    this._context = value;
    this.render();
  }

  collection(name) {
    const context = this._context;
    const ids = context?.object?.attributes[name];
    if (!Array.isArray(ids)) {
      return [];
    }

    return ids
      .map(id => {
        if (typeof id === "string") {
          return context.getObject(id);
        }
        if (id && typeof id === "object" && "kind" in id && id.kind === "reference") {
          return context.getObject(id.id);
        }
        return id && typeof id === "object" && "attributes" in id ? id : undefined;
      })
      .filter(row => row !== undefined);
  }

  attribute(row, name) {
    return row?.attributes?.[name] ?? row?.[name];
  }

  render() {
    const context = this._context;
    if (!context || !this.isConnected) {
      return;
    }

    const xAxis = this.collection("XAxis");
    const yAxis = this.collection("YAxis");
    const values = this.collection("Values");
    if (xAxis.length === 0 || yAxis.length === 0) {
      this._rowsByCell.clear();
      this.replaceChildren();
      return;
    }

    const xGridByKey = new Map(xAxis.map((row, index) => [
      String(this.attribute(row, "HeaderKey")),
      index + 1
    ]));
    const yGridByKey = new Map(yAxis.map((row, index) => [
      String(this.attribute(row, "HeaderKey")),
      index + 1
    ]));
    const positionedValues = [];
    const occupiedCells = new Set();
    this._rowsByCell.clear();

    for (const row of values) {
      const x = this.attribute(row, "X");
      const y = this.attribute(row, "Y");
      if (x === null || x === undefined || y === null || y === undefined) {
        continue;
      }

      const localXGrid = xGridByKey.get(String(x));
      const localYGrid = yGridByKey.get(String(y));
      if (localXGrid === undefined || localYGrid === undefined) {
        continue;
      }

      const key = `${localXGrid}:${localYGrid}`;
      positionedValues.push({ row, localXGrid, localYGrid, key });
      occupiedCells.add(key);
      this._rowsByCell.set(key, row);
    }

    const grid = document.createElement("div");
    grid.className = "PivotDataGrid";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "auto";
    grid.style.gridTemplateRows = "auto";
    grid.innerHTML = `
      <style>
        tk-lit-custom-pivot-data-grid { display: block; }
        .PivotDataGrid { height: 100%; }
        .grid__item { position: relative; overflow: hide; height: 100%; }
        .grid__item::before, .grid__item::after {
          content: "";
          position: absolute;
          background-color: lightgray;
        }
        .grid__item::before { top: 0; left: 0; width: 100%; height: 1px; }
        .grid__item::after { top: 0; right: 0; height: 100%; width: 1px; }
        .pivotheader { font-weight: bold; }
        .pivotemptycell { background-color: lightgray; }
        .wraptextcellgray { background-color: lightgray; }
      </style>`;

    for (const [index, row] of xAxis.entries()) {
      this.appendCell(
        grid,
        index + 2,
        1,
        this.attribute(row, "Header"),
        "pivotheader"
      );
    }

    for (const [index, row] of yAxis.entries()) {
      this.appendCell(
        grid,
        1,
        index + 2,
        this.attribute(row, "Header"),
        "pivotheader"
      );
    }

    for (const { row, localXGrid, localYGrid } of positionedValues) {
      const style = this.attribute(row, "Style");
      this.appendCell(
        grid,
        localXGrid + 1,
        localYGrid + 1,
        this.attribute(row, "Value"),
        "pivot-value",
        style
      );
    }

    for (let x = 1; x <= xAxis.length; x += 1) {
      for (let y = 1; y <= yAxis.length; y += 1) {
        if (!occupiedCells.has(`${x}:${y}`)) {
          this.appendCell(grid, x + 1, y + 1, "", "", "", "pivotemptycell");
        }
      }
    }

    this.replaceChildren(grid);
  }

  appendCell(grid, column, row, value, className, additionalClass = "", innerClassName = "") {
    const wrapper = document.createElement("div");
    wrapper.style.gridColumn = String(column);
    wrapper.style.gridRow = String(row);

    const cell = document.createElement("div");
    cell.className = "grid__item";
    for (const token of `${className} ${additionalClass ?? ""}`.split(/\s+/)) {
      if (token) {
        cell.classList.add(token);
      }
    }
    if (innerClassName) {
      const inner = document.createElement("div");
      inner.classList.add(innerClassName);
      cell.append(inner);
    } else {
      cell.textContent = value === null || value === undefined ? "" : String(value);
    }
    wrapper.append(cell);
    grid.append(wrapper);
  }

  handleClick(event) {
    const cell = event.target instanceof Element ? event.target.closest(".pivot-value") : null;
    if (!cell) {
      return;
    }

    const wrapper = cell.parentElement;
    const key = `${Number.parseInt(wrapper.style.gridColumn, 10) - 1}:${Number.parseInt(wrapper.style.gridRow, 10) - 1}`;
    const row = this._rowsByCell.get(key);
    if (!row) {
      return;
    }

    event.preventDefault();
    this._context.selectRow(row);
  }
}

customElements.define("tk-lit-custom-pivot-data-grid", PivotDataGrid);
