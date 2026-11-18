import { html, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import {
  appendOuterCSSGridClass,
  errorClass,
  getStyleAndThis,
  getStyleAndThisPlusMaybeInGrid,
  getStyleAndThisPlusMaybeNoLabel,
  renderControlLabel,
  renderFieldErrors
} from "../presentation";

export function renderTimePicker(context: LitComponentContext): TemplateResult {
  const value = context.value instanceof Date ? context.value : undefined;
  const pad = (part: number, length = 2) => String(part).padStart(length, "0");
  const time = value
    ? `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(), 3)}`
    : "";

  return html`<div class="view-control ${errorClass(context)}${appendOuterCSSGridClass(
    context,
    getStyleAndThisPlusMaybeNoLabel(context, "tk-component tk-timepicker tk-input-field ctInputField tk-input-field--timespan")
  )}" style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context)}
    <div class=${getStyleAndThisPlusMaybeInGrid(context, "tk-input-field__container")}>
      <input id=${context.id ?? ""} type="time" step="any"
        class=${getStyleAndThis(context, "tk-input-field__native")}
        aria-label=${context.isGridCell ? context.label : ""}
        .value=${time}
        ?disabled=${!context.enabled}
        ?readonly=${context.readOnly}
        @change=${(event: Event) => {
          const input = event.currentTarget as HTMLInputElement;
          if (!input.value) {
            context.onChange(null);
            return;
          }
          const [hours, minutes, seconds = "0"] = input.value.split(":");
          const date = value ? new Date(value.getTime()) : new Date(1970, 0, 1);
          const secondsValue = Number(seconds);
          date.setHours(Number(hours), Number(minutes), Math.floor(secondsValue), Math.round((secondsValue % 1) * 1000));
          context.onChange(date);
        }}>
      ${renderFieldErrors(context)}
      ${context.helperText && !context.isGridCell
        ? html`<span class="tk-input-field__helper">${context.helperText}</span>`
        : ""}
    </div>
  </div>`;
}
