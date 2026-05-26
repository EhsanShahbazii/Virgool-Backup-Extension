/**
 * Storage Manager for Virgool Backup
 * Uses IndexedDB for unlimited local storage with chrome.storage fallback.
 */

const DB_NAME = 'VirgoolBackupDB';
const DB_VERSION = 1;
const STORE_NAME = 'backups';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('username', 'user.username', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBackup(backupPackage) {
  // Check if duplicate username already exists to append v2, v3, ...
  try {
    if (!backupPackage.version && backupPackage.user?.username) {
      const existing = await getAllBackups();
      const username = backupPackage.user.username.toLowerCase();
      const userBackups = existing.filter(
        (b) => b.id !== backupPackage.id && b.user?.username?.toLowerCase() === username
      );
      if (userBackups.length > 0) {
        let maxVersion = 1;
        for (const b of userBackups) {
          if (typeof b.version === 'number' && b.version > maxVersion) {
            maxVersion = b.version;
          }
        }
        const nextVersion = Math.max(maxVersion + 1, userBackups.length + 1);
        backupPackage.version = nextVersion;
        backupPackage.versionLabel = `v${nextVersion}`;
      } else {
        backupPackage.version = 1;
        backupPackage.versionLabel = null;
      }
    }
  } catch (err) {
    console.debug('Could not auto-version duplicate backup:', err);
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(backupPackage);
      req.onsuccess = () => resolve(backupPackage.id);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB failed, falling back to chrome.storage.local:', err);
    if (chrome?.storage?.local) {
      await chrome.storage.local.set({ [backupPackage.id]: backupPackage });
      const { backupIds = [] } = await chrome.storage.local.get('backupIds');
      if (!backupIds.includes(backupPackage.id)) {
        await chrome.storage.local.set({ backupIds: [backupPackage.id, ...backupIds] });
      }
      return backupPackage.id;
    }
    throw err;
  }
}

export async function getAllBackups() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        // Sort descending by creation date
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB read failed, fallback to chrome.storage.local:', err);
    if (chrome?.storage?.local) {
      const { backupIds = [] } = await chrome.storage.local.get('backupIds');
      const result = await chrome.storage.local.get(backupIds);
      return Object.values(result);
    }
    return [];
  }
}

export async function getBackupById(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    if (chrome?.storage?.local) {
      const result = await chrome.storage.local.get(id);
      return result[id] || null;
    }
    return null;
  }
}

export async function deleteBackup(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    if (chrome?.storage?.local) {
      await chrome.storage.local.remove(id);
      const { backupIds = [] } = await chrome.storage.local.get('backupIds');
      await chrome.storage.local.set({ backupIds: backupIds.filter((bId) => bId !== id) });
      return true;
    }
    return false;
  }
}

export async function getLatestBackup() {
  const all = await getAllBackups();
  return all.length > 0 ? all[0] : null;
}
