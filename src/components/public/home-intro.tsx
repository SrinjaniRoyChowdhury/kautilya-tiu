"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  beginHomeIntro,
  markHomeIntroDone,
  releaseHomeIntroHold,
  shouldPlayHomeIntro,
} from "@/lib/intro-gate";

const FADE_MS = 1100;

let cachedPlayDecision: boolean | null = null;

function readPlayDecision() {
  if (cachedPlayDecision === null) {
    cachedPlayDecision = shouldPlayHomeIntro();
  }
  return cachedPlayDecision;
}

function subscribeNoop() {
  return () => {};
}

export function HomeIntro() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadingRef = useRef(false);
  const play = useSyncExternalStore(subscribeNoop, readPlayDecision, () => false);
  const [dismissed, setDismissed] = useState(false);
  const [fading, setFading] = useState(false);
  const shouldPlay = play && !dismissed;

  useEffect(() => {
    if (play) beginHomeIntro();
    else releaseHomeIntroHold();
  }, [play]);

  function startFade() {
    if (fadingRef.current) return;
    fadingRef.current = true;
    setFading(true);
    window.setTimeout(() => {
      setDismissed(true);
      markHomeIntroDone();
    }, FADE_MS);
  }

  useEffect(() => {
    if (!shouldPlay) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") startFade();
    };
    window.addEventListener("keydown", onKey);
    const video = videoRef.current;
    const tryPlay = () => {
      if (!video) return;
      video.muted = true;
      video.volume = 0;
      void video.play().catch(() => undefined);
    };
    tryPlay();
    video?.addEventListener("canplay", tryPlay);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      video?.removeEventListener("canplay", tryPlay);
    };
  }, [shouldPlay]);

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video?.duration || fadingRef.current) return;
    if (video.duration - video.currentTime <= FADE_MS / 1000) startFade();
  }

  if (!shouldPlay) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] bg-ink transition-opacity ease-out ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      role="dialog"
      aria-modal="true"
      aria-label="Niti Sabha introduction"
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        onTimeUpdate={onTimeUpdate}
        onEnded={startFade}
        onError={startFade}
      />
      <button
        type="button"
        onClick={startFade}
        className="absolute bottom-6 right-6 rounded-sm border border-parchment-50/30 bg-ink/50 px-3 py-1.5 text-xs font-medium tracking-wide text-parchment-50 backdrop-blur-sm hover:bg-ink/70"
      >
        Skip intro
      </button>
    </div>
  );
}
