import type { AttachmentFileCategory } from './attachmentFileMeta';
import { categorizeAttachmentFile, readFileExtension } from './attachmentFileMeta';
import { isTextPreviewFile } from './attachmentPreviewSupport';

const EXECUTABLE_EXTENSIONS = new Set([
  'exe',
  'msi',
  'apk',
  'dmg',
  'pkg',
  'app',
  'deb',
  'rpm',
  'run',
  'bat',
  'cmd',
  'com',
  'scr',
  'ps1',
  'vbs',
  'jar',
]);

const ARCHIVE_EXTENSIONS = new Set(['zip', 'jar']);

export function isExecutableAttachment(fileName: string): boolean {
  const ext = readFileExtension(fileName);
  return EXECUTABLE_EXTENSIONS.has(ext);
}

export function executableAttachmentWarning(fileName: string): string | null {
  const ext = readFileExtension(fileName);
  if (!EXECUTABLE_EXTENSIONS.has(ext)) {
    return null;
  }

  switch (ext) {
    case 'apk':
      return 'This is an Android app package. Download only if you trust the sender. FlexHubs will not install it automatically.';
    case 'exe':
    case 'msi':
      return 'This is a Windows installer. Download only if you trust the sender. FlexHubs will not run it automatically.';
    case 'dmg':
    case 'pkg':
      return 'This is a macOS installer. Download only if you trust the sender. FlexHubs will not open it automatically.';
    default:
      return 'This file may run code on your device. Download only if you trust the sender.';
  }
}

export function canListArchiveContents(fileName: string): boolean {
  return ARCHIVE_EXTENSIONS.has(readFileExtension(fileName));
}

export function supportsRichInlinePreview(fileName: string): boolean {
  const category = categorizeAttachmentFile(fileName);
  if (
    category === 'image' ||
    category === 'video' ||
    category === 'audio' ||
    category === 'pdf'
  ) {
    return true;
  }

  if (isTextPreviewFile(fileName)) {
    return true;
  }

  if (canListArchiveContents(fileName)) {
    return true;
  }

  return false;
}

export function officeDocumentCategory(category: AttachmentFileCategory): boolean {
  return category === 'word' || category === 'excel' || category === 'presentation';
}

export function isCsvFile(fileName: string): boolean {
  return readFileExtension(fileName) === 'csv';
}