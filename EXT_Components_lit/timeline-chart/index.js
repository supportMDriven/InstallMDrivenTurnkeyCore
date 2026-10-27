import { loadGoogleCharts } from "../_shared/google-charts.js";

const options = {
  backgroundColor: "#f6f8fc",
  avoidOverlappingGridLines: false,
  timeline: {
    showRowLabels: false,
    barLabelStyle: { fontName: "Noto Sans", fontSize: 12 }
  }
};

class TimelineChart extends HTMLElement {
  constructor() {
    super();
    this._context = undefined;
    this._chart = undefined;
    this._googlePromise = undefined;
    // Redraw on width changes only: a height-driven redraw can feed back into the layout and grow the page endlessly.
    this._lastWidth = 0;
    this._resizeObserver = new ResizeObserver(() => {
      const width = Math.round(this.clientWidth);
      if (width === this._lastWidth) return;
      this._lastWidth = width;
      this.draw();
    });
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
          tk-lit-custom-timeline-chart { box-sizing: border-box; contain: inline-size; display: block; min-width: 0; width: 100%; }
          tk-lit-custom-timeline-chart .chart { overflow: hidden; width: 100%; }
          tk-lit-custom-timeline-chart .error { color: #b00020; font: inherit; margin: .5rem 0; }
        </style>
        <div class="chart" role="img" aria-label="Timeline chart"></div>
        <p class="error" role="alert" hidden></p>`;
    }
    this._googlePromise ??= loadGoogleCharts("timeline");
    this._googlePromise.then(google => {
      if (!this.isConnected) return;
      const container = this.querySelector(".chart");
      this._chart ??= new google.visualization.Timeline(container);
      this.draw();
    }).catch(error => {
      this._googlePromise = undefined;
      this.showError(error);
    });
  }

  draw() {
    if (!this.isConnected || !this._chart || !this._context) return;
    const rows = this._context.collection ?? [];
    const data = [["Position", "Name", "Start", "End"]];
    for (const row of rows) {
      const { Position, Name, Start, End } = row.attributes;
      const start = asDate(Start);
      const end = asDate(End);
      if (Position == null || Name == null || !start || !end) {
        this.showError(new Error("Timeline data requires Position, Name, Start, and End values."));
        return;
      }
      data.push([String(Position), String(Name), start, end]);
    }

    const error = this.querySelector(".error");
    error.hidden = true;
    if (rows.length === 0) {
      this._chart.clearChart();
      return;
    }
    try {
      const google = globalThis.google;
      // The timeline sizes itself from its container, so redrawing (e.g. after a click) in an already tall container
      // makes it grow every time. Measure the natural height once per data shape, then pin it.
      const container = this.querySelector(".chart");
      const shape = `${rows.length}:${new Set(data.slice(1).map(r => r[0])).size}`;
      if (this._pinnedShape !== shape) {
        container.style.height = "";
        this._pinnedHeight = undefined;
      }
      const drawOptions = this._pinnedHeight ? { ...options, height: this._pinnedHeight } : options;
      this._chart.draw(google.visualization.arrayToDataTable(data), drawOptions);
      if (!this._pinnedHeight) {
        this._pinnedShape = shape;
        this._pinnedHeight = Math.ceil(container.offsetHeight);
        container.style.height = `${this._pinnedHeight}px`;
      }
    } catch (error) {
      this.showError(error);
    }
  }

  showError(error) {
    console.error("Timeline chart failed to render.", error);
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

customElements.define("tk-lit-custom-timeline-chart", TimelineChart);
