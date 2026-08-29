const DOCUMENT_PATH_KEY = "kautilya:document-path";
const INTRO_SEEN_KEY = "kautilya:intro-seen";

let completed = true;
const listeners = new Set<() => void>();

if (typeof window !== "undefined" && sessionStorage.getItem(DOCUMENT_PATH_KEY) === null) {
  sessionStorage.setItem(DOCUMENT_PATH_KEY, window.location.pathname);
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeHomeIntro(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isHomeIntroDone() {
  return completed;
}

function navigationEntry(): PerformanceNavigationTiming | undefined {
  if (typeof performance === "undefined") return undefined;
  return performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
}

function documentLoadPath(): string {
  if (typeof window === "undefined") return "/";
  return sessionStorage.getItem(DOCUMENT_PATH_KEY) ?? window.location.pathname;
}

/** True only when the tab first opened on `/`, or the user refreshed while on `/`. */
export function shouldPlayHomeIntro(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname !== "/") return false;

  const nav = navigationEntry();
  if (nav?.type === "reload") return true;

  if (documentLoadPath() !== "/") return false;
  return sessionStorage.getItem(INTRO_SEEN_KEY) !== "1";
}

export function beginHomeIntro() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  }
  if (!completed) return;
  completed = false;
  emit();
}

export function markHomeIntroDone() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  }
  if (completed) return;
  completed = true;
  emit();
}

/** Show header/ribbon when intro is skipped without playing. */
export function releaseHomeIntroHold() {
  if (completed) return;
  completed = true;
  emit();
}
