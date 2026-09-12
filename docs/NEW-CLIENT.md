# Create a new customer website

HospoLP uses one permanent editor backend and one private client registry. **Do not edit or redeploy Apps Script for each new customer.**

## Normal new-client workflow

1. Client completes the HospoLP brief and uploads assets. The intake system stores the submission in Google Drive.
2. Create one GitHub repository for that business and upload the supplied brand/photo/menu assets.
3. Build the site from the HospoLP architecture and the submitted brief. Use a multi-page structure by default: Home, About, Food/Menu, Drinks where relevant, Opening Hours, What's On and Visit/Contact.
4. Keep routine customer-editable information in `content/*.json`.
5. Add `editor.schema.json`. It defines only the fields the customer is allowed to edit and maps them to their public pages.
6. Keep the standard preview bridge in the site JavaScript so editor fields and preview elements can highlight each other and draft changes can be previewed before publishing.
7. Add `/edit/index.html`, pointing to the permanent HospoLP Apps Script editor with this site's `site_id`.
8. Add one row to the private **HospoLP Client Registry** Google Sheet. No Apps Script code change is required.
9. Generate a temporary password. Store only its salt and SHA-256 hash in the registry. Put the plain temporary password only in the client handover document.
10. Enable GitHub Pages for the repo and test the preview site.
11. Test login, page switching, paired hover highlighting, text edits, menu/event/facility controls, image add/replace/remove and Publish.
12. Produce the client handover document with preview URL, editor URL, approved email and temporary password.

## Client Registry columns

`site_id | business_name | repo_full_name | public_url | login_email | password_salt | password_hash | active | schema_path | content_root | media_root`

The current registry spreadsheet ID is `12otLULjhJZ8dln9jPWa_DByUQ750NRHkhhciuCZimlY`.

Typical row values:

- `site_id`: URL-safe unique ID such as `new-pub`
- `business_name`: customer-facing business name
- `repo_full_name`: `ChipButt/NewPub`
- `public_url`: GitHub Pages preview URL or the final custom domain
- `login_email`: the customer's approved editor email
- `active`: TRUE
- `schema_path`: `editor.schema.json`
- `content_root`: `content`
- `media_root`: `media/editor`

## Permanent backend setup

The Apps Script project uses `apps-script/Editor.gs` and `apps-script/EditorUI.html` from this repository. The Apps Script Script Property `HOSPOLP_GITHUB_TOKEN` must contain the owner's GitHub fine-grained token with Contents read/write permission for the client repositories. This is configured once, not per customer.

## Standard editor rule

The customer sees only their branded editor: email/password login, controls on the left, live site preview on the right and **Publish changes**. They never see GitHub, Google Drive, JSON, Apps Script, Pages CMS or other customers.

The website design can be completely bespoke. The reusable part is the content/editor contract, authentication, publishing and preview bridge.
