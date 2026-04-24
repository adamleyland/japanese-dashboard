import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppProviders from "@/components/providers/AppProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "\u65e5\u672c\u8a9e Dashboard",
  description: "Adam's Japanese Learning Dashboard",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    apple: [
      {
        url: "https://storage.googleapis.com/jpdashboard_media/other_media/jpdashboard_app_icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const iosStandaloneViewportBootstrap = `
(function () {
  function isIosDevice() {
    var navigator = window.navigator || {};
    var platform = navigator.platform || "";
    var userAgent = navigator.userAgent || "";
    var maxTouchPoints = navigator.maxTouchPoints || 0;

    return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  }

  function isStandaloneDisplay() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  }

  function syncViewport() {
    var isIosStandalone = isIosDevice() && isStandaloneDisplay();
    var root = document.documentElement;
    var body = document.body;

    if (!body) {
      return;
    }

    root.classList.toggle("ios-standalone", isIosStandalone);
    body.classList.toggle("ios-standalone", isIosStandalone);
  }

  syncViewport();
  window.requestAnimationFrame(syncViewport);
})();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: iosStandaloneViewportBootstrap }} />
        <div className="ios-standalone-bg" aria-hidden="true" />
        <div className="app-root">
          <AppProviders>{children}</AppProviders>
        </div>
      </body>
    </html>
  );
}
