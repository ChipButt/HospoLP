# HospoLP — Hospitality Website Demo & Showcase

This repository is the public Chip In showcase and reference implementation for the HospoLP hospitality website package.

## Showcase routes
- `/` — HospoLP showcase hub
- `/demo/` — The Lantern Yard standard website demo
- `/demo-editor/` — safe customer-editor demonstration using demo access code `12345`
- `/edit/` — the real HospoLP editor entry point for the Lantern Yard site

The root showcase also links to the separate sample website repositories for SAB’s, The Craft Cafe, Mim’s Flans, Slither & Slice and The Bulls Head Bidford.

## Demo editor safety
The demo editor is intentionally isolated from the real Apps Script editor. It loads the normal HospoLP repository content, drives the real live-preview messaging already supported by `assets/app.js`, and stores any demonstration “published” changes only in that browser's local storage. It cannot alter real customer data.

## Purpose
- Demonstrate the finished customer-facing website package
- Demonstrate the client editing experience
- Show that branding, layout and content can vary by business
- Keep the reusable deployment, visual editor and validation plumbing proven
- Act as the base/reference repo for creating new client-specific repositories

## Standard site structure
HospoLP websites are multi-page by default. Typical pages are Home, About / Our Place, Food / Menu, Drinks, Opening Hours, What's On / Events and Visit / Contact / Facilities. Not every client needs every page.

## Real client editor
Real clients do not use GitHub. Each client gets a branded `/edit/` address backed by the HospoLP Apps Script editor service. The client authenticates, sees only their own website, edits approved content fields, previews changes live and publishes when ready.

See `docs/VISUAL-EDITOR.md` for the editor architecture and setup.
