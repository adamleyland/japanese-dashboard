"use client";

import { useMemo, useState } from "react";
import { Award, RefreshCcw, Trophy, X } from "lucide-react";
import { useAchievements } from "@/hooks/useAchievements";
import { formatBritishOrdinalDate, formatPlaytimeCompact, getPlatformLabel, getPreferredArtworkUrl } from "@/lib/gaming/gaming-utils";
import { summarizeAchievementGame } from "@/lib/achievements/providers";

function AchievementDetail({ game, onClose }) {
  const achievementData = useAchievements(game);
  const achievements = achievementData.game?.achievements || [];
  const summary = summarizeAchievementGame({ achievements });
  return <div style={ui.detail}><div style={ui.detailHeader}><div><button onClick={onClose} style={ui.linkButton}>← Library</button><h2 style={ui.title}>{game.title}</h2><p style={ui.muted}>{getPlatformLabel(game.platform)} · {summary.unlocked}/{summary.total} unlocked</p></div><button onClick={achievementData.refresh} style={ui.iconButton} title="Refresh achievements"><RefreshCcw size={17}/></button></div>
    {!achievementData.game && !achievementData.loading ? <button onClick={achievementData.load} style={ui.primaryButton}>Sync {game.source === "steam" ? "Steam" : game.source} achievements</button> : null}
    {achievementData.loading ? <p style={ui.muted}>Syncing and reading the local cache…</p> : null}
    {achievementData.error ? <p style={ui.error}>{achievementData.error}{game.source !== "steam" ? " This provider is modelled and ready for its connector; Steam is the first live sync." : ""}</p> : null}
    {achievements.length ? <div style={ui.achievementGrid}>{achievements.map((achievement) => <article key={achievement.id} style={{...ui.achievement, opacity: achievement.unlocked ? 1 : .5}}><img src={(achievement.unlocked ? achievement.icon_url : achievement.icon_locked_url) || achievement.icon_url || "/window.svg"} alt="" style={ui.achievementIcon}/><div style={ui.achievementCopy}><strong>{achievement.name}</strong><p>{achievement.description || "No description provided."}</p><small>{achievement.unlocked_at ? `Unlocked ${formatBritishOrdinalDate(achievement.unlocked_at)}` : "Locked"}{achievement.rarity_percentage != null ? ` · ${Number(achievement.rarity_percentage).toFixed(1)}%` : ""}{achievement.gamerscore ? ` · ${achievement.gamerscore}G` : ""}</small></div></article>)}</div> : null}
  </div>;
}

export default function AchievementsTab({ gamingData }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState("");
  const games = useMemo(() => gamingData.games.filter((game) => ["steam", "xbox", "local", "steam-deck"].includes(game.source)), [gamingData.games]);
  if (selectedGame) return <AchievementDetail game={selectedGame} onClose={() => setSelectedGame(null)} />;
  const triggerTestAchievement = async () => {
    if (!("Notification" in window)) { setNotificationMessage("Windows notifications are not available in this browser."); return; }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") { setNotificationMessage("Allow notifications for this dashboard to test the pipeline."); return; }
    new Notification("🏆 ACHIEVEMENT UNLOCKED", { body: "Master of Fate\nFinal Fantasy VII Remake\nRare — 4.2%", icon: "/window.svg", tag: "achievement-test" });
    setNotificationMessage("Test notification sent.");
  };
  return <section style={ui.shell}><div style={ui.header}><div><div style={ui.eyebrow}><Trophy size={14}/> Achievement library</div><h1 style={ui.title}>Your Japanese gaming achievements</h1><p style={ui.muted}>Steam is live now. Xbox, local-file, and manual records share the same cache and display model.</p></div><div style={ui.profile}><Award size={18}/><span>{games.length} tracked games</span></div></div>
    <div style={ui.devBar}><span>Developer tools</span><button type="button" onClick={triggerTestAchievement} style={ui.testButton}>Trigger Test Achievement</button>{notificationMessage ? <small>{notificationMessage}</small> : null}</div>
    <div style={ui.cards}>{games.map((game) => <button type="button" key={`${game.source}:${game.sourceGameId}`} onClick={() => setSelectedGame(game)} style={ui.card}><img src={getPreferredArtworkUrl(game) || "/window.svg"} alt="" style={ui.cover}/><div style={ui.cardOverlay}/><div style={ui.cardContent}><span style={ui.provider}>{game.source}</span><strong style={ui.gameTitle}>{game.title}</strong><span style={ui.cardMeta}>{getPlatformLabel(game.platform)} · {formatPlaytimeCompact(game.minutesPlayedTotal)} Japanese gaming</span><span style={ui.cardMeta}>Open achievement library →</span></div></button>)}</div>
    {!games.length && !gamingData.loading ? <p style={ui.muted}>Your game library is empty. Sync a game source first.</p> : null}
  </section>;
}

const ui = { shell:{display:"grid",gap:18}, header:{display:"flex",justifyContent:"space-between",gap:18,alignItems:"flex-start",padding:"22px",border:"1px solid var(--app-border-soft)",borderRadius:26,background:"var(--app-card)"}, eyebrow:{display:"flex",alignItems:"center",gap:7,fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"#ca8a04"}, title:{margin:"7px 0",fontSize:28,letterSpacing:"-.04em"}, muted:{margin:0,color:"var(--app-text-muted)",fontSize:14}, profile:{display:"inline-flex",alignItems:"center",gap:8,whiteSpace:"nowrap",fontWeight:700,color:"var(--app-text-soft)"}, devBar:{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"10px 14px",borderRadius:14,background:"var(--app-surface)",border:"1px solid var(--app-border-soft)",fontSize:12,fontWeight:700}, testButton:{border:"1px solid var(--app-border)",background:"var(--app-card)",borderRadius:8,padding:"6px 9px",fontWeight:800,cursor:"pointer",color:"var(--app-text)"}, cards:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:14}, card:{position:"relative",height:290,overflow:"hidden",borderRadius:20,border:"1px solid var(--app-border-soft)",background:"var(--app-surface)",padding:0,textAlign:"left",cursor:"pointer",color:"white",boxShadow:"0 14px 30px rgba(15,23,42,.12)"}, cover:{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}, cardOverlay:{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(2,6,23,.05),rgba(2,6,23,.9))"}, cardContent:{position:"absolute",inset:"auto 14px 14px",display:"grid",gap:6}, provider:{textTransform:"uppercase",fontWeight:800,fontSize:10,letterSpacing:".1em",color:"#fde68a"}, gameTitle:{fontSize:17,lineHeight:1.1}, cardMeta:{fontSize:12,color:"rgba(255,255,255,.78)"}, detail:{display:"grid",gap:18}, detailHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}, linkButton:{border:0,background:"transparent",padding:0,color:"var(--app-text-muted)",cursor:"pointer",fontWeight:700}, iconButton:{width:40,height:40,border:"1px solid var(--app-border)",borderRadius:12,background:"var(--app-surface)",color:"var(--app-text)",display:"grid",placeItems:"center",cursor:"pointer"}, primaryButton:{justifySelf:"start",border:0,borderRadius:12,padding:"11px 15px",background:"#ca8a04",color:"white",fontWeight:800,cursor:"pointer"}, error:{margin:0,color:"#dc2626",fontSize:14}, achievementGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12}, achievement:{display:"flex",gap:12,padding:12,borderRadius:16,border:"1px solid var(--app-border-soft)",background:"var(--app-card)"}, achievementIcon:{width:54,height:54,objectFit:"cover",borderRadius:12,background:"var(--app-surface)"}, achievementCopy:{minWidth:0,display:"grid",gap:4}, };
