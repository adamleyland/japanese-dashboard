"use client";

import { useEffect, useRef, useState } from "react";
import {
  Ear,
  BookA,
  Search,
  Plus,
  X,
  Volume2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const CAROUSEL_INTERVAL = 15000;

export function PillSliderToggle({ value, options, onChange, width = 110, size = "md" }) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const inset = 4;
  const toggleHeight = size === "sm" ? 38 : 44;

  return (
    <div style={styles.pillToggleBase(width, toggleHeight, inset)}>
      <div style={styles.pillToggleSlider(activeIndex, options.length, inset)} />
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={styles.pillToggleButton(option.value === value, toggleHeight)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressRing({
  radius,
  stroke,
  progress,
  color = "#ef4444",
  trackColor = "rgba(15, 23, 42, 0.05)",
  style,
}) {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg height={radius * 2} width={radius * 2} style={styles.progressRing}>
      <circle
        stroke={trackColor}
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke={color}
        fill="transparent"
        strokeWidth={stroke}
        strokeDasharray={`${circumference} ${circumference}`}
        style={{ strokeDashoffset, ...style }}
        strokeLinecap="round"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
    </svg>
  );
}

export const Tag = ({ label, tone }) => {
  const colors =
    {
      green: {
        bg: "rgba(220, 252, 231, 0.7)",
        border: "rgba(134, 239, 172, 0.38)",
        text: "#166534",
      },
      blue: {
        bg: "rgba(219, 234, 254, 0.72)",
        border: "rgba(125, 211, 252, 0.38)",
        text: "#1d4ed8",
      },
      purple: {
        bg: "rgba(243, 232, 255, 0.7)",
        border: "rgba(216, 180, 254, 0.38)",
        text: "#6b21a8",
      },
      orange: {
        bg: "rgba(255, 237, 213, 0.7)",
        border: "rgba(253, 186, 116, 0.38)",
        text: "#9a3412",
      },
      cyan: {
        bg: "rgba(207, 250, 254, 0.7)",
        border: "rgba(103, 232, 249, 0.38)",
        text: "#0e7490",
      },
      red: {
        bg: "rgba(254, 226, 226, 0.7)",
        border: "rgba(252, 165, 165, 0.38)",
        text: "#991b1b",
      },
    }[tone] || {
      bg: "rgba(241, 245, 249, 0.7)",
      border: "rgba(203, 213, 225, 0.38)",
      text: "#475569",
    };

  return (
    <span
      style={{
        ...styles.tagBase,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
    >
      {label}
    </span>
  );
};

export default function DictionaryCarousel({ styles }) {
  const [mode, setMode] = useState("carousel");
  const [carouselEntries, setCarouselEntries] = useState([]);
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [dictionaryInputMode, setDictionaryInputMode] = useState("ja");
  const [dictionaryValue, setDictionaryValue] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(0);

  const playAudio = (url) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch((e) => console.error("Audio error:", e));
  };

  const fetchCarousel = async () => {
    const { data } = await supabase
      .from("user_carousel")
      .select(`
        id,
        words (
          id,
          term,
          reading,
          meaning,
          pos,
          tags,
          audio_url,
          jlpt_level,
          examples (
            sentence_ja,
            sentence_en,
            highlight_ja,
            highlight_en,
            sentence_audio_url
          )
        )
      `)
      .order("added_at", { ascending: false });

    if (data) {
      const formatted = data.map((item) => ({ carousel_id: item.id, ...item.words }));
      setCarouselEntries(formatted);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCarousel();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (!dictionaryValue.trim()) {
        setSearchResults([]);
        return;
      }

      let query = supabase.from("words").select("*, examples (*)");

      if (dictionaryInputMode === "ja") {
        query = query.or(
          `term.ilike.%${dictionaryValue}%,reading.ilike.%${dictionaryValue}%,kanji.ilike.%${dictionaryValue}%`,
        );
      } else {
        query = query.ilike("meaning", `%${dictionaryValue}%`);
      }

      const { data } = await query.order("is_common", { ascending: false }).limit(30);

      const ranked = (data || [])
        .map((entry) => ({
          entry,
          score: scoreDictionaryEntry(entry, dictionaryValue, dictionaryInputMode),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if ((b.entry.is_common ? 1 : 0) !== (a.entry.is_common ? 1 : 0)) {
            return (b.entry.is_common ? 1 : 0) - (a.entry.is_common ? 1 : 0);
          }
          return a.entry.term.localeCompare(b.entry.term, undefined, { sensitivity: "base" });
        })
        .slice(0, 10)
        .map(({ entry }) => entry);

      setSearchResults(ranked);
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [dictionaryValue, dictionaryInputMode]);

  const toggleCarousel = async (word) => {
    const existing = carouselEntries.find((e) => e.id === word.id);

    if (existing) {
      await supabase.from("user_carousel").delete().eq("id", existing.carousel_id);
    } else {
      await supabase.from("user_carousel").insert([{ word_id: word.id }]);
    }

    fetchCarousel();
  };

  useEffect(() => {
    if (mode !== "carousel" || carouselEntries.length === 0) {
      return;
    }

    startTimeRef.current = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;

      if (elapsed >= CAROUSEL_INTERVAL) {
        setActiveWordIndex((p) => (p + 1) % carouselEntries.length);
        startTimeRef.current = Date.now();
        setProgress(0);
      } else {
        setProgress((elapsed / CAROUSEL_INTERVAL) * 100);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [mode, carouselEntries.length]);

  const activeEntry = carouselEntries[activeWordIndex] || null;
  const activeExamples =
    activeEntry?.examples?.filter((ex) => ex?.sentence_ja || ex?.sentence_en).slice(0, 2) || [];

  const rotateCarousel = (direction = 1) => {
    if (!carouselEntries.length) return;
    setActiveWordIndex(
      (prev) => (prev + direction + carouselEntries.length) % carouselEntries.length,
    );
    startTimeRef.current = Date.now();
    setProgress(0);
  };

  const markKnown = async () => {
    if (!activeEntry?.carousel_id) return;
    await supabase.from("user_carousel").delete().eq("id", activeEntry.carousel_id);
    await supabase
      .from("mastered_words")
      .upsert({ word_id: activeEntry.id }, { onConflict: "word_id", ignoreDuplicates: true });
    fetchCarousel();
    setActiveWordIndex(0);
  };

  const highlightSentence = (sentence, target) => {
    if (!target || !sentence.includes(target)) return sentence;
    const index = sentence.indexOf(target);

    return (
      <>
        {sentence.substring(0, index)}
        <span style={styles.textHighlight}>
          {sentence.substring(index, index + target.length)}
        </span>
        {sentence.substring(index + target.length)}
      </>
    );
  };

  return (
    <div style={styles.wordCard}>
      <div style={styles.wordCardHeader}>
        <div style={styles.eyebrow}>{mode === "carousel" ? "Word Carousel" : "Dictionary"}</div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {mode === "carousel" ? (
            activeEntry && (
              <div style={styles.progressContainer}>
                <ProgressRing radius={14} stroke={2} progress={progress} />
                <span style={styles.progressSeconds}>
                  {Math.ceil((CAROUSEL_INTERVAL - (progress / 100) * CAROUSEL_INTERVAL) / 1000)}
                </span>
              </div>
            )
          ) : (
            <div style={styles.progressContainer}>
              <div style={styles.dictionaryIconFootprint}>
                <BookA size={14} color="#fff" strokeWidth={2.5} />
              </div>
            </div>
          )}

          <PillSliderToggle
            value={mode}
            options={[
              { value: "carousel", label: "Carousel" },
              { value: "dictionary", label: "Dictionary" },
            ]}
            onChange={setMode}
            width={190}
            size="sm"
          />
        </div>
      </div>

      {mode === "carousel" ? (
        <div style={styles.wordCarouselBody}>
          {activeEntry ? (
            <>
              <div style={styles.carouselTopSection}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={styles.wordMain}>{activeEntry.term}</div>
                  {activeEntry.audio_url && (
                    <button
                      onClick={() => playAudio(activeEntry.audio_url)}
                      style={styles.audioActionBtn}
                    >
                      <Volume2 size={24} color="#6366f1" />
                    </button>
                  )}
                </div>

                <div style={styles.wordReading}>{activeEntry.reading}</div>
                <div style={styles.wordMeaning}>{activeEntry.meaning}</div>

                <div style={styles.metadataRow}>
                  {activeEntry.jlpt_level && <Tag label={activeEntry.jlpt_level} tone="red" />}
                  {activeEntry.pos && <Tag label={activeEntry.pos} tone="cyan" />}
                  {activeEntry.tags
                    ?.filter(
                      (t) =>
                        !["step", "audio", "part", "core"].some((bad) =>
                          t.label.toLowerCase().includes(bad),
                        ),
                    )
                    .map((tag, i) => (
                      <Tag key={i} label={tag.label} tone={tag.tone} />
                    ))}
                </div>
              </div>

              <div style={styles.contextSectionBox}>
                {activeExamples.length > 0 ? (
                  <>
                    <div style={styles.wordSentenceLabel}>Context examples</div>

                    <div style={styles.contextExamplesList}>
                      {activeExamples.map((ex, i) => (
                        <div key={i} style={styles.contextExampleItem}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "8px",
                            }}
                          >
                            {ex.sentence_ja && (
                              <div style={styles.wordSentence}>
                                {highlightSentence(ex.sentence_ja, ex.highlight_ja)}
                              </div>
                            )}

                            {ex.sentence_audio_url && (
                              <button
                                onClick={() => playAudio(ex.sentence_audio_url)}
                                style={styles.miniAudioBtn}
                              >
                                <Ear size={14} color="#64748b" />
                              </button>
                            )}
                          </div>

                          {ex.sentence_en && (
                            <div style={styles.wordSentenceTranslation}>{ex.sentence_en}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={styles.dictionaryPlaceholder}>No example sentence available.</div>
                )}
              </div>

              <div style={styles.carouselActionRow}>
                <button onClick={() => rotateCarousel(-1)} style={styles.secondaryAction}>
                  <ChevronLeft size={14} /> Previous
                </button>
                <button onClick={() => rotateCarousel(1)} style={styles.secondaryAction}>
                  Next <ChevronRight size={14} />
                </button>
                <button onClick={markKnown} style={styles.masteredAction}>
                  <CheckCircle2 size={14} /> Known
                </button>
              </div>
            </>
          ) : (
            <div style={styles.dictionaryPlaceholder}>Add words from the dictionary to start!</div>
          )}
        </div>
      ) : (
        <div style={styles.dictionaryBody}>
          <div style={styles.dictionaryControls}>
            <PillSliderToggle
              value={dictionaryInputMode}
              options={[
                { value: "ja", label: "あ" },
                { value: "en", label: "A" },
              ]}
              onChange={(n) => {
                setDictionaryInputMode(n);
                setDictionaryValue("");
              }}
              width={90}
              size="sm"
            />

            <label style={styles.dictionaryInputWrapTight}>
              <Search size={16} color="#64748b" />
              <input
                value={dictionaryValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setDictionaryValue(
                    dictionaryInputMode === "ja" ? convertRomajiToKanaForSearch(v) : v,
                  );
                }}
                placeholder="Search database..."
                style={styles.dictionaryInput}
              />
              {dictionaryValue && (
                <button onClick={() => setDictionaryValue("")} style={styles.clearSearchBtn}>
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          <div style={styles.dictionaryResultsArea}>
            {!dictionaryValue.trim() ? (
              <div style={styles.dictionaryPlaceholder}>Search for a word.</div>
            ) : searchResults.length === 0 ? (
              <div style={styles.dictionaryPlaceholder}>No matches found.</div>
            ) : (
              <div style={styles.dictionaryResultsList}>
                {searchResults.map((entry) => {
                  const isAdded = carouselEntries.some((e) => e.id === entry.id);

                  return (
                    <div key={entry.id} style={styles.dictionaryResultCard}>
                      <div style={styles.dictionaryResultTop}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={styles.dictionaryResultWord}>{entry.term}</div>

                            {entry.audio_url && (
                              <button
                                onClick={() => playAudio(entry.audio_url)}
                                style={styles.miniAudioBtn}
                              >
                                <Volume2 size={12} color="#6366f1" />
                              </button>
                            )}
                          </div>

                          <div style={styles.dictionaryResultReading}>{entry.reading}</div>
                        </div>

                        <button
                          onClick={() => toggleCarousel(entry)}
                          style={isAdded ? styles.removeButton : styles.addButton}
                        >
                          {isAdded ? <X size={16} /> : <Plus size={16} />}
                        </button>
                      </div>

                      <div style={styles.dictionaryResultDefinitions}>{entry.meaning}</div>

                      <div style={styles.metadataRow}>
                        {entry.jlpt_level && <Tag label={entry.jlpt_level} tone="red" />}
                        {entry.pos && <Tag label={entry.pos} tone="cyan" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function convertRomajiToKanaForSearch(value) {
  const map = {
    kya: "きゃ",
    kyu: "きゅ",
    kyo: "きょ",
    gya: "ぎゃ",
    gyu: "ぎゅ",
    gyo: "ぎょ",
    sha: "しゃ",
    shu: "しゅ",
    sho: "しょ",
    cha: "ちゃ",
    chu: "ちゅ",
    cho: "ちょ",
    nya: "にゃ",
    nyu: "にゅ",
    nyo: "にょ",
    hya: "ひゃ",
    hyu: "ひゅ",
    hyo: "ひょ",
    mya: "みゃ",
    myu: "みゅ",
    myo: "みょ",
    rya: "りゃ",
    ryu: "りゅ",
    ryo: "りょ",
    bya: "びゃ",
    byu: "びゅ",
    byo: "びょ",
    pya: "ぴゃ",
    pyu: "ぴゅ",
    pyo: "ぴょ",
    ja: "じゃ",
    ju: "じゅ",
    jo: "じょ",
    tsu: "つ",
    shi: "し",
    chi: "ち",
    fu: "ふ",
    ka: "か",
    ki: "き",
    ku: "く",
    ke: "け",
    ko: "こ",
    sa: "さ",
    su: "す",
    se: "せ",
    so: "そ",
    ta: "た",
    te: "て",
    to: "と",
    na: "な",
    ni: "に",
    nu: "ぬ",
    ne: "ね",
    no: "の",
    ha: "は",
    hi: "ひ",
    he: "へ",
    ho: "ほ",
    ma: "ま",
    mi: "み",
    mu: "む",
    me: "め",
    mo: "も",
    ya: "や",
    yu: "ゆ",
    yo: "よ",
    ra: "ら",
    ri: "り",
    ru: "る",
    re: "れ",
    ro: "ろ",
    wa: "わ",
    wo: "を",
    ga: "が",
    gi: "ぎ",
    gu: "ぐ",
    ge: "げ",
    go: "ご",
    za: "ざ",
    ji: "じ",
    zu: "ず",
    ze: "ぜ",
    zo: "ぞ",
    da: "だ",
    de: "で",
    do: "ど",
    ba: "ば",
    bi: "び",
    bu: "ぶ",
    be: "べ",
    bo: "ぼ",
    pa: "ぱ",
    pi: "ぴ",
    pu: "ぷ",
    pe: "ぺ",
    po: "ぽ",
    a: "あ",
    i: "い",
    u: "う",
    e: "え",
    o: "お",
    nn: "ん",
  };

  const text = value.toLowerCase();
  let out = "";
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1] ?? "";
    if (/\s/.test(char)) {
      out += char;
      i++;
      continue;
    }
    if (i + 1 < text.length && char === next && !["a", "i", "u", "e", "o", "n"].includes(char)) {
      out += "っ";
      i++;
      continue;
    }
    const tri = text.slice(i, i + 3);
    const bi = text.slice(i, i + 2);
    if (map[tri]) {
      out += map[tri];
      i += 3;
      continue;
    }
    if (map[bi]) {
      out += map[bi];
      i += 2;
      continue;
    }
    if (map[char]) {
      out += map[char];
      i++;
      continue;
    }
    out += char;
    i++;
  }
  return out;
}

function scoreDictionaryEntry(entry, query, mode) {
  const normalizedQuery = query?.toLowerCase().trim();
  if (!normalizedQuery) return 0;

  const term = entry.term?.toLowerCase?.() ?? "";
  const reading = entry.reading?.toLowerCase?.() ?? "";
  const kanji = entry.kanji?.toLowerCase?.() ?? "";
  const meaning = entry.meaning?.toLowerCase?.() ?? "";
  const isCommon = entry.is_common ? 1 : 0;

  const exactMatch = (value) => value === normalizedQuery;
  const startsWith = (value) => value.startsWith(normalizedQuery);
  const contains = (value) => value.includes(normalizedQuery);

  let score = 0;

  if (mode === "ja") {
    if (exactMatch(term)) score += 100;
    if (exactMatch(reading)) score += 90;
    if (exactMatch(kanji)) score += 90;
    if (startsWith(term)) score += 70;
    if (startsWith(reading)) score += 60;
    if (startsWith(kanji)) score += 50;
    if (contains(term)) score += 40;
    if (contains(reading)) score += 35;
    if (contains(kanji)) score += 30;
    if (contains(meaning)) score += 10;
  } else {
    if (exactMatch(meaning)) score += 100;
    if (startsWith(meaning)) score += 70;
    if (contains(meaning)) score += 50;
    if (contains(term)) score += 20;
    if (contains(reading)) score += 15;
    if (contains(kanji)) score += 10;
  }

  return score + isCommon * 10;
}

const styles = {
  pillToggleBase: (w, h, i) => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: `${w}px`,
    maxWidth: "100%",
    height: `${h}px`,
    padding: `${i}px`,
    background: "rgba(255,255,255,0.45)",
    border: "1px solid rgba(0,0,0,0.05)",
    borderRadius: "999px",
    boxSizing: "border-box",
  }),
  pillToggleSlider: (idx, cnt, i) => ({
    position: "absolute",
    top: `${i}px`,
    bottom: `${i}px`,
    left: `calc(${i}px + (${idx} * (100% - ${i * 2}px) / ${cnt}))`,
    width: `calc((100% - ${i * 2}px) / ${cnt})`,
    borderRadius: "999px",
    background: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    zIndex: 0,
  }),
  pillToggleButton: (active, h) => ({
    flex: 1,
    position: "relative",
    zIndex: 1,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: h < 40 ? "12px" : "13px",
    fontWeight: 600,
    color: active ? "#111827" : "#64748b",
    transition: "color 0.2s ease",
  }),
  progressRing: { transform: "rotate(-90deg)" },
  tagBase: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
    border: "1px solid",
    letterSpacing: "0.02em",
  },
};
