import { html, nothing, TemplateResult } from "lit";
import { ViewMetaControl } from "../../view-meta";
import { LitComponentContext } from "../control-context";

function mergeClasses(...values: string[]): string {
  return [...new Set(values.flatMap(value => value.split(/\s+/).filter(Boolean)))].join(" ");
}

export function getStyleAndThis(context: LitComponentContext, baseStyle: string): string {
  return mergeClasses(context.style, baseStyle, context.inputType === "number" ? "numeric" : "");
}

export function getStyleAndThisPlusMaybeInGrid(
  context: LitComponentContext,
  baseStyle: string,
  skipBaseStyleIfNotInGrid = false
): string {
  const baseClasses = baseStyle.split(/\s+/).filter(Boolean);
  return context.isGridCell
    ? mergeClasses(
        ...baseClasses.map(className => `${className}--in-grid`),
        ...baseClasses,
        context.style
      )
    : mergeClasses(skipBaseStyleIfNotInGrid ? "" : baseStyle, context.style);
}

export function getStyleAndThisPlusMaybeNoLabel(
  context: LitComponentContext,
  baseStyle: string
): string {
  return mergeClasses(
    baseStyle,
    context.style,
    !context.isGridCell && !context.label ? "tk-input-field--no-label" : ""
  );
}

export function appendOuterCSSGridClass(
  context: LitComponentContext,
  classes: string,
  excludedWrapperClasses: readonly string[] = []
): string {
  const { BindInfoNesting, BindInfoColumn } = context.metadata.attributes;
  const bindingClass = BindInfoNesting && BindInfoColumn
    ? `${BindInfoNesting}_${BindInfoColumn}`
    : "";
  const wrapperClasses = context.metadata.wrapperClass
    .split(/\s+/)
    .filter(className => className && !excludedWrapperClasses.includes(className)
      && (!context.isGridCell || className !== bindingClass))
    .join(" ");
  return mergeClasses(
    context.isGridCell ? "" : bindingClass,
    classes,
    wrapperClasses
  );
}

export function renderControlIcon(
  control: ViewMetaControl,
  position: "before" | "after"
): TemplateResult | typeof nothing {
  const icon = control.taggedValues.Icon;
  const iconPosition = control.taggedValues.IconPosition ?? "before";
  return icon && iconPosition === position
    ? html`<span class="mi tk-label__icon" aria-hidden="true">${icon}</span>`
    : nothing;
}

export function renderControlLabel(
  context: LitComponentContext,
  className = "tk-input-field__label tk-label"
): TemplateResult | typeof nothing {
  if (!context.label) {
    return nothing;
  }
  return html`<label for=${context.id ?? nothing} class=${mergeClasses(context.style, className)}>
    ${renderControlIcon(context.metadata, "before")}
    <span class=${context.style}>${context.label}</span>
    ${renderControlIcon(context.metadata, "after")}
  </label>`;
}

export function renderTypography(
  tagName: string,
  id: string | undefined,
  content: unknown,
  className: string
): TemplateResult {
  switch (tagName) {
    case "h1": return html`<h1 id=${id ?? nothing} class=${className}>${content}</h1>`;
    case "h2": return html`<h2 id=${id ?? nothing} class=${className}>${content}</h2>`;
    case "h3": return html`<h3 id=${id ?? nothing} class=${className}>${content}</h3>`;
    case "h4": return html`<h4 id=${id ?? nothing} class=${className}>${content}</h4>`;
    case "h5": return html`<h5 id=${id ?? nothing} class=${className}>${content}</h5>`;
    case "h6": return html`<h6 id=${id ?? nothing} class=${className}>${content}</h6>`;
    default: return html`<div id=${id ?? nothing} class=${className}>${content}</div>`;
  }
}

