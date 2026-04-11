"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Blocks, Ear, BookOpenText, Gamepad2, Search, Plus, X, BookA, Volume2, Play, Link2, UserCircle2, PlayCircle, Clock3, Mic2, PenLine } from "lucide-react";
import { supabase } from "@/lib/supabase";

const CAROUSEL_INTERVAL = 15000;



const MODULE_ACCENTS = {
  listening: { bg: "#eab308", soft: "rgba(234,179,8,0.18)", text: "#92400e" },
  reading: { bg: "#3b82f6", soft: "rgba(59,130,246,0.18)", text: "#1d4ed8" },
  shadowing: { bg: "#ef4444", soft: "rgba(239,68,68,0.18)", text: "#b91c1c" },
  writing: { bg: "#10b981", soft: "rgba(16,185,129,0.18)", text: "#047857" },
  gaming: { bg: "#8b5cf6", soft: "rgba(139,92,246,0.18)", text: "#6d28d9" },
};

const MODULE_TABS = [
  { key: "listening", label: "Listening", icon: Ear },
  { key: "reading", label: "Reading", icon: BookOpenText },
  { key: "shadowing", label: "Shadowing", icon: Mic2 },
  { key: "writing", label: "Writing", icon: PenLine },
  { key: "gaming", label: "Gaming", icon: Gamepad2 },
];

const SEEDED_CHANNELS = [
  { id: "c1", name: "Nihongo no Mori", category: "JLPT" },
  { id: "c2", name: "Comprehensible Japanese", category: "Immersion" },
  { id: "c3", name: "Japanese Ammo with Misa", category: "Grammar" },
  { id: "c4", name: "YUYUの日本語Podcast", category: "Podcast" },
];

const SEEDED_VIDEOS = [
  { id: "nBJ5dhjR3mY", title: "Learn Japanese with Real Conversations", channel: "Comprehensible Japanese", duration: "18:43", level: "N4-N3", published: "2 weeks ago" },
  { id: "B4fI6UC6W8A", title: "Shadowing Japanese: Daily Routine", channel: "Nihongo no Mori", duration: "12:08", level: "N3", published: "1 month ago" },
  { id: "M4g8QHkM4mY", title: "Japanese Listening Practice for Beginners", channel: "Japanese Ammo with Misa", duration: "22:31", level: "N5-N4", published: "3 days ago" },
  { id: "YfS0xvAcf3Q", title: "Slow Japanese Podcast - Tokyo Life", channel: "YUYUの日本語Podcast", duration: "16:19", level: "N4", published: "6 days ago" },
];
// --- Helper Components ---

function PillSliderToggle({ value, options, onChange, width = 110, size = "md" }) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const inset = 4;
  const toggleHeight = size === "sm" ? 38 : 44;
  return (
    <div style={styles.pillToggleBase(width, toggleHeight, inset)}>
      <div style={styles.pillToggleSlider(activeIndex, options.length, inset)} />
      {options.map((option) => (
        <button key={option.value} onClick={() => onChange(option.value)} style={styles.pillToggleButton(option.value === value, toggleHeight)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ProgressRing({ radius, stroke, progress }) {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <svg height={radius * 2} width={radius * 2} style={styles.progressRing}>
      <circle stroke="rgba(15, 23, 42, 0.05)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
      <circle stroke="#ef4444" fill="transparent" strokeWidth={stroke} strokeDasharray={circumference + " " + circumference} style={{ strokeDashoffset, transition: "stroke-dashoffset 0.1s linear" }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} />
    </svg>
  );
}

const Tag = ({ label, tone }) => {
  const colors = {
    green: { bg: "rgba(220, 252, 231, 0.7)", border: "rgba(134, 239, 172, 0.38)", text: "#166534" },
    blue: { bg: "rgba(219, 234, 254, 0.72)", border: "rgba(125, 211, 252, 0.38)", text: "#1d4ed8" },
    purple: { bg: "rgba(243, 232, 255, 0.7)", border: "rgba(216, 180, 254, 0.38)", text: "#6b21a8" },
    orange: { bg: "rgba(255, 237, 213, 0.7)", border: "rgba(253, 186, 116, 0.38)", text: "#9a3412" },
    cyan: { bg: "rgba(207, 250, 254, 0.7)", border: "rgba(103, 232, 249, 0.38)", text: "#0e7490" },
    red: { bg: "rgba(254, 226, 226, 0.7)", border: "rgba(252, 165, 165, 0.38)", text: "#991b1b" },
  }[tone] || { bg: "rgba(241, 245, 249, 0.7)", border: "rgba(203, 213, 225, 0.38)", text: "#475569" };

  return <span style={{ ...styles.tagBase, backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}>{label}</span>;
};

// --- Word Card Component ---

function WordLearningCard() {
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
    audio.play().catch(e => console.error("Audio error:", e));
  };

  const fetchCarousel = async () => {
    const { data } = await supabase
      .from('user_carousel')
      .select(`
        id,
        words (
          id, term, reading, meaning, pos, tags, audio_url, jlpt_level,
          examples ( sentence_ja, sentence_en, highlight_ja, highlight_en, sentence_audio_url )
        )
      `)
      .order('added_at', { ascending: false });

    if (data) {
      const formatted = data.map(item => ({ carousel_id: item.id, ...item.words }));
      setCarouselEntries(formatted);
    }
  };

  useEffect(() => { fetchCarousel(); }, []);

  useEffect(() => {
    const search = async () => {
      if (!dictionaryValue.trim()) { setSearchResults([]); return; }
      let query = supabase.from('words').select(`*, examples (*)`);
      if (dictionaryInputMode === "ja") {
        query = query.or(`term.ilike.%${dictionaryValue}%,reading.ilike.%${dictionaryValue}%`);
      } else {
        query = query.ilike('meaning', `%${dictionaryValue}%`);
      }
      const { data } = await query.limit(5);
      setSearchResults(data || []);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [dictionaryValue, dictionaryInputMode]);

  const toggleCarousel = async (word) => {
    const existing = carouselEntries.find(e => e.id === word.id);
    if (existing) {
      await supabase.from('user_carousel').delete().eq('id', existing.carousel_id);
    } else {
      await supabase.from('user_carousel').insert([{ word_id: word.id }]);
    }
    fetchCarousel();
  };

  useEffect(() => {
    if (mode !== "carousel" || carouselEntries.length === 0) { setProgress(0); return; }
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= CAROUSEL_INTERVAL) {
        setActiveWordIndex((p) => (p + 1) % carouselEntries.length);
        startTimeRef.current = Date.now();
        setProgress(0);
      } else { setProgress((elapsed / CAROUSEL_INTERVAL) * 100); }
    }, 100);
    return () => clearInterval(timer);
  }, [mode, carouselEntries.length]);

  const activeEntry = carouselEntries[activeWordIndex] || null;

  const highlightSentence = (sentence, target) => {
    if (!target || !sentence.includes(target)) return sentence;
    const index = sentence.indexOf(target);
    return (<>{sentence.substring(0, index)}<span style={styles.textHighlight}>{sentence.substring(index, index + target.length)}</span>{sentence.substring(index + target.length)}</>);
  };

  return (
    <div style={styles.wordCard}>
      <div style={styles.wordCardHeader}>
        <div style={styles.eyebrow}>{mode === "carousel" ? "Word Carousel" : "Dictionary"}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {mode === "carousel" ? (
             activeEntry && (
              <div style={styles.progressContainer}>
                 <ProgressRing radius={14} stroke={2} progress={progress} />
                 <span style={styles.progressSeconds}>{Math.ceil((CAROUSEL_INTERVAL - (progress / 100 * CAROUSEL_INTERVAL)) / 1000)}</span>
              </div>
             )
          ) : (
            <div style={styles.progressContainer}>
               <div style={styles.dictionaryIconFootprint}>
                  <BookA size={14} color="#fff" strokeWidth={2.5} />
               </div>
            </div>
          )}
          <PillSliderToggle value={mode} options={[{ value: "carousel", label: "Carousel" }, { value: "dictionary", label: "Dictionary" }]} onChange={setMode} width={190} size="sm" />
        </div>
      </div>

      {mode === "carousel" ? (
        <div style={styles.wordCarouselBody}>
          {activeEntry ? (
            <>
              <div style={styles.carouselTopSection}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={styles.wordMain}>{activeEntry.term}</div>
                  {activeEntry.audio_url && (
                    <button onClick={() => playAudio(activeEntry.audio_url)} style={styles.audioActionBtn}>
                      <Volume2 size={24} color="#6366f1" />
                    </button>
                  )}
                </div>
                <div style={styles.wordReading}>{activeEntry.reading}</div>
                <div style={styles.wordMeaning}>{activeEntry.meaning}</div>
                <div style={styles.metadataRow}>
                  {activeEntry.jlpt_level && <Tag label={activeEntry.jlpt_level} tone="red" />}
                  {activeEntry.pos && <Tag label={activeEntry.pos} tone="cyan" />}
                  {/* Removing junk tags (Part, Step, Audio, Core) */}
                  {activeEntry.tags?.filter(t => !['step', 'audio', 'part', 'core'].some(bad => t.label.toLowerCase().includes(bad))).map((tag, i) => (
                    <Tag key={i} label={tag.label} tone={tag.tone} />
                  ))}
                </div>
              </div>
              <div style={styles.contextSectionBox}>
                <div style={styles.wordSentenceLabel}>Context examples</div>
                <div style={styles.contextExamplesList}>
                  {activeEntry.examples?.slice(0, 2).map((ex, i) => (
                    <div key={i} style={styles.contextExampleItem}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={styles.wordSentence}>{highlightSentence(ex.sentence_ja, ex.highlight_ja)}</div>
                        {ex.sentence_audio_url && (
                          <button onClick={() => playAudio(ex.sentence_audio_url)} style={styles.miniAudioBtn}>
                            <Ear size={14} color="#64748b" />
                          </button>
                        )}
                      </div>
                      <div style={styles.wordSentenceTranslation}>{ex.sentence_en}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : <div style={styles.dictionaryPlaceholder}>Add words from the dictionary to start!</div>}
        </div>
      ) : (
        <div style={styles.dictionaryBody}>
          <div style={styles.dictionaryControls}>
              <PillSliderToggle value={dictionaryInputMode} options={[{ value: "ja", label: "あ" }, { value: "en", label: "A" }]} onChange={(n) => { setDictionaryInputMode(n); setDictionaryValue(""); }} width={90} size="sm" />
              <label style={styles.dictionaryInputWrapTight}>
                <Search size={16} color="#64748b" />
                <input value={dictionaryValue} onChange={(e) => {
                  const v = e.target.value;
                  setDictionaryValue(dictionaryInputMode === "ja" ? convertRomajiToKanaForSearch(v) : v);
                }} placeholder="Search database..." style={styles.dictionaryInput} />
                {dictionaryValue && (
                  <button onClick={() => setDictionaryValue("")} style={styles.clearSearchBtn}><X size={14} /></button>
                )}
              </label>
          </div>
          <div style={styles.dictionaryResultsArea}>
            {!dictionaryValue.trim() ? <div style={styles.dictionaryPlaceholder}>Search for a word.</div> : searchResults.length === 0 ? <div style={styles.dictionaryPlaceholder}>No matches found.</div> : (
              <div style={styles.dictionaryResultsList}>
                {searchResults.map((entry) => {
                  const isAdded = carouselEntries.some(e => e.id === entry.id);
                  return (
                    <div key={entry.id} style={styles.dictionaryResultCard}>
                      <div style={styles.dictionaryResultTop}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={styles.dictionaryResultWord}>{entry.term}</div>
                            {entry.audio_url && (
                              <button onClick={() => playAudio(entry.audio_url)} style={styles.miniAudioBtn}>
                                <Volume2 size={12} color="#6366f1" />
                              </button>
                            )}
                          </div>
                          <div style={styles.dictionaryResultReading}>{entry.reading}</div>
                        </div>
                        <button onClick={() => toggleCarousel(entry)} style={isAdded ? styles.removeButton : styles.addButton}>
                          {isAdded ? <X size={16} /> : <Plus size={16} />}
                        </button>
                      </div>
                      <div style={styles.dictionaryResultDefinitions}>{entry.meaning}</div>
                      <div style={styles.metadataRow}>
                        {entry.jlpt_level && <Tag label={entry.jlpt_level} tone="red" />}
                        <Tag label={entry.pos} tone="cyan" />
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

// --- Dashboard Components ---

export default function Home() {
  const [tab, setTab] = useState("listening");
  const [listeningHours, setListeningHours] = useState(1030);
  const [shadowingHours, setShadowingHours] = useState(180);
  const [gamingHours, setGamingHours] = useState(280);
  const [wordsRead, setWordsRead] = useState(3050000);
  const [wordsWritten, setWordsWritten] = useState(260000);
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const overallHours = useMemo(() => listeningHours + gamingHours + shadowingHours, [listeningHours, gamingHours, shadowingHours]);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.bgOrb1} /><div style={styles.bgOrb2} />
      <div style={styles.container}>
        <section style={{ ...styles.heroGrid, gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr" }}>
          <div style={styles.heroCard}>
            <h1 style={styles.title}>Japanese Progress</h1>
            <div style={styles.overallRow}>
              <MetricCard label="Overall hours" value={formatHours(overallHours)} icon={<Blocks size={20} strokeWidth={2} color="#ef4444" />} featured />
            </div>
            <div style={styles.metricsGridThree}>
              <MetricCard label="Listening" value={formatHours(listeningHours)} icon={<Ear size={20} strokeWidth={2} color="#eab308" />} onQuickAdd={() => setListeningHours(v => v + 1)} quickAddLabel="+1h" />
              <MetricCard label="Reading" value={formatWords(wordsRead)} icon={<BookOpenText size={20} strokeWidth={2} color="#3b82f6" />} onQuickAdd={() => setWordsRead(v => v + 1000)} quickAddLabel="+1k" />
              <MetricCard label="Gaming" value={formatHours(gamingHours)} icon={<Gamepad2 size={20} strokeWidth={2} color="#8b5cf6" />} onQuickAdd={() => setGamingHours(v => v + 1)} quickAddLabel="+1h" />
            </div>
            <details style={styles.expandableWrap} open={isAdditionalOpen} onToggle={(e) => setIsAdditionalOpen(e.currentTarget.open)}>
              <summary style={styles.expandableSummary}><span>Additional metrics</span><span style={styles.expandableArrow}>{isAdditionalOpen ? "▲" : "▼"}</span></summary>
              <div style={styles.subMetricsGrid}>
                <SubMetricCard label="Shadowing" value={formatHours(shadowingHours)} onQuickAdd={() => setShadowingHours(v => v + 0.5)} quickAddLabel="+0.5h" />
                <SubMetricCard label="Written" value={formatWords(wordsWritten)} onQuickAdd={() => setWordsWritten(v => v + 500)} quickAddLabel="+500" />
              </div>
            </details>
          </div>
          <WordLearningCard />
        </section>
        <section style={styles.tabsWrap}>
          <ModuleNav activeTab={tab} onChange={setTab} />
        </section>
        <section style={styles.contentWrap}>
          {tab === "listening" && <ListeningTab listeningHours={listeningHours} setListeningHours={setListeningHours} isMobile={isMobile} />}
          {tab === "reading" && <ReadingTab wordsRead={wordsRead} setWordsRead={setWordsRead} isMobile={isMobile} />}
          {tab === "shadowing" && <ShadowingTab shadowingHours={shadowingHours} setShadowingHours={setShadowingHours} isMobile={isMobile} />}
          {tab === "writing" && <WritingTab wordsWritten={wordsWritten} setWordsWritten={setWordsWritten} isMobile={isMobile} />}
          {tab === "gaming" && <GamingTab gamingHours={gamingHours} setGamingHours={setGamingHours} isMobile={isMobile} />}
        </section>
      </div>
    </main>
  );
}

function ModuleNav({ activeTab, onChange }) {
  const activeIndex = Math.max(0, MODULE_TABS.findIndex((item) => item.key === activeTab));
  return (
    <div style={styles.moduleNavTrack}>
      <div style={styles.moduleNavSlider(activeIndex, MODULE_TABS.length, MODULE_ACCENTS[activeTab]?.bg)} />
      {MODULE_TABS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;
        return (
          <button key={item.key} onClick={() => onChange(item.key)} style={styles.moduleNavButton(isActive)}>
            <Icon size={15} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Utils ---

function MetricCard({ label, value, icon, onQuickAdd, quickAddLabel = "+1", featured = false }) {
  return (
    <div style={styles.metricCard(featured)}>
      <div style={styles.metricTopRow}><div style={styles.metricIconWrap(featured)}>{icon}</div>
        {onQuickAdd && <button onClick={onQuickAdd} style={styles.quickAddButton}>{quickAddLabel}</button>}
      </div>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue(featured)}>{value}</div>
    </div>
  );
}

function SubMetricCard({ label, value, onQuickAdd, quickAddLabel = "+1" }) {
  return (
    <div style={styles.metricCard(false)}>
      <div style={styles.metricTopRow}><div style={styles.metricLabel}>{label}</div>
        {onQuickAdd && <button onClick={onQuickAdd} style={styles.quickAddButtonSub}>{quickAddLabel}</button>}
      </div>
      <div style={styles.metricValue(false)}>{value}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }) {
  return (
    <label style={styles.inputCard}><span style={styles.inputLabel}>{label}</span>
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} style={styles.input} />
    </label>
  );
}

function ListeningTab({ listeningHours, setListeningHours, isMobile }) {
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState(SEEDED_CHANNELS);
  const [videoFeed, setVideoFeed] = useState(SEEDED_VIDEOS);
  const [selectedVideoId, setSelectedVideoId] = useState(SEEDED_VIDEOS[0]?.id);

  const selectedVideo = useMemo(() => videoFeed.find((video) => video.id === selectedVideoId) || videoFeed[0], [videoFeed, selectedVideoId]);
  const handleVideoSelect = (videoId) => setSelectedVideoId(videoId);

  useEffect(() => {
    if (!videoFeed.length) return;
    const stillExists = videoFeed.some((video) => video.id === selectedVideoId);
    if (!stillExists) setSelectedVideoId(videoFeed[0].id);
  }, [videoFeed, selectedVideoId]);

  return (
    <div style={{ ...styles.listeningGrid, gridTemplateColumns: isMobile ? "1fr" : "1.55fr 1fr" }}>
      <div style={styles.largeCard}>
        <div style={{ ...styles.sectionHeader, flexDirection: isMobile ? "column" : "row" }}><div><h2 style={styles.sectionTitle}>Listening Workspace</h2><p style={styles.sectionText}>YouTube-first Japanese listening dashboard for study sessions.</p></div><div style={{ ...styles.pill, background: MODULE_ACCENTS.listening.soft, color: MODULE_ACCENTS.listening.text }}>YouTube learning source</div></div>
        <div style={styles.playerShell}>
          <div style={styles.playerHeader}>
            <div style={styles.playerHeaderLeft}><Play size={18} color="#ef4444" /><span style={styles.playerPlatform}>YouTube Integration</span></div>
            <Tag label={youtubeConnected ? "Connected" : "Not Connected"} tone={youtubeConnected ? "green" : "orange"} />
          </div>
          <div style={styles.playerFrameWrap}>
            <iframe
              title={selectedVideo?.title || "Japanese listening video"}
              src={`https://www.youtube.com/embed/${selectedVideo?.id}?rel=0`}
              style={styles.playerFrame}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div style={styles.playerMeta}>
            <h3 style={styles.playerTitle}>{selectedVideo?.title}</h3>
            <p style={styles.playerSub}>{selectedVideo?.channel} · {selectedVideo?.duration} · {selectedVideo?.level}</p>
          </div>
        </div>
        <div style={styles.controlGridSingle}>
          <NumberField label="Listening hours" value={listeningHours} onChange={setListeningHours} step={0.5} />
        </div>
      </div>

      <div style={styles.sideColumn}>
        <div style={styles.sideCard}>
          <h3 style={styles.sideTitle}>YouTube account</h3>
          <div style={styles.accountRow}>
            <div style={styles.accountIdentity}><UserCircle2 size={18} /><span>{youtubeConnected ? "Connected learner account" : "Sign in to connect YouTube"}</span></div>
            <button
              style={styles.connectButton(youtubeConnected)}
              onClick={() => {
                setYoutubeConnected((v) => !v);
                setSubscribedChannels([...SEEDED_CHANNELS]);
                setVideoFeed([...SEEDED_VIDEOS]);
              }}
            >
              <Link2 size={14} /> {youtubeConnected ? "Disconnect" : "Connect"}
            </button>
          </div>
          <p style={styles.helperText}>Foundation ready for auth, subscriptions sync, and personalized recommendations.</p>
        </div>

        <div style={styles.sideCard}>
          <h3 style={styles.sideTitle}>Subscribed Japanese channels</h3>
          <div style={styles.listStack}>
            {subscribedChannels.map((channel) => (
              <div key={channel.id} style={styles.simpleRow}>
                <span style={styles.simpleTitle}>{channel.name}</span>
                <Tag label={channel.category} tone="blue" />
              </div>
            ))}
          </div>
        </div>

        <div style={styles.sideCard}>
          <h3 style={styles.sideTitle}>Recommended / recent videos</h3>
          <div style={styles.listStack}>
            {videoFeed.map((video) => {
              const active = video.id === selectedVideo?.id;
              return (
                <button key={video.id} style={styles.videoFeedButton(active)} onClick={() => handleVideoSelect(video.id)}>
                  <div style={styles.videoFeedTop}>
                    <PlayCircle size={16} color={active ? "#ffffff" : "#64748b"} />
                    <span style={styles.videoFeedTitle(active)}>{video.title}</span>
                  </div>
                  <div style={styles.videoFeedMeta(active)}>
                    <span>{video.channel}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Clock3 size={12} />{video.duration}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadingTab({ wordsRead, setWordsRead, isMobile }) {
  return (
    <div style={styles.largeCard}><h2 style={styles.sectionTitle}>Reading</h2><p style={styles.sectionText}>Track total words read across books, manga, and articles.</p>
      <div style={{ ...styles.controlGridSingle, gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 360px)" }}><NumberField label="Words read" value={wordsRead} onChange={setWordsRead} step={100} /></div>
    </div>
  );
}

function ShadowingTab({ shadowingHours, setShadowingHours, isMobile }) {
  return (
    <div style={styles.largeCard}><h2 style={styles.sectionTitle}>Shadowing</h2><p style={styles.sectionText}>Track active output practice and imitation sessions.</p>
      <div style={{ ...styles.controlGridSingle, gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 360px)" }}><NumberField label="Shadowing hours" value={shadowingHours} onChange={setShadowingHours} step={0.5} /></div>
    </div>
  );
}

function WritingTab({ wordsWritten, setWordsWritten, isMobile }) {
  return (
    <div style={styles.largeCard}><h2 style={styles.sectionTitle}>Writing</h2><p style={styles.sectionText}>Track total words written from journaling and output drills.</p>
      <div style={{ ...styles.controlGridSingle, gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 360px)" }}><NumberField label="Words written" value={wordsWritten} onChange={setWordsWritten} step={100} /></div>
    </div>
  );
}

function GamingTab({ gamingHours, setGamingHours, isMobile }) {
  return (
    <div style={styles.largeCard}><h2 style={styles.sectionTitle}>Gaming</h2><p style={styles.sectionText}>Track immersion hours.</p>
      <div style={{ ...styles.controlGridSingle, gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 360px)" }}><NumberField label="Gaming hours" value={gamingHours} onChange={setGamingHours} step={0.5} /></div>
    </div>
  );
}

function formatHours(v) { return `${Number(v).toLocaleString(undefined, { minimumFractionDigits: v % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })}h`; }
function formatWords(v) { return Number(v).toLocaleString(); }

function convertRomajiToKanaForSearch(value) {
  const map = {
    kya: "きゃ", kyu: "きゅ", kyo: "きょ", gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ", sha: "しゃ", shu: "しゅ", sho: "しょ", cha: "ちゃ", chu: "ちゅ", cho: "ちょ",
    nya: "にゃ", nyu: "にゅ", nyo: "にょ", hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ", mya: "みゃ", myu: "みゅ", myo: "みょ", rya: "りゃ", ryu: "りゅ", ryo: "りょ",
    bya: "びゃ", byu: "びゅ", byo: "びょ", pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ", ja: "じゃ", ju: "じゅ", jo: "じょ", tsu: "つ", shi: "し", chi: "ち", fu: "ふ",
    ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ", sa: "さ", su: "す", se: "せ", so: "そ", ta: "た", te: "て", to: "と", na: "な", ni: "に", nu: "ぬ",
    ne: "ね", no: "の", ha: "は", hi: "ひ", he: "へ", ho: "ほ", ma: "ま", mi: "み", mu: "む", me: "め", mo: "も", ya: "や", yu: "ゆ", yo: "よ", ra: "ら",
    ri: "り", ru: "る", re: "れ", ro: "ろ", wa: "わ", wo: "を", ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "空", za: "ざ", ji: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
    da: "だ", de: "で", do: "ど", ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ", pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ", a: "あ", i: "い", u: "う", e: "え", o: "お",
    nn: "ん"
  };
  const text = value.toLowerCase(); let out = ""; let i = 0;
  while (i < text.length) {
    const char = text[i]; const next = text[i + 1] ?? "";
    if (/\s/.test(char)) { out += char; i++; continue; }
    if (i + 1 < text.length && char === next && !["a", "i", "u", "e", "o", "n"].includes(char)) { out += "っ"; i++; continue; }
    const tri = text.slice(i, i + 3); const bi = text.slice(i, i + 2);
    if (map[tri]) { out += map[tri]; i += 3; continue; }
    if (map[bi]) { out += map[bi]; i += 2; continue; }
    if (map[char]) { out += map[char]; i++; continue; }
    out += char; i++;
  }
  return out;
}

const glass = { background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 20px 60px rgba(15,23,42,0.12)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" };

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #ecfeff 100%)", fontFamily: 'Inter, system-ui, -apple-system, sans-serif', color: "#111827", padding: "24px", position: "relative", overflow: "hidden" },
  bgOrb1: { position: "absolute", width: "420px", height: "420px", borderRadius: "999px", background: "rgba(186,230,253,0.8)", filter: "blur(80px)", top: "-120px", left: "-80px", pointerEvents: "none" },
  bgOrb2: { position: "absolute", width: "420px", height: "420px", borderRadius: "999px", background: "rgba(221,214,254,0.7)", filter: "blur(80px)", top: "-120px", right: "-80px", pointerEvents: "none" },
  container: { maxWidth: "1300px", margin: "0 auto", position: "relative", zIndex: 1, display: "grid", gap: "18px" },
  heroGrid: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "18px" },
  heroCard: { ...glass, borderRadius: "30px", padding: "24px" },
  wordCard: { ...glass, borderRadius: "30px", padding: "24px", minHeight: "390px", display: "grid", gridTemplateRows: "auto 1fr", gap: "16px" },
  wordCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", paddingBottom: "6px" },
  progressContainer: { display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "28px", height: "28px" },
  dictionaryIconFootprint: { width: "28px", height: "28px", borderRadius: "50%", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(239, 68, 68, 0.2)" },
  progressSeconds: { position: "absolute", fontSize: "10px", fontWeight: 700, color: "#64748b" },
  progressRing: { transform: "rotate(-90deg)" },
  eyebrow: { fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#667085" },
  tagBase: { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, border: "1px solid", letterSpacing: "0.02em" },
  pillToggleBase: (w, h, i) => ({ position: "relative", display: "flex", alignItems: "center", width: `${w}px`, height: `${h}px`, padding: `${i}px`, background: "rgba(255,255,255,0.45)", border: "1px solid rgba(0,0,0,0.05)", borderRadius: "999px", boxSizing: "border-box" }),
  pillToggleSlider: (idx, cnt, i) => ({ position: "absolute", top: `${i}px`, bottom: `${i}px`, left: `calc(${i}px + (${idx} * (100% - ${i * 2}px) / ${cnt}))`, width: `calc((100% - ${i * 2}px) / ${cnt})`, borderRadius: "999px", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)", zIndex: 0 }),
  pillToggleButton: (active, h) => ({ flex: 1, position: "relative", zIndex: 1, border: "none", background: "transparent", cursor: "pointer", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: h < 40 ? "13px" : "14px", fontWeight: 600, color: active ? "#111827" : "#64748b", transition: "color 0.2s ease" }),
  wordCarouselBody: { display: "flex", flexDirection: "column", gap: "14px", height: "100%" },
  carouselTopSection: { display: "grid", gap: "8px", alignContent: "start" },
  wordMain: { fontSize: "54px", fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1 },
  wordReading: { color: "#64748b", fontSize: "18px" },
  wordMeaning: { marginTop: "4px", fontSize: "16px", color: "#0f172a", lineHeight: 1.4 },
  metadataRow: { display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" },
  contextSectionBox: { marginTop: "auto", borderRadius: "20px", border: "1px solid rgba(15, 23, 42, 0.12)", background: "rgba(255, 255, 255, 0.3)", padding: "16px", display: "grid", gap: "12px" },
  contextExamplesList: { display: "grid", gap: "14px" },
  contextExampleItem: { display: "grid", gap: "6px" },
  wordSentenceLabel: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" },
  wordSentence: { fontSize: "14px", lineHeight: 1.6, color: "#111827" },
  wordSentenceTranslation: { color: "#64748b", fontSize: "13px", lineHeight: 1.5 },
  textHighlight: { color: "#ef4444", fontWeight: 600, background: "rgba(239, 68, 68, 0.08)", padding: "0 2px", borderRadius: "4px" },
  dictionaryBody: { display: "grid", gap: "12px", height: "100%", gridTemplateRows: "auto 1fr" },
  dictionaryControls: { display: "flex", alignItems: "center", gap: "10px" },
  dictionaryInputWrapTight: { flex: 1, display: "flex", alignItems: "center", gap: "8px", borderRadius: "12px", border: "1px solid rgba(15, 23, 42, 0.12)", background: "rgba(255, 255, 255, 0.8)", padding: "8px 12px", position: 'relative' },
  dictionaryInput: { width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "14px", color: "#111827" },
  clearSearchBtn: { background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#94a3b8' },
  dictionaryResultsArea: { overflowY: "auto", marginTop: "4px" },
  dictionaryResultsList: { display: "grid", gap: "10px", padding: "2px" },
  dictionaryPlaceholder: { borderRadius: "14px", border: "1px dashed rgba(15,23,42,0.15)", background: "rgba(255,255,255,0.35)", padding: "16px", color: "#64748b", fontSize: "13px", textAlign: "center" },
  dictionaryResultCard: { borderRadius: "20px", border: "1px solid rgba(15, 23, 42, 0.1)", background: "rgba(255, 255, 255, 0.65)", padding: "16px", boxShadow: "0 4px 12px rgba(15,23,42,0.03)", display: 'grid', gap: '8px' },
  dictionaryResultTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" },
  dictionaryResultWord: { fontSize: "22px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 },
  dictionaryResultReading: { marginTop: "2px", fontSize: "13px", color: "#64748b" },
  dictionaryResultDefinitions: { fontSize: "14px", color: "#0f172a", lineHeight: 1.4 },
  addButton: { display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "10px", border: "1px solid rgba(15, 23, 42, 0.1)", background: "#fff", color: "#111827", cursor: "pointer" },
  removeButton: { display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "10px", border: "1px solid #ef4444", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", cursor: "pointer" },
  audioActionBtn: { background: "#fff", border: "1px solid rgba(15, 23, 42, 0.1)", borderRadius: "12px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  miniAudioBtn: { background: "#fff", border: "1px solid rgba(15, 23, 42, 0.08)", borderRadius: "8px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  title: { fontSize: "44px", lineHeight: 1.2, letterSpacing: "-0.05em", margin: "10px 0 35px 0" },
  overallRow: { marginTop: "20px" },
  metricsGridThree: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginTop: "12px" },
  subMetricsGrid: { marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  metricCard: (f) => ({ background: f ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.58)", border: "1px solid rgba(255,255,255,0.82)", boxShadow: f ? "0 16px 36px rgba(15,23,42,0.14)" : "0 12px 26px rgba(15,23,42,0.1)", borderRadius: f ? "24px" : "22px", padding: f ? "20px" : "18px" }),
  metricTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "10px" },
  metricIconWrap: (f) => ({ width: f ? "40px" : "34px", height: f ? "40px" : "34px", borderRadius: "12px", border: "1px solid rgba(15,23,42,0.1)", background: "rgba(255,255,255,0.85)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: f ? "20px" : "18px" }),
  quickAddButton: { border: "1px solid rgba(15,23,42,0.14)", background: "rgba(255,255,255,0.9)", borderRadius: "999px", padding: "6px 10px", fontSize: "12px", fontWeight: 700, color: "#111827", cursor: "pointer" },
  quickAddButtonSub: { border: "1px solid rgba(15,23,42,0.1)", background: "rgba(255,255,255,0.85)", borderRadius: "999px", padding: "5px 9px", fontSize: "11px", fontWeight: 700, color: "#111827", cursor: "pointer" },
  metricLabel: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#667085", marginBottom: "8px" },
  metricValue: (f) => ({ fontSize: f ? "40px" : "30px", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }),
  expandableWrap: { marginTop: "12px", borderRadius: "18px", background: "rgba(255,255,255,0.32)", border: "1px solid rgba(255,255,255,0.62)", padding: "12px" },
  expandableSummary: { cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#667085" },
  expandableArrow: { fontSize: "20px", lineHeight: 1, color: "#cbd5e1" },
  tabsWrap: { ...glass, borderRadius: "999px", padding: "10px", display: "block", overflowX: "auto" },
  contentWrap: { minWidth: 0 },
  moduleNavTrack: { position: "relative", display: "grid", gridTemplateColumns: "repeat(5, minmax(116px, 1fr))", minWidth: "610px", gap: "6px", padding: "6px", borderRadius: "999px", background: "rgba(255,255,255,0.42)", border: "1px solid rgba(255,255,255,0.7)" },
  moduleNavSlider: (idx, count, bgColor) => ({ position: "absolute", top: "6px", bottom: "6px", left: `calc(6px + (${idx} * (100% - 12px) / ${count}))`, width: `calc((100% - 12px) / ${count})`, borderRadius: "999px", background: bgColor || "#111827", boxShadow: "0 10px 30px rgba(15,23,42,0.25)", transition: "all 320ms cubic-bezier(0.22, 1, 0.36, 1)" }),
  moduleNavButton: (active) => ({ position: "relative", zIndex: 1, border: "none", borderRadius: "999px", background: "transparent", color: active ? "#fff" : "#475569", cursor: "pointer", padding: "12px 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", fontWeight: 700, fontSize: "13px", transition: "color 220ms ease" }),
  listeningGrid: { display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: "18px" },
  largeCard: { ...glass, borderRadius: "30px", padding: "24px" },
  sideColumn: { display: "grid", gap: "18px" },
  sideCard: { ...glass, borderRadius: "30px", padding: "24px" },
  sideTitle: { margin: 0, fontSize: "18px", letterSpacing: "-0.02em", marginBottom: "12px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", marginBottom: "18px" },
  sectionTitle: { margin: 0, fontSize: "24px", letterSpacing: "-0.03em" },
  sectionText: { margin: "8px 0 0 0", color: "#667085", fontSize: "14px" },
  pill: { display: "inline-flex", alignItems: "center", padding: "8px 12px", borderRadius: "999px", background: "rgba(255,255,255,0.52)", border: "1px solid rgba(255,255,255,0.72)", fontSize: "13px", color: "#667085" },
  playerShell: { borderRadius: "22px", border: "1px solid rgba(15,23,42,0.12)", background: "rgba(255,255,255,0.56)", padding: "14px", display: "grid", gap: "12px" },
  playerHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" },
  playerHeaderLeft: { display: "inline-flex", alignItems: "center", gap: "8px" },
  playerPlatform: { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", fontWeight: 700 },
  playerFrameWrap: { position: "relative", width: "100%", paddingTop: "56.25%", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(15,23,42,0.12)", background: "#0f172a" },
  playerFrame: { position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" },
  playerMeta: { display: "grid", gap: "4px" },
  playerTitle: { margin: 0, fontSize: "20px", lineHeight: 1.25, letterSpacing: "-0.02em" },
  playerSub: { margin: 0, fontSize: "13px", color: "#64748b" },
  accountRow: { display: "grid", gap: "10px" },
  accountIdentity: { display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#0f172a", flexWrap: "wrap" },
  connectButton: (connected) => ({ border: connected ? "1px solid rgba(239,68,68,0.32)" : "1px solid rgba(16,185,129,0.32)", background: connected ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)", color: connected ? "#b91c1c" : "#047857", borderRadius: "12px", padding: "10px 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", fontWeight: 700 }),
  helperText: { margin: "10px 0 0 0", color: "#64748b", fontSize: "13px", lineHeight: 1.5 },
  listStack: { display: "grid", gap: "10px" },
  simpleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", borderRadius: "14px", border: "1px solid rgba(15,23,42,0.1)", background: "rgba(255,255,255,0.62)", padding: "11px 12px" },
  simpleTitle: { fontSize: "13px", fontWeight: 600, color: "#0f172a" },
  videoFeedButton: (active) => ({ border: active ? "1px solid rgba(234,179,8,0.55)" : "1px solid rgba(15,23,42,0.1)", background: active ? "linear-gradient(140deg, #facc15, #eab308)" : "rgba(255,255,255,0.62)", color: active ? "#fff" : "#0f172a", borderRadius: "14px", padding: "10px 12px", display: "grid", gap: "6px", textAlign: "left", cursor: "pointer", transition: "all 220ms ease" }),
  videoFeedTop: { display: "flex", alignItems: "flex-start", gap: "8px" },
  videoFeedTitle: (active) => ({ fontSize: "13px", fontWeight: 700, lineHeight: 1.35, color: active ? "#fff" : "#111827" }),
  videoFeedMeta: (active) => ({ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "12px", color: active ? "rgba(255,255,255,0.92)" : "#64748b" }),
  bigNumber: { fontSize: "56px", fontWeight: 700, letterSpacing: "-0.06em", textAlign: "center" },
  smallStatsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  smallStat: { padding: "16px", borderRadius: "18px", background: "rgba(255,255,255,0.48)", border: "1px solid rgba(255,255,255,0.68)" },
  smallStatValue: { fontSize: "24px", fontWeight: 700, letterSpacing: "-0.04em" },
  controlGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", marginTop: "18px" },
  controlGridSingle: { display: "grid", gridTemplateColumns: "minmax(0, 360px)", marginTop: "18px" },
  inputCard: { display: "grid", gap: "8px", borderRadius: "18px", background: "rgba(255,255,255,0.48)", border: "1px solid rgba(255,255,255,0.68)", padding: "14px" },
  inputLabel: { fontSize: "12px", color: "#667085", textTransform: "uppercase", letterSpacing: "0.08em" },
  input: { width: "100%", border: "1px solid rgba(15, 23, 42, 0.12)", borderRadius: "12px", padding: "10px 12px", fontSize: "18px", fontWeight: 600, color: "#111827", background: "rgba(255,255,255,0.9)", outline: "none" },
};