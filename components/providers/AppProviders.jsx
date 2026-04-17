"use client";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { YoutubeSessionProvider } from "@/stores/youtubeSessionStore";

export default function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <YoutubeSessionProvider>{children}</YoutubeSessionProvider>
    </ThemeProvider>
  );
}
