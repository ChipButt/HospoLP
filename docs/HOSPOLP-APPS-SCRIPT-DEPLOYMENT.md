# HospoLP — GitHub Actions to Google Apps Script deployment

## Already prepared

- Live project: HospoLP Client Intake (Script ID 16BFtJO-egh3HtoAv33nTizHfeFqEaZ7mwaDHbegM16j-xsIlv9ZMd3Zr).
- Existing live web-app deployment: AKfycbzz7FWTrjHkH8LUCrEElzr1MFCN9lN408-C_wC2o2FAU5j8HYXd43uUBgUHRDsiB78.
- Workflow: .github/workflows/hospo-apps-script-deploy.yml, manually triggered only.
- Dependencies: pinned @google/clasp@3.4.1 and Node 24.
- The workflow runs tests, clones ALL eight live project files, checks the existing editor/intake/onboarding routes, saves an immutable pre-update script version, overlays only three updated onboarding files, and updates the EXISTING deployment ID to keep client URLs.

## Owner actions (one time)

1. Enable Google Apps Script API (successful clasp clone means this has been done).
2. Sign in with npx --yes @google/clasp login (completed).
3. Keep your local backup of all eight files at ~/Desktop/HospoLP-Apps-Script-backup (completed).
4. In Terminal run: pbcopy < ~/.clasprc.json
5. Open https://github.com/ChipButt/HospoLP/settings/secrets/actions and add repository Actions secret named CLASPRC_JSON, with the clipboard contents. The content is a HIGHLY SENSITIVE Google OAuth credential. Never paste or upload it into a chat or a committed file.
6. Open https://github.com/ChipButt/HospoLP/actions/workflows/hospo-apps-script-deploy.yml, choose Run workflow, choose main, and run the manually triggered first release.
7. Verify the workflow tests and deploy succeed. Open the existing client test upload link: check 100 MB image limit, confirm progress and upload a sample image >25 MB; verify it appears in the private 02 — Photos folder.
8. Check existing editor and intake routes continue working. Google may require the script owner to authorise new Drive / external request permissions after deployment.

## Safeguards

- Not automatic on push (until first live validation). GitHub Actions secret required and deployment happens only from main.
- Push overwrites the full remote script, so we ALWAYS pull a fresh copy of all current remote project files and preserve legacy handlers and the manifest. The deployment stops on an unknown/missing file.
- The project source maps ClientOnboarding.gs in GitHub to ClientOnboarding.js in the clasp clone.
- If appsscript.json lists explicit OAuth scopes, add only drive and script.external_request as needed, retaining all existing scopes.
- A pre-deploy script version is retained; rollback using Apps Script > Deploy > Manage deployments > Edit > select previous working version > Deploy, preserving the same URL.
- Avoid running clasp push from your Desktop backup directory. It is a backup, not the new source of truth.
- CLASPRC_JSON grants broad access as the signed-in Google account; use secure GitHub secret storage, restrict repository write access, and revoke credentials if exposed.
- After verifying the first live cutover, we can change workflow_dispatch-only to auto deploy when release branch tests pass.
