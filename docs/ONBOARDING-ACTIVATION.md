# Chip In — Client Meeting → Approved Workspace → Client Uploads

## What the integration does

The Chip In Meeting Builder on https://chipinworks.co.uk/client-meeting/ creates a quote and a structured build brief in the browser.

**No Drive folder is created while a prospective client is just discussing the website.**

After the client accepts a written quote, the owner ticks the approval checkbox, opens the secure Apps Script admin page and signs in using the private admin key. One click creates a client folder inside the private central Drive parent:

- \`Chip In — Website Client Assets\` — Google Drive folder ID \`1cLuFi32Zry5uswOjbeEIFwGllYV7TzbB\`
  - \`YYYY-MM-DD — Client Business\` (automatically created on approval)
    - \`01 — Logos and Branding\`
    - \`02 — Photos\`
    - \`03 — Menus and Prices\`
    - \`04 — Events and Business Information\`
    - \`approved-website-brief.json\` (meeting specification)
    - \`upload-status.json\` (current file count, last upload, readiness)

The owner can copy or email the *private client upload page* link. The client uploads through Google Apps Script, **not a shared Google Drive folder**. The client cannot list or download private Drive files. Links use a random 96-hex-character upload token and expire after 90 days.

The owner console displays counts and statuses, and finishing uploads sends an email to the account that deploys the script. ChatGPT can retrieve the uploaded files through the connected Google Drive and, when requested, use them to build the website in the proper client GitHub repository. No automatic publication to GitHub occurs on receipt.

## Updating an existing, already deployed onboarding installation (Version 7 → Version 8)

If you already tested the 25 MB uploader, you **do not need a new Apps Script project, folder or owner key**. In the existing **HospoLP Client Intake** project:

1. Update only these three existing files with their latest GitHub contents: `ClientOnboarding.gs`, `ClientOnboardingUpload.html`, and `ClientOnboardingAdmin.html`. Use the **Raw** view from the repository and replace the contents of each matching Apps Script file. Keep `Code.gs`, `Editor.gs`, `EditorUI.html` and `Index.html` unchanged.
2. Save the Apps Script project; verify **Unsaved changes** disappears.
3. **Deploy → Manage deployments → Active Untitled Web app → Edit → New version → Deploy**, preserving the current web app ID and Execute as/Who has access.
4. This upload route now uses Google's Drive resumable upload API via `UrlFetchApp` and `ScriptApp.getOAuthToken()`. If prompted to authorise the updated script's Google Drive/external-request permissions, do so while signed in as the owning account. **Do not send clients the new upload page until a real image upload succeeds.**
5. Open the test client's existing private upload link. Try a small image first, then one over 25 MB and verify the file appears in the private **02 — Photos** folder and the progress bar reaches 100%. If Google reports an authorisation error, inspect **Executions** in Apps Script and re-authorise the new Drive/UrlFetch scopes.
6. Reuse the existing test client folder; do not create a real client's workspace merely to verify the upgrade.

The new owner dashboard includes a **Start client meeting / quotation** link to https://chipinworks.co.uk/client-meeting/, so the full flow begins with the checklist before quote approval.

## One-time steps required in Google Apps Script

**IMPORTANT:** Pushing to GitHub is NOT an Apps Script deployment. The existing Apps Script web app serving \`https://script.google.com/macros/s/AKfycbzz7FWTrjHkH8LUCrEElzr1MFCN9lN408-C_wC2o2FAU5j8HYXd43uUBgUHRDsiB78/exec\` must be updated once by the account that owns it.

1. Open [Apps Script](https://script.google.com/home/projects) in the Google account used to deploy the Chip In Websites intake/editor. Open the existing **Chip In Websites** project corresponding to the deployment URL above. **Do not delete or replace the existing editor or intake files.** Make an Apps Script version/back-up first.
2. Replace/update **Code.gs** with [the repo version of Code.gs](https://github.com/ChipButt/HospoLP/blob/main/apps-script/Code.gs), or, less invasively, insert these two routes into its existing \`doGet(e)\` immediately before the \`mode === 'editor'\` branch:
   \`\`\`javascript
   if (mode === 'onboard-admin') return renderClientOnboardingAdmin_(e);
   if (mode === 'onboard-upload') return renderClientOnboardingUpload_(e);
   \`\`\`
3. Click **+** → **Script**, name it exactly \`ClientOnboarding\`, paste [ClientOnboarding.gs](https://github.com/ChipButt/HospoLP/blob/main/apps-script/ClientOnboarding.gs).
4. Click **+** → **HTML**, name it exactly \`ClientOnboardingAdmin\`, paste [ClientOnboardingAdmin.html](https://github.com/ChipButt/HospoLP/blob/main/apps-script/ClientOnboardingAdmin.html). Repeat with HTML file named \`ClientOnboardingUpload\` and [ClientOnboardingUpload.html](https://github.com/ChipButt/HospoLP/blob/main/apps-script/ClientOnboardingUpload.html).
5. Go to **Project Settings** → **Script Properties**. Add the property:
   - Property: \`CHIP_IN_ONBOARDING_ADMIN_KEY\`
   - Value: **Generate a long random unique password (at least 20 characters) in your password manager and save it securely**. Never commit this value to GitHub, put it in meeting notes, or share it with customers.
6. Save the project. Use **Deploy → Test deployments** to check the new functions privately.
7. Use **Deploy → Manage deployments → Edit** on the current public web app. Choose **New version** and **Deploy**. Keep **Execute as: Me** and the existing **Who has access: Anyone** setting, as required for the client upload link; the admin methods are independently protected by the owner key. This updates the **same existing /exec URL**. The old editor and intake should remain intact.
8. Open the existing \`/exec?mode=onboard-admin\` URL. You must see a **Chip In owner sign-in** page (not the old Website Brief). Sign in with your private key.
9. Do a test: open the Meeting Builder, enter a **test business and email you control**, select a £250 quote, tick **quote approved**, tick **one-time setup completed**, click **Activate client folder & get upload link**. Confirm the details import. Click **Create**. Check the private Drive client folder, open the newly generated upload link in a private browser tab, upload a test photo, press **I've finished uploading**, and check the owner console/email. Do **not** send a real customer's link until this test succeeds.
10. In the Meeting Builder, paste the client's generated upload link into the **Client upload link** field so it prints on the client handover and is included in the build specification.

## Security

- Never expose \`CHIP_IN_ONBOARDING_ADMIN_KEY\` in public HTML, GitHub files, screenshots or client messages.
- Do not share the master Drive folder with clients. The client portal permits **upload only**.
- Upload tokens grant write access to one client's upload area until expiry. Treat the upload link as confidential, and send it only to the intended business contact.
- Up to 50 files; images up to **100 MiB** each (shown as 100 MB in the UI), other documents up to **25 MiB** each, and **1 GiB total** per workspace. Files are sent as **4 MiB Drive-resumable chunks**, and the upload progress bar advances only after Google Drive acknowledges a chunk. Google Apps Script's UrlFetchApp requests require the deploying account's Drive/URL Fetch authorisation. Uploads are **not** automatically copied to live GitHub repositories.
- Client acceptance is currently confirmed by the owner with the **quote approved** checkbox. The tool does not constitute an electronic signing service. Keep the client's written agreement.
- Project notes currently save locally on the device used for the meeting. Download the build brief and the JSON meeting backup. Protect devices containing client contact information.
- The older \`Client Submissions\` folder is outside this new system and has different permissions. Do not redirect new uploads there or make the new master folder public.

## Owner normal workflow (after one-time setup)

1. Open Chip In Meeting Builder, press **+ New client**.
2. Complete the meeting with the customer, choose the standard pages, maintenance package, domain option and quote.
3. Send/record the quote and get written approval.
4. Tick approved, click **Activate client folder**. Sign in, review, create. Only now does a Drive folder appear.
5. Click **Email link to client** (or copy it into a message). Record the generated link in the meeting document.
6. Client receives one clear upload page with labelled categories, file-quality guidance and a **I've finished uploading** button.
7. Owner receives an email when they're finished and can check **Client asset checker** for status and counts; the private Drive folder has the files and \`approved-website-brief.json\`.
8. Supply that folder and the exported build brief to ChatGPT for website development and approval; any later fully automated build pipeline would be a separate step.

## Verify

- GitHub CI workflow: [Verify Client Onboarding](https://github.com/ChipButt/HospoLP/actions/workflows/client-onboarding-test.yml).
- Meeting Builder CI workflow: [Verify Client Meeting Builder](https://github.com/ChipButt/ChipIn/actions/workflows/client-meeting-test.yml).

These verify isolated logic, not live Google authorisation, mail delivery or the published Apps Script deployment. A live test is required after deploying.
