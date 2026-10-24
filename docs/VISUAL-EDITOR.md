# Chip In Simple Website Editor — individual customer accounts

**Current implementation:** `apps-script/Editor.gs` and `apps-script/EditorUI.html`, deployed inside the existing *HospoLP Client Intake* Apps Script project. This is **not** the demo editor at `/demo-editor/`.

Every client gets:
- A finished, live website on their own custom domain and Cloudflare Pages project.
- A branded `https://their-domain/edit/` shortcut into the existing central Apps Script Simple Website Editor, scoped to that client's **own `site_id`**.
- A secure, one-time 48-hour setup email allowing them to choose a password of at least 12 characters, with no password transmitted to Chip In or held as plaintext in the registry.
- A private login using their assigned email and own password. Once signed in they edit text, images, menus, opening hours, events, etc., see the live preview, save drafts, and publish changes to **only their own private GitHub repository**.

## Onboarding a new client

Use the owner-only **Client Project Hub** in the existing [Client Onboarding Admin](https://script.google.com/macros/s/AKfycbzz7FWTrjHkH8LUCrEElzr1MFCN9lN408-C_wC2o2FAU5j8HYXd43uUBgUHRDsiB78/exec?mode=onboard-admin).

1. Accept written quote, collect complete assets, build on a private client GitHub repo with Cloudflare Pages, run three-day review and complete five-working-day revisions.
2. Receive **client's final written approval**, link their domain, check HTTPS/DNS/email MX and record the live URL in the Hub.
3. **Register client Simple Website Editor.** This verifies schema, eight content JSON files and site app.js bridge in **their** repo, patches only the site identifier, creates `/edit/` redirect and appends a row to the existing shared editor registry sheet.
4. **Email secure editor setup invitation**. They have 48 hours to pick their password. On redemption the password hash is stored and the invitation is invalidated.
5. Test that client's editor login, preview and a harmless publish against the correct repo/domain.
6. **Send final website + editor handover**. The handover email contains the live website URL, client `/edit/` URL, login email and short guidance—no GitHub credentials.

For a full owner checklist and remaining real account tests, see [CLIENT-PROJECT-HUB-HANDOVER.md](CLIENT-PROJECT-HUB-HANDOVER.md).

## Editor registry

The actual current implementation uses a Google Sheet, NOT a hard-coded `EDITOR_CONFIG.SITES` list:

- Sheet ID: `12otLULjhJZ8dln9jPWa_DByUQ750NRHkhhciuCZimlY`
- Sheet name: `Clients`
- Required headings: `site_id, business_name, public_url, login_email, password_salt, password_hash, password_is_temporary, active, repo_full_name, content_root, media_root, schema_path`.

A given site ID maps to exactly one repo and client email. Publishing via the editor uses a private server-side GitHub token from Apps Script Script Properties and the repo's `content/*.json` files. The client cannot see GitHub API tokens. Only the owner can create a new registry entry via the Hub.

The older `setInitialEditorPassword(siteId,newPassword)` routine was unsafe when callable from public Apps Script. It now **requires a valid owner onboarding session as a third argument** and must not be invoked without authorisation. The recommended account setup is the new one-time client invitation instead.

## Website template contract

A new site's repository must contain the compatible `editor.schema.json`, all eight expected content JSON files, and `assets/app.js` with `EDITOR_DATA_URL`, `EDITOR_SITE_ID`, preview message handling and correct application of published JSON fields. The generic holding page created by initial Pages provisioning is **not a completed website** and will correctly fail editor registration. Build the actual website first. The editor redirects to Google Apps Script from `/edit/`.

The editor is independent of optional monthly site maintenance charges. If a bespoke website has not implemented the standard dynamic content integration, do not issue client editor credentials until it has been adapted and tested.

## Deployment

Source changes to `apps-script/Editor.gs`, `apps-script/EditorUI.html`, `apps-script/ClientHandover.gs`, onboarding and review files are tested and deployed by `.github/workflows/hospo-apps-script-deploy.yml`, which clones and preserves the existing full project, versions before updating, and uses the same web-app deployment ID.

The mocked GitHub/Drive/Sheets editor tests pass as part of `scripts/test-client-onboarding.cjs`. Actual new-client Cloudflare credentials, DNS, email delivery and the first live editor publish must be tested with a controlled internal project before giving this to customers.
