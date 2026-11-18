# Standard control overrides

Place a runtime control override in a folder named for the exact control tag and
add its tag to `manifest.json`:

The manifest is optional. If it is absent, the bundled standard renderers are
used. Copy `not-in-effect-manifest.json` to `manifest.json` to enable and
configure the example overrides; the example file itself is not loaded.

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
Other manifest errors, such as invalid JSON or a server error, are reported.

The element receives a `context` property implementing the contract documented
in `../../README.md`. Treat override modules as trusted application code.
Controls without a manifest entry use the bundled standard renderer.

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

To replace the view loading placeholder, add `"ViewLoading"` to the manifest
and provide `view-loading/index.js` registering `tk-lit-override-view-loading`.
The element receives a `context` property with the `viewName` being opened;
see `view-loading/index.js.example`. The placeholder is shown while a view is
loading, not necessarily when returning to an already cached view.
The custom element stretches to the available loading area. To center its
content vertically, give its inner container `height: 100%` and
`box-sizing: border-box`, then use flex or grid alignment.

## Global header parts

These named overrides can be enabled independently in the `overrides` array:

| Manifest name | Folder | Custom element |
| --- | --- | --- |
| `LeftSideToggle` | `left-side-toggle` | `tk-lit-override-left-side-toggle` |
| `ApplicationName` | `application-name` | `tk-lit-override-application-name` |
| `GlobalActions` | `global-actions` | `tk-lit-override-global-actions` |
| `HeaderSpace` | `header-space` | `tk-lit-override-header-space` |
| `LoginSection` | `login-section` | `tk-lit-override-login-section` |

For example, to replace the application name and the empty space:

```json
{
  "overrides": ["ApplicationName", "HeaderSpace"]
}
```

For each enabled name, provide `index.js` in its folder and register the listed
element. The element receives a `context` property, updated as state changes.
For a copyable example, see `header-space/index.js.example`. The interfaces are
defined in `../../src/components/standard/global-header/context.ts`:

- `LeftSideToggle`: `available`, `open`, `mobileViewport`, and `onToggle()`.
  Respect `available`; `onToggle()` also persists the sidebar preference.
- `ApplicationName`: `name` and `homeUrl`.
- `GlobalActions`: the nested `items`, `actionStatus` map, and `onAction(item)`.
  Items contain `actionName`, `presentation`, `children`, `newTab`, and
  optional `divider`; use the status map to respect visibility and enabled
  state. The additional menu/pointer callbacks are used by the standard menu.
- `HeaderSpace`: `applicationName` and the current `viewName`. Its standard
  implementation is empty. Its container fills the space between the actions
  and login section on desktop.
- `LoginSection`: server-supplied `markup`, the current `returnUrl`, and
  `onClick(event)` for the server logout link. The standard renderer uses the
  trusted server markup, including its login and registration links. A custom
  component may instead render its own links and must handle its own return URL.

The mobile menu expand button and responsive header shell remain built in.
Override elements that use their own shadow roots must provide their own styles.
