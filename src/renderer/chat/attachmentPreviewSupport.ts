import type { AttachmentFileCategory } from './attachmentFileMeta';
import { categorizeAttachmentFile, readFileExtension } from './attachmentFileMeta';

const TEXT_PREVIEW_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'xml',
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'yml',
  'yaml',
  'log',
  'csv',
  'ini',
  'env',
  'sh',
  'bat',
  'py',
  'java',
  'c',
  'cpp',
  'h',
  'rs',
  'go',
  'php',
  'sql',
  'rb',
  'kt',
  'swift',
  'vue',
  'scss',
  'less',
  'toml',
]);

export function isTextPreviewFile(fileName: string, mimeType?: string): boolean {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.startsWith('text/')) {
    return true;
  }
  if (mime.includes('json') || mime.includes('xml') || mime.includes('javascript')) {
    return true;
  }
  const ext = readFileExtension(fileName);
  return TEXT_PREVIEW_EXTENSIONS.has(ext);
}

export function shouldAttachObjectUrlForPreview(
  file: File,
  category: AttachmentFileCategory,
): boolean {
  const mime = file.type || '';
  if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) {
    return true;
  }
  if (category === 'pdf' || mime === 'application/pdf') {
    return true;
  }
  if (isTextPreviewFile(file.name, mime)) {
    return true;
  }
  return category === 'image' || category === 'video' || category === 'audio';
}

export function categorizeRemoteAttachment(name: string): AttachmentFileCategory {
  return categorizeAttachmentFile(name);
}