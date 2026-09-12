# Deployment model

Each business is isolated under `businesses/<slug>/`. The public deploy target is that business's `site/` plus its `content/` and approved media. The customer's domain points at that deploy. The editor is scoped to the same business content only.

## Release gate
A client is ready to sell only when: business-owned imagery is installed; contact/hours/menu/event data are confirmed; domain is connected; HTTPS works; mobile layout is checked; all buttons work; editor changes publish successfully; customer cannot access developer controls; and rollback/source ownership arrangements are documented.
