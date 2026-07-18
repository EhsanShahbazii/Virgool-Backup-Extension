/**
 * Popup Controller
 * Coordinates auto-detection of Virgool profiles, progress monitoring, and quick exports.
 */

import { backupUser, SPEED_PRESETS } from '../lib/virgool-api.js';
import { saveBackup, getLatestBackup } from '../lib/storage.js';
import { exportBackupToJson } from '../lib/exporters/json-exporter.js';
import { toPersianDigits } from '../lib/date-utils.js';

let abortController = null;
let currentBackupResult = null;

async function init() {
  setupUIEvents();
  setupSpeedControl();
  await checkActiveTabProfile();
  await checkLatestSavedBackup();
}

function setupUIEvents() {
  const btnStart = document.getElementById('btnStartBackup');
  const btnCancel = document.getElementById('btnCancelBackup');
  const btnOpenDashboard = document.getElementById('btnOpenDashboard');
  const btnDownloadJson = document.getElementById('btnDownloadJson');
  const btnViewPdf = document.getElementById('btnViewPdf');
  const btnOpenManagerFromRes = document.getElementById('btnOpenManagerFromRes');

  btnStart.addEventListener('click', startBackupProcess);
  btnCancel.addEventListener('click', cancelBackupProcess);

  const openManager = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('manager/manager.html') });
  };

  btnOpenDashboard.addEventListener('click', openManager);
  btnOpenManagerFromRes.addEventListener('click', openManager);

  btnDownloadJson.addEventListener('click', () => {
    if (!currentBackupResult) return;
    exportBackupToJson(currentBackupResult);
  });

  btnViewPdf.addEventListener('click', () => {
    if (!currentBackupResult) return;
    chrome.tabs.create({
      url: chrome.runtime.getURL(`print/print.html?id=${currentBackupResult.id}`),
    });
  });

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

async function checkLatestSavedBackup() {
  try {
    const latest = await getLatestBackup();
    if (latest && latest.user) {
      const footer = document.getElementById('latestBackupFooter');
      const nameEl = document.getElementById('latestBackupName');
      const linkEl = document.getElementById('latestBackupLink');

      const versionTag = latest.versionLabel || (latest.version && latest.version > 1 ? `v${latest.version}` : null);
      const baseName = latest.user.name || `@${latest.user.username}`;
      nameEl.textContent = versionTag ? `${baseName} (${versionTag})` : baseName;
      footer.style.display = 'flex';

      linkEl.addEventListener('click', () => {
        chrome.tabs.create({
          url: chrome.runtime.getURL(`print/print.html?id=${latest.id}`),
        });
      });
    }
  } catch (err) {
    console.debug('Could not get latest backup:', err);
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
  document.getElementById('resultBox').style.display = 'none';
  document.getElementById('latestBackupFooter').style.display = 'none';

  abortController = new AbortController();

  const speedRange = document.getElementById('speedRange');
  const presetKey = speedRange ? speedRange.value : '1';
  const speedConfig = SPEED_PRESETS[presetKey] || SPEED_PRESETS[1];

  try {
    const backupPackage = await backupUser(rawUsername, {
      signal: abortController.signal,
      onProgress: updateProgressUI,
      workers: speedConfig.workers,
      delayMs: speedConfig.delayMs,
    });

    currentBackupResult = backupPackage;
    await saveBackup(backupPackage);

    // Show result view
    document.getElementById('progressBox').style.display = 'none';
    document.getElementById('resultBox').style.display = 'block';

    document.getElementById('resPostsCount').textContent = toPersianDigits(backupPackage.posts.length);
    document.getElementById('resCommentsCount').textContent = toPersianDigits(backupPackage.stats.totalComments);
  } catch (err) {
    console.error('Backup error:', err);
    document.getElementById('progressBox').style.display = 'none';
    document.getElementById('inputCard').style.display = 'block';
    showError(err.message || 'خطایی در فرآیند پشتیبان‌گیری رخ داد.');
  } finally {
    abortController = null;
  }
}

function cancelBackupProcess() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  document.getElementById('progressBox').style.display = 'none';
  document.getElementById('inputCard').style.display = 'block';
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

init();
