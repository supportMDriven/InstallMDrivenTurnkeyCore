# Standard Lit controls

Each extracted standard renderer lives in its own `src/components/standard/tk-*/`
folder with `index.ts` as its entry point. Shared presentation and formatting
helpers are alongside those folders. The data grid renderer lives in
`tk-data-grid/`; it receives resolved row objects and UI callbacks from the app
shell, which retains Turnkey communication and view-state ownership. Sorting,
resizing, current/multi-row selection, row actions, and cell-control rendering
are part of the standard grid renderer. MDriven `tk-*` class names are part of
the standard styling contract and should be preserved.

For bound controls, a non-empty viewmodel `{Column}_Style` value takes
precedence over metadata `StaticStyle`; otherwise `StaticStyle` is used. Use
the shared helpers in `presentation.ts` to place that effective style together
with expected base classes on the outer control, in-grid container, and native
control. The helpers also add view binding classes only outside grid cells and
the `--in-grid` base class variants where applicable.

Data-grid headers can be dynamically named by adding a string attribute
`{GridColumn}_{ChildColumn}_Label` to the grid's owning viewmodel object. A
non-empty value takes precedence over the child column's `StaticLabel`, then
its binding column name is used as fallback.

The application left-side action menu is rendered by `left-side-menu/`. The app
provides its grouped action data and callbacks; the component does not own
Turnkey communication or action state. To replace it at runtime, add
`"LeftSideMenu"` to `components/overrides/manifest.json` and provide
`components/overrides/left-side-menu/index.js`, registering
`tk-lit-override-left-side-menu`. Its element receives a `context` property
matching `LeftSideMenuContext` from `left-side-menu/context.ts`.

`tk-file-upload` and `tk-image-upload` are standard controls backed by Turnkey's
`UploadFileMultiPart` endpoint. The app owns upload transport, progress/error
state, and refreshes view state after successful uploads; the components own
the file picker and control presentation. Image uploads render the bound image
URL supplied by the viewmodel.

Metadata `IsListView="True"` placing containers are intentionally handled by
the generic app renderer rather than by a component. The app resolves their
`PlacingContainerListViewRootVMClass` and
`PlacingContainerListViewRootVMColumn` binding, repeats the nested flexbox
layout for each collection object, and owns row selection, double-click
navigation, and row context actions.

Placing containers may specify `PCStyleColumn` and `PCVisibleColumn` metadata
attributes. These name columns on `PlacingContainerOwnerVMClass`; the current
row supplies that owner inside a ListView, otherwise the current viewmodel
object is used. A false visibility value omits the container, and a non-empty
style-column value is added as a class alongside the metadata class.

Use the matching `tk-*` metadata tag as the standard implementation name when
creating an override. Runtime override modules are separate from these bundled
standard implementations; copying or modifying an override does not require
rebuilding the Lit client.
