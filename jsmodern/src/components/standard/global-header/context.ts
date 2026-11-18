import { GlobalMenuItem } from "../../../global-menu";

export interface LeftSideToggleContext {
  readonly available: boolean;
  readonly open: boolean;
  readonly mobileViewport: boolean;
  onToggle(): void;
}

export interface ApplicationNameContext {
  readonly name: string;
  readonly homeUrl: string;
}

export interface GlobalActionsContext {
  readonly items: readonly GlobalMenuItem[];
  readonly actionStatus: ReadonlyMap<string, { readonly enabled: boolean; readonly visible: boolean }>;
  onAction(item: GlobalMenuItem): Promise<void>;
  onMenuToggle(event: Event): void;
  onSubmenuPointerEnter(event: PointerEvent): void;
  onSubmenuPointerLeave(event: PointerEvent): void;
}

export interface HeaderSpaceContext {
  readonly applicationName: string;
  readonly viewName: string;
}

export interface LoginSectionContext {
  readonly markup: string;
  readonly returnUrl: string;
  onClick(event: MouseEvent): void;
}
