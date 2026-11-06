const COUNTDOWN_SECONDS = 30;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export interface InactivityTimeoutOptions {
  readonly onTimedOut: () => void;
}

// Mirrors the AngularJS client: after N idle minutes a dialog counts down 30 seconds, then the session is ended.
export class InactivityTimeout {
  private minutes = 0;
  private lastActivity = Date.now();
  private tick: number | undefined;
  private dialog: HTMLDialogElement | undefined;
  private deadline = 0;
  private countdown: HTMLElement | undefined;

  constructor(private readonly options: InactivityTimeoutOptions) {}

  private readonly handleActivity = (): void => {
    if (!this.dialog) {
      this.lastActivity = Date.now();
    }
  };

  start(minutes: number): void {
    this.minutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
    this.lastActivity = Date.now();
    this.dismissDialog();
    if (this.minutes <= 0) {
      this.stop();
      return;
    }
    if (this.tick === undefined) {
      for (const name of ACTIVITY_EVENTS) {
        window.addEventListener(name, this.handleActivity, { capture: true, passive: true });
      }
      this.tick = window.setInterval(() => this.check(), 1000);
    }
  }

  noteActivity(): void {
    this.handleActivity();
  }

  stop(): void {
    if (this.tick !== undefined) {
      window.clearInterval(this.tick);
      this.tick = undefined;
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, this.handleActivity, { capture: true });
      }
    }
    this.dismissDialog();
  }

  private check(): void {
    const now = Date.now();
    if (this.dialog) {
      const left = Math.ceil((this.deadline - now) / 1000);
      if (left <= 0) {
        this.dismissDialog();
        this.options.onTimedOut();
        return;
      }
      if (this.countdown) {
        this.countdown.textContent = String(left);
      }
      return;
    }
    if (now - this.lastActivity >= this.minutes * 60000) {
      this.showDialog(now);
    }
  }

  private showDialog(now: number): void {
    this.deadline = now + COUNTDOWN_SECONDS * 1000;
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "Session timeout");
    dialog.style.cssText = "border:0;border-radius:4px;box-shadow:0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14);max-width:90vw;padding:24px;";
    const text = document.createElement("p");
    text.style.cssText = "margin:0 0 24px;";
    this.countdown = document.createElement("strong");
    this.countdown.textContent = String(COUNTDOWN_SECONDS);
    text.append("Due to inactivity, your session will be timed out in ", this.countdown, " seconds.");
    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
    const makeButton = (label: string, handler: () => void): HTMLButtonElement => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText = "background:transparent;border:0;cursor:pointer;font:inherit;font-weight:600;padding:8px 12px;text-transform:uppercase;";
      button.addEventListener("click", handler);
      return button;
    };
    buttons.append(
      makeButton("cancel", () => this.start(this.minutes)),
      makeButton("ok", () => { this.dismissDialog(); this.options.onTimedOut(); })
    );
    dialog.append(text, buttons);
    dialog.addEventListener("cancel", event => { event.preventDefault(); this.start(this.minutes); });
    document.body.append(dialog);
    dialog.showModal();
    this.dialog = dialog;
  }

  private dismissDialog(): void {
    this.dialog?.close();
    this.dialog?.remove();
    this.dialog = undefined;
    this.countdown = undefined;
  }
}
