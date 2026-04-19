"use client";

export default function StudyDistributionTooltip({ datum, position }) {
  if (!datum || !position) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, calc(-100% - 14px))",
        minWidth: "190px",
        maxWidth: "240px",
        padding: "12px 14px",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(12, 18, 30, 0.86)",
        color: "#f8fafc",
        boxShadow: "0 24px 50px rgba(2,6,23,0.38)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <span
          aria-hidden="true"
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "999px",
            background: datum.color,
            boxShadow: `0 0 0 5px ${datum.colorSoft}`,
            flexShrink: 0,
          }}
        />

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "#f8fafc",
            }}
          >
            {datum.label}
          </div>
          <div
            style={{
              marginTop: "2px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(226, 232, 240, 0.74)",
            }}
          >
            Rank #{datum.rank}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "10px",
        }}
      >
        <TooltipStat label="Total" value={datum.valueLabel} />
        <TooltipStat label="Share" value={datum.percentageLabel} />
        <TooltipStat label="Unit" value={datum.unitLabel} />
        <TooltipStat label="Scope" value="Tracked hours" />
      </div>
    </div>
  );
}

function TooltipStat({ label, value }) {
  return (
    <div style={{ display: "grid", gap: "3px" }}>
      <div
        style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(226, 232, 240, 0.56)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#f8fafc",
        }}
      >
        {value}
      </div>
    </div>
  );
}
