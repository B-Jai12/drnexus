import { create } from "zustand"
import type { Transaction, FinancialSummary, Prediction, Recommendation, User } from "@/types"

interface AppState {
  // User
  user: User | null
  setUser: (user: User | null) => void

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // Financial data
  transactions: Transaction[]
  summary: FinancialSummary
  predictions: Prediction[]
  recommendations: Recommendation[]

  // UI State
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  activeFilters: {
    search: string
    category: string
    dateRange: { from: string; to: string } | null
    sortOrder: "asc" | "desc"
  }
  setFilter: (key: string, value: unknown) => void
  resetFilters: () => void

  // Notifications
  notifications: Notification[]
  addNotification: (notification: Notification) => void
  clearNotification: (id: string) => void

  // Global data refresh trigger
  dataVersion: number
  bumpDataVersion: () => void
}

interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  timestamp: Date
  read: boolean
}

const defaultFilters = {
  search: "",
  category: "all",
  dateRange: null,
  sortOrder: "desc" as const,
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  transactions: [],
  summary: {
    totalDebit: 0,
    totalCredit: 0,
    netSavings: 0,
    healthScore: 0,
    monthlyExpenses: [],
    categoryBreakdown: [],
  },
  predictions: [],
  recommendations: [],

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  activeFilters: defaultFilters,
  setFilter: (key, value) =>
    set((state) => ({
      activeFilters: { ...state.activeFilters, [key]: value },
    })),
  resetFilters: () => set({ activeFilters: defaultFilters }),

  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),
  clearNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  dataVersion: 0,
  bumpDataVersion: () =>
    set((state) => ({
      dataVersion: state.dataVersion + 1,
    })),
}))
