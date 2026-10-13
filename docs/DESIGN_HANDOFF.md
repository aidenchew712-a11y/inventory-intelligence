# Stockroom design handoff

Figma: https://www.figma.com/design/j6NB9j1J3uZwkmqKJ3Tq6p

The UI foundation file contains semantic color variables aliased to primitives, geometry tokens, four text styles, six button variants, three stock-status variants, three input variants, and a metric-card component. Variables declare property scopes and web CSS syntax. The Starter plan uses a single Light mode.

## Visual direction

A deep green sidebar, warm neutral surfaces, restrained lime accents, and stock-status colors support a calm operational workspace. Status includes text and a marker. The public site introduces the product; the workspace emphasizes quantities, stock valuation, and replenishment decisions.

Figma uses Inter as its available reference font. The deployed app uses Arial/Helvetica system fallback without an external font request.

## Code mapping

| Design token | CSS contract |
| --- | --- |
| Primary text / brand | --ink |
| Secondary text | --muted |
| Workspace background | --paper |
| Panel background | --surface |
| Default border | --line |
| Navigation selection | --accent |
| Sidebar background | --sidebar |
| Stock status | --status-healthy-*, --status-low-*, --status-out-* |
| Spacing | --space-sm, --space-md, --space-lg |
| Corner radius | --radius-control, --radius-panel, --radius-status |

## Responsive behavior and interactions

- Desktop uses persistent navigation and a four-card metric row.
- Below 1150px, metrics use two columns.
- Below 700px, navigation becomes an explicitly opened drawer. Closed navigation is hidden from assistive technology.
- Wide inventory tables scroll within their own container. Page-level horizontal overflow is tested.
- Dialogs use the native modal behavior for focus containment, Escape handling, and focus restoration.
- Pending forms disable submission. Errors are announced within the dialog, and successful operations have a status message.
- Operational charts provide a data-table alternative.
- Reduced-motion preferences disable UI transitions.

Screenshots in docs/screenshots/ show the code design. Figma node IDs and token IDs are recorded in figma-state.json for maintenance.
