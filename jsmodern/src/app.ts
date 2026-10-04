import { HubConnection, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { LitElement, css, html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
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
  readonly x: number;
  readonly y: number;
}

interface GridSort {
  readonly column: string;
  readonly direction: "ascending" | "descending";
}

interface LeftActionGroup {
  readonly className: string;
  readonly name: string;
  readonly target?: VmObject;
  readonly actions: readonly ServerActionCommand[];
}

interface ViewSessionSnapshot {
  readonly route: ViewRoute;
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

@customElement("turnkey-lit-app")
class TurnkeyLitApp extends LitElement {
  static styles = css`
    :host { display: block; min-height: 100vh; }
    header { align-items: center; background: #263746; color: white; display: flex; gap: 1rem; padding: 0.8rem 1.25rem; }
    header[hidden] { display: none; }
    header h1 { font-size: 1.1rem; margin: 0; }
    header h1 a { color: inherit; text-decoration: none; }
    header h1 a:hover, header h1 a:focus-visible { text-decoration: underline; }
    nav { align-items: center; background: #fff; border-bottom: 1px solid #dce1e5; display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0.6rem 1rem; }
    header nav { background: transparent; border: 0; flex: 1; min-width: 0; padding: 0; }
    header nav > button, header nav > details > summary { color: white; }
    header nav > button:hover, header nav > details > summary:hover { background: #ffffff22; }
    nav details { position: relative; }
    nav summary, nav button { background: transparent; border: 0; border-radius: 0.25rem; color: #263746; cursor: pointer; font: inherit; padding: 0.45rem 0.65rem; }
    nav summary:hover, nav button:hover { background: #edf1f4; }
    nav details[open] > div { background: white; border: 1px solid #dce1e5; border-radius: 0.3rem; box-shadow: 0 0.25rem 0.75rem #0002; left: 0; min-width: 12rem; padding: 0.25rem; position: absolute; top: 100%; z-index: 2; }
    nav details div details { margin-left: 0.5rem; }
    nav details div button { display: block; text-align: left; width: 100%; }
    header nav details div button, header nav details div summary { color: #263746; }
    header nav details div button:hover, header nav details div summary:hover { background: #edf1f4; }
    header .action-toggle { background: transparent; border: 1px solid #ffffff66; border-radius: 0.3rem; color: white; font-size: 1.25rem; line-height: 1; padding: 0.4rem 0.55rem; }
    header .action-toggle:hover, header .action-toggle:focus-visible { background: #ffffff22; }
    main { margin: 1.5rem auto; max-width: 70rem; padding: 0 1rem; }
    .workspace-toolbar { align-items: center; display: flex; margin-bottom: 0.5rem; }
    .workspace-toolbar .action-toggle { background: white; border: 1px solid #c7d0d7; border-radius: 0.3rem; color: #263746; font-size: 1.25rem; line-height: 1; padding: 0.4rem 0.55rem; }
    .workspace-toolbar .action-toggle:hover, .workspace-toolbar .action-toggle:focus-visible { background: #edf1f4; }
    .workspace-shell { position: relative; }
    .view-workspace { align-items: start; display: grid; gap: 1rem; grid-template-columns: minmax(11rem, 14rem) minmax(0, 1fr); }
    .view-workspace.actions-closed { grid-template-columns: minmax(0, 1fr); }
    .view-workspace .left-actions[hidden] { display: none; }
    .left-actions { background: white; border: 1px solid #dce1e5; border-radius: 0.4rem; padding: 0.5rem; }
    .left-actions h2 { color: #53616b; font-size: 0.85rem; margin: 0.4rem 0.5rem; }
    .left-action-group + .left-action-group { border-top: 1px solid #e1e5e8; margin-top: 0.4rem; padding-top: 0.35rem; }
    .left-actions button { background: transparent; border: 0; border-radius: 0.25rem; color: #263746; display: block; padding: 0.45rem 0.55rem; text-align: left; width: 100%; }
    .left-actions button:hover:not(:disabled), .left-actions button:focus-visible { background: #edf1f4; }
    .left-actions button:disabled { color: #818a90; cursor: default; }
    .left-action-subgroup { color: #75818a; font-size: 0.78rem; margin: 0.35rem 0.5rem 0.1rem; }
    .view-content { min-width: 0; }
    .view-dialog .view-workspace { grid-template-columns: minmax(0, 1fr); }
    dialog.view-dialog { border: 0; border-radius: 0.5rem; box-shadow: 0 1rem 3rem #0005; max-height: min(90vh, 60rem); max-width: min(90vw, 75rem); overflow: auto; padding: 1.25rem; width: min(75rem, calc(100vw - 2rem)); }
    dialog.view-dialog::backdrop { background: #15232d33; }
    dialog.view-dialog .view-canvas { margin: 0; }
    .popup-backdrop { background: transparent; inset: 0; position: fixed; z-index: 1000; }
    .popup-panel { background: white; border: 1px solid #c7d0d7; border-radius: 0.35rem; box-shadow: 0 0.35rem 1.25rem #0003; box-sizing: border-box; left: var(--popup-x); margin: 0; max-height: min(90vh, 60rem); max-width: min(90vw, 34rem); overflow: auto; padding: 1rem; position: fixed; top: var(--popup-y); width: min(34rem, calc(100vw - 2rem)); }
    .popup-panel .view-workspace { grid-template-columns: minmax(0, 1fr); }
    .popup-panel .view-canvas { margin: 0; }
    .modal-actions { background: white; border-top: 1px solid #dce1e5; display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; padding-top: 1rem; }
    .modal-actions button { border: 1px solid #c7d0d7; border-radius: 0.3rem; padding: 0.45rem 0.85rem; }
    .modal-actions button[type="submit"] { background: #263746; border-color: #263746; color: white; }
    .modal-actions button:disabled { cursor: default; opacity: 0.55; }
    .status { background: white; border-radius: 0.4rem; margin-bottom: 1rem; padding: 0.8rem 1rem; }
    .status[hidden] { display: none; }
    .error { border-left: 0.25rem solid #b3261e; color: #8c1d18; }
    .notice { color: #52616b; }
    section { background: white; border-radius: 0.4rem; margin: 1rem 0; overflow: hidden; }
    section h2 { background: #edf1f4; font-size: 1rem; margin: 0; padding: 0.8rem 1rem; }
    .view-canvas { gap: 1rem; min-width: 0; }
    .view-control { min-width: 0; }
    .view-control h1, .view-control h2, .view-control h3, .view-control p { margin: 0; }
    .view-control label { display: block; margin-bottom: 0.35rem; }
    .view-control input, .view-control select { box-sizing: border-box; font: inherit; max-width: 35rem; padding: 0.45rem; width: 100%; }
    .view-control input[type="checkbox"] { width: auto; }
    table { border-collapse: collapse; width: 100%; }
    .view-control table { table-layout: fixed; }
    th, td { border-bottom: 1px solid #e1e5e8; overflow: hidden; padding: 0.5rem; text-align: left; text-overflow: ellipsis; }
    th { position: relative; }
    .row-selection-cell { text-align: center; }
    .row-selection-cell input { cursor: pointer; margin: 0; max-width: none; padding: 0; width: auto; }
    .grid-sort-button { background: transparent; border: 0; color: inherit; font: inherit; font-weight: 600; padding: 0; text-align: left; width: 100%; }
    .grid-sort-button:hover { text-decoration: underline; }
    .grid-resize-handle { bottom: 0; cursor: col-resize; position: absolute; right: 0; top: 0; touch-action: none; width: 0.5rem; z-index: 1; }
    .grid-resize-handle:hover, .grid-resize-handle:focus-visible { background: #597b91; outline: 0; }
    tbody tr.current-row { background: #e8f1f8; }
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
    input { box-sizing: border-box; font: inherit; max-width: 35rem; padding: 0.4rem; width: 100%; }
    .reference, .collection { color: #52616b; }
    button { cursor: pointer; font: inherit; }
    .action-panel-backdrop { display: none; }
    @media (max-width: 600px) {
      .view-workspace { grid-template-columns: 1fr; }
      .left-actions { display: block; }
      .view-workspace .left-actions[hidden] { display: none; }
      dl { grid-template-columns: 1fr; gap: 0.25rem; }
      dd { margin-bottom: 0.6rem; }
    }
    @media (max-width: 760px) {
      .view-workspace { display: block; }
      .view-workspace > .view-content { width: 100%; }
      .action-panel-backdrop:not([hidden]) { background: #15232d55; border: 0; display: block; inset: 0; padding: 0; position: fixed; z-index: 19; }
      .view-workspace .left-actions:not([hidden]) { box-shadow: 0 0.75rem 2rem #0003; box-sizing: border-box; left: 0.75rem; max-height: calc(100vh - 1.5rem); overflow: auto; position: fixed; top: 0.75rem; width: min(18rem, calc(100vw - 1.5rem)); z-index: 20; }
    }
  `;

  @state() private route: ViewRoute = parseViewRoute(window.location.hash);
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
  @state() private rowContextMenu?: RowContextMenu;
  @state() private activeModal?: ActiveModal;
  @state() private statusMessage = "Opening view…";
  @state() private errorMessage = "";

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
    this.actionPanelMedia.addEventListener("change", this.handleActionPanelViewportChange);
    this.globalMenuLoad ??= this.loadGlobalMenu();
    void this.openCurrentRoute();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this.handleRouteChange);
    this.actionPanelMedia.removeEventListener("change", this.handleActionPanelViewportChange);
    this.routeGeneration++;
    this.pollController?.abort();
    window.clearTimeout(this.pollTimer);
    window.clearTimeout(this.updateTimer);
    this.stateUnsubscribe?.();
    void this.connection?.stop();
  }

  protected updated(): void {
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog.view-dialog");
    if (this.activeModal && dialog && !dialog.open) {
      dialog.showModal();
    } else if (!this.activeModal && dialog?.open) {
      dialog.close();
    }
  }

  private readonly handleRouteChange = (): void => {
    this.cacheActiveViewSession();
    this.route = parseViewRoute(window.location.hash);
    void this.openCurrentRoute();
  };

  private async openCurrentRoute(): Promise<void> {
    const generation = ++this.routeGeneration;
    this.pollController?.abort();
    window.clearTimeout(this.pollTimer);
    this.stateUnsubscribe?.();
    this.activeModal = undefined;
    this.rowContextMenu = undefined;
    this.errorMessage = "";

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
    } catch (error) {
      console.error("Turnkey SignalR connection failed; polling will continue", error);
      window.setTimeout(() => {
        if (generation === this.routeGeneration) {
          void this.connectSignalR(generation);
        }
      }, 5000);
    }
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
        } else if (isServerActionRemoveCommand(command)) {
          this.removeViewAction(command);
        }
      }
      state.applyServerCommands(commands);
      const modalClose = commands.find(
        (command): command is ModalCodeCloseCommand => command.CType === "ServerUpdateCommand_ModalCodeClose"
      );
      if (modalClose && this.activeModal) {
        void this.closeModal(modalClose.IsClosePopup || modalClose.IsCloseWithOk);
        return;
      }
      const navigate = commands.find(isNavigateCommand);
      if (navigate && this.handleServerNavigation(navigate)) {
        return;
      }
      if (this.appInfo?.LostContext) {
        this.cachedViewSessions.delete(this.viewSessionKey(state.root.className, state.root.id));
        this.statusMessage = "The Turnkey view context has expired. Reload to open a new view.";
        return;
      }
      this.errorMessage = "";
      this.statusMessage = this.appInfo?.ServerStatus || "Connected to Turnkey";
      this.storeCurrentViewSession();
      const delaySeconds = this.appInfo?.SuggestCallbackInSecs;
      const serverDelay = delaySeconds === undefined || delaySeconds < 0 ? 5000 : delaySeconds * 1000;
      const delay = this.connection?.state === "Connected" ? serverDelay : Math.min(serverDelay, 5000);
      this.pollTimer = window.setTimeout(() => void this.poll(generation), Math.max(delay, 1000));
    } catch (error) {
      if (generation === this.routeGeneration && !this.isAbortError(error)) {
        this.errorMessage = error instanceof Error ? error.message : String(error);
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

  private async executeViewAction(vmClassName: string, actionName: string, event?: MouseEvent): Promise<void> {
    const state = this.viewState;
    if (!state || this.executingActions.has(`${vmClassName}:${actionName}`)) {
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
    } catch (error) {
      this.showError(error);
    } finally {
      this.executingActions.delete(actionKey);
      this.requestUpdate();
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
    const groups = this.leftActionGroups();
    if (groups.length === 0) {
      return nothing;
    }

    return html`
      <aside id="view-actions-panel" class="left-actions" aria-label="View actions"
        ?hidden=${!this.actionPanelOpen}>
        ${groups.map(group => {
          const subgroups = new Map<string, ServerActionCommand[]>();
          for (const action of group.actions) {
            const name = action.SubMenuGroup ?? "";
            const subgroup = subgroups.get(name) ?? [];
            subgroup.push(action);
            subgroups.set(name, subgroup);
          }
          const orderedSubgroups = [...subgroups.entries()];
          return html`
            <div class="left-action-group">
              ${group.className === "GLOBAL" ? nothing : html`<h2>${group.name}</h2>`}
              ${orderedSubgroups.map(([subgroupName, actions]) => html`
                ${subgroupName && group.className !== "GLOBAL"
                  ? html`<div class="left-action-subgroup">${subgroupName}</div>`
                  : nothing}
                ${actions.map(action => {
                  const actionKey = group.target
                    ? `${action.VMClassName}:${action.Action}:${group.target.vmClassId}`
                    : `${action.VMClassName}:${action.Action}`;
                  const disabled = !action.Enable || this.executingActions.has(actionKey);
                  return html`
                    <button type="button" ?disabled=${disabled}
                      @click=${(event: MouseEvent) => {
                        if (this.mobileViewport) {
                          this.actionPanelOpen = false;
                        }
                        if (group.target && group.target.vmClassId !== this.viewState?.root.vmClassId) {
                          void this.executeRowAction(action, group.target.vmClassId, event);
                        } else {
                          void this.executeViewAction(action.VMClassName, action.Action, event);
                        }
                      }}>${action.Presentation || action.Action}</button>
                  `;
                })}
              `)}
            </div>
          `;
        })}
      </aside>
    `;
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
    collectionName: string
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectCollectionRow(row, ownerId, collectionName);
    this.rowContextMenu = {
      rowVMClassId: row.vmClassId,
      collectionOwnerId: ownerId,
      collectionName,
      x: Math.max(4, Math.min(event.clientX, window.innerWidth - 220)),
      y: Math.max(4, Math.min(event.clientY, window.innerHeight - 100))
    };
  }

  private handleRowDoubleClick(
    event: MouseEvent,
    row: VmObject,
    ownerId: string,
    collectionName: string
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
      this.openRowContextMenu(event, row, ownerId, collectionName);
    }
  }

  private renderRowContextMenu(): TemplateResult {
    const menu = this.rowContextMenu;
    const row = menu ? this.viewState?.getObject(menu.rowVMClassId) : undefined;
    const actions = row ? this.rowActions(row.className) : [];
    const groups = new Map<string, ServerActionCommand[]>();
    for (const action of actions) {
      const groupName = action.SubMenuGroup ?? "";
      const group = groups.get(groupName) ?? [];
      group.push(action);
      groups.set(groupName, group);
    }
    const orderedGroups = [...groups.entries()].sort(([leftName, leftActions], [rightName, rightActions]) => {
      const leftKey = leftActions[0]?.SubMenuGroupSortKey ?? leftName;
      const rightKey = rightActions[0]?.SubMenuGroupSortKey ?? rightName;
      return leftKey.localeCompare(rightKey);
    });

    return html`
      <div class="row-context-menu" role="menu" aria-label=${`${row?.className ?? "Row"} actions`}
        style="left: ${menu?.x ?? 4}px; top: ${menu?.y ?? 4}px"
        @click=${(event: Event) => event.stopPropagation()}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === "Escape") {
            this.rowContextMenu = undefined;
          }
        }}>
        ${orderedGroups.length > 0
          ? orderedGroups.map(([groupName, groupActions]) => html`
              ${groupName ? html`<div class="row-menu-group">${groupName}</div>` : nothing}
              ${groupActions.map(action => html`
                <button type="button" role="menuitem" ?disabled=${!action.Enable}
                  @click=${(event: MouseEvent) => {
                    event.stopPropagation();
                    this.rowContextMenu = undefined;
                    if (menu) {
                  void this.executeRowAction(action, menu.rowVMClassId, event);
                    }
                  }}>${action.Presentation || action.Action}</button>
              `)}
            `)
          : html`<button type="button" role="menuitem" disabled>No actions available</button>`}
      </div>
    `;
  }

  private showError(error: unknown): void {
    this.errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Turnkey Lit client error", error);
  }

  private renderMetadataStyles(): TemplateResult {
    const parentStyles = this.activeModal?.parent.viewDescription?.styles ?? "";
    const currentStyles = this.viewDescription?.styles ?? "";
    return html`<style>${parentStyles}\n${currentStyles}</style>`;
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

  private renderMetaControl(control: ViewMetaControl, row?: VmObject): TemplateResult | typeof nothing {
    if (control.tagName === "tk-layout-container") {
      return html`
        <div class=${control.wrapperClass} style=${control.wrapperStyle || nothing}>
          ${control.layoutChildren.map(child => this.renderMetaControl(child, row))}
        </div>
      `;
    }

    const attributes = control.attributes;
    const nesting = attributes.BindInfoNesting ?? this.route.viewName;
    const column = attributes.BindInfoColumn;
    const label = attributes.StaticLabel ?? "";
    const typeName = (attributes.TypeCSharp ?? "").split(".").pop() ?? "";
    const target = row ?? this.viewState?.getCurrentObject(nesting);
    const value = column ? target?.attributes[column] : undefined;
    const statusObject = this.viewState?.getReference(this.viewState.root.attributes.VM_Status);
    const statusPrefix = attributes.id?.replace(/\./g, "_");
    const visible = statusPrefix
      ? statusObject?.attributes[`${statusPrefix}_Visible`] !== false
      : true;
    const enabled = statusPrefix
      ? statusObject?.attributes[`${statusPrefix}_Enabled`] !== false
      : true;
    const readOnly = statusPrefix
      ? statusObject?.attributes[`${statusPrefix}_ReadOnly`] === true
      : false;
    if (!visible) {
      return nothing;
    }
    const writable = target !== undefined && column !== undefined && enabled && !readOnly
      && Object.prototype.hasOwnProperty.call(target.attributes, column)
      && attributes.StaticStyle?.toLowerCase() !== "readonly";
    const targetClass = target?.className;
    const targetId = target?.vmClassId;
    const styleName = attributes.StaticStyle?.toLowerCase();
    const styleTag = styleName && /^h[1-6]$/.test(styleName) ? styleName : "div";
    if (control.tagName === "tk-data-grid") {
      const collection = column && targetId ? this.viewState?.getCollection(targetId, column) ?? [] : [];
      const collectionKey = targetId && column ? `${targetId}:${column}` : "";
      const multiSelect = control.taggedValues.MultiSelect?.toLowerCase() === "true";
      const selectedRowId = this.selectedRows.get(collectionKey);
      const menuMatchesCollection = this.rowContextMenu?.collectionOwnerId === targetId
        && this.rowContextMenu?.collectionName === column;
      const visibleColumns = control.columns.filter(item => item.attributes.NotVisible?.toLowerCase() !== "true");
      const gridSort = this.gridSorts.get(collectionKey);
      const displayedCollection = this.sortGridRows(collection, gridSort);
      return html`
        <div class="view-control ${control.wrapperClass}" style=${control.wrapperStyle || nothing}>
          ${label ? html`<label>${label}</label>` : nothing}
          <table>
            <colgroup>
              ${multiSelect ? html`<col style="width: 2.5rem">` : nothing}
              ${visibleColumns.map((_, index) => {
                const width = this.gridColumnWidths.get(`${collectionKey}:${index}`);
                return html`<col data-column-index=${index} style=${width ? `width:${width}px` : nothing}>`;
              })}
              <col style="width: 3rem">
            </colgroup>
            <thead><tr>
              ${multiSelect ? html`<th aria-label="Row selection"></th>` : nothing}
              ${visibleColumns.map((item, index) => {
              const columnName = item.attributes.BindInfoColumn;
              const activeSort = gridSort?.column === columnName;
              return html`<th aria-sort=${activeSort ? gridSort.direction : "none"}>
                ${columnName
                  ? html`<button type="button" class="grid-sort-button"
                      aria-label=${`Sort by ${item.attributes.StaticLabel || columnName}`}
                      @click=${() => this.toggleGridSort(collectionKey, columnName)}>
                      ${item.attributes.StaticLabel || columnName}${activeSort ? gridSort.direction === "ascending" ? " ▲" : " ▼" : ""}
                    </button>`
                  : item.attributes.StaticLabel}
                <span class="grid-resize-handle" role="separator" aria-orientation="vertical"
                  aria-label=${`Resize ${item.attributes.StaticLabel || columnName || "column"} column`}
                  tabindex="0"
                  @pointerdown=${(event: PointerEvent) => this.beginGridColumnResize(event, collectionKey, index)}
                  @pointermove=${(event: PointerEvent) => this.moveGridColumnResize(event)}
                  @pointerup=${() => this.endGridColumnResize()}
                  @pointercancel=${() => this.endGridColumnResize()}
                  @keydown=${(event: KeyboardEvent) => this.resizeGridColumnByKeyboard(event, collectionKey, index)}></span>
              </th>`;
            })}</tr></thead>
            <tbody>
              ${repeat(displayedCollection, item => item.vmClassId, item => html`<tr
                class=${(selectedRowId ? selectedRowId === item.vmClassId : item.attributes.vCurrent === true)
                  ? "current-row"
                  : nothing}
                @click=${() => targetId && column && this.selectCollectionRow(item, targetId, column)}
                @contextmenu=${(event: MouseEvent) => targetId && column
                  && this.openRowContextMenu(event, item, targetId, column)}
                @dblclick=${(event: MouseEvent) => targetId && column
                  && this.handleRowDoubleClick(event, item, targetId, column)}>
                ${multiSelect ? html`<td class="row-selection-cell">
                  <input type="checkbox" aria-label=${`Select ${item.className} ${item.id}`}
                    .checked=${item.attributes.vSelected === true}
                    @click=${(event: MouseEvent) => event.stopPropagation()}
                    @change=${(event: Event) => this.queueUpdate(
                      item.vmClassId,
                      "vSelected",
                      (event.currentTarget as HTMLInputElement).checked
                    )}>
                </td>` : nothing}
                ${visibleColumns.map(itemControl => html`<td>${this.renderMetaControl(itemControl, item)}</td>`)}
                <td class="row-menu-cell">
                  <button type="button" class="row-menu-trigger" aria-haspopup="menu"
                    aria-label=${`Actions for ${item.className} ${item.id}`}
                    aria-expanded=${this.rowContextMenu?.rowVMClassId === item.vmClassId}
                    @click=${(event: MouseEvent) => targetId && column
                      && this.openRowContextMenu(event, item, targetId, column)}>⋮</button>
                </td>
              </tr>`)}
            </tbody>
          </table>
          ${collection.length === 0 ? html`<p>No rows</p>` : nothing}
          ${menuMatchesCollection ? this.renderRowContextMenu() : nothing}
        </div>
      `;
    }

    if (control.tagName === "tk-button" && targetClass && column) {
      const actionName = attributes.AbstractAction || column;
      const actionKey = `${targetClass}:${actionName}`;
      return html`
        <div class="view-control ${control.wrapperClass}" style=${control.wrapperStyle || nothing}>
          <button type="button" ?disabled=${!enabled || this.executingActions.has(actionKey)}
            @click=${(event: MouseEvent) => void this.executeViewAction(targetClass, actionName, event)}>
            ${label || actionName}
          </button>
        </div>
      `;
    }

    const inputType = control.tagName === "tk-datepicker"
      ? "datetime-local"
      : typeName === "Boolean" || typeName === "bool"
        ? "checkbox"
        : attributes.type ?? (typeName.match(/^(Byte|Int16|Int32|Int64|Decimal|Double)$/) ? "number" : "text");
    if (control.tagName === "tk-select" && targetId && column) {
      const pickListName = attributes.BindInfoPicklist;
      const pickListOwner = this.viewState?.getCurrentObject(attributes.BindInfoNesting ?? nesting);
      const options = pickListName && pickListOwner
        ? this.viewState?.getCollection(pickListOwner.vmClassId, pickListName) ?? []
        : [];
      const selectedId = value && typeof value === "object" && !(value instanceof Date) && "kind" in value
        ? this.viewState?.getReference(value)?.id ?? ""
        : typeof value === "string"
          ? value
          : "";
      const externalIdAttribute = `${column}_AsExternalId`;
      const externalIdValue = target?.attributes[externalIdAttribute];
      const selectedExternalId = typeof externalIdValue === "string"
        ? externalIdValue
        : selectedId || NULL_EXTERNAL_ID;
      return html`
        <div class="view-control ${control.wrapperClass}" style=${control.wrapperStyle || nothing}>
          ${label && !row ? html`<label for=${attributes.id ?? nothing}>${label}</label>` : nothing}
          <select id=${attributes.id ?? nothing} ?disabled=${!writable}
            aria-label=${row ? label || nothing : nothing}
            @change=${(event: Event) => {
              const selected = (event.currentTarget as HTMLSelectElement).value;
              if (targetId && writable) {
                this.queueUpdate(targetId, externalIdAttribute, selected || null);
              }
            }}>
            <option value="" .selected=${selectedExternalId === ""}></option>
            ${options.map(option => html`<option value=${option.id} .selected=${option.id === selectedExternalId}>
              ${String(option.attributes[attributes.BindInfoPicklistItemPres ?? "Presentation"] ?? option.id)}
            </option>`)}
          </select>
        </div>
      `;
    }

    const currentValue = value === null || value === undefined
      ? ""
      : value instanceof Date
        ? this.dateInputValue(value)
        : typeof value === "object"
          ? this.viewState?.getReference(value)?.id ?? ""
          : String(value);
    const componentClass = control.wrapperClass.split(/\s+/).filter(name => name && name !== "tk-component").join(" ");
    const content = value === null || value === undefined ? "" : String(value);

    return html`
      <div class="view-control ${componentClass}" style=${control.wrapperStyle || nothing}>
        ${label && !row ? html`<label for=${attributes.id ?? nothing}>${label}</label>` : nothing}
        ${control.tagName === "tk-typography"
          ? this.renderTypography(styleTag, attributes.id, content)
          : html`<input
              id=${attributes.id ?? nothing}
              type=${inputType}
              aria-label=${row ? label || nothing : nothing}
              .value=${inputType === "checkbox" ? "" : currentValue}
              .checked=${inputType === "checkbox" && value === true}
              ?disabled=${!writable}
              ?readonly=${attributes.readonly !== undefined || attributes.disabled === "true"}
              maxlength=${attributes.maxlength ?? nothing}
              step=${inputType === "number" ? "any" : nothing}
              @change=${(event: Event) => {
                if (!targetClass || !targetId || !column || !writable) {
                  return;
                }
                const input = event.currentTarget as HTMLInputElement;
                let newValue: VmValue;
                if (inputType === "checkbox") {
                  newValue = input.checked;
                } else if (control.tagName === "tk-datepicker") {
                  newValue = input.value ? new Date(input.value) : null;
                } else if (inputType === "number") {
                  newValue = input.value === "" ? null : Number(input.value);
                } else {
                  newValue = input.value === "" ? null : input.value;
                }
                this.queueUpdate(targetId, column, newValue);
              }}>
          `}
      </div>
    `;
  }

  private renderTypography(tagName: string, id: string | undefined, content: string): TemplateResult {
    switch (tagName) {
      case "h1": return html`<h1 id=${id ?? nothing}>${content}</h1>`;
      case "h2": return html`<h2 id=${id ?? nothing}>${content}</h2>`;
      case "h3": return html`<h3 id=${id ?? nothing}>${content}</h3>`;
      case "h4": return html`<h4 id=${id ?? nothing}>${content}</h4>`;
      case "h5": return html`<h5 id=${id ?? nothing}>${content}</h5>`;
      case "h6": return html`<h6 id=${id ?? nothing}>${content}</h6>`;
      default: return html`<div id=${id ?? nothing}>${content}</div>`;
    }
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
    if (this.leftActionGroups().length === 0) {
      return nothing;
    }
    return html`<button type="button" class="action-toggle"
      aria-label=${this.actionPanelOpen ? "Hide view actions" : "Show view actions"}
      aria-controls="view-actions-panel" aria-expanded=${this.actionPanelOpen}
      @click=${() => { this.actionPanelOpen = !this.actionPanelOpen; }}>
      <span aria-hidden="true">☰</span>
    </button>`;
  }

  private handleActionPanelKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.mobileViewport && this.actionPanelOpen) {
      this.actionPanelOpen = false;
    }
  }

  private renderWorkspace(content: TemplateResult): TemplateResult {
    const hasActions = this.leftActionGroups().length > 0;
    return html`
      <div class="workspace-shell">
        <button type="button" class="action-panel-backdrop" aria-label="Close view actions"
          tabindex="-1" ?hidden=${!hasActions || !this.mobileViewport || !this.actionPanelOpen}
          @click=${() => { this.actionPanelOpen = false; }}></button>
        <div class="view-workspace ${this.actionPanelOpen ? "actions-open" : "actions-closed"}">
          ${this.renderLeftActions()}
          <div class="view-content">${content}</div>
        </div>
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
      <header @keydown=${this.handleActionPanelKeydown}>
        ${this.renderActionToggle()}
        <h1><a href="/L#/Index">${this.globalMenu?.applicationName || "MDriven Turnkey"}</a></h1>
        ${this.renderGlobalMenu()}
      </header>
      <main @keydown=${this.handleActionPanelKeydown}>
        ${this.errorMessage ? html`<div class="status error" role="alert">${this.errorMessage}</div>` : nothing}
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
            ${this.errorMessage ? html`<div class="status error" role="alert">${this.errorMessage}</div>` : nothing}
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
          ${this.errorMessage ? html`<div class="status error" role="alert">${this.errorMessage}</div>` : nothing}
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
      <header ?hidden=${this.activeModal !== undefined}>
        ${this.activeModal ? nothing : this.renderActionToggle()}
        <h1><a href="/L#/Index">${this.globalMenu?.applicationName || "MDriven Turnkey"}</a></h1>
        ${this.renderGlobalMenu()}
      </header>
      <main @keydown=${this.handleActionPanelKeydown} @click=${(event: MouseEvent) => {
        this.lastPopupClickPosition = { x: event.clientX, y: event.clientY };
        this.rowContextMenu = undefined;
      }}>
        ${this.errorMessage
          ? html`<div class="status error" role="alert" ?hidden=${this.activeModal !== undefined}>${this.errorMessage}</div>`
          : nothing}
        ${this.activeModal
          ? html`<dialog class="view-dialog" aria-label=${this.viewDescription?.name ?? this.route.viewName}
              @cancel=${(event: Event) => {
                event.preventDefault();
                void this.closeModal(false);
              }}>
              ${this.errorMessage ? html`<div class="status error" role="alert">${this.errorMessage}</div>` : nothing}
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

  private renderGlobalMenuItem(item: GlobalMenuItem): TemplateResult | typeof nothing {
    if (item.actionName) {
      const status = this.globalActionStatus.get(item.actionName);
      if (status?.visible === false) {
        return nothing;
      }
      return html`<button type="button" ?disabled=${status?.enabled === false}
        @click=${() => void this.executeGlobalAction(item)}>${item.presentation}</button>`;
    }
    if (item.children.length === 0) {
      return nothing;
    }
    return html`
      <details @toggle=${this.handleGlobalMenuToggle}>
        <summary>${item.presentation}</summary>
        <div>${item.children.map(child => this.renderGlobalMenuItem(child))}</div>
      </details>
    `;
  }

  private handleGlobalMenuToggle(event: Event): void {
    const openedMenu = event.currentTarget;
    if (!(openedMenu instanceof HTMLDetailsElement) || !openedMenu.open) {
      return;
    }
    const nav = openedMenu.closest("nav[aria-label='Global menu']");
    if (!nav) {
      return;
    }
    for (const menu of nav.querySelectorAll<HTMLDetailsElement>("details[open]")) {
      if (menu !== openedMenu && !menu.contains(openedMenu)) {
        menu.open = false;
      }
    }
  }

  private closeGlobalMenus(): void {
    this.renderRoot.querySelectorAll<HTMLDetailsElement>("nav[aria-label='Global menu'] details[open]")
      .forEach(menu => { menu.open = false; });
  }

  private renderGlobalMenu(): TemplateResult | typeof nothing {
    return this.globalMenu
      ? html`<nav aria-label="Global menu">
          ${this.globalMenu.items.map(item => this.renderGlobalMenuItem(item))}
        </nav>`
      : nothing;
  }

  private async executeGlobalAction(item: GlobalMenuItem): Promise<void> {
    if (!item.actionName) {
      return;
    }
    this.closeGlobalMenus();
    try {
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
