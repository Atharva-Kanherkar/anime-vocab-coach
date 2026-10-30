/** Small line icons for the course UI. They inherit color and are decorative unless labelled. */
import type { ReactNode } from "react";

export type IconName =
  | "check" | "cross" | "play" | "pause" | "loading" | "mic" | "stop" | "book" | "bolt" | "film" | "clipboard" | "chat"
  | "headphones" | "pencil" | "type" | "bulb" | "chevron" | "arrow-right" | "arrow-left" | "clock" | "layers"
  | "chevron-left" | "chevron-right" | "phone" | "phone-off" | "captions" | "keyboard" | "restart" | "home" | "list" | "wave";

const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M4 12.5l5 5L20 6.5" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none" />,
  loading: <path d="M12 4a8 8 0 1 0 8 8" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />,
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M8.5 13l2.5 2.5 4.5-5" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  headphones: <path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z" />,
  pencil: <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />,
  type: <path d="M4 18L9 6l5 12M5.8 14h6.4M15 18v-6.5a2.5 2.5 0 0 1 5 0V18M15 14.5h5" />,
  bulb: <path d="M9 18h6M10 21h4M8 14.5A6 6 0 1 1 16 14.5c-.8.7-1 1.5-1 2.5H9c0-1-.2-1.8-1-2.5z" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  "chevron-left": <path d="M15 6l-6 6 6 6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  phone: <path d="M6.6 3.5h2.6l1.4 4-2 1.4a12 12 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />,
  "phone-off": <path d="M3.5 13.2a12.5 12.5 0 0 1 17 0l-.3 2.6-3.6-.8-.6-2.6a9 9 0 0 0-8 0l-.6 2.6-3.6.8z" />,
  captions: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8" />
    </>
  ),
  restart: <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4.5V9h4.5" />,
  home: <path d="M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  wave: <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10.5v3M21 12h.01" />,
};

export function Icon({ name, size = 16, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className={`n5-icon${name === "loading" ? " n5-spin" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
