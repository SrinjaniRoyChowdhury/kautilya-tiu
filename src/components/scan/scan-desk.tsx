"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Zap,
  ZapOff,
  Upload,
  CheckCircle2,
  UtensilsCrossed,
  UserCheck,
  RefreshCw,
  AlertCircle,
  X,
  Sparkles,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatScanTime, QR_MESSAGES } from "@/lib/qr-http";
import type { MealSchedule } from "@/types";

type ScanPerson = {
  ok?: boolean;
  already?: boolean;
  code?: string;
  full_name?: string;
  committee_short_name?: string | null;
  committee_name?: string | null;
  food_preference?: string | null;
  display_code?: string;
  allocated_slr?: number | null;
  allocated_portfolio?: string | null;
  checked_in_at?: string | null;
  collected_at?: string | null;
  meal_name?: string | null;
  event_day?: number;
};

type Queued = {
  id: string;
  kind: "attendance" | "food";
  token: string;
  event_day?: number;
  meal_schedule_id?: string;
};

const QUEUE_KEY = "kautilya-scan-queue";
const COPY: Record<string, string> = {
  ...QR_MESSAGES,
  RATE_LIMITED: "Too many scans. Wait a minute.",
};

function loadQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Queued[];
  } catch {
    return [];
  }
}

function saveQueue(items: Queued[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ScanPerson;
  return { res, json };
}

export function ScanDesk({
  canAttendance,
  canFood,
  meals,
  defaultDay,
}: {
  canAttendance: boolean;
  canFood: boolean;
  meals: MealSchedule[];
  defaultDay: number;
}) {
  const [day, setDay] = useState(defaultDay);
  const [mealId, setMealId] = useState(
    meals.find((m) => m.event_day === defaultDay)?.id ?? meals[0]?.id ?? "",
  );
  const [currentToken, setCurrentToken] = useState("");
  const [result, setResult] = useState<ScanPerson | null>(null);
  const [pending, setPending] = useState(false);
  const [attending, setAttending] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLive, setCameraLive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [, startTransition] = useTransition();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number>(0);
  const pendingRef = useRef(false);
  const tokenRef = useRef("");
  const lastScanRef = useRef("");
  const cooldownRef = useRef(0);
  const lookupRef = useRef<(value: string) => Promise<void>>(async () => undefined);
  const flushQueueRef = useRef<() => Promise<void>>(async () => undefined);

  const dayMeals = meals.filter((meal) => meal.event_day === day);
  const selectedMeal = dayMeals.some((meal) => meal.id === mealId)
    ? mealId
    : (dayMeals[0]?.id ?? "");

  useEffect(() => {
    const video = videoRef.current;

    const boot = window.setTimeout(() => setQueue(loadQueue()), 0);
    const sync = () => void flushQueueRef.current();
    window.addEventListener("online", sync);

    return () => {
      window.clearTimeout(boot);
      window.removeEventListener("online", sync);
      if (timerRef.current) window.cancelAnimationFrame(timerRef.current);
      timerRef.current = 0;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, []);

  function enqueue(item: Omit<Queued, "id">) {
    const next = [...loadQueue(), { ...item, id: crypto.randomUUID() }];
    saveQueue(next);
    setQueue(next);
    setBanner("Queued offline. Will sync when connection returns.");
  }

  async function flushQueue() {
    if (!navigator.onLine) return;
    const items = loadQueue();
    if (!items.length) return;
    const remaining: Queued[] = [];
    for (const item of items) {
      try {
        const url = item.kind === "attendance" ? "/attendance/scan" : "/food/collect";
        const { res } = await postJson(url, {
          token: item.token,
          event_day: item.event_day,
          meal_schedule_id: item.meal_schedule_id,
        });
        if (res.status === 429 || res.status >= 500) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    saveQueue(remaining);
    setQueue(remaining);
    if (items.length && remaining.length < items.length) {
      setBanner(`Synced ${items.length - remaining.length} queued scan(s).`);
    }
  }

  useEffect(() => {
    flushQueueRef.current = flushQueue;
  });

  async function lookup(value: string) {
    const secret = value.trim();
    if (!secret || pendingRef.current) return;
    pendingRef.current = true;
    tokenRef.current = secret;
    setCurrentToken(secret);
    setPending(true);
    setResult(null);
    setBanner(null);

    // Haptic buzz on scan
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([40, 30, 40]);
      } catch {
        /* ignore */
      }
    }

    if (!navigator.onLine) {
      setPending(false);
      pendingRef.current = false;
      setBanner("Offline mode: You can still tap 1-Tap Check-in or Food to queue.");
      setResult({ ok: true, full_name: "Offline Scanned Delegate", display_code: "QUEUED" });
      return;
    }

    try {
      const { json } = await postJson("/scanner/validate", {
        token: secret,
        event_day: day,
        meal_schedule_id: selectedMeal || null,
      });
      setResult(json);
    } catch {
      setResult({ code: "QR_NOT_FOUND" });
    } finally {
      setPending(false);
      pendingRef.current = false;
    }
  }

  useEffect(() => {
    lookupRef.current = lookup;
  });

  // 1-Tap Attendance Check-in
  async function markAttendance() {
    const secret = tokenRef.current || currentToken;
    if (!secret || attending) return;
    setAttending(true);

    if (!navigator.onLine) {
      enqueue({ kind: "attendance", token: secret, event_day: day });
      setResult((prev) => (prev ? { ...prev, checked_in_at: new Date().toISOString() } : null));
      setAttending(false);
      return;
    }

    try {
      const { json } = await postJson("/attendance/scan", { token: secret, event_day: day });
      setResult((prev) => ({
        ...(prev ?? {}),
        ...json,
        checked_in_at: json.checked_in_at ?? new Date().toISOString(),
      }));
      setBanner("Attendance recorded successfully.");
    } catch {
      enqueue({ kind: "attendance", token: secret, event_day: day });
      setResult((prev) => (prev ? { ...prev, checked_in_at: new Date().toISOString() } : null));
    } finally {
      setAttending(false);
    }
  }

  // 1-Tap Food Collection
  async function markFood() {
    const secret = tokenRef.current || currentToken;
    if (!secret || !selectedMeal || collecting) return;
    setCollecting(true);

    if (!navigator.onLine) {
      enqueue({ kind: "food", token: secret, meal_schedule_id: selectedMeal });
      setResult((prev) => (prev ? { ...prev, collected_at: new Date().toISOString() } : null));
      setCollecting(false);
      return;
    }

    try {
      const { json } = await postJson("/food/collect", {
        token: secret,
        meal_schedule_id: selectedMeal,
      });
      setResult((prev) => ({
        ...(prev ?? {}),
        ...json,
        collected_at: json.collected_at ?? new Date().toISOString(),
      }));
      setBanner("Food delivery recorded successfully.");
    } catch {
      enqueue({ kind: "food", token: secret, meal_schedule_id: selectedMeal });
      setResult((prev) => (prev ? { ...prev, collected_at: new Date().toISOString() } : null));
    } finally {
      setCollecting(false);
    }
  }

  function acceptScan(value: string) {
    const now = Date.now();
    if (value === lastScanRef.current && now < cooldownRef.current) return;
    lastScanRef.current = value;
    cooldownRef.current = now + 2400;
    void lookupRef.current(value);
  }

  function decodePixels(pixels: ImageData): string | null {
    const code = jsQR(pixels.data, pixels.width, pixels.height, {
      inversionAttempts: "attemptBoth",
    });
    return code?.data ?? null;
  }

  function decodeFromVideo(video: HTMLVideoElement): string | null {
    const canvas = canvasRef.current;
    if (!canvas || video.videoWidth < 16 || video.videoHeight < 16) return null;
    const maxEdge = 640;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(32, Math.floor(video.videoWidth * scale));
    const height = Math.max(32, Math.floor(video.videoHeight * scale));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return decodePixels(ctx.getImageData(0, 0, width, height));
  }

  function stopTracks(stream: MediaStream | null) {
    stream?.getTracks().forEach((track) => track.stop());
  }

  function stopCamera() {
    if (timerRef.current) window.cancelAnimationFrame(timerRef.current);
    timerRef.current = 0;
    stopTracks(streamRef.current);
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setCameraLive(false);
    setTorchOn(false);
    setTorchSupported(false);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await (track as MediaStreamTrack & {
        applyConstraints: (c: unknown) => Promise<void>;
      }).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      setTorchSupported(false);
    }
  }

  function toggleCameraFlip() {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    if (cameraLive) {
      stopCamera();
      setTimeout(() => {
        startCamera(nextFacing);
      }, 100);
    }
  }

  async function attachCamera(stream: MediaStream) {
    const previous = streamRef.current;
    if (timerRef.current) window.cancelAnimationFrame(timerRef.current);
    timerRef.current = 0;
    stopTracks(previous);

    const video = videoRef.current;
    if (!video) {
      stopTracks(stream);
      setCameraError("Camera preview is not ready. Try again.");
      return;
    }

    streamRef.current = stream;
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute("playsinline", "true");

    const track = stream.getVideoTracks()[0];
    if (track && typeof (track as unknown as { getCapabilities?: () => Record<string, unknown> }).getCapabilities === "function") {
      const capabilities = (track as unknown as { getCapabilities: () => Record<string, unknown> }).getCapabilities();
      setTorchSupported(Boolean(capabilities?.torch));
    }

    try {
      await video.play();
    } catch (error) {
      setCameraError(
        `Preview blocked (${error instanceof Error ? error.message : "play failed"}). Tap Start Camera again.`,
      );
      return;
    }
    setCameraError(null);
    setCameraLive(true);

    const tick = () => {
      if (!streamRef.current) return;
      if (video.readyState >= 2 && !pendingRef.current) {
        const value = decodeFromVideo(video);
        if (value) acceptScan(value);
      }
      timerRef.current = window.requestAnimationFrame(tick);
    };
    timerRef.current = window.requestAnimationFrame(tick);
  }

  function startCamera(facing: "environment" | "user" = facingMode) {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setCameraError(`Camera requires HTTPS or localhost.`);
      return;
    }
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
      setCameraError("This browser has no camera support.");
      return;
    }

    setCameraError(null);
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    media
      .getUserMedia(constraints)
      .then((stream) => attachCamera(stream))
      .catch((error: unknown) => {
        const name = error instanceof DOMException ? error.name : "Error";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraError("Camera access denied. Please allow camera permissions in browser settings.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setCameraError("No camera found on this device.");
        } else {
          setCameraError(`Camera error: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
  }

  async function scanPhoto(file: File | undefined) {
    if (!file) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const bitmap = await createImageBitmap(file);
      const maxEdge = 1200;
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(32, Math.floor(bitmap.width * scale));
      const height = Math.max(32, Math.floor(bitmap.height * scale));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const value = decodePixels(ctx.getImageData(0, 0, width, height));
      if (!value) {
        setCameraError("No QR code detected in image.");
        return;
      }
      setCameraError(null);
      acceptScan(value);
    } catch {
      setCameraError("Could not read that image.");
    }
  }

  function resetCurrentScan() {
    setResult(null);
    setCurrentToken("");
    tokenRef.current = "";
    lastScanRef.current = "";
    setBanner(null);
  }

  const personOk = Boolean(result?.ok || result?.full_name);
  const failCode = result && !personOk ? result.code : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Top Controls Bar: Day Selection + Meal Selection + Quick Tools */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Day Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-700">Day</span>
            <div className="inline-flex rounded-sm bg-parchment-200/70 p-0.5">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    startTransition(() => {
                      setDay(d);
                      if (currentToken) {
                        void lookup(currentToken);
                      }
                    });
                  }}
                  className={`rounded-xs px-2.5 py-1 text-xs font-semibold transition-all ${
                    day === d
                      ? "bg-gold-700 text-parchment-50 shadow-xs"
                      : "text-ink hover:text-gold-700"
                  }`}
                >
                  Day {d}
                </button>
              ))}
            </div>
          </div>

          {/* Active Meal Selector for this day */}
          {canFood && dayMeals.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-gold-700">Meal</span>
              <select
                id="active-meal-select"
                aria-label="Active conference meal"
                value={selectedMeal}
                onChange={(e) => {
                  setMealId(e.target.value);
                  if (currentToken) {
                    void lookup(currentToken);
                  }
                }}
                className="h-8 rounded-sm border border-gold-700/30 bg-parchment-50 px-2 py-0.5 text-xs font-medium text-ink focus:border-gold-700 focus:outline-none"
              >
                {dayMeals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Camera & Tool Action Buttons */}
          <div className="flex items-center gap-1.5">
            {!cameraLive ? (
              <button
                type="button"
                onClick={() => startCamera()}
                className="inline-flex h-8 items-center gap-1 rounded-sm bg-gold-700 px-2.5 text-xs font-semibold text-parchment-50 hover:bg-[#74541f]"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Start Lens</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex h-8 items-center gap-1 rounded-sm border border-gold-700/30 bg-parchment-50 px-2 text-xs font-semibold text-gold-700 hover:bg-parchment-200"
              >
                <CameraOff className="h-3.5 w-3.5" />
                <span>Stop</span>
              </button>
            )}

            {cameraLive && (
              <button
                type="button"
                onClick={toggleCameraFlip}
                title="Flip Camera (Front/Back)"
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-gold-700/30 bg-parchment-50 text-gold-700 hover:bg-parchment-200"
              >
                <SwitchCamera className="h-3.5 w-3.5" />
              </button>
            )}

            {cameraLive && torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                title="Toggle Torch"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border transition-colors ${
                  torchOn
                    ? "border-amber-500 bg-amber-100 text-amber-900"
                    : "border-gold-700/30 bg-parchment-50 text-gold-700 hover:bg-parchment-200"
                }`}
              >
                {torchOn ? <Zap className="h-3.5 w-3.5" /> : <ZapOff className="h-3.5 w-3.5" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              title="Upload QR Image"
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-gold-700/30 bg-parchment-50 text-gold-700 hover:bg-parchment-200"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setManualOpen(!manualOpen)}
              title="Manual Token Input"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border transition-colors ${
                manualOpen
                  ? "border-gold-700 bg-gold-700 text-parchment-50"
                  : "border-gold-700/30 bg-parchment-50 text-gold-700 hover:bg-parchment-200"
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Hidden photo file input */}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void scanPhoto(file);
          }}
        />

        {/* Collapsible Manual Input (Emergency Fallback) */}
        {manualOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualInput.trim()) {
                void lookup(manualInput.trim());
                setManualInput("");
              }
            }}
            className="mt-2.5 flex items-center gap-2 border-t border-gold-700/15 pt-2.5"
          >
            <input
              type="text"
              placeholder="Paste 32-character token if camera fails…"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="h-8 flex-1 rounded-sm border border-gold-700/30 bg-parchment-50 px-2.5 text-xs text-ink focus:border-gold-700 focus:outline-none font-mono"
            />
            <button
              type="submit"
              className="h-8 rounded-sm bg-gold-700 px-3 text-xs font-semibold text-parchment-50"
            >
              Search
            </button>
          </form>
        )}
      </Card>

      {/* Banner / Sync Status */}
      {banner && (
        <div className="flex items-center justify-between rounded-sm bg-parchment-200 px-3 py-1.5 text-xs text-ink">
          <span>{banner}</span>
          <button type="button" onClick={() => setBanner(null)}>
            <X className="h-3.5 w-3.5 text-ink-muted hover:text-ink" />
          </button>
        </div>
      )}

      {cameraError && (
        <div className="flex items-center gap-2 rounded-sm bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Main Single-Screen Grid: Camera Viewfinder Lens + Unified Delegate Action Card */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Left Column / Top Viewfinder */}
        <Card className="flex flex-col overflow-hidden p-2.5 sm:p-3">
          <div className="relative aspect-[4/3] w-full max-h-[30vh] sm:max-h-[36vh] overflow-hidden rounded-sm bg-ink">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
              autoPlay
            />

            {/* Lens Reticle / Scanning Overlay */}
            {cameraLive ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {/* Golden corner brackets */}
                <div className="relative h-4/5 w-4/5 border border-gold-400/40 rounded-xs">
                  <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-gold-400" />
                  <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-gold-400" />
                  <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-gold-400" />
                  <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-gold-400" />
                  {/* Subtle animated scan beam */}
                  <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-transparent via-gold-400 to-transparent opacity-75 animate-pulse" />
                </div>
                <span className="absolute bottom-2 left-2 rounded-xs bg-ink/75 px-2 py-0.5 text-[10px] font-medium tracking-wide text-gold-400 backdrop-blur-xs">
                  READY
                </span>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                <Camera className="h-8 w-8 text-gold-400/60" />
                <p className="text-xs font-medium text-parchment-100">
                  Tap <span className="text-gold-400 font-bold">Start Lens</span> to scan
                </p>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="rounded-sm bg-gold-700 px-3 py-1.5 text-xs font-semibold text-parchment-50 shadow-xs hover:bg-[#74541f]"
                >
                  Start Camera
                </button>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

          {queue.length > 0 && (
            <div className="mt-2 flex items-center justify-between text-xs text-gold-700">
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {queue.length} scan{queue.length === 1 ? "" : "s"} waiting for connection
              </span>
              <button
                type="button"
                onClick={() => void flushQueue()}
                className="underline hover:text-ink"
              >
                Sync Now
              </button>
            </div>
          )}
        </Card>

        {/* Right Column / Unified Delegate Result & 1-Tap Actions */}
        <Card className="flex flex-col justify-between p-3.5 sm:p-4">
          {pending ? (
            <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 text-center">
              <RefreshCw className="h-7 w-7 animate-spin text-gold-700" />
              <p className="text-sm font-semibold text-ink">Decoding Badge…</p>
            </div>
          ) : personOk && result ? (
            <div className="flex h-full flex-col justify-between gap-3">
              {/* Delegate Header & Badges */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gold-700">
                      {result.display_code ?? "DELEGATE"}
                    </span>
                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink leading-tight">
                      {result.full_name}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={resetCurrentScan}
                    title="Scan Next"
                    className="inline-flex items-center gap-1 rounded-sm border border-gold-700/25 bg-parchment-50 px-2 py-1 text-[11px] font-medium text-gold-700 hover:bg-parchment-200"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Next</span>
                  </button>
                </div>

                {/* Badges strip */}
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {result.committee_short_name && (
                    <span className="rounded-xs bg-gold-700/15 px-2 py-0.5 font-semibold text-ink">
                      {result.committee_short_name}
                    </span>
                  )}
                  {result.allocated_portfolio && (
                    <span className="rounded-xs bg-parchment-200 px-2 py-0.5 font-medium text-ink">
                      {result.allocated_portfolio}
                      {result.allocated_slr ? ` (${result.allocated_slr})` : ""}
                    </span>
                  )}
                  {result.food_preference && (
                    <span
                      className={`rounded-xs px-2 py-0.5 font-bold ${
                        result.food_preference.toLowerCase().includes("non")
                          ? "bg-red-100 text-red-900"
                          : "bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      🍽️ {result.food_preference}
                    </span>
                  )}
                </div>
              </div>

              {/* 1-Tap Action Center */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {/* 1-Tap Attendance Check-In */}
                {canAttendance && (
                  <div className="flex flex-col justify-between rounded-sm border border-gold-700/20 bg-parchment-100/60 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-gold-700" />
                        Day {day} Attendance
                      </span>
                    </div>

                    {result.checked_in_at ? (
                      <div className="flex items-center gap-1.5 rounded-sm bg-emerald-100/80 px-2.5 py-2 text-xs font-bold text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                        <span>Checked In ({formatScanTime(result.checked_in_at)})</span>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => void markAttendance()}
                        disabled={attending}
                        className="w-full h-10 bg-gold-700 hover:bg-[#74541f] text-xs font-bold text-parchment-50 shadow-xs"
                      >
                        {attending ? "Marking…" : `✓ Mark Day ${day} Check-In`}
                      </Button>
                    )}
                  </div>
                )}

                {/* 1-Tap Food Delivery */}
                {canFood && (
                  <div className="flex flex-col justify-between rounded-sm border border-gold-700/20 bg-parchment-100/60 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1">
                        <UtensilsCrossed className="h-3.5 w-3.5 text-gold-700" />
                        Meal Delivery
                      </span>
                      {result.food_preference && (
                        <span className="text-[10px] font-bold text-gold-700">
                          {result.food_preference}
                        </span>
                      )}
                    </div>

                    {result.collected_at ? (
                      <div className="flex items-center gap-1.5 rounded-sm bg-emerald-100/80 px-2.5 py-2 text-xs font-bold text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                        <span>Food Delivered ({formatScanTime(result.collected_at)})</span>
                      </div>
                    ) : selectedMeal ? (
                      <Button
                        type="button"
                        onClick={() => void markFood()}
                        disabled={collecting}
                        className="w-full h-10 bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-parchment-50 shadow-xs"
                      >
                        {collecting ? "Marking…" : "🍱 Mark Food Delivered"}
                      </Button>
                    ) : (
                      <div className="rounded-sm bg-parchment-200/70 p-2 text-center text-xs text-ink-muted">
                        No meal selected
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : failCode ? (
            <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 text-center">
              <AlertCircle className="h-8 w-8 text-red-700" />
              <p className="text-xs font-bold uppercase tracking-wider text-red-800">Scan Failed</p>
              <p className="font-serif text-lg font-bold text-ink">{COPY[failCode] ?? failCode}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={resetCurrentScan}
                className="mt-2 text-xs"
              >
                Scan Next
              </Button>
            </div>
          ) : (
            <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 text-center p-4">
              <div className="rounded-full bg-gold-700/10 p-3 text-gold-700">
                <QrCode className="h-6 w-6" />
              </div>
              <p className="font-serif text-base font-semibold text-ink">Ready to Scan</p>
              <p className="text-xs text-ink-muted max-w-xs">
                Align the participant&apos;s badge QR in the camera lens. Single-tap check-in and food delivery will appear immediately.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
