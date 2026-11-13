import type { ReactNode } from 'react';
import type { AttachmentFileCategory } from './attachmentFileMeta';

type AttachmentFileIconProps = {
  category: AttachmentFileCategory;
  className?: string;
};

function IconShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function AttachmentFileIcon({ category, className = 'h-5 w-5' }: AttachmentFileIconProps) {
  switch (category) {
    case 'archive':
      return (
        <IconShell className={className}>
          <path
            d="M8 4h8l4 4v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h3z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M16 4v4h4M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </IconShell>
      );
    case 'pdf':
      return (
        <IconShell className={className}>
          <path
            d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 14h2v4H9v-4zm4 0h2v4h-2v-4z" fill="currentColor" opacity="0.85" />
        </IconShell>
      );
    case 'word':
      return (
        <IconShell className={className}>
          <path
            d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 12.5h6M9 15.5h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </IconShell>
      );
    case 'excel':
      return (
        <IconShell className={className}>
          <rect x="5" y="3" width="14" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 8h8M8 12h8M8 16h8M12 8v8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </IconShell>
      );
    case 'presentation':
      return (
        <IconShell className={className}>
          <rect x="4" y="5" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 16l4-3 4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="1.5" fill="currentColor" />
        </IconShell>
      );
    case 'image':
      return (
        <IconShell className={className}>
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <path d="M6 17l4.5-4 3 2.5L17 12l3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </IconShell>
      );
    case 'video':
      return (
        <IconShell className={className}>
          <rect x="3" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 10l4-2v8l-4-2v-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </IconShell>
      );
    case 'audio':
      return (
        <IconShell className={className}>
          <path
            d="M9 18V6l8-2v14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="15" cy="16" r="2" stroke="currentColor" strokeWidth="1.5" />
        </IconShell>
      );
    case 'text':
      return (
        <IconShell className={className}>
          <path
            d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 12.5h6M9 15.5h5M9 18h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </IconShell>
      );
    case 'code':
      return (
        <IconShell className={className}>
          <path
            d="M8 8L5 12l3 4M16 8l3 4-3 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13 6l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </IconShell>
      );
    default:
      return (
        <IconShell className={className}>
          <path
            d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </IconShell>
      );
  }
}
