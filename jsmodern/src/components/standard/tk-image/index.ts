import { html, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import { appendOuterCSSGridClass, getStyleAndThis, renderControlLabel } from "../presentation";

export function renderImage(context: LitComponentContext): TemplateResult {
  const renderedAction = context.metadata.attributes.RendersAction;
  const actionEnabled = context.renderedActionEnabled === true;
  const fallbackImageUrl = new URL("../Content/icons/fallback-image.svg", document.baseURI).toString();
  const imageSource = context.displayValue && context.displayValue !== "$null$"
    ? new URL(
        context.displayValue.startsWith("./")
          ? `../${context.displayValue.slice(2)}`
          : context.displayValue,
        document.baseURI
      ).toString()
    : fallbackImageUrl;
  const image = html`<div class="tk-image__native"><img class=${getStyleAndThis(context, "img-responsive")}
    src=${imageSource}
    alt=${context.label}
    @error=${(event: Event) => {
      const element = event.currentTarget as HTMLImageElement;
      if (element.src !== fallbackImageUrl) {
        element.src = fallbackImageUrl;
      }
    }}></div>`;
  return html`<div class="view-control ${appendOuterCSSGridClass(context, getStyleAndThis(context, "tk-component tk-image ctImage"))}"
    style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context, "tk-label tk-image__label")}
    ${renderedAction
      ? html`<a class="vmRenderedByAction tk-link__native" role="button" tabindex=${actionEnabled ? "0" : "-1"}
          aria-disabled=${actionEnabled ? "false" : "true"}
          style=${actionEnabled ? "cursor:pointer" : "pointer-events:none"}
          @click=${(event: MouseEvent) => { event.preventDefault(); if (actionEnabled) { void context.executeAction(renderedAction, event); } }}
          @keydown=${(event: KeyboardEvent) => { if (actionEnabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); void context.executeAction(renderedAction); } }}>${image}</a>`
      : image}
  </div>`;
}
