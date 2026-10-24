# Chip In — Complete client website journey and final handover

**Single owner dashboard:** [Chip In Onboarding Admin](https://script.google.com/macros/s/AKfycbzz7FWTrjHkH8LUCrEElzr1MFCN9lN408-C_wC2o2FAU5j8HYXd43uUBgUHRDsiB78/exec?mode=onboard-admin) → sign in using the private owner key → **Client Project Hub**.

This page is owner-only. It shows a card for every **quote-approved, activated** client workspace, with progress indicators and links to their meeting, files, hosting, first-draft review, published site and Simple Website Editor. Each client sees only their own private upload/review links and editor; the owner dashboard is never shared with clients.

## Complete checklist, from first meeting to handing over

| Step | Owner action | What is recorded / where to find it | Completion gate |
|---|---|---|---|
| 1. Meet, quote, agree dates | Use [Client Meeting Builder](https://chipinworks.co.uk/client-meeting/); select pages, fee, care, domain, **latest complete asset deadline**, agreed first-build days, 3-day review and 5-working-day amendments. Obtain written quote acceptance. | Export/download the proposal and website specification; the meeting tool also stores notes in the current browser. | **Acceptance and agreed milestones**. |
| 2. Activate private workspace | From the meeting, open owner onboarding admin. Confirm accepted quote and create workspace. | Client Drive folder containing \`approved-website-brief.json\` and upload-status; client upload link. | No workspace for mere prospects. |
| 3. Receive client's photos/assets | Email their private upload link; watch the progress and verify all menus, logos, photos, contact details, prices and usage permissions arrived. | Project Hub shows asset counts, status, client-upload page and private Drive folder. | Don't start the build countdown until **all** required assets are received; the upload status alone is not proof that content is complete. |
| 4. Create site source + free hosting | Configure GitHub/Cloudflare owner tokens once; click **Create private GitHub repo + Cloudflare Pages (£0)** under Step 3. | Owner Hub links the client's separate private repo and Cloudflare Pages preview. | A generic holding page is **not** a finished client website. Build the actual client site from the approved brief/content with the HospoLP editor-compatible template. |
| 5. First draft | Complete the first version by the agreed build deadline and ensure it loads on staging. Under Step 5, **Prepare first-draft review link**, then **Email draft and start 3-day review**. | Review portal link, feedback deadline, comments by page and position. | The 72-hour client clock starts at the **first successful invitation**; resending does not extend it. |
| 6. Review + revisions | Client submits **one consolidated list**; owner marks amendments Outstanding → In progress → Completed and implements the agreed edits. | Comments are saved to \`website-review.json\` in client's private Drive folder. | Allow the quoted **five working days**. If client misses feedback deadline, explicitly close it in owner Step 5—this **never** equals launch approval. |
| 7. Written final approval | Click **Send finished website for written approval** only after every amendment is complete. Client checks final revision and signs using their name + explicit approval. | The project shows approver and timestamp. | No DNS changes until signed approval is recorded. |
| 8. Domain go-live | Connect client's domain in Cloudflare Pages; preserve MX/email, inspect SSL/HTTPS, links, mobile views and check site. Record the **real custom-domain HTTPS URL** in Client Project Hub with the three required checkboxes. | Owner Hub stores confirmed domain and timestamp. | Don't mark live when only a \`pages.dev\` preview exists. Publication normally follows written approval within 24–48 hours but external DNS/SSL delays can be longer. |
| 9. Activate **that client's Simple Website Editor** | When live, click **Register client Simple Website Editor** on the project card. The system verifies \`editor.schema.json\`, \`content/{site,hours,menu,events,features,gallery,drinks,theme}.json\` and the existing \`assets/app.js\` editor-data bridge inside **that private repo**. It registers the client's email and specific repository in the existing Editor client registry and writes the correct \`/edit/\` redirect. | Hub shows their unique secure Apps Script Editor link; each site's editor publishes changes into **that site's** repo. | Registration **refuses** a generic placeholder, missing template files, wrong repo, wrong domain, or mismatched registry entry. Never send the *demo editor*. |
| 10. Secure password + verified editor | Click **Email secure editor setup invitation**. Client receives a **48-hour one-time link**, chooses their own password (at least 12 characters) and signs in with their registered email. | Owner Hub marks editor **Activated** after successful token redemption. | Never email passwords, GitHub credentials or the owner key. Test login and a harmless edit/preview/publish on the client site before handover. |
| 11. Final handover | Click **Send final website + editor handover** from the project card. | An email contains the live website, own \`https://domain/edit/\` editor address, login email and brief usage instructions. Date sent is recorded. | Handover action is **blocked** without sign-off, live domain and editor activation. Re-clicking is idempotent. |

The Hub is intentionally a **project progress/control panel**. It does not make an approved site build itself, automatically source missing assets, register domains, independently verify DNS/MX, replace a bespoke client layout, or run client training unattended. The owner must complete those work steps and verify final results.

## What the customer actually receives

The customer receives two distinct things, **never a GitHub repo link**:

1. Their finished, live public website at their own custom domain (example: \`https://business.co.uk/\`).
2. A **separate password-protected Simple Website Editor** at \`https://business.co.uk/edit/\`, redirecting to the existing Chip In Apps Script editor bound to their own site ID. They sign in with their approved email and password they set themselves. Editable fields and preview come from their own site's content and schema; **Publish changes** writes back to their own GitHub repository and triggers its Cloudflare deployment.

They can also access their prior client-specific review portal until its link expires (normally 45 days), but that is separate from ongoing editing.

## Critical compatibility contract

Each actual client website has to be constructed on **the HospoLP editor-compatible site structure**. The site needs **all eight** content JSON files, \`editor.schema.json\` with valid \`pages\` array, and an \`assets/app.js\` implementing:
- \`const EDITOR_DATA_URL='https://script.google.com/macros/s/.../exec'\`
- \`const EDITOR_SITE_ID='...'\`
- standard \`hospolp-preview\` support.

The registration action installs the client's real site ID in that bridge, creates a private editor registry entry and its \`/edit/\` route. If the developer built the site without those files, it **must be adapted** before editor onboarding; the system prevents false handover rather than issuing a broken login.

The editor client registry is the **existing Google Sheet**, whose headings must include:
\`site_id, business_name, public_url, login_email, password_salt, password_hash, password_is_temporary, active, repo_full_name, content_root, media_root, schema_path\`.

Its owner account must retain access. GitHub publishing needs either the existing \`CHIP_IN_WEBSITES_GITHUB_TOKEN\` or the provisioner token \`CHIPIN_GITHUB_PROVISION_TOKEN\` authorised to **read/write the new private repo**. Don't put secrets in the repo, frontend or quotes. The legacy public \`setInitialEditorPassword\` method is now protected by the owner session.

## First real end-to-end test

Before relying on this for the first paying client, use an **internal test business** controlled by Chip In:

1. Make an internal quote and approved workspace and upload sample files.
2. Provision a test repo and Pages project in **your existing Cloudflare account**, and make a simple compatible test website.
3. Run the draft invitation in a separate browser, add and delete pins/comments, submit review, mark changes completed, request and give final approval.
4. Connect a **test custom domain**, record the explicit HTTPS/MX checks, verify live website (not just Pages URL).
5. Register the editor and open the emailed one-time invitation as the simulated customer, set a private password, sign in and publish a harmless change. Confirm the correct client's GitHub content and Cloudflare website update, then restore the text.
6. Send the final handover and confirm the website and \`/edit/\` links work, **without** access to the owner dashboard or other clients.

**Automated tests** exercise the code using mocked Drive, MailApp, Sheet, GitHub and Cloudflare. They do **not** establish that real tokens, DNS, editor preview embedding or live publishing are working. The account tokens may still need to be set under **Apps Script → Project Settings → Script Properties** using [client hosting setup instructions](CLIENT-SITE-HOSTING-PROVISIONING.md). Keep the final end-to-end test as the go/no-go gate.
