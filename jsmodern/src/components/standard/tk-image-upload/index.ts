import { html, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import {
  appendOuterCSSGridClass,
  getStyleAndThis,
  getStyleAndThisPlusMaybeInGrid,
  renderControlLabel
} from "../presentation";

export function renderImageUpload(context: LitComponentContext): TemplateResult {
  const classes = appendOuterCSSGridClass(
    context,
    getStyleAndThis(context, "tk-component tk-image-upload ctImageUpload")
  );
  const imageClass = getStyleAndThis(
    context,
    `tk-image-upload__content${context.metadata.attributes.size
      ? ` ${context.metadata.attributes.size}`
      : ""}`
  );
  const variant = context.metadata.attributes.variant;
  const fallbackImageUrl = new URL("../Content/icons/fallback-image.svg", document.baseURI).toString();
  const imageSource = context.displayValue && context.displayValue !== "$null$"
    ? new URL(
        context.displayValue.startsWith("./")
          ? `../${context.displayValue.slice(2)}`
          : context.displayValue,
        document.baseURI
      ).toString()
    : fallbackImageUrl;

  return html`<div class="view-control ${classes}"
    style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context, "tk-image-upload__label tk-label")}
    <div class=${getStyleAndThisPlusMaybeInGrid(context, "tk-image-upload__inner")}>
      <input id=${context.id ?? ""}
        type="file"
        class=${getStyleAndThis(context, "tk-image-upload__native")}
        accept=${context.metadata.attributes.accept ?? "image/*"}
        ?disabled=${!context.enabled || context.upload?.uploading}
        aria-label=${context.label || "Upload image"}
        @change=${(event: Event) => {
          const input = event.currentTarget as HTMLInputElement;
          const file = input.files?.[0];
          if (file) {
            input.value = "";
            void context.uploadFile(file).catch(context.onError);
          }
        }}>
      <img class=${variant ? `${imageClass} tk-image-upload__content--${variant}` : imageClass}
        src=${imageSource}
        alt=${context.label}
        @error=${(event: Event) => {
          const image = event.currentTarget as HTMLImageElement;
          if (image.src !== fallbackImageUrl) {
            image.src = fallbackImageUrl;
          }
        }}>
      <label for=${context.id ?? ""}
        class=${getStyleAndThis(
          context,
          `tk-image-upload__interactive${context.upload?.uploading ? " uploading" : ""}`
        )}
        ?hidden=${!context.enabled}
        aria-label=${context.label ? `Upload ${context.label}` : "Upload image"}>
        ${context.upload?.uploading
          ? html`<span class="tk-image-upload__progress" style=${`width:${context.upload.progress}%`}></span>`
          : ""}
      </label>
      ${context.upload?.error
        ? html`<span class="tk-image-upload__validation-state" role="alert">${context.upload.error}</span>`
        : ""}
    </div>
  </div>`;
}
