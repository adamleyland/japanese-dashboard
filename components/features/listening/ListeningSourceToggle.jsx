"use client";

import { Headphones, PlayCircle } from "lucide-react";
import { PillSliderToggle } from "@/components/dashboard/DictionaryCarousel";

export default function ListeningSourceToggle({ value, onChange, isCompact, isMobile = false }) {
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
          { value: "youtube", label: "YouTube", icon: PlayCircle, ariaLabel: "YouTube" },
          { value: "audiobooks", label: "Audiobooks", icon: Headphones, ariaLabel: "Audiobooks" },
        ]}
        width={isMobile ? 96 : isCompact ? 220 : 240}
        size="sm"
        iconOnly={isMobile}
      />
    </div>
  );
}
