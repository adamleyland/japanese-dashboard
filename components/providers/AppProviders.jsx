"use client";

import { YoutubeSessionProvider } from "@/stores/youtubeSessionStore";

export default function AppProviders({ children }) {
  return <YoutubeSessionProvider>{children}</YoutubeSessionProvider>;
}
