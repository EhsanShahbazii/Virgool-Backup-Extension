/**
 * JSON Exporter
 * Exports the complete backup data as a formatted, human-readable JSON file.
 */

export function exportBackupToJson(backupPackage, filename) {
  if (!backupPackage) throw new Error('No backup data to export');

  const vTag = backupPackage.versionLabel ? `-${backupPackage.versionLabel}` : '';
  const defaultFilename = filename || `virgool-backup-${backupPackage.user?.username || 'export'}${vTag}-${new Date().toISOString().slice(0, 10)}.json`;
  
  const jsonString = JSON.stringify(backupPackage, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Use standard anchor download for direct, reliable saving
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return defaultFilename;
}
