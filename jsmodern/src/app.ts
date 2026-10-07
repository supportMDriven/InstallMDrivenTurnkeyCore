import { HubConnection, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { LitElement, css, html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import {
  ServerUpdateCommand,
  ServerActionCommand,
  ServerActionRemoveCommand,
  ModalCodeCloseCommand,
  NavigateCommand,
  TurnkeyTransport,
  ViewState,
  NULL_EXTERNAL_ID,
  VmAttributeValue,
  VmObject,
  VmValue
} from "../core";
import { parseViewRoute, viewRouteHash, ViewRoute } from "./router";
import { GlobalMenuDescription, GlobalMenuItem, parseGlobalMenu } from "./global-menu";
import { parseViewDescription, ViewDescription, ViewMetaControl } from "./view-meta";
import { LitComponentContext } from "./components/control-context";
import { formatNumber } from "./components/standard/formatting";
import { renderButton } from "./components/standard/tk-button";
import { renderCheckbox } from "./components/standard/tk-checkbox";
import { renderDatePicker } from "./components/standard/tk-datepicker";
import { renderSelect } from "./components/standard/tk-select";
import { renderTextArea } from "./components/standard/tk-textarea";
import { renderTextField } from "./components/standard/tk-textfield";
import { renderTypographyControl } from "./components/standard/tk-typography";
import { renderFileUpload } from "./components/standard/tk-file-upload";
import { renderImageUpload } from "./components/standard/tk-image-upload";
import { DataGridContext } from "./components/standard/tk-data-grid/context";
import { dataGridStyles, renderDataGrid } from "./components/standard/tk-data-grid";
import {
  LeftSideMenuContext,
  LeftSideMenuGroup
} from "./components/standard/left-side-menu/context";
import {
  leftSideMenuStyles,
  renderLeftSideMenu as renderStandardLeftSideMenu
} from "./components/standard/left-side-menu";
import { ToolbarAction, ToolbarContext, ToolbarEntry } from "./components/standard/toolbar/context";
import { renderToolbar as renderStandardToolbar, toolbarStyles } from "./components/standard/toolbar";
import {
  renderRuntimeComponent,
  resolveRuntimeComponent,
  resolveRuntimeOverride,
  runtimeComponentName
} from "./components/runtime-component";

type RuntimeComponentStatus =
  | { readonly state: "loading"; readonly fileUrl: string }
  | { readonly state: "loaded"; readonly fileUrl: string }
  | { readonly state: "absent"; readonly fileUrl: string }
  | { readonly state: "failed"; readonly fileUrl: string; readonly error: string };

interface AppInfo {
  InstanceId?: number;
  SuggestCallbackInSecs?: number;
  IsDirty?: boolean;
  LostContext?: boolean;
  ServerStatus?: string;
  WindowHeader?: string;
  GlobalActionEorVName?: string[] | null;
  GlobalActionEorVEnable?: boolean[] | null;
  GlobalActionEorVVisible?: boolean[] | null;
}

interface RowContextMenu {
  readonly rowVMClassId: string;
  readonly collectionOwnerId: string;
  readonly collectionName: string;
  readonly isListView?: boolean;
  readonly x: number;
  readonly y: number;
}

interface GridSort {
  readonly column: string;
  readonly direction: "ascending" | "descending";
}

interface UploadState {
  readonly fileName: string;
  readonly progress: number;
  readonly uploading: boolean;
  readonly error?: string;
}

interface LeftActionGroup {
  readonly className: string;
  readonly name: string;
  readonly target?: VmObject;
  readonly actions: readonly ServerActionCommand[];
}

interface ViewSessionSnapshot {
  readonly route: ViewRoute;
  readonly viewReady: boolean;
  readonly viewState?: ViewState;
  readonly viewDescription?: ViewDescription;
  readonly appInfo?: AppInfo;
  readonly viewActions: ServerActionCommand[];
  readonly selectedRows: Map<string, string>;
  readonly gridSorts: Map<string, GridSort>;
  readonly gridColumnWidths: Map<string, number>;
  readonly statusMessage: string;
  readonly errorMessage: string;
  readonly pendingUpdates: Map<string, ReturnType<ViewState["setAttribute"]>>;
  readonly stateUnsubscribe?: () => void;
  readonly activeModal?: ActiveModal;
}

type CachedViewSession = Omit<ViewSessionSnapshot, "stateUnsubscribe" | "activeModal">;

interface CachedViewSessionEntry {
  readonly session: CachedViewSession;
  lastUsedAt: number;
}

interface ActiveModal {
  readonly action: ServerActionCommand;
  readonly actionContextId: string;
  readonly parent: ViewSessionSnapshot;
  readonly modalVMId: string;
  readonly popupPosition?: { readonly x: number; readonly y: number };
}

function isServerActionCommand(command: ServerUpdateCommand): command is ServerActionCommand {
  return command.CType === "ServerUpdateCommand_Action"
    && typeof command.VMClassName === "string"
    && typeof command.Action === "string"
    && typeof command.Enable === "boolean"
    && typeof command.Presentation === "string"
    && typeof command.SortKey === "string"
    && typeof command.ActionRenderPosition === "string";
}

function isServerActionRemoveCommand(command: ServerUpdateCommand): command is ServerActionRemoveCommand {
  return command.CType === "ServerUpdateCommand_ActionRemove"
    && typeof command.VMClassName === "string"
    && typeof command.Action === "string"
    && typeof command.ActionRenderPosition === "string";
}

function isNavigateCommand(command: ServerUpdateCommand): command is NavigateCommand {
  return command.CType === "ServerUpdateCommand_Navigate"
    && typeof command.TargetIsInAppAndAngular === "boolean"
    && typeof command.View === "string"
    && typeof command.Id === "string"
    && typeof command.IsModal === "boolean"
    && typeof command.IsPopUp === "boolean"
    && typeof command.NewTab === "boolean";
}

function mergeClassNames(...values: string[]): string {
  return [...new Set(values.flatMap(value => value.split(/\s+/).filter(Boolean)))].join(" ");
}

@customElement("turnkey-lit-app")
class TurnkeyLitApp extends LitElement {
  static styles = [css`
    :host { box-sizing: border-box; display: flex; flex-direction: column; height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
    header { flex: 0 0 auto; position: relative; z-index: 50; }
    header[hidden] { display: none; }
    nav { align-items: center; background: #fff; border-bottom: 1px solid #dce1e5; display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0.6rem 1rem; }
    header nav { background: transparent; border: 0; flex: 1; min-width: 0; padding: 0; }
    header nav ul { margin: 0; padding: 0; }
    header .navbar__item.dropdown { position: relative; }
    :where(header button.navbar__link, header button.dropdown__link) { background: transparent; border: 0; cursor: pointer; font-family: inherit; text-align: left; }
    header .navbar__link { width: auto; }
    header .dropdown__menu { z-index: 60; }
    header .navbar__toggle { border: 0; padding: 0; }
    header .caret { border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 4px solid currentColor; display: inline-block; height: 0; vertical-align: middle; width: 0; }
    .login-section { align-items: center; display: flex; margin-left: auto; }
    .login-section form { margin: 0; }
    .login-section ul.navbar__list, .login-section ul { align-items: center; display: flex !important; flex-direction: row !important; gap: 0.25rem; list-style: none; margin: 0; padding: 0; width: auto; }
    .login-section li.navbar__item, .login-section li { display: block; float: none; margin: 0; padding: 0; }
    .login-section a { align-items: center; border-radius: 0.25rem; display: inline-flex; gap: 0.3rem; padding: 0.45rem 0.65rem; text-decoration: none; }
    .login-section a:hover { background: #ffffff22; }
    nav summary:hover, nav button:hover { background: #edf1f4; }
    main { box-sizing: border-box; display: flex; flex: 1 1 auto; flex-direction: column; margin: 0; min-height: 0; overflow: hidden; padding: 0; width: 100%; }
    .workspace-toolbar { align-items: center; display: flex; margin-bottom: 0.5rem; }
    .workspace-toolbar .action-toggle { background: white; border: 1px solid #c7d0d7; border-radius: 0.3rem; color: #263746; font-size: 1.25rem; line-height: 1; padding: 0.4rem 0.55rem; }
    .workspace-toolbar .action-toggle:hover, .workspace-toolbar .action-toggle:focus-visible { background: #edf1f4; }
    .workspace-shell { flex: 1 1 auto; min-height: 0; position: relative; }
    .view-workspace { align-items: stretch; display: grid; gap: 0; grid-template-columns: 230px minmax(0, 1fr); height: 100%; min-height: 0; }
    .view-workspace.actions-closed { grid-template-columns: minmax(0, 1fr); }
    .view-content { box-sizing: border-box; min-height: 0; min-width: 0; overflow: auto; padding: 15px; }
    .view-dialog .view-content, .popup-panel .view-content { padding: 0; }
    .view-dialog .view-workspace { grid-template-columns: minmax(0, 1fr); }
    dialog.view-dialog { border: 0; border-radius: 0.5rem; box-shadow: 0 1rem 3rem #0005; max-height: min(90vh, 60rem); max-width: min(90vw, 75rem); overflow: auto; padding: 1.25rem; width: min(75rem, calc(100vw - 2rem)); }
    dialog.view-dialog::backdrop { background: #15232d33; }
    dialog.confirm-dialog { border: 0; border-radius: 0.5rem; box-shadow: 0 1rem 3rem #0005; padding: 1.25rem; }
    dialog.confirm-dialog::backdrop { background: #15232d55; }
    dialog.view-dialog .view-canvas { margin: 0; }
    .popup-backdrop { background: transparent; inset: 0; position: fixed; z-index: 1000; }
    .popup-panel { background: white; border: 1px solid #c7d0d7; border-radius: 0.35rem; box-shadow: 0 0.35rem 1.25rem #0003; box-sizing: border-box; left: var(--popup-x); margin: 0; max-height: min(90vh, 60rem); max-width: min(90vw, 34rem); overflow: auto; padding: 1rem; position: fixed; top: var(--popup-y); width: min(34rem, calc(100vw - 2rem)); }
    .popup-panel .view-workspace { grid-template-columns: minmax(0, 1fr); }
    .popup-panel .view-canvas { margin: 0; }
    .modal-actions { background: white; border-top: 1px solid #dce1e5; display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; padding-top: 1rem; }
    .view-dialog > .modal-actions { position: static; }
    .modal-actions button { border: 1px solid #c7d0d7; border-radius: 0.3rem; padding: 0.45rem 0.85rem; }
    .modal-actions button[type="submit"] { background: #263746; border-color: #263746; color: white; }
    .modal-actions button:disabled { cursor: default; opacity: 0.55; }
    .status { background: white; border-radius: 0.4rem; margin-bottom: 1rem; padding: 0.8rem 1rem; }
    .status[hidden] { display: none; }
    .tk-snackbar[popover] { background: transparent; border: 0; color: inherit; inset: auto 0 0 0; margin: 8px; max-width: none; overflow: visible; padding: 0; pointer-events: none; width: auto; }
    .tk-snackbar__label .mi { margin-right: 0.5rem; vertical-align: middle; }
    .error { border-left: 0.25rem solid #b3261e; color: #8c1d18; }
    .notice { color: #52616b; }
    section.view-canvas { background: transparent; border-radius: 0; margin: 0; overflow: visible; }
    section h2 { background: #edf1f4; font-size: 1rem; margin: 0; padding: 0.8rem 1rem; }
    .view-canvas { gap: 1rem; min-width: 0; }
    .tk-input-field { padding-top: 0; }
    .view-canvas.CSSGridRendering { gap: 0; }
    .view-canvas.CSSGridRendering > .tk-data-table { contain: inline-size; }
    .view-content > .view-canvas:has(> .tk-data-table) { box-sizing: border-box; height: 100%; margin: 0; }
    .view-content:has(> .view-canvas.FlexboxRendering) { display: flex; flex-direction: column; overflow: hidden; }
    .view-content > .view-canvas.FlexboxRendering { box-sizing: border-box; display: flex; flex: 1 1 0; flex-direction: column; min-height: 0; overflow: auto; margin: 0; }
    .view-canvas.FlexboxRendering > .tk-placingcontainer { flex: 1 1 auto; min-height: 0; }
    .view-canvas > .tk-data-table { display: flex; flex-direction: column; min-height: 0; }
    .view-canvas .tk-data-table > .tk-data-table__content { flex: 1 1 auto; height: 0; min-height: 0; overflow: auto; }
    .view-canvas .tk-data-table:has(> .tk-data-table__content--min-height) { min-height: calc(var(--advanced-table-min-height, 250px) + 46px) !important; }
    .view-canvas .tk-data-table > .tk-data-table__content--min-height { min-height: var(--advanced-table-min-height, 250px); }
    .view-loading { align-content: center; box-sizing: border-box; color: #52616b; min-height: 12rem; padding: 2rem; text-align: center; }
    .view-control { min-width: 0; }
    .view-control h1, .view-control h2, .view-control h3, .view-control p { margin: 0; }
    .view-control label, .tk-label { display: block; }
    .view-control input, .view-control select { box-sizing: border-box; font: inherit; padding: 0.45rem; width: 100%; }
    .view-control input[type="checkbox"] { width: auto; }
    .tk-component { min-width: 0; }
    .tk-input-field__container { display: flex; flex-direction: column; gap: 0.25rem; }
    .tk-input-field__native, .tk-select__native, .tk-textarea__native { box-sizing: border-box; font: inherit; padding: 0.45rem; width: 100%; }
    .view-control .tk-checkbox__content { align-items: center; display: inline-flex; gap: 0.5rem; margin: 0; position: relative; }
    .tk-checkbox__inner { align-items: center; display: flex; gap: 0.5rem; }
    .view-control .tk-checkbox__label { display: inline-flex; margin: 0; }
    .tk-label__icon { display: inline-block; margin-inline: 0.25rem; }
    .tk-button__native { align-items: center; display: inline-flex; font: inherit; gap: 0.35rem; }
    .tk-button__text { display: inline-block; }
    .view-control .tk-checkbox__native { height: 1px; margin: 0; max-width: none; opacity: 0; padding: 0; position: absolute; width: 1px; }
    .tk-checkbox__interactive { align-items: center; background: white; border: 1px solid #687780; border-radius: 0.15rem; box-sizing: border-box; display: inline-flex; flex: 0 0 1rem; height: 1rem; justify-content: center; width: 1rem; }
    .tk-checkbox__native:checked + .tk-checkbox__interactive { background: #355b72; border-color: #355b72; }
    .tk-checkbox__native:checked + .tk-checkbox__interactive .tk-checkbox__checkmark { opacity: 1; }
    .tk-checkbox__native:focus-visible + .tk-checkbox__interactive { outline: 2px solid #355b72; outline-offset: 2px; }
    .tk-checkbox__native:disabled + .tk-checkbox__interactive { background: #edf1f4; border-color: #aab4ba; }
    .tk-checkbox__checkmark { height: 0.8rem; opacity: 0; width: 0.8rem; }
    .mi { color: currentColor; direction: ltr; display: inline-block; font-family: "Material Icons"; font-feature-settings: "liga"; font-size: 1.2em; font-style: normal; font-weight: 400; letter-spacing: normal; line-height: 1; text-rendering: optimizeLegibility; text-transform: none; white-space: nowrap; -webkit-font-feature-settings: "liga"; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    .tk-select { position: relative; }
    .tk-select__dropdown-icon { pointer-events: none; }
    .tk-select__native { padding-right: 2rem; }
    .tk-input-field__helper { color: #5d6870; font-size: 0.875rem; }
    .constraints { position: fixed; left: 8px; bottom: 8px; z-index: 80; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .constraints.docked { left: 0; bottom: 0; width: 230px; }
    .constraints.docked .constraints-panel { position: absolute; left: 230px; bottom: 0; width: max-content; }
    .validation-card { display: inline-flex; align-items: center; gap: 8px; padding: 0.5rem 0.8rem; border: 1px solid rgb(224,224,224); border-radius: 4px; color: inherit; background: rgba(var(--error-clr, 179,38,30), .05); cursor: pointer; font-family: inherit; box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14), 0 9px 46px 8px rgba(0,0,0,.12); opacity: .4; transition: opacity .1s linear; text-align: left; }
    .constraints .validation-card { display: inline-flex; flex-direction: row; }
    .validation-card:hover { opacity: 1; }
    .validation-card .material-icons { color: rgb(255,255,255); font-size: 1.25rem; pointer-events: none; }
    .validation-card.error { background: rgb(var(--error-clr, 179,38,30)); color: rgb(var(--text-on-error, 255,255,255)); }
    .validation-card.warning { background: rgb(var(--warning-color, 178,106,0)); color: rgb(var(--text-on-warning, 255,255,255)); }
    .validation-card.info { background: rgb(var(--info-clr, 31,111,178)); color: rgb(var(--text-on-info, 255,255,255)); }
    .docked .validation-card { margin: 8px; padding: 1rem 0.8rem; opacity: 1; box-shadow: none; color: inherit; }
    .docked .validation-card .material-icons { font-size: 2.25rem; }
    .docked .validation-card.error { background: rgba(var(--error-clr, 179,38,30), .05); }
    .docked .validation-card.warning { background: rgba(var(--warning-color, 178,106,0), .05); }
    .docked .validation-card.info { background: rgba(var(--info-clr, 31,111,178), .05); }
    .docked .validation-card.error .material-icons { color: rgb(var(--error-clr, 179,38,30)); }
    .docked .validation-card.warning .material-icons { color: rgb(var(--warning-color, 178,106,0)); }
    .docked .validation-card.info .material-icons { color: rgb(var(--info-clr, 31,111,178)); }
    .validation-card__content { display: inline-flex; flex-direction: column; align-items: flex-start; justify-content: center; }
    .validation-card__title { font-size: 1rem; font-weight: 500; }
    .validation-card__subtitle { font-size: .75rem; font-weight: 400; white-space: nowrap; }
    .constraints-panel { max-width: 400px; max-height: 350px; overflow-y: auto; background: #fff; color: #222; border-radius: 4px; box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14), 0 9px 46px 8px rgba(0,0,0,.12); }
    .constraints-group + .constraints-group { margin-top: 5px; }
    .constraints-title { display: flex; align-items: center; gap: 8px; font-weight: 500; padding: .5rem 1rem; border-radius: 4px 4px 0 0; color: rgb(var(--text-on-custom, 255,255,255)); background: rgb(var(--custom-clr)); }
    .constraints-title .material-icons { font-size: 1.5rem; }
    .constraints-group.error { --custom-clr: var(--error-clr, 179,38,30); --text-on-custom: var(--text-on-error, 255,255,255); }
    .constraints-group.warning { --custom-clr: var(--warning-color, 178,106,0); --text-on-custom: var(--text-on-warning, 255,255,255); }
    .constraints-group.info { --custom-clr: var(--info-clr, 31,111,178); --text-on-custom: var(--text-on-info, 255,255,255); }
    .constraints-message { display: flex; align-items: center; gap: 8px; padding: .5rem 1rem; font-size: .875rem; }
    .constraints-message .material-icons { font-size: .625rem; color: rgb(var(--custom-clr)); }
    .tk-input-field__error { color: #b3261e; font-size: 0.875rem; display: block; }
    .tk-input-field--invalid input, .tk-input-field--invalid textarea, .tk-input-field--invalid select { border-color: #b3261e !important; box-shadow: 0 0 0 1px #b3261e; }
    .tk-input-field__validation-state { color: #a12622; font-size: 0.875rem; }
    .tk-image-upload__interactive.uploading { opacity: 1; }
    .tk-lit-component-loading, .tk-lit-component-missing { border: 1px dashed #9aa7af; border-radius: 0.25rem; padding: 0.75rem; }
    .tk-lit-component-missing { background: #fff5f3; color: #7d211d; }
    table { border-collapse: collapse; width: 100%; }
    .view-control table { table-layout: fixed; }
    th, td { border-bottom: 1px solid #e1e5e8; overflow: hidden; padding: 0.5rem; text-align: left; text-overflow: ellipsis; }
    th { background-clip: padding-box; background-color: white; box-shadow: inset 0 -1px 0 #e1e5e8, inset 0 1px 0 #e1e5e8; position: relative; }
    thead th { background-color: white; }
    .row-selection-cell { padding-left: 0.25rem; padding-right: 0.25rem; text-align: center; text-overflow: clip; }
    .row-selection-cell input { cursor: pointer; margin: 0; max-width: none; padding: 0; width: auto; }
    .grid-sort-button { background: transparent; border: 0; color: inherit; font: inherit; font-weight: 600; padding: 0; text-align: left; width: 100%; }
    .grid-sort-button:hover { text-decoration: underline; }
    .grid-resize-handle { bottom: 0; cursor: col-resize; position: absolute; right: 0; top: 0; touch-action: none; width: 0.5rem; z-index: 1; }
    .tk-data-table__content--advanced .tk-data-table__header-cell .grid-resize-handle {
      bottom: 0;
      display: block;
      position: absolute;
      right: 0;
      top: 0;
      width: 0.5rem;
    }
    .grid-resize-handle:hover, .grid-resize-handle:focus-visible { background: #597b91; outline: 0; }
    tbody tr.current-row { background: #e8f1f8; }
    .tk-list-view__row { min-width: 0; }
    .tk-list-view__row--current { background: #e8f1f8; }
    .row-menu-cell { padding: 0.2rem; white-space: nowrap; width: 1%; }
    .row-menu-trigger { background: transparent; border: 0; border-radius: 0.25rem; padding: 0.25rem 0.5rem; }
    .row-menu-trigger:hover, .row-menu-trigger:focus-visible { background: #edf1f4; }
    .row-context-menu { background: white; border: 1px solid #c7d0d7; border-radius: 0.3rem; box-shadow: 0 0.25rem 0.75rem #0003; min-width: 12rem; padding: 0.25rem; position: fixed; z-index: 10000; }
    .row-context-menu button { background: transparent; border: 0; display: block; padding: 0.45rem 0.7rem; text-align: left; width: 100%; }
    .row-context-menu button:hover:not(:disabled), .row-context-menu button:focus-visible { background: #edf1f4; }
    .row-context-menu button:disabled { color: #818a90; cursor: default; }
    .row-menu-group { border-top: 1px solid #e1e5e8; color: #53616b; font-size: 0.8rem; margin-top: 0.25rem; padding: 0.45rem 0.7rem 0.2rem; }
    dl { display: grid; gap: 0.75rem 1rem; grid-template-columns: minmax(9rem, 0.35fr) 1fr; margin: 0; padding: 1rem; }
    dt { color: #53616b; overflow-wrap: anywhere; }
    dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    input { box-sizing: border-box; font: inherit; padding: 0.4rem; width: 100%; }
    .reference, .collection { color: #52616b; }
    button { cursor: pointer; font: inherit; }
    .action-panel-backdrop { display: none; }
    @media (max-width: 600px) {
      .view-workspace { grid-template-columns: 1fr; }
      dl { grid-template-columns: 1fr; gap: 0.25rem; }
      dd { margin-bottom: 0.6rem; }
    }
    @media (max-width: 760px) {
      .view-workspace { display: grid; grid-template-columns: minmax(0, 1fr); }
      .view-workspace > .view-content { width: 100%; }
      .action-panel-backdrop:not([hidden]) { background: #15232d55; border: 0; display: block; inset: 0; padding: 0; position: fixed; z-index: 19; }
    }
  `, dataGridStyles, leftSideMenuStyles, toolbarStyles];

  @state() private route: ViewRoute = parseViewRoute(window.location.hash);
  @state() private viewReady = false;
  @state() private dataErrors = new Map<string, string[]>();
  @state() private constraintsOpen = false;
  @state() private viewState?: ViewState;
  @state() private viewDescription?: ViewDescription;
  @state() private appInfo?: AppInfo;
  @state() private globalMenu?: GlobalMenuDescription;
  @state() private viewActions: ServerActionCommand[] = [];
  @state() private actionPanelOpen = !window.matchMedia("(max-width: 760px)").matches;
  @state() private mobileViewport = window.matchMedia("(max-width: 760px)").matches;
  @state() private selectedRows = new Map<string, string>();
  @state() private gridSorts = new Map<string, GridSort>();
  @state() private gridColumnWidths = new Map<string, number>();
  @state() private uploadStates = new Map<string, UploadState>();
  @state() private rowContextMenu?: RowContextMenu;
  @state() private seekerMoreMenu?: { x: number; y: number };
  @state() private activeModal?: ActiveModal;
  @state() private statusMessage = "Opening view…";
  @state() private errorMessage = "";
  @state() private runtimeComponentStatuses = new Map<string, RuntimeComponentStatus>();

  private readonly transport = new TurnkeyTransport(new URL("../api/", document.baseURI).toString());
  private connection?: HubConnection;
  private stateUnsubscribe?: () => void;
  private pollTimer?: number;
  private pollController?: AbortController;
  private routeGeneration = 0;
  private pendingUpdates = new Map<string, ReturnType<ViewState["setAttribute"]>>();
  private updateTimer?: number;
  private globalMenuLoad?: Promise<void>;
  private readonly globalActionStatus = new Map<string, { enabled: boolean; visible: boolean }>();
  private readonly executingActions = new Set<string>();
  private readonly cachedViewSessions = new Map<string, CachedViewSessionEntry>();
  private readonly viewDescriptions = new Map<string, ViewDescription>();
  private readonly viewDescriptionRequests = new Map<string, Promise<ViewDescription>>();
  private readonly runtimeComponentRequests = new Map<string, Promise<void>>();
  private readonly runtimeOverrideRequests = new Map<string, Promise<void>>();
  private runtimeOverrideManifestRequest?: Promise<ReadonlySet<string>>;
  private closingModal?: ActiveModal;
  private lastPopupClickPosition = { x: 16, y: 16 };
  private columnResize?: {
    readonly gridKey: string;
    readonly columnIndex: number;
    readonly startX: number;
    readonly startWidth: number;
    readonly columnElement: HTMLTableColElement;
  };
  private readonly actionPanelMedia = window.matchMedia("(max-width: 760px)");
  private readonly handleActionPanelViewportChange = (event: MediaQueryListEvent): void => {
    this.mobileViewport = event.matches;
    if (event.matches) {
      this.actionPanelOpen = false;
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("hashchange", this.handleRouteChange);
    window.addEventListener("beforeunload", this.handleBeforeUnload);
    window.addEventListener("keydown", this.handleSeekerEnter);
    this.actionPanelMedia.addEventListener("change", this.handleActionPanelViewportChange);
    this.globalMenuLoad ??= this.loadGlobalMenu();
    void this.loadLoginSection();
    if (!this.runtimeOverrideRequests.has("LeftSideMenu")) {
      this.runtimeOverrideRequests.set("LeftSideMenu", this.loadRuntimeOverride("LeftSideMenu"));
    }
    if (!this.runtimeOverrideRequests.has("Toolbar")) {
      this.runtimeOverrideRequests.set("Toolbar", this.loadRuntimeOverride("Toolbar"));
    }
    void this.openCurrentRoute();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this.handleRouteChange);
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
    window.removeEventListener("keydown", this.handleSeekerEnter);
    this.actionPanelMedia.removeEventListener("change", this.handleActionPanelViewportChange);
    this.routeGeneration++;
    this.pollController?.abort();
    window.clearTimeout(this.pollTimer);
    window.clearTimeout(this.updateTimer);
    this.stateUnsubscribe?.();
    void this.connection?.stop();
  }

  protected updated(): void {
    this.applyLoginReturnUrl();
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog.view-dialog");
    if (this.activeModal && dialog && !dialog.open) {
      dialog.showModal();
    } else if (!this.activeModal && dialog?.open) {
      dialog.close();
    }
    const descriptions = [this.viewDescription, this.activeModal?.parent.viewDescription];
    for (const description of descriptions) {
      if (description) {
        this.loadRuntimeComponents(description.controls);
      }
    }
  }

  // Enter anywhere (outside grids, text areas and buttons) triggers the seeker's search action.
  private readonly handleSeekerEnter = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      return;
    }
    const origin = event.composedPath()[0];
    if (origin instanceof HTMLElement
      && (origin.closest("table, textarea, button, a, select, dialog") || origin.isContentEditable)) {
      return;
    }
    const button = this.renderRoot.querySelector<HTMLButtonElement>(".seekeraction");
    if (!button || button.disabled || this.activeModal) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    button.focus();
    button.click();
  };

  private readonly handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (this.canPromptForUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };

  private readonly handleRouteChange = (): void => {
    if (this.canPromptForUnsavedChanges()) {
      const newHash = window.location.hash;
      const oldHash = viewRouteHash(this.route.viewName, this.route.objectId);
      if (newHash !== oldHash) {
        void this.guardedRouteChange(newHash, oldHash);
        return;
      }
    }
    this.applyRouteChange();
  };

  private async guardedRouteChange(newHash: string, oldHash: string): Promise<void> {
    let proceed = false;
    try {
      proceed = await this.saveBeforeLeaving();
    } catch (error) {
      this.showError(error);
    }
    if (proceed && window.location.hash === newHash) {
      this.applyRouteChange();
    } else if (!proceed) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${oldHash}`);
    }
  }

  private applyRouteChange(): void {
    this.cacheActiveViewSession();
    this.route = parseViewRoute(window.location.hash);
    void this.openCurrentRoute();
  }

  private async openCurrentRoute(): Promise<void> {
    const generation = ++this.routeGeneration;
    this.pollController?.abort();
    window.clearTimeout(this.pollTimer);
    this.stateUnsubscribe?.();
    this.activeModal = undefined;
    this.rowContextMenu = undefined;
    this.errorMessage = "";
    this.viewReady = false;

    const sessionKey = this.viewSessionKey(this.route.viewName, this.route.objectId);
    const cachedEntry = this.cachedViewSessions.get(sessionKey);
    if (cachedEntry && Date.now() - cachedEntry.lastUsedAt > 8 * 60 * 1000) {
      this.cachedViewSessions.delete(sessionKey);
    }
    if (cachedEntry && this.cachedViewSessions.has(sessionKey) && cachedEntry.session.viewState) {
      cachedEntry.lastUsedAt = Date.now();
      this.restoreCachedViewSession(cachedEntry.session);
      this.stateUnsubscribe = this.viewState?.subscribe(() => this.requestUpdate());
      this.requestUpdate();
      try {
        await this.connectSignalR(generation);
        if (!await this.flushUpdates() || generation !== this.routeGeneration) {
          return;
        }
        await this.poll(generation);
      } catch (error) {
        if (generation === this.routeGeneration && !this.isAbortError(error)) {
          this.viewReady = true;
          this.showError(error);
        }
      }
      return;
    }

    this.viewState = new ViewState(`${this.route.objectId};${this.route.viewName}`);
    this.viewDescription = this.viewDescriptions.get(this.route.viewName);
    this.viewActions = [];
    this.selectedRows = new Map();
    this.gridSorts = new Map();
    this.gridColumnWidths = new Map();
    this.pendingUpdates = new Map();
    this.appInfo = undefined;
    this.statusMessage = `Opening ${this.route.viewName}…`;
    this.requestUpdate();

    try {
      const [vmId, viewDescription] = await Promise.all([
        this.transport.openView(this.viewState.root.vmClassId, false, this.route.userControlParentId),
        this.getViewDescription(this.route.viewName)
      ]);
      if (generation !== this.routeGeneration) {
        return;
      }

      this.viewDescription = viewDescription;
      this.actionPanelOpen = !this.mobileViewport;
      this.viewState.vmId = vmId;
      await this.updateComplete;
      this.stateUnsubscribe = this.viewState.subscribe(() => this.requestUpdate());
      await this.connectSignalR(generation);
      await this.poll(generation);
    } catch (error) {
      if (generation === this.routeGeneration && !this.isAbortError(error)) {
        this.showError(error);
      }
    }
  }

  private viewSessionKey(viewName: string, rootObjectId: string): string {
    return `${viewName};${rootObjectId}`;
  }

  private cacheActiveViewSession(): void {
    if (!this.viewState || this.activeModal) {
      return;
    }
    this.stateUnsubscribe?.();
    this.stateUnsubscribe = undefined;
    this.storeCurrentViewSession();
  }

  private storeCurrentViewSession(): void {
    if (!this.viewState || this.activeModal) {
      return;
    }
    const session = this.captureViewSession();
    const { stateUnsubscribe: _stateUnsubscribe, activeModal: _activeModal, ...cachedSession } = session;
    this.cachedViewSessions.set(
      this.viewSessionKey(session.route.viewName, session.route.objectId),
      { session: cachedSession, lastUsedAt: Date.now() }
    );
    for (const [key, entry] of this.cachedViewSessions) {
      if (Date.now() - entry.lastUsedAt > 8 * 60 * 1000) {
        this.cachedViewSessions.delete(key);
      }
    }
  }

  private restoreCachedViewSession(session: CachedViewSession): void {
    this.viewReady = session.viewReady;
    this.viewState = session.viewState;
    this.viewDescription = session.viewDescription;
    this.appInfo = session.appInfo;
    this.viewActions = session.viewActions;
    this.selectedRows = session.selectedRows;
    this.gridSorts = session.gridSorts;
    this.gridColumnWidths = session.gridColumnWidths;
    this.statusMessage = session.statusMessage;
    this.errorMessage = session.errorMessage;
    this.pendingUpdates = session.pendingUpdates;
  }

  private async getViewDescription(viewName: string): Promise<ViewDescription> {
    const cached = this.viewDescriptions.get(viewName);
    if (cached) {
      return cached;
    }
    const inFlight = this.viewDescriptionRequests.get(viewName);
    if (inFlight) {
      return inFlight;
    }

    const request = this.transport.getViewMeta(viewName)
      .then(xml => {
        const description = parseViewDescription(xml, viewName);
        this.viewDescriptions.set(viewName, description);
        return description;
      })
      .finally(() => {
        this.viewDescriptionRequests.delete(viewName);
      });
    this.viewDescriptionRequests.set(viewName, request);
    return request;
  }

  private async connectSignalR(generation: number): Promise<void> {
    if (!this.connection) {
      this.connection = new HubConnectionBuilder()
        .withUrl(new URL("../ClientPushHub", document.baseURI).toString())
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();
      this.connection.on("pullNowWeGotNews", () => {
        void this.poll(this.routeGeneration);
      });
      this.connection.onreconnected(() => {
        this.updateModelStylesheet();
        void this.poll(this.routeGeneration);
      });
      this.connection.onclose(error => {
        if (error) {
          console.error("Turnkey SignalR connection closed", error);
        }
      });
    }
    if (generation !== this.routeGeneration || this.connection.state !== "Disconnected") {
      return;
    }

    try {
      await this.connection.start();
      if (generation === this.routeGeneration) {
        this.updateModelStylesheet();
      }
    } catch (error) {
      console.error("Turnkey SignalR connection failed; polling will continue", error);
      window.setTimeout(() => {
        if (generation === this.routeGeneration) {
          void this.connectSignalR(generation);
        }
      }, 5000);
    }
  }

  private modelStylesheetUrl(): string {
    const stylesheetUrl = new URL("StylesInModelCss", document.baseURI);
    stylesheetUrl.searchParams.set(
      "unique",
      this.connection?.connectionId ?? "session"
    );
    return stylesheetUrl.toString();
  }

  private updateModelStylesheet(): void {
    const href = this.modelStylesheetUrl();
    let link = document.head.querySelector<HTMLLinkElement>('link[data-lit-model-styles]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.dataset.litModelStyles = "";
      document.head.append(link);
      link.addEventListener("error", () => {
        console.error(`Failed to load model stylesheet "${link?.href ?? href}".`);
      });
    }
    if (link.href !== href) {
      link.href = href;
    }
    this.requestUpdate();
  }

  private async poll(generation: number): Promise<void> {
    const state = this.viewState;
    if (!state || generation !== this.routeGeneration) {
      return;
    }
    this.pollController?.abort();
    const controller = new AbortController();
    this.pollController = controller;

    try {
      const clientId = this.connection?.connectionId ?? "";
      const commands = await this.transport.pollView(state.vmId, state.cursor, clientId, controller.signal);
      if (generation !== this.routeGeneration) {
        return;
      }
      for (const command of commands) {
        if (command.CType === "ServerUpdateCommand_AppInfo") {
          this.appInfo = this.readAppInfo(command);
          this.updateGlobalActionStatus(this.appInfo);
        } else if (isServerActionCommand(command)) {
          this.upsertViewAction(command);
        } else if (command.CType === "ServerUpdateCommand_DataError") {
          this.applyDataError(state.vmId, command as unknown as { Target: string; Message: string });
        } else if (isServerActionRemoveCommand(command)) {
          this.removeViewAction(command);
        }
      }
      state.applyServerCommands(commands);
      this.viewReady = true;
      for (const command of commands) {
        const downloadUrl = (command as { DownloadUrl?: string }).DownloadUrl;
        if (command.CType === "ServerUpdateCommand_ReportReadyForDownload" && downloadUrl) {
          window.open(downloadUrl, "_blank");
        }
      }
      void this.copyClipboardVariable();
      const modalClose = commands.find(
        (command): command is ModalCodeCloseCommand => command.CType === "ServerUpdateCommand_ModalCodeClose"
      );
      if (modalClose && this.activeModal) {
        void this.closeModal(modalClose.IsClosePopup || modalClose.IsCloseWithOk);
        return;
      }
      const navigate = commands.find(isNavigateCommand);
      if (navigate) {
        const inApp = navigate.TargetIsInAppAndAngular && !navigate.IsModal && !navigate.IsPopUp && !navigate.NewTab;
        if (inApp && this.canPromptForUnsavedChanges()) {
          this.pollTimer = undefined;
          void this.navigateAfterSavePrompt(navigate, generation);
          return;
        }
        if (this.handleServerNavigation(navigate)) {
          return;
        }
      }
      if (this.appInfo?.LostContext) {
        this.cachedViewSessions.delete(this.viewSessionKey(state.root.className, state.root.id));
        this.statusMessage = "The Turnkey view context has expired. Reloading…";
        // Guard against a reload loop if the server keeps reporting a lost context.
        const last = Number(sessionStorage.getItem("tk-lost-context-reload") ?? 0);
        if (Date.now() - last > 10000) {
          sessionStorage.setItem("tk-lost-context-reload", String(Date.now()));
          window.location.reload();
        } else {
          this.statusMessage = "The Turnkey view context has expired. Reload to open a new view.";
          this.notify(this.statusMessage, "error", 6000);
          this.notify(this.statusMessage, "error", 6000);
        }
        return;
      }
      this.errorMessage = "";
      this.viewReady = true;
      this.statusMessage = this.appInfo?.ServerStatus || "Connected to Turnkey";
      this.storeCurrentViewSession();
      const delaySeconds = this.appInfo?.SuggestCallbackInSecs;
      const serverDelay = delaySeconds === undefined || delaySeconds < 0 ? 5000 : delaySeconds * 1000;
      const delay = this.connection?.state === "Connected" ? serverDelay : Math.min(serverDelay, 5000);
      this.pollTimer = window.setTimeout(() => void this.poll(generation), Math.max(delay, 1000));
    } catch (error) {
      if (generation === this.routeGeneration && !this.isAbortError(error)) {
        this.reportError(error instanceof Error ? error.message : String(error));
        this.pollTimer = window.setTimeout(() => void this.poll(generation), 5000);
      }
    }
  }

  private queueUpdate(vmClassId: string, attribute: string, value: VmValue): void {
    if (!this.viewState) {
      return;
    }
    try {
      const instanceId = this.appInfo?.InstanceId ?? -1;
      const command = this.viewState.setAttribute(vmClassId, attribute, value, instanceId);
      this.pendingUpdates.set(`${vmClassId}:${attribute}`, command);
      window.clearTimeout(this.updateTimer);
      this.updateTimer = window.setTimeout(() => void this.flushUpdates(), 250);
    } catch (error) {
      this.showError(error);
    }
  }

  private async flushUpdates(): Promise<boolean> {
    if (this.pendingUpdates.size === 0) {
      return true;
    }
    const commands = [...this.pendingUpdates.values()];
    this.pendingUpdates.clear();
    try {
      await this.transport.sendUpdates(commands);
      await this.poll(this.routeGeneration);
      return true;
    } catch (error) {
      for (const command of commands) {
        this.pendingUpdates.set(`${command.VMClassId}:${command.Attribute}`, command);
      }
      this.showError(error);
      window.clearTimeout(this.updateTimer);
      this.updateTimer = window.setTimeout(() => void this.flushUpdates(), 5000);
      return false;
    }
  }

  private confirmAction(action: ServerActionCommand | undefined): Promise<boolean> {
    const question = action?.AreYouSureQuestion;
    if (!action || typeof question !== "string" || question.trim() === "") {
      return Promise.resolve(true);
    }
    return this.showConfirmDialog(
      question,
      action.AreYouSureExecuteVerb?.trim() || "Ok",
      action.AreYouSureCancelVerb?.trim() || "Cancel"
    );
  }

  private canPromptForUnsavedChanges(): boolean {
    return this.appInfo?.IsDirty === true && !this.route.userControlParentId;
  }

  // Asks to save pending changes; resolves true when navigation may continue.
  private async saveBeforeLeaving(): Promise<boolean> {
    if (!await this.flushUpdates()) {
      return false;
    }
    if (!this.canPromptForUnsavedChanges()) {
      return true;
    }
    if (!await this.showConfirmDialog("You have unsaved changes.", "Save and continue", "Cancel")) {
      return false;
    }
    await this.executeViewAction("GLOBAL", "Save");
    for (let attempt = 0; attempt < 25 && this.appInfo?.IsDirty === true; attempt++) {
      await new Promise(resolve => window.setTimeout(resolve, 200));
    }
    return this.appInfo?.IsDirty !== true;
  }

  private async navigateAfterSavePrompt(command: NavigateCommand, generation: number): Promise<void> {
    try {
      if (await this.saveBeforeLeaving()) {
        this.handleServerNavigation(command);
        return;
      }
    } catch (error) {
      this.showError(error);
    }
    if (generation === this.routeGeneration && this.pollTimer === undefined) {
      this.pollTimer = window.setTimeout(() => void this.poll(generation), 1000);
    }
  }

  private showConfirmDialog(question: string, okText: string, cancelText: string): Promise<boolean> {
    return new Promise(resolve => {
      const dialog = document.createElement("dialog");
      dialog.className = "confirm-dialog";
      dialog.setAttribute("aria-label", "Confirm");
      const text = document.createElement("p");
      text.textContent = question;
      text.style.margin = "0";
      const buttons = document.createElement("div");
      buttons.className = "modal-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = cancelText;
      const ok = document.createElement("button");
      ok.type = "submit";
      ok.textContent = okText;
      buttons.append(cancel, ok);
      dialog.append(text, buttons);
      dialog.style.width = "min(28rem, calc(100vw - 2rem))";
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        if (dialog.open) {
          dialog.close();
        }
        dialog.remove();
        resolve(result);
      };
      cancel.addEventListener("click", () => finish(false));
      ok.addEventListener("click", () => finish(true));
      dialog.addEventListener("close", () => finish(false));
      this.renderRoot.append(dialog);
      dialog.showModal();
      ok.focus();
    });
  }

  // Temporary snackbar like the Angular and Blazor clients; one at a time, autohides after 2 seconds.
  private notificationElement?: HTMLElement;
  private notificationTimer?: number;

  private notify(message: string, icon?: string, durationMs = 2000): void {
    window.clearTimeout(this.notificationTimer);
    this.notificationElement?.remove();
    const element = document.createElement("div");
    element.setAttribute("popover", "manual");
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    element.className = "tk-snackbar tk-snackbar--centered tk-snackbar--open";
    const surface = document.createElement("div");
    surface.className = "tk-snackbar__surface";
    const label = document.createElement("div");
    label.className = "tk-snackbar__label";
    if (icon) {
      const glyph = document.createElement("span");
      glyph.className = "mi";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = icon;
      label.append(glyph);
    }
    label.append(document.createTextNode(message));
    surface.append(label);
    element.append(surface);
    this.renderRoot.append(element);
    this.notificationElement = element;
    try {
      (element as HTMLElement & { showPopover?: () => void }).showPopover?.();
    } catch {
      // Popover API unavailable; the fixed positioning still shows the notification.
    }
    this.notificationTimer = window.setTimeout(() => {
      element.remove();
      if (this.notificationElement === element) {
        this.notificationElement = undefined;
      }
    }, durationMs);
  }

  private async notifyAfterAction(vmClassName: string, actionName: string): Promise<void> {
    if (vmClassName !== "GLOBAL" || this.errorMessage) {
      return;
    }
    if (actionName === "Save" || actionName === "**EXTRASAVEANDKEEPOPEN") {
      for (let attempt = 0; attempt < 25 && this.appInfo?.IsDirty === true; attempt++) {
        await new Promise(resolve => window.setTimeout(resolve, 200));
      }
      if (this.appInfo?.IsDirty !== true && !this.errorMessage) {
        this.notify("Changes saved", "save");
      }
    } else if (actionName === "Undo") {
      this.notify("Changes undone", "undo");
    } else if (actionName === "Redo") {
      this.notify("Changes redone", "redo");
    }
  }

  private async executeViewAction(vmClassName: string, actionName: string, event?: MouseEvent): Promise<void> {
    const state = this.viewState;
    if (!state || this.executingActions.has(`${vmClassName}:${actionName}`)) {
      return;
    }
    const confirmable = this.viewActions.find(candidate =>
      candidate.VMClassName === vmClassName && candidate.Action === actionName
    );
    if (!await this.confirmAction(confirmable)) {
      return;
    }
    const clickPosition = event && (event.clientX > 0 || event.clientY > 0)
      ? { x: event.clientX, y: event.clientY }
      : this.lastPopupClickPosition;

    const actionKey = `${vmClassName}:${actionName}`;
    const generation = this.routeGeneration;
    this.executingActions.add(actionKey);
    this.requestUpdate();
    try {
      window.clearTimeout(this.updateTimer);
      const updatesSent = await this.flushUpdates();
      if (!updatesSent || generation !== this.routeGeneration) {
        return;
      }
      const action = this.viewActions.find(candidate =>
        candidate.VMClassName === vmClassName && candidate.Action === actionName
      );
      if (action?.IsModal || action?.IsPopUp) {
        await this.openModalForAction(
          action,
          this.currentActionContextId(vmClassName),
          action.IsPopUp ? clickPosition : undefined
        );
        return;
      }
      await this.transport.executeAction({
        VMId: state.vmId,
        VMClassName: vmClassName,
        Action: actionName,
        ClientIdForNavigationVerification: this.connection?.connectionId ?? ""
      });
      await this.poll(generation);
      void this.notifyAfterAction(vmClassName, actionName);
    } catch (error) {
      this.showError(error);
    } finally {
      this.executingActions.delete(actionKey);
      this.requestUpdate();
    }
  }

  private async executeSeekerMoreAction(actionId: string): Promise<void> {
    const state = this.viewState;
    if (!state) {
      return;
    }
    const generation = this.routeGeneration;
    try {
      window.clearTimeout(this.updateTimer);
      if (!await this.flushUpdates() || generation !== this.routeGeneration) {
        return;
      }
      if (actionId === "export") {
        await this.transport.exportAsTabSeparated(state.vmId);
        this.notify("Export file ordered", "attach_file");
      } else if (actionId === "import") {
        await this.transport.importFromText(state.vmId, await navigator.clipboard.readText());
        this.notify("Import in progress", "content_copy");
      }
      await this.poll(generation);
    } catch (error) {
      this.showError(error);
    }
  }

  private async copyClipboardVariable(): Promise<void> {
    const state = this.viewState;
    const variables = state && state.getReference(state.root.attributes.VM_Variables);
    const text = variables?.attributes.vClipbookData;
    if (!variables || typeof text !== "string" || text === "") {
      return;
    }
    this.queueUpdate(variables.vmClassId, "vClipbookData", "");
    try {
      await navigator.clipboard.writeText(text);
      this.notify("Added to clipboard", "content_copy");
    } catch (error) {
      this.showError(error);
    }
  }

  private async executeRowAction(
    action: ServerActionCommand,
    rowVMClassId: string,
    event?: MouseEvent
  ): Promise<void> {
    const state = this.viewState;
    const row = state?.getObject(rowVMClassId);
    if (!state || !row || !action.Enable) {
      return;
    }
    if (!await this.confirmAction(action)) {
      return;
    }
    const clickPosition = event && (event.clientX > 0 || event.clientY > 0)
      ? { x: event.clientX, y: event.clientY }
      : this.lastPopupClickPosition;

    const actionKey = `${action.VMClassName}:${action.Action}:${rowVMClassId}`;
    if (this.executingActions.has(actionKey)) {
      return;
    }
    const generation = this.routeGeneration;
    this.executingActions.add(actionKey);
    this.requestUpdate();
    try {
      window.clearTimeout(this.updateTimer);
      const updatesSent = await this.flushUpdates();
      if (!updatesSent || generation !== this.routeGeneration) {
        return;
      }
      if (action.IsModal || action.IsPopUp) {
        await this.openModalForAction(action, row.id, action.IsPopUp ? clickPosition : undefined);
        return;
      }
      await this.transport.executeRowAction({
        VMId: state.vmId,
        VMClassId: rowVMClassId,
        Action: action.Action,
        ClientIdForNavigationVerification: this.connection?.connectionId ?? ""
      });
      await this.poll(generation);
    } catch (error) {
      this.showError(error);
    } finally {
      this.executingActions.delete(actionKey);
      this.requestUpdate();
    }
  }

  private currentActionContextId(vmClassName: string): string {
    const state = this.viewState;
    const variables = state?.getReference(state.root.attributes.VM_Variables);
    const currentExternalId = variables?.attributes[`vCurrent_${vmClassName}_AsExternalId`];
    if (typeof currentExternalId === "string" && currentExternalId !== "") {
      return currentExternalId;
    }
    return state?.getCurrentObject(vmClassName)?.id ?? state?.root.id ?? "$null$";
  }

  private captureViewSession(): ViewSessionSnapshot {
    return {
      route: this.route,
      viewReady: this.viewReady,
      viewState: this.viewState,
      viewDescription: this.viewDescription,
      appInfo: this.appInfo,
      viewActions: this.viewActions,
      selectedRows: this.selectedRows,
      gridSorts: this.gridSorts,
      gridColumnWidths: this.gridColumnWidths,
      statusMessage: this.statusMessage,
      errorMessage: this.errorMessage,
      pendingUpdates: this.pendingUpdates,
      stateUnsubscribe: this.stateUnsubscribe,
      activeModal: this.activeModal
    };
  }

  private restoreViewSession(session: ViewSessionSnapshot): void {
    this.route = session.route;
    this.viewReady = session.viewReady;
    this.viewState = session.viewState;
    this.viewDescription = session.viewDescription;
    this.appInfo = session.appInfo;
    this.viewActions = session.viewActions;
    this.selectedRows = session.selectedRows;
    this.gridSorts = session.gridSorts;
    this.gridColumnWidths = session.gridColumnWidths;
    this.statusMessage = session.statusMessage;
    this.errorMessage = session.errorMessage;
    this.pendingUpdates = session.pendingUpdates;
    this.stateUnsubscribe = session.stateUnsubscribe;
    this.activeModal = session.activeModal;
  }

  private async openModalForAction(
    action: ServerActionCommand,
    actionContextId: string,
    popupPosition?: { readonly x: number; readonly y: number }
  ): Promise<void> {
    const parentState = this.viewState;
    if (!parentState || !action.View) {
      throw new Error(`Turnkey modal action ${action.Action} has no destination view`);
    }

    const generation = this.routeGeneration;
    const parent = this.captureViewSession();
    this.pollController?.abort();
    this.pollController = undefined;
    window.clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
    this.stateUnsubscribe = undefined;
    this.statusMessage = `Opening ${action.View}…`;
    this.errorMessage = "";
    this.requestUpdate();

    try {
      const modalRootId = await this.transport.openModal(
        parentState.root.vmClassId,
        actionContextId,
        action.VMClassName,
        action.Action
      );
      if (generation !== this.routeGeneration) {
        return;
      }

      const modalRoute = parseViewRoute(viewRouteHash(action.View, modalRootId));
      const modalRootVMClassId = `${modalRootId};${action.View}`;
      const [modalVMId, viewDescription] = await Promise.all([
        this.transport.openView(modalRootVMClassId, false),
        this.getViewDescription(action.View)
      ]);
      if (generation !== this.routeGeneration) {
        return;
      }

      this.route = modalRoute;
      this.viewReady = false;
      this.viewState = new ViewState(modalRootVMClassId, modalVMId);
      this.viewDescription = viewDescription;
      this.viewActions = [];
      this.selectedRows = new Map();
      this.gridSorts = new Map();
      this.gridColumnWidths = new Map();
      this.rowContextMenu = undefined;
      this.appInfo = undefined;
      this.pendingUpdates = new Map();
      this.statusMessage = `Opening ${action.View}…`;
      this.stateUnsubscribe = this.viewState.subscribe(() => this.requestUpdate());
      this.activeModal = { action, actionContextId, parent, modalVMId, popupPosition };
      await this.updateComplete;
      await this.connectSignalR(generation);
      await this.poll(generation);
    } catch (error) {
      if (generation === this.routeGeneration) {
        this.restoreViewSession(parent);
        this.showError(error);
        await this.poll(generation);
      }
    }
  }

  private async closeModal(closedWithOk: boolean): Promise<void> {
    const modal = this.activeModal;
    if (!modal || this.closingModal === modal) {
      return;
    }
    if (!closedWithOk && !modal.action.IsPopUp && this.appInfo?.IsDirty
      && !window.confirm("Are you sure you want to cancel changes?")) {
      return;
    }

    this.closingModal = modal;
    const generation = this.routeGeneration;
    try {
      window.clearTimeout(this.updateTimer);
      const updatesSent = await this.flushUpdates();
      if (!updatesSent || generation !== this.routeGeneration || this.activeModal !== modal) {
        return;
      }

      const parentState = modal.parent.viewState;
      if (!parentState) {
        throw new Error("Cannot close modal because its parent Turnkey view state is missing");
      }
      await this.transport.closeModal(
        parentState.vmId,
        closedWithOk,
        modal.action.Action,
        modal.modalVMId,
        modal.actionContextId
      );
      if (generation !== this.routeGeneration || this.activeModal !== modal) {
        return;
      }
      this.pollController?.abort();
      this.pollController = undefined;
      window.clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
      this.stateUnsubscribe?.();
      this.restoreViewSession(modal.parent);
      await this.poll(generation);
    } catch (error) {
      this.showError(error);
    } finally {
      if (this.closingModal === modal) {
        this.closingModal = undefined;
      }
    }
  }

  private handleServerNavigation(command: NavigateCommand): boolean {
    const clientId = this.connection?.connectionId ?? "";
    const targetClientId = command.ClientIdForNavigationVerification;
    if (targetClientId && targetClientId !== clientId && targetClientId !== "AccessDenied") {
      return false;
    }

    if (command.TargetIsInAppAndAngular && !command.IsModal && !command.IsPopUp) {
      const destination = `${window.location.pathname}${viewRouteHash(command.View, command.Id)}`;
      if (command.NewTab) {
        window.open(destination, "_blank", "noopener");
      } else {
        window.location.hash = viewRouteHash(command.View, command.Id);
      }
      return true;
    }

    if (command.Url) {
      if (command.NewTab || command.IsModal || command.IsPopUp) {
        window.open(command.Url, "_blank", "noopener");
      } else {
        window.location.assign(command.Url);
      }
      return true;
    }

    if (command.IsModal || command.IsPopUp) {
      throw new Error(`Turnkey requested unsupported ${command.IsModal ? "modal" : "popup"} navigation`);
    }
    throw new TypeError("Turnkey navigation command has no URL for this client");
  }

  private readAppInfo(command: ServerUpdateCommand): AppInfo {
    const instanceId = command.InstanceId;
    const suggestedDelay = command.SuggestCallbackInSecs;
    const lostContext = command.LostContext;
    if (typeof instanceId !== "number" || typeof suggestedDelay !== "number" || typeof lostContext !== "boolean") {
      throw new TypeError("Turnkey AppInfo command is missing required session fields");
    }
    return {
      InstanceId: instanceId,
      SuggestCallbackInSecs: suggestedDelay,
      IsDirty: typeof command.IsDirty === "boolean" ? command.IsDirty : undefined,
      LostContext: lostContext,
      ServerStatus: typeof command.ServerStatus === "string" ? command.ServerStatus : undefined,
      WindowHeader: typeof command.WindowHeader === "string" ? command.WindowHeader : undefined,
      GlobalActionEorVName: this.readOptionalStringArray(command.GlobalActionEorVName),
      GlobalActionEorVEnable: this.readOptionalBooleanArray(command.GlobalActionEorVEnable),
      GlobalActionEorVVisible: this.readOptionalBooleanArray(command.GlobalActionEorVVisible)
    };
  }

  private readOptionalStringArray(value: unknown): string[] | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
      throw new TypeError("Turnkey AppInfo contains an invalid global action name list");
    }
    return value;
  }

  private readOptionalBooleanArray(value: unknown): boolean[] | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Array.isArray(value)) {
      throw new TypeError("Turnkey AppInfo contains an invalid global action state list");
    }
    if (value.every(item => typeof item === "boolean")) {
      return value;
    }
    if (value.every(item => item === 0 || item === 1)) {
      return value.map(item => item === 1);
    }
    throw new TypeError("Turnkey AppInfo contains an invalid global action state list");
  }

  private updateGlobalActionStatus(info: AppInfo): void {
    const names = info.GlobalActionEorVName;
    const enabled = info.GlobalActionEorVEnable;
    const visible = info.GlobalActionEorVVisible;
    if (names === null || names === undefined || names.length === 0) {
      return;
    }
    if (!enabled || !visible || enabled.length !== names.length || visible.length !== names.length) {
      throw new TypeError("Turnkey AppInfo global action state arrays have different lengths");
    }
    names.forEach((name, index) => {
      this.globalActionStatus.set(name, { enabled: enabled[index], visible: visible[index] });
    });
  }

  private applyDataError(vmId: string, command: { Target: string; Message: string }): void {
    const messages = (command.Message ?? "").split("\n").filter(message => message !== "");
    const next = new Map(this.dataErrors);
    const key = `${vmId}:${command.Target}`;
    if (messages.length > 0) {
      next.set(key, messages);
    } else {
      next.delete(key);
    }
    this.dataErrors = next;
  }

  private upsertViewAction(command: ServerActionCommand): void {
    this.viewActions = [
      ...this.viewActions.filter(action => action.VMClassName !== command.VMClassName
        || action.Action !== command.Action
        || action.ActionRenderPosition !== command.ActionRenderPosition),
      command
    ];
  }

  private removeViewAction(command: ServerActionRemoveCommand): void {
    this.viewActions = this.viewActions.filter(action => action.VMClassName !== command.VMClassName
      || action.Action !== command.Action
      || action.ActionRenderPosition !== command.ActionRenderPosition);
  }

  private rowActions(className: string): ServerActionCommand[] {
    const rowMenuPositions = new Set(["ContextMenu", "LeftSide", "ToolBarLeft"]);
    return this.viewActions
      .filter(action => action.VMClassName === className && rowMenuPositions.has(action.ActionRenderPosition))
      .sort((left, right) => left.SortKey.localeCompare(right.SortKey));
  }

  private leftActionGroups(): LeftActionGroup[] {
    const state = this.viewState;
    if (!state) {
      return [];
    }

    const groupedActions = new Map<string, ServerActionCommand[]>();
    for (const action of this.viewActions) {
      if (action.ActionRenderPosition !== "LeftSide") {
        continue;
      }
      const group = groupedActions.get(action.VMClassName) ?? [];
      group.push(action);
      groupedActions.set(action.VMClassName, group);
    }

    const groups: LeftActionGroup[] = [];
    for (const [className, actions] of groupedActions) {
      const target = className === "GLOBAL"
        ? undefined
        : className === state.root.className
          ? state.root
          : state.getCurrentObject(className);
      if (className !== "GLOBAL" && !target) {
        continue;
      }
      groups.push({
        className,
        name: actions[0]?.GroupHeader || (className === "GLOBAL" ? "Application" : className),
        target,
        actions: actions.sort((left, right) => left.SortKey.localeCompare(right.SortKey))
      });
    }
    return groups.sort((left, right) => Number(right.className === "GLOBAL") - Number(left.className === "GLOBAL"));
  }

  private renderLeftActions(): TemplateResult | typeof nothing {
    const actionGroups = this.leftActionGroups();
    if (actionGroups.length === 0 || this.viewDescription?.hideSidebar === true) {
      return nothing;
    }

    const groups: LeftSideMenuGroup[] = actionGroups.map(group => {
      const subgroups = new Map<string, ServerActionCommand[]>();
      for (const action of group.actions) {
        const subgroupName = action.SubMenuGroup ?? "";
        const subgroup = subgroups.get(subgroupName) ?? [];
        subgroup.push(action);
        subgroups.set(subgroupName, subgroup);
      }
      return {
        className: group.className,
        name: group.name,
        targetVMClassId: group.target?.vmClassId,
        subgroups: [...subgroups].map(([name, actions]) => ({
          name,
          actions: actions.map(command => {
            const actionKey = group.target
              ? `${command.VMClassName}:${command.Action}:${group.target.vmClassId}`
              : `${command.VMClassName}:${command.Action}`;
            return {
              command,
              disabled: !command.Enable || this.executingActions.has(actionKey)
            };
          })
        }))
      };
    });
    const context: LeftSideMenuContext = {
      groups,
      open: this.actionPanelOpen,
      mobileViewport: this.mobileViewport,
      onAction: (action, targetVMClassId, event) => {
        if (this.mobileViewport) {
          this.actionPanelOpen = false;
        }
        if (targetVMClassId && targetVMClassId !== this.viewState?.root.vmClassId) {
          void this.executeRowAction(action, targetVMClassId, event);
        } else {
          void this.executeViewAction(action.VMClassName, action.Action, event);
        }
      }
    };
    const reference = resolveRuntimeOverride("LeftSideMenu", document.baseURI);
    const status = this.runtimeComponentStatuses.get(this.runtimeStatusKey(reference));
    if (status?.state === "loaded") {
      return html`${renderRuntimeComponent(reference, context)}`;
    }
    if (status?.state === "failed") {
      return this.renderMissingComponent("LeftSideMenu", status.fileUrl, status.error);
    }
    return renderStandardLeftSideMenu(context);
  }

  private toolbarEntries(position: "ToolBarLeft" | "ToolBarRight"): ToolbarEntry[] {
    const state = this.viewState;
    if (!state) {
      return [];
    }
    const subgroups = new Map<string, ToolbarAction[]>();
    const sortKeys = new Map<string, string>();
    const actions = this.viewActions
      .filter(action => action.ActionRenderPosition === position
        || (position === "ToolBarLeft" && action.ActionRenderPosition === "LeftSide"))
      .sort((left, right) => left.SortKey.localeCompare(right.SortKey));
    for (const command of actions) {
      const target = command.VMClassName === "GLOBAL"
        ? undefined
        : command.VMClassName === state.root.className
          ? state.root
          : state.getCurrentObject(command.VMClassName);
      if (command.VMClassName !== "GLOBAL" && !target) {
        continue;
      }
      const name = position === "ToolBarRight" ? "" : command.SubMenuGroup ?? "";
      const actionKey = target
        ? `${command.VMClassName}:${command.Action}:${target.vmClassId}`
        : `${command.VMClassName}:${command.Action}`;
      const group = subgroups.get(name) ?? [];
      group.push({
        command,
        disabled: !command.Enable || this.executingActions.has(actionKey),
        targetVMClassId: target?.vmClassId
      });
      subgroups.set(name, group);
      if (!sortKeys.has(name)) {
        sortKeys.set(name, command.SubMenuGroupSortKey ?? name);
      }
    }
    return [...subgroups]
      .sort(([left], [right]) => (sortKeys.get(left) ?? left).localeCompare(sortKeys.get(right) ?? right))
      .map(([name, groupActions]) => ({ name, actions: groupActions }));
  }

  private renderToolbar(): TemplateResult | typeof nothing {
    const usesToolbar = this.viewActions.some(action => action.ActionRenderPosition === "ToolBarLeft"
      || action.ActionRenderPosition === "ToolBarRight");
    if (!usesToolbar) {
      return nothing;
    }
    const left = this.toolbarEntries("ToolBarLeft");
    const right = this.toolbarEntries("ToolBarRight");
    if (left.length === 0 && right.length === 0) {
      return nothing;
    }
    const context: ToolbarContext = {
      left,
      right,
      onAction: (action, event) => {
        if (action.targetVMClassId && action.targetVMClassId !== this.viewState?.root.vmClassId) {
          void this.executeRowAction(action.command, action.targetVMClassId, event);
        } else {
          void this.executeViewAction(action.command.VMClassName, action.command.Action, event);
        }
      }
    };
    const reference = resolveRuntimeOverride("Toolbar", document.baseURI);
    const status = this.runtimeComponentStatuses.get(this.runtimeStatusKey(reference));
    if (status?.state === "loaded") {
      return html`${renderRuntimeComponent(reference, context)}`;
    }
    if (status?.state === "failed") {
      return this.renderMissingComponent("Toolbar", status.fileUrl, status.error);
    }
    return renderStandardToolbar(context);
  }

  private selectCollectionRow(row: VmObject, ownerId: string, collectionName: string): void {
    const collection = this.viewState?.getCollection(ownerId, collectionName) ?? [];
    for (const item of collection) {
      if (item.vmClassId !== row.vmClassId && item.attributes.vCurrent === true) {
        this.viewState?.setAttributeLocally(item.vmClassId, "vCurrent", false);
      }
    }
    const selectedRows = new Map(this.selectedRows);
    selectedRows.set(`${ownerId}:${collectionName}`, row.vmClassId);
    this.selectedRows = selectedRows;
    this.queueUpdate(row.vmClassId, "vCurrent", true);
  }

  private findListViewBinding(control: ViewMetaControl): {
    readonly rootClassName: string;
    readonly collectionName: string;
  } | undefined {
    const rootClassName = control.attributes.PlacingContainerListViewRootVMClass;
    const collectionName = control.attributes.PlacingContainerListViewRootVMColumn;
    if (rootClassName && collectionName) {
      return { rootClassName, collectionName };
    }
    for (const child of control.layoutChildren) {
      const binding = this.findListViewBinding(child);
      if (binding) {
        return binding;
      }
    }
    return undefined;
  }

  private renderListView(
    control: ViewMetaControl,
    wrapperClass: string,
    wrapperStyle: string
  ): TemplateResult {
    const binding = this.findListViewBinding(control);
    if (!binding) {
      return html`<div class="tk-list-view-error" role="alert">
        List view "${control.wrapperClass}" has no collection binding metadata.
      </div>`;
    }
    const owner = this.viewState?.getCurrentObject(binding.rootClassName);
    const collection = owner
      ? this.viewState?.getCollection(owner.vmClassId, binding.collectionName) ?? []
      : [];
    const collectionKey = owner ? `${owner.vmClassId}:${binding.collectionName}` : "";
    const selectedRowId = this.selectedRows.get(collectionKey);
    return html`<div class="tk-list-view ${wrapperClass}" style=${wrapperStyle || nothing}>
      ${repeat(collection, item => item.vmClassId, item => html`
        <div class=${selectedRowId === item.vmClassId || (!selectedRowId && item.attributes.vCurrent === true)
          ? "tk-list-view__row tk-list-view__row--current"
          : "tk-list-view__row"}
          @click=${() => owner && this.selectCollectionRow(item, owner.vmClassId, binding.collectionName)}
          @contextmenu=${(event: MouseEvent) => owner && this.openRowContextMenu(
            event,
            item,
            owner.vmClassId,
            binding.collectionName,
            true
          )}
          @dblclick=${(event: MouseEvent) => owner && this.handleRowDoubleClick(
            event,
            item,
            owner.vmClassId,
            binding.collectionName,
            true
          )}>
          ${control.layoutChildren.map(child => this.renderMetaControl(
            child,
            item,
            false,
            owner
              ? () => this.selectCollectionRow(item, owner.vmClassId, binding.collectionName)
              : undefined
          ))}
        </div>
      `)}
      ${collection.length === 0 ? html`<p>No rows</p>` : nothing}
      ${this.renderGenericRowContextMenu()}
    </div>`;
  }

  private toggleGridSort(gridKey: string, column: string): void {
    const current = this.gridSorts.get(gridKey);
    const direction = current?.column === column && current.direction === "ascending"
      ? "descending"
      : "ascending";
    const next = new Map(this.gridSorts);
    next.set(gridKey, { column, direction });
    this.gridSorts = next;
  }

  private sortGridRows(rows: readonly VmObject[], sort: GridSort | undefined): readonly VmObject[] {
    if (!sort) {
      return rows;
    }
    const direction = sort.direction === "ascending" ? 1 : -1;
    const valueFor = (row: VmObject): string | number | boolean | null => {
      const value = row.attributes[sort.column];
      if (value === null || value === undefined) {
        return null;
      }
      if (value instanceof Date) {
        return value.getTime();
      }
      if (typeof value === "object") {
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        const reference = this.viewState?.getReference(value);
        const presentation = reference?.attributes.Presentation ?? reference?.attributes.Name;
        const referenceId = "id" in value ? value.id : "";
        return typeof presentation === "string" ? presentation : reference?.id ?? referenceId;
      }
      return value;
    };
    return rows
      .map((row, index) => ({ row, index, value: valueFor(row) }))
      .sort((left, right) => {
        if (left.value === null) return right.value === null ? left.index - right.index : 1;
        if (right.value === null) return -1;
        let comparison: number;
        if (typeof left.value === "number" && typeof right.value === "number") {
          comparison = left.value - right.value;
        } else if (typeof left.value === "boolean" && typeof right.value === "boolean") {
          comparison = Number(left.value) - Number(right.value);
        } else {
          comparison = String(left.value).localeCompare(String(right.value), undefined, {
            numeric: true,
            sensitivity: "base"
          });
        }
        return comparison === 0 ? left.index - right.index : comparison * direction;
      })
      .map(item => item.row);
  }

  private beginGridColumnResize(event: PointerEvent, gridKey: string, columnIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const table = handle instanceof HTMLElement ? handle.closest("table") : null;
    const columnElement = table?.querySelector<HTMLTableColElement>(`col[data-column-index="${columnIndex}"]`);
    if (!handle || !(handle instanceof HTMLElement) || !columnElement) {
      return;
    }
    this.columnResize = {
      gridKey,
      columnIndex,
      startX: event.clientX,
      startWidth: columnElement.getBoundingClientRect().width,
      columnElement
    };
    handle.setPointerCapture(event.pointerId);
  }

  private moveGridColumnResize(event: PointerEvent): void {
    if (!this.columnResize) {
      return;
    }
    const width = Math.max(48, this.columnResize.startWidth + event.clientX - this.columnResize.startX);
    this.columnResize.columnElement.style.width = `${width}px`;
  }

  private endGridColumnResize(): void {
    if (!this.columnResize) {
      return;
    }
    const { gridKey, columnIndex, columnElement } = this.columnResize;
    const widths = new Map(this.gridColumnWidths);
    widths.set(`${gridKey}:${columnIndex}`, columnElement.getBoundingClientRect().width);
    this.gridColumnWidths = widths;
    this.columnResize = undefined;
  }

  private resizeGridColumnByKeyboard(event: KeyboardEvent, gridKey: string, columnIndex: number): void {
    const delta = event.key === "ArrowLeft" ? -12 : event.key === "ArrowRight" ? 12 : 0;
    if (delta === 0 || !(event.currentTarget instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    const table = event.currentTarget.closest("table");
    const columnElement = table?.querySelector<HTMLTableColElement>(`col[data-column-index="${columnIndex}"]`);
    if (!columnElement) {
      return;
    }
    const currentWidth = this.gridColumnWidths.get(`${gridKey}:${columnIndex}`)
      ?? columnElement.getBoundingClientRect().width;
    const widths = new Map(this.gridColumnWidths);
    widths.set(`${gridKey}:${columnIndex}`, Math.max(48, currentWidth + delta));
    this.gridColumnWidths = widths;
  }

  private openRowContextMenu(
    event: MouseEvent,
    row: VmObject,
    ownerId: string,
    collectionName: string,
    isListView = false
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectCollectionRow(row, ownerId, collectionName);
    this.rowContextMenu = {
      rowVMClassId: row.vmClassId,
      collectionOwnerId: ownerId,
      collectionName,
      isListView,
      x: Math.max(4, Math.min(event.clientX, window.innerWidth - 220)),
      y: Math.max(4, Math.min(event.clientY, window.innerHeight - 100))
    };
  }

  private handleRowDoubleClick(
    event: MouseEvent,
    row: VmObject,
    ownerId: string,
    collectionName: string,
    isListView = false
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectCollectionRow(row, ownerId, collectionName);
    const action = this.rowActions(row.className).find(candidate =>
      candidate.Enable && typeof candidate.View === "string" && candidate.View.trim() !== ""
    );
    if (action) {
      void this.executeRowAction(action, row.vmClassId);
    } else {
      this.openRowContextMenu(event, row, ownerId, collectionName, isListView);
    }
  }

  private renderGenericRowContextMenu(): TemplateResult | typeof nothing {
    const menu = this.rowContextMenu;
    if (!menu?.isListView) {
      return nothing;
    }
    const row = this.viewState?.getObject(menu.rowVMClassId);
    if (!row) {
      return nothing;
    }
    const groups = new Map<string, ServerActionCommand[]>();
    for (const action of this.rowActions(row.className)) {
      const name = action.SubMenuGroup ?? "";
      const group = groups.get(name) ?? [];
      group.push(action);
      groups.set(name, group);
    }
    const orderedGroups = [...groups.entries()].sort(([leftName, leftActions], [rightName, rightActions]) => {
      const leftKey = leftActions[0]?.SubMenuGroupSortKey ?? leftName;
      const rightKey = rightActions[0]?.SubMenuGroupSortKey ?? rightName;
      return leftKey.localeCompare(rightKey);
    });
    return html`<div class="row-context-menu" role="menu"
      aria-label=${`${row.className} actions`}
      style=${`left:${menu.x}px;top:${menu.y}px`}
      @click=${(event: Event) => event.stopPropagation()}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key === "Escape") {
          this.rowContextMenu = undefined;
        }
      }}>
      ${orderedGroups.length > 0
        ? orderedGroups.map(([groupName, actions]) => html`
            ${groupName ? html`<div class="row-menu-group">${groupName}</div>` : nothing}
            ${actions.map(action => html`
              <button type="button" role="menuitem" ?disabled=${!action.Enable}
                @click=${(event: MouseEvent) => {
                  event.stopPropagation();
                  this.rowContextMenu = undefined;
                  void this.executeRowAction(action, menu.rowVMClassId, event);
                }}>${action.Presentation || action.Action}</button>
            `)}
          `)
        : html`<button type="button" role="menuitem" disabled>No actions available</button>`}
    </div>`;
  }

  private showError(error: unknown): void {
    this.reportError(error instanceof Error ? error.message : String(error));
    console.error("Turnkey Lit client error", error);
  }

  // Errors are shown as notifications; the inline banner is only a fallback while no view is displayed.
  private reportError(message: string): void {
    if (message !== this.errorMessage) {
      this.notify(message, "error", 6000);
    }
    this.errorMessage = message;
  }

  private renderErrorBanner(): TemplateResult | typeof nothing {
    return this.errorMessage && !this.viewReady
      ? html`<div class="status error" role="alert">${this.errorMessage}</div>`
      : nothing;
  }

  private renderMetadataStyles(): TemplateResult {
    const parentStyles = this.activeModal?.parent.viewDescription?.styles ?? "";
    const currentStyles = this.viewDescription?.styles ?? "";
    const sharedStyles = [...document.head.querySelectorAll<HTMLLinkElement>("link[data-lit-shadow-style]")];
    return html`
      ${sharedStyles.map(source => html`<link rel="stylesheet" data-lit-style=${source.href} href=${source.href}
        @error=${() => console.error(`Failed to load shared stylesheet "${source.href}".`)}>`)}
      <link rel="stylesheet" data-lit-model-styles href=${this.modelStylesheetUrl()}
        @error=${() => console.error(`Failed to load model stylesheet "${this.modelStylesheetUrl()}".`)}>
      <style>${parentStyles}\n${currentStyles}</style>
    `;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
  }

  private renderValue(object: VmObject, name: string, value: VmAttributeValue) {
    if (Array.isArray(value)) {
      const items = value
        .map(id => this.viewState?.getObject(id))
        .filter((item): item is VmObject => item !== undefined);
      return html`<span class="collection">${items.map(item => `${item.className} (${item.id})`).join(", ")}</span>`;
    }
    if (value && typeof value === "object" && !(value instanceof Date) && "kind" in value) {
      const target = this.viewState?.getReference(value);
      return html`<span class="reference">${target ? `${target.className} (${target.id})` : value.id}</span>`;
    }
    if (value instanceof Date) {
      return html`<input type="datetime-local" .value=${this.dateInputValue(value)}
        @change=${(event: Event) => {
          const input = event.currentTarget as HTMLInputElement;
          this.queueUpdate(object.vmClassId, name, input.value ? new Date(input.value) : null);
        }}>`;
    }
    if (typeof value === "boolean") {
      return html`<input type="checkbox" .checked=${value}
        @change=${(event: Event) => this.queueUpdate(
          object.vmClassId,
          name,
          (event.currentTarget as HTMLInputElement).checked
        )}>`;
    }
    if (typeof value === "string" || typeof value === "number" || value === null) {
      const numeric = typeof value === "number";
      return html`<input type=${numeric ? "number" : "text"} .value=${value === null ? "" : String(value)}
        @change=${(event: Event) => {
          const text = (event.currentTarget as HTMLInputElement).value;
          this.queueUpdate(object.vmClassId, name, numeric && text !== "" ? Number(text) : text || null);
        }}>`;
    }
    return nothing;
  }

  private loadRuntimeComponents(controls: readonly ViewMetaControl[]): void {
    for (const control of controls) {
      if (control.tagName.startsWith("tk-") && control.tagName !== "tk-layout-container"
        && !this.runtimeOverrideRequests.has(control.tagName)) {
        const request = this.loadRuntimeOverride(control.tagName);
        this.runtimeOverrideRequests.set(control.tagName, request);
      }
      const name = runtimeComponentName(control);
      if (name && !this.runtimeComponentRequests.has(name)) {
        const request = this.loadRuntimeComponent(name);
        this.runtimeComponentRequests.set(name, request);
      }
      this.loadRuntimeComponents(control.columns);
      this.loadRuntimeComponents(control.layoutChildren);
    }
  }

  private async loadRuntimeComponent(name: string): Promise<void> {
    let fileUrl = `components/custom/${name}/index.js`;
    try {
      const reference = resolveRuntimeComponent(name, document.baseURI);
      fileUrl = reference.fileUrl;
      this.setRuntimeComponentStatus(this.runtimeStatusKey(reference), { state: "loading", fileUrl });
      await import(/* webpackIgnore: true */ reference.fileUrl);
      if (!customElements.get(reference.elementName)) {
        throw new Error(`The module did not register custom element <${reference.elementName}>.`);
      }
      this.setRuntimeComponentStatus(this.runtimeStatusKey(reference), { state: "loaded", fileUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setRuntimeComponentStatus(`custom:${name}`, { state: "failed", fileUrl, error: message });
      console.error(`Failed to load Lit component "${name}" from ${fileUrl}`, error);
    }
  }

  private async loadRuntimeOverride(tagName: string): Promise<void> {
    let reference;
    try {
      reference = resolveRuntimeOverride(tagName, document.baseURI);
      this.setRuntimeComponentStatus(this.runtimeStatusKey(reference), {
        state: "loading",
        fileUrl: reference.fileUrl
      });
      const overrides = await this.loadRuntimeOverrideManifest();
      if (!overrides.has(tagName)) {
        this.setRuntimeComponentStatus(this.runtimeStatusKey(reference), {
          state: "absent",
          fileUrl: reference.fileUrl
        });
        return;
      }

      await import(/* webpackIgnore: true */ reference.fileUrl);
      if (!customElements.get(reference.elementName)) {
        throw new Error(`The module did not register custom element <${reference.elementName}>.`);
      }
      this.setRuntimeComponentStatus(this.runtimeStatusKey(reference), {
        state: "loaded",
        fileUrl: reference.fileUrl
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const overrideName = tagName === "LeftSideMenu" ? "left-side-menu" : tagName === "Toolbar" ? "toolbar" : tagName;
      const fileUrl = reference?.fileUrl ?? `components/overrides/${overrideName}/index.js`;
      this.setRuntimeComponentStatus(
        reference ? this.runtimeStatusKey(reference) : `override:${tagName}`,
        {
        state: "failed",
        fileUrl,
        error: message
        }
      );
      console.error(`Failed to load Lit override for "${tagName}" from ${fileUrl}`, error);
    }
  }

  private loadRuntimeOverrideManifest(): Promise<ReadonlySet<string>> {
    if (!this.runtimeOverrideManifestRequest) {
      const manifestUrl = new URL("components/overrides/manifest.json", document.baseURI);
      this.runtimeOverrideManifestRequest = fetch(manifestUrl, { cache: "no-store" })
        .then(async response => {
          if (!response.ok) {
            throw new Error(`Override manifest request failed (${response.status} ${response.statusText}).`);
          }
          const manifest: unknown = await response.json();
          if (!manifest || typeof manifest !== "object" || !("overrides" in manifest)
            || !Array.isArray(manifest.overrides)
            || !manifest.overrides.every(
              (tag): tag is string => typeof tag === "string"
                && (tag === "LeftSideMenu" || tag === "Toolbar" || /^tk-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))
            )) {
            throw new TypeError("Override manifest must contain an overrides array of valid tk-* control tags, LeftSideMenu or Toolbar.");
          }
          return new Set(manifest.overrides);
        });
    }
    return this.runtimeOverrideManifestRequest;
  }

  private runtimeStatusKey(reference: { readonly kind: "custom" | "override"; readonly name: string }): string {
    return `${reference.kind}:${reference.name}`;
  }

  private setRuntimeComponentStatus(name: string, status: RuntimeComponentStatus): void {
    const statuses = new Map(this.runtimeComponentStatuses);
    statuses.set(name, status);
    this.runtimeComponentStatuses = statuses;
  }

  private renderRequestedComponent(
    control: ViewMetaControl,
    name: string,
    context: LitComponentContext
  ): TemplateResult {
    let reference;
    try {
      reference = resolveRuntimeComponent(name, document.baseURI);
    } catch (error) {
      return this.renderMissingComponent(name, `components/custom/${name}/index.js`, String(error));
    }

    const status = this.runtimeComponentStatuses.get(this.runtimeStatusKey(reference));
    const commonClass = `tk-component tk-lit-component ${control.wrapperClass} ${context.style}`;
    if (status?.state === "loaded") {
      return html`<div class=${commonClass} style=${this.componentWrapperStyle(control.wrapperStyle, context.minSize)}>
        ${renderRuntimeComponent(reference, context)}
      </div>`;
    }
    if (status?.state === "failed") {
      return this.renderMissingComponent(name, status.fileUrl, status.error, commonClass, control.wrapperStyle);
    }
    if (status?.state === "absent") {
      return this.renderMissingComponent(name, status.fileUrl, "Component file was not found.", commonClass, control.wrapperStyle);
    }
    return html`<div class="${commonClass} tk-lit-component-loading" style=${control.wrapperStyle || nothing}
      role="status">Loading Lit component "${name}"…</div>`;
  }

  private renderStandardOverride(
    control: ViewMetaControl,
    context: LitComponentContext
  ): TemplateResult | undefined {
    let reference;
    try {
      reference = resolveRuntimeOverride(control.tagName, document.baseURI);
    } catch {
      return undefined;
    }
    const status = this.runtimeComponentStatuses.get(this.runtimeStatusKey(reference));
    if (status?.state === "absent") {
      return undefined;
    }
    if (status?.state === "failed") {
      return this.renderMissingComponent(control.tagName, status.fileUrl, status.error);
    }
    if (status?.state !== "loaded") {
      return undefined;
    }
    return html`<div class="tk-component tk-lit-component ${control.wrapperClass} ${context.style}"
      style=${this.componentWrapperStyle(control.wrapperStyle, context.minSize)}>
      ${renderRuntimeComponent(reference, context)}
    </div>`;
  }

  private renderMissingComponent(
    name: string,
    fileUrl: string,
    error: string,
    className = "tk-component tk-lit-component tk-lit-component-missing",
    style?: string
  ): TemplateResult {
    return html`<div class="${className} tk-lit-component-missing" style=${style || nothing} role="alert">
      <strong>Lit component "${name}" is unavailable.</strong>
      <div>Expected file: <code>${fileUrl}</code></div>
      <div>${error}</div>
    </div>`;
  }

  private cellStyleFor(control: ViewMetaControl, row: VmObject): string {
    if (control.tagName === "tk-layout-container") {
      return "";
    }
    const attributes = control.attributes;
    const column = attributes.BindInfoColumn;
    const statusObject = this.viewState?.getReference(this.viewState.root.attributes.VM_Status);
    const prefix = attributes.id?.replace(/\./g, "_") || (column ? `${row.className}_${column}` : undefined);
    const dataBound = (column && row.attributes[`${column}_Style`])
      || (prefix ? statusObject?.attributes[`${prefix}_Style`] : undefined);
    return typeof dataBound === "string" && dataBound.trim() !== "" ? dataBound : attributes.StaticStyle ?? "";
  }

  private renderMetaControl(
    control: ViewMetaControl,
    row?: VmObject,
    isGridCell = false,
    beforeAction?: () => void
  ): TemplateResult | typeof nothing {
    if (control.tagName === "tk-layout-container") {
      const ownerClassName = control.attributes.PlacingContainerOwnerVMClass;
      const owner = ownerClassName && row?.className === ownerClassName
        ? row
        : ownerClassName
          ? this.viewState?.getCurrentObject(ownerClassName)
          : row;
      const visibleColumn = control.attributes.PCVisibleColumn;
      if (visibleColumn && owner?.attributes[visibleColumn] === false) {
        return nothing;
      }
      const styleColumn = control.attributes.PCStyleColumn;
      const dynamicStyle = styleColumn ? owner?.attributes[styleColumn] : undefined;
      const wrapperClass = mergeClassNames(
        control.wrapperClass,
        typeof dynamicStyle === "string" ? dynamicStyle : ""
      );
      if (control.attributes.IsListView?.toLowerCase() === "true") {
        return this.renderListView(control, wrapperClass, control.wrapperStyle);
      }
      return html`
        <div class=${wrapperClass} style=${control.wrapperStyle || nothing}>
          ${control.layoutChildren.map(child => this.renderMetaControl(child, row, isGridCell, beforeAction))}
        </div>
      `;
    }

    const attributes = control.attributes;
    const nesting = attributes.BindInfoNesting ?? this.route.viewName;
    const column = attributes.BindInfoColumn;
    const stringFormat = control.taggedValues.StringFormat ?? "";
    const staticLabel = attributes.StaticLabel ?? attributes.label ?? "";
    const typeName = (attributes.TypeCSharp ?? "").split(".").pop() ?? "";
    const target = row ?? this.viewState?.getCurrentObject(nesting);
    const value = column ? target?.attributes[column] : undefined;
    const statusObject = this.viewState?.getReference(this.viewState.root.attributes.VM_Status);
    const statusPrefix = attributes.id?.replace(/\./g, "_");
    const readCompanion = (suffix: string): VmAttributeValue | undefined => {
      const objectValue = column && target?.attributes[`${column}${suffix}`];
      if (objectValue !== undefined) {
        return objectValue;
      }
      const prefix = statusPrefix || (target && column ? `${target.className}_${column}` : undefined);
      return prefix ? statusObject?.attributes[`${prefix}${suffix}`] : undefined;
    };
    const visibleValue = readCompanion("_Visible");
    const enabledValue = readCompanion("_Enabled");
    const readOnlyValue = readCompanion("_ReadOnly");
    // Angular binds ng-show to the value, so null (not yet evaluated or false) hides the control too.
    const visible = visibleValue === undefined || Boolean(visibleValue);
    const enabled = enabledValue !== false;
    const readOnly = readOnlyValue === true || !enabled;
    const dataBoundStyle = readCompanion("_Style");
    const dataBoundLabel = readCompanion("_Label");
    const dataBoundPlaceholder = readCompanion("_Placeholder");
    const helperTextValue = readCompanion("_HelperText");
    const label = typeof dataBoundLabel === "string" && dataBoundLabel !== ""
      ? dataBoundLabel
      : staticLabel;
    const style = typeof dataBoundStyle === "string" && dataBoundStyle.trim() !== ""
      ? dataBoundStyle
      : attributes.StaticStyle ?? "";
    const placeholder = (typeof dataBoundPlaceholder === "string" && dataBoundPlaceholder !== ""
      ? dataBoundPlaceholder
      : undefined)
      ?? control.taggedValues.Placeholder
      ?? attributes.placeholder
      ?? "";
    const helperText = typeof helperTextValue === "string" ? helperTextValue : "";
    if (!visible) {
      return nothing;
    }
    const writable = target !== undefined && column !== undefined && enabled && !readOnly
      && Object.prototype.hasOwnProperty.call(target.attributes, column)
      && attributes.StaticStyle?.toLowerCase() !== "readonly"
      && attributes.readonly === undefined
      && attributes.disabled !== "true";
    const targetClass = target?.className;
    const targetId = target?.vmClassId;
    const inputType = control.tagName === "tk-datepicker"
      ? (control.taggedValues.ShowTime?.toLowerCase() === "true" ? "datetime-local" : "date")
      : typeName === "Boolean" || typeName === "bool"
        ? "checkbox"
        : attributes.type ?? (typeName.match(/^(Byte|Int16|Int32|Int64|Decimal|Double)$/) ? "number" : "text");
    const requestedComponent = runtimeComponentName(control);
    const collection = control.tagName === "tk-select"
      ? (() => {
          const pickListName = attributes.BindInfoPicklist;
          const pickListOwner = this.viewState?.getCurrentObject(nesting);
          return pickListName && pickListOwner
            ? this.viewState?.getCollection(pickListOwner.vmClassId, pickListName) ?? []
            : [];
        })()
      : control.tagName === "tk-data-grid" && column && targetId
      ? this.viewState?.getCollection(targetId, column) ?? []
      : Array.isArray(value)
      ? value.map(id => this.viewState?.getObject(id)).filter((item): item is VmObject => item !== undefined)
      : undefined;
    const actionName = attributes.AbstractAction || column;
    const stringValue = value === null || value === undefined
      ? ""
      : value instanceof Date
        ? this.dateInputValue(value).slice(0, inputType === "date" ? 10 : undefined)
        : typeof value === "number" && stringFormat
          ? formatNumber(value, stringFormat)
          : typeof value === "object"
            ? this.viewState?.getReference(value)?.id ?? ""
            : String(value);
    const externalIdAttribute = column ? `${column}_AsExternalId` : undefined;
    const externalIdValue = externalIdAttribute ? target?.attributes[externalIdAttribute] : undefined;
    const selectedId = value && typeof value === "object" && !(value instanceof Date) && "kind" in value
      ? this.viewState?.getReference(value)?.id ?? ""
      : typeof value === "string"
        ? value
        : "";
    const selectedExternalId = typeof externalIdValue === "string"
      ? externalIdValue
      : selectedId;
    const actionKey = targetClass && actionName ? `${targetClass}:${actionName}` : "";
    const minWidth = (this.viewDescription?.vmColWidth ?? 0) * this.spanSize(attributes.ColSpan);
    const minHeight = (this.viewDescription?.vmColHeight ?? 0) * this.spanSize(attributes.RowSpan);
    const context: LitComponentContext = {
      componentName: requestedComponent ?? control.tagName,
      metadata: control,
      id: attributes.id,
      object: target,
      value,
      collection,
      displayValue: stringValue,
      inputType,
      selectedExternalId,
      actionExecuting: actionKey !== "" && this.executingActions.has(actionKey),
      label,
      placeholder,
      helperText,
      errors: attributes.id ? this.dataErrors.get(`${this.viewState?.vmId ?? ""}:${attributes.id}`) ?? [] : [],
      style: isGridCell ? "" : style,
      visible,
      enabled: enabled && !readOnly && attributes.disabled !== "true"
        && attributes.StaticStyle?.toLowerCase() !== "readonly",
      readOnly: readOnly || !enabled || attributes.readonly !== undefined
        || attributes.disabled === "true" || attributes.StaticStyle?.toLowerCase() === "readonly",
      isGridCell,
      upload: this.uploadStates.get(`${this.viewState?.vmId ?? ""}:${targetId ?? ""}:${attributes.id ?? ""}`),
      minSize: { width: minWidth, height: minHeight },
      onChange: newValue => {
        if (writable && targetId && column) {
          const attribute = control.tagName === "tk-select" ? `${column}_AsExternalId` : column;
          this.queueUpdate(targetId, attribute, newValue);
        }
      },
      uploadFile: file => this.uploadBoundFile(file, control, target, column, writable),
      executeAction: (action = actionName, event) => {
        if (action && targetClass) {
          beforeAction?.();
          void this.executeViewAction(targetClass, action, event);
        }
      },
      onError: error => this.showError(error)
    };
    const override = this.renderStandardOverride(control, context);
    if (override) {
      return override;
    }
    if (requestedComponent) {
      return this.renderRequestedComponent(control, requestedComponent, context);
    }
    if (control.tagName === "tk-data-grid") {
      const gridCollection = collection ?? [];
      const collectionKey = targetId && column ? `${targetId}:${column}` : "";
      const multiSelect = control.taggedValues.MultiSelect?.toLowerCase() === "true";
      const selectedRowId = this.selectedRows.get(collectionKey);
      const menuMatchesCollection = this.rowContextMenu?.collectionOwnerId === targetId
        && this.rowContextMenu?.collectionName === column;
      const gridSort = this.gridSorts.get(collectionKey);
      const menu = menuMatchesCollection ? this.rowContextMenu : undefined;
      const menuRow = menu ? this.viewState?.getObject(menu.rowVMClassId) : undefined;
      const menuActions = menuRow ? this.rowActions(menuRow.className) : [];
      const menuGroups = new Map<string, ServerActionCommand[]>();
      for (const menuAction of menuActions) {
        const groupName = menuAction.SubMenuGroup ?? "";
        const group = menuGroups.get(groupName) ?? [];
        group.push(menuAction);
        menuGroups.set(groupName, group);
      }
      const rowMenuGroups = [...menuGroups.entries()]
        .sort(([leftName, leftActions], [rightName, rightActions]) => {
          const leftKey = leftActions[0]?.SubMenuGroupSortKey ?? leftName;
          const rightKey = rightActions[0]?.SubMenuGroupSortKey ?? rightName;
          return leftKey.localeCompare(rightKey);
        })
        .map(([name, actions]) => ({ name, actions }));
      const visibleColumns = control.columns.filter(item => item.attributes.NotVisible?.toLowerCase() !== "true");
      const seekerVariables = this.viewState?.getReference(this.viewState.root.attributes.VM_Variables);
      const seekerNumber = (name: string): number | undefined => {
        const raw = seekerVariables?.attributes[name];
        const parsed = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
        return Number.isFinite(parsed) ? parsed : undefined;
      };
      const seekerPage = seekerNumber("vSeekerPage");
      const seekerPageCount = seekerNumber("vSeekerPageCount");
      const seekerPageSize = seekerNumber("vSeekerPageLength");
      const seekerTotal = seekerNumber("vSeekerResultCount");
      const isSeekerGrid = control.taggedValues.IsSeekerResultGrid?.toLowerCase() === "true";
      const paging = isSeekerGrid
        && seekerVariables && seekerPage !== undefined && seekerPageCount !== undefined
        ? {
            page: seekerPage,
            pageCount: seekerPageCount,
            pageSize: seekerPageSize ?? 0,
            totalCount: seekerTotal ?? 0,
            pageSizes: [...new Set([50, 100, 200, 500, ...(seekerPageSize && seekerPageSize > 0 ? [seekerPageSize] : [])])]
              .sort((left, right) => left - right),
            moreActions: [
              ...(this.viewDescription?.globalSettings.GlobalSeekerGridShowImport?.toLowerCase() === "true"
                ? [{ id: "import", label: "Import from clipboard" }]
                : []),
              { id: "export", label: "Export to file" }
            ],
            moreMenu: this.seekerMoreMenu
          }
        : undefined;
      const gridContext: DataGridContext = {
        ...context,
        paging,
        noResultsBackdrop: isSeekerGrid && seekerTotal === 0,
        onOpenPagingMenu: event => {
          this.seekerMoreMenu = {
            x: Math.max(4, Math.min(event.clientX, window.innerWidth - 220)),
            y: Math.max(4, Math.min(event.clientY, window.innerHeight - 100))
          };
        },
        onDismissPagingMenu: () => { this.seekerMoreMenu = undefined; },
        onPagingMenuAction: actionId => { void this.executeSeekerMoreAction(actionId); },
        onPageAction: pageAction => { void this.executeViewAction("GLOBAL", pageAction); },
        onPageSize: size => {
          if (seekerVariables) {
            this.queueUpdate(seekerVariables.vmClassId, "vSeekerPageLength", size);
          }
        },
        sortedCollection: this.sortGridRows(gridCollection, gridSort),
        selectedRowId,
        multiSelect,
        sort: gridSort,
        columnWidths: new Map(visibleColumns.map((_, index) => [
          index,
          this.gridColumnWidths.get(`${collectionKey}:${index}`) ?? 0
        ])),
        rowMenu: menu && menuRow ? {
          rowVMClassId: menu.rowVMClassId,
          label: `${menuRow.className} actions`,
          x: menu.x,
          y: menu.y
        } : undefined,
        rowMenuGroups,
        cellStyle: (cellControl, item) => this.cellStyleFor(cellControl, item),
        renderCell: (cellControl, item) => this.renderMetaControl(
          cellControl,
          item,
          true,
          targetId && column
            ? () => this.selectCollectionRow(item, targetId, column)
            : undefined
        ),
        onSort: sortColumn => this.toggleGridSort(collectionKey, sortColumn),
        onBeginResize: (event, index) => this.beginGridColumnResize(event, collectionKey, index),
        onMoveResize: event => this.moveGridColumnResize(event),
        onEndResize: () => this.endGridColumnResize(),
        onResizeByKeyboard: (event, index) => this.resizeGridColumnByKeyboard(event, collectionKey, index),
        onSelectRow: item => {
          if (targetId && column) {
            this.selectCollectionRow(item, targetId, column);
          }
        },
        onOpenRowMenu: (event, item) => {
          if (targetId && column) {
            this.openRowContextMenu(event, item, targetId, column);
          }
        },
        onDoubleClickRow: (event, item) => {
          if (targetId && column) {
            this.handleRowDoubleClick(event, item, targetId, column);
          }
        },
        onToggleSelection: (item, selected) => this.queueUpdate(item.vmClassId, "vSelected", selected),
        onDismissRowMenu: () => { this.rowContextMenu = undefined; },
        onExecuteRowAction: (menuAction, rowVMClassId, event) => {
          void this.executeRowAction(menuAction, rowVMClassId, event);
        }
      };
      return renderDataGrid(gridContext);
    }

    switch (control.tagName) {
      case "tk-button":
        return renderButton(context);
      case "tk-checkbox":
        return renderCheckbox(context);
      case "tk-datepicker":
        return renderDatePicker(context);
      case "tk-file-upload":
        return renderFileUpload(context);
      case "tk-image-upload":
        return renderImageUpload(context);
      case "tk-select":
        return renderSelect(context);
      case "tk-textarea":
        return renderTextArea(context);
      case "tk-textfield":
        return renderTextField(context);
      case "tk-typography":
        return renderTypographyControl(context);
      default:
        return renderTextField(context);
    }
    return nothing;
  }

  private async uploadBoundFile(
    file: File,
    control: ViewMetaControl,
    target: VmObject | undefined,
    column: string | undefined,
    writable: boolean
  ): Promise<void> {
    const state = this.viewState;
    const targetId = control.attributes.id;
    if (!state || !target || !column || !targetId || !writable) {
      throw new Error("This upload control is not bound to an editable Turnkey attribute.");
    }

    const maxSize = Number(control.attributes.maxsize);
    if (Number.isFinite(maxSize) && maxSize > 0 && file.size > maxSize) {
      const message = `${file.name} is larger than ${maxSize} bytes and cannot be uploaded.`;
      this.setUploadState(state.vmId, target.vmClassId, targetId, {
        fileName: file.name,
        progress: 0,
        uploading: false,
        error: message
      });
      throw new Error(message);
    }

    const generation = this.routeGeneration;
    this.setUploadState(state.vmId, target.vmClassId, targetId, {
      fileName: file.name,
      progress: 0,
      uploading: true
    });
    try {
      await this.transport.uploadFile(
        state.vmId,
        targetId,
        target.vmClassId,
        file,
        progress => this.setUploadState(state.vmId, target.vmClassId, targetId, {
          fileName: file.name,
          progress,
          uploading: true
        })
      );
      this.setUploadState(state.vmId, target.vmClassId, targetId, {
        fileName: file.name,
        progress: 100,
        uploading: false
      });
      this.notify(`${file.name} uploaded`, "attach_file");
      if (this.viewState === state && this.routeGeneration === generation) {
        window.clearTimeout(this.pollTimer);
        void this.poll(generation);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setUploadState(state.vmId, target.vmClassId, targetId, {
        fileName: file.name,
        progress: 0,
        uploading: false,
        error: message
      });
      throw error;
    }
  }

  private setUploadState(
    vmId: string,
    vmClassId: string,
    targetId: string,
    uploadState: UploadState
  ): void {
    const uploadStates = new Map(this.uploadStates);
    uploadStates.set(`${vmId}:${vmClassId}:${targetId}`, uploadState);
    this.uploadStates = uploadStates;
  }

  private spanSize(rawValue: string | undefined): number {
    if (rawValue === undefined || rawValue.trim() === "") {
      return 1;
    }
    const span = Number(rawValue);
    return Number.isFinite(span) && span > 0 ? span : 1;
  }

  private componentWrapperStyle(
    wrapperStyle: string,
    minSize: LitComponentContext["minSize"]
  ): string {
    return [
      wrapperStyle,
      minSize.width > 0 ? `min-width:${minSize.width}px` : "",
      minSize.height > 0 ? `min-height:${minSize.height}px` : ""
    ].filter(Boolean).join(";");
  }

  private dateInputValue(value: Date): string {
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  private renderObject(object: VmObject) {
    const entries = Object.entries(object.attributes)
      .filter(([name]) => name !== "VMClassId");
    if (entries.length === 0) {
      return nothing;
    }
    return html`
      <section>
        <h2>${object.className} <span>(${object.id})</span></h2>
        <dl>
          ${entries.map(([name, value]) => html`
            <dt>${name}</dt>
            <dd>${this.renderValue(object, name, value)}</dd>
          `)}
        </dl>
      </section>
    `;
  }

  private renderViewContent(): TemplateResult {
    if (!this.viewReady) {
      return html`<section class="view-loading" role="status" aria-busy="true">
        <h2>${this.route.viewName}</h2>
        <p>Loading view…</p>
      </section>`;
    }
    return this.viewDescription
      ? html`<section class="view-canvas ${this.viewDescription.rootClassName}">
          ${this.viewDescription.controls.map(control => this.renderMetaControl(control))}
        </section>`
      : html`<section><h2>${this.route.viewName}</h2><dl><dt>View metadata</dt><dd>Loading view description…</dd></dl></section>`;
  }

  private renderStatusMessage(): TemplateResult {
    const hidden = /^OK(?:\b|:)/i.test(this.statusMessage.trim());
    return html`<div class="status notice" role="status" ?hidden=${hidden}>${this.statusMessage}</div>`;
  }

  private renderActionToggle(): TemplateResult | typeof nothing {
    if (this.leftActionGroups().length === 0 || this.viewDescription?.hideSidebar) {
      return nothing;
    }
    return html`<button type="button" class="action-toggle navbar__toggle navbar__toggle--sidebar"
      aria-label=${this.actionPanelOpen ? "Hide view actions" : "Show view actions"}
      aria-controls="view-actions-panel" aria-expanded=${this.actionPanelOpen}
      @click=${() => { this.actionPanelOpen = !this.actionPanelOpen; }}>
      <span class="icon-bar"></span><span class="icon-bar"></span><span class="icon-bar"></span>
    </button>`;
  }

  private handleActionPanelKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.mobileViewport && this.actionPanelOpen) {
      this.actionPanelOpen = false;
    }
  }

  private constraintMessages(category: "Errors" | "Warnings" | "Infos"): string[] {
    return this.dataErrors.get(`${this.viewState?.vmId ?? ""}:${category}`) ?? [];
  }

  private renderConstraints(): TemplateResult | typeof nothing {
    const groups = [
      { key: "Errors", css: "error", icon: "error", singular: "Error" },
      { key: "Warnings", css: "warning", icon: "warning", singular: "Warning" },
      { key: "Infos", css: "info", icon: "info", singular: "Info" }
    ] as const;
    const present = groups.map(group => ({ ...group, messages: this.constraintMessages(group.key) }))
      .filter(group => group.messages.length > 0);
    const count = present.reduce((sum, group) => sum + group.messages.length, 0);
    if (count === 0) {
      return nothing;
    }
    const cardClass = present[0].css;
    const docked = this.leftActionGroups().length > 0 && this.viewDescription?.hideSidebar !== true && !this.mobileViewport;
    return html`
      <div class="constraints ${docked ? 'docked' : ''}">
        ${this.constraintsOpen ? html`<div class="constraints-panel" role="dialog" aria-label="Validation errors">
          ${present.map(group => html`<div class="constraints-group ${group.css}">
            <div class="constraints-title"><span class="material-icons" aria-hidden="true">${group.icon}</span>
              ${group.messages.length === 1 ? group.singular : `${group.singular}s`}</div>
            ${group.messages.map(message => html`<div class="constraints-message"><span class="material-icons" aria-hidden="true">radio_button_checked</span>${message}</div>`)}
          </div>`)}
        </div>` : nothing}
        <button type="button" class="validation-card ${cardClass}" aria-expanded=${this.constraintsOpen}
          @click=${() => { this.constraintsOpen = !this.constraintsOpen; }}>
          <span class="material-icons" aria-hidden="true">warning_amber</span>
          <span class="validation-card__content"><span class="validation-card__title">${count} ${count === 1 ? "issue" : "issues"}</span>${docked ? html`<span class="validation-card__subtitle">click to see details</span>` : nothing}</span>
        </button>
      </div>`;
  }

  private renderWorkspace(content: TemplateResult): TemplateResult {
    const hideSidebar = this.viewDescription?.hideSidebar === true;
    const hasActions = this.leftActionGroups().length > 0 && !hideSidebar;
    return html`
      <div class="workspace-shell">
        <button type="button" class="action-panel-backdrop" aria-label="Close view actions"
          tabindex="-1" ?hidden=${!hasActions || !this.mobileViewport || !this.actionPanelOpen}
          @click=${() => { this.actionPanelOpen = false; }}></button>
        <div class="view-workspace ${this.actionPanelOpen && !hideSidebar ? "actions-open" : "actions-closed"}">
          ${this.renderLeftActions()}
          <div class="view-content">${this.renderToolbar()}${content}</div>
        </div>
        ${this.renderConstraints()}
      </div>
    `;
  }

  private get modalOkEnabled(): boolean {
    const state = this.viewState;
    if (!state) {
      return false;
    }
    const status = state.getReference(state.root.attributes.VM_Status);
    return status?.attributes.ModalOk_Enable === true;
  }

  private renderParentView(parent: ViewSessionSnapshot): TemplateResult {
    const popup = this.captureViewSession();
    this.restoreViewSession(parent);
    const background = html`
      <header class="navbar navbar--desktop" @keydown=${this.handleActionPanelKeydown} ?hidden=${this.viewDescription?.hideMenubar === true}>
        <div class="navbar__header">
          ${this.renderActionToggle()}
          <a class="navbar__brand" href="/L#/Index">${this.globalMenu?.applicationName || "MDriven Turnkey"}</a>
        </div>
        <div class="navbar__wrapper collapse in">
          ${this.renderGlobalMenu()}
          ${this.renderLoginSection()}
        </div>
      </header>
      <main @keydown=${this.handleActionPanelKeydown}>
        ${this.renderErrorBanner()}
        ${this.renderWorkspace(this.renderViewContent())}
        ${this.renderStatusMessage()}
      </main>
    `;
    this.restoreViewSession(popup);
    return background;
  }

  protected render() {
    const objects = this.viewState?.allObjects ?? [];
    if (this.activeModal?.action.IsPopUp) {
      const position = this.activeModal.popupPosition ?? { x: 16, y: 16 };
      const popupX = Math.max(8, Math.min(position.x, window.innerWidth - 560));
      const popupY = Math.max(8, Math.min(position.y, window.innerHeight - 260));
      return html`
        ${this.renderMetadataStyles()}
        ${this.renderParentView(this.activeModal.parent)}
        <div class="popup-backdrop" tabindex="-1" style=${`--popup-x:${popupX}px;--popup-y:${popupY}px`}
          @click=${(event: MouseEvent) => {
            if (event.target === event.currentTarget) {
              void this.closeModal(true);
            }
          }} @keydown=${(event: KeyboardEvent) => {
            if (event.key === "Escape") {
              void this.closeModal(true);
            }
          }}>
          <section class="popup-panel" role="dialog" aria-modal="false"
            aria-label=${this.viewDescription?.name ?? this.route.viewName}>
            ${this.renderErrorBanner()}
            <div class="view-workspace">
              <div class="view-content">${this.renderViewContent()}</div>
            </div>
            ${this.renderStatusMessage()}
          </section>
        </div>
      `;
    }

    if (this.activeModal) {
      return html`
        ${this.renderMetadataStyles()}
        ${this.renderParentView(this.activeModal.parent)}
        <dialog class="view-dialog" aria-label=${this.viewDescription?.name ?? this.route.viewName}
          @cancel=${(event: Event) => {
            event.preventDefault();
            void this.closeModal(false);
          }}>
          ${this.renderErrorBanner()}
          <div class="view-workspace">
            <div class="view-content">${this.renderViewContent()}</div>
          </div>
          ${this.renderStatusMessage()}
          <footer class="modal-actions">
            <button type="button" @click=${() => void this.closeModal(false)}>Cancel</button>
            <button type="submit" ?disabled=${!this.modalOkEnabled}
              @click=${() => void this.closeModal(true)}>Ok</button>
          </footer>
        </dialog>
      `;
    }

    return html`
      ${this.renderMetadataStyles()}
      <header class="navbar navbar--desktop" ?hidden=${this.activeModal !== undefined || this.viewDescription?.hideMenubar === true}>
        <div class="navbar__header">
          ${this.activeModal ? nothing : this.renderActionToggle()}
          <a class="navbar__brand" href="/L#/Index">${this.globalMenu?.applicationName || "MDriven Turnkey"}</a>
        </div>
        <div class="navbar__wrapper collapse in">
          ${this.renderGlobalMenu()}
          ${this.renderLoginSection()}
        </div>
      </header>
      <main @keydown=${this.handleActionPanelKeydown} @tk-notify=${(event: CustomEvent<{ message: string; icon?: string }>) =>
        this.notify(event.detail.message, event.detail.icon)} @click=${(event: MouseEvent) => {
        this.lastPopupClickPosition = { x: event.clientX, y: event.clientY };
        this.rowContextMenu = undefined;
        this.seekerMoreMenu = undefined;
      }}>
        ${this.activeModal ? nothing : this.renderErrorBanner()}
        ${this.activeModal
          ? html`<dialog class="view-dialog" aria-label=${this.viewDescription?.name ?? this.route.viewName}
              @cancel=${(event: Event) => {
                event.preventDefault();
                void this.closeModal(false);
              }}>
              ${this.renderErrorBanner()}
              <div class="view-workspace">
                <div class="view-content">${this.renderViewContent()}</div>
              </div>
              ${this.renderStatusMessage()}
              <footer class="modal-actions">
                <button type="button" @click=${() => void this.closeModal(false)}>Cancel</button>
                <button type="submit" ?disabled=${!this.modalOkEnabled}
                  @click=${() => void this.closeModal(true)}>Ok</button>
              </footer>
            </dialog>`
          : this.renderWorkspace(this.renderViewContent())}
        ${this.route.debug ? objects.map(object => this.renderObject(object)) : nothing}
        ${this.route.debug ? html`<pre>${JSON.stringify(objects, null, 2)}</pre>` : nothing}
        ${this.activeModal ? nothing : this.renderStatusMessage()}
      </main>
    `;
  }

  private async loadGlobalMenu(): Promise<void> {
    try {
      const xml = await this.transport.getGlobalActionsMeta();
      this.globalMenu = parseGlobalMenu(xml);
      this.requestUpdate();
    } catch (error) {
      this.showError(error);
    }
  }

  private renderGlobalMenuItem(item: GlobalMenuItem, nested = false): TemplateResult | typeof nothing {
    if (item.actionName) {
      const status = this.globalActionStatus.get(item.actionName);
      if (status?.visible === false) {
        return nothing;
      }
      const button = html`<button type="button" class=${nested ? "dropdown__link" : "navbar__link"}
        ?disabled=${status?.enabled === false}
        @click=${() => void this.executeGlobalAction(item)}>${item.presentation}</button>`;
      return nested ? html`<div class="dropdown__item">${button}</div>` : html`<li class="navbar__item">${button}</li>`;
    }
    if (item.children.length === 0) {
      return nothing;
    }
    const menu = html`
      <button type="button" class=${nested ? "dropdown__link" : "navbar__link"} aria-haspopup="true"
        @click=${this.handleGlobalMenuToggle}>${item.presentation}${nested ? nothing : html`<span class="caret"></span>`}</button>
      <div class="dropdown__menu ${nested ? "dropdown--nested" : ""}">${item.children.map(child => this.renderGlobalMenuItem(child, true))}</div>`;
    return nested ? html`<div class="dropdown__item dropdown">${menu}</div>` : html`<li class="navbar__item dropdown">${menu}</li>`;
  }

  // The Turnkey stylesheets show a drop-down while its container carries the "open" class.
  private handleGlobalMenuToggle(event: Event): void {
    const container = (event.currentTarget as HTMLElement).parentElement;
    if (!container) {
      return;
    }
    const open = !container.classList.contains("open");
    const nav = container.closest("nav[aria-label='Global menu']");
    if (open && nav) {
      for (const menu of nav.querySelectorAll<HTMLElement>(".dropdown.open")) {
        if (menu !== container && !menu.contains(container)) {
          menu.classList.remove("open");
        }
      }
    }
    container.classList.toggle("open", open);
  }

  private closeGlobalMenus(): void {
    this.renderRoot.querySelectorAll<HTMLElement>("nav[aria-label='Global menu'] .dropdown.open")
      .forEach(menu => menu.classList.remove("open"));
  }

  // Login/register (or user and log out) markup is supplied by the server, as in the Angular and Blazor clients.
  @state() private loginMarkup = "";

  private async loadLoginSection(): Promise<void> {
    try {
      const response = await fetch("/turnkey/LoginSectionPartial", { credentials: "same-origin" });
      if (response.ok) {
        this.loginMarkup = (await response.text()).trim();
      }
    } catch (error) {
      console.error("Turnkey login section failed to load", error);
    }
  }

  // Send the user back to the current Lit page (including the #/View/Id route) after login or register.
  private applyLoginReturnUrl(): void {
    const returnUrl = `${window.location.pathname}${window.location.hash}`;
    const links = this.renderRoot.querySelectorAll<HTMLAnchorElement>(".login-section a[href]");
    for (const link of links) {
      const url = new URL(link.getAttribute("href") ?? "", window.location.origin);
      if (!/\/account\/(login|register)$/i.test(url.pathname)) {
        continue;
      }
      url.searchParams.set("ReturnUrl", returnUrl);
      link.setAttribute("href", `${url.pathname}${url.search}`);
    }
  }

  private renderLoginSection(): TemplateResult | typeof nothing {
    if (!this.loginMarkup) {
      return nothing;
    }
    return html`<div class="login-section" @click=${this.handleLoginSectionClick}>${unsafeHTML(this.loginMarkup)}</div>`;
  }

  // The server markup logs out with javascript:document.getElementById(...), which cannot see into the shadow root.
  private readonly handleLoginSectionClick = (event: MouseEvent): void => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='javascript:']");
    if (!link) {
      return;
    }
    event.preventDefault();
    if (link.getAttribute("href")?.includes("logoutForm")) {
      this.renderRoot.querySelector<HTMLFormElement>("#logoutForm")?.submit();
    }
  };

  private renderGlobalMenu(): TemplateResult | typeof nothing {
    return this.globalMenu && !this.viewDescription?.hideMenubar
      ? html`<nav aria-label="Global menu">
          <ul class="navbar__list">${this.globalMenu.items.map(item => this.renderGlobalMenuItem(item))}</ul>
        </nav>`
      : nothing;
  }

  private async executeGlobalAction(item: GlobalMenuItem): Promise<void> {
    if (!item.actionName) {
      return;
    }
    this.closeGlobalMenus();
    try {
      if (!await this.saveBeforeLeaving()) {
        return;
      }
      const result = await this.transport.openGlobalAction(item.actionName);
      const separator = result.indexOf("¤");
      const vmClassId = separator < 0 ? "" : result.slice(separator + 1).trim();
      const vmClassIdSeparator = vmClassId.indexOf(";");
      if (vmClassIdSeparator < 0) {
        throw new TypeError(`Turnkey returned an invalid destination for global action ${item.actionName}`);
      }
      const objectId = vmClassId.slice(0, vmClassIdSeparator);
      const viewName = vmClassId.slice(vmClassIdSeparator + 1);
      const destination = `${encodeURIComponent(viewName)}/${encodeURIComponent(objectId)}`;
      if (item.newTab) {
        window.open(`${window.location.pathname}#/${destination}`, "_blank", "noopener");
      } else {
        window.location.hash = `#/${destination}`;
      }
    } catch (error) {
      this.showError(error);
    }
  }
}
