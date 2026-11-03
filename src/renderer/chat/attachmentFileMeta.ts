export type AttachmentFileCategory =
  | 'archive'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'presentation'
  | 'image'
  | 'video'
  | 'audio'
  | 'generic';

export function readFileExtension(fileName: string): string {
  const base = fileName.trim().split(/[\\/]/).pop() ?? fileName;
  const match = base.match(/\.([a-z0-9]{1,8})$/i);
  return match ? match[1].toLowerCase() : '';
}

export function categorizeAttachmentFile(fileName: string): AttachmentFileCategory {
  const ext = readFileExtension(fileName);

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'].includes(ext)) {
    return 'archive';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return 'word';
  }
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return 'excel';
  }
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) {
    return 'presentation';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'bmp', 'tif', 'tiff'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext)) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'weba'].includes(ext)) {
    return 'audio';
  }

  return 'generic';
}

export function attachmentTypeLabel(category: AttachmentFileCategory, extension: string): string {
  switch (category) {
    case 'archive':
      return 'Archive';
    case 'pdf':
      return 'PDF';
    case 'word':
      return 'Word document';
    case 'excel':
      return 'Spreadsheet';
    case 'presentation':
      return 'Presentation';
    case 'image':
      return extension ? extension.toUpperCase() : 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    default:
      return extension ? extension.toUpperCase() : 'Document';
  }
}
