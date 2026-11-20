// The edit key for a saved report lives only in the browser that created it, so
// that browser can keep changing the ADU settings from the report page.

const PREFIX = "adu-report-key:";

export function rememberEditKey(id: string, editKey: string) {
  try {
    window.localStorage.setItem(PREFIX + id, editKey);
  } catch {
    // Private mode or storage blocked: the report still works, just read-only later.
  }
}

export function readEditKey(id: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + id);
  } catch {
    return null;
  }
}
