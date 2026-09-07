import { useEffect, useState } from 'react';
import { getStoredUser } from '../authApi';
import type { OrganizationInviteItem } from '../../shared/organization';
import { userInOrganization } from '../../shared/user';
import {
  acceptOrganizationInvite,
  declineOrganizationInvite,
  loadMyOrganizationInvites,
} from '../organizationApi';
import { useToast } from '../ui/Toast';

type OrganizationInviteModalProps = {
  onUnauthorized: (status?: number) => boolean;
  onInviteResolved: () => void;
};

export function OrganizationInviteModal({ onUnauthorized, onInviteResolved }: OrganizationInviteModalProps) {
  const toast = useToast();
  const [invites, setInvites] = useState<OrganizationInviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    if (userInOrganization(getStoredUser())) {
      setLoading(false);
      return;
    }

    void loadMyOrganizationInvites().then((result) => {
      if (!result.ok) {
        if (onUnauthorized(result.status)) {
          return;
        }
        setLoading(false);
        return;
      }

      setInvites(result.data);
      setLoading(false);
    });
  }, [onUnauthorized]);

  if (loading || invites.length === 0) {
    return null;
  }

  const handleAccept = async (invite: OrganizationInviteItem) => {
    setActingOn(invite.id);
    const result = await acceptOrganizationInvite(invite.id);
    setActingOn(null);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    toast.success(`Joined ${invite.role ? `${invite.role} role in ` : ''}the workspace.`);
    onInviteResolved();
  };

  const handleDecline = async (invite: OrganizationInviteItem) => {
    setActingOn(invite.id);
    const result = await declineOrganizationInvite(invite.id);
    setActingOn(null);

    if (!result.ok) {
      if (onUnauthorized(result.status)) return;
      toast.error(result.error);
      return;
    }

    setInvites((current) => current.filter((item) => item.id !== invite.id));
    toast.info('Invitation declined.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-inset p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-bold text-app-text">Workspace invitation</h2>
        <p className="mb-5 text-sm text-app-muted">
          You have pending invitations. Accept to join a team workspace.
        </p>
        <div className="space-y-3">
          {invites.map((invite) => (
            <div key={invite.id} className="rounded-xl border border-app-border p-4">
              <p className="text-sm font-medium text-app-text">{invite.email}</p>
              <p className="text-xs text-app-muted">
                Role: {invite.role || 'Member'}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={actingOn === invite.id}
                  onClick={() => {
                    void handleAccept(invite);
                  }}
                  className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={actingOn === invite.id}
                  onClick={() => {
                    void handleDecline(invite);
                  }}
                  className="flex-1 rounded-lg border border-app-border py-2 text-sm font-semibold text-app-muted hover:text-app-text disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
