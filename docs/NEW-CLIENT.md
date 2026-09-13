# Create a new customer website

HospoLP uses one permanent editor backend and one private client registry. **Do not edit or redeploy Apps Script for each new customer.** One business/location = one repository.

## Normal new-client workflow

1. Client completes the HospoLP brief and uploads assets. The intake system stores the submission in Google Drive.
2. Create one GitHub repository for that business and upload the supplied brand/photo/menu assets.
3. Build an original site from the HospoLP architecture and the submitted brief. The visual design may be completely bespoke. Use separate pages for the business's main areas rather than one long landing page.
4. Keep routine customer-editable information in `content/*.json` and create `editor.schema.json` for that exact site.
5. **Every piece of routine visible content must be checked against the editor.** Page-banner eyebrow text, headings, introductions, body copy, notices, hours, menus, events, facilities, contact information and customer-managed images must not be left hard-coded if a customer could reasonably need to change them.
6. Keep the standard preview bridge in the site JavaScript. Draft changes must update the preview immediately; hovering either side must highlight its partner.
7. Preview navigation and editor navigation are two-way linked. If the customer clicks a link/button in the website preview and lands on another editable page, the left editor must automatically switch to that page's controls.
8. Image fields use upload/replace/remove controls. Never make the customer edit an image URL.
9. Add `/edit/index.html`, pointing to the permanent HospoLP Apps Script editor with this site's `site_id`.
10. Add one row to the private **HospoLP Client Registry** Google Sheet. No per-client Apps Script code change or deployment is required.
11. Generate a temporary password. Store only its salt and SHA-256 hash in the registry. Put the plain temporary password only in the client handover document.
12. Enable GitHub Pages and test the public preview URL and editor URL.
13. Produce the client handover document with preview URL, editor URL, approved email, temporary password and simple editing instructions.

## Mandatory acceptance test before handover

A new client site is not finished until all of these pass:

- Login works with only the client's approved email and password.
- Every intended page appears in the editor and opens the correct preview page.
- Clicking navigation, cards or CTA links inside the preview changes the editor to the destination page automatically.
- Every editable visible text element has a corresponding editor control; page banners are specifically checked.
- Typing in a field changes the matching preview content immediately before publishing.
- Hovering an editor field highlights the matching preview element and hovering the preview highlights the matching editor field.
- Opening hours can be edited.
- Menu items can be edited, added and removed where the site has a menu.
- Events can be edited, added, hidden and removed where relevant.
- Facilities can be edited where relevant.
- Customer-managed images can be uploaded, replaced and removed.
- Publish writes the content back to the client's GitHub repository and the deployed site reflects it.
- No customer-facing screen exposes GitHub, JSON, Apps Script, repositories, deployment controls or developer settings.

## Client Registry columns

`site_id | business_name | repo_full_name | public_url | login_email | password_salt | password_hash | active | schema_path | content_root | media_root`

Registry spreadsheet ID: `12otLULjhJZ8dln9jPWa_DByUQ750NRHkhhciuCZimlY`.

## Permanent backend setup

The Apps Script project uses `apps-script/Editor.gs` and `apps-script/EditorUI.html` from this repository. The Script Property `HOSPOLP_GITHUB_TOKEN` is configured once with GitHub Contents read/write access for client repositories. Do not create a separate Apps Script deployment for a customer.

## Standard editor rule

The customer sees only their website editor: email/password login, page controls on the left, their live website preview on the right and **Publish changes**. The reusable product is the content/editor contract, authentication, publishing, image handling, preview bridge and page synchronisation — not a forced visual template.
