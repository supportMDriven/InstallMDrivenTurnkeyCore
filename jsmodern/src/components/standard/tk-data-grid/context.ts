import { ServerActionCommand } from "../../../../core";
import { VmObject } from "../../../../core/view-state";
import { nothing, TemplateResult } from "lit";
import { LitComponentContext } from "../../control-context";
import { ViewMetaControl } from "../../../view-meta";

export interface DataGridActionGroup {
  readonly name: string;
  readonly actions: readonly ServerActionCommand[];
}

export interface DataGridPaging {
  readonly page: number;
  readonly pageCount: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly pageSizes: readonly number[];
  readonly moreActions: readonly { readonly id: string; readonly label: string }[];
  readonly moreMenu?: { readonly x: number; readonly y: number };
}

export interface DataGridContext extends LitComponentContext {
  readonly paging?: DataGridPaging;
  onPageAction(action: "__SM_FULLBACK" | "__SM_BACK" | "__SM_FORWARD" | "__SM_FULLFORWARD"): void;
  onPageSize(size: number): void;
  onOpenPagingMenu(event: MouseEvent): void;
  onDismissPagingMenu(): void;
  onPagingMenuAction(actionId: string): void;
  readonly sortedCollection: readonly VmObject[];
  readonly selectedRowId?: string;
  readonly multiSelect: boolean;
  readonly sort?: {
    readonly column: string;
    readonly direction: "ascending" | "descending";
  };
  readonly columnWidths: ReadonlyMap<number, number>;
  readonly rowMenu?: {
    readonly rowVMClassId: string;
    readonly label: string;
    readonly x: number;
    readonly y: number;
  };
  readonly rowMenuGroups: readonly DataGridActionGroup[];
  renderCell(control: ViewMetaControl, row: VmObject): TemplateResult | typeof nothing;
  onSort(column: string): void;
  onBeginResize(event: PointerEvent, columnIndex: number): void;
  onMoveResize(event: PointerEvent): void;
  onEndResize(): void;
  onResizeByKeyboard(event: KeyboardEvent, columnIndex: number): void;
  onSelectRow(row: VmObject): void;
  onOpenRowMenu(event: MouseEvent, row: VmObject): void;
  onDoubleClickRow(event: MouseEvent, row: VmObject): void;
  onToggleSelection(row: VmObject, selected: boolean): void;
  onDismissRowMenu(): void;
  onExecuteRowAction(action: ServerActionCommand, rowVMClassId: string, event: MouseEvent): void;
}
