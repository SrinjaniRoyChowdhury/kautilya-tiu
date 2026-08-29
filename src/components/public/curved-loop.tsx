"use client";

import {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useId,
  type FC,
  type PointerEvent,
} from "react";
import { cn } from "@/lib/format";
import { buildAnnouncementMarqueeText } from "@/lib/announcement-ribbon";

interface CurvedLoopProps {
  marqueeText?: string;
  /** Individual marquee segments; joined with the React Bits ✦ separator when set. */
  segments?: string[];
  speed?: number;
  className?: string;
  curveAmount?: number;
  direction?: "left" | "right";
  interactive?: boolean;
  fitContainer?: boolean;
}

/** Ribbon viewBox height matches --announcement-ribbon-height (2.75rem ≈ 44px). */
const RIBBON_VB_HEIGHT = 44;
const RIBBON_FONT_SIZE = 27;
/** Baseline below geometric centre so cap height aligns with the ribbon bar. */
const RIBBON_PATH_Y = 31;

export const CurvedLoop: FC<CurvedLoopProps> = ({
  marqueeText = "",
  segments,
  speed = 2,
  className,
  curveAmount = 400,
  direction = "left",
  interactive = true,
  fitContainer = false,
}) => {
  const resolvedMarqueeText = useMemo(() => {
    if (segments?.length) return buildAnnouncementMarqueeText(segments);
    return marqueeText;
  }, [segments, marqueeText]);

  const text = useMemo(() => {
    const hasTrailing = /\s|\u00A0$/.test(resolvedMarqueeText);
    return (hasTrailing ? resolvedMarqueeText.replace(/\s+$/, "") : resolvedMarqueeText) + "\u00A0";
  }, [resolvedMarqueeText]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<SVGTextElement | null>(null);
  const textPathRef = useRef<SVGTextPathElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [spacing, setSpacing] = useState(0);
  const [offset, setOffset] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1440);
  const uid = useId();
  const pathId = `curve-${uid}`;

  const pathD = fitContainer
    ? `M-100,${RIBBON_PATH_Y} Q${viewportWidth / 2},${RIBBON_PATH_Y + curveAmount} ${viewportWidth + 100},${RIBBON_PATH_Y}`
    : `M-100,40 Q500,${40 + curveAmount} 1540,40`;

  const dragRef = useRef(false);
  const lastXRef = useRef(0);
  const dirRef = useRef<"left" | "right">(direction);
  const velRef = useRef(0);

  const repeatSpan = fitContainer ? Math.max(viewportWidth * 2, 1800) : 1800;
  const textLength = spacing;
  const totalText = textLength
    ? Array(Math.ceil(repeatSpan / textLength) + 2)
        .fill(text)
        .join("")
    : text;
  const ready = spacing > 0;

  useLayoutEffect(() => {
    if (!fitContainer) return;
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const width = container.clientWidth;
      if (width > 0) setViewportWidth(width);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitContainer]);

  useEffect(() => {
    if (measureRef.current) setSpacing(measureRef.current.getComputedTextLength());
  }, [text, className, fitContainer, viewportWidth]);

  useEffect(() => {
    if (!spacing) return;
    if (textPathRef.current) {
      const initial = -spacing;
      textPathRef.current.setAttribute("startOffset", `${initial}px`);
      setOffset(initial);
    }
  }, [spacing]);

  useEffect(() => {
    if (!spacing || !ready) return;
    let frame = 0;
    const step = () => {
      if (!dragRef.current && textPathRef.current) {
        const delta = dirRef.current === "right" ? speed : -speed;
        const currentOffset = parseFloat(textPathRef.current.getAttribute("startOffset") || "0");
        let newOffset = currentOffset + delta;
        const wrapPoint = spacing;
        if (newOffset <= -wrapPoint) newOffset += wrapPoint;
        if (newOffset > 0) newOffset -= wrapPoint;
        textPathRef.current.setAttribute("startOffset", `${newOffset}px`);
        setOffset(newOffset);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [spacing, speed, ready]);

  const onPointerDown = (e: PointerEvent) => {
    if (!interactive) return;
    dragRef.current = true;
    lastXRef.current = e.clientX;
    velRef.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!interactive || !dragRef.current || !textPathRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    velRef.current = dx;
    const currentOffset = parseFloat(textPathRef.current.getAttribute("startOffset") || "0");
    let newOffset = currentOffset + dx;
    const wrapPoint = spacing;
    if (newOffset <= -wrapPoint) newOffset += wrapPoint;
    if (newOffset > 0) newOffset -= wrapPoint;
    textPathRef.current.setAttribute("startOffset", `${newOffset}px`);
    setOffset(newOffset);
  };

  const endDrag = () => {
    if (!interactive) return;
    dragRef.current = false;
    dirRef.current = velRef.current > 0 ? "right" : "left";
  };

  const cursorStyle = interactive ? "grab" : "auto";
  const ribbonTextProps = fitContainer
    ? {
        fontSize: RIBBON_FONT_SIZE,
        fontWeight: 500,
        letterSpacing: "0.04em",
      }
    : undefined;

  const passthroughPointer = fitContainer && !interactive;

  return (
    <div
      ref={fitContainer ? containerRef : undefined}
      className={cn(
        "w-full",
        fitContainer ? "h-full overflow-hidden" : "flex min-h-screen items-center justify-center",
        passthroughPointer && "pointer-events-none",
      )}
      style={{ visibility: ready ? "visible" : "hidden", cursor: cursorStyle }}
      {...(interactive
        ? {
            onPointerDown,
            onPointerMove,
            onPointerUp: endDrag,
            onPointerLeave: endDrag,
          }
        : {})}
    >
      <svg
        className={cn(
          "block w-full select-none",
          fitContainer ? "h-full overflow-hidden" : "aspect-[100/12] overflow-visible text-[6rem] font-bold uppercase leading-none",
          passthroughPointer && "pointer-events-none",
        )}
        viewBox={fitContainer ? `0 0 ${viewportWidth} ${RIBBON_VB_HEIGHT}` : "0 0 1440 120"}
        aria-hidden
      >
        <text
          ref={measureRef}
          xmlSpace="preserve"
          {...ribbonTextProps}
          className={className}
          style={{ visibility: "hidden", opacity: 0, pointerEvents: "none" }}
        >
          {text}
        </text>
        <defs>
          <path ref={pathRef} id={pathId} d={pathD} fill="none" stroke="transparent" />
        </defs>
        {ready ? (
          <text
            xmlSpace="preserve"
            {...ribbonTextProps}
            className={cn(fitContainer ? "fill-parchment-50" : "fill-white", className)}
          >
            <textPath ref={textPathRef} href={`#${pathId}`} startOffset={`${offset}px`} xmlSpace="preserve">
              {totalText}
            </textPath>
          </text>
        ) : null}
      </svg>
    </div>
  );
};

export default CurvedLoop;
