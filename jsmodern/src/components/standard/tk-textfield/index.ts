import { html, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import { parseNumber } from "../formatting";
import {
  appendOuterCSSGridClass,
  getStyleAndThis,
  getStyleAndThisPlusMaybeInGrid,
  getStyleAndThisPlusMaybeNoLabel,
  renderControlLabel
  ,errorClass,
  renderFieldErrors
} from "../presentation";

export function renderTextField(context: LitComponentContext): TemplateResult {
  const numeric = context.inputType === "number";
  const effectiveType = numeric && context.metadata.taggedValues.StringFormat ? "text" : context.inputType;
  const input = html`<input id=${context.id ?? ""}
    type=${effectiveType}
    inputmode=${numeric ? "decimal" : ""}
    class=${getStyleAndThis(context, "tk-input-field__native")}
    aria-label=${context.isGridCell ? context.label : ""}
    .value=${context.displayValue}
    ?disabled=${!context.enabled}
    ?readonly=${context.readOnly || context.metadata.attributes.readonly !== undefined
      || context.metadata.attributes.disabled === "true"}
    placeholder=${context.placeholder}
    maxlength=${context.metadata.attributes.maxlength ?? ""}
    step=${effectiveType === "number" ? "any" : ""}
    @change=${(event: Event) => {
      const field = event.currentTarget as HTMLInputElement;
      if (numeric && field.value !== "") {
        try {
          context.onChange(parseNumber(field.value));
        } catch (error) {
          context.onError(error);
        }
      } else {
        context.onChange(field.value === "" ? null : field.value);
      }
    }}>`;

  return html`<div class="view-control ${errorClass(context)}${appendOuterCSSGridClass(
    context,
    getStyleAndThisPlusMaybeNoLabel(context, "tk-component tk-input-field ctInputField tk-input-field--text")
  )}"
    style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context)}
    <div class=${getStyleAndThisPlusMaybeInGrid(context, "tk-input-field__container")}>
      ${input}
      ${renderFieldErrors(context)}
      ${context.helperText && !context.isGridCell
        ? html`<span class="tk-input-field__helper">${context.helperText}</span>`
        : ""}
    </div>
  </div>`;
}
