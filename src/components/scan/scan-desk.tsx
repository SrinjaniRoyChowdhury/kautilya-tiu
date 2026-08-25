"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { formatScanTime, QR_MESSAGES } from "@/lib/qr-http";
import type { MealSchedule } from "@/types";

type Mode = "lookup" | "attendance" | "food";

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
  checked_out_at?: string | null;
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
  const [mode, setMode] = useState<Mode>(canAttendance ? "attendance" : canFood ? "food" : "lookup");
  const [day, setDay] = useState(defaultDay);
  const [mealId, setMealId] = useState(meals.find((m) => m.event_day === defaultDay)?.id ?? meals[0]?.id ?? "");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ScanPerson | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLive, setCameraLive] = useState(false);
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
    setBanner("Queued. Will sync when this desk is back online.");
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

  async function markAttendance(secret: string) {
    if (!navigator.onLine) {
      enqueue({ kind: "attendance", token: secret, event_day: day });
      return;
    }
    try {
      const { json } = await postJson("/attendance/scan", { token: secret, event_day: day });
      setResult(json);
    } catch {
      enqueue({ kind: "attendance", token: secret, event_day: day });
    }
  }

  async function lookup(value: string) {
    const secret = value.trim();
    if (!secret || pendingRef.current) return;
    if (!navigator.onLine) {
      if (mode === "attendance" && canAttendance) {
        enqueue({ kind: "attendance", token: secret, event_day: day });
        return;
      }
      setBanner("Offline. Connect to look up a credential.");
      return;
    }
    pendingRef.current = true;
    tokenRef.current = secret;
    setPending(true);
    setResult(null);
    setBanner(null);
    try {
      const { json } = await postJson("/scanner/validate", {
        token: secret,
        event_day: day,
        meal_schedule_id: mode === "food" ? selectedMeal : null,
      });
      setResult(json);
      if (json.ok && mode === "attendance" && canAttendance) {
        await markAttendance(secret);
      }
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

  async function checkout() {
    const secret = tokenRef.current || token;
    if (!secret) return;
    const { json } = await postJson("/attendance/checkout", { token: secret, event_day: day });
    setResult(json);
  }

  async function collect() {
    const secret = tokenRef.current || token;
    if (!secret || !selectedMeal) return;
    if (!navigator.onLine) {
      enqueue({ kind: "food", token: secret, meal_schedule_id: selectedMeal });
      return;
    }
    try {
      const { json } = await postJson("/food/collect", { token: secret, meal_schedule_id: selectedMeal });
      setResult(json);
    } catch {
      enqueue({ kind: "food", token: secret, meal_schedule_id: selectedMeal });
    }
  }

  function acceptScan(value: string) {
    const now = Date.now();
    if (value === lastScanRef.current && now < cooldownRef.current) return;
    lastScanRef.current = value;
    cooldownRef.current = now + 2800;
    setToken(value);
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
  }

  function cameraPolicyAllows(): boolean | null {
    const policy =
      "permissionsPolicy" in document
        ? (
            document as Document & {
              permissionsPolicy?: { allowsFeature: (name: string) => boolean };
            }
          ).permissionsPolicy
        : undefined;
    const legacy =
      "featurePolicy" in document
        ? (
            document as Document & {
              featurePolicy?: { allowsFeature: (name: string) => boolean };
            }
          ).featurePolicy
        : undefined;
    if (policy?.allowsFeature) return policy.allowsFeature("camera");
    if (legacy?.allowsFeature) return legacy.allowsFeature("camera");
    return null;
  }

  async function attachCamera(stream: MediaStream) {
    const previous = streamRef.current;
    if (timerRef.current) window.cancelAnimationFrame(timerRef.current);
    timerRef.current = 0;
    stopTracks(previous);

    const video = videoRef.current;
    if (!video) {
      stopTracks(stream);
      setCameraError("Camera preview is not on the page. Refresh and try again.");
      return;
    }

    streamRef.current = stream;
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute("playsinline", "true");
    try {
      await video.play();
    } catch (error) {
      setCameraError(
        `Preview blocked after permission (${error instanceof Error ? error.message : "play failed"}). Click Use laptop camera again.`,
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

  function startCamera() {
    if (typeof window === "undefined") return;
    try {
      if (window.top !== window.self) {
        setCameraError(
          "Camera cannot run in an embedded preview. Open http://localhost:3000/scan in a full Chrome or Edge tab.",
        );
        return;
      }
    } catch {
      setCameraError(
        "Camera cannot run in an embedded preview. Open http://localhost:3000/scan in a full Chrome or Edge tab.",
      );
      return;
    }
    if (!window.isSecureContext) {
      setCameraError(`Camera needs http://localhost:3000 (now: ${window.location.origin}).`);
      return;
    }
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
      setCameraError("This browser has no camera API. Use Chrome or Edge on http://localhost:3000.");
      return;
    }
    setCameraError("Look at the address bar — Chrome/Edge puts Allow next to the lock, not in a page popup.");
    const pending = media.getUserMedia({ audio: false, video: true });
    void pending
      .then((stream) => attachCamera(stream))
      .catch(async (error: unknown) => {
        const name = error instanceof DOMException ? error.name : "Error";
        const detail = error instanceof Error ? error.message : String(error);
        let permission: PermissionState | "unknown" = "unknown";
        try {
          const status = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          permission = status.state;
        } catch {
          /* Chrome may not expose camera in Permissions API */
        }
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          if (cameraPolicyAllows() === false) {
            setCameraError(
              "This page’s camera policy is blocking access. Hard-refresh (Ctrl+Shift+R) after the app restart, then try again.",
            );
            return;
          }
          if (permission === "denied") {
            setCameraError(
              "Camera is blocked for this site. Address bar → lock icon → Site settings → Camera → Allow. Then reload. Also check Windows Settings → Privacy & security → Camera → Let desktop apps access your camera.",
            );
            return;
          }
          setCameraError(
            "Chrome did not show a page popup. Click the camera/lock icon in the address bar and choose Allow. If it is already Block, change it to Allow and reload.",
          );
          return;
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setCameraError("Windows did not expose a webcam. Close other apps using it, then try again.");
          return;
        }
        setCameraError(`Camera failed (${name}): ${detail}`);
      });
  }

  async function scanPhoto(file: File | undefined) {
    if (!file) return;
    const canvas = canvasRef.current;
    if (!canvas) {
      setCameraError("Scanner canvas is missing. Refresh and try again.");
      return;
    }
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
        setCameraError("No QR found in that photo. Use a sharp, full-screen capture of the credential.");
        return;
      }
      setCameraError(null);
      acceptScan(value);
    } catch {
      setCameraError("Could not read that image. Try a PNG or JPEG of the QR.");
    }
  }

  const personOk = Boolean(result?.ok || result?.full_name);
  const failCode = result && !personOk ? result.code : null;
  const alreadyIn = result?.already && result.code === "ALREADY_CHECKED_IN";
  const alreadyFood = result?.already && result.code === "ALREADY_COLLECTED";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["lookup", "Lookup"],
              ...(canAttendance ? [["attendance", "Attendance"] as const] : []),
              ...(canFood ? [["food", "Food"] as const] : []),
            ] as Array<[Mode, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={
                mode === id
                  ? "rounded-sm bg-gold-700 px-3 py-1.5 text-sm text-parchment-50"
                  : "rounded-sm border border-gold-700/25 px-3 py-1.5 text-sm text-gold-700"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void lookup(token);
          }}
        >
          <Field label="Conference day" htmlFor="event_day">
            <Select id="event_day" value={String(day)} onChange={(event) => setDay(Number(event.target.value))}>
              <option value="1">Day 1</option>
              <option value="2">Day 2</option>
              <option value="3">Day 3</option>
            </Select>
          </Field>
          {mode === "food" ? (
            <Field label="Meal at this desk" htmlFor="meal" hint="Confirm the meal before marking collected.">
              <Select id="meal" value={selectedMeal} onChange={(event) => setMealId(event.target.value)}>
                {dayMeals.map((meal) => (
                  <option key={meal.id} value={meal.id}>
                    {meal.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field
            label="QR secret"
            htmlFor="token"
            hint="Paste the scanned payload. The short MUN26- code will not match."
          >
            <Input
              id="token"
              name="token"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Working…" : mode === "attendance" ? "Scan in" : "Look up"}
            </Button>
          </div>
        </form>
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={startCamera}>
              Use laptop camera
            </Button>
            <Button type="button" variant="ghost" onClick={() => photoRef.current?.click()}>
              Scan from photo
            </Button>
            <Button type="button" variant="ghost" onClick={stopCamera}>
              Stop camera
            </Button>
          </div>
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
          {cameraError ? (
            <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="status">
              {cameraError}
            </p>
          ) : null}
          {queue.length ? (
            <p className="text-sm text-gold-700" role="status">
              {queue.length} record{queue.length === 1 ? "" : "s"} pending sync.
            </p>
          ) : null}
          <div className="relative overflow-hidden rounded-sm border border-gold-700/20 bg-ink">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              muted
              playsInline
              autoPlay
            />
            {!cameraLive ? (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-parchment-50">
                Camera preview appears here after you allow access
              </p>
            ) : null}
          </div>
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          <p className="text-xs text-ink-muted">
            Open this desk in a full Chrome or Edge tab at http://localhost:3000/scan. After
            Use laptop camera, look at the address bar (lock or camera icon) for Allow — Chrome
            does not show a window in the middle of the page. Scan from photo works without the
            webcam.
          </p>
        </div>
      </Card>
      <Card>
        {banner ? (
          <p className="mb-4 rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
            {banner}
          </p>
        ) : null}
        {personOk ? (
          <div>
            <p className="text-xs uppercase tracking-widest text-gold-700">
              {alreadyIn
                ? `Already checked in at ${formatScanTime(result?.checked_in_at)}`
                : alreadyFood
                  ? `Already collected at ${formatScanTime(result?.collected_at)}`
                  : result?.checked_in_at && mode === "attendance"
                    ? `Checked in at ${formatScanTime(result.checked_in_at)}`
                    : result?.collected_at && mode === "food"
                      ? `Collected at ${formatScanTime(result.collected_at)}`
                      : "Confirmed"}
            </p>
            <p className="mt-2 font-serif text-3xl">{result?.full_name}</p>
            <p className="mt-2 text-sm">
              {result?.committee_short_name ?? "—"}
              {result?.committee_name ? ` · ${result.committee_name}` : ""}
            </p>
            {result?.allocated_portfolio ? (
              <p className="mt-1 text-sm">
                Delegation{result.allocated_slr ? ` ${result.allocated_slr}` : ""}: {result.allocated_portfolio}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">Delegation not allocated yet</p>
            )}
            <p className="mt-1 text-sm text-ink-muted">
              Food: {result?.food_preference ?? "unspecified"} · {result?.display_code}
            </p>
            {mode === "food" && canFood && !result?.collected_at ? (
              <Button className="mt-4" type="button" onClick={() => void collect()}>
                Mark as collected
              </Button>
            ) : null}
            {mode === "attendance" && canAttendance && result?.checked_in_at && !result?.checked_out_at ? (
              <Button className="mt-4" type="button" variant="secondary" onClick={() => void checkout()}>
                Check out
              </Button>
            ) : null}
            {result?.checked_out_at ? (
              <p className="mt-3 text-sm text-ink-muted">Out at {formatScanTime(result.checked_out_at)}</p>
            ) : null}
          </div>
        ) : failCode ? (
          <div>
            <p className="text-xs uppercase tracking-widest text-red-800">Lookup failed</p>
            <p className="mt-2 font-serif text-3xl">{COPY[failCode] ?? failCode}</p>
          </div>
        ) : (
          <p className="text-ink-muted">
            {mode === "attendance"
              ? "Scan to check in for this day. A repeat scan shows the original time."
              : mode === "food"
                ? "Scan first, confirm the meal, then mark collected."
                : "Scan a credential to see name, committee, and food preference."}
          </p>
        )}
      </Card>
    </div>
  );
}
