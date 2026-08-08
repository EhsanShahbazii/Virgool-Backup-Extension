/**
 * Popup Controller
 * Coordinates auto-detection of Virgool profiles, progress monitoring, and quick exports.
 */

import { backupUser, SPEED_PRESETS } from '../lib/virgool-api.js';
import { saveBackup, getAllBackups } from '../lib/storage.js';
import { exportBackupToJson } from '../lib/exporters/json-exporter.js';
import { formatPersianDate, toPersianDigits, formatDuration, formatTimer, formatRelativeTime } from '../lib/date-utils.js';

const DEFAULT_AVATAR_URL = 'https://static.virgool.io/images/app/avatar-default.jpg?x-img=v1/format,type_webp/resize,w_32,h_32/optimize,q_75';

let abortController = null;
let currentBackupResult = null;
let progressTimerInterval = null;

async function init() {
  setupUIEvents();
  setupSpeedControl();
  await checkActiveTabProfile();
  await loadTopRecentBackups();
}

function setupUIEvents() {
  const btnStart = document.getElementById('btnStartBackup');
  const btnCancel = document.getElementById('btnCancelBackup');
  const btnOpenDashboard = document.getElementById('btnOpenDashboard');
  const btnMoreBackups = document.getElementById('btnMoreBackups');

  btnStart.addEventListener('click', startBackupProcess);
  btnCancel.addEventListener('click', cancelBackupProcess);

  const openManager = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('manager/manager.html') });
  };

  btnOpenDashboard.addEventListener('click', openManager);
  if (btnMoreBackups) {
    btnMoreBackups.addEventListener('click', openManager);
  }

  // Allow pressing Enter in username field
  document.getElementById('usernameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      startBackupProcess();
    }
  });
}

function setupSpeedControl() {
  const speedRange = document.getElementById('speedRange');
  const speedBadge = document.getElementById('speedRiskBadge');
  const speedBadgeText = document.getElementById('speedBadgeText');
  const speedWorkerVal = document.getElementById('speedWorkerVal');
  const speedDelayVal = document.getElementById('speedDelayVal');

  if (!speedRange) return;

  const updateSpeedUI = (val) => {
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

  // Restore previous saved preset or default to 1 (safe)
  const savedPreset = localStorage.getItem('virgool_backup_speed_preset') || '1';
  speedRange.value = savedPreset;
  updateSpeedUI(savedPreset);

  speedRange.addEventListener('input', (e) => {
    const val = e.target.value;
    updateSpeedUI(val);
    try {
      localStorage.setItem('virgool_backup_speed_preset', val);
    } catch (err) {
      // localStorage may fail in some sandboxed environments
    }
  });
}

async function checkActiveTabProfile() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    // Check if current tab is a virgool profile or post
    // Patterns:
    // https://virgool.io/@username
    // https://virgool.io/@username/post-slug
    const match = tab.url.match(/https?:\/\/(?:www\.)?virgool\.io\/@([a-zA-Z0-9_.-]+)/i);
    if (match && match[1]) {
      const username = match[1];
      const input = document.getElementById('usernameInput');
      input.value = username;
      document.getElementById('detectedBadge').style.display = 'inline-block';
    }
  } catch (err) {
    console.debug('Could not query active tab url:', err);
  }
}

async function loadTopRecentBackups() {
  try {
    const all = await getAllBackups();
    const section = document.getElementById('recentBackupsSection');
    const listEl = document.getElementById('recentBackupsList');
    if (!section || !listEl) return;

    if (!all || all.length === 0) {
      section.style.display = 'none';
      return;
    }

    const top3 = all.slice(0, 3);
    listEl.innerHTML = '';

    top3.forEach((item) => {
      const versionTag = item.versionLabel || (item.version && item.version > 1 ? `v${item.version}` : null);
      const baseName = item.user?.name || `@${item.user?.username || 'کاربر'}`;
      const displayName = versionTag ? `${baseName} (${versionTag})` : baseName;
      const avatarUrl = item.user?.avatar || DEFAULT_AVATAR_URL;
      const postsCount = item.posts?.length || 0;
      const timeAgo = formatRelativeTime(item.createdAt);
      const durText = item.stats?.durationMs ? formatDuration(item.stats.durationMs) : null;

      const itemEl = document.createElement('div');
      itemEl.className = 'recent-backup-item';
      itemEl.title = 'نمایش و چاپ کتابچه PDF';
      itemEl.innerHTML = `
        <div class="recent-item-user">
          <img class="recent-item-avatar" src="${avatarUrl}" alt="" onerror="this.src='${DEFAULT_AVATAR_URL}'" />
          <div class="recent-item-info">
            <span class="recent-item-name">${escapeHtml(displayName)}</span>
            <div class="recent-item-meta">
              <span>${toPersianDigits(postsCount)} مقاله</span>
              <span>•</span>
              <span>${timeAgo}</span>
              ${durText ? `<span>•</span><span>${durText}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="recent-item-actions">
          <button class="recent-btn-view" type="button" title="چاپ PDF">
            <span>چاپ</span>
            <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
          </button>
        </div>
      `;

      itemEl.addEventListener('click', () => {
        chrome.tabs.create({
          url: chrome.runtime.getURL(`print/print.html?id=${item.id}`),
        });
      });

      listEl.appendChild(itemEl);
    });

    section.style.display = 'block';
  } catch (err) {
    console.debug('Could not load top recent backups:', err);
  }
}

async function startBackupProcess() {
  const usernameInput = document.getElementById('usernameInput');
  const rawUsername = usernameInput.value.trim().replace(/^@/, '');

  if (!rawUsername) {
    showError('لطفاً نام کاربری نویسنده در ویرگول را وارد کنید.');
    return;
  }

  hideError();
  document.getElementById('inputCard').style.display = 'none';
  document.getElementById('progressBox').style.display = 'block';
  const recentSection = document.getElementById('recentBackupsSection');
  if (recentSection) recentSection.style.display = 'none';

  abortController = new AbortController();

  const speedRange = document.getElementById('speedRange');
  const presetKey = speedRange ? speedRange.value : '1';
  const speedConfig = SPEED_PRESETS[presetKey] || SPEED_PRESETS[1];

  // Initialize live timer and worker count in progress box
  const timerEl = document.getElementById('progressElapsedTimer');
  const workerInfoEl = document.getElementById('progressWorkersInfo');
  if (timerEl) timerEl.textContent = '۰۰:۰۰';
  if (workerInfoEl) workerInfoEl.textContent = speedConfig.label;

  const startTimestamp = Date.now();
  if (progressTimerInterval) clearInterval(progressTimerInterval);
  progressTimerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - startTimestamp) / 1000);
    const liveTimer = document.getElementById('progressElapsedTimer');
    if (liveTimer) liveTimer.textContent = formatTimer(elapsedSec);
  }, 1000);

  try {
    const backupPackage = await backupUser(rawUsername, {
      signal: abortController.signal,
      onProgress: updateProgressUI,
      workers: speedConfig.workers,
      delayMs: speedConfig.delayMs,
    });

    currentBackupResult = backupPackage;
    await saveBackup(backupPackage);
    await loadTopRecentBackups();

    // Open manager dashboard focused on this backup with success banner
    const managerUrl = chrome?.runtime?.getURL 
      ? chrome.runtime.getURL(`manager/manager.html?id=${encodeURIComponent(backupPackage.id)}&success=1`)
      : `../manager/manager.html?id=${encodeURIComponent(backupPackage.id)}&success=1`;

    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url: managerUrl });
    } else {
      window.open(managerUrl, '_blank');
    }

    // Reset popup view to input card
    document.getElementById('progressBox').style.display = 'none';
    document.getElementById('inputCard').style.display = 'block';
    usernameInput.value = '';
  } catch (err) {
    console.error('Backup error:', err);
    document.getElementById('progressBox').style.display = 'none';
    document.getElementById('inputCard').style.display = 'block';
    await loadTopRecentBackups();
    showError(err.message || 'خطایی در فرآیند پشتیبان‌گیری رخ داد.');
  } finally {
    if (progressTimerInterval) {
      clearInterval(progressTimerInterval);
      progressTimerInterval = null;
    }
    abortController = null;
  }
}

function cancelBackupProcess() {
  if (progressTimerInterval) {
    clearInterval(progressTimerInterval);
    progressTimerInterval = null;
  }
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  document.getElementById('progressBox').style.display = 'none';
  document.getElementById('inputCard').style.display = 'block';
  loadTopRecentBackups();
  showError('عملیات پشتیبان‌گیری لغو شد.');
}

function updateProgressUI(progress) {
  const percent = progress.percent || 0;
  document.getElementById('progressPercent').textContent = `${toPersianDigits(percent)}٪`;
  document.getElementById('progressBarFill').style.width = `${percent}%`;

  if (progress.message) {
    document.getElementById('progressStatusMsg').textContent = progress.message;
  }

  if (progress.phase === 'listing') {
    document.getElementById('progressPhase').textContent = 'دریافت فهرست مقالات';
  } else if (progress.phase === 'processing_post') {
    document.getElementById('progressPhase').textContent = 'دریافت متن و تصاویر مقالات';
  } else if (progress.phase === 'processing_comments') {
    document.getElementById('progressPhase').textContent = 'دریافت نظرات و پاسخ‌ها';
  } else if (progress.phase === 'complete') {
    document.getElementById('progressPhase').textContent = 'تکمیل شد';
  }
}

function showError(msg) {
  const alertEl = document.getElementById('errorAlert');
  alertEl.textContent = msg;
  alertEl.style.display = 'block';
}

function hideError() {
  const alertEl = document.getElementById('errorAlert');
  alertEl.style.display = 'none';
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
