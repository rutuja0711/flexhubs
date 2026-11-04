export const ORGANIZATION_INVITES_REFRESH_EVENT = 'organization-invites:refresh';

export function dispatchOrganizationInvitesRefresh(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(ORGANIZATION_INVITES_REFRESH_EVENT));
}
