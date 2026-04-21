"use client";

export function SteamGlyph({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="15.5" r="3" stroke={color} strokeWidth="1.8" />
      <circle cx="16.5" cy="7.5" r="3" stroke={color} strokeWidth="1.8" />
      <path
        d="M11 14.2l3.7-3.7"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.2 13.4L3.8 12"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="7.5" r="6" stroke={color} strokeWidth="1.4" opacity="0.55" />
    </svg>
  );
}

export function XboxGlyph({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path
        d="M7.2 8.6c1.3-.8 2.8-1.3 4.8 1 2-2.3 3.5-1.8 4.8-1"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.4 16.4c1.2-2 2.4-3.5 3.6-4.9 1.2 1.4 2.4 2.9 3.6 4.9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
