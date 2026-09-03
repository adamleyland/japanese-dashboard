import { ButtonItem, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { addEventListener, callable, definePlugin, removeEventListener } from "@decky/api";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { FaTrophy } from "react-icons/fa";

type Achievement = {
  achievementName?: string;
  gameTitle?: string;
  iconUrl?: string;
  rarityPercentage?: number | null;
};

const testNotification = callable<[], void>("test_notification");
const subscribers = new Set<(event: Achievement) => void>();

function AchievementOverlay() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [visible, setVisible] = useState(false);
  const current = queue[0];

  useEffect(() => {
    const subscriber = (event: Achievement) => setQueue((items) => [...items, event]);
    subscribers.add(subscriber);
    return () => { subscribers.delete(subscriber); };
  }, []);

  useEffect(() => {
    if (!current) return;
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), 8000);
    const remove = window.setTimeout(() => setQueue((items) => items.slice(1)), 8350);
    return () => { window.clearTimeout(hide); window.clearTimeout(remove); };
  }, [current]);

  if (!current) return null;
  const rarity = Number(current.rarityPercentage);
  return createPortal(
    <div className={`jp-achievement-toast ${visible ? "jp-show" : "jp-hide"}`}>
      <style>{`
        .jp-achievement-toast{position:fixed;z-index:999999;top:22px;right:22px;width:430px;min-height:104px;display:grid;grid-template-columns:58px minmax(0,1fr) auto;align-items:center;gap:14px;padding:14px 16px;overflow:hidden;border:1px solid rgba(255,255,255,.16);border-radius:18px;color:#fff;background:linear-gradient(135deg,rgba(11,18,34,.97),rgba(27,36,58,.94));box-shadow:0 8px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.07);font-family:Inter,"Segoe UI",sans-serif;opacity:0;transform:translateX(38px) scale(.97);pointer-events:none}.jp-achievement-toast:before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:linear-gradient(#facc15,#f59e0b)}.jp-show{animation:jp-toast-in .46s cubic-bezier(.2,.9,.2,1) forwards}.jp-hide{animation:jp-toast-out .32s ease-in forwards}.jp-icon{width:58px;height:58px;display:grid;place-items:center;border-radius:13px;background:rgba(250,204,21,.12);border:1px solid rgba(250,204,21,.22);overflow:hidden}.jp-icon img{width:100%;height:100%;object-fit:cover}.jp-lock{font-size:28px;color:#facc15}.jp-copy{min-width:0;display:grid;gap:4px}.jp-label{color:#facc15;font-size:10px;line-height:1;font-weight:850;letter-spacing:.11em;text-transform:uppercase}.jp-name{overflow:hidden;font-size:16px;line-height:1.18;font-weight:800;text-overflow:ellipsis;white-space:nowrap}.jp-game{overflow:hidden;color:rgba(255,255,255,.66);font-size:11px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.jp-rarity{align-self:end;color:rgba(255,255,255,.56);font-size:10px;font-weight:700;white-space:nowrap}@keyframes jp-toast-in{to{opacity:1;transform:translateX(0) scale(1)}}@keyframes jp-toast-out{to{opacity:0;transform:translateX(28px) scale(.98)}}
      `}</style>
      <div className="jp-icon">{current.iconUrl ? <img src={current.iconUrl} /> : <FaTrophy className="jp-lock" />}</div>
      <div className="jp-copy"><div className="jp-label">Achievement unlocked</div><div className="jp-name">{current.achievementName || "Achievement unlocked"}</div><div className="jp-game">{current.gameTitle || "Non-Steam game"}</div></div>
      <div className="jp-rarity">{Number.isFinite(rarity) ? `${rarity.toFixed(1)}% players` : ""}</div>
    </div>, document.body,
  );
}

function Content() {
  return <PanelSection title="Notifications"><PanelSectionRow><ButtonItem layout="below" onClick={() => testNotification()}>Show test notification</ButtonItem></PanelSectionRow></PanelSection>;
}

export default definePlugin(() => {
  const overlayHost = document.createElement("div");
  overlayHost.id = "japanese-dashboard-achievement-overlay";
  document.body.appendChild(overlayHost);
  const overlayRoot = createRoot(overlayHost);
  overlayRoot.render(<AchievementOverlay />);
  const listener = addEventListener<[Achievement]>("achievement_unlocked", (event) => subscribers.forEach((subscriber) => subscriber(event)));
  return {
    name: "Japanese Dashboard Achievements",
    titleView: <div className={staticClasses.Title}>Japanese Dashboard</div>,
    content: <Content />,
    icon: <FaTrophy />,
    onDismount() {
      removeEventListener("achievement_unlocked", listener);
      overlayRoot.unmount();
      overlayHost.remove();
    },
  };
});
