# The Village Cafe — automatic social updates: connection checklist

**Status:** Website renderer and GitHub Actions importer are installed. A live feed has **not** been authenticated. The customer-facing page does not display invented social posts, unrelated photographs, credentials, or technical setup instructions.

## What the business owner needs to authorise

The Page owner or an administrator with sufficient Page access must consent to an integration with Meta. You cannot use the public URL alone as an API credential.

1. Sign into [Meta for Developers](https://developers.facebook.com/) as an authorised business administrator and create/configure an application for Pages access. If requested, add the Page manager as an app role while testing.
2. Grant the app the permissions appropriate for reading the Page's own published posts. For the Facebook Pages API, `pages_show_list` and `pages_read_engagement` are typically relevant. Additional access, including app review, may be required depending on the app's mode and use. Verify granted scopes using Graph API Explorer.
3. Obtain a valid **Page access token** and the Page's **numeric ID** via the authorised /me/accounts flow, not from a guessed profile URL. Prefer a token with the appropriate lifetime / renewal plan.
4. To include Instagram, it must be a Professional (Business or Creator) account linked to the Facebook Page for the currently implemented Facebook Login / Instagram Graph API route. Its authorised numeric IG account ID and appropriate `instagram_basic` permissions are required.
5. In GitHub `ChipButt/HospoLP`, go to **Settings → Secrets and variables → Actions**. Store the resulting secrets (never in website HTML or chat):
   - `CAFE_FB_PAGE_ID`: numeric Page ID
   - `CAFE_FB_PAGE_TOKEN`: authorised Page access token
   - `CAFE_IG_USER_ID`: numeric professional IG account ID (optional until connected)
   - `CAFE_IG_ACCESS_TOKEN`: corresponding IG-access token, if separate (optional if authorised Page token works)
6. Go to **Actions → Village Cafe social feed → Run workflow**. Check that the logs explicitly report loaded posts from the connected platform(s), rather than 'not connected' or 'could not refresh'.
7. Confirm `samples/village-cafe-bidford/data/social-posts.json` now contains up to **five dated posts**, and that the referenced images exist in `assets/village-cafe/social/`. Check the public Updates page renders their full captions, dates and actual downloaded photos. Post a new test update and ensure it enters the feed and displaces the oldest once there are five.

The scheduled workflow runs approximately **every 15 minutes**. GitHub Actions schedules and GitHub Pages deployments can be delayed. When the webpage is open, it checks the published feed every **two minutes** and also when the tab becomes visible again. It is near-live, not immediate.

The importer keeps previously retrieved dated posts if Meta is temporarily unavailable. Tokens must remain valid and may require renewal. A user who cannot administer the café's Page must obtain the owner's explicit consent first.

## Technical files

- Backend: `scripts/sync_village_cafe_social.py`
- GitHub Actions: `.github/workflows/village-cafe-social-feed.yml`
- Public data: `samples/village-cafe-bidford/data/social-posts.json`
- Renderer: `samples/village-cafe-bidford/updates.js`

**Never put API access tokens in issues, HTML, GitHub commits or ChatGPT.**
