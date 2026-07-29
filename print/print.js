/**
 * Print & PDF Controller
 * Renders backed-up posts into an authentic Virgool-styled printable document with automatic print support.
 */

import { getBackupById, getLatestBackup } from '../lib/storage.js';
import { countAllComments } from '../lib/virgool-api.js';
import { formatPersianDate, toPersianDigits } from '../lib/date-utils.js';

let currentBackup = null;

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const backupId = urlParams.get('id');
  const postFilterParam = urlParams.get('post');
  const shouldAutoPrint = urlParams.get('autoprint') === 'true';

  if (backupId) {
    currentBackup = await getBackupById(backupId);
  }
  if (!currentBackup) {
    currentBackup = await getLatestBackup();
  }

  // Filter if multiple specific posts are requested via &posts=hash1,hash2...
  const postsFilterParam = urlParams.get('posts');
  if (postsFilterParam && currentBackup?.posts) {
    const selectedHashes = postsFilterParam.split(',').map((h) => h.trim()).filter(Boolean);
    if (selectedHashes.length > 0) {
      const filtered = currentBackup.posts.filter((p) => selectedHashes.includes(p.hash));
      if (filtered.length > 0) {
        currentBackup = {
          ...currentBackup,
          posts: filtered,
        };
      }
    }
  }

  const container = document.getElementById('docContainer');
  if (!currentBackup) {
    container.innerHTML = `
      <div style="text-align: center; padding: 80px 20px;">
        <h2 style="margin-bottom: 12px; color: var(--color-red);">هیچ داده‌ای برای چاپ یافت نشد!</h2>
        <p style="color: var(--color-gray-600);">لطفاً ابتدا از طریق افزونه ویرگول، از حساب کاربری مورد نظر بک‌آپ تهیه کنید.</p>
      </div>
    `;
    return;
  }

  // Populate toolbar
  const versionTag = currentBackup.versionLabel || (currentBackup.version && currentBackup.version > 1 ? `v${currentBackup.version}` : null);
  const userDisplayName = versionTag 
    ? `${currentBackup.user?.name || currentBackup.user?.username || 'کاربر ویرگول'} (${versionTag})`
    : (currentBackup.user?.name || currentBackup.user?.username || 'کاربر ویرگول');

  document.getElementById('toolbarTitle').textContent = `کتابچه ویرگول — ${userDisplayName}`;
  document.getElementById('postCountBadge').textContent = `${toPersianDigits(currentBackup.posts?.length || 0)} مقاله`;

  // Populate article selector
  const select = document.getElementById('postFilter');
  currentBackup.posts.forEach((p, idx) => {
    const opt = document.createElement('option');
    opt.value = p.hash || String(idx);
    opt.textContent = `${idx + 1}. ${p.title}`;
    select.appendChild(opt);
  });

  if (postFilterParam) {
    select.value = postFilterParam;
  }

  // Setup listeners
  document.getElementById('btnPrint').addEventListener('click', () => window.print());
  document.getElementById('btnClose').addEventListener('click', () => window.close());
  select.addEventListener('change', () => renderDocument());
  document.getElementById('toggleComments').addEventListener('change', () => renderDocument());
  document.getElementById('toggleImages').addEventListener('change', () => renderDocument());

  renderDocument();

  // If autoprint is requested, wait briefly for fonts/images and open print settings
  if (shouldAutoPrint) {
    setTimeout(() => {
      window.print();
    }, 450);
  }
}

function renderDocument() {
  const container = document.getElementById('docContainer');
  const selectedPostVal = document.getElementById('postFilter').value;
  const showComments = document.getElementById('toggleComments').checked;
  const showImages = document.getElementById('toggleImages').checked;

  const user = currentBackup.user || {};
  const allPosts = currentBackup.posts || [];

  const postsToRender = selectedPostVal === 'all'
    ? allPosts
    : allPosts.filter((p, idx) => p.hash === selectedPostVal || String(idx) === selectedPostVal);

  let html = '';

  // Render Cover Page only when viewing all posts
  if (selectedPostVal === 'all') {
    const totalCommentsInBackup = allPosts.reduce((acc, p) => acc + countAllComments(p.comments), 0);
    const versionTag = currentBackup.versionLabel || (currentBackup.version && currentBackup.version > 1 ? `v${currentBackup.version}` : null);
    const userDisplayName = versionTag 
      ? `${user.name || user.username || 'کاربر ویرگول'} (${versionTag})`
      : (user.name || user.username || 'کاربر ویرگول');

    html += `
      <section class="cover-page">
        <img class="cover-avatar" src="${user.avatar || '../assets/icons/icon-128.png'}" alt="${escapeHtml(user.name || user.username || 'کاربر')}" onerror="this.src='../assets/icons/icon-128.png'" />
        <h1 class="cover-title">${escapeHtml(userDisplayName)}</h1>
        <div class="cover-subtitle">@${escapeHtml(user.username || '')}</div>
        ${user.bio ? `<div class="cover-bio">${escapeHtml(user.bio)}</div>` : ''}

        <div class="cover-meta-grid">
          <div class="cover-meta-item">
            <span class="cover-meta-val">${toPersianDigits(allPosts.length)}</span>
            <span class="cover-meta-lbl">تعداد مقالات</span>
          </div>
          <div class="cover-meta-item">
            <span class="cover-meta-val">${toPersianDigits(totalCommentsInBackup)}</span>
            <span class="cover-meta-lbl">کل نظرات و پاسخ‌ها</span>
          </div>
          <div class="cover-meta-item">
            <span class="cover-meta-val">${toPersianDigits(user.followersCount || 0)}</span>
            <span class="cover-meta-lbl">دنبال‌کننده</span>
          </div>
          <div class="cover-meta-item">
            <span class="cover-meta-val">${formatPersianDate(currentBackup.createdAt)}</span>
            <span class="cover-meta-lbl">تاریخ نسخه پشتیبان</span>
          </div>
        </div>

        <div class="cover-watermark">
          <span>توسعه‌داده‌شده با</span>
          <svg class="icon-heart" viewBox="0 0 24 24" fill="#d7373f" stroke="#d7373f" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>توسط <a href="https://github.com/EhsanShahbazii" target="_blank" rel="noreferrer">احسان شهبازی</a></span>
          <span class="watermark-sep">•</span>
          <a href="https://github.com/EhsanShahbazii" target="_blank" rel="noreferrer" class="watermark-url">github.com/EhsanShahbazii</a>
        </div>
      </section>
    `;
  }

  // Render Articles
  postsToRender.forEach((post) => {
    const totalPostComments = countAllComments(post.comments);

    html += `
      <article class="article-item" id="post-${post.hash}">
        <header class="article-header">
          <h2 class="article-title">${escapeHtml(post.title)}</h2>

          <div class="article-meta">
            <span>
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${formatPersianDate(post.publishedAt)}
            </span>
            <span>
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${toPersianDigits(post.readingTime || 1)} دقیقه مطالعه
            </span>
            <span>
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              ${toPersianDigits(post.likesCount || 0)} پسند
            </span>
            <span>
              <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${toPersianDigits(totalPostComments || post.commentsCount || 0)} نظر و پاسخ
            </span>
          </div>

          ${(post.tags && post.tags.length > 0) ? `
            <div class="article-tags">
              ${post.tags.map((t) => `<span class="tag-badge"># ${escapeHtml(t.name)}</span>`).join('')}
            </div>
          ` : ''}
        </header>

        ${(showImages && post.image) ? `
          <img class="article-cover" src="${post.image}" alt="${escapeHtml(post.title)}" />
        ` : ''}

        ${(post.sound && post.sound.url) ? `
          <div class="audio-card">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            <span>این مقاله دارای نسخه صوتی در ویرگول است:</span>
            <a href="${post.sound.url}" target="_blank" rel="noreferrer">شنیدن فایل صوتی</a>
          </div>
        ` : ''}

        <div class="article-body">
          ${post.content?.bodyHtml || `<p class="post-p">${escapeHtml(post.description || '')}</p>`}
        </div>

        ${(showComments && post.comments && post.comments.length > 0) ? `
          <section class="comments-section">
            <h3 class="comments-header">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>نظرات و پاسخ‌ها (${toPersianDigits(totalPostComments)})</span>
            </h3>

            ${post.comments.map((c) => renderCommentCardRecursive(c, 0)).join('')}
          </section>
        ` : ''}

        <footer class="article-watermark">
          <span>ویرگول بک‌آپ • توسعه‌داده‌شده با</span>
          <svg class="icon-heart" viewBox="0 0 24 24" fill="#d7373f" stroke="#d7373f" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>توسط <a href="https://github.com/EhsanShahbazii" target="_blank" rel="noreferrer">احسان شهبازی</a></span>
        </footer>
      </article>
    `;
  });

  container.innerHTML = html;

  if (!showImages) {
    container.querySelectorAll('.post-figure, .article-cover').forEach((el) => {
      el.style.display = 'none';
    });
  }
}

/**
 * Recursively render a comment and all its nested sub-replies
 */
function renderCommentCardRecursive(comment, depth = 0) {
  const isReply = depth > 0;
  const cardClass = isReply ? 'nested-reply-item' : 'comment-card';

  const avatar = comment.user?.avatar || '../assets/icons/icon-48.png';
  const authorName = comment.user?.name || 'کاربر ویرگول';
  const username = comment.user?.username || '';
  const dateFormatted = formatPersianDate(comment.publishedAt, true);

  let html = `
    <div class="${cardClass}" id="comment-${comment.hash}">
      <div class="comment-top">
        <div class="comment-author">
          <img class="comment-avatar" src="${avatar}" alt="" loading="lazy" />
          <div>
            <div class="comment-author-name">${escapeHtml(authorName)}</div>
            ${username ? `<div class="comment-author-user">@${escapeHtml(username)}</div>` : ''}
          </div>
        </div>
        <span class="comment-date">${dateFormatted}</span>
      </div>

      <div class="comment-body">${escapeHtml(comment.body)}</div>
  `;

  // Render nested replies recursively
  if (comment.repliesList && comment.repliesList.length > 0) {
    html += '<div class="nested-replies-container">';
    comment.repliesList.forEach((reply) => {
      html += renderCommentCardRecursive(reply, depth + 1);
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
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

init();
