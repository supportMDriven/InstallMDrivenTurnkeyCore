import { ServerActionCommand } from "../../../../core";

export interface ToolbarAction {
  readonly command: ServerActionCommand;
  readonly disabled: boolean;
  readonly targetVMClassId?: string;
}

export interface ToolbarEntry {
  // A named entry renders as a drop-down menu; an unnamed entry renders its actions as plain buttons.
  readonly name: string;
  readonly actions: readonly ToolbarAction[];
}

export interface ToolbarContext {
  readonly left: readonly ToolbarEntry[];
  readonly right: readonly ToolbarEntry[];
  onAction(action: ToolbarAction, event: MouseEvent): void;
}

