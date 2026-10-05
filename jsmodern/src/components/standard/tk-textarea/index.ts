import { html, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import {
  appendOuterCSSGridClass,
  getStyleAndThis,
  getStyleAndThisPlusMaybeInGrid,
  getStyleAndThisPlusMaybeNoLabel,
  renderControlLabel
} from "../presentation";

export function renderTextArea(context: LitComponentContext): TemplateResult {
  return html`<div class="view-control ${appendOuterCSSGridClass(
    context,
    getStyleAndThisPlusMaybeNoLabel(context, "tk-component tk-input-field tk-textarea")
  )}"
    style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context)}
    <div class=${getStyleAndThisPlusMaybeInGrid(context, "tk-input-field__container")}>
      <textarea id=${context.id ?? ""}
        class=${getStyleAndThis(context, "tk-input-field__native tk-textarea__native")}
        aria-label=${context.isGridCell ? context.label : ""}
        .value=${context.displayValue}
        ?disabled=${!context.enabled}
        ?readonly=${context.readOnly || context.metadata.attributes.readonly !== undefined
          || context.metadata.attributes.disabled === "true"}
        placeholder=${context.placeholder}
        maxlength=${context.metadata.attributes.maxlength ?? ""}
        @change=${(event: Event) => {
          const value = (event.currentTarget as HTMLTextAreaElement).value;
          context.onChange(value === "" ? null : value);
        }}></textarea>
      ${context.helperText && !context.isGridCell
        ? html`<span class="tk-input-field__helper">${context.helperText}</span>`
        : ""}
    </div>
  </div>`;
}
