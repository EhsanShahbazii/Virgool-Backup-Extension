/**
 * Backup Manager Controller
 * Manages backup history, responsive pagination, search, inspection, and automatic print export.
 */

import { getAllBackups, getBackupById, deleteBackup, saveBackup, clearAllData } from '../lib/storage.js';
import { backupUser, countAllComments, SPEED_PRESETS } from '../lib/virgool-api.js';
import { exportBackupToJson } from '../lib/exporters/json-exporter.js';
import { exportSinglePostMarkdown } from '../lib/exporters/markdown-exporter.js';
import { exportBackupToHtml, exportSinglePostHtml } from '../lib/exporters/html-exporter.js';
import { formatPersianDate, toPersianDigits, formatDuration, formatTimer } from '../lib/date-utils.js';

const DEFAULT_AVATAR_URL = 'https://static.virgool.io/images/app/avatar-default.jpg?x-img=v1/format,type_webp/resize,w_32,h_32/optimize,q_75';

let allBackups = [];
let activeBackup = null;

// Pagination state
let currentPage = 1;
let pageSize = 8;
let filteredPosts = [];

// Multi-select state
let selectedPostHashes = new Set();

// Modal backup state
let modalAbortController = null;
let modalTimerInterval = null;

async function init() {
  try {
    if (typeof window !== 'undefined') {
      window.clearAllData = clearAllData;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const targetBackupId = urlParams.get('id');
    const isSuccessRedirect = urlParams.get('success') === '1';

    await loadBackups(targetBackupId);

    if (isSuccessRedirect && activeBackup) {
      showDashboardSuccessBanner(activeBackup);
    }

    const btnCloseBanner = document.getElementById('btnCloseSuccessBanner');
    if (btnCloseBanner) {
      btnCloseBanner.addEventListener('click', () => {
        const banner = document.getElementById('dashboardSuccessBanner');
        if (banner) banner.style.display = 'none';
      });
    }

    const btnClearAll = document.getElementById('btnClearAllData');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', async () => {
        const ok = await confirmDelete('تمام داده‌ها، نسخه‌های پشتیبان و کش محلی');
        if (ok) {
          await clearAllData();
          activeBackup = null;
          await loadBackups();
        }
      });
    }

    document.getElementById('btnRefresh').addEventListener('click', () => loadBackups());

    // Controls
    const searchInput = document.getElementById('postSearchInput');
    searchInput.addEventListener('input', handleSearch);

    // Page size selector
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    pageSizeSelect.value = String(pageSize);
    pageSizeSelect.addEventListener('change', (e) => {
      pageSize = parseInt(e.target.value, 10) || 8;
      currentPage = 1;
      renderCurrentPage();
    });

    document.getElementById('btnExportAllPdf').addEventListener('click', () => {
      if (!activeBackup) return;
      window.open(`../print/print.html?id=${activeBackup.id}&autoprint=true`, '_blank');
    });

    document.getElementById('btnExportAllHtml').addEventListener('click', () => {
      if (!activeBackup) return;
      exportBackupToHtml(activeBackup);
    });

    document.getElementById('btnExportAllJson').addEventListener('click', () => {
      if (!activeBackup) return;
      exportBackupToJson(activeBackup);
    });

    // Multi-select action listeners
    setupSelectionEvents();

    document.getElementById('btnDeleteBackup').addEventListener('click', async () => {
      if (!activeBackup) return;
      const versionTag = activeBackup.versionLabel || (activeBackup.version && activeBackup.version > 1 ? `v${activeBackup.version}` : null);
      const baseName = activeBackup.user?.name || activeBackup.user?.username || 'کاربر';
      const displayName = versionTag ? `${baseName} (${versionTag})` : baseName;
      const ok = await confirmDelete(displayName);
      if (ok) {
        await deleteBackup(activeBackup.id);
        activeBackup = null;
        await loadBackups();
      }
    });

    // Wire Modal Events
    setupModalEvents();
  } catch (err) {
    console.error('Manager initialization error:', err);
  }
}

async function loadBackups(preferredId = null) {
  allBackups = await getAllBackups();
  document.getElementById('backupCountBadge').textContent = `${toPersianDigits(allBackups.length)} مورد`;

  const listEl = document.getElementById('backupList');
  if (allBackups.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 30px 10px; color: var(--color-gray-600); font-size: 13px;">
        هنوز هیچ پشتیبانی ذخیره نشده است.
      </div>
    `;
    document.getElementById('noBackupState').style.display = 'block';
    document.getElementById('activeBackupContent').style.display = 'none';
    return;
  }

  // Build map of chronological backups per username to compute v1, v2, v3...
  const userBackupsMap = {};
  const chronological = [...allBackups].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  chronological.forEach((b) => {
    const u = (b.user?.username || '').toLowerCase();
    if (!userBackupsMap[u]) userBackupsMap[u] = [];
    userBackupsMap[u].push(b.id);
  });

  const getVersionTag = (b) => {
    if (b.versionLabel) return b.versionLabel;
    if (typeof b.version === 'number' && b.version > 1) return `v${b.version}`;
    const u = (b.user?.username || '').toLowerCase();
    const list = userBackupsMap[u] || [];
    if (list.length > 1) {
      const idx = list.indexOf(b.id);
      return idx >= 0 ? `v${idx + 1}` : null;
    }
    return null;
  };

  listEl.innerHTML = '';
  allBackups.forEach((b) => {
    const item = document.createElement('div');
    item.className = `backup-item ${activeBackup?.id === b.id ? 'active' : ''}`;

    const baseName = b.user?.name || b.user?.username || 'کاربر';
    const versionTag = getVersionTag(b);
    const displayName = versionTag ? `${baseName} (${versionTag})` : baseName;

    item.innerHTML = `
      <div class="backup-item-header">
        <div class="backup-item-title">
          <span>${escapeHtml(baseName)}</span>
          ${versionTag ? `<span class="version-badge">${escapeHtml(versionTag)}</span>` : ''}
        </div>
        <button class="backup-delete-btn" title="حذف این نسخه پشتیبان">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <div class="backup-item-meta">
        <span>${toPersianDigits(b.posts?.length || 0)} مقاله</span>
        <span>•</span>
        <span>${formatPersianDate(b.createdAt)}</span>
        ${b.stats?.durationMs ? `<span>• ${formatDuration(b.stats.durationMs)}</span>` : ''}
      </div>
    `;

    // Click to select
    item.addEventListener('click', () => selectBackup(b.id));

    // Delete button click
    const deleteBtn = item.querySelector('.backup-delete-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmDelete(displayName);
      if (ok) {
        await deleteBackup(b.id);
        if (activeBackup?.id === b.id) {
          activeBackup = null;
        }
        await loadBackups();
      }
    });

    listEl.appendChild(item);
  });

  if (preferredId && allBackups.some((b) => b.id === preferredId)) {
    await selectBackup(preferredId);
  } else if (activeBackup && allBackups.some((b) => b.id === activeBackup.id)) {
    await selectBackup(activeBackup.id);
  } else if (allBackups.length > 0) {
    await selectBackup(allBackups[0].id);
  } else {
    activeBackup = null;
    document.getElementById('noBackupState').style.display = 'block';
    document.getElementById('activeBackupContent').style.display = 'none';
  }
}

async function selectBackup(id) {
  activeBackup = await getBackupById(id);
  if (!activeBackup) return;

  // Highlight active in sidebar
  document.querySelectorAll('.backup-item').forEach((el, idx) => {
    el.classList.toggle('active', allBackups[idx]?.id === id);
  });

  document.getElementById('noBackupState').style.display = 'none';
  document.getElementById('activeBackupContent').style.display = 'block';

  // Populate profile info with version tag if duplicate
  const user = activeBackup.user || {};
  const versionTag = activeBackup.versionLabel || (activeBackup.version && activeBackup.version > 1 ? `v${activeBackup.version}` : null);
  const displayName = versionTag 
    ? `${user.name || user.username || 'کاربر ویرگول'} (${versionTag})` 
    : (user.name || user.username || 'کاربر ویرگول');

  const avatarEl = document.getElementById('userAvatar');
  avatarEl.src = user.avatar || DEFAULT_AVATAR_URL;
  avatarEl.onerror = () => {
    avatarEl.src = DEFAULT_AVATAR_URL;
  };
  document.getElementById('userName').textContent = displayName;
  document.getElementById('userHandle').textContent = `@${user.username || ''}`;
  document.getElementById('userBio').textContent = user.bio || '';

  const totalComments = (activeBackup.posts || []).reduce(
    (acc, p) => acc + countAllComments(p.comments),
    0
  );

  document.getElementById('statPostsCount').textContent = toPersianDigits(activeBackup.posts?.length || 0);
  document.getElementById('statCommentsCount').textContent = toPersianDigits(totalComments || activeBackup.stats?.totalComments || 0);
  document.getElementById('statFollowers').textContent = toPersianDigits(user.followersCount || 0);

  const durationEl = document.getElementById('statDuration');
  if (durationEl) {
    durationEl.textContent = activeBackup.stats?.durationMs ? formatDuration(activeBackup.stats.durationMs) : 'نامشخص';
  }

  // Initialize filtered list and reset to page 1
  filteredPosts = activeBackup.posts || [];
  selectedPostHashes.clear();
  updateSelectionUI();
  currentPage = 1;
  renderCurrentPage();
}

function renderCurrentPage() {
  const grid = document.getElementById('postsGrid');
  const paginationContainer = document.getElementById('paginationContainer');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationButtons = document.getElementById('paginationButtons');

  grid.innerHTML = '';

  const total = filteredPosts.length;
  if (total === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--color-gray-600);">
        هیچ مقاله‌ای مطابق با فیلتر جستجو یافت نشد.
      </div>
    `;
    paginationContainer.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(total / pageSize);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const postsToShow = filteredPosts.slice(startIndex, endIndex);

  // Update pagination info
  paginationInfo.textContent = `نمایش ${toPersianDigits(startIndex + 1)} تا ${toPersianDigits(endIndex)} از مجموع ${toPersianDigits(total)} مقاله`;
  paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';

  // Render pagination buttons
  paginationButtons.innerHTML = '';

  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.disabled = currentPage === 1;
  prevBtn.innerHTML = `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  prevBtn.title = 'صفحه قبلی';
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderCurrentPage();
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  paginationButtons.appendChild(prevBtn);

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    // Show first, last, and pages around current
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
      pageBtn.textContent = toPersianDigits(i);
      pageBtn.addEventListener('click', () => {
        currentPage = i;
        renderCurrentPage();
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      paginationButtons.appendChild(pageBtn);
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.padding = '0 4px';
      dots.style.color = 'var(--color-gray-500)';
      paginationButtons.appendChild(dots);
    }
  }

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.innerHTML = `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  nextBtn.title = 'صفحه بعدی';
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderCurrentPage();
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  paginationButtons.appendChild(nextBtn);

  // Render Post Cards
  postsToShow.forEach((post) => {
    const isSelected = selectedPostHashes.has(post.hash);
    const card = document.createElement('div');
    card.className = `post-card ${isSelected ? 'selected' : ''}`;
    card.dataset.hash = post.hash;

    const commentsCount = countAllComments(post.comments) || post.commentsCount || 0;

    const tagsHtml = (post.tags && post.tags.length > 0)
      ? `<div class="post-card-tags">${post.tags.slice(0, 3).map((t) => `<span class="card-tag"># ${escapeHtml(t.name)}</span>`).join('')}</div>`
      : '';

    card.innerHTML = `
      <div class="post-card-select-wrap" title="انتخاب / لغو انتخاب برای خروجی دسته‌جمعی">
        <input type="checkbox" class="post-card-checkbox post-select-input" ${isSelected ? 'checked' : ''}>
        <span class="post-card-select-label">${isSelected ? 'انتخاب شد' : 'انتخاب'}</span>
      </div>

      ${post.image ? `<img class="post-card-cover" src="${post.image}" alt="${escapeHtml(post.title)}" loading="lazy">` : ''}
      <div class="post-card-body">
        <h3 class="post-card-title">${escapeHtml(post.title)}</h3>
        <p class="post-card-desc">${escapeHtml(post.description || post.content?.plainText || '')}</p>

        ${tagsHtml}

        <div class="post-card-meta">
          <span class="meta-item">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${formatPersianDate(post.publishedAt)}
          </span>
          <span class="meta-item">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            ${toPersianDigits(post.likesCount || 0)}
          </span>
          <span class="meta-item">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${toPersianDigits(commentsCount)}
          </span>
        </div>

        <div class="post-card-actions">
          <button class="btn btn-sm btn-primary btn-print-post" title="چاپ و باز کردن خودکار تنظیمات پرینت">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>چاپ / PDF</span>
          </button>
          <button class="btn btn-sm btn-secondary btn-md-post" title="خروجی فایل Markdown">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span>Markdown</span>
          </button>
          <a href="${post.url}" target="_blank" rel="noreferrer" class="btn btn-sm btn-secondary btn-virgool-link" title="مشاهده در ویرگول">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>ویرگول</span>
          </a>
        </div>
      </div>
    `;

    // Selection toggle logic on the checkbox wrap
    const selectWrap = card.querySelector('.post-card-select-wrap');
    const selectCheckbox = card.querySelector('.post-select-input');
    const selectLabel = card.querySelector('.post-card-select-label');

    selectWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target !== selectCheckbox) {
        selectCheckbox.checked = !selectCheckbox.checked;
      }
      if (selectCheckbox.checked) {
        selectedPostHashes.add(post.hash);
        card.classList.add('selected');
        selectLabel.textContent = 'انتخاب شد';
      } else {
        selectedPostHashes.delete(post.hash);
        card.classList.remove('selected');
        selectLabel.textContent = 'انتخاب';
      }
      updateSelectionUI();
    });

    // Click on card body opens post in view in the same tab
    card.addEventListener('click', (e) => {
      // Don't trigger if clicked on child buttons/links or select wrap
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.post-card-select-wrap')) return;
      window.location.href = `../print/print.html?id=${encodeURIComponent(activeBackup.id)}&post=${encodeURIComponent(post.hash)}&autoprint=false`;
    });

    // Click on Print / PDF button opens post and automatically triggers print dialog
    card.querySelector('.btn-print-post').addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(`../print/print.html?id=${activeBackup.id}&post=${post.hash}&autoprint=true`, '_blank');
    });

    card.querySelector('.btn-md-post').addEventListener('click', (e) => {
      e.stopPropagation();
      exportSinglePostMarkdown(post, activeBackup.user);
    });

    card.querySelector('.btn-virgool-link').addEventListener('click', (e) => {
      e.stopPropagation();
    });

    grid.appendChild(card);
  });

  updateSelectionUI();
}

function handleSearch(e) {
  if (!activeBackup) return;
  const q = e.target.value.toLowerCase().trim();
  const allPosts = activeBackup.posts || [];

  if (!q) {
    filteredPosts = allPosts;
  } else {
    filteredPosts = allPosts.filter((p) => {
      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      const bodyMatch = (p.content?.plainText || '').toLowerCase().includes(q);
      const tagMatch = (p.tags || []).some((t) => (t.name || '').toLowerCase().includes(q));
      return titleMatch || descMatch || bodyMatch || tagMatch;
    });
  }

  currentPage = 1;
  renderCurrentPage();
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

function setupModalEvents() {
  const modal = document.getElementById('newBackupModal');
  const btnOpen = document.getElementById('btnOpenNewBackupModal');
  const btnClose = document.getElementById('btnCloseModal');
  const btnStart = document.getElementById('modalBtnStart');
  const btnCancel = document.getElementById('modalBtnCancel');
  const usernameInput = document.getElementById('modalUsernameInput');
  const errorAlert = document.getElementById('modalErrorAlert');
  const inputState = document.getElementById('modalInputState');
  const progressState = document.getElementById('modalProgressState');
  const resultState = document.getElementById('modalResultState');
  const btnModalDownloadJson = document.getElementById('modalBtnDownloadJson');
  const btnModalViewPdf = document.getElementById('modalBtnViewPdf');
  const btnModalFinishView = document.getElementById('modalBtnFinishView');

  const openModal = () => {
    modal.style.display = 'flex';
    inputState.style.display = 'block';
    progressState.style.display = 'none';
    if (resultState) resultState.style.display = 'none';
    errorAlert.style.display = 'none';
    usernameInput.value = '';
    setTimeout(() => usernameInput.focus(), 50);
  };

  const closeModal = () => {
    if (modalAbortController) {
      const wantCancel = confirm('فرآیند پشتیبان‌گیری در حال اجرا است. آیا مایل به لغو آن هستید؟');
      if (!wantCancel) return;
      modalAbortController.abort();
      modalAbortController = null;
    }
    modal.style.display = 'none';
    if (resultState) resultState.style.display = 'none';
  };

  btnOpen.addEventListener('click', openModal);
  btnClose.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      startModalBackup();
    }
  });

  if (btnModalDownloadJson) {
    btnModalDownloadJson.addEventListener('click', () => {
      if (activeBackup) exportBackupToJson(activeBackup);
    });
  }

  if (btnModalViewPdf) {
    btnModalViewPdf.addEventListener('click', () => {
      if (activeBackup) {
        window.open(`../print/print.html?id=${encodeURIComponent(activeBackup.id)}&autoprint=true`, '_blank');
      }
    });
  }

  if (btnModalFinishView) {
    btnModalFinishView.addEventListener('click', () => {
      closeModal();
    });
  }

  // Virgool Speed & Worker Range Slider setup
  const speedRange = document.getElementById('modalSpeedRange');
  const speedBadge = document.getElementById('modalSpeedRiskBadge');
  const speedBadgeText = document.getElementById('modalSpeedBadgeText');
  const speedWorkerVal = document.getElementById('modalSpeedWorkerVal');
  const speedDelayVal = document.getElementById('modalSpeedDelayVal');

  const updateModalSpeedUI = (val) => {
    const config = SPEED_PRESETS[val] || SPEED_PRESETS[1];
    if (speedBadge) {
      speedBadge.className = `speed-badge risk-${config.risk}`;
    }
    if (speedBadgeText) {
      speedBadgeText.textContent = config.label;
    }
    if (speedWorkerVal) {
      speedWorkerVal.textContent = config.threadText;
    }
    if (speedDelayVal) {
      speedDelayVal.textContent = config.delayText;
    }
  };

  if (speedRange) {
    const savedPreset = localStorage.getItem('virgool_backup_speed_preset') || '1';
    speedRange.value = savedPreset;
    updateModalSpeedUI(savedPreset);

    speedRange.addEventListener('input', (e) => {
      const val = e.target.value;
      updateModalSpeedUI(val);
      try {
        localStorage.setItem('virgool_backup_speed_preset', val);
      } catch (err) {}
    });
  }

  btnStart.addEventListener('click', startModalBackup);
  btnCancel.addEventListener('click', cancelModalBackup);
}

async function startModalBackup() {
  const usernameInput = document.getElementById('modalUsernameInput');
  const errorAlert = document.getElementById('modalErrorAlert');
  const inputState = document.getElementById('modalInputState');
  const progressState = document.getElementById('modalProgressState');
  const phaseEl = document.getElementById('modalProgressPhase');
  const percentEl = document.getElementById('modalProgressPercent');
  const fillEl = document.getElementById('modalProgressBarFill');
  const msgEl = document.getElementById('modalProgressMsg');

  const rawUsername = usernameInput.value.trim().replace(/^@/, '');
  if (!rawUsername) {
    errorAlert.textContent = 'لطفاً نام کاربری نویسنده را وارد کنید.';
    errorAlert.style.display = 'block';
    return;
  }

  errorAlert.style.display = 'none';
  inputState.style.display = 'none';
  progressState.style.display = 'block';

  phaseEl.textContent = 'در حال پردازش...';
  percentEl.textContent = '۰٪';
  fillEl.style.width = '0%';
  msgEl.textContent = 'در حال ارتباط با ویرگول...';

  modalAbortController = new AbortController();

  const speedRange = document.getElementById('modalSpeedRange');
  const presetKey = speedRange ? speedRange.value : '1';
  const speedConfig = SPEED_PRESETS[presetKey] || SPEED_PRESETS[1];

  // Initialize live timer and worker count in modal progress
  const timerEl = document.getElementById('modalProgressTimer');
  const workerInfoEl = document.getElementById('modalProgressWorkersInfo');
  if (timerEl) timerEl.textContent = '۰۰:۰۰';
  if (workerInfoEl) workerInfoEl.textContent = speedConfig.label;

  const startTimestamp = Date.now();
  if (modalTimerInterval) clearInterval(modalTimerInterval);
  modalTimerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - startTimestamp) / 1000);
    const liveTimer = document.getElementById('modalProgressTimer');
    if (liveTimer) liveTimer.textContent = formatTimer(elapsedSec);
  }, 1000);

  try {
    const backupPackage = await backupUser(rawUsername, {
      signal: modalAbortController.signal,
      workers: speedConfig.workers,
      delayMs: speedConfig.delayMs,
      onProgress: ({ phase, percent, message }) => {
        phaseEl.textContent = phase;
        percentEl.textContent = `${toPersianDigits(percent)}٪`;
        fillEl.style.width = `${percent}%`;
        msgEl.textContent = message;
      },
    });

    await saveBackup(backupPackage);
    await loadBackups(backupPackage.id);
    await selectBackup(backupPackage.id);

    // Transition modal to result state
    progressState.style.display = 'none';
    const resultState = document.getElementById('modalResultState');
    if (resultState) {
      resultState.style.display = 'block';
      document.getElementById('modalResPostsCount').textContent = toPersianDigits(backupPackage.posts.length);
      document.getElementById('modalResCommentsCount').textContent = toPersianDigits(backupPackage.stats.totalComments);
      document.getElementById('modalResTotalDuration').textContent = formatDuration(backupPackage.stats.durationMs);
      document.getElementById('modalResWorkersUsed').textContent = `${toPersianDigits(backupPackage.stats.workersUsed || speedConfig.workers || 1)} ترد`;
      document.getElementById('modalResTimestampVal').textContent = formatPersianDate(backupPackage.createdAt, true);
    }
  } catch (err) {
    console.error('Manager modal backup error:', err);
    progressState.style.display = 'none';
    inputState.style.display = 'block';
    errorAlert.textContent = err.message || 'خطایی در فرآیند پشتیبان‌گیری رخ داد.';
    errorAlert.style.display = 'block';
  } finally {
    if (modalTimerInterval) {
      clearInterval(modalTimerInterval);
      modalTimerInterval = null;
    }
    modalAbortController = null;
  }
}

function cancelModalBackup() {
  if (modalTimerInterval) {
    clearInterval(modalTimerInterval);
    modalTimerInterval = null;
  }
  if (modalAbortController) {
    modalAbortController.abort();
    modalAbortController = null;
  }
  const inputState = document.getElementById('modalInputState');
  const progressState = document.getElementById('modalProgressState');
  const resultState = document.getElementById('modalResultState');
  const errorAlert = document.getElementById('modalErrorAlert');

  progressState.style.display = 'none';
  if (resultState) resultState.style.display = 'none';
  inputState.style.display = 'block';
  errorAlert.textContent = 'عملیات پشتیبان‌گیری توسط کاربر لغو شد.';
  errorAlert.style.display = 'block';
}

function showDashboardSuccessBanner(backup) {
  const banner = document.getElementById('dashboardSuccessBanner');
  if (!banner || !backup) return;

  const totalComments = (backup.posts || []).reduce(
    (acc, p) => acc + countAllComments(p.comments),
    0
  );

  document.getElementById('bannerResPostsCount').textContent = toPersianDigits(backup.posts?.length || 0);
  document.getElementById('bannerResCommentsCount').textContent = toPersianDigits(totalComments || backup.stats?.totalComments || 0);
  document.getElementById('bannerResTotalDuration').textContent = backup.stats?.durationMs ? formatDuration(backup.stats.durationMs) : '۰ ثانیه';
  document.getElementById('bannerResWorkersUsed').textContent = `${toPersianDigits(backup.stats?.workersUsed || 1)} ترد`;
  document.getElementById('bannerResTimestampVal').textContent = formatPersianDate(backup.createdAt, true);

  banner.style.display = 'block';
}

function setupSelectionEvents() {
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const btnClearSelection = document.getElementById('btnClearSelection');
  const btnExportSelectedPdf = document.getElementById('btnExportSelectedPdf');
  const btnExportSelectedHtml = document.getElementById('btnExportSelectedHtml');
  const btnExportSelectedJson = document.getElementById('btnExportSelectedJson');

  selectAllCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      filteredPosts.forEach((p) => selectedPostHashes.add(p.hash));
    } else {
      selectedPostHashes.clear();
    }
    updateSelectionUI();
    renderCurrentPage();
  });

  btnClearSelection.addEventListener('click', () => {
    selectedPostHashes.clear();
    updateSelectionUI();
    renderCurrentPage();
  });

  btnExportSelectedPdf.addEventListener('click', () => {
    if (!activeBackup || selectedPostHashes.size === 0) return;
    const hashList = Array.from(selectedPostHashes).join(',');
    window.open(`../print/print.html?id=${activeBackup.id}&posts=${hashList}&autoprint=false`, '_blank');
  });

  btnExportSelectedHtml.addEventListener('click', () => {
    if (!activeBackup || selectedPostHashes.size === 0) return;
    const selectedPosts = (activeBackup.posts || []).filter((p) => selectedPostHashes.has(p.hash));
    const totalComments = selectedPosts.reduce((acc, p) => acc + countAllComments(p.comments), 0);
    const vTag = activeBackup.versionLabel ? `-${activeBackup.versionLabel}` : '';

    const selectedBackupPackage = {
      ...activeBackup,
      id: `${activeBackup.id}_selected_${Date.now()}`,
      stats: {
        ...activeBackup.stats,
        totalPosts: selectedPosts.length,
        totalComments: totalComments,
      },
      posts: selectedPosts,
    };

    exportBackupToHtml(
      selectedBackupPackage,
      `virgool-${activeBackup.user?.username || 'backup'}${vTag}-selected-${selectedPosts.length}-posts-${new Date().toISOString().slice(0, 10)}.html`
    );
  });

  btnExportSelectedJson.addEventListener('click', () => {
    if (!activeBackup || selectedPostHashes.size === 0) return;
    const selectedPosts = (activeBackup.posts || []).filter((p) => selectedPostHashes.has(p.hash));
    const totalComments = selectedPosts.reduce((acc, p) => acc + countAllComments(p.comments), 0);
    const vTag = activeBackup.versionLabel ? `-${activeBackup.versionLabel}` : '';

    const selectedBackupPackage = {
      ...activeBackup,
      id: `${activeBackup.id}_selected_${Date.now()}`,
      stats: {
        ...activeBackup.stats,
        totalPosts: selectedPosts.length,
        totalComments: totalComments,
      },
      posts: selectedPosts,
    };

    exportBackupToJson(
      selectedBackupPackage,
      `virgool-${activeBackup.user?.username || 'backup'}${vTag}-selected-${selectedPosts.length}-posts-${new Date().toISOString().slice(0, 10)}.json`
    );
  });
}

function updateSelectionUI() {
  const count = selectedPostHashes.size;
  const countBadge = document.getElementById('selectionCountBadge');
  const btnPdf = document.getElementById('btnExportSelectedPdf');
  const btnPdfText = document.getElementById('btnExportSelectedPdfText');
  const btnHtml = document.getElementById('btnExportSelectedHtml');
  const btnHtmlText = document.getElementById('btnExportSelectedHtmlText');
  const btnJson = document.getElementById('btnExportSelectedJson');
  const btnJsonText = document.getElementById('btnExportSelectedJsonText');
  const btnClear = document.getElementById('btnClearSelection');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');

  if (!countBadge || !btnPdf || !btnHtml || !btnJson || !selectAllCheckbox) return;

  if (count > 0) {
    countBadge.textContent = `${toPersianDigits(count)} مقاله انتخاب شد`;
    btnPdf.disabled = false;
    btnPdfText.textContent = `چاپ / PDF انتخابی (${toPersianDigits(count)})`;
    btnHtml.disabled = false;
    btnHtmlText.textContent = `خروجی HTML انتخابی (${toPersianDigits(count)})`;
    btnJson.disabled = false;
    btnJsonText.textContent = `خروجی JSON انتخابی (${toPersianDigits(count)})`;
    btnClear.style.display = 'inline-flex';
  } else {
    countBadge.textContent = '۰ مورد انتخاب شد';
    btnPdf.disabled = true;
    btnPdfText.textContent = 'چاپ / PDF انتخابی';
    btnHtml.disabled = true;
    btnHtmlText.textContent = 'خروجی HTML انتخابی';
    btnJson.disabled = true;
    btnJsonText.textContent = 'خروجی JSON انتخابی';
    btnClear.style.display = 'none';
  }

  // Update select-all checkbox state
  if (filteredPosts.length > 0 && filteredPosts.every((p) => selectedPostHashes.has(p.hash))) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else if (filteredPosts.some((p) => selectedPostHashes.has(p.hash))) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }
}

/**
 * Opens a custom confirmation modal asking the user if they want to delete the given item
 * @param {string} itemName Name of the item to delete
 * @returns {Promise<boolean>} Resolves to true if user clicks yes, false if cancel
 */
function confirmDelete(itemName) {
  return new Promise((resolve) => {
    const modal = document.getElementById('deleteConfirmModal');
    const targetNameEl = document.getElementById('deleteModalTargetName');
    const btnConfirm = document.getElementById('btnConfirmDeleteModal');
    const btnCancel = document.getElementById('btnCancelDeleteModal');

    targetNameEl.textContent = itemName;
    modal.style.display = 'flex';

    const cleanup = (confirmed) => {
      modal.style.display = 'none';
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeyDown);
      resolve(confirmed);
    };

    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlayClick = (e) => {
      if (e.target === modal) cleanup(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };

    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);
    modal.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
  });
}

init();
