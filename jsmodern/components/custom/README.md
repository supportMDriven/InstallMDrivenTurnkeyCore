# Metadata-selected custom components

Place each metadata-selected component in its own folder:

```text
custom/<normalized-name>/index.js
```

Select a component by setting the `Lit_Ext_Component` tagged value (or its
`LitComponent` alias). PascalCase names are normalized to lowercase kebab-case;
for example, `MySVGChart` loads `my-svg-chart/index.js`. The module must
register `tk-lit-custom-my-svg-chart` and accept the documented `context`
property. Unlike a missing standard override, a missing explicitly requested
custom component is a configuration error and is shown in the view.

The `my-svg-chart` example used by `ViewOneThingWithMoreThings` renders the
`LabelX` and numeric `ValueY` attributes from each row in its bound collection
as a responsive SVG line chart.
