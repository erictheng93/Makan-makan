export const LEGACY_CUSTOMER_INDEXED_DB_NAMES = [
  "MakanMasakCustomerOptimized",
  "MakanMakanCustomerOptimized",
  "MakanMasakCustomerOpt",
  "MakanMakanCustomerOpt",
  "MakanMasakCustomer",
  "MakanMakanCustomer",
] as const;

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);

    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

// Existing visitors carry these databases; new ones never create them. Marking
// the sweep done keeps it from becoming the very thing it removed — six
// IndexedDB round trips on every page load of the busiest app, forever.
export const LEGACY_CLEANUP_DONE_KEY = "mm_legacy_pwa_storage_cleared";

function alreadySwept(): boolean {
  try {
    return globalThis.localStorage?.getItem(LEGACY_CLEANUP_DONE_KEY) === "1";
  } catch {
    // Storage unavailable (private mode). Sweeping again is harmless.
    return false;
  }
}

function markSwept(): void {
  try {
    globalThis.localStorage?.setItem(LEGACY_CLEANUP_DONE_KEY, "1");
  } catch {
    // Nothing to record if storage is unavailable; the sweep still ran.
  }
}

export async function cleanupLegacyPWAStorage(): Promise<void> {
  if (typeof indexedDB === "undefined" || !indexedDB.deleteDatabase) {
    return;
  }

  if (alreadySwept()) {
    return;
  }

  await Promise.allSettled(
    LEGACY_CUSTOMER_INDEXED_DB_NAMES.map((name) => deleteDatabase(name)),
  );

  markSwept();
}
