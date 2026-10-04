import {
  ClientCommand_Update,
  ClientCommand_ActionExecute,
  ClientCommand_ActionRowClickExecute,
  decodeServerCommands,
  ViewStateServerCommand
} from "./commands";

export class TurnkeyTransport {
  private readonly apiBaseUrl: string;

  constructor(apiBaseUrl = "./api/", private readonly fetcher: typeof fetch = fetch.bind(globalThis)) {
    this.apiBaseUrl = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  }

  async openView(vmClassId: string, resetServerApp = false, userControlParentId?: string): Promise<string> {
    const query = new URLSearchParams({
      VMClassId: vmClassId,
      ResetServerApp: String(resetServerApp)
    });
    if (userControlParentId !== undefined) {
      query.set("ucparentid", userControlParentId);
    }
    const response = await this.request(`Open?${query.toString()}`);
    return response.text();
  }

  async openModal(
    sourceVMClassId: string,
    contextId: string,
    vmClassName: string,
    action: string,
    signal?: AbortSignal
  ): Promise<string> {
    const query = new URLSearchParams({ SourceVMClassId: sourceVMClassId, ContextId: contextId, VMClassName: vmClassName, Action: action });
    const response = await this.request(`OpenModal?${query.toString()}`, { signal });
    return response.text();
  }

  async closeModal(
    vmId: string,
    closedWithOk: boolean,
    action: string,
    modalVMId: string,
    actionContextId: string,
    signal?: AbortSignal
  ): Promise<void> {
    const query = new URLSearchParams({
      VMId: vmId,
      ClosedWithOk: String(closedWithOk),
      Action: action,
      VMIdForModal: modalVMId,
      ActionContextId: actionContextId
    });
    await this.request(`ClosingModal?${query.toString()}`, { signal });
  }

  async pollView(
    vmId: string,
    cursor: number,
    signalRClientId = "",
    signal?: AbortSignal
  ): Promise<ViewStateServerCommand[]> {
    const query = new URLSearchParams({
      cursor: String(cursor),
      VMId: vmId,
      ClientId: signalRClientId
    });
    const response = await this.request(`ServerStream?${query.toString()}`, { signal });
    return decodeServerCommands(await response.json());
  }

  async getViewMeta(viewName: string, signal?: AbortSignal): Promise<string> {
    const query = new URLSearchParams({ view: viewName });
    const response = await this.request(`../Turnkey/ViewMetaBlazorClient?${query.toString()}`, { signal });
    return response.text();
  }

  async getGlobalActionsMeta(signal?: AbortSignal): Promise<string> {
    const response = await this.request("../Turnkey/GlobalActionsMeta2", { signal });
    return response.text();
  }

  async openGlobalAction(actionName: string, signal?: AbortSignal): Promise<string> {
    const query = new URLSearchParams({
      VMClassId: `MAINMENU;${actionName}`,
      ResetServerApp: "false"
    });
    const response = await this.request(`Open?${query.toString()}`, { signal });
    return response.text();
  }

  async sendUpdates(commands: readonly ClientCommand_Update[], signal?: AbortSignal): Promise<void> {
    if (commands.length === 0) {
      return;
    }
    await this.request("UpdateMany", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal
    });
  }

  async executeAction(command: ClientCommand_ActionExecute, signal?: AbortSignal): Promise<void> {
    await this.request("Action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal
    });
  }

  async executeRowAction(command: ClientCommand_ActionRowClickExecute, signal?: AbortSignal): Promise<void> {
    await this.request("ActionRowClick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal
    });
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const response = await this.fetcher(this.apiBaseUrl + path, init);
    if (!response.ok) {
      throw new Error(`Turnkey request failed (${response.status} ${response.statusText}): ${path}`);
    }
    return response;
  }
}
