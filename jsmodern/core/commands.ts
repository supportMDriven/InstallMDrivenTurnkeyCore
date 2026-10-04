export interface ServerUpdateCommand {
  CType: string;
  MNo?: number;
  [key: string]: unknown;
}

export interface UpdateAttributeCommand extends ServerUpdateCommand {
  CType: "ServerUpdateCommand_UpdateAttribute";
  MNo: number;
  VMClassId: string;
  Attribute: string;
  Value: string;
  DataType: string;
}

export interface UpdateCollectionCommand extends ServerUpdateCommand {
  CType: "ServerUpdateCommand_UpdateCollection";
  MNo: number;
  VMClassId: string;
  Attribute: string;
  UpdateType: string;
  NewValues: string[] | null;
  OldValues: string[] | null;
  NewValuesStartIndex: number;
  OldValuesStartIndex: number;
}

export interface IdChangeCommand extends ServerUpdateCommand {
  CType: "ServerUpdateCommand_IdChange";
  MNo: number;
  OldVMClassId: string;
  NewVMClassId: string;
}

export interface ServerActionCommand extends ServerUpdateCommand {
  CType: "ServerUpdateCommand_Action";
  MNo: number;
  VMClassName: string;
  Action: string;
  Enable: boolean;
  Presentation: string;
  SortKey: string;
  ActionRenderPosition: string;
  View?: string;
  IsModal?: boolean;
  IsPopUp?: boolean;
  GroupHeader?: string;
  SubMenuGroup?: string;
  SubMenuGroupSortKey?: string;
}

export interface ServerActionRemoveCommand extends ServerUpdateCommand {
  CType: "ServerUpdateCommand_ActionRemove";
  MNo: number;
  VMClassName: string;
  Action: string;
  ActionRenderPosition: string;
}

export interface NavigateCommand extends ServerUpdateCommand {
  CType: "ServerUpdateCommand_Navigate";
  MNo: number;
  Url?: string;
  TargetIsInAppAndAngular: boolean;
  View: string;
  Id: string;
  ClientIdForNavigationVerification?: string | null;
  IsModal: boolean;
  IsPopUp: boolean;
  ActionName?: string;
  NewTab: boolean;
}

export interface ModalCodeCloseCommand extends ServerUpdateCommand {
  CType: "ServerUpdateCommand_ModalCodeClose";
  MNo: number;
  IsCloseWithOk: boolean;
  IsClosePopup: boolean;
}

export type ViewStateServerCommand =
  | UpdateAttributeCommand
  | UpdateCollectionCommand
  | IdChangeCommand
  | ServerActionCommand
  | ServerActionRemoveCommand
  | NavigateCommand
  | ModalCodeCloseCommand
  | ServerUpdateCommand;

export interface ClientCommand_Update {
  VMId: string;
  VMClassId: string;
  Attribute: string;
  Value: string;
  InstanceId: number;
}

export interface ClientCommand_ActionExecute {
  VMId: string;
  VMClassName: string;
  Action: string;
  ClientIdForNavigationVerification: string;
}

export interface ClientCommand_ActionRowClickExecute {
  VMId: string;
  VMClassId: string;
  Action: string;
  ClientIdForNavigationVerification: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(command: Record<string, unknown>, key: string, index: number): string {
  const value = command[key];
  if (typeof value !== "string") {
    throw new TypeError(`Server command at index ${index} has an invalid ${key}`);
  }
  return value;
}

function requiredNumber(command: Record<string, unknown>, key: string, index: number): number {
  const value = command[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`Server command at index ${index} has an invalid ${key}`);
  }
  return value;
}

function requiredBoolean(command: Record<string, unknown>, key: string, index: number): boolean {
  const value = command[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 0 || value === 1) {
    return value === 1;
  }
  throw new TypeError(`Server command at index ${index} has an invalid ${key}`);
}

function optionalString(command: Record<string, unknown>, key: string, index: number): string | undefined {
  const value = command[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new TypeError(`Server command at index ${index} has an invalid ${key}`);
  }
  return value;
}

function optionalBoolean(command: Record<string, unknown>, key: string, index: number): boolean | undefined {
  const value = command[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 0 || value === 1) {
    return value === 1;
  }
  throw new TypeError(`Server command at index ${index} has an invalid ${key}`);
}

function stringArrayOrNull(value: unknown, key: string, index: number): string[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
    throw new TypeError(`Server command at index ${index} has an invalid ${key}`);
  }
  return value;
}

export function decodeServerCommands(payload: unknown): ViewStateServerCommand[] {
  if (!Array.isArray(payload)) {
    throw new TypeError("Turnkey server stream response must be an array");
  }

  return payload.map((item: unknown, index: number): ViewStateServerCommand => {
    if (!isRecord(item) || typeof item.CType !== "string") {
      throw new TypeError(`Server command at index ${index} has no command type`);
    }
    const MNo = requiredNumber(item, "MNo", index);

    switch (item.CType) {
      case "ServerUpdateCommand_UpdateAttribute":
        return {
          CType: item.CType,
          MNo,
          VMClassId: requiredString(item, "VMClassId", index),
          Attribute: requiredString(item, "Attribute", index),
          Value: requiredString(item, "Value", index),
          DataType: requiredString(item, "DataType", index)
        };
      case "ServerUpdateCommand_UpdateCollection":
        return {
          CType: item.CType,
          MNo,
          VMClassId: requiredString(item, "VMClassId", index),
          Attribute: requiredString(item, "Attribute", index),
          UpdateType: requiredString(item, "UpdateType", index),
          NewValues: stringArrayOrNull(item.NewValues, "NewValues", index),
          OldValues: stringArrayOrNull(item.OldValues, "OldValues", index),
          NewValuesStartIndex: requiredNumber(item, "NewValuesStartIndex", index),
          OldValuesStartIndex: requiredNumber(item, "OldValuesStartIndex", index)
        };
      case "ServerUpdateCommand_IdChange":
        return {
          CType: item.CType,
          MNo,
          OldVMClassId: requiredString(item, "OldVMClassId", index),
          NewVMClassId: requiredString(item, "NewVMClassId", index)
        };
      case "ServerUpdateCommand_Action":
        return {
          ...item,
          CType: item.CType,
          MNo,
          VMClassName: requiredString(item, "VMClassName", index),
          Action: requiredString(item, "Action", index),
          Enable: requiredBoolean(item, "Enable", index),
          Presentation: requiredString(item, "Presentation", index),
          SortKey: requiredString(item, "SortKey", index),
          ActionRenderPosition: requiredString(item, "ActionRenderPosition", index),
          View: optionalString(item, "View", index),
          IsModal: optionalBoolean(item, "IsModal", index),
          IsPopUp: optionalBoolean(item, "IsPopUp", index),
          GroupHeader: optionalString(item, "GroupHeader", index),
          SubMenuGroup: optionalString(item, "SubMenuGroup", index),
          SubMenuGroupSortKey: optionalString(item, "SubMenuGroupSortKey", index)
        };
      case "ServerUpdateCommand_ActionRemove":
        return {
          CType: item.CType,
          MNo,
          VMClassName: requiredString(item, "VMClassName", index),
          Action: requiredString(item, "Action", index),
          ActionRenderPosition: requiredString(item, "ActionRenderPosition", index)
        };
      case "ServerUpdateCommand_Navigate":
        return {
          ...item,
          CType: item.CType,
          MNo,
          Url: optionalString(item, "Url", index),
          TargetIsInAppAndAngular: requiredBoolean(item, "TargetIsInAppAndAngular", index),
          View: requiredString(item, "View", index),
          Id: requiredString(item, "Id", index),
          ClientIdForNavigationVerification: optionalString(item, "ClientIdForNavigationVerification", index) ?? null,
          IsModal: requiredBoolean(item, "IsModal", index),
          IsPopUp: requiredBoolean(item, "IsPopUp", index),
          ActionName: optionalString(item, "ActionName", index),
          NewTab: requiredBoolean(item, "NewTab", index)
        };
      case "ServerUpdateCommand_ModalCodeClose":
        return {
          CType: item.CType,
          MNo,
          IsCloseWithOk: requiredBoolean(item, "IsCloseWithOk", index),
          IsClosePopup: item.IsClosePopup === undefined
            ? false
            : requiredBoolean(item, "IsClosePopup", index)
        };
      default:
        return { ...item, CType: item.CType, MNo };
    }
  });
}
