"use client";

const STAGES = [
  { day: 0, title: "Fresh soil", detail: "Complete a session to begin your garden." },
  { day: 1, title: "Battered pot", detail: "A small home for something new." },
  { day: 2, title: "Seed unlocked", detail: "Your seed is waiting beneath the soil." },
  { day: 3, title: "Watered", detail: "Keep returning to help it take root." },
  { day: 5, title: "First sprout", detail: "Something is breaking through." },
  { day: 7, title: "Young bonsai", detail: "Your first week is taking shape." },
];

export function getGardenStage(completedDays) {
  return STAGES.reduce((stage, candidate, index) => (completedDays >= candidate.day ? index : stage), 0);
}

export default function ShadowingGardenScene({ completedDays = 0, className = "" }) {
  const stage = getGardenStage(completedDays);
  const hasPot = stage >= 1;
  const hasSeed = stage >= 2;
  const hasSprout = stage >= 4;
  const hasLeaves = stage >= 5;
  const current = STAGES[stage];

  return <div className={className} aria-label={current.title}>
    <svg viewBox="0 0 260 180" role="img" aria-hidden="true" style={{ width: "100%", display: "block" }}>
      <ellipse cx="130" cy="151" rx="88" ry="15" fill="rgba(15,23,42,.12)" />
      {hasPot ? <path d="M76 101h108l-13 48H89z" fill="#b45309" stroke="#78350f" strokeWidth="4" /> : <ellipse cx="130" cy="130" rx="53" ry="24" fill="#7c4a2d" />}
      {hasPot ? <ellipse cx="130" cy="102" rx="54" ry="16" fill="#5b371f" /> : null}
      {hasSeed ? <ellipse cx="130" cy="99" rx="8" ry="11" fill="#fbbf24" className="garden-seed" /> : null}
      {hasSprout ? <path d="M130 99c0-26 5-40 1-56" fill="none" stroke="#3f7d35" strokeWidth="7" strokeLinecap="round" className="garden-stem" /> : null}
      {hasLeaves ? <><ellipse cx="115" cy="51" rx="20" ry="9" fill="#65a30d" className="garden-leaf-left" /><ellipse cx="146" cy="40" rx="21" ry="10" fill="#4d7c0f" className="garden-leaf-right" /></> : null}
      {stage === 3 ? <path d="M130 61v24" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" className="garden-water" /> : null}
    </svg>
    <strong>{current.title}</strong><span>{current.detail}</span>
  </div>;
}
