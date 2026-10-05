import { html, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import {
  appendOuterCSSGridClass,
  getStyleAndThis,
  getStyleAndThisPlusMaybeInGrid,
  renderControlLabel
  ,errorClass,
  renderFieldErrors
} from "../presentation";

export function renderCheckbox(context: LitComponentContext): TemplateResult {
  return html`<div class="view-control ${errorClass(context)}${appendOuterCSSGridClass(
    context,
    `${getStyleAndThisPlusMaybeInGrid(context, "tk-checkbox")} tk-component ctCheckbox${context.label ? "" : " tk-checkbox--no-label"}`
  )}"
    style=${context.metadata.wrapperStyle}>
    <div class="tk-checkbox__inner">
      <label class="tk-checkbox__content ripple-effect">
        <input id=${context.id ?? ""} type="checkbox" class=${getStyleAndThis(context, "tk-checkbox__native")}
          aria-label=${context.isGridCell ? context.label : ""}
          .checked=${context.value === true}
          ?disabled=${!context.enabled}
          @change=${(event: Event) => context.onChange((event.currentTarget as HTMLInputElement).checked)}>
        <span class="tk-checkbox__interactive" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="tk-checkbox__checkmark">
            <path fill="none" stroke="white" d="M1.73,12.91 8.1,19.28 22.79,4.59"
              class="tk-checkbox__checkmark-path"></path>
          </svg>
        </span>
      </label>
      ${context.isGridCell ? "" : renderControlLabel(context, "tk-checkbox__label tk-label")}
    </div>
    ${renderFieldErrors(context)}
    ${context.helperText && !context.isGridCell
      ? html`<span class="tk-input-field__helper">${context.helperText}</span>`
      : ""}
  </div>`;
}
