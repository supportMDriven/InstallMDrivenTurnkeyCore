import { css, html, TemplateResult } from "lit";
import { ViewLoadingContext } from "./context";

export const viewLoadingStyles = css`
  .view-loading { align-content: center; box-sizing: border-box; color: #52616b; min-height: 12rem; padding: 2rem; text-align: center; }
  .view-loading__gear { animation: view-loading-spin 4s linear infinite; color: #7d8b95; display: block; margin: 0 auto 0.5rem; }
  @keyframes view-loading-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .view-loading__gear { animation-duration: 12s; } }
`;

// Shown in the content area while a view's description and data are being loaded.
export function renderViewLoading(context: ViewLoadingContext): TemplateResult {
  return html`<section class="view-loading" role="status" aria-busy="true">
    <svg class="view-loading__gear" viewBox="0 0 24 24" width="48" height="48" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.3 7.3 0 0 0-1.69-.98l-.38-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>
    </svg>
    <h2>${context.viewName}</h2>
    <p>Loading view…</p>
  </section>`;
}
