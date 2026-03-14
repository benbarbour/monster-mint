# Overview

Monster Mint is a tool to help you design and print sheets of tokens that can be hole punched and glued to physical
tokens.

# Features

- Generate tokens of popular D&D sizes (0.5", 1", 2", 3", 4", and 5") and lay them out on a printable page in way
  that makes them easy to cut out and/or hole punch with an appropriately sized punch (border bleed, cut lines, etc).
- The page size is selectable.
- The tokens can have text, and optionally incrementing sequences (numerical or alphabetical) with configurable font,
  color, border thickness, border color, and/or drop shadow.
- The tokens can have borders with configurable thickness and color.
- The tokens can have images loaded from game-icons.net or any other web-accessible URL, or uploaded into the app.
- The tokens can have a backside image. This prints on another page so that it can be cut out and glued other side
  of the same token the front side is glued to.
- All data stored in local browser storage, but is exportable to JSON and importable again.
- It builds (or is just written as) javascript in one HTML file, so it's very easy to distribute.

# Usage

- On the settings tab you can define sequences of text (numerical, alphabetical, or custom) and sequences of colors.
- On the designer tab, you can design the layout of the token, with placeholders for sequences in text, sequences of
  border colors, and sequences of image colors (if SVG).
- On the print tab, you select which tokens and how many copies of each to print. In a preview window it shows what
  the final page(s) will look like - each copy of each token with all the sequences plugged in. Then you hit print
  and it prints the page(s) of tokens.

