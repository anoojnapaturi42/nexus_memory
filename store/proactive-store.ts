import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type ProactiveStoreState = {
  selectedRecommendationId: string | null;
  autoRefreshEnabled: boolean;
  setSelectedRecommendationId: (id: string | null) => void;
  setAutoRefreshEnabled: (value: boolean) => void;
};

export const useProactiveStore = create<ProactiveStoreState>()(
  persist(
    (set) => ({
      selectedRecommendationId: null,
      autoRefreshEnabled: true,
      setSelectedRecommendationId: (selectedRecommendationId) => set({ selectedRecommendationId }),
      setAutoRefreshEnabled: (autoRefreshEnabled) => set({ autoRefreshEnabled }),
    }),
    {
      name: "google-nexus-memory-proactive",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : undefined)),
    },
  ),
);
