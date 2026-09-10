export function isAppInBackground(): boolean {
  return document.hidden || !document.hasFocus();
}

export function subscribeAppFocus(onStoreChange: () => void): () => void {
  const notify = () => onStoreChange();

  window.addEventListener('focus', notify);
  window.addEventListener('blur', notify);
  document.addEventListener('visibilitychange', notify);

  return () => {
    window.removeEventListener('focus', notify);
    window.removeEventListener('blur', notify);
    document.removeEventListener('visibilitychange', notify);
  };
}
