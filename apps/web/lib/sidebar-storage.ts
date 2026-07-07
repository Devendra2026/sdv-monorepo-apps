const STORAGE_KEY = "sdv-sidebar-collapsed";
const CHANGE_EVENT = "sdv-sidebar-collapsed";

export function getSidebarCollapsed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(collapsed));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeSidebarCollapsed(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function getServerSidebarCollapsed(): boolean {
  return false;
}
