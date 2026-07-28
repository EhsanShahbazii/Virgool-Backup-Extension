# Chrome Web Store Listing — Virgool Backup

> Last Updated: 2026-09-13

## Store Listing

**Extension Name** [REQUIRED]
Virgool Backup - ویرگول بک‌آپ

**Short Description** [REQUIRED]
پشتیبان‌گیری کامل از پست‌ها، متن مقالات و کامنت‌های ویرگول با خروجی JSON و PDF
Backup all your Virgool.io posts, full text, and comments with JSON & PDF export.

**Detailed Description** [REQUIRED]
Virgool Backup is a fast, elegant backup tool designed for writers and readers on virgool.io.

Save your thoughts, stories, and community discussions forever. With one click, this extension fetches your published articles along with full article contents, images, voice overs, tags, reading times, and all hierarchical comments and replies.

Key Features:
- Complete Post Extraction: Saves titles, slugs, publish dates, covers, audio narrations, and tags.
- Full Rich-Text Body Backup: Retains all paragraphs, headings, blockquotes, code snippets, and inline photos.
- Threaded Comments & Replies: Preserves reader discussions, likes, and reply chains.
- Beautiful PDF Export: Native Persian/RTL layout formatted with the elegant Vazirmatn font, ready for reading or archiving.
- Structured JSON Export: Clean data file ideal for data migration, developers, or personal archive backups.
- Offline Viewing: Inspect and read your downloaded posts anytime directly from the backup manager.

How to use:
1. Navigate to any Virgool profile (e.g., virgool.io/@username) or open the extension popup.
2. The extension automatically detects the active username, or you can enter any Virgool username manually.
3. Click "Start Backup" and watch the live progress bar as it fetches articles and comments.
4. Export your complete backup to JSON, or generate a stunning printable PDF!

Privacy & Permissions:
All data is fetched directly from virgool.io and stored locally on your own computer. No data is ever tracked, sold, or sent to external servers.

**Category** [REQUIRED]
Blogging / Productivity

**Single Purpose** [REQUIRED]
Backs up user posts, full content, and comments from virgool.io and exports them as JSON and PDF files.

**Primary Language** [REQUIRED]
Persian (fa)

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| storage | permissions | Stores backup state and fetched posts locally on the user's browser. |
| downloads | permissions | Enables downloading the exported JSON and PDF backup files to the user's device. |
| activeTab | permissions | Detects current virgool.io profile URL when the user opens the extension popup. |
| https://virgool.io/* | host_permissions | Communicates with Virgool API endpoints to fetch user posts and comments. |
| https://files.virgool.io/* | host_permissions | Loads author avatars and post images for offline storage and PDF embedding. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

All data remains purely local inside the user's browser.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Distribution

**Visibility**: Public
**Pricing**: Free

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-09-13 | Initial release with full post scraping, comments & replies, JSON/PDF export. | Draft |
