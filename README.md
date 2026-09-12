# HospoLP — Hospitality Website Demo

This repository is the public demo implementation of the HospoLP hospitality website package.

The current demo business is **The Lantern Yard**, a fictional contemporary café/bar used to demonstrate how the same underlying package can be redesigned for a different hospitality business.

## Purpose
- Demonstrate the finished customer-facing website package
- Show that branding, layout and content can vary by business
- Keep the reusable deployment, visual editor and validation plumbing proven
- Act as the base/reference repo for creating new client-specific repositories

## Standard site structure
HospoLP websites are **multi-page by default**. The homepage should introduce the business and direct visitors to dedicated pages rather than acting as one long landing page with anchor links.

Typical pages are:
- Home
- About / Our Place
- Food / Menu
- Drinks
- Opening Hours
- What's On / Events
- Visit / Contact / Facilities

Not every client needs every page. Remove or rename pages where the business brief calls for it, but keep separate pages as the default pattern for major sections.

## Standard client editor
HospoLP clients do **not** use GitHub or Pages CMS.

Each client gets a branded `/edit/` address that opens the HospoLP visual editor. After email-code sign-in, the client sees only their own website:

- editable controls on the left
- a live preview of the selected webpage on the right
- a clear **Publish changes** button

The client can update routine business information such as wording, opening hours, menus, prices, events, facilities and gallery photos. Design, layouts, navigation, code and deployment remain developer-only.

GitHub Pages continues to host the public website. Google Apps Script handles client authentication/editor sessions, and Google Drive stores the client-published editable content. Repository JSON remains the fallback/default content source.

## Client workflow
For a real customer, duplicate this repository into a new repo, customise the business content and design, adapt the page set to the brief, add the site/client email to the central HospoLP editor registry, connect the repo to the customer's domain, test `/edit/`, then hand over the website and editor addresses.

See `docs/VISUAL-EDITOR.md` for the editor architecture and setup.
