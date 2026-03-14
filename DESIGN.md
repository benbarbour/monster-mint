# Monster Mint Design Doc

## Purpose

This document turns the product description in `README.md` into an implementation plan for a complete, browser-based
token sheet designer and printer.

The design assumes:

- no backend
- all user data lives in browser storage unless explicitly exported
- the app is distributable as a single HTML file
- the app source is modular during development and bundled into one distributable HTML file
- the first implementation should optimize for reliable printing over visual novelty

## Product Goals

Monster Mint should let a user:

1. Define reusable sequences of text and colors.
2. Design circular tokens in common tabletop sizes.
3. Preview the fully expanded result of those token designs.
4. Print front pages and optional back pages aligned for physical assembly.
5. Save projects locally and move them between browsers via JSON export/import.

## Non-Goals

These are intentionally out of scope for v1 unless later requested:

- user accounts or cloud sync
- collaboration or shared libraries
- raster image editing inside the app
- arbitrary vector drawing tools
- full desktop publishing features
- automatic image background removal

## Core Requirements

Derived from `README.md`:

- Support token diameters: `0.5"`, `1"`, `2"`, `3"`, `4"`, `5"`.
- Support selectable page sizes.
- Lay out printable pages with bleed and cut/punch guides.
- Token fronts can include:
  - multiple independently positioned text components
  - each text component uses either custom text or one text sequence
  - configurable font
  - configurable text color
  - configurable border thickness
  - configurable border color
  - optional drop shadow
  - optional uploaded image
- Token backs can include a backside image and print on separate page(s).
- Sequence values can be numerical, alphabetical, or custom.
- Color sequences can be defined and referenced by visual properties.
- All data persists in local browser storage.
- Projects can be exported to JSON and imported from JSON.
- The app should be written so it can be shipped as one HTML file.

## Product Decisions

These decisions make the README concrete enough to implement:

- The app will be a single-page application with three tabs: `Settings`, `Designer`, and `Print`.
- Token design is template-based: users create token templates, then print one or more copies of each template.
- Rendering will use SVG for both token preview and printable pages.
- Uploaded images will be normalized into data URLs for persistence and print stability.
- The print system will generate page previews in-app, then hand those pages to the browser print dialog.
- Layout will optimize for consistent margins and punch/cut usability, not maximum token density at all costs.
- Back-side printing will use `same-order` positioning in v1 because it is the simpler implementation path.

## Technical Approach

### Stack

- Plain HTML, CSS, and JavaScript.
- No required backend.
- No required build step for runtime usage.

Recommended source organization during development:

- `src/` for modular JS/CSS/template sources
- a small build script that emits a final self-contained `dist/monster-mint.html`

If strict no-build authoring is preferred, the same architecture can live in one hand-authored HTML file with modular
JS objects. The build-to-single-file route is cleaner for maintainability while still meeting the distribution goal.

### Why SVG

SVG is the best fit for this app because it provides:

- precise physical sizing in print
- easy circles, borders, masks, and cut guides
- cleaner text rendering than canvas for print workflows
- simpler export/debugging than a canvas-only pipeline

Raster images will be embedded into SVG using data URLs where possible.

## High-Level Architecture

The app can be implemented as six logical modules, even if bundled into one HTML file:

1. `state`
   - owns the project model
   - handles mutations, validation, undo-ready update patterns
2. `storage`
   - localStorage persistence
   - import/export serialization
   - asset normalization
3. `sequences`
   - sequence definitions
   - per-copy sequence expansion
   - index selection rules
4. `designer`
   - token template editor
   - front/back preview rendering
5. `layout`
   - printable page packing
   - bleed, cut guides, registration/alignment helpers
6. `print`
   - preview pages
   - print-specific DOM generation

## Data Model

### Project

```json
{
  "version": 1,
  "meta": {
    "name": "Goblin Set",
    "updatedAt": "2026-03-13T00:00:00.000Z"
  },
  "settings": {
    "pagePresetId": "letter",
    "pageOrientation": "portrait",
    "pageMarginIn": 0.25,
    "bleedIn": 0.0625,
    "guideStyle": "cut-and-punch"
  },
  "sequences": {
    "text": [],
    "color": []
  },
  "tokens": [],
  "printSelections": []
}
```

### Text Sequence

```json
{
  "id": "seq_text_1",
  "name": "Goblin Numbers",
  "type": "numeric",
  "start": 1,
  "step": 1,
  "prefix": "",
  "suffix": "",
  "padTo": 0,
  "customValues": []
}
```

Supported types:

- `numeric`
- `alphabetic`
- `custom`

### Color Sequence

```json
{
  "id": "seq_color_1",
  "name": "Faction Colors",
  "values": ["#5B3A29", "#8A1C1C", "#3B5B92"]
}
```

### Token Template

```json
{
  "id": "token_1",
  "name": "Goblin Frontliner",
  "diameterIn": 1,
  "front": {
    "backgroundColor": "#f3e7c9",
    "image": {
      "type": "uploaded",
      "source": "data:image/png;base64,...",
      "fit": "cover"
    },
    "texts": [
      {
        "id": "text_1",
        "x": 0.5,
        "y": 0.62,
        "width": 0.7,
        "height": 0.18,
        "contentMode": "sequence",
        "customText": "",
        "textSequenceRef": "seq_text_1",
        "fontFamily": "Georgia",
        "fontWeight": 700,
        "colorMode": "manual",
        "color": "#111111",
        "colorSequenceRef": null,
        "shadow": {
          "enabled": true,
          "dx": 1,
          "dy": 1,
          "blur": 1,
          "color": "rgba(0,0,0,0.5)"
        }
      }
    ],
    "border": {
      "enabled": true,
      "widthPt": 2,
      "colorMode": "manual",
      "color": "#000000",
      "colorSequenceRef": null
    }
  },
  "back": {
    "enabled": false,
    "backgroundColor": "#ffffff",
    "image": null,
    "texts": []
  }
}
```

### Print Selection

```json
{
  "tokenId": "token_1",
  "copies": 12,
  "sequenceStartIndex": 0
}
```

## Placeholder and Sequence Rules

### Text Component Rules

Each text component is configured in one of two modes:

- `customText`
- `sequence`

Rules:

- a component in `customText` mode renders its literal text for every copy
- a component in `sequence` mode renders exactly one referenced text sequence value for each copy
- multiple text components are allowed on a token
- text components can be positioned independently anywhere inside the token's enclosing square bounds
- text is centered within each component box
- font size is derived automatically from the component bounding box rather than entered directly
- resizing a text component with the mouse changes the rendered font size
- the renderer should choose the largest font size that fits the text within the component box as closely as possible
- text is clipped to the component bounding box if it still overflows
- text component boxes cannot extend outside the token's enclosing square bounds
- text always renders above images, borders, and background fills

### Color Binding Rules

Any color-bearing property can be configured in one of two modes:

- `manual`
- `sequence`

Initial color-capable properties:

- text fill color
- border color
- background color

Rules:

- `manual` uses a literal color value
- `sequence` uses one referenced color sequence value for each printed copy
- all sequence-backed properties on a given token advance using the same per-copy index

### Copy Limit Rules

The print UI should cap the allowed `copies` for a token selection based on the shortest finite sequence referenced by
that token.

Rules:

- numeric sequences are treated as unbounded
- alphabetic sequences are treated as unbounded
- custom text sequences are bounded by `customValues.length`
- color sequences are bounded by `values.length`
- if a token uses multiple bounded sequences, `maxCopies` is the minimum available length among them
- if a token uses no bounded sequences, copies are limited only by practical layout/page concerns

### Alphabetic Sequence Rules

Proposed behavior:

- `A` through `Z`, then `AA`, `AB`, etc.
- optional lowercase toggle can be added if needed

### Custom Sequence Rules

Proposed behavior:

- explicit ordered list of values
- print count cannot exceed the list length when the sequence is in use
- values do not wrap

## Rendering Model

Each token preview/render is built from layered SVG elements:

1. bleed circle
2. clipped background/image layer
3. border stroke
4. one or more text component layers
5. cut guide / punch guide overlay for print mode only

### Text Fitting

Text layout for each text component should follow these rules:

- the component rectangle defines the text layout box
- text is horizontally and vertically centered within that box
- font size is computed from the box dimensions and current text content
- the fit algorithm should maximize font size while keeping the full text visible when possible
- if exact fitting is not possible, overflow is clipped to the box bounds
- resizing the box in the designer immediately recomputes the fitted font size

This makes the text component behave more like a drawing tool text frame than a traditional form field.

### Component Bounds

All editable component rectangles must remain fully inside the token's enclosing square bounding box.

Rules:

- the token coordinate system is normalized to the square that encloses the circular token
- dragging must clamp component positions so no edge crosses the square bounds
- resizing must clamp width and height so the component remains fully inside the square bounds
- this rule applies to both text components and image components
- components may overlap one another
- components may occupy areas of the square that fall outside the visible circle, but never outside the square itself

### Physical Sizing

Use inches as the primary logical unit in state, converted to print pixels only at render time.

For preview:

- render at a fixed preview DPI, such as `96`

For print:

- emit CSS and SVG dimensions using physical units (`in`, `pt`, `mm`) rather than screen pixels

This reduces printer scaling errors and keeps output inspectable.

## Page Layout Engine

### Page Presets

Initial presets:

- US Letter
- A4

Each preset includes:

- width
- height
- printable margin default
- portrait/landscape support

### Packing Strategy

V1 should use a deterministic grid packer:

- group selected tokens by diameter
- compute bounding box per token including bleed and desired spacing
- place tokens left-to-right, top-to-bottom
- start a new page when no further tokens fit

This is simpler and more predictable than irregular bin packing and is sufficient for circular tokens on printable
paper.

### Guide Strategy

Each token instance gets:

- optional outer cut circle or crop marks
- optional center crosshair or punch alignment guide
- consistent gutter between tokens to allow cutting/punching

Guide styles:

- `none`
- `cut`
- `punch`
- `cut-and-punch`

## Front/Back Printing Model

Back sides are rendered on separate pages using the same token positions and page breaks as the corresponding front
pages.

V1 will use `same-order` positioning for back pages. Front and back pages share identical token coordinates and page
breaks, without horizontal mirroring.

## Image Handling

### Supported Sources

- uploaded files

### Normalization Pipeline

1. Load image source.
2. For SVGs, preserve as SVG when possible.
3. For raster images, convert to a data URL for storage.
4. Store the normalized asset in project JSON.

### Constraints

V1 is upload-only for images. External URL loading is out of scope.

## Persistence and Serialization

### Local Storage

Use one primary localStorage key for the latest working project:

- `monster-mint.project.v1`

Optional secondary keys:

- `monster-mint.ui.v1` for non-essential UI state

### Export Format

Export the entire project as formatted JSON.

Requirements:

- include a `version`
- include all normalized assets needed for offline re-import
- validate before import
- support migration hooks for future schema versions

## UI Design

### Settings Tab

Primary responsibilities:

- manage page defaults
- create/edit/delete text sequences
- create/edit/delete color sequences
- configure global print defaults

Suggested panels:

- page setup
- text sequences
- color sequences
- import/export

### Designer Tab

Primary responsibilities:

- create/edit token templates
- live front/back preview
- assign image, multiple text components, border, and sequences

Suggested layout:

- left sidebar: token list
- center: large token preview
- right inspector: editable properties

Important UX behaviors:

- show real physical size and zoomed preview modes
- allow arbitrary positioning of text components within the token's enclosing square bounds
- allow drag-and-drop placement of text components and images directly on the token preview
- allow resizing of text components by drag handles, with font size updating automatically from the box size
- expose numeric position and size controls for precise placement
- allow duplicate token template action

### Print Tab

Primary responsibilities:

- choose tokens to print
- set copy counts
- preview expanded tokens and pages
- print front and back pages

Suggested layout:

- selection table with token, size, copies, starting sequence index
- preview area with page thumbnails
- print controls for fronts, backs, or both

## Validation Rules

The app should prevent printing when:

- a token references a missing sequence
- requested copies exceed the shortest bounded sequence used by that token
- a required backside image is invalid
- the page layout produces zero printable area

The app should warn, but not necessarily block, when:

- text may overflow the token circle
- printer margins are tight
- imported project version is older and migrated

## Error Handling

Errors should be local and actionable:

- inline field validation in designer/settings
- asset load failure banners with retry/remove actions
- print preview error summary before invoking print

Avoid modal-heavy UX except for import overwrite confirmation.

## Testing Strategy

### Unit-Level Logic

Test pure functions for:

- numeric/alphabetic/custom sequence expansion
- diameter/bleed/unit conversions
- page packing
- front/back page position reuse
- schema validation and migrations

### Browser-Level Scenarios

Test these end-to-end flows:

1. Create numeric sequence, assign to token text, print 10 copies.
2. Create color sequence, bind to border color, verify expansion.
3. Upload front image, add backside image, print both sides.
4. Export project, clear storage, import project, verify fidelity.
5. Create multiple text components, position them independently, and verify layering above artwork.

## Delivery Plan

### Phase 1: Foundation

- project schema
- localStorage save/load
- basic tab shell
- page preset model

### Phase 2: Sequence System

- text and color sequence CRUD
- sequence binding and per-copy expansion
- validation

### Phase 3: Token Designer

- token template CRUD
- SVG token preview
- drag-and-drop text/image positioning
- drag-resize text components with auto-fit text sizing
- text/image/border controls
- backside support

### Phase 4: Print Pipeline

- grid layout engine
- print preview pages
- front/back print modes
- guide overlays

### Phase 5: Import/Export and Polish

- JSON export/import
- migration scaffolding
- validation UX
- paper-fit polish

## Risks

### Browser Print Variance

Browsers and printers can still scale or clip unexpectedly.

Mitigation:

- use physical CSS units
- recommend printing at `100%` scale in the UI

### Single-File Maintainability

A literal one-file source implementation can become difficult to maintain.

Mitigation:

- keep source modular during development
- emit a single distributable HTML artifact

## Open Questions

No blocking product questions remain from the original README.

## Recommended Defaults

If you want implementation to begin immediately, these are the recommended defaults:

- modular source + build to single HTML for distribution
- multiple independently positioned text components
- drag-and-drop image and text placement with numeric controls for precision
- text size derived from the text box dimensions, with centered auto-fit and clipping
- each text component chooses either custom text or one text sequence
- sequence-backed copy counts are capped by the shortest bounded sequence in use
- back-side mode is `same-order`
- page presets: Letter and A4
- upload-only images
