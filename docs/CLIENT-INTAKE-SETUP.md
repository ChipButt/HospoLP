# Chip In Websites Client Intake — One-Time Setup

The intake form is designed to collect a complete initial website brief plus original client assets and place them in Google Drive.

## Already configured

- Parent Drive folder: `Chip In Websites / Client Submissions`
- Parent folder ID used by the backend: `1RnkfWjPN5hs187svzjuVzVXpdDPlbhto`
- Backend source: `apps-script/Code.gs`
- Client form source: `apps-script/Index.html`
- Stable public entry page: `/brief/`

Each successful submission creates a folder named like:

`2026-09-12 1945 - The Example Arms`

Inside it:

- `website-brief.txt` — easy human-readable brief
- `website-brief.json` — structured version for reuse when building the site
- `upload-manifest.json` — record of uploaded files
- `01 Brand/`
- `02 Photos/`
- `03 Menus & Documents/`
- `04 Other/`

The owner also receives an email notification and the client receives a receipt email.

## One-time deployment

Google Drive cannot accept anonymous website uploads directly. The backend therefore runs as a Google Apps Script web app under the Drive owner's Google account.

1. Go to https://script.google.com/ while signed into the Google account that owns the Chip In Websites Drive folder.
2. Click **New project**.
3. Name the project `Chip In Websites Client Intake`.
4. Replace the default `Code.gs` contents with the contents of this repo's `apps-script/Code.gs`.
5. Add an HTML file named exactly `Index`.
6. Paste the contents of this repo's `apps-script/Index.html` into that file.
7. Save the project.
8. Click **Deploy → New deployment**.
9. Choose **Web app**.
10. Set **Execute as** to **Me**.
11. Set **Who has access** to **Anyone**.
12. Click **Deploy** and approve the requested Drive/Mail permissions.
13. Copy the Web app URL ending in `/exec`.
14. In `brief/index.html`, replace `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE` with that `/exec` URL.
15. Commit the change to `main`.

After that, the reusable link to give prospective clients is:

`https://chipbutt.github.io/HospoLP/brief/`

## Upload rules

The current form accepts:

- Images
- PDF
- Word documents
- Excel spreadsheets
- Plain text files

Guardrails:

- 25 MB maximum per file
- 40 files maximum per submission
- Files upload sequentially, not as one email attachment
- The client must confirm they have permission to provide uploaded assets for use on the website

If a client has unusually large RAW/TIFF/PSD media, collect that separately rather than raising the public form's limit.

## Test before sending to a real client

Use a fake venue and submit:

1. Business name, email and basic content
2. One JPG photo
3. One PDF menu
4. One logo file

Then verify:

- A new folder appears under `Chip In Websites / Client Submissions`
- Both brief files are present
- Assets are in the correct subfolders
- `upload-manifest.json` exists
- The owner receives a notification email
- The test client receives a confirmation email

Once that works, the intake form is ready to use for real customers.
