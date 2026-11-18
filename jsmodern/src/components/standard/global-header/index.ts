import { html, nothing, TemplateResult } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { GlobalMenuItem } from "../../../global-menu";
import {
  ApplicationNameContext,
  GlobalActionsContext,
  HeaderSpaceContext,
  LeftSideToggleContext,
  LoginSectionContext
} from "./context";

export function renderLeftSideToggle(context: LeftSideToggleContext): TemplateResult | typeof nothing {
  if (!context.available) {
    return nothing;
  }
  return html`<button type="button" class="action-toggle navbar__toggle navbar__toggle--sidebar"
    aria-label=${context.open ? "Hide view actions" : "Show view actions"}
    aria-controls="view-actions-panel" aria-expanded=${context.open}
    @click=${context.onToggle}>
    <span class="icon-bar"></span><span class="icon-bar"></span><span class="icon-bar"></span>
  </button>`;
}

export function renderApplicationName(context: ApplicationNameContext): TemplateResult {
  return html`<a class="navbar__brand" href=${context.homeUrl}>${context.name}</a>`;
}

function renderGlobalMenuItem(context: GlobalActionsContext, item: GlobalMenuItem, nested = false): TemplateResult | typeof nothing {
  if (item.divider) {
    return nested ? html`<div class="dropdown__item menu-divider" role="separator"></div>` : nothing;
  }
  if (item.actionName) {
    const status = context.actionStatus.get(item.actionName);
    if (status?.visible === false) {
      return nothing;
    }
    const button = html`<button type="button" class=${nested ? "dropdown__link" : "navbar__link"}
      ?disabled=${status?.enabled === false}
      @click=${() => void context.onAction(item)}>${item.presentation}</button>`;
    return nested ? html`<div class="dropdown__item">${button}</div>` : html`<li class="navbar__item">${button}</li>`;
  }
  if (item.children.length === 0) {
    return nothing;
  }
  const menu = html`
    <button type="button" class=${nested ? "dropdown__link" : "navbar__link"} aria-haspopup="true"
      @click=${context.onMenuToggle}>${item.presentation}${nested ? nothing : html`<span class="caret"></span>`}</button>
    <div class="dropdown__menu ${nested ? "dropdown--nested" : ""}">${item.children.map(child => renderGlobalMenuItem(context, child, true))}</div>`;
  return nested
    ? html`<div class="dropdown__item dropdown"
        @pointerenter=${context.onSubmenuPointerEnter}
        @pointerleave=${context.onSubmenuPointerLeave}>${menu}</div>`
    : html`<li class="navbar__item dropdown">${menu}</li>`;
}

export function renderGlobalActions(context: GlobalActionsContext): TemplateResult {
  return html`<nav aria-label="Global menu">
    <ul class="navbar__list">${context.items.map(item => renderGlobalMenuItem(context, item))}</ul>
  </nav>`;
}

export function renderHeaderSpace(_context: HeaderSpaceContext): typeof nothing {
  return nothing;
}

export function renderLoginSection(context: LoginSectionContext): TemplateResult | typeof nothing {
  return context.markup
    ? html`<div class="login-section" @click=${context.onClick}>${unsafeHTML(context.markup)}</div>`
    : nothing;
}
