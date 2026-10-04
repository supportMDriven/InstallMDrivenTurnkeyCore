# MDriven Turnkey Lit client

This directory is the independent Lit and TypeScript client. It is being
developed alongside the existing AngularJS and Blazor clients; it does not
replace or share their frontend runtime.

## Run against a Turnkey server

Install dependencies and build the client:

```sh
npm install
npm run typecheck
npm run build
```

The server serves this directory's static files under `/L/` and returns
`index.html` at `/L`. Open `/L#/Index` on a running Turnkey server to exercise
the client against its `api/Open`, `api/ServerStream`, and `api/UpdateMany`
endpoints. Hash routes accept the existing view, object-id, debug, and user
control parent segments. The base URL in `index.html` keeps assets and client
requests resolving correctly when the document is served at `/L`.
The application name links back to `/L#/Index`, with the global menu alongside
it in the top header. Opening one global-menu dropdown closes other open menus
while leaving its own nested submenu path available.

## Current scope

`core/` contains the framework-independent Turnkey HTTP transport, stream
command decoder, and per-view state store. Associations and collections refer
to view-model IDs rather than holding parent object links. The Lit shell
fetches `GlobalActionsMeta2` once for its app-wide menu, then fetches the
Blazor client's `ViewMetaBlazorClient` XML description per view. The menu and
its state survive hash-route changes. Active view sessions, including their
view-model data and server message cursor, are cached by view name and root
object ID for eight minutes; parsed view layouts are cached by view name.
Returning to a cached view resumes polling from its saved cursor. Nested
placing containers, wrapper styles, and generated layout styles from view
metadata drive flexbox/grid layouts and
basic text, numeric, date, picklist, and collection-table controls. Picklists
send the selected item's external ID through the bound column's `_AsExternalId`
companion, matching the existing Turnkey clients. The streamed current choice
is reflected on its matching option, including null choices. Collection
rows can be selected (updating `vCurrent`) and expose actions from streamed
Turnkey action commands through a row menu; double-click executes the first
enabled navigating row action in server sort order. Grid cells use column
headers as their visible labels instead of repeating control labels per row.
Grid headers sort the displayed rows locally, and their resize handles adjust
column widths without changing the server-side collection order. Rows are
rendered by VMClassId so edited rows retain a single stable DOM row while
moving to their new sorted position.
Grids tagged `MultiSelect=True` show a checkbox column that updates each row's
`vSelected` state independently of the single-current-row `vCurrent` state.
Row actions use Turnkey's
`ActionRowClick` endpoint with the row VMClassId, and server navigation
commands drive the client route using the server-provided view and context ID.
The left action panel combines actions for the current view, current nested
row, and application-level Save/Cancel actions from the server stream. A
hamburger toggle collapses the panel on desktop; it auto-collapses on narrow
screens and opens as a dismissible overlay without shifting the view.
Application-level actions appear first without group or subgroup headings.
The status message appears below the view content and remains hidden while its
message is an `OK` status.
Metadata-described buttons execute their bound view-model action via the
Turnkey `Action` endpoint; resulting stream commands update the view state,
including collection inserts/removals. Actions marked modal open in a native
HTML `<dialog>` using Turnkey's `OpenModal` flow. The dialog renders its own
view and supports normal view controls and actions, floating above the still
visible parent view with a mostly transparent backdrop. The dialog itself
omits the global menu and left action panel. Its footer has OK and Cancel
controls; OK is enabled only when the modal's `VM_Status.ModalOk_Enable` is
true. Cancel asks
for confirmation if Turnkey reports unsaved changes. Closing it (including
Escape) calls `ClosingModal`, restores the parent view, and applies its
resulting stream commands. Actions marked as popups use the same Turnkey
opening flow in a compact, click-positioned overlay, leaving the parent view
visible behind it. They omit the OK/Cancel footer and close when the user
clicks outside; that close is reported to Turnkey as accepted. The client also
connects to the Turnkey SignalR hub and sends edited values back through
`UpdateMany`.

This is the first metadata-driven rendering slice. Complex/custom components,
validation behavior, uploads, and complete navigation behavior remain
subsequent migration work.
