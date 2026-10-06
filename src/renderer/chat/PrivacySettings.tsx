import React, { useState, useEffect, useRef } from 'react';
import {
  FiShield,
  FiTarget,
  FiEye,
  FiClock,
  FiEyeOff,
  FiCheckCircle,
  FiUser,
  FiMail,
  FiMessageSquare,
  FiPhoneCall,
  FiMessageCircle,
  FiUserX,
  FiInfo,
  FiChevronDown,
  FiCheck,
} from 'react-icons/fi';
import { useToast } from '../ui/Toast';

import type { ProfileSettings } from '../../shared/profile';
import { resolveSnoozeSelectValue, resolveDndSelectValue } from '../../shared/profile';
import { saveUserProfile, saveNotificationSettings } from '../chatApi';

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-app-border bg-app-surface shadow-xs ${className}`}>
      {children}
    </div>
  );
}

interface PrivacySettingsProps {
  settings: ProfileSettings | null;
  setSettings: (s: ProfileSettings) => void;
  blockedUsers: { id: string; username: string }[];
  blockedLoading: boolean;
  unblockingId: string | null;
  handleUnblockUser: (id: string, username: string) => void;
  onUserUpdated?: () => void;
  onUnauthorized: (status: number) => boolean;
}

export function PrivacySettings({
  settings,
  setSettings,
  blockedUsers,
  blockedLoading,
  unblockingId,
  handleUnblockUser,
  onUserUpdated,
  onUnauthorized,
}: PrivacySettingsProps) {
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  const toast = useToast();

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-app-muted">Loading privacy settings...</p>
      </div>
    );
  }

  const handleToggle = async (field: keyof ProfileSettings) => {
    if (updatingField) return;
    const previousValue = settings[field];
    const nextValue = !previousValue;
    
    setUpdatingField(field);
    setSettings({ ...settings, [field]: nextValue });

    const [resProfile, resNotif] = await Promise.all([
      saveUserProfile({ [field]: nextValue }),
      saveNotificationSettings({
        [field]: nextValue,
      })
    ]);

    if (!resProfile.ok && !resNotif.ok && !onUnauthorized(resProfile.status || 500)) {
      setSettings({ ...settings, [field]: previousValue });
      toast.error('Failed to update privacy settings. Please try again.');
    } else {
      toast.success('Privacy settings updated');
    }
    
    setUpdatingField(null);
  };

  const handleDropdown = async (field: keyof ProfileSettings, value: string) => {
    if (updatingField) return;
    const previousValue = settings[field];
    
    setUpdatingField(field);
    setSettings({ ...settings, [field]: value });

    const [resProfile, resNotif] = await Promise.all([
      saveUserProfile({ [field]: value }),
      saveNotificationSettings({
        [field]: value,
      })
    ]);

    if (!resProfile.ok && !resNotif.ok && !onUnauthorized(resProfile.status || 500)) {
      setSettings({ ...settings, [field]: previousValue });
      toast.error('Failed to update privacy settings. Please try again.');
    } else {
      toast.success('Privacy settings updated');
    }
    
    setUpdatingField(null);
  };

  const ToggleRow = ({
    icon: Icon,
    title,
    description,
    field,
  }: {
    icon: React.ElementType;
    title: string;
    description: string;
    field: keyof ProfileSettings;
  }) => {
    const isChecked = Boolean(settings[field]);
    const isLoading = updatingField === field;

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-3 sm:gap-4">
        <div className="flex items-start gap-3">
          <Icon className="text-app-muted text-lg mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-app-text">{title}</p>
            <p className="text-xs text-app-muted">{description}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void handleToggle(field)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 sm:ml-4 ml-7 ${isChecked ? 'bg-accent' : 'bg-app-border'}`}
        >
          <span className="sr-only">Toggle {title}</span>
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ease-in-out ${isChecked ? 'translate-x-2' : '-translate-x-2'}`} />
        </button>
      </div>
    );
  };

  const DropdownRow = ({
    icon: Icon,
    title,
    description,
    field,
    options,
  }: {
    icon: React.ElementType;
    title: string;
    description: string;
    field: keyof ProfileSettings;
    options: string[];
  }) => {
    const currentValue = (settings[field] as string) || options[0];
    const isLoading = updatingField === field;

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-3 sm:gap-4">
        <div className="flex items-start gap-3">
          <Icon className="text-app-muted text-lg mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-app-text">{title}</p>
            <p className="text-xs text-app-muted">{description}</p>
          </div>
        </div>
        <div className="relative shrink-0 sm:w-60 ml-7 sm:ml-0" ref={dropdownRef}>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setIsOpen(!isOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-app-border bg-app-chat-bg px-3 py-1.5 text-sm text-app-text outline-none transition-colors hover:border-app-muted focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
          >
            <span className="truncate">{currentValue}</span>
            <FiChevronDown className={`shrink-0 ml-2 text-app-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isOpen && (
            <div className="absolute right-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-app-border bg-app-surface py-1 shadow-lg ring-1 ring-black ring-opacity-5">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    void handleDropdown(field, opt);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center px-3 py-2 text-sm text-app-text hover:bg-app-chat-hover"
                >
                  <span className="flex-1 text-left truncate">{opt}</span>
                  {opt === currentValue && <FiCheck className="text-accent ml-2 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-app-text">Privacy</h2>
          <p className="mt-1 text-sm text-app-muted">
            Control what teammates can see about your activity.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <FiTarget className="text-red-500 text-lg" />
            <h4 className="text-sm font-bold text-app-text">Online presence</h4>
          </div>
          <p className="text-xs text-app-muted mb-3">Control your online status and activity visibility.</p>
          <SectionCard className="p-4 space-y-5">
            <ToggleRow
              icon={FiEye}
              title="Show my online status"
              description="Allow teammates to see when I'm online."
              field="shareOnlineStatus"
            />
            <ToggleRow
              icon={FiClock}
              title="Show last active"
              description="Allow teammates to see when I was last active."
              field="showLastActive"
            />
          </SectionCard>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <FiEyeOff className="text-red-500 text-lg" />
            <h4 className="text-sm font-bold text-app-text">Read receipts</h4>
          </div>
          <p className="text-xs text-app-muted mb-3">Manage read receipts for your messages.</p>
          <SectionCard className="p-4">
            <ToggleRow
              icon={FiCheckCircle}
              title="Read receipts"
              description="Allow others to know when I've read their messages."
              field="readReceipts"
            />
          </SectionCard>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <FiUser className="text-red-500 text-lg" />
            <h4 className="text-sm font-bold text-app-text">Profile visibility</h4>
          </div>
          <p className="text-xs text-app-muted mb-3">Choose who can see your profile information.</p>
          <SectionCard className="p-4 space-y-5">
            <DropdownRow
              icon={FiUser}
              title="Who can see my profile?"
              description="Control who can view your name, profile photo and basic information."
              field="profileVisibility"
              options={['Everyone', 'Organization only']}
            />
            <DropdownRow
              icon={FiMail}
              title="Who can see my email?"
              description="Control who can view your email address."
              field="emailVisibility"
              options={['Everyone', 'Organization only']}
            />
            <DropdownRow
              icon={FiEye}
              title="Who can see my status?"
              description="Control who can see your current status message."
              field="statusVisibility"
              options={['Everyone', 'Organization only']}
            />
          </SectionCard>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <FiMessageSquare className="text-red-500 text-lg" />
            <h4 className="text-sm font-bold text-app-text">Messaging privacy</h4>
          </div>
          <p className="text-xs text-app-muted mb-3">Control who can send you direct messages.</p>
          <SectionCard className="p-4">
            <DropdownRow
              icon={FiMessageCircle}
              title="Allow direct messages from"
              description="Choose who can send you direct messages."
              field="allowDirectMessagesFrom"
              options={['Everyone', 'Organization members', 'Nobody']}
            />
          </SectionCard>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <FiPhoneCall className="text-red-500 text-lg" />
            <h4 className="text-sm font-bold text-app-text">Call privacy</h4>
          </div>
          <p className="text-xs text-app-muted mb-3">Control who can call you.</p>
          <SectionCard className="p-4">
            <DropdownRow
              icon={FiClock}
              title="Who can call me?"
              description="Choose who can start an audio or video call with you."
              field="callPrivacy"
              options={['Everyone', 'Organization members', 'Nobody']}
            />
          </SectionCard>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <FiUserX className="text-red-500 text-lg" />
            <h4 className="text-sm font-bold text-app-text">Blocked users</h4>
          </div>
          <p className="text-xs text-app-muted mb-3">Manage people you have blocked.</p>
          <SectionCard className="p-4">
            {blockedLoading ? (
              <p className="text-sm text-app-muted text-center py-2">Loading blocked users...</p>
            ) : blockedUsers.length === 0 ? (
              <p className="text-sm text-app-muted text-center py-2">No blocked users.</p>
            ) : (
              <div className="space-y-3">
                {blockedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between bg-app-chat-bg p-3 rounded-lg border border-app-border/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-app-text">{user.username}</p>
                    </div>
                    <button
                      type="button"
                      disabled={unblockingId === user.id}
                      className="shrink-0 rounded border border-app-border px-3 py-1.5 text-xs font-semibold hover:bg-app-chat-hover disabled:opacity-50 text-app-text transition-colors"
                      onClick={() => void handleUnblockUser(user.id, user.username)}
                    >
                      {unblockingId === user.id ? 'Unblocking...' : 'Unblock'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <div className="flex items-start gap-3 rounded-xl bg-app-surface p-4 border border-app-border">
          <FiInfo className="shrink-0 text-yellow-500 mt-0.5" size={18} />
          <div>
            <h5 className="text-sm font-bold text-app-text">Tip</h5>
            <p className="text-xs text-app-muted mt-1">
              You can always block individual users from chat, calls or messages directly from their profile or chat menu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
