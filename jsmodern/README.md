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

## Component extension contract

A control can request an application-provided Lit component with the
`Lit_Ext_Component` tagged value (also accepts the earlier `LitComponent`
and `Blazor_Ext_Component` spellings). For example:

```xml
<taggedvalue tag="Lit_Ext_Component" value="MySVGChart" />
```

This loads `/L/components/custom/my-svg-chart/index.js`; the module must register
the `tk-lit-custom-my-svg-chart` custom element. PascalCase component names are
normalized to lowercase kebab-case folders. Add the file under
`jsmodern/components/custom/my-svg-chart/` and deploy it as a static asset. The
Lit client does not need rebuilding when an extension file is added or changed.

The custom element receives a `context` property with the control metadata,
bound object and value (or collection rows), resolved label, placeholder,
helper text and style, visibility/enabled/read-only state, `isGridCell`, and
`minSize` in pixels. The minimum width and height use the view's
`VMColWidth`/`VMColHeight` (or `VMRowHeight`) multiplied by the control's
`ColSpan`/`RowSpan`; the wrapper enforces these as minimum dimensions without
forcing a fixed size.
Use `context.onChange(value)` to request a bound value update and
`context.executeAction(actionName, event)` to invoke an action; the client
continues to own all Turnkey communication. Components may be rendered in a
standalone control or in a grid cell. They should implement a `context` setter
and update their presentation when it changes.

```js
class SalesChart extends HTMLElement {
  set context(value) {
    this._context = value;
    this.render();
  }

  render() {
    if (!this._context) return;
    const summary = document.createElement("pre");
    summary.textContent = JSON.stringify(this._context.value ?? this._context.collection);
    this.replaceChildren(summary);
  }
}

customElements.define("tk-lit-custom-sales-chart", SalesChart);
```

Component names are restricted to lowercase kebab-case and map only to
`components/custom/{normalized-name}/index.js` on the same origin. Extensions are trusted
application code. An invalid name, missing file, failed module, or module that
does not register its expected custom element displays a visible fallback
showing the component name, expected file, and load error.

Standard control overrides live separately in `components/overrides/`. For
example, `components/overrides/tk-textfield/index.js` replaces the default
`tk-textfield` renderer globally without requiring a metadata tag. Override
modules register `tk-lit-override-textfield` and receive the same `context`
contract as custom components. Add active override control tags to
`components/overrides/manifest.json`; the client loads that manifest once and
only imports declared overrides, avoiding 404 probes for missing components.
Undeclared overrides leave the bundled standard renderer active. See the folder READMEs and
`components/overrides/tk-textfield/index.js.example` for the copy-and-edit workflow.

Bundled standard renderers for buttons, checkboxes, date pickers, selects,
text areas, text fields, typography, and data grids live in individual
`src/components/standard/tk-*/` folders. The standard grid renderer owns its
table UI and interactions; the app shell supplies state and Turnkey callbacks.

Built-in control markup now carries MDriven class hooks, including
`tk-component`, `tk-input-field__*`, `tk-select__*`, `tk-checkbox__*`,
`tk-button__*`, `tk-data-table__*`, `tk-label__*`, `tk-input-field__helper`,
and `tk-select__dropdown-icon`. Dynamic `_Label`, `_Placeholder`,
`_HelperText`, `_Style`, `_Visible`, `_Enabled`, and `_ReadOnly` companion
attributes are resolved from the bound object, with the corresponding
`VM_Status` value as fallback where available. These class names are the
starting point for aligning the Lit client with the MDriven standard styles.
Numeric `StringFormat` metadata is applied for display while keeping formatted
numeric input editable and sending a numeric value back to Turnkey.
The global client stylesheet loads the Turnkey server's local Material Icons
font through a path relative to `/L/turnkey-lit.css`, with WOFF2 and TTF
sources, matching the existing Turnkey font definitions. It renders `Icon`
tagged values such as `3k_plus` and `10mp`.

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

This is the first metadata-driven rendering slice. Runtime custom-component
loading is available for trusted application extensions. Built-in control
rendering is being separated incrementally; validation behavior, uploads, and
complete navigation behavior remain subsequent migration work.
# Shared Turnkey styles

The client loads the shared Turnkey stylesheets from `/Content` and the
model-specific stylesheet from `/L/Turnkey/StylesInModelCss`. Shared styles are
also linked into the Lit shadow root so they apply to rendered controls. The
model stylesheet's `unique` query value follows the SignalR connection ID and
is refreshed after reconnects.

`LController` replaces `__TURNKEY_APP_VERSION__` in `index.html` with the
server assembly's informational version (falling back to its assembly version).
This versions static stylesheet and JavaScript URLs to invalidate caches when
the deployed build changes. Set the assembly informational version in the
deployment build if it should match a specific Turnkey release.
