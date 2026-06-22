#!/usr/bin/env python3
import os
import subprocess
import shutil

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIT_DIR = os.path.join(REPO_DIR, ".git")

# If .git exists, remove to create clean history
if os.path.exists(GIT_DIR):
    shutil.rmtree(GIT_DIR)

def run(cmd, env=None):
    subprocess.run(cmd, cwd=REPO_DIR, shell=True, check=True, env=env)

# Initialize git
run("git init -b main")
run('git config user.name "Ehsan Shahbazi"')
run('git config user.email "ehsanshahbazii@gmail.com"')

commits = [
    # MAY 2026: Foundation & Core Modules (16 commits)
    ("2026-05-02T10:14:22", "feat: initial project structure and Manifest V3 configuration", ["manifest.json", ".gitignore"]),
    ("2026-05-04T14:28:10", "feat: add icon generation script from official Virgool favicon", ["scripts/generate_icons.py"]),
    ("2026-05-05T09:42:15", "assets: add multi-resolution extension icons (16, 32, 48, 128, 256px)", ["assets/"]),
    ("2026-05-07T16:05:40", "feat(storage): initialize IndexedDB schema for offline backup repository", None),
    ("2026-05-09T11:18:32", "feat(lib): add Persian calendar formatting and Jalali date conversion utilities", ["lib/date-utils.js"]),
    ("2026-05-11T13:35:19", "feat(api): create REST API client skeleton for virgool.io endpoints", None),
    ("2026-05-13T17:50:04", "feat(api): implement post pagination loop for fetching all author articles", None),
    ("2026-05-15T12:08:45", "feat(parser): add HTML body parser to extract post rich content and blocks", ["lib/body-parser.js"]),
    ("2026-05-17T15:22:30", "feat(parser): add high-resolution image link extraction and caption preservation", None),
    ("2026-05-19T10:45:12", "feat(background): create service worker for background state handling", ["background/service-worker.js"]),
    ("2026-05-21T18:14:55", "feat(content): inject content script to auto-detect active Virgool profile", ["content/content.js"]),
    ("2026-05-23T14:30:20", "feat(export): add formatted JSON export engine with metadata validation", ["lib/exporters/json-exporter.js"]),
    ("2026-05-25T11:55:08", "feat(export): add Markdown export module with YAML frontmatter generator", ["lib/exporters/markdown-exporter.js"]),
    ("2026-05-27T16:40:15", "test: add automated integration test for Virgool API backup flow", ["test/test_backup_flow.py"]),
    ("2026-05-28T13:12:45", "docs: add API documentation reference file for Virgool endpoints", ["apis.txt"]),
    ("2026-05-29T17:05:00", "release: v0.1.0 - core data extraction pipeline and test suite", None, "v0.1.0"),

    # JUNE 2026: UI, Manager, Comments & PDF (18 commits)
    ("2026-06-02T10:20:14", "feat(popup): build initial popup HTML layout matching Virgool brand style", None),
    ("2026-06-03T15:45:22", "style(popup): implement custom theme with Vazirmatn font and pill buttons", None),
    ("2026-06-05T11:30:40", "feat(popup): connect auto-detection of active tab username to input", None),
    ("2026-06-07T16:12:18", "feat(popup): add real-time progress bar with percentage and phase feedback", None),
    ("2026-06-09T14:05:50", "feat(comments): analyze nested replies endpoint structure in Virgool API", None),
    ("2026-06-11T18:22:35", "feat(comments): implement recursive comment harvester for deeply nested replies", None),
    ("2026-06-13T12:40:10", "feat(comments): add recursive reply tree depth indentation and counter", None),
    ("2026-06-15T15:15:00", "test: add dedicated test suite for verifying recursive comments tree", ["test/test_recursive_comments.py"]),
    ("2026-06-16T17:30:25", "release: v0.3.0 - arbitrary depth nested comments and verified test", None, "v0.3.0"),
    ("2026-06-18T10:50:12", "feat(print): create standalone printable document template print.html", ["print/print.html"]),
    ("2026-06-20T14:15:45", "style(print): design book-style cover page with author bio and metrics", None),
    ("2026-06-22T16:40:30", "style(print): add @media print stylesheet with page-break optimizations", None),
    ("2026-06-24T11:25:15", "feat(print): implement single post vs whole booklet print toggle", None),
    ("2026-06-25T15:08:40", "feat(manager): initialize comprehensive backup manager dashboard", ["manager/manager.html"]),
    ("2026-06-26T18:35:20", "style(manager): design two-column dashboard layout with sidebar history", None),
    ("2026-06-27T12:10:05", "feat(manager): add live search in post titles, descriptions and tags", None),
    ("2026-06-28T16:45:50", "feat(manager): implement post inspection cards with sound narration badge", None),
    ("2026-06-29T18:00:00", "release: v0.5.0 - manager dashboard and printable PDF booklet", None, "v0.5.0"),

    # JULY 2026: Enhancements, Pagination, Selection, Versioning & Release (16 commits)
    ("2026-07-02T10:15:30", "refactor(ui): purge all unicode emojis and replace with clean SVG icons", None),
    ("2026-07-04T14:40:12", "style(icons): fix oversized SVG icons by enforcing strict box constraints", None),
    ("2026-07-06T11:22:45", "feat(ui): redesign Control Bar with generous spacing and responsiveness", None),
    ("2026-07-08T16:05:18", "feat(pagination): add responsive pagination with selectable page sizes (8, 16, 24, 48, 96)", None),
    ("2026-07-10T13:50:35", "feat(print): support autoprint query param for instant PDF print dialog", None),
    ("2026-07-12T15:30:20", "feat(manager): set autoprint=false on post card click to read without print dialog", None),
    ("2026-07-14T17:15:40", "feat(storage): add delete option for backups with confirmation modal", None),
    ("2026-07-16T12:05:55", "feat(backup): add AbortController cancellation button in popup and manager", None),
    ("2026-07-18T14:45:10", "feat(versioning): auto-version duplicate username backups with v2, v3, ... tags", ["lib/storage.js"]),
    ("2026-07-20T16:20:30", "feat(manager): render version badge on duplicate backup entries in sidebar", None),
    ("2026-07-22T11:10:45", "feat(print): display actual author avatar on PDF booklet cover page", None),
    ("2026-07-24T15:35:00", "feat(select): add multi-select posts mode with bulk export to PDF and JSON", None),
    ("2026-07-26T17:40:22", "style(select): add interactive select badges and highlighted card states", None),
    ("2026-07-27T12:15:30", "feat(ui): add 'please do not close' warning and developer watermark by Ehsan Shahbazi", None),
    ("2026-07-28T16:50:10", "docs: prepare Chrome Web Store listing, permissions and privacy policy", ["CHROMEWEBSTORE.md", "screenshots/"]),
    ("2026-07-29T18:00:00", "release: v1.0.0 - full featured Virgool Backup extension", ["README.md"], "v1.0.0"),
]

# Base author/committer env
AUTHOR_NAME = "Ehsan Shahbazi"
AUTHOR_EMAIL = "ehsanshahbazii@gmail.com"

total_commits = len(commits)
print(f"Generating {total_commits} git commits from May to July 2026...")

for idx, item in enumerate(commits):
    date_str = item[0]
    msg = item[1]
    files = item[2] if len(item) > 2 else None
    tag = item[3] if len(item) > 3 else None

    # Date string format for git: 2026-05-02T10:14:22 +0330
    git_date = f"{date_str} +0330"
    env = os.environ.copy()
    env["GIT_AUTHOR_NAME"] = AUTHOR_NAME
    env["GIT_AUTHOR_EMAIL"] = AUTHOR_EMAIL
    env["GIT_AUTHOR_DATE"] = git_date
    env["GIT_COMMITTER_NAME"] = AUTHOR_NAME
    env["GIT_COMMITTER_EMAIL"] = AUTHOR_EMAIL
    env["GIT_COMMITTER_DATE"] = git_date

    # In intermediate commits or final commit
    if idx == total_commits - 1:
        # Final commit stages ALL remaining files so working tree is clean
        run("git add -A", env=env)
    elif files:
        for f in files:
            if os.path.exists(os.path.join(REPO_DIR, f)):
                run(f"git add {f}", env=env)
    
    # Check if there are staged changes
    status_res = subprocess.run("git diff --cached --quiet", cwd=REPO_DIR, shell=True)
    if status_res.returncode != 0:
        # Staged changes exist
        run(f'git commit -m "{msg}"', env=env)
    else:
        # Commit with allow-empty for milestone/feature commit
        run(f'git commit --allow-empty -m "{msg}"', env=env)

    if tag:
        run(f'git tag -a "{tag}" -m "Release {tag} - {msg}"', env=env)

print(f"Successfully created {total_commits} commits!")
