# Chip In — One-click private client repository + Cloudflare Pages

## What the owner sees

In the existing [client onboarding admin](https://script.google.com/macros/s/AKfycbzz7FWTrjHkH8LUCrEElzr1MFCN9lN408-C_wC2o2FAU5j8HYXd43uUBgUHRDsiB78/exec?mode=onboard-admin), complete the meeting and accept the client quote, then create a private assets workspace. **Step 4** offers **Create private GitHub repo + Cloudflare Pages (£0)** for each approved workspace.

The action:
1. Requires the same owner-only authenticated session as the workspace admin; public upload tokens cannot call it.
2. Verifies the GitHub access token belongs to GitHub user `ChipButt`.
3. Creates a new **private** `ChipButt/chipin-<business>-<unique-workspace-id>` GitHub repository.
4. Commits a generic, no-client-details, noindex **Website in preparation** holding page to the repository.
5. Creates a Git-integrated Cloudflare Pages project in your *existing* Cloudflare account, using its GitHub App connection. Subsequent changes on the repository's production branch deploy automatically to the project's `*.pages.dev` site.
6. Records completed steps in Apps Script Script Properties. If Cloudflare refuses the initial connection, retrying continues from the *same private repository* rather than creating another.
7. Shows the private GitHub repository and Pages preview in the admin only; it does not automatically attach a client domain.

**This action does not register domains, change DNS, alter MX/email records, add any paid hosting product, publish finished client content, or launch the customer's public domain.** Those require the final revised website and written approval. A `pages.dev` staging URL is public by default, so do **not** push confidential client material into the live Pages branch before approval.

## One-time owner configuration

Use the account owning the Google Apps Script `HospoLP Client Intake` project. Open [Apps Script projects](https://script.google.com/home/projects) and select that project, then **Project Settings → Script Properties → Add script property**. Add three properties (do **not** send values into ChatGPT):

| Property name | Value |
|---|---|
| `CHIPIN_GITHUB_PROVISION_TOKEN` | GitHub token authorised to create **private repositories under ChipButt** and write initial repository files |
| `CHIPIN_CLOUDFLARE_API_TOKEN` | Cloudflare API Token scoped to **your account**, `Account → Cloudflare Pages → Edit` |
| `CHIPIN_CLOUDFLARE_ACCOUNT_ID` | 32-character Cloudflare Account ID shown in [Cloudflare dashboard](https://dash.cloudflare.com) account overview |

Create the Cloudflare token at https://dash.cloudflare.com/profile/api-tokens (or the account-scoped API tokens page if your Cloudflare dashboard now uses that).

Create GitHub token at https://github.com/settings/personal-access-tokens . GitHub's `POST /user/repos` API requires **Administration: write** or **Repository creation: write** for the authenticated user. The token must also be able to **write Contents** to newly created repos. A fine-grained token with only *selected pre-existing repos* normally cannot access newly created future repos; choose a suitable installation/app scope or all repositories according to GitHub's controls. Avoid using personal passwords or global GitHub keys.

Ensure your Cloudflare Pages GitHub integration is connected to `ChipButt` and configured to allow access to the private repos it creates. If you chose *only select repos* in the Cloudflare GitHub App installation, manually grant each new repo there (or switch to allow all repositories); otherwise API creation may return an access error. See https://developers.cloudflare.com/pages/configuration/git-integration/ and https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/create/ .

## First test

1. **Do not use a real client's site** until an end-to-end test succeeds. Create/choose an approved internal test client in Chip In onboarding.
2. On the admin page, click **Check hosting connection**. It checks whether the three Script Properties are present; it cannot verify that their API permissions work until provisioning is attempted.
3. In Step 3, find the test client. Click **Create private GitHub repo + Cloudflare Pages (£0)** and confirm.
4. Verify the resulting repo exists privately in `ChipButt` and has only a generic noindex holding page. Verify the Cloudflare Pages project is in your existing account and the Pages preview serves the generic holding page.
5. Push a harmless holding-page copy change to the repo's production branch and verify Cloudflare Pages automatically deploys that change.
6. Only **after the finished version is approved in writing** connect the intended domain from Cloudflare Pages → Custom domains, then verify DNS/HTTPS and preserve all email records. Domain registration, ownership, DNS propagation and special services remain separately handled.

## Rollback, security and failure handling

- GitHub repo creation and Cloudflare Pages project creation are **owner-triggered**, not automatically triggered by incoming files or unapproved quotations.
- Clients have no access to Script Properties or the owner-only Google Apps Script admin.
- The system checkpoints the private repository before requesting Pages creation. Retry after a Cloudflare API failure does not intentionally make duplicate repositories.
- If the GitHub API succeeds but the Apps Script request is interrupted *before* checkpointing, inspect GitHub before retrying; manually reconcile any orphan repo. Never grant this automation destructive delete permissions.
- In GitHub Actions, the existing tested [Apps Script deployment workflow](https://github.com/ChipButt/HospoLP/actions/workflows/hospo-apps-script-deploy.yml) publishes onboarding code; don't paste OAuth secrets into source.
- The Cloudflare Pages **Free** plan has limits and isn't a substitute for paid dynamic backends or commercial third-party services; quote those separately.
- If either token is exposed, revoke it immediately at the provider and rotate its Script Property.
