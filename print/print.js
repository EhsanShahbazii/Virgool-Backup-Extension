/**
 * Print & PDF Controller
 * Renders backed-up posts into an authentic Virgool-styled printable document with automatic print support.
 */

import { getBackupById, getLatestBackup } from '../lib/storage.js';
import { countAllComments } from '../lib/virgool-api.js';
import { formatPersianDate, toPersianDigits } from '../lib/date-utils.js';
import { exportBackupToHtml, exportSinglePostHtml } from '../lib/exporters/html-exporter.js';

const DEFAULT_AVATAR_URL = 'https://static.virgool.io/images/app/avatar-default.jpg?x-img=v1/format,type_webp/resize,w_32,h_32/optimize,q_75';

let currentBackup = null;

function sanitizeBodyHtml(html) {
  if (!html) return '';
  return html
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '');
}

async function init() {
  // Remove any stale or unwanted preload links
  document.querySelectorAll('link[rel="preload"]').forEach((el) => el.remove());
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
  const btnPrint = document.getElementById('btnPrint');
  const printDoc = async () => {
    const originalBtnHtml = btnPrint.innerHTML;
    btnPrint.disabled = true;
    btnPrint.classList.add('loading');
    btnPrint.innerHTML = `
      <svg class="icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
      <span>در حال آماده‌سازی تصاویر...</span>
    `;

    try {
      await ensureImagesLoaded(container, (curr, total) => {
        const span = btnPrint.querySelector('span');
        if (span) {
          span.textContent = `آماده‌سازی تصاویر (${toPersianDigits(curr)}/${toPersianDigits(total)})...`;
        }
      });
    } catch (err) {
      console.warn('Preload warning:', err);
    } finally {
      btnPrint.disabled = false;
      btnPrint.classList.remove('loading');
      btnPrint.innerHTML = originalBtnHtml;
    }

    // Allow a layout frame for the browser to render decoded bitmaps
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150)));
    window.print();
  };

  btnPrint.addEventListener('click', printDoc);

  const btnExportHtml = document.getElementById('btnExportHtml');
  if (btnExportHtml) {
    btnExportHtml.addEventListener('click', () => {
      if (!currentBackup) return;
      const selectedFilter = select.value;
      if (selectedFilter === 'all') {
        exportBackupToHtml(currentBackup);
      } else {
        const post = currentBackup.posts?.find((p, idx) => (p.hash === selectedFilter || String(idx) === selectedFilter));
        if (post) {
          exportSinglePostHtml(post, currentBackup.user);
        } else {
          exportBackupToHtml(currentBackup);
        }
      }
    });
  }

  document.getElementById('btnClose').addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = `../manager/manager.html?id=${encodeURIComponent(currentBackup?.id || '')}`;
    }
  });

  const refreshAndPreload = () => {
    renderDocument();
    ensureImagesLoaded(container);
  };

  select.addEventListener('change', refreshAndPreload);
  document.getElementById('toggleComments').addEventListener('change', refreshAndPreload);
  document.getElementById('toggleImages').addEventListener('change', refreshAndPreload);

  renderDocument();

  // If autoprint is requested, wait for all images and fonts to finish loading and decoding
  if (shouldAutoPrint) {
    const badge = document.getElementById('postCountBadge');
    const originalBadgeText = badge ? badge.textContent : '';
    if (badge) badge.textContent = 'در حال بارگذاری تصاویر...';

    await ensureImagesLoaded(container);

    if (badge) badge.textContent = originalBadgeText;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 200)));
    window.print();
  } else {
    // Eagerly preload and decode images in background so they are ready instantly
    ensureImagesLoaded(container);
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
        <img class="cover-avatar" src="${user.avatar || DEFAULT_AVATAR_URL}" alt="${escapeHtml(user.name || user.username || 'کاربر')}" onerror="this.src='${DEFAULT_AVATAR_URL}'" />
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
  let articlesHtml = '';
  postsToRender.forEach((post) => {
    const totalPostComments = countAllComments(post.comments);

    articlesHtml += `
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
          <img class="article-cover" src="${post.image}" alt="${escapeHtml(post.title)}" loading="eager" decoding="async" />
        ` : ''}

        ${(post.sound && post.sound.url) ? `
          <div class="audio-card">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            <span>این مقاله دارای نسخه صوتی در ویرگول است:</span>
            <a href="${post.sound.url}" target="_blank" rel="noreferrer">شنیدن فایل صوتی</a>
          </div>
        ` : ''}

        <div class="article-body">
          ${sanitizeBodyHtml(post.content?.bodyHtml) || `<p class="post-p">${escapeHtml(post.description || '')}</p>`}
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

  if (articlesHtml) {
    html += `
      <table class="print-layout-table">
        <thead><tr><td class="print-page-top-spacer"></td></tr></thead>
        <tbody>
          <tr>
            <td>
              <div class="print-article-wrapper">
                ${articlesHtml}
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot><tr><td class="print-page-bottom-spacer"></td></tr></tfoot>
      </table>
    `;
  }

  container.innerHTML = html;

  // Set descriptive document title for PDF saving
  const versionTag = currentBackup.versionLabel || (currentBackup.version && currentBackup.version > 1 ? `v${currentBackup.version}` : null);
  const userDisplayName = versionTag 
    ? `${user.name || user.username || 'کاربر ویرگول'} (${versionTag})`
    : (user.name || user.username || 'کاربر ویرگول');

  if (selectedPostVal === 'all') {
    document.title = `کتابچه ویرگول — ${userDisplayName}`;
  } else if (postsToRender.length === 1) {
    document.title = `${postsToRender[0].title} — ${userDisplayName}`;
  } else {
    document.title = `مجموعه مقالات ویرگول — ${userDisplayName}`;
  }

  // Force all images in the document (including bodyHtml and avatars) to eager loading
  container.querySelectorAll('img').forEach((img) => {
    img.removeAttribute('loading');
    img.setAttribute('loading', 'eager');
    img.setAttribute('decoding', 'async');
  });

  if (!showImages) {
    container.querySelectorAll('.post-figure, .article-cover').forEach((el) => {
      el.style.display = 'none';
    });
  }
}

/**
 * Preload and decode all images & fonts inside a container so user does not need to scroll down
 */
async function ensureImagesLoaded(container, onProgress) {
  if (!container) return;

  const images = Array.from(container.querySelectorAll('img')).filter((img) => {
    return img.style.display !== 'none' && (!img.parentElement || img.parentElement.style.display !== 'none');
  });

  images.forEach((img) => {
    img.removeAttribute('loading');
    img.setAttribute('loading', 'eager');
    if (!img.src && img.dataset && img.dataset.src) {
      img.src = img.dataset.src;
    }
  });

  if (images.length === 0) {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    return;
  }

  let completedCount = 0;
  const updateProgress = () => {
    completedCount++;
    if (onProgress) {
      onProgress(completedCount, images.length);
    }
  };

  const imagePromises = images.map((img) => {
    return new Promise((resolve) => {
      // If already complete with dimensions
      if (img.complete && img.naturalWidth > 0) {
        if (typeof img.decode === 'function') {
          img.decode().then(resolve).catch(resolve);
        } else {
          resolve();
        }
        updateProgress();
        return;
      }

      let timer = null;
      const finish = () => {
        if (timer) clearTimeout(timer);
        img.removeEventListener('load', finish);
        img.removeEventListener('error', finish);
        if (typeof img.decode === 'function' && img.naturalWidth > 0) {
          img.decode().then(resolve).catch(resolve);
        } else {
          resolve();
        }
        updateProgress();
      };

      // Safeguard: 5-second max timeout per image so dead links never block printing
      timer = setTimeout(finish, 5000);
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', () => {
        img.style.display = 'none';
        finish();
      }, { once: true });
    });
  });

  const fontsPromise = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

  await Promise.allSettled([...imagePromises, fontsPromise]);
}

/**
 * Recursively render a comment and all its nested sub-replies
 */
function renderCommentCardRecursive(comment, depth = 0) {
  const isReply = depth > 0;
  const cardClass = isReply ? 'nested-reply-item' : 'comment-card';

  const avatar = comment.user?.avatar || DEFAULT_AVATAR_URL;
  const authorName = comment.user?.name || 'کاربر ویرگول';
  const username = comment.user?.username || '';
  const dateFormatted = formatPersianDate(comment.publishedAt, true);

  let html = `
    <div class="${cardClass}" id="comment-${comment.hash}">
      <div class="comment-top">
        <div class="comment-author">
          <img class="comment-avatar" src="${avatar}" alt="" loading="eager" decoding="async" onerror="this.src='${DEFAULT_AVATAR_URL}'" />
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

// Suppress any header title printing across all browsers
let cachedDocumentTitle = document.title;
window.addEventListener('beforeprint', () => {
  cachedDocumentTitle = document.title;
  document.title = ' ';
});

window.addEventListener('afterprint', () => {
  document.title = cachedDocumentTitle;
});

init();
