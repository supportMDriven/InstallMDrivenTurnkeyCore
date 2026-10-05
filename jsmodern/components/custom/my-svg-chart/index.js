const svgNamespace = "http://www.w3.org/2000/svg";

class MySvgChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._context = undefined;
    this._resizeObserver = new ResizeObserver(() => this.render());
  }

  connectedCallback() {
    this._resizeObserver.observe(this);
    this.render();
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect();
  }

  set context(value) {
    this._context = value;
    this.render();
  }

  render() {
    const context = this._context;
    if (!context || !this.shadowRoot) return;

    if (!this.shadowRoot.querySelector("svg")) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { box-sizing: border-box; color: #263238; display: block; font: inherit; min-width: 0; width: 100%; }
          figure { box-sizing: border-box; margin: 0; }
          figcaption { font-size: 1rem; font-weight: 600; margin: 0 0 .5rem; }
          svg { display: block; overflow: visible; width: 100%; }
          .grid { stroke: #dce3e8; }
          .axis-label { fill: #52616b; font-family: sans-serif; }
          .series { fill: none; stroke: #1565c0; stroke-linecap: round; stroke-linejoin: round; }
          .point { fill: #fff; stroke: #1565c0; }
          .empty { color: #52616b; margin: .75rem 0; }
        </style>
        <figure>
          <figcaption></figcaption>
          <svg role="img"></svg>
          <p class="empty" hidden></p>
        </figure>
      `;
    }

    const caption = this.shadowRoot.querySelector("figcaption");
    const svg = this.shadowRoot.querySelector("svg");
    const empty = this.shadowRoot.querySelector(".empty");
    if (!caption || !svg || !empty) return;
    const width = Math.max(1, context.minSize.width, this.clientWidth);
    this.style.minWidth = `${context.minSize.width}px`;
    this.style.minHeight = `${context.minSize.height}px`;

    caption.textContent = context.label || "Chart";
    const captionStyle = getComputedStyle(caption);
    const captionHeight = caption.getBoundingClientRect().height
      + (Number.parseFloat(captionStyle.marginBottom) || 0);
    const height = context.minSize.height;
    const plotHeight = Math.max(1, height - captionHeight);
    svg.style.height = `${plotHeight}px`;
    svg.setAttribute("viewBox", `0 0 ${width} ${plotHeight}`);
    svg.replaceChildren();
    const rows = (context.collection ?? [])
      .map(row => {
        const rawValue = row.attributes.ValueY;
        const value = typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string" && rawValue.trim() !== ""
            ? Number(rawValue)
            : Number.NaN;
        const rawLabel = row.attributes.LabelX;
        return {
          label: rawLabel === null || rawLabel === undefined ? row.id : String(rawLabel),
          value
        };
      })
      .filter(row => Number.isFinite(row.value));

    if (rows.length === 0) {
      svg.hidden = true;
      empty.hidden = false;
      empty.textContent = context.collection?.length
        ? "No numeric ValueY values are available to chart."
        : "No data to chart.";
      return;
    }

    svg.hidden = false;
    empty.hidden = true;
    svg.setAttribute("aria-label", `${context.label || "Details2"} chart with ${rows.length} values`);

    const left = Math.min(42, width * 0.2);
    const right = Math.max(left + 1, width - 8);
    const top = Math.min(8, plotHeight * 0.2);
    const bottom = Math.max(top + 1, plotHeight - 18);
    const labelFontSize = 11;
    const axisStrokeWidth = 1;
    const pointRadius = 3;
    const seriesStrokeWidth = 2;
    const values = rows.map(row => row.value);
    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);
    if (minValue === maxValue) {
      const padding = Math.max(1, Math.abs(minValue) * 0.1);
      minValue -= padding;
      maxValue += padding;
    } else {
      const padding = (maxValue - minValue) * 0.08;
      minValue -= padding;
      maxValue += padding;
    }

    const xFor = (index) => rows.length === 1
      ? (left + right) / 2
      : left + index * (right - left) / (rows.length - 1);
    const yFor = value => bottom - (value - minValue) * (bottom - top) / (maxValue - minValue);
    const createSvgElement = (tag, attributes) => {
      const element = document.createElementNS(svgNamespace, tag);
      for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, String(value));
      }
      return element;
    };

    for (let tick = 0; tick <= 4; tick += 1) {
      const y = top + tick * (bottom - top) / 4;
      const value = maxValue - tick * (maxValue - minValue) / 4;
      svg.append(
        createSvgElement("line", {
          x1: left, y1: y, x2: right, y2: y, class: "grid", "stroke-width": axisStrokeWidth
        }),
        Object.assign(createSvgElement("text", {
          x: left - 5,
          y: y + 4,
          class: "axis-label",
          "font-size": labelFontSize,
          "text-anchor": "end"
        }), { textContent: new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) })
      );
    }

    svg.append(createSvgElement("line", {
      x1: left, y1: top, x2: left, y2: bottom, class: "grid", "stroke-width": axisStrokeWidth
    }));

    const points = rows.map((row, index) => `${xFor(index)},${yFor(row.value)}`).join(" ");
    svg.append(createSvgElement("polyline", {
      points, class: "series", "stroke-width": seriesStrokeWidth
    }));

    const labelStep = Math.max(1, Math.ceil(rows.length / 8));
    rows.forEach((row, index) => {
      const x = xFor(index);
      const y = yFor(row.value);
      const circle = createSvgElement("circle", {
        cx: x,
        cy: y,
        r: pointRadius,
        class: "point",
        "stroke-width": axisStrokeWidth
      });
      const title = createSvgElement("title", {});
      title.textContent = `${row.label}: ${row.value}`;
      circle.append(title);
      svg.append(circle);

      if (index % labelStep === 0 || index === rows.length - 1) {
        const label = createSvgElement("text", {
          x,
          y: bottom + 14,
          class: "axis-label",
          "font-size": labelFontSize,
          "text-anchor": index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"
        });
        label.textContent = row.label;
        svg.append(label);
      }
    });
  }
}

customElements.define("tk-lit-custom-my-svg-chart", MySvgChart);
