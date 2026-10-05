import { html, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import {
  appendOuterCSSGridClass,
  getStyleAndThis,
  getStyleAndThisPlusMaybeInGrid,
  renderControlLabel
} from "../presentation";

export function renderFileUpload(context: LitComponentContext): TemplateResult {
  const classes = appendOuterCSSGridClass(
    context,
    getStyleAndThis(context, "tk-component tk-file-upload ctFile"),
    ["tk-file-upload--no-label"]
  );
  return html`<div class="view-control ${classes}"
    style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context, "tk-file-upload__label tk-label")}
    <div class=${getStyleAndThisPlusMaybeInGrid(context, "tk-file-upload__inner")}>
      <input id=${context.id ?? ""}
        type="file"
        class=${getStyleAndThis(context, "tk-file-upload__native")}
        accept=${context.metadata.attributes.accept ?? ""}
        ?disabled=${!context.enabled}
        aria-label=${context.label || "Upload file"}
        @change=${(event: Event) => {
          const input = event.currentTarget as HTMLInputElement;
          const file = input.files?.[0];
          if (file) {
            input.value = "";
            void context.uploadFile(file).catch(context.onError);
          }
        }}>
      <button type="button"
        class=${getStyleAndThis(context, "tk-file-upload__interactive")}
        ?disabled=${!context.enabled || context.upload?.uploading}
        @click=${(event: MouseEvent) => {
          const input = (event.currentTarget as HTMLButtonElement)
            .parentElement?.querySelector<HTMLInputElement>(".tk-file-upload__native");
          input?.click();
        }}>
        ${context.upload?.uploading ? "Uploading…" : "Upload file"}
        ${context.upload?.uploading
          ? html`<span class="tk-file-upload__progress" style=${`width:${context.upload.progress}%`}></span>`
          : ""}
      </button>
      ${context.upload?.fileName
        ? html`<span class="tk-file-upload__name">${context.upload.fileName}</span>`
        : ""}
      ${context.upload?.error
        ? html`<span class="tk-file-upload__validation-state" role="alert">${context.upload.error}</span>`
        : ""}
    </div>
  </div>`;
}
