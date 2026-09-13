/**
 * HTML Exporter
 * Converts backed-up posts, metadata, and recursively nested comments into 
 * beautiful, standalone, offline-ready HTML documents.
 */

import { formatPersianDate, toPersianDigits } from '../date-utils.js';

const DEFAULT_AVATAR_URL = 'https://static.virgool.io/images/app/avatar-default.jpg?x-img=v1/format,type_webp/resize,w_32,h_32/optimize,q_75';

const STANDALONE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap');

:root {
  --font-main: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --color-blue: #107abe;
  --color-blue-bg: #eaf4fb;
  --color-gray-50: #ffffff;
  --color-gray-100: #f8fafc;
  --color-gray-200: #e2e8f0;
  --color-gray-300: #cbd5e1;
  --color-gray-600: #64748b;
  --color-gray-700: #475569;
  --color-gray-800: #1e293b;
  --color-gray-900: #0f172a;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-main);
  direction: rtl;
  text-align: right;
  background-color: var(--color-gray-100);
  color: var(--color-gray-900);
  line-height: 1.9;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  padding: 40px 20px 80px 20px;
}

.article-container {
  max-width: 820px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 16px;
  padding: 40px 48px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--color-gray-200);
}

.article-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-gray-200);
}

.article-title {
  font-size: 28px;
  font-weight: 900;
  line-height: 1.5;
  color: var(--color-gray-900);
  margin-bottom: 20px;
}

.author-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.author-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-gray-200);
}

.author-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-gray-900);
}

.author-username {
  font-size: 12.5px;
  color: var(--color-gray-600);
  direction: ltr;
  text-align: right;
  display: inline-block;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: var(--color-gray-600);
}

.article-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.article-cover {
  width: 100%;
  max-height: 460px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 32px;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.tag-badge {
  background: var(--color-gray-100);
  color: var(--color-blue);
  border: 1px solid var(--color-gray-200);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.article-body {
  font-size: 16.5px;
  line-height: 2.1;
  color: var(--color-gray-800);
  word-break: break-word;
}

.article-body p {
  margin-bottom: 22px;
}

.article-body h2, .article-body h3, .article-body h4 {
  font-weight: 800;
  color: var(--color-gray-900);
  margin: 36px 0 16px 0;
  line-height: 1.5;
}

.article-body h2 { font-size: 22px; }
.article-body h3 { font-size: 19px; }

.article-body img {
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  margin: 20px auto;
  display: block;
}

.article-body figure {
  margin: 24px 0;
  text-align: center;
}

.article-body figcaption {
  font-size: 13px;
  color: var(--color-gray-600);
  margin-top: 8px;
}

.article-body blockquote {
  border-right: 4px solid var(--color-blue);
  background: var(--color-blue-bg);
  padding: 16px 20px;
  margin: 24px 0;
  border-radius: 0 10px 10px 0;
  font-style: italic;
}

.article-body pre, .article-body code {
  font-family: monospace, monospace;
  direction: ltr;
  text-align: left;
}

.article-body pre {
  background: #1e293b;
  color: #f8fafc;
  padding: 16px 20px;
  border-radius: 10px;
  overflow-x: auto;
  margin: 24px 0;
  font-size: 14px;
  line-height: 1.6;
}

.article-body code:not(pre code) {
  background: #f1f5f9;
  color: #d7373f;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
}

.article-body ul, .article-body ol {
  padding-right: 28px;
  margin-bottom: 22px;
}

.article-body li {
  margin-bottom: 8px;
}

.audio-box {
  background: var(--color-blue-bg);
  border: 1px solid #c1e3fa;
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.audio-box a {
  color: var(--color-blue);
  font-weight: 700;
  text-decoration: none;
}

.comments-section {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 2px solid var(--color-gray-200);
}

.comments-header {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-gray-900);
  margin-bottom: 24px;
}

.comment-card {
  background: #ffffff;
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 16px;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.comment-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
}

.comment-author-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--color-gray-900);
}

.comment-date {
  font-size: 11.5px;
  color: var(--color-gray-600);
  margin-top: 2px;
}

.comment-body {
  font-size: 14.5px;
  line-height: 1.9;
  color: var(--color-gray-800);
  white-space: pre-wrap;
  word-break: break-word;
}

.replies-list {
  margin-top: 14px;
  padding-right: 20px;
  border-right: 2px solid #e2e8f0;
}

.footer-credit {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--color-gray-200);
  text-align: center;
  font-size: 12.5px;
  color: var(--color-gray-600);
}

.footer-credit a {
  color: var(--color-blue);
  font-weight: 700;
  text-decoration: none;
}

@media print {
  body {
    background: #ffffff;
    padding: 0;
  }
  .article-container {
    box-shadow: none;
    border: none;
    padding: 0;
  }
}
`;

export function postToStandaloneHtml(post, author) {
  const authorName = author?.name || post.user?.name || 'کاربر ویرگول';
  const username = author?.username || post.user?.username || '';
  const avatarUrl = author?.avatar || post.user?.avatar || DEFAULT_AVATAR_URL;
  const dateStr = formatPersianDate(post.publishedAt);
  const totalComments = (post.comments || []).reduce((acc, c) => acc + countComments(c), 0);

  const commentsHtml = (post.comments && post.comments.length > 0)
    ? `
      <section class="comments-section">
        <h3 class="comments-header">نظرات و پاسخ‌ها (${toPersianDigits(totalComments || post.commentsCount || 0)})</h3>
        ${post.comments.map((c) => renderCommentHtml(c)).join('')}
      </section>
    `
    : '';

  const tagsHtml = (post.tags && post.tags.length > 0)
    ? `
      <div class="article-tags">
        ${post.tags.map((t) => `<span class="tag-badge"># ${escapeHtml(t.name)}</span>`).join('')}
      </div>
    `
    : '';

  const audioHtml = (post.sound && post.sound.url)
    ? `
      <div class="audio-box">
        <span>نسخه صوتی این مقاله در ویرگول موجود است</span>
        <a href="${post.sound.url}" target="_blank" rel="noreferrer">شنیدن فایل صوتی</a>
      </div>
    `
    : '';

  const coverHtml = post.image
    ? `<img class="article-cover" src="${post.image}" alt="${escapeHtml(post.title)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(post.title)} — ${escapeHtml(authorName)}</title>
  <style>${STANDALONE_CSS}</style>
</head>
<body>
  <main class="article-container">
    <header class="article-header">
      <h1 class="article-title">${escapeHtml(post.title)}</h1>
      <div class="author-bar">
        <img class="author-avatar" src="${avatarUrl}" alt="${escapeHtml(authorName)}" onerror="this.src='${DEFAULT_AVATAR_URL}'" />
        <div>
          <div class="author-name">${escapeHtml(authorName)}</div>
          ${username ? `<div class="author-username">@${escapeHtml(username)}</div>` : ''}
        </div>
      </div>
      <div class="article-meta">
        <span>تاریخ: ${dateStr}</span>
        <span>زمان مطالعه: ${toPersianDigits(post.readingTime || 1)} دقیقه</span>
        <span>پسند: ${toPersianDigits(post.likesCount || 0)}</span>
        <span>نظرات: ${toPersianDigits(totalComments || post.commentsCount || 0)}</span>
      </div>
      ${tagsHtml}
    </header>

    ${coverHtml}
    ${audioHtml}

    <article class="article-body">
      ${post.content?.bodyHtml || `<p>${escapeHtml(post.description || '')}</p>`}
    </article>

    ${commentsHtml}

    <footer class="footer-credit">
      <span>پشتیبان‌گیری شده توسط افزونه <b>ویرگول بک‌آپ</b></span>
      <span>• توسعه‌داده‌شده توسط <a href="https://github.com/EhsanShahbazii" target="_blank" rel="noreferrer">احسان شهبازی</a></span>
    </footer>
  </main>
</body>
</html>`;
}

function renderCommentHtml(comment) {
  const name = escapeHtml(comment.user?.name || 'کاربر ویرگول');
  const avatar = comment.user?.avatar || DEFAULT_AVATAR_URL;
  const date = formatPersianDate(comment.publishedAt, true);
  const replies = comment.repliesList || [];

  return `
    <div class="comment-card">
      <div class="comment-header">
        <img class="comment-avatar" src="${avatar}" alt="${name}" onerror="this.src='${DEFAULT_AVATAR_URL}'" />
        <div>
          <div class="comment-author-name">${name}</div>
          <div class="comment-date">${date}</div>
        </div>
      </div>
      <div class="comment-body">${escapeHtml(comment.body || '')}</div>
      ${replies.length > 0 ? `
        <div class="replies-list">
          ${replies.map((r) => renderCommentHtml(r)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function countComments(c) {
  let cnt = 1;
  if (c.repliesList && c.repliesList.length > 0) {
    c.repliesList.forEach((r) => {
      cnt += countComments(r);
    });
  }
  return cnt;
}

export function exportSinglePostHtml(post, author) {
  const htmlContent = postToStandaloneHtml(post, author);
  const cleanTitle = (post.title || 'post').replace(/[\\/:*?"<>|]/g, '-').slice(0, 50);
  const filename = `${cleanTitle}.html`;

  downloadBlob(htmlContent, filename, 'text/html;charset=utf-8');
  return filename;
}

export function exportBackupToHtml(backupPackage, filename) {
  if (!backupPackage) throw new Error('No backup data to export');

  const user = backupPackage.user || {};
  const posts = backupPackage.posts || [];
  const vTag = backupPackage.versionLabel ? `-${backupPackage.versionLabel}` : '';
  const defaultFilename = filename || `virgool-${user.username || 'backup'}${vTag}-${posts.length}-posts-${new Date().toISOString().slice(0, 10)}.html`;

  const articlesHtml = posts.map((post, idx) => `
    <section id="article-${idx + 1}" style="margin-bottom: 60px; padding-bottom: 40px; border-bottom: 2px dashed #cbd5e1;">
      <header class="article-header">
        <h2 class="article-title" style="font-size: 24px;">${idx + 1}. ${escapeHtml(post.title)}</h2>
        <div class="article-meta">
          <span>تاریخ: ${formatPersianDate(post.publishedAt)}</span>
          <span>زمان مطالعه: ${toPersianDigits(post.readingTime || 1)} دقیقه</span>
          <span>پسند: ${toPersianDigits(post.likesCount || 0)}</span>
        </div>
        ${(post.tags && post.tags.length > 0) ? `
          <div class="article-tags">
            ${post.tags.map((t) => `<span class="tag-badge"># ${escapeHtml(t.name)}</span>`).join('')}
          </div>
        ` : ''}
      </header>

      ${post.image ? `<img class="article-cover" src="${post.image}" alt="${escapeHtml(post.title)}" />` : ''}

      <article class="article-body">
        ${post.content?.bodyHtml || `<p>${escapeHtml(post.description || '')}</p>`}
      </article>

      ${(post.comments && post.comments.length > 0) ? `
        <div class="comments-section" style="margin-top: 32px;">
          <h4 class="comments-header" style="font-size: 16px;">نظرات (${toPersianDigits(post.comments.length)})</h4>
          ${post.comments.map((c) => renderCommentHtml(c)).join('')}
        </div>
      ` : ''}
    </section>
  `).join('');

  const tocHtml = `
    <nav style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 48px;">
      <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 16px; color: #1e293b;">فهرست مقالات (${toPersianDigits(posts.length)} مورد)</h3>
      <ol style="padding-right: 24px; line-height: 2;">
        ${posts.map((p, idx) => `
          <li>
            <a href="#article-${idx + 1}" style="color: #107abe; text-decoration: none; font-weight: 600;">${escapeHtml(p.title)}</a>
            <span style="color: #64748b; font-size: 12.5px; margin-right: 6px;">(${formatPersianDate(p.publishedAt)})</span>
          </li>
        `).join('')}
      </ol>
    </nav>
  `;

  const fullHtml = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>آرشیو مقالات ویرگول — ${escapeHtml(user.name || user.username || 'کاربر')}</title>
  <style>${STANDALONE_CSS}</style>
</head>
<body>
  <main class="article-container" style="max-width: 900px;">
    <header style="text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0;">
      <img src="${user.avatar || DEFAULT_AVATAR_URL}" alt="${escapeHtml(user.name || '')}" style="width: 72px; height: 72px; border-radius: 50%; margin-bottom: 12px;" />
      <h1 style="font-size: 26px; font-weight: 900; color: #0f172a;">${escapeHtml(user.name || user.username || 'کاربر ویرگول')}</h1>
      <div style="color: #64748b; font-size: 14px; margin-top: 4px;">@${escapeHtml(user.username || '')}</div>
      ${user.bio ? `<p style="margin-top: 10px; color: #475569; font-size: 14px;">${escapeHtml(user.bio)}</p>` : ''}
      <div style="margin-top: 16px; font-size: 13px; color: #64748b;">
        نسخه پشتیبان تهیه‌شده در ${formatPersianDate(backupPackage.createdAt)}
      </div>
    </header>

    ${tocHtml}
    ${articlesHtml}

    <footer class="footer-credit">
      <span>پشتیبان‌گیری شده توسط افزونه <b>ویرگول بک‌آپ</b></span>
      <span>• توسعه‌داده‌شده توسط <a href="https://github.com/EhsanShahbazii" target="_blank" rel="noreferrer">احسان شهبازی</a></span>
    </footer>
  </main>
</body>
</html>`;

  downloadBlob(fullHtml, defaultFilename, 'text/html;charset=utf-8');
  return defaultFilename;
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
