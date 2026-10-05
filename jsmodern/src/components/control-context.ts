import { VmAttributeValue, VmObject, VmValue } from "../../core/view-state";
import { ViewMetaControl } from "../view-meta";

export interface LitComponentContext {
  readonly componentName: string;
  readonly metadata: ViewMetaControl;
  readonly id?: string;
  readonly object?: VmObject;
  readonly value?: VmAttributeValue;
  readonly collection?: readonly VmObject[];
  readonly displayValue: string;
  readonly inputType: string;
  readonly selectedExternalId?: string;
  readonly actionExecuting: boolean;
  readonly label: string;
  readonly placeholder: string;
  readonly helperText: string;
  readonly errors: readonly string[];
  readonly style: string;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly readOnly: boolean;
  readonly isGridCell: boolean;
  readonly upload?: {
    readonly fileName: string;
    readonly progress: number;
    readonly uploading: boolean;
    readonly error?: string;
  };
  readonly minSize: {
    readonly width: number;
    readonly height: number;
  };
  onChange(value: VmValue): void;
  uploadFile(file: File): Promise<void>;
  executeAction(actionName?: string, event?: MouseEvent): void;
  onError(error: unknown): void;
}
