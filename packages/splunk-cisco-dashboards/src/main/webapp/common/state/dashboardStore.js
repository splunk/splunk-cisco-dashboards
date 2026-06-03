import { create } from 'zustand';

const useDashboardStore = create((set) => ({
    dashboardDefinition: null,
    refreshKey: 0, // Used to trigger re-renders
    setDashboardDefinition: (definition) => set({ dashboardDefinition: definition }),
    incrementRefreshKey: () => set((state) => ({ refreshKey: state.refreshKey + 1 })), // Forces refresh
    dashboardCoreApi: null,
    setDashboardCoreApi: (coreApi) => set({ dashboardCoreApi: coreApi }),
}));

export default useDashboardStore;
