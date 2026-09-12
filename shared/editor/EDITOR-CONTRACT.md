# Customer editor contract

The customer editor is intentionally basic.

Customers may change operational content: hours, contact details, announcements, menu/drink content and prices, events, facilities and gallery media.

Customers may not change layout, CSS, navigation architecture, components, deployment, GitHub settings, domains, integrations or the editor configuration.

For v1 the content-management layer is Pages CMS. It writes the business's content files in GitHub while keeping the normal customer workflow focused on content fields rather than repository administration. A custom branded editor can replace this layer later without changing the public-site content contract.
