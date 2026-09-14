const DOCUMENT_PATH_KEY = "kautilya:document-path";
/** Bumped after broken intro path / abort-as-seen so prior visits get one replay. */
const INTRO_SEEN_KEY = "kautilya:intro-seen:v4";

const listeners = new Set<() => void>();

if (typeof window !== "undefined" && sessionStorage.getItem(DOCUMENT_PATH_KEY) === null) {
  try {
    sessionStorage.setItem(DOCUMENT_PATH_KEY, window.location.pathname);
  } catch {}
}

/** Hold header/ribbon until intro finishes or is skipped. Start held when intro will play. */
let completed =
  typeof window === "undefined"
    ? true
    : !(
        window.location.pathname === "/" &&
        (() => {
          try {
            return (
              localStorage.getItem(INTRO_SEEN_KEY) !== "1" &&
              sessionStorage.getItem(INTRO_SEEN_KEY) !== "1" &&
              (sessionStorage.getItem(DOCUMENT_PATH_KEY) ?? window.location.pathname) === "/"
            );
          } catch {
            return false;
          }
        })()
      );

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

function documentLoadPath(): string {
  if (typeof window === "undefined") return "/";
  try {
    return sessionStorage.getItem(DOCUMENT_PATH_KEY) ?? window.location.pathname;
  } catch {
    return window.location.pathname;
  }
}

export function hasSeenHomeIntro(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (localStorage.getItem(INTRO_SEEN_KEY) === "1") return true;
    if (sessionStorage.getItem(INTRO_SEEN_KEY) === "1") return true;
  } catch {
    return true;
  }
  return false;
}

/** True only when the tab first opened on `/` AND the user has never seen the intro before. */
export function shouldPlayHomeIntro(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname !== "/") return false;

  // Never replay if already seen — across visits, refreshes, or navigation
  if (hasSeenHomeIntro()) return false;

  // Only play when the very first document load was "/"
  if (documentLoadPath() !== "/") return false;

  return true;
}

export function beginHomeIntro() {
  if (!completed) return;
  completed = false;
  emit();
}

export function markHomeIntroDone() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, "1");
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {}
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
