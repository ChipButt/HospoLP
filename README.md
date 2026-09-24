# Chip In Websites — Hospitality Website Demo & Showcase

This repository is the public Chip In showcase and reference implementation for the Chip In Websites hospitality website package.

## Showcase routes
- `/` — Chip In Websites showcase hub
- `/demo/` — The Lantern Yard standard website demo
- `/demo-editor/` — safe customer-editor demonstration using demo access code `12345`
- `/edit/` — the real Chip In Websites editor entry point for the Lantern Yard site

The root showcase serves the sample websites from `/samples/` inside this repository: SAB’s, The Craft Cafe, Mim’s Flans, Slither & Slice, The Bulls Head Bidford and Angels & Demons.

## Demo editor safety
The demo editor is intentionally isolated from the real Apps Script editor. It loads the normal Chip In Websites repository content, drives the real live-preview messaging already supported by `assets/app.js`, and stores any demonstration “published” changes only in that browser's local storage. It cannot alter real customer data.

## Purpose
- Demonstrate the finished customer-facing website package
- Demonstrate the client editing experience
- Show that branding, layout and content can vary by business
- Keep the reusable deployment, visual editor and validation plumbing proven
- Act as the base/reference repo for creating new client-specific repositories

## Standard site structure
Chip In Websites websites are multi-page by default. Typical pages are Home, About / Our Place, Food / Menu, Drinks, Opening Hours, What's On / Events and Visit / Contact / Facilities. Not every client needs every page.

## Real client editor
Real clients do not use GitHub. Each client gets a branded `/edit/` address backed by the Chip In Websites Apps Script editor service. The client authenticates, sees only their own website, edits approved content fields, previews changes live and publishes when ready.

See `docs/VISUAL-EDITOR.md` for the editor architecture and setup.


## Sample website copies
The hospitality samples are vendored into `/samples/` so visitors remain on the Chip In Websites GitHub Pages deployment. The source client repos remain available as development sources, but the showcase does not route visitors to those repos.

- `/samples/sabs/`
- `/samples/craft-cafe/`
- `/samples/mims-flans/`
- `/samples/slither-and-slice/`
- `/samples/bulls-head-bidford/`
- `/samples/angels-and-demons/`
