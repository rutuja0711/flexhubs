import type { AttachmentFileCategory } from './attachmentFileMeta';

export type AttachmentIconTheme = {
  containerClass: string;
  iconClass: string;
};

export function attachmentIconTheme(
  category: AttachmentFileCategory,
  isOwn: boolean,
): AttachmentIconTheme {
  if (isOwn) {
    return {
      containerClass: 'bg-white/12 text-white ring-1 ring-white/15',
      iconClass: 'text-white',
    };
  }

  switch (category) {
    case 'pdf':
      return {
        containerClass: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/25',
        iconClass: 'text-red-400',
      };
    case 'word':
      return {
        containerClass: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25',
        iconClass: 'text-blue-400',
      };
    case 'excel':
      return {
        containerClass: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25',
        iconClass: 'text-emerald-400',
      };
    case 'presentation':
      return {
        containerClass: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25',
        iconClass: 'text-orange-400',
      };
    case 'archive':
      return {
        containerClass: 'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25',
        iconClass: 'text-violet-400',
      };
    case 'image':
      return {
        containerClass: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25',
        iconClass: 'text-sky-400',
      };
    case 'video':
      return {
        containerClass: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/25',
        iconClass: 'text-purple-400',
      };
    case 'audio':
      return {
        containerClass: 'bg-fuchsia-500/15 text-fuchsia-400 ring-1 ring-fuchsia-500/25',
        iconClass: 'text-fuchsia-400',
      };
    case 'code':
      return {
        containerClass: 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/25',
        iconClass: 'text-cyan-400',
      };
    case 'text':
      return {
        containerClass: 'bg-slate-400/15 text-slate-300 ring-1 ring-slate-400/25',
        iconClass: 'text-slate-300',
      };
    default:
      return {
        containerClass: 'bg-app-inset text-app-muted ring-1 ring-app-border/60',
        iconClass: 'text-app-muted',
      };
  }
}
