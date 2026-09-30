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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-app-border bg-app-surface backdrop-blur-2xl p-6 shadow-2xl animate-pop-in origin-center">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-app-border-strong to-transparent pointer-events-none" />

        <h2 className="mb-1 text-base font-semibold text-app-text tracking-tight">Workspace invitation</h2>
        <p className="mb-5 text-xs text-app-muted">
          You have pending invitations. Accept to join a team workspace.
        </p>
        <div className="space-y-3">
          {invites.map((invite) => (
            <div key={invite.id} className="rounded-2xl border border-app-border bg-app-card/60 p-4">
              <p className="text-sm font-semibold text-app-text">{invite.email}</p>
              <p className="text-xs text-app-muted mt-0.5">
                Role: <span className="text-app-text font-medium">{invite.role || 'Member'}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={actingOn === invite.id}
                  onClick={() => {
                    void handleDecline(invite);
                  }}
                  className="flex-1 rounded-xl bg-app-card py-2 text-xs font-semibold text-app-muted hover:text-app-text hover:bg-app-inset disabled:opacity-50 transition-colors shadow-xs"
                >
                  Decline
                </button>
                <button
                  type="button"
                  disabled={actingOn === invite.id}
                  onClick={() => {
                    void handleAccept(invite);
                  }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-accent to-[#632a38] py-2 text-xs font-semibold text-white shadow-md shadow-accent/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
