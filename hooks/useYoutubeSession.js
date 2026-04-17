import { useYoutubeSessionContext } from "@/stores/youtubeSessionStore";

export function useYoutubeSession() {
  return useYoutubeSessionContext();
}
