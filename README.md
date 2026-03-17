# Monster Mint

Monster Mint is a single-page token designer for tabletop play. It lets you build circular token templates with images, text, borders, colors, and sequences, then lay those tokens out on printable pages with cut guides so they can be punched or cut out and glued to physical backing.

The project is built as modular source code, but the distributable is one self-contained HTML file: [dist/monster-mint.html](/home/ben/code/monster-mint/dist/monster-mint.html).

## GitHub

[![CI](https://github.com/benbarbour/monster-mint/actions/workflows/ci.yml/badge.svg)](https://github.com/benbarbour/monster-mint/actions/workflows/ci.yml)
[![Release](https://github.com/benbarbour/monster-mint/actions/workflows/release.yml/badge.svg)](https://github.com/benbarbour/monster-mint/actions/workflows/release.yml)

- Live hosted copy: `https://benbabour.github.io/monster-mint/`
- Versioned release downloads: `https://github.com/benbarbour/monster-mint/releases`

## Disclaimer

Everything in this repo, other than this Disclaimer (including the rest of this README) are AI generated. I am a software developer, so this is slightly embarrassing/worrying, but I wanted to try it out. I could have built this myself from scratch, but:

1. My main goal was just to gain experience using an "aseptic" AI, and see how it had improved since the last time I fiddled with it.
2. I'm not a web developer and it would've taken me a lot of work that I find fiddly and annoying.

That being said, I chose this project because monster-mint is a tool I wanted to use and I'm happy with the result.

> [!WARNING] Run at your own risk!
> I purposefully avoided looking at a single line of code; that was a goal when I started this project. I haven't even viewed, let alone reviewed or edited anything in here. I know what it does when I use the tool, but I have *no idea* what else it might be doing behind the screen. The chances that it does anything other than let you build and print monster tokens is negligible, but if you notice it doing anything naughty, please let me know and I'll take it down!

I used OpenAI but if I did it again I'd use Claude / Anthropic because they seem to be the only AI company out there doing the bare minimum for ethical human behavior.

If you're curious it took about 100 prompts to get it into this state, and I had it commit after each prompt. Honestly, 80% of the functionality was there after 2 or 3 prompts though; the rest was layout tweaks, and minor improvements interspersed with requests to fix some pretty large bugs, but it did that well.

## Purpose

Monster Mint is meant to solve the full token workflow in one browser tab:

- design reusable token templates
- place and style images and text visually
- apply numbering, lettering, and color sequences across copies
- preview exactly how printed pages will lay out
- print token sheets with cut guides
- save work in the browser and move projects around as JSON

## Build

Install dependencies:

```bash
npm install
```

Build the single-file distributable:

```bash
npm run build
```

Or with Task:

```bash
task build
```

The build output is [dist/monster-mint.html](/home/ben/code/monster-mint/dist/monster-mint.html).

## Run

For normal use, just open [dist/monster-mint.html](/home/ben/code/monster-mint/dist/monster-mint.html) in a browser.

If you prefer serving it over HTTP during development, you can also run:

```bash
task serve
```

That builds the app and serves `dist/` on `HOST` or `0.0.0.0` using the first free port starting at `4173`.

## Test

Run the automated tests:

```bash
npm test
```

Run the headless browser tests:

```bash
npm run test:e2e
```

Run lint:

```bash
npm run lint
```

## Features

### Project and Persistence

- Single-file browser app output.
- Browser persistence via IndexedDB.
- JSON import and export.
- Save-failure status in the header when browser storage cannot persist changes.
- In-app help dialog with keyboard shortcuts.

### Settings

- Default token settings for new tokens:
  - diameter
  - background color or background image
  - border width
  - border color or border color sequence
- Default text settings for new text components:
  - font family
  - font weight
  - text color or color sequence
  - text border width
  - text border color or color sequence
- Custom color sequence management.
- Built-in text sequences:
  - Numeric
  - Alphabet
- Built-in color sequences:
  - Rainbow
  - Primary Colors
- Image import trim-threshold control for transparent-edge cleanup.

### Designer

- Token-based workflow with a token chooser, clone button, add button, and delete button.
- One-front-only token model.
- Upload-only image workflow.
- Token background can be either:
  - a solid/manual color
  - a color sequence
  - an uploaded background image
- Token border supports:
  - width from `0` to `25%` of token width
  - manual color or color sequence
- Image components support:
  - drag to move
  - edge dragging to resize
  - preserved aspect ratio while resizing
  - mouse-wheel scaling
  - rotation slider
  - draggable rotation handle
  - horizontal and vertical mirroring
  - label/name editing
  - z-order up/down controls
- Text components support:
  - drag to move
  - edge and corner resizing
  - label/name editing
  - font family chooser
  - font weight chooser
  - manual text or built-in sequences
  - numeric sequence start and pad controls
  - alphabetic sequence start control
  - manual color or color sequence
  - text border width and color
  - z-order up/down controls
- Text auto-fits its bounding box and is clipped to that box.
- Images and text are clipped to the token circle in designer, preview, and print output.
- Token and component editing happen in a side panel with its own scroll area.
- Auto-save on edit; there are no manual save buttons.

### Print

- Page presets:
  - US Letter
  - A4
- Portrait and landscape page orientation.
- Adjustable page margins.
- Optional cutline gap in millimeters to add extra square padding around tokens while keeping mixed sizes aligned.
- Per-token print copy counts.
- Per-token sequence start values.
- Live print preview that updates as print selections change.
- Preview pages shown as tabs.
- Print summary showing total token instances and page count.
- Dotted cut lines between rows and columns.
- Token cells fill the full printable square so off-center cuts still show matching outside color.
- Single print action for the generated layout.

### Image Import Pipeline

- Transparent-border trimming on import.
- Configurable alpha threshold for trimming.
- Automatic cleanup of embedded images during JSON import.
- Oversize image optimization on import and replacement.
- Re-encoding/downscaling of large images to keep project size manageable.

### UX Details

- Main header logo.
- Global shortcuts, including delete for the selected component.
- Sorted dropdowns throughout the UI.
- Collapsible print panels with saved collapse state.
- Print Settings defaults to collapsed.
