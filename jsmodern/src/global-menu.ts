export interface GlobalMenuItem {
  readonly name: string;
  readonly presentation: string;
  readonly actionName?: string;
  readonly newTab: boolean;
  readonly divider?: boolean;
  readonly children: readonly GlobalMenuItem[];
}

export interface GlobalMenuDescription {
  readonly applicationName: string;
  readonly items: readonly GlobalMenuItem[];
}

function parseItems(parent: Element): GlobalMenuItem[] {
  return Array.from(parent.children)
    .filter(child => child.localName === "mi" || child.localName === "divider")
    .map((element): GlobalMenuItem => element.localName === "divider"
      ? { name: "", presentation: "", newTab: false, divider: true, children: [] }
      : {
      name: element.getAttribute("name") ?? "",
      presentation: element.getAttribute("presentation") ?? element.getAttribute("name") ?? "",
      actionName: element.getAttribute("glaction") ?? undefined,
      newTab: element.getAttribute("newtab")?.toLowerCase() === "true",
      children: parseItems(element)
    });
}

export function parseGlobalMenu(xmlText: string): GlobalMenuDescription {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.querySelector("parsererror") || document.documentElement.localName !== "mainmenu") {
    throw new TypeError("Turnkey returned invalid global actions metadata");
  }

  const root = document.documentElement;
  return {
    applicationName: root.getAttribute("appname") ?? "",
    items: parseItems(root)
  };
}
