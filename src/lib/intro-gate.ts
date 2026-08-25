let completed = false;
let lastPath: string | null = null;
const listeners = new Set<() => void>();

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

export function syncHomeIntroPath(pathname: string) {
  if (pathname === "/" && lastPath !== null && lastPath !== "/") {
    completed = false;
  }
  lastPath = pathname;
}

export function markHomeIntroDone() {
  if (completed) return;
  completed = true;
  emit();
}
