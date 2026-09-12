# HospoLP — Hospitality Website Demo

This repository is the public demo implementation of the HospoLP hospitality website package.

The current demo business is **The Lantern Yard**, a fictional contemporary café/bar used to demonstrate how the same underlying package can be redesigned for a different hospitality business.

## Purpose
- Demonstrate the finished customer-facing website package
- Show that branding, layout and content can vary by business
- Keep the reusable deployment, editor and validation plumbing proven
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

Customer-editable content remains stored centrally in `content/*.json`, so the same information can be reused across pages without making the client manage multiple systems.

## Client workflow
For a real customer, duplicate this repository into a new repo, customise the business content and design, adapt the page set to the brief, connect that repo to the customer's domain, and give the customer access only to the restricted editor.
