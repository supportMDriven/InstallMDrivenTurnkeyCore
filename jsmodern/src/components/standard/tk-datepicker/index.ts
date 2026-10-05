import { html, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import {
  appendOuterCSSGridClass,
  getStyleAndThis,
  getStyleAndThisPlusMaybeInGrid,
  getStyleAndThisPlusMaybeNoLabel,
  renderControlLabel
  ,errorClass,
  renderFieldErrors
} from "../presentation";

export function renderDatePicker(context: LitComponentContext): TemplateResult {
  return html`<div class="view-control ${errorClass(context)}${appendOuterCSSGridClass(
    context,
    getStyleAndThisPlusMaybeNoLabel(context, "tk-component tk-input-field ctInputField tk-input-field--text")
  )}"
    style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context)}
    <div class=${getStyleAndThisPlusMaybeInGrid(context, "tk-input-field__container")}>
      <input id=${context.id ?? ""} type="datetime-local"
        class=${getStyleAndThis(context, "tk-input-field__native")}
        aria-label=${context.isGridCell ? context.label : ""}
        .value=${context.displayValue}
        ?disabled=${!context.enabled}
        ?readonly=${context.readOnly}
        placeholder=${context.placeholder}
        @change=${(event: Event) => {
          const value = (event.currentTarget as HTMLInputElement).value;
          context.onChange(value ? new Date(value) : null);
        }}>
      ${renderFieldErrors(context)}
      ${context.helperText && !context.isGridCell
        ? html`<span class="tk-input-field__helper">${context.helperText}</span>`
        : ""}
    </div>
  </div>`;
}
