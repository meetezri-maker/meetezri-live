# SEO remediation register

This register tracks public-search issues that require legal, privacy, content, or product review. It is not public website copy.

## Terms content review

Status: Open — blocks indexation.

The current Terms page contains outdated or inconsistent content. Legal and content review is required before it can be presented to search engines as an approved legal document.

Until approval:

- Keep `/terms` directly accessible and prerendered.
- Keep its robots policy at `noindex,follow`.
- Keep it out of `sitemap.xml`.
- Verify every support and legal contact detail.

After approval, restore `index,follow` and sitemap inclusion through the central public SEO registry.

## Privacy Policy placeholders

Status: Open — blocks indexation.

The current Privacy Policy contains unresolved legal, business, provider, contact, retention, and deletion placeholders. Keep `/privacy` under its approved noindex policy until legal and privacy owners replace every placeholder and verify the resulting disclosure against production behavior.

## Data-export scope mismatch

Status: Open — product and privacy remediation required.

Account-settings copy describes an export of all user data, while the current API export returns profile data only. Cycle 2A does not expand export functionality. Until the product and API agree, public copy must refer only to the currently available profile-data export or generally to available account controls.

## Retention and backup deletion

Status: Open — verification required.

No specific retention period or backup-deletion guarantee should be published until the governing policy and implementation have both been reviewed and confirmed.
