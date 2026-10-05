import { html, TemplateResult } from "lit";
import { NULL_EXTERNAL_ID } from "../../../../core";
import { LitComponentContext } from "../../control-context";
import {
  appendOuterCSSGridClass,
  getStyleAndThis,
  getStyleAndThisPlusMaybeInGrid,
  getStyleAndThisPlusMaybeNoLabel,
  renderControlLabel
} from "../presentation";

export function renderSelect(context: LitComponentContext): TemplateResult {
  const presentationColumn = context.metadata.attributes.BindInfoPicklistItemPres ?? "Presentation";
  return html`<div class="view-control ${appendOuterCSSGridClass(
    context,
    getStyleAndThisPlusMaybeNoLabel(context, "tk-component tk-select")
  )}"
    style=${context.metadata.wrapperStyle}>
    ${context.isGridCell ? "" : renderControlLabel(context)}
    <div class="tk-select__inner ${getStyleAndThisPlusMaybeInGrid(context, "tk-input-field__container")}">
    <select id=${context.id ?? ""} class=${getStyleAndThis(context, "tk-select__native")}
      aria-label=${context.isGridCell ? context.label : ""}
      ?disabled=${!context.enabled}
      @change=${(event: Event) => {
        const selected = (event.currentTarget as HTMLSelectElement).value;
        context.onChange(selected || NULL_EXTERNAL_ID);
      }}>
      <option value="" ?selected=${!context.selectedExternalId}>${context.placeholder}</option>
      ${(context.collection ?? []).map(option => html`
        <option value=${option.id} ?selected=${option.id === context.selectedExternalId}>
          ${String(option.attributes[presentationColumn] ?? option.id)}
        </option>
      `)}
    </select>
    <i class="tk-select__dropdown-icon" aria-hidden="true"></i>
    </div>
    ${context.helperText && !context.isGridCell
      ? html`<span class="tk-input-field__helper">${context.helperText}</span>`
      : ""}
  </div>`;
}
