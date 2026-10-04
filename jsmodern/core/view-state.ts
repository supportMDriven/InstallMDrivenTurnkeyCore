import {
  ClientCommand_Update,
  IdChangeCommand,
  UpdateAttributeCommand,
  UpdateCollectionCommand,
  ViewStateServerCommand
} from "./commands";

export const NULL_EXTERNAL_ID = "$null$";

export interface VmReference {
  readonly kind: "reference";
  readonly id: string;
}

export type VmValue = string | number | boolean | Date | VmReference | null;
export type VmAttributeValue = VmValue | readonly string[];

export interface VmObject {
  readonly vmClassId: string;
  readonly id: string;
  readonly className: string;
  readonly attributes: Readonly<Record<string, VmAttributeValue>>;
}

interface MutableVmObject {
  vmClassId: string;
  id: string;
  className: string;
  attributes: Record<string, VmValue | string[]>;
}

export interface ViewStateChange {
  readonly revision: number;
  readonly commands: readonly ViewStateServerCommand[];
}

export class ViewState {
  private readonly objects = new Map<string, MutableVmObject>();
  private readonly listeners = new Set<(change: ViewStateChange) => void>();
  private revision = 0;
  private serverMessageCursor = 0;
  private currentRootId: string;

  constructor(rootVMClassId: string, public vmId = "") {
    this.currentRootId = rootVMClassId;
    const root = this.ensureObject(rootVMClassId);
    if (!root.className) {
      throw new TypeError(`Invalid root VMClassId: ${rootVMClassId}`);
    }
  }

  get rootId(): string {
    return this.currentRootId;
  }

  get cursor(): number {
    return this.serverMessageCursor;
  }

  get version(): number {
    return this.revision;
  }

  get allObjects(): readonly VmObject[] {
    return [...this.objects.keys()]
      .map(vmClassId => this.getObject(vmClassId))
      .filter((object): object is VmObject => object !== undefined);
  }

  get root(): VmObject {
    const root = this.getObject(this.currentRootId);
    if (!root) {
      throw new Error(`The root view-model object is missing: ${this.currentRootId}`);
    }
    return root;
  }

  getObject(vmClassId: string): VmObject | undefined {
    const object = this.objects.get(vmClassId);
    if (!object) {
      return undefined;
    }
    return {
      vmClassId: object.vmClassId,
      id: object.id,
      className: object.className,
      attributes: object.attributes
    };
  }

  getReference(value: VmAttributeValue): VmObject | undefined {
    return value && typeof value === "object" && !(value instanceof Date)
      && "kind" in value && value.kind === "reference"
      ? this.getObject(value.id)
      : undefined;
  }

  getCurrentObject(className: string): VmObject | undefined {
    if (this.root.className === className) {
      return this.root;
    }

    const variables = this.getReference(this.root.attributes.VM_Variables);
    const currentId = variables?.attributes[`vCurrent_${className}`];
    if (typeof currentId !== "string" || currentId === "" || currentId === NULL_EXTERNAL_ID) {
      return undefined;
    }
    return this.getObject(`${currentId};${className}`);
  }

  getCollection(vmClassId: string, attribute: string): readonly VmObject[] {
    const object = this.objects.get(vmClassId);
    const collection = object?.attributes[attribute];
    if (!Array.isArray(collection)) {
      return [];
    }
    return collection
      .map(id => this.getObject(id))
      .filter((item): item is VmObject => item !== undefined);
  }

  subscribe(listener: (change: ViewStateChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  applyServerCommands(commands: readonly ViewStateServerCommand[]): void {
    for (const command of commands) {
      if (typeof command.MNo === "number") {
        this.serverMessageCursor = command.MNo;
      }

      switch (command.CType) {
        case "ServerUpdateCommand_UpdateAttribute":
          this.applyAttribute(command as UpdateAttributeCommand);
          break;
        case "ServerUpdateCommand_UpdateCollection":
          this.applyCollection(command as UpdateCollectionCommand);
          break;
        case "ServerUpdateCommand_IdChange":
          this.applyIdChange(command as IdChangeCommand);
          break;
      }
    }

    if (commands.length > 0) {
      this.publish(commands);
    }
  }

  setAttribute(
    vmClassId: string,
    attribute: string,
    value: VmValue,
    instanceId: number
  ): ClientCommand_Update {
    this.setAttributeLocally(vmClassId, attribute, value);
    return {
      VMId: this.vmId,
      VMClassId: vmClassId,
      Attribute: attribute,
      Value: this.serializeValue(value),
      InstanceId: instanceId
    };
  }

  setAttributeLocally(vmClassId: string, attribute: string, value: VmValue): void {
    const object = this.objects.get(vmClassId);
    if (!object) {
      throw new Error(`Cannot update missing view-model object: ${vmClassId}`);
    }
    if (attribute === "VMClassId") {
      throw new Error("VMClassId is managed by Turnkey and cannot be edited as an attribute");
    }

    object.attributes[attribute] = value;
    this.publish([]);
  }

  private applyAttribute(command: UpdateAttributeCommand): void {
    const owner = this.ensureObject(command.VMClassId);
    if (command.DataType === "SingleAssociation") {
      owner.attributes[command.Attribute] = command.Value === NULL_EXTERNAL_ID
        ? null
        : this.reference(command.Value);
      return;
    }
    owner.attributes[command.Attribute] = this.convertValue(command.Value, command.DataType);
  }

  private applyCollection(command: UpdateCollectionCommand): void {
    const owner = this.ensureObject(command.VMClassId);
    let collection = owner.attributes[command.Attribute];
    if (!Array.isArray(collection)) {
      collection = [];
      owner.attributes[command.Attribute] = collection;
    }

    for (const oldId of command.OldValues ?? []) {
      const index = collection.indexOf(oldId);
      if (index >= 0) {
        collection.splice(index, 1);
      }
    }

    if (command.UpdateType === "Reset") {
      collection.splice(0);
    }

    const requestedIndex = command.NewValuesStartIndex < 0
      ? collection.length + command.NewValuesStartIndex
      : command.NewValuesStartIndex;
    const insertAt = Math.max(0, Math.min(requestedIndex, collection.length));
    const additions: string[] = [];
    for (const id of command.NewValues ?? []) {
      this.ensureObject(id);
      if (!collection.includes(id) && !additions.includes(id)) {
        additions.push(id);
      }
    }
    collection.splice(insertAt, 0, ...additions);
  }

  private applyIdChange(command: IdChangeCommand): void {
    const object = this.objects.get(command.OldVMClassId);
    if (!object) {
      return;
    }
    const newId = this.parseVMClassId(command.NewVMClassId);
    const existing = this.objects.get(command.NewVMClassId);
    if (existing && existing !== object) {
      this.objects.delete(command.NewVMClassId);
    }

    this.objects.delete(command.OldVMClassId);
    object.vmClassId = command.NewVMClassId;
    object.id = newId.id;
    object.className = newId.className;
    this.objects.set(command.NewVMClassId, object);

    if (this.currentRootId === command.OldVMClassId) {
      this.currentRootId = command.NewVMClassId;
    }
    for (const candidate of this.objects.values()) {
      for (const [name, value] of Object.entries(candidate.attributes)) {
        if (Array.isArray(value)) {
          candidate.attributes[name] = value.map(id => id === command.OldVMClassId ? command.NewVMClassId : id);
        } else if (value && typeof value === "object" && !(value instanceof Date)
          && value.kind === "reference" && value.id === command.OldVMClassId) {
          candidate.attributes[name] = this.reference(command.NewVMClassId);
        }
      }
    }

  }

  private ensureObject(vmClassId: string): MutableVmObject {
    let object = this.objects.get(vmClassId);
    if (!object) {
      const parsed = this.parseVMClassId(vmClassId);
      object = { vmClassId, ...parsed, attributes: {} };
      this.objects.set(vmClassId, object);
    }
    return object;
  }

  private parseVMClassId(value: string): { id: string; className: string } {
    const separator = value.indexOf(";");
    if (separator < 0 || separator === value.length - 1) {
      throw new TypeError(`Invalid VMClassId: ${value}`);
    }
    return {
      id: value.slice(0, separator) || NULL_EXTERNAL_ID,
      className: value.slice(separator + 1)
    };
  }

  private reference(id: string): VmReference {
    this.ensureObject(id);
    return { kind: "reference", id };
  }

  private convertValue(value: string, dataType: string): VmValue {
    if (value === NULL_EXTERNAL_ID) {
      return null;
    }
    const type = dataType.replace(/^Nullable</, "").replace(/>$/, "").replace(/^System\./, "");
    switch (type) {
      case "String":
      case "Boolean":
        return type === "Boolean" ? value === "true" : value;
      case "Byte":
      case "Int16":
      case "Int32":
      case "Int64":
        return parseInt(value, 10);
      case "Decimal":
      case "Double":
        return parseFloat(value);
      case "DateTime":
      case "TimeSpan":
        return new Date(value.endsWith("Z") ? value.slice(0, -1) : value);
      default:
        return value;
    }
  }

  private serializeValue(value: VmValue): string {
    if (value === null) {
      return NULL_EXTERNAL_ID;
    }
    if (value instanceof Date) {
      const pad = (part: number, length = 2) => part.toString().padStart(length, "0");
      return `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
        + `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
        + `.${pad(value.getMilliseconds(), 3)}Z`;
    }
    if (typeof value === "object") {
      return value.id;
    }
    return String(value);
  }

  private publish(commands: readonly ViewStateServerCommand[]): void {
    this.revision++;
    const change: ViewStateChange = { revision: this.revision, commands };
    for (const listener of this.listeners) {
      listener(change);
    }
  }
}
