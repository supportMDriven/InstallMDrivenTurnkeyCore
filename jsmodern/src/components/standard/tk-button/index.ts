import { html, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import {
  appendOuterCSSGridClass,
  getStyleAndThis,
  renderControlIcon
} from "../presentation";

export function renderButton(context: LitComponentContext): TemplateResult {
  const actionName = context.metadata.attributes.AbstractAction
    || context.metadata.attributes.BindInfoColumn
    || "";
  return html`<div class="view-control ${appendOuterCSSGridClass(
    context,
    getStyleAndThis(context, "tk-component tk-button ctButton NoLabel")
  )}"
    style=${context.metadata.wrapperStyle}>
    <button type="button" class=${getStyleAndThis(context, "tk-button__native ripple-effect") + (context.isGridCell ? " dense" : "")
      + (context.metadata.attributes.IsSeekerAction?.toLowerCase() === "true" ? " seekeraction" : "")}
      ?disabled=${!context.enabled || context.actionExecuting}
      title=${context.label}
      @click=${(event: MouseEvent) => context.executeAction(actionName, event)}>
      ${renderControlIcon(context.metadata, "before")}
      <span class=${getStyleAndThis(context, "tk-button__text")}>${context.label || actionName}</span>
      ${renderControlIcon(context.metadata, "after")}
    </button>
  </div>`;
}
