import { create } from "zustand";

type NavigationState = {
  activePath: string;
  mobileNavOpen: boolean;
  setActivePath: (path: string) => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
};

export const useNavigationStore = create<NavigationState>((set) => ({
  activePath: "/",
  mobileNavOpen: false,
  setActivePath: (activePath) => set({ activePath }),
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
}));
