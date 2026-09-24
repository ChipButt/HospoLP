# Chip In Websites Visual Editor — Standard

Chip In Websites client websites do **not** use Pages CMS as the customer-facing editor.

## Customer experience

Each website has an `/edit/` address. The client:

1. Opens their website editor.
2. Enters their authorised email address and the temporary password set by Chip In.
3. On their first successful login, is required to choose and confirm a new password.
4. Uses that new password for all subsequent logins.
5. Sees only their own website editor.
6. Chooses a page from the left-hand controls.
7. Edits text, hours, menus, events, facilities or photos on the left.
8. Sees the website update immediately in the live preview on the right.
9. Clicks **Publish changes** when happy.

Clients never see GitHub, repositories, JSON files, deployments or other customers.

## Architecture

- GitHub Pages hosts the public website shell/design.
- Google Apps Script provides authentication and the visual editor.
- Google Drive stores the client-published editable content.
- The public site loads its latest published content from the Apps Script service using JSONP, with the repository JSON as a fallback.
- Each client email is mapped server-side to a specific site ID.
- Passwords are stored as salted SHA-256 hashes in the client registry, never as plaintext.
- An admin-set initial password is marked as temporary. The editor blocks access until the customer replaces it on first login.
- The browser cannot choose or change the underlying repository/site mapping.

## Adding a client

Add a new entry to `EDITOR_CONFIG.SITES` in `apps-script/Editor.gs`:

```js
'client-site-id': {
  name: 'Client Business Name',
  allowedEmails: ['client@example.com'],
  publicUrl: 'https://example.com/',
  rawBase: 'https://raw.githubusercontent.com/ChipButt/CLIENT_REPO/main/content/',
  files: ['site','hours','drinks','menu','events','features','gallery','theme']
}
```

Then set the client repo's `/edit/` page and `assets/app.js` to use that site ID.

## Apps Script deployment

The existing **Chip In Websites Client Intake** Apps Script project is also the central Chip In Websites editor service.

The deployed project must contain:

- `Code.gs` from `apps-script/Code.gs`
- `Editor.gs` from `apps-script/Editor.gs`
- `Index.html` from `apps-script/Index.html`
- `Editor.html` from `apps-script/Editor.html`

After changing any of these files, create a **new version** of the existing Web App deployment. Keep:

- Execute as: **Me**
- Who has access: **Anyone**

The public deployment URL remains the single backend used by all Chip In Websites client websites.

## Security rule

Never put a GitHub token, GitHub credentials or repository write credentials in a client website. The client only authenticates against the Chip In Websites editor service and can only modify the approved content fields for the site assigned to their email address.


## Initial client password

Set a customer's initial password from Apps Script with:

```js
setInitialEditorPassword('client-site-id', 'temporary-password-here');
```

This stores the hashed password and marks it as temporary. After the customer signs in successfully, the editor requires a new password before exposing the website editor. Changing the password clears the temporary flag. For legacy registry rows without the `password_is_temporary` column/value, the secure default is to require a one-time password change.
