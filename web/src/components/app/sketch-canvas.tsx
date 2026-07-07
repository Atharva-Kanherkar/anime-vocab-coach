"use client";

// A tiny sketch pad for the Manga Studio "draw it yourself" path. Strokes are
// rendered with perfect-freehand (nice pressure-tapered ink), painted onto a
// white canvas so the exported PNG is a clean drawing the AI image-edit endpoint
// can redraw into a polished panel. Bad drawers welcome — the AI does the rest.

import { getStroke } from "perfect-freehand";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export interface SketchHandle {
  /** PNG data URL of the current drawing, or null if nothing was drawn. */
  toDataUrl: () => string | null;
  isEmpty: () => boolean;
}

type Point = [number, number, number]; // x, y, pressure
interface Stroke {
  color: string;
  size: number;
  points: Point[];
}

const RES = 768; // internal canvas resolution (square, matches a panel)
const COLORS = ["#111111", "#e0503f", "#2f6bd8", "#2fa36b", "#f4c04a"];
const ERASER = "#ffffff";
const SIZES = [6, 12, 22];

/** perfect-freehand outline → a filled Path2D. */
function strokePath(points: Point[], size: number): Path2D {
  const outline = getStroke(points, {
    size,
    thinning: 0.55,
    smoothing: 0.5,
    streamline: 0.5,
  }) as number[][];
  const path = new Path2D();
  if (outline.length === 0) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) path.lineTo(outline[i][0], outline[i][1]);
  path.closePath();
  return path;
}

export const SketchCanvas = forwardRef<SketchHandle, { className?: string }>(
  function SketchCanvas({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const drawing = useRef<Stroke | null>(null);
    const [color, setColor] = useState(COLORS[0]);
    const [size, setSize] = useState(SIZES[1]);
    const [erasing, setErasing] = useState(false);

    const paint = useCallback((all: Stroke[], live: Stroke | null) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, RES, RES);
      const render = (s: Stroke) => {
        if (s.points.length === 0) return;
        ctx.fillStyle = s.color;
        ctx.fill(strokePath(s.points, s.size));
      };
      all.forEach(render);
      if (live) render(live);
    }, []);

    const toCanvasPoint = useCallback((e: React.PointerEvent): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * RES;
      const y = ((e.clientY - rect.top) / rect.height) * RES;
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      return [x, y, pressure];
    }, []);

    const onPointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drawing.current = {
          color: erasing ? ERASER : color,
          size: erasing ? size * 2.2 : size,
          points: [toCanvasPoint(e)],
        };
        paint(strokes, drawing.current);
      },
      [color, erasing, size, strokes, paint, toCanvasPoint]
    );

    const onPointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!drawing.current) return;
        e.preventDefault();
        drawing.current.points.push(toCanvasPoint(e));
        paint(strokes, drawing.current);
      },
      [strokes, paint, toCanvasPoint]
    );

    const endStroke = useCallback(() => {
      if (!drawing.current) return;
      const finished = drawing.current;
      drawing.current = null;
      setStrokes((cur) => [...cur, finished]);
    }, []);

    const undo = useCallback(() => {
      setStrokes((cur) => {
        const next = cur.slice(0, -1);
        paint(next, null);
        return next;
      });
    }, [paint]);

    const clear = useCallback(() => {
      drawing.current = null;
      setStrokes([]);
      paint([], null);
    }, [paint]);

    useImperativeHandle(
      ref,
      () => ({
        toDataUrl: () => (strokes.length === 0 ? null : canvasRef.current?.toDataURL("image/png") ?? null),
        isEmpty: () => strokes.length === 0,
      }),
      [strokes]
    );

    const swatches = useMemo(() => COLORS, []);

    return (
      <div className={className}>
        <div className="flex flex-wrap items-center gap-2">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Pen color ${c}`}
              aria-pressed={!erasing && color === c}
              onClick={() => {
                setErasing(false);
                setColor(c);
              }}
              className={
                "h-7 w-7 rounded-full border-2 transition " +
                (!erasing && color === c ? "border-ink scale-110" : "border-line")
              }
              style={{ background: c }}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {SIZES.map((s, i) => (
            <button
              key={s}
              type="button"
              aria-label={`Pen size ${i + 1}`}
              aria-pressed={size === s}
              onClick={() => setSize(s)}
              className={
                "grid h-7 w-7 place-items-center rounded-full border-2 transition " +
                (size === s ? "border-ink" : "border-line")
              }
            >
              <span className="rounded-full bg-ink" style={{ height: 3 + i * 4, width: 3 + i * 4 }} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <button
            type="button"
            aria-pressed={erasing}
            onClick={() => setErasing((v) => !v)}
            className={
              "rounded-full border-2 px-3 py-1 text-[12px] font-extrabold transition " +
              (erasing ? "border-ink bg-ink text-bg" : "border-line text-ink2 hover:text-ink")
            }
          >
            Eraser
          </button>
          <button type="button" onClick={undo} className="rounded-full border-2 border-line px-3 py-1 text-[12px] font-extrabold text-ink2 hover:text-ink">
            Undo
          </button>
          <button type="button" onClick={clear} className="rounded-full border-2 border-line px-3 py-1 text-[12px] font-extrabold text-ink2 hover:text-ink">
            Clear
          </button>
        </div>

        <canvas
          ref={(el) => {
            canvasRef.current = el;
            if (el && el.width !== RES) {
              el.width = RES;
              el.height = RES;
              paint(strokes, null);
            }
          }}
          width={RES}
          height={RES}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
          className="mt-3 aspect-square w-full touch-none rounded-lg border-2 border-ink bg-white"
        />
      </div>
    );
  }
);
