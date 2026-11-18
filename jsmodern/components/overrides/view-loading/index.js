class ViewLoadingOverride extends HTMLElement {
  set context(value) {
    this._context = value;
    this.render();
  }



  render() {
    if (!this._context) return;

    this.innerHTML = `
      <div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:12px;
        padding:20px;
        height:100%;
        box-sizing:border-box;
      ">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 200"
          width="80"
          height="80"
        >
          <circle fill="#006699" stroke="#006699" stroke-width="15" r="15" cx="40" cy="65">
            <animate
              attributeName="cy"
              calcMode="spline"
              dur="2s"
              values="65;135;65"
              keySplines=".5 0 .5 1;.5 0 .5 1"
              repeatCount="indefinite"
              begin="-0.4s"
            />
          </circle>

          <circle fill="#006699" stroke="#006699" stroke-width="15" r="15" cx="100" cy="65">
            <animate
              attributeName="cy"
              calcMode="spline"
              dur="2s"
              values="65;135;65"
              keySplines=".5 0 .5 1;.5 0 .5 1"
              repeatCount="indefinite"
              begin="-0.2s"
            />
          </circle>

          <circle fill="#006699" stroke="#006699" stroke-width="15" r="15" cx="160" cy="65">
            <animate
              attributeName="cy"
              calcMode="spline"
              dur="2s"
              values="65;135;65"
              keySplines=".5 0 .5 1;.5 0 .5 1"
              repeatCount="indefinite"
              begin="0s"
            />
          </circle>
        </svg>

        <p role="status" style="margin:0;font-family:sans-serif;">
          Loading ${this._context.viewName}
        </p>
      </div>
    `;
  }
}

customElements.define(
  "tk-lit-override-view-loading",
  ViewLoadingOverride
);
