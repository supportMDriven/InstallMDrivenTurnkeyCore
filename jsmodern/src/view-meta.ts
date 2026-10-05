export interface ViewMetaControl {
  readonly tagName: string;
  readonly wrapperClass: string;
  readonly wrapperStyle: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly taggedValues: Readonly<Record<string, string>>;
  readonly columns: readonly ViewMetaControl[];
  readonly layoutChildren: readonly ViewMetaControl[];
}

export interface ViewDescription {
  readonly name: string;
  readonly hideSidebar: boolean;
  readonly hideMenubar: boolean;
  readonly vmColWidth: number;
  readonly vmColHeight: number;
  readonly rootClassName: string;
  readonly globalSettings: Readonly<Record<string, string>>;
  readonly styles: string;
  readonly controls: readonly ViewMetaControl[];
}

function readControls(parent: Element): ViewMetaControl[] {
  const elements = Array.from(parent.children);
  const controls: ViewMetaControl[] = [];
  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();
    if (tagName.startsWith("tk-")) {
      const wrapper = element.parentElement;
      const attributes: Record<string, string> = {};
      for (const attribute of Array.from(element.attributes)) {
        attributes[attribute.name] = attribute.value;
      }
      const taggedValues: Record<string, string> = {};
      for (const taggedValuesElement of Array.from(element.children)
        .filter(child => child.localName === "taggedvalues")) {
        for (const taggedValue of Array.from(taggedValuesElement.children)
          .filter(child => child.localName === "taggedvalue")) {
          const tag = taggedValue.getAttribute("tag");
          const value = taggedValue.getAttribute("value");
          if (tag && value !== null) {
            taggedValues[tag] = value;
          }
        }
      }
      controls.push({
        tagName,
        wrapperClass: wrapper?.getAttribute("class") ?? "",
        wrapperStyle: wrapper?.getAttribute("style") ?? "",
        attributes,
        taggedValues,
        columns: readControls(element),
        layoutChildren: []
      });
    } else if (element.hasAttribute("IsPlacingContainer") || element.classList.contains("tk-placingcontainer")) {
      const attributes: Record<string, string> = {};
      for (const attribute of Array.from(element.attributes)) {
        attributes[attribute.name] = attribute.value;
      }
      controls.push({
        tagName: "tk-layout-container",
        wrapperClass: element.getAttribute("class") ?? "",
        wrapperStyle: element.getAttribute("style") ?? "",
        attributes,
        taggedValues: {},
        columns: [],
        layoutChildren: readControls(element)
      });
    } else {
      controls.push(...readControls(element));
    }
  }
  return controls;
}

export function parseViewDescription(xmlText: string, expectedViewName: string): ViewDescription {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new TypeError(`Turnkey returned invalid XML view metadata for ${expectedViewName}`);
  }

  const root = document.documentElement;
  if (root.localName !== "root" || root.getAttribute("name") !== expectedViewName) {
    throw new TypeError(`Turnkey returned unexpected view metadata for ${expectedViewName}`);
  }

  const viewModelSection = root.querySelector("#viewmodelSection");
  if (!viewModelSection) {
    throw new TypeError(`View metadata for ${expectedViewName} has no viewmodelSection`);
  }
  const readPositiveDimension = (primary: string, fallback?: string): number => {
    const rawValue = viewModelSection.getAttribute(primary)
      ?? (fallback ? viewModelSection.getAttribute(fallback) : null);
    const value = rawValue === null ? Number.NaN : Number(rawValue);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  return {
    name: expectedViewName,
    hideSidebar: root.getAttribute("HideSidebar")?.toLowerCase() === "true",
    hideMenubar: root.getAttribute("HideMenubar")?.toLowerCase() === "true",
    vmColWidth: readPositiveDimension("VMColWidth"),
    vmColHeight: readPositiveDimension("VMColHeight", "VMRowHeight"),
    rootClassName: viewModelSection.getAttribute("class") ?? "",
    globalSettings: Object.fromEntries(
      Array.from(root.querySelectorAll(":scope > gs"))
        .map(setting => [setting.getAttribute("name") ?? "", setting.getAttribute("value") ?? ""])
    ),
    styles: root.querySelector("style")?.textContent ?? "",
    controls: readControls(viewModelSection)
  };
}
