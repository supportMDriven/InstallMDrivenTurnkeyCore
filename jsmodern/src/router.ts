export interface ViewRoute {
  readonly viewName: string;
  readonly objectId: string;
  readonly userControlParentId?: string;
  readonly debug: boolean;
}

export function parseViewRoute(hash: string): ViewRoute {
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const viewName = segments[0] || "Index";
  const thirdSegment = segments[2];
  return {
    viewName,
    objectId: segments[1] || "$null$",
    userControlParentId: thirdSegment && thirdSegment !== "debug" ? thirdSegment : undefined,
    debug: thirdSegment === "debug"
  };
}

export function viewRouteHash(viewName: string, objectId = "$null$"): string {
  return `#/${encodeURIComponent(viewName)}/${encodeURIComponent(objectId)}`;
}
