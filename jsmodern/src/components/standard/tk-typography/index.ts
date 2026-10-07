import { html, TemplateResult } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { LitComponentContext } from "../../control-context";
import { appendOuterCSSGridClass, getStyleAndThis, renderControlLabel, renderTypography } from "../presentation";

function decodeHtmlEntities(value: string): string {
  const element = document.createElement("textarea");
  let decoded = value;
  for (let index = 0; index < 5; index += 1) {
    element.innerHTML = decoded;
    const next = element.value;
    if (next === decoded) {
      break;
    }
    decoded = next;
  }
  return decoded;
}

export function renderTypographyControl(context: LitComponentContext): TemplateResult {
  const style = context.metadata.attributes.StaticStyle?.toLowerCase() ?? "";
  const tagName = /^h[1-6]$/.test(style) ? style : "div";
  const content = context.value === null || context.value === undefined
    ? ""
    : context.displayValue;
  const renderAsHtml = context.metadata.taggedValues.DataIsHtml?.toLowerCase() === "true";
  const renderedContent = renderAsHtml
    ? unsafeHTML(decodeHtmlEntities(content))
    : content;
  return html`<div class="view-control ${appendOuterCSSGridClass(
    context,
    getStyleAndThis(context, "tk-component tk-typography ctStaticText") + (context.isGridCell ? " tk-static-text--in-grid tk-static-text" : "")
  )}"
    style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context, "tk-typography__label tk-label")}
    ${renderTypography(tagName, context.id, renderedContent, getStyleAndThis(context, "tk-static-text__native"))}
  </div>`;
}

