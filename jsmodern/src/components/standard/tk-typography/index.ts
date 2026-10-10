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
  // Angular renders heading styles as a paragraph carrying the style class (e.g. p.h2).
  const tagName = "p";
  const content = context.value === null || context.value === undefined
    ? ""
    : context.displayValue;
  const tagged = context.metadata.taggedValues;
  const wrapperFor = (base: string): string => `view-control ${appendOuterCSSGridClass(
    context,
    getStyleAndThis(context, base)
  )}`;
  if (tagged.DataIsLink !== undefined) {
    return html`<div class=${wrapperFor("tk-component tk-link--no-label tk-link ctLink")} style=${context.metadata.wrapperStyle}>
      <a href=${content} class="tk-link__native ripple-effect"><span class="tk-link__text">${context.label}</span></a>
    </div>`;
  }
  if (tagged.BlobDownloadLink !== undefined) {
    return html`<div class=${wrapperFor("tk-component tk-file-download ctFileDownload")} style=${context.metadata.wrapperStyle}>
      <div class="tk-file-download__content ripple-effect">
        <a href=${context.blobDownloadUrl ?? ""} class="tk-file-download__native"><span class="tk-label__text">${context.label}</span></a>
      </div>
    </div>`;
  }
  if (tagged.DataIsImageUrl !== undefined) {
    return html`<div class=${wrapperFor("tk-component tk-image ctImage")} style=${context.metadata.wrapperStyle}>
      ${context.isGridCell ? "" : html`<label for=${context.id ?? ""} class="tk-label tk-image__label"><span class="tk-label__text">${context.label}</span></label>`}
      <div class="tk-image__native">
        <img src=${content} class="img-responsive"
          @click=${(event: MouseEvent) => context.executeAction(undefined, event)}>
      </div>
    </div>`;
  }  const renderAsHtml = context.metadata.taggedValues.DataIsHtml?.toLowerCase() === "true";
  const renderedContent = renderAsHtml
    ? unsafeHTML(decodeHtmlEntities(content))
    : content;
  return html`<div class="view-control ${appendOuterCSSGridClass(
    context,
    getStyleAndThis(context, "tk-component tk-static-text ctStaticText") + (context.isGridCell ? " tk-static-text--in-grid" : "")
  )}"
    style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context, "tk-label tk-static-text__label")}
    ${renderTypography(tagName, context.id, renderedContent, getStyleAndThis(context, "tk-static-text__native"))}
  </div>`;
}

