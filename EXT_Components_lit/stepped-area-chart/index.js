import { loadGoogleCharts } from "../_shared/google-charts.js";

const options = {
  legend: { position: "bottom" },
  backgroundColor: "#f6f8fc",
  fontName: "Noto Sans"
};

class SteppedAreaChart extends HTMLElement {
  constructor() {
    super();
    this._context = undefined;
    this._chart = undefined;
    this._googlePromise = undefined;
    this._resizeObserver = new ResizeObserver(() => this.draw());
  }

  connectedCallback() {
    this._resizeObserver.observe(this);
    this.render();
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect();
    this._chart?.clearChart();
  }

  set context(value) {
    this._context = value;
    this.render();
  }

  render() {
    if (!this.querySelector(".chart")) {
      this.innerHTML = `
        <style>
          tk-lit-custom-stepped-area-chart { box-sizing: border-box; display: block; min-width: 0; width: 100%; }
          tk-lit-custom-stepped-area-chart .chart { height: 100%; width: 100%; }
          tk-lit-custom-stepped-area-chart .error { color: #b00020; font: inherit; margin: .5rem 0; }
        </style>
        <div class="chart" role="img" aria-label="Stepped area chart" style="height:400px;width:100%;"></div>
        <p class="error" role="alert" hidden></p>`;
    }
    this._googlePromise ??= loadGoogleCharts("corechart");
    this._googlePromise.then(google => {
      if (!this.isConnected) return;
      const container = this.querySelector(".chart");
      this._chart ??= new google.visualization.SteppedAreaChart(container);
      this.draw();
    }).catch(error => {
      this._googlePromise = undefined;
      this.showError(error);
    });
  }

  draw() {
    if (!this.isConnected || !this._chart || !this._context) return;
    const context = this._context;
    const column = context.metadata.attributes.BindInfoColumn;
    const legendValue = column && context.object?.attributes[`${column}_legend`];
    const legend = typeof legendValue === "string" ? legendValue.split(";") : [];
    const rows = context.collection ?? [];
    if (legend.length < 3 || legend.some(label => label.trim() === "")) {
      this.showError(new Error("Stepped area chart requires three semicolon-separated legend labels."));
      return;
    }
    const data = [legend];
    for (const row of rows) {
      const { RowDate, Legend1, Legend2 } = row.attributes;
      const date = asDate(RowDate);
      const first = asNumber(Legend1);
      const second = asNumber(Legend2);
      if (!date || first === undefined || second === undefined) {
        this.showError(new Error("Stepped area data requires a valid RowDate, Legend1, and Legend2 for each row."));
        return;
      }
      data.push([date, first, second]);
    }

    const error = this.querySelector(".error");
    error.hidden = true;
    if (rows.length === 0) {
      this._chart.clearChart();
      return;
    }
    try {
      this._chart.draw(globalThis.google.visualization.arrayToDataTable(data), options);
    } catch (error) {
      this.showError(error);
    }
  }

  showError(error) {
    console.error("Stepped area chart failed to render.", error);
    const message = this.querySelector(".error");
    if (message) {
      message.textContent = error instanceof Error ? error.message : String(error);
      message.hidden = false;
    }
  }
}

function asDate(value) {
  const date = value instanceof Date ? value : value == null ? undefined : new Date(value);
  return date && Number.isFinite(date.getTime()) ? date : undefined;
}

function asNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

customElements.define("tk-lit-custom-stepped-area-chart", SteppedAreaChart);
