import { useState } from 'react';
import type { ConversationItem } from '../../shared/chat';
import {
  renameConversation,
  addConversationMembers,
  removeConversationMember,
  leaveConversation,
  deleteConversation,
  clearConversationHistory,
} from '../chatApi';

type GroupSettingsModalProps = {
  open: boolean;
  conversation: ConversationItem;
  currentUserId: string | null;
  onClose: () => void;
  onConversationUpdated: () => void; // Trigger a re-fetch of the conversation list
};

export function GroupSettingsModal({
  open,
  conversation,
  currentUserId,
  onClose,
  onConversationUpdated,
}: GroupSettingsModalProps) {
  const [nameDraft, setNameDraft] = useState(conversation.title);
  const [newMemberId, setNewMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleRename = async () => {
    if (!nameDraft.trim() || nameDraft === conversation.title) return;
    setLoading(true);
    setError('');
    const result = await renameConversation(conversation.id, nameDraft.trim());
    if (result.ok) {
      onConversationUpdated();
    } else {
      setError(result.error || 'Failed to rename group');
    }
    setLoading(false);
  };

  const handleAddMember = async () => {
    if (!newMemberId.trim()) return;
    setLoading(true);
    setError('');
    const result = await addConversationMembers(conversation.id, [newMemberId.trim()]);
    if (result.ok) {
      setNewMemberId('');
      onConversationUpdated();
    } else {
      setError(result.error || 'Failed to add member');
    }
    setLoading(false);
  };

  const handleRemoveMember = async (userId: string) => {
    setLoading(true);
    setError('');
    const result = await removeConversationMember(conversation.id, userId);
    if (result.ok) {
      onConversationUpdated();
    } else {
      setError(result.error || 'Failed to remove member');
    }
    setLoading(false);
  };

  const handleLeave = async () => {
    setLoading(true);
    setError('');
    const result = await leaveConversation(conversation.id);
    if (result.ok) {
      onConversationUpdated();
      onClose();
    } else {
      setError(result.error || 'Failed to leave group');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    const result = await deleteConversation(conversation.id);
    if (result.ok) {
      onConversationUpdated();
      onClose();
    } else {
      setError(result.error || 'Failed to delete group');
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    setLoading(true);
    setError('');
    const result = await clearConversationHistory(conversation.id);
    if (result.ok) {
      onConversationUpdated();
    } else {
      setError(result.error || 'Failed to clear history');
    }
    setLoading(false);
  };

  const isAdmin = true; // In a real scenario, we'd check if currentUserId is in conversation.admins

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-app-surface shadow-xl">
        <header className="flex items-center justify-between border-b border-app-border px-6 py-4">
          <h2 className="text-lg font-semibold text-app-text">Group Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
          >
            ✕
          </button>
        </header>

        <div className="overflow-y-auto p-6 space-y-6">
          {error && <p className="text-sm text-accent-soft p-3 bg-accent/10 rounded-lg">{error}</p>}

          {/* Rename Group */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-app-text">Group Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 rounded-xl border border-app-border bg-app-surface-input px-4 py-2 text-sm text-app-text focus:border-accent focus:outline-none"
                placeholder="Group name"
                disabled={loading}
              />
              <button
                onClick={handleRename}
                disabled={loading || nameDraft === conversation.title}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>

          {/* Add Member */}
          {isAdmin && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text">Add Member</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemberId}
                  onChange={(e) => setNewMemberId(e.target.value)}
                  className="flex-1 rounded-xl border border-app-border bg-app-surface-input px-4 py-2 text-sm text-app-text focus:border-accent focus:outline-none"
                  placeholder="User ID"
                  disabled={loading}
                />
                <button
                  onClick={handleAddMember}
                  disabled={loading || !newMemberId.trim()}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2 border-t border-app-border pt-4">
            <h3 className="text-sm font-medium text-app-text mb-3">Members</h3>
            <div className="space-y-2">
              {/* Note: ConversationItem usually has a members array, but let's mock rendering it if it exists */}
              <p className="text-sm text-app-muted">Member list rendering depends on conversation payload.</p>
            </div>
          </div>

          {/* Destructive Actions */}
          <div className="space-y-3 border-t border-app-border pt-4">
            <button
              onClick={handleClearHistory}
              disabled={loading}
              className="w-full rounded-xl bg-app-chat-hover px-4 py-3 text-sm font-medium text-app-text hover:bg-app-border"
            >
              Clear Chat History
            </button>
            <button
              onClick={handleLeave}
              disabled={loading}
              className="w-full rounded-xl border border-accent-soft/30 bg-accent/5 px-4 py-3 text-sm font-semibold text-accent-soft hover:bg-accent/10"
            >
              Leave Group
            </button>
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="w-full rounded-xl bg-accent-soft px-4 py-3 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete Group
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
