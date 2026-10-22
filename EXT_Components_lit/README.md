# Metadata-selected custom components

Place each metadata-selected component in its own folder:

```text
<normalized-name>/index.js
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

The `sharepoint-documents-interaction-web` component supports document-reference
collections. It gets the owning view-model class and collection column from
`context.metadata.attributes.BindInfoNesting` and `BindInfoColumn`; it expects
the existing Turnkey conventions for `AddDocRef`, `WebDocRefUrlAdd`, the
`vDocRef` view variable, `DocumentProperties`, and row attributes `Type` and
`Name`. It uses the context APIs for attribute updates, status and variable
reads, row selection, and row actions, so the component does not depend on a
specific view-model class name.

The `timeline-chart` and `stepped-area-chart` components reuse Google Charts for
the matching Angular chart types. Both import the lazy loader in `_shared/`,
which loads `https://www.gstatic.com/charts/loader.js` only when a chart is used
and caches chart package loads across components. Timeline rows use `Position`,
`Name`, `Start`, and `End`; stepped-area rows use `RowDate`, `Legend1`, and
`Legend2`, with semicolon-separated legend labels in the bound object's
`<BindInfoColumn>_legend` attribute.
