"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import ReadingStatusBadge from "@/components/features/reading/components/ReadingStatusBadge";
import { READING_STATUS_OPTIONS } from "@/lib/reading/constants";

export default function ReadingStatusControl({
  bookId,
  status,
  onChange,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const resolvedOpen = open && !disabled;

  useEffect(() => {
    if (!resolvedOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [resolvedOpen]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setOpen((currentValue) => !currentValue);
          }
        }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={resolvedOpen}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          margin: 0,
          cursor: disabled ? "wait" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <ReadingStatusBadge status={status} />
        {disabled ? (
          <LoaderCircle
            size={14}
            style={{
              color: "var(--app-text-muted)",
            }}
          />
        ) : (
          <ChevronDown
            size={14}
            style={{
              color: "var(--app-text-muted)",
              transition: "transform 160ms ease",
              transform: resolvedOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        )}
      </button>

      {resolvedOpen ? (
        <div
          role="menu"
          aria-label="Update reading status"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: "164px",
            padding: "6px",
            borderRadius: "16px",
            border: "1px solid var(--app-border-soft)",
            background: "var(--app-surface-strong)",
            boxShadow: "0 18px 40px rgba(15,23,42,0.16)",
            zIndex: 20,
          }}
        >
          <div style={{ display: "grid", gap: "4px" }}>
            {READING_STATUS_OPTIONS.map((option) => {
              const isActive = option.key === status;

              return (
                <button
                  key={option.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={async () => {
                    if (option.key === status) {
                      setOpen(false);
                      return;
                    }

                    const result = await onChange?.(bookId, option.key);
                    if (result?.ok !== false) {
                      setOpen(false);
                    }
                  }}
                  style={{
                    border: "none",
                    background: isActive
                      ? "var(--app-selected-surface)"
                      : "transparent",
                    color: isActive
                      ? "var(--app-selected-text)"
                      : "var(--app-text)",
                    borderRadius: "12px",
                    padding: "10px 12px",
                    textAlign: "left",
                    fontSize: "12px",
                    fontWeight: isActive ? 800 : 700,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
