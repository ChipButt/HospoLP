# HospoLP

HospoLP is the master hospitality landing-page / website system.

The commercial package is consistent across clients, but each business is treated as its own website project with its own branding, layout decisions, content, imagery and optional components.

## Core rule

Reuse infrastructure and content systems. Do not force every business into the same visual template.

## Structure

- `shared/` — reusable utilities, editor logic, common data models and components that genuinely benefit from being shared.
- `businesses/` — one isolated folder per client/business.
- `businesses/bulls-head-bidford/` — first reference implementation.

Each business can have its own:

- page structure and section order
- colours and typography
- logo and imagery
- CSS/theme overrides
- content
- enabled/disabled features
- custom components where required

The package concept remains consistent: a professionally built hospitality website with simple owner-editable everyday content, while design/layout/code stay under developer control.
