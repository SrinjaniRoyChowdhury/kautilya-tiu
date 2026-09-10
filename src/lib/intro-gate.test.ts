import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginHomeIntro,
  hasSeenHomeIntro,
  isHomeIntroDone,
  markHomeIntroDone,
  shouldPlayHomeIntro,
} from "./intro-gate";

describe("intro-gate", () => {
  const store: Record<string, string> = {};
  const mockStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
  };

  beforeEach(() => {
    mockStorage.clear();
    const fakeWindow = {
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      location: { pathname: "/" },
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("localStorage", mockStorage);
    vi.stubGlobal("sessionStorage", mockStorage);
    vi.stubGlobal("location", fakeWindow.location);
  });

  it("identifies when intro has not been seen", () => {
    expect(hasSeenHomeIntro()).toBe(false);
  });

  it("identifies when intro has been marked seen in localStorage", () => {
    mockStorage.setItem("kautilya:intro-seen", "1");
    expect(hasSeenHomeIntro()).toBe(true);
    expect(shouldPlayHomeIntro()).toBe(false);
  });

  it("marks intro seen on beginHomeIntro", () => {
    beginHomeIntro();
    expect(hasSeenHomeIntro()).toBe(true);
    expect(mockStorage.getItem("kautilya:intro-seen")).toBe("1");
  });

  it("marks intro done on markHomeIntroDone", () => {
    markHomeIntroDone();
    expect(isHomeIntroDone()).toBe(true);
    expect(hasSeenHomeIntro()).toBe(true);
  });

  it("does not play on non-home paths", () => {
    const fakeWindow = {
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      location: { pathname: "/committees" },
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("location", fakeWindow.location);
    expect(shouldPlayHomeIntro()).toBe(false);
  });
});
