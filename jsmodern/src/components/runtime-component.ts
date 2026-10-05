import { TemplateResult } from "lit";
import { html as staticHtml, unsafeStatic } from "lit/static-html.js";
import { LitComponentContext } from "./control-context";
import { ViewMetaControl } from "../view-meta";

export interface RuntimeComponentReference {
  readonly name: string;
  readonly elementName: string;
  readonly fileUrl: string;
  readonly kind: "custom" | "override";
}

const componentNamePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function normalizeComponentName(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

export function runtimeComponentName(control: ViewMetaControl): string | undefined {
  const name = control.taggedValues.Lit_Ext_Component
    ?? control.taggedValues.LitComponent
    ?? control.taggedValues.Blazor_Ext_Component;
  const trimmedName = name?.trim();
  return trimmedName ? normalizeComponentName(trimmedName) : undefined;
}

export function resolveRuntimeComponent(name: string, baseUrl: string): RuntimeComponentReference {
  const normalizedName = normalizeComponentName(name.trim());
  if (!componentNamePattern.test(normalizedName)) {
    throw new TypeError(`Invalid Lit component name "${name}". Use a component name that resolves to lowercase kebab-case.`);
  }

  return {
    name: normalizedName,
    elementName: `tk-lit-custom-${normalizedName}`,
    fileUrl: new URL(`components/custom/${normalizedName}/index.js`, baseUrl).toString(),
    kind: "custom"
  };
}

export function resolveRuntimeOverride(tagName: string, baseUrl: string): RuntimeComponentReference {
  const isLeftSideMenu = tagName === "LeftSideMenu" || tagName === "Toolbar";
  if (!isLeftSideMenu && !/^tk-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tagName)) {
    throw new TypeError(`Invalid standard control tag "${tagName}".`);
  }
  const name = tagName === "LeftSideMenu" ? "left-side-menu" : tagName === "Toolbar" ? "toolbar" : tagName;
  const elementName = isLeftSideMenu ? name : tagName.slice(3);
  return {
    name,
    elementName: `tk-lit-override-${elementName}`,
    fileUrl: new URL(`components/overrides/${name}/index.js`, baseUrl).toString(),
    kind: "override"
  };
}

export function renderRuntimeComponent<T>(
  reference: RuntimeComponentReference,
  context: T
): TemplateResult {
  const elementName = unsafeStatic(reference.elementName);
  return staticHtml`<${elementName} .context=${context}></${elementName}>`;
}
