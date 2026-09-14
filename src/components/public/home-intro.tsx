"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import SpecularButton from "@/components/SpecularButton";
import {
  beginHomeIntro,
  markHomeIntroDone,
  releaseHomeIntroHold,
  shouldPlayHomeIntro,
  subscribeHomeIntro,
} from "@/lib/intro-gate";

const INTRO_SRC = "/intro.mp4";
const FADE_MS = 1100;

/** Survives React Strict Mode remounts within the same page session. */
let introSessionStarted = false;
let introSessionFinished = false;

function readShouldOffer() {
  if (introSessionFinished) return false;
  return shouldPlayHomeIntro() || introSessionStarted;
}

export function HomeIntro() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadingRef = useRef(false);
  const playedRef = useRef(false);
  const offer = useSyncExternalStore(subscribeHomeIntro, readShouldOffer, () => false);
  const [active, setActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [fading, setFading] = useState(false);

  // Adjust state during render when the external store says we should play.
  if (offer && !active && !dismissed) {
    setActive(true);
  }

  const shouldPlay = active && !dismissed;

  useEffect(() => {
    if (introSessionFinished) {
      releaseHomeIntroHold();
      return;
    }
    if (shouldPlay) {
      introSessionStarted = true;
      beginHomeIntro();
      return;
    }
    if (!introSessionStarted) {
      releaseHomeIntroHold();
    }
  }, [shouldPlay]);

  function startFade() {
    if (fadingRef.current) return;
    fadingRef.current = true;
    introSessionFinished = true;
    setFading(true);
    markHomeIntroDone();
    window.setTimeout(() => {
      setDismissed(true);
    }, FADE_MS);
  }

  function onMediaError() {
    const code = videoRef.current?.error?.code;
    // MEDIA_ERR_ABORTED (1) / missing code — common during Strict Mode remount.
    if (code == null || code === 1) return;
    startFade();
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
      if (!video || fadingRef.current) return;
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
    if (video.currentTime < 0.25) return;
    playedRef.current = true;
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
      aria-label="Kautilya introduction"
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src={INTRO_SRC}
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        onPlaying={() => {
          playedRef.current = true;
        }}
        onTimeUpdate={onTimeUpdate}
        onEnded={startFade}
        onError={onMediaError}
      />
      <div className="absolute bottom-6 right-6">
        <SpecularButton
          size="sm"
          radius={4}
          tint="#3a2a12"
          tintOpacity={0.55}
          blur={8}
          textColor="#fffdf7"
          lineColor="#d4af62"
          baseColor="#8c6828"
          intensity={1.15}
          autoAnimate
          onClick={startFade}
        >
          Skip intro
        </SpecularButton>
      </div>
    </div>
  );
}
