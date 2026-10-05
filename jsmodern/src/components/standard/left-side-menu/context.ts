import { ServerActionCommand } from "../../../../core";

export interface LeftSideMenuAction {
  readonly command: ServerActionCommand;
  readonly disabled: boolean;
}

export interface LeftSideMenuSubgroup {
  readonly name: string;
  readonly actions: readonly LeftSideMenuAction[];
}

export interface LeftSideMenuGroup {
  readonly className: string;
  readonly name: string;
  readonly targetVMClassId?: string;
  readonly subgroups: readonly LeftSideMenuSubgroup[];
}

export interface LeftSideMenuContext {
  readonly groups: readonly LeftSideMenuGroup[];
  readonly open: boolean;
  readonly mobileViewport: boolean;
  onAction(command: ServerActionCommand, targetVMClassId: string | undefined, event: MouseEvent): void;
}
