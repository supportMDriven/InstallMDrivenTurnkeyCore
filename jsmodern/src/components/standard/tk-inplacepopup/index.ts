import { html, nothing, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import {
  appendOuterCSSGridClass,
  getStyleAndThis,
  renderControlIcon
} from "../presentation";

export interface InPlacePopupState {
  // Alignment chosen when the popup was opened, or undefined while it is closed.
  readonly alignment?: "left-aligned" | "right-aligned";
  readonly onOpen: (event: MouseEvent) => void;
}

// A button that opens the nested controls of the metadata node in a popup next to it, like AngularJS.
export function renderInPlacePopup(
  context: LitComponentContext,
  content: TemplateResult | typeof nothing,
  state: InPlacePopupState
): TemplateResult {
  const blankLabel = !context.label && context.metadata.attributes.StaticLabel === "";
  const popupClass = `${context.metadata.attributes.BindInfoNesting ?? ""}_${context.metadata.attributes.BindInfoColumn ?? ""} ctInPlacePopup tk-inplacepopup__popup`
    + (state.alignment ? ` ${state.alignment}` : " hidden");
  return html`<div class="view-control ${appendOuterCSSGridClass(
    context,
    getStyleAndThis(context, "tk-component ctButton tk-button NoLabel ctInPlacePopup tk-inplacepopup")
  )}"
    style=${context.metadata.wrapperStyle}>
    <button type="button" class=${getStyleAndThis(context, "tk-button__native ripple-effect")}
      ?disabled=${!context.enabled}
      title=${context.label}
      aria-haspopup="true"
      aria-expanded=${state.alignment ? "true" : "false"}
      @click=${state.onOpen}>
      ${renderControlIcon(context.metadata, "before")}
      ${blankLabel ? nothing : html`<span class="tk-button__text">${context.label}</span>`}
      ${renderControlIcon(context.metadata, "after")}
    </button>
    <div>
      <div class=${popupClass} data-inplace-popup=${context.id ?? ""}
        style="position:absolute;top:20px;z-index:1000">${content}</div>
    </div>
  </div>`;
}
