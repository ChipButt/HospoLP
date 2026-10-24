# Chip In Website Review & Approval — live workflow

## Purpose

Give every approved client a **single client-specific review link** for their Cloudflare Pages draft, rather than a private GitHub repository URL. Feedback is stored in the client's existing **private Google Drive project folder** in `website-review.json`. No third-party form provider or paid comment platform is required.

## Owner steps in the existing onboarding admin

Open https://script.google.com/macros/s/AKfycbzz7FWTrjHkH8LUCrEElzr1MFCN9lN408-C_wC2o2FAU5j8HYXd43uUBgUHRDsiB78/exec?mode=onboard-admin .

1. Complete the Chip In meeting and quote; get written acceptance and activate the private client workspace.
2. Provision the client's private GitHub repository and free Cloudflare Pages project using Step 4 (requires the already-documented one-time GitHub and Cloudflare Script Properties). Put a working first website draft onto the Pages production branch **before** opening review.
3. In Step 5 **Prepare first-draft review link**. This does NOT start the client's feedback clock.
4. Click **Email draft and start 3-day review** once the first revision is truly ready. This first successful invitation sets the deadline to **72 hours later**. Resending does not restart the clock.
5. The email links to a new `?mode=website-review&code=<strong-random-token>` page on the existing Apps Script web app. The client can browse the Cloudflare Pages website in an iframe and leave page-specific, optionally pinned visual comments. They can return to review notes any time during the three calendar days.
6. Client selects **Submit my complete feedback to Chip In**. This is a single round and closes additional comments. The owner receives an email notice. If the three days expire without submission, the owner can explicitly close the expired feedback round in Step 5; **this never implies permission to publish the website**.
7. Admin displays the submitted comments grouped with their site page and pin coordinates. Work each comment through *Outstanding → In progress → Completed*. Do the agreed revisions within the quoted five working days.
8. Only after **all** listed amendments are marked *Completed*, click **Send finished website for written approval**. The client receives the *same* review link, views the finished website and signs off with their name plus a required confirmation checkbox.
9. The system saves the client's approver name and exact timestamp and emails the Chip In owner. This is an **authorisation to arrange launch**, not an automatic DNS change. After recorded sign-off, separately verify the custom domain's DNS, MX/email records and SSL before public launch (normally 24–48 hours, sometimes longer).
10. Keep the project review file with the assets and original quote for an audit trail.

## Privacy and technical limitations

- Google Apps Script checks a high-entropy bearer token. A client needs no GitHub account. Share the review link privately; anyone who has it can read and submit that client's review during the permitted window.
- The review portal is protected by its link, but **Cloudflare's underlying `*.pages.dev` draft site is public by default**. The portal token alone does NOT secure the staging site or prevent visitors from finding it. Enable Cloudflare Access or another suitable authentication layer when the draft is not intended to be public, and test whether the provider allows iframe embedding. An externally opened preview is available if the embedded frame is blocked.
- The embedded Pages site is cross-origin: pointer pins are attached to the **currently entered page URL path and the position within its viewport**. The reviewer must describe the element in words too; pins do not attach to semantic DOM elements or automatically follow scrolling/responsive changes. Navigation occurs normally inside the iframe, but for reliable pin locations use the page-path field / Open page button.
- One review round: 3 calendar days from the first invitation. Max 60 comments, each with up to 1,200 characters. Comment status is owner-only.
- The new review link is valid for 45 days (to accommodate revisions and approval). Expired links need a future extension workflow; do not bypass expiry by sharing owner access keys.
- No client website source, client private Drive folder or GitHub credentials are exposed in the review response.
- All owner actions use the same authenticated, time-limited admin session. The `website-review.json` file is in the private project folder; owner notification email includes no full comment body or tokens.
- The review site is created on the **existing** Google Apps Script deployment and adds a route to `Code.js`, rather than hosting another backend on a client website.
- Real end-to-end verification requires a provisioned Cloudflare Pages client site and an actual invitation and client submission. CI mocks the existing Apps Script/Drive/Mail services and tests the date gate, comments, owner statuses and written sign-off, but simulated CI is not the same as live browser testing.

## Rollback

GitHub Actions first clones all existing live Apps Script files, checks the existing routes and file inventory, saves a version and only then adds the two new review files plus a **single additive** `website-review` routing condition. The original intake, editor and uploads remain. For an issue, in Apps Script → Deploy → Manage deployments, select the last working web-app version for the existing deployment ID to preserve the client URLs.

## Relevant source

- `apps-script/ClientReviewService.gs` — authenticated endpoints for comments, one-round submission and approval.
- `apps-script/ClientWebsiteReview.html` — responsive client review portal with site iframe, pin mode and comments.
- `apps-script/ClientOnboardingAdmin.html` — owner controls and comment status review.
- `scripts/prepare-apps-script-deployment.cjs` — safe incremental installation into the existing live Apps Script project.
- `scripts/test-client-onboarding.cjs` and `scripts/test-apps-script-deployment.cjs` — regression tests.
