"use client";

import { PillSliderToggle } from "@/components/dashboard/DictionaryCarousel";

export default function GamingSourceToggle({ value, onChange, isCompact }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCompact ? "flex-start" : "flex-end",
        flexShrink: 0,
      }}
    >
      <PillSliderToggle
        value={value}
        onChange={onChange}
        options={[
          { value: "all", label: "All" },
          { value: "steam", label: "Steam" },
          { value: "xbox", label: "Xbox" },
        ]}
        width={isCompact ? 220 : 260}
        size="sm"
      />
    </div>
  );
}
