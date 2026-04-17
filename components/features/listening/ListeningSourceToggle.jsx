"use client";

import { PillSliderToggle } from "@/components/dashboard/DictionaryCarousel";

export default function ListeningSourceToggle({ value, onChange, isCompact }) {
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
          { value: "youtube", label: "YouTube" },
          { value: "audiobooks", label: "Audiobooks" },
        ]}
        width={isCompact ? 220 : 240}
        size="sm"
      />
    </div>
  );
}
