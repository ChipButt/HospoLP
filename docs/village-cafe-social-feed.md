# Village Café social feed – owner setup (not published on the café pages)

The public website at samples/village-cafe-bidford/updates.html displays real
posts only. It never fabricates a social update. Before accounts are connected,
it displays genuine café photographs with links to the real social profiles.

The static GitHub Pages site cannot securely keep Facebook/Instagram credentials.
Instead, .github/workflows/village-cafe-social-feed.yml refreshes the latest
posts using the Meta Graph API approximately every 15 minutes and commits safe JSON plus local
post images to the repo. No subscription is required.

## One-time account authorisation

An administrator for the business's Facebook Page must set up Meta Graph API
access and grant the necessary permission to read the Page's published posts
(e.g. pages_read_engagement and pages_read_user_content, per Meta's current
approval rules). They must create a Page access token for the correct Page.

If Instagram is required, use the official Instagram Graph API with a linked
Professional/Creator Instagram account and permissions to read media. This may
require linking the professional account to a Facebook Page or using the
Instagram Login route instead. The current importer expects the Facebook
Graph-connected Instagram Business Account ID and token.

In the GitHub repo go to Settings → Secrets and variables → Actions and add:

- CAFE_FB_PAGE_ID: numeric Facebook Page ID
- CAFE_FB_PAGE_TOKEN: corresponding authorised Page access token
- CAFE_IG_USER_ID: numeric IG professional/business account ID (optional)
- CAFE_IG_ACCESS_TOKEN: token for that IG account (optional if the Page token is authorised)

**Never paste tokens into HTML, JavaScript, issues, logs or chat messages.**
Do not put them in this file.

Then run Actions → Village Cafe social feed → Run workflow to test.
After credentials have been configured, the importer retains only the five latest dated posts across connected Facebook and Instagram accounts. GitHub Actions schedules and Pages publishing are not instantaneous; expect a delay from posting to display. The webpage checks for updated feed data every two minutes while open. During feed failures, it keeps previously retrieved posts.\n\nThe latest JSON file is at samples/village-cafe-bidford/data/social-posts.json.
If the API is unavailable, the refresh job preserves previously retrieved posts
rather than clearing the website. Account authorisation/token refresh is the
owner's continuing responsibility under Meta's rules.

The Facebook Page Plugin iframe was removed because it displayed a header but
an empty timeline in the observed browser screenshot. Neither platform offers
an uncredentialled, reliable live public-profile feed for static HTML sites.

## Current historical display

Until Meta access is authorised, the feed data contains four older, undated post summaries and selected matching or contextual images from the café's own photo archive. These images are explicitly labelled as archive photographs and are not represented as the original social-post attachments. They are **not** the five most recent posts. Do not add invented dates or captions to fill a fifth slot. Once the first authorised account sync succeeds, the importer removes this archive-only fallback and presents up to five verified, dated posts, newest first.
