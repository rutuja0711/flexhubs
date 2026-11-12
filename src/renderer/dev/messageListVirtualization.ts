/** Dev toggle for comparing legacy vs virtual message list. Production uses Virtuoso unless VITE_MESSAGE_LIST_VIRTUAL=0. */

export function isMessageListVirtualizationEnabled(): boolean {
  if (import.meta.env.VITE_MESSAGE_LIST_VIRTUAL === '0') {
    return false;
  }

  if (!import.meta.env.DEV) {
    return true;
  }

  try {
    return window.localStorage.getItem('flexhubs_message_list_virtual') !== '0';
  } catch {
    return true;
  }
}
