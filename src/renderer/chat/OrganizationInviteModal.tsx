import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrganizationInviteItem } from '../../shared/organization';
import { userInOrganization } from '../../shared/user';
import {
  acceptOrganizationInvite,
  declineOrganizationInvite,
  loadMyOrganizationInvites,
} from '../organizationApi';
import { showWorkspaceInviteDesktopNotification } from '../desktopNotifications';
import {
  dispatchOrganizationInvitesRefresh,
  ORGANIZATION_INVITES_REFRESH_EVENT,
} from '../organizationInvitesRefresh';
import { useToast } from '../ui/Toast';

const ORG_INVITE_POLL_MS = 30_000;

type OrganizationInviteModalProps = {
  user: unknown;
  onUnauthorized: (status?: number) => boolean;
  onInviteResolved: () => void;
};

export function OrganizationInviteModal({ user, onUnauthorized, onInviteResolved }: OrganizationInviteModalProps) {
  const toast = useToast();
  const [invites, setInvites] = useState<OrganizationInviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const knownInviteIdsRef = useRef(new Set<string>());
  const snapshotReadyRef = useRef(false);

  const refreshInvites = useCallback(async () => {
    if (!user || userInOrganization(user)) {
      setInvites([]);
      setLoading(false);
      return;
    }

    const result = await loadMyOrganizationInvites();

    if (!result.ok) {
      if (onUnauthorized(result.status)) {
        return;
      }
      setLoading(false);
      return;
    }

    if (snapshotReadyRef.current) {
      for (const invite of result.data) {
        if (!knownInviteIdsRef.current.has(invite.id)) {
          knownInviteIdsRef.current.add(invite.id);
          void showWorkspaceInviteDesktopNotification(
            invite.organizationName ?? invite.email,
            invite.role,
            () => {
              setDismissed(false);
              dispatchOrganizationInvitesRefresh();
            },
          );
        }
      }
    } else {
      for (const invite of result.data) {
        knownInviteIdsRef.current.add(invite.id);
      }
      snapshotReadyRef.current = true;
    }

    setInvites(result.data);
    setLoading(false);
  }, [onUnauthorized, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (userInOrganization(user)) {
      setInvites([]);
      setLoading(false);
      knownInviteIdsRef.current.clear();
      snapshotReadyRef.current = false;
      return;
    }

    setLoading(true);
    snapshotReadyRef.current = false;
    knownInviteIdsRef.current.clear();

    void refreshInvites();

    const onRefresh = () => {
      void refreshInvites();
    };

    window.addEventListener(ORGANIZATION_INVITES_REFRESH_EVENT, onRefresh);
    const timer = window.setInterval(() => {
      void refreshInvites();
    }, ORG_INVITE_POLL_MS);

    return () => {
      window.removeEventListener(ORGANIZATION_INVITES_REFRESH_EVENT, onRefresh);
      window.clearInterval(timer);
    };
  }, [refreshInvites, user]);

  if (!user || loading || invites.length === 0 || dismissed) {
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

    toast.success(
      invite.organizationName
        ? `Joined ${invite.organizationName}.`
        : `Joined ${invite.role ? `${invite.role} role in ` : ''}the workspace.`,
    );
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fade-in"
      onClick={() => setDismissed(true)}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-app-border bg-app-surface backdrop-blur-2xl p-6 shadow-2xl animate-pop-in origin-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-app-border-strong to-transparent pointer-events-none" />

        <h2 className="mb-1 text-base font-semibold text-app-text tracking-tight">Workspace invitation</h2>
        <p className="mb-5 text-xs text-app-muted">
          You have pending invitations. Accept to join a team workspace.
        </p>
        <div className="space-y-3">
          {invites.map((invite) => (
            <div key={invite.id} className="rounded-2xl border border-app-border bg-app-card/60 p-4">
              {invite.organizationName ? (
                <p className="text-sm font-semibold text-app-text">{invite.organizationName}</p>
              ) : null}
              <p className={`text-sm font-semibold text-app-text ${invite.organizationName ? 'mt-1 text-xs font-normal text-app-muted' : ''}`}>
                {invite.email}
              </p>
              {invite.inviterName ? (
                <p className="text-xs text-app-muted mt-0.5">Invited by {invite.inviterName}</p>
              ) : null}
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
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-xs font-medium text-app-muted hover:text-app-text transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
