# Create a new customer website

1. Duplicate HospoLP into a new GitHub repository owned/managed by the agency.
2. Give the new repository a clear client name.
3. Replace `content/*.json` with the new business information.
4. Replace all media and logo assets.
5. **Use a multi-page structure by default.** The homepage should introduce the business and link to separate pages for the major sections rather than stacking everything into one long page with jump links.
6. Start from the standard page set: Home, About, Food/Menu, Drinks, Opening Hours, What's On/Events, and Visit/Contact/Facilities.
7. Remove, rename or combine pages only when the client brief gives a good reason. For example, a business with no drinks offering does not need a Drinks page.
8. Redesign the public-facing pages and `assets/styles.css` so the site suits that business. The repeatable element is the architecture and workflow, not the visual design.
9. Keep shared customer-editable data in `content/*.json` so information can be reused across pages without duplication.
10. Keep `assets/app.js` capable of loading shared content from both the homepage and nested pages using the page base path.
11. Keep the customer-editable content model where useful; add/remove editor fields to match the package sold.
12. Give each public page appropriate page-specific title/description metadata while keeping the shared business details accurate.
13. Connect Pages CMS and invite the customer by email.
14. Enable GitHub Pages for the new repository and connect that business's domain.
15. Test every page and navigation link on desktop and mobile.
16. Complete `LAUNCH-CHECKLIST.md` before handover.

## Standard page rule
A major user task should normally have its own page. Menu, opening hours, events and visit/contact information should not be buried halfway down a homepage unless the brief specifically calls for a single-page site.

The repeatable product is the package and workflow, not a requirement for every customer's website to look the same.
