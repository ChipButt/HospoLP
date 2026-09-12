# Domain and deployment

This repository includes `.github/workflows/deploy-pages.yml`, which publishes the complete static site whenever `main` changes.

## One-time GitHub setup per customer repo
1. Open **Settings → Pages** in the customer repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Run/push the workflow and confirm the temporary `username.github.io/repository` Pages URL works.
4. In **Settings → Pages**, enter the customer's custom domain.
5. Add the DNS records requested by GitHub at the customer's DNS provider.
6. Once GitHub issues the certificate, enable/enforce HTTPS.
7. Replace/remove `CNAME.example` as appropriate. GitHub's Pages settings remain the source of truth for the custom domain.

## Editor address
The site includes `/edit/`, which redirects the customer to the hosted Pages CMS editor. This means you can hand over an easy address such as `https://thepub.co.uk/edit/` rather than telling the customer to remember the CMS provider URL.

## Important
The repository is one location only. For another business, duplicate this repository into a new repo and configure Pages/domain/editor separately. That gives each business independent DNS, deployment history and rollback.
