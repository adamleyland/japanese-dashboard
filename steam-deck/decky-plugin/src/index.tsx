import { ButtonItem, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { addEventListener, definePlugin, removeEventListener, toaster } from "@decky/api";
import { FaTrophy } from "react-icons/fa";

type Achievement = {
  achievementName?: string;
  gameTitle?: string;
  iconUrl?: string;
  rarityPercentage?: number | null;
};

let nativeToast: HTMLDivElement | null = null;
let hideTimer = 0;

function showDeckyToast(item: Achievement) {
  const rarity = Number(item.rarityPercentage);
  toaster.toast({
    title: <span style={{ color: "#facc15", fontSize: "11px", fontWeight: 800, letterSpacing: ".08em" }}>ACHIEVEMENT UNLOCKED</span>,
    body: <span style={{ fontSize: "16px", fontWeight: 800 }}>{item.achievementName || "Achievement unlocked"}</span>,
    subtext: <span>{item.gameTitle || "Non-Steam game"}{Number.isFinite(rarity) ? ` · ${rarity.toFixed(1)}% players` : ""}</span>,
    logo: item.iconUrl
      ? <img src={item.iconUrl} alt="" style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover" }} />
      : <FaTrophy style={{ color: "#facc15", fontSize: "30px" }} />,
    duration: 8000,
    playSound: true,
    showToast: true,
  });
}

function showNativeToast(item: Achievement) {
  if (!nativeToast) {
    nativeToast = document.createElement("div");
    Object.assign(nativeToast.style, {
      position: "fixed", zIndex: "999999", top: "22px", right: "22px", width: "430px",
      minHeight: "104px", display: "grid", gridTemplateColumns: "58px minmax(0,1fr) auto",
      alignItems: "center", gap: "14px", padding: "14px 16px", overflow: "hidden",
      border: "1px solid rgba(255,255,255,.16)", borderRadius: "18px", color: "#fff",
      background: "linear-gradient(135deg,rgba(11,18,34,.97),rgba(27,36,58,.94))",
      boxShadow: "0 8px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.07)",
      fontFamily: "Inter,Segoe UI,sans-serif", opacity: "0", transform: "translateX(38px) scale(.97)",
      transition: "opacity .46s ease, transform .46s cubic-bezier(.2,.9,.2,1)", pointerEvents: "none",
    });
    document.body.appendChild(nativeToast);
  }
  const rarity = Number(item.rarityPercentage);
  nativeToast.replaceChildren();
  const icon = document.createElement("div");
  Object.assign(icon.style, { width: "58px", height: "58px", display: "grid", placeItems: "center", overflow: "hidden", borderRadius: "13px", background: "rgba(250,204,21,.12)", color: "#facc15", fontSize: "28px" });
  if (item.iconUrl) {
    const image = document.createElement("img");
    image.src = item.iconUrl;
    image.alt = "";
    Object.assign(image.style, { width: "100%", height: "100%", objectFit: "cover" });
    icon.appendChild(image);
  } else icon.textContent = "◆";
  const copy = document.createElement("div");
  copy.style.minWidth = "0";
  const label = document.createElement("div");
  label.textContent = "ACHIEVEMENT UNLOCKED";
  Object.assign(label.style, { color: "#facc15", fontSize: "10px", fontWeight: "800", letterSpacing: ".11em" });
  const name = document.createElement("div");
  name.textContent = item.achievementName || "Achievement unlocked";
  Object.assign(name.style, { fontSize: "16px", fontWeight: "800", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "4px" });
  const game = document.createElement("div");
  game.textContent = item.gameTitle || "Non-Steam game";
  Object.assign(game.style, { color: "rgba(255,255,255,.66)", fontSize: "11px", fontWeight: "650", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "4px" });
  copy.append(label, name, game);
  const rarityLabel = document.createElement("div");
  rarityLabel.textContent = Number.isFinite(rarity) ? `${rarity.toFixed(1)}% players` : "";
  Object.assign(rarityLabel.style, { alignSelf: "end", color: "rgba(255,255,255,.56)", fontSize: "10px", fontWeight: "700" });
  nativeToast.append(icon, copy, rarityLabel);
  window.clearTimeout(hideTimer);
  requestAnimationFrame(() => { if (nativeToast) { nativeToast.style.opacity = "1"; nativeToast.style.transform = "translateX(0) scale(1)"; } });
  hideTimer = window.setTimeout(() => { if (nativeToast) { nativeToast.style.opacity = "0"; nativeToast.style.transform = "translateX(28px) scale(.98)"; } }, 8000);
}

function Content() {
  return <PanelSection title="Notifications"><PanelSectionRow><ButtonItem layout="below" onClick={() => showDeckyToast({ achievementName: "Battlefield Martial Artist", gameTitle: "Japanese Dashboard", rarityPercentage: 12.4 })}>Show test notification</ButtonItem></PanelSectionRow></PanelSection>;
}

export default definePlugin(() => {
  const listener = addEventListener<[Achievement]>("achievement_unlocked", showDeckyToast);
  return {
    name: "Japanese Dashboard Achievements",
    titleView: <div className={staticClasses.Title}>Japanese Dashboard</div>,
    content: <Content />,
    icon: <FaTrophy />,
    onDismount() {
      removeEventListener("achievement_unlocked", listener);
      window.clearTimeout(hideTimer);
      nativeToast?.remove();
      nativeToast = null;
    },
  };
});
