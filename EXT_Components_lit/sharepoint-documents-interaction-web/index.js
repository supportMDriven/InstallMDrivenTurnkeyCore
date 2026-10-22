// Rendered in the light DOM so the shared Turnkey stylesheets (tk-button__native,
// tk-data-table__*, tk-input-field__native) apply exactly as they do in Angular.
const styles = `
tk-lit-custom-sharepoint-documents-interaction-web { display: block; min-width: 0; width: 100%; height: 100%; }
.SharepointDocumentsInteractionWeb { height: 100%; display: flex; flex-direction: column; }
.sp-modal-content { background-color: #fefefe; margin: auto; padding: 12px 6px; border: 1px solid #888; width: 100%; overflow-x: hidden; box-sizing: border-box; display: flex; flex-direction: column; }
.sp-modal[hidden] { display: none; }
.sp-open-button:disabled, .sp-add-button:disabled { cursor: not-allowed; }
.sp-message { font-size: 10px; font-weight: 600; line-height: 14px; color: #FF0000; margin: 0; padding: 4px; }
.sp-message[hidden] { display: none; }
`;

const columns = [
  { name: "Type", title: "Document Type" },
  { name: "Name", title: "File Name" }
];

class SharepointDocumentsInteractionWeb extends HTMLElement {
  constructor() {
    super();
    this._context = undefined;
    this._busy = false;
    this._modalOpen = false;
    this._sort = undefined;
    this._built = false;
  }

  set context(value) {
    this._context = value;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  get nestingName() {
    return this._context?.metadata.attributes.BindInfoNesting
      ?? this._context?.object?.className
      ?? "";
  }

  getStatus(name) {
    return this._context?.getStatusAttribute(`${this.nestingName}_${name}`);
  }

  build() {
    this.innerHTML = `
      <style>${styles}</style>
      <div class="sharepoint-documents-wrapper" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div class="SharepointDocumentsInteractionWeb" style="padding:4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; width:100%; z-index: 10; padding:4px;">
            <span style="font-size: 1.215rem; font-weight: 600;">SharePoint Documents</span>
            <button type="button" class="sp-open-button tk-button__native ripple-effect" style="flex-shrink: 0; flex-grow: 0; width: 200px;">Add SharePoint Link</button>
          </div>
          <div class="sp-modal" hidden>
            <div class="sp-modal-content">
              <span class="tk-label tk-label__text" style="font-size: 10px; font-weight: 400; line-height: 14px; color: #1f2937;">Paste here</span>
              <div style="display: flex; flex-direction: row;">
                <input type="text" class="sp-url-input tk-input-field__native" maxlength="2000" autocomplete="off"
                  aria-label="SharePoint document link" placeholder="Paste SharePoint document link…" style="flex:1; min-width: 200px;">
                <button type="button" class="sp-add-button tk-button__native ripple-effect" title="Add the SharePoint document link" style="flex-shrink: 0; flex-grow: 0; width: 50px;"><span>Add</span></button>
              </div>
              <span class="sp-warning tk-label tk-label__text" role="alert" style="font-size: 10px; font-weight: 600; line-height: 14px; color: #FF0000; display: none;">The URL is not correct or you don't have access.</span>
            </div>
          </div>
          <p class="sp-message" role="alert" hidden></p>
          <div class="tk-data-table__content tk-data-table__content--advanced" style="height:100%;">
            <table class="tk-data-table__native">
              <thead>
                <tr class="tk-data-table__header-row">
                  ${columns.map(column => `<th title="${column.name}" role="columnheader" data-column="${column.name}" class="tk-data-table__header-cell order-enabled" tabindex="0"><span>${column.title}</span></th>`).join("")}
                </tr>
              </thead>
              <tbody></tbody>
              <colgroup>
                <col style="width:33%" class="tk-data-table__column">
                <col style="width:67%" class="tk-data-table__column">
                <col class="tk-data-table__column">
              </colgroup>
            </table>
          </div>
        </div>
      </div>`;

    const openButton = this.querySelector(".sp-open-button");
    openButton.addEventListener("click", () => {
      this.querySelector(".sp-url-input").value = "";
      this.setWarning(false);
      this._modalOpen = true;
      this.render();
      this.querySelector(".sp-url-input").focus();
    });
    this.querySelector(".sp-add-button").addEventListener("click", () => void this.addDocument());
    const input = this.querySelector(".sp-url-input");
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        void this.addDocument();
      } else if (event.key === "Escape") {
        this.closeModal();
      }
    });
    for (const header of this.querySelectorAll("th[data-column]")) {
      const toggleSort = () => {
        const column = header.dataset.column;
        this._sort = this._sort?.column === column && !this._sort.descending
          ? { column, descending: true }
          : { column, descending: false };
        this.render();
      };
      header.addEventListener("click", toggleSort);
      header.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleSort();
        }
      });
    }
    this.querySelector("tbody").addEventListener("click", event => {
      const button = event.target instanceof Element ? event.target.closest("button[data-vm-class-id]") : null;
      const row = button && this._context?.getObject(button.dataset.vmClassId);
      if (row) {
        void this.openDocument(row);
      }
    });
    this._built = true;
  }

  render() {
    const context = this._context;
    if (!context || !this.isConnected) {
      return;
    }
    if (!this._built) {
      this.build();
    }

    const addEnabled = !this._busy && this.getStatus("AddDocRef_Enabled") !== false;
    const openButton = this.querySelector(".sp-open-button");
    openButton.hidden = this.getStatus("AddDocRef_Visible") === false;
    openButton.disabled = this._modalOpen || !addEnabled;
    this.querySelector(".sp-modal").hidden = !this._modalOpen;
    const input = this.querySelector(".sp-url-input");
    input.disabled = this._busy || this.getStatus("WebDocRefUrlAdd_Enabled") === false;
    input.readOnly = this.getStatus("WebDocRefUrlAdd_ReadOnly") === true;
    this.querySelector(".sp-add-button").disabled = !addEnabled;

    for (const header of this.querySelectorAll("th[data-column]")) {
      const active = this._sort?.column === header.dataset.column;
      header.classList.toggle("ascending", active && !this._sort.descending);
      header.classList.toggle("descending", active && this._sort.descending);
      header.setAttribute("aria-sort", active ? (this._sort.descending ? "descending" : "ascending") : "none");
    }
    this.renderRows();
  }

  sortedRows() {
    const rows = [...(this._context?.collection ?? [])];
    if (!this._sort) {
      return rows;
    }
    const { column, descending } = this._sort;
    const text = row => String(row.attributes[column] ?? "");
    return rows.sort((left, right) =>
      text(left).localeCompare(text(right), undefined, { numeric: true, sensitivity: "base" })
        * (descending ? -1 : 1));
  }

  renderRows() {
    const body = this.querySelector("tbody");
    body.replaceChildren();
    for (const row of this.sortedRows()) {
      const tableRow = document.createElement("tr");
      tableRow.className = "tk-data-table__row";
      tableRow.classList.toggle("vmCurrentRow", row.attributes.vCurrent === true);
      tableRow.classList.toggle("vmSelectedRow", row.attributes.vSelected === true);
      for (const { name } of columns) {
        const cell = document.createElement("td");
        cell.className = "tk-data-table__cell";
        const content = document.createElement("div");
        const value = row.attributes[name];
        content.textContent = value === null || value === undefined ? "" : String(value);
        cell.append(content);
        tableRow.append(cell);
      }
      const contextCell = document.createElement("td");
      contextCell.className = "tk-data-table__cell tk-data-table__cell--context";
      contextCell.innerHTML = `<div class="show-actions"><button type="button" role="button" data-vm-class-id="${row.vmClassId}" class="tk-button__native fab flat icon-button ripple-effect context-actions" aria-label="Open document details" title="Document properties"><span class="mi">more_vert</span></button></div>`;
      contextCell.querySelector("button").disabled = this._busy;
      tableRow.append(contextCell);
      body.append(tableRow);
    }
  }

  setWarning(visible, text) {
    const warning = this.querySelector(".sp-warning");
    if (!warning) {
      return;
    }
    if (text) {
      warning.textContent = text;
    }
    warning.style.display = visible ? "block" : "none";
    this.querySelector(".sp-url-input").style.borderColor = visible ? "red" : "";
  }

  setMessage(text) {
    const message = this.querySelector(".sp-message");
    message.hidden = !text;
    message.textContent = text;
  }

  closeModal() {
    this._modalOpen = false;
    this.render();
  }

  async addDocument() {
    const context = this._context;
    const input = this.querySelector(".sp-url-input");
    const url = input.value.trim();
    if (!context || this._busy || !url) {
      return;
    }

    this._busy = true;
    this.render();
    this.setWarning(false);
    this.setMessage("");
    try {
      await context.setAttribute("WebDocRefUrlAdd", url);
      const executed = await context.executeAction("AddDocRef");
      await context.setAttribute("WebDocRefUrlAdd", "");
      if (!executed) {
        this.setWarning(true, "The SharePoint link could not be added.");
        return;
      }

      // vDocRef holds the plain object id, like Angular's VMObjectId; rows are keyed "<id>;<class>".
      const latest = this._context ?? context;
      const variable = latest.getViewVariable("vDocRef");
      const objectId = variable && typeof variable === "object" && !(variable instanceof Date)
        && "kind" in variable
        ? String(variable.id)
        : variable === null || variable === undefined ? "" : String(variable);
      const row = objectId
        ? (latest.collection ?? []).find(item => item.id === objectId || item.vmClassId === objectId
            || item.vmClassId.split(";")[0] === objectId.split(";")[0])
          ?? latest.getObject(objectId)
        : undefined;
      if (!row) {
        this.setWarning(true, "The URL is not correct or you don't have access.");
        return;
      }

      latest.selectRow(row);
      input.value = "";
      this.setWarning(false);
      this._modalOpen = false;
      this.render();
      const opened = await latest.executeRowAction(row, "DocumentProperties");
      if (!opened) {
        this.setMessage("The document was added, but its details could not be opened.");
      }
    } catch (error) {
      this.setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      this._busy = false;
      this.render();
    }
  }

  async openDocument(row) {
    const context = this._context;
    if (!context || this._busy) {
      return;
    }
    context.selectRow(row);
    this._busy = true;
    this.render();
    try {
      const opened = await context.executeRowAction(row, "DocumentProperties");
      this.setMessage(opened ? "" : "The document details could not be opened.");
    } finally {
      this._busy = false;
      this.render();
    }
  }
}

customElements.define("tk-lit-custom-sharepoint-documents-interaction-web", SharepointDocumentsInteractionWeb);
