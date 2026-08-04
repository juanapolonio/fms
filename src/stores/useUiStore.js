import { create } from 'zustand';

export const useUiStore = create((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  selectedRecord: null,
  setSelectedRecord: (record) => set({ selectedRecord: record }),
}));
