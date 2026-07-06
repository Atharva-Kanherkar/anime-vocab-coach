import type { SVGProps } from "react";

// Minimal monochrome line icons. Stroke uses currentColor so they inherit the
// theme. 1.6px stroke, 20px grid. No fills, no emoji.
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function IconOverview(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M4 13h6V4H4zM14 20h6V4h-6zM4 20h6v-3H4z" />
    </svg>
  );
}

export function IconCoach(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M4 5h16v10H9l-4 3z" />
    </svg>
  );
}

export function IconNotebook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M6 4h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6zM6 4v16M9 8h6M9 12h6" />
    </svg>
  );
}

export function IconProgress(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-7" />
    </svg>
  );
}

export function IconBackup(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a3.5 3.5 0 0 1 .5 6.98M12 12v6m0-6l-2.2 2.2M12 12l2.2 2.2" />
    </svg>
  );
}

export function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

export function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z" />
    </svg>
  );
}
