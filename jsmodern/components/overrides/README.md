# Standard control overrides

Place a runtime control override in a folder named for the exact control tag and
add its tag to `manifest.json`:

```text
overrides/manifest.json
overrides/tk-textfield/index.js
overrides/tk-data-grid/index.js
```

```json
{
  "overrides": ["tk-textfield", "tk-data-grid"]
}
```

`tk-textfield/index.js.example` is a small copyable override example. Copy it
to `tk-textfield/index.js` and edit the component implementation; the example
preserves the standard textfield class and binding callback pattern.

The client fetches `manifest.json` once per page load and imports only declared
overrides from `/L/components/overrides/{control-tag}/index.js`. This avoids
probing for absent files and producing expected 404s in the browser console.
An override module must register the corresponding element name, for example
`tk-lit-override-textfield` for `tk-textfield`.

The element receives a `context` property implementing the contract documented
in `../../README.md`. Treat override modules as trusted application code.
Missing override files are normal and cause the bundled standard renderer to
be used.

The left-side action menu can also be replaced at runtime by adding
`"LeftSideMenu"` to the manifest and providing
`left-side-menu/index.js`. Register the custom element as
`tk-lit-override-left-side-menu`; it receives the app-owned action groups,
open/mobile state, and action callback described by
`../../src/components/standard/left-side-menu/context.ts`. Without this manifest entry, no menu
override file is requested.

The view toolbar (shown when a view has `ToolBarLeft`/`ToolBarRight` actions) can
be replaced the same way: add `"Toolbar"` to the manifest and provide
`toolbar/index.js` registering `tk-lit-override-toolbar`. It receives the
`ToolbarContext` from `src/components/standard/toolbar/context.ts` (left and right
entries, where a named entry is a submenu, plus an action callback).
