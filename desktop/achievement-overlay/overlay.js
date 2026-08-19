const toast = document.getElementById("toast");
const iconShell = document.querySelector(".icon-shell");
const achievementIcon = document.getElementById("achievement-icon");
const achievementName = document.getElementById("achievement-name");
const gameTitle = document.getElementById("game-title");
const rarity = document.getElementById("rarity");
const achievementSound = document.getElementById("achievement-sound");
const queue = [];
let showing = false;

achievementSound.volume = 0.7;
achievementIcon.addEventListener("error", () => iconShell.classList.remove("has-art"));

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function showNext() {
  if (showing || !queue.length) return;
  showing = true;
  const item = queue.shift();
  achievementName.textContent = safeText(item.achievementName, "Achievement unlocked");
  gameTitle.textContent = safeText(item.gameTitle, "Local game");
  const rarityValue = Number(item.rarityPercentage);
  rarity.textContent = Number.isFinite(rarityValue) ? `${rarityValue.toFixed(1)}% players` : "";

  const artworkUrl = safeText(item.iconUrl) || safeText(item.gameArtworkUrl);
  iconShell.classList.toggle("has-art", Boolean(artworkUrl));
  if (artworkUrl) achievementIcon.src = artworkUrl;
  else achievementIcon.removeAttribute("src");

  toast.className = "toast";
  void toast.offsetWidth;
  toast.classList.add("show");
  achievementSound.currentTime = 0;
  achievementSound.play().catch((error) => console.warn(`Achievement sound could not play: ${error.message}`));

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => {
      showing = false;
      toast.className = "toast";
      if (queue.length) showNext();
      else window.achievementOverlay.idle();
    }, 360);
  }, 8000);
}

window.achievementOverlay.onUnlocked((item) => {
  queue.push(item || {});
  showNext();
});
