"use client";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import StandaloneViewportProvider from "@/components/providers/StandaloneViewportProvider";
import { YoutubeSessionProvider } from "@/stores/youtubeSessionStore";

export default function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <StandaloneViewportProvider />
      <YoutubeSessionProvider>{children}</YoutubeSessionProvider>
    </ThemeProvider>
  );
}
