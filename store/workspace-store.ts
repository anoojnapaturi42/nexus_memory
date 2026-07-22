import { create } from "zustand";
import type { WorkspaceMode } from "@/types/workspace";

type WorkspaceState = {
  activeWorkspaceId: string | null;
  activeMode: WorkspaceMode;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  setActiveMode: (mode: WorkspaceMode) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: null,
  activeMode: "personal",
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
  setActiveMode: (activeMode) => set({ activeMode }),
}));
