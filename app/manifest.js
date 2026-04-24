export default function manifest() {
  return {
    name: "Japanese Dashboard",
    short_name: "JP Dashboard",
    description: "Adam's Japanese Learning Dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#eef2ff",
    theme_color: "#eef2ff",
    icons: [
      {
        src: "https://storage.googleapis.com/jpdashboard_media/other_media/jpdashboard_app_icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
