import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Project, CalendarEvent } from '../../../../types/index'
import { api } from '../lib/api'

interface AppState {
  rootPath: string | null
  activeWorkspace: string
  userName: string
  projects: Project[]
  calendarEvents: CalendarEvent[]
  isLoading: boolean
  error: string | null
}

interface AppContextValue extends AppState {
  workspacePath: string | null
  setRootPath: (path: string) => void
  setActiveWorkspace: (name: string) => void
  switchWorkspace: (name: string) => Promise<void>
  refreshProjects: () => Promise<void>
  refreshCalendar: () => Promise<void>
  addProject: (project: Project) => void
  removeProject: (projectId: string) => void
  clearError: () => void
  // Global assignment modal
  openAssignment: { projectId: string; assignmentId: string } | null
  openAssignmentModal: (projectId: string, assignmentId: string) => void
  closeAssignmentModal: () => void
  // Dashboard page persistence
  dashboardPage: number
  setDashboardPage: (page: number) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [openAssignment, setOpenAssignment] = useState<{ projectId: string; assignmentId: string } | null>(null)
  const [dashboardPage, setDashboardPage] = useState(0)

  const openAssignmentModal = useCallback((projectId: string, assignmentId: string) => {
    setOpenAssignment({ projectId, assignmentId })
  }, [])

  const closeAssignmentModal = useCallback(() => {
    setOpenAssignment(null)
  }, [])

  const [state, setState] = useState<AppState>({
    rootPath: null,
    activeWorkspace: '',
    userName: '',
    projects: [],
    calendarEvents: [],
    isLoading: true,
    error: null
  })

  const workspacePath = state.rootPath
    ? state.activeWorkspace
      ? `${state.rootPath}/${state.activeWorkspace}`
      : state.rootPath
    : null

  const refreshProjects = useCallback(async () => {
    if (!workspacePath) return
    const result = await api.getProjects(workspacePath)
    if (result.success && result.data) {
      setState((prev) => ({ ...prev, projects: result.data! }))
    }
  }, [workspacePath])

  const refreshCalendar = useCallback(async () => {
    if (!workspacePath) return
    const result = await api.getCalendarEvents(workspacePath)
    if (result.success && result.data) {
      setState((prev) => ({ ...prev, calendarEvents: result.data! }))
    }
  }, [workspacePath])

  const setRootPath = useCallback((path: string) => {
    setState((prev) => ({ ...prev, rootPath: path }))
  }, [])

  const setActiveWorkspace = useCallback((name: string) => {
    setState((prev) => ({ ...prev, activeWorkspace: name }))
  }, [])

  const switchWorkspace = useCallback(async (name: string) => {
    if (!state.rootPath) return
    await api.switchWorkspace(state.rootPath, name)
    setState((prev) => ({ ...prev, activeWorkspace: name }))
  }, [state.rootPath])

  const addProject = useCallback((project: Project) => {
    setState((prev) => ({ ...prev, projects: [...prev.projects, project] }))
  }, [])

  const removeProject = useCallback((projectId: string) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.filter((c) => c.id !== projectId)
    }))
  }, [])

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  // On mount, try to find an existing config
  useEffect(() => {
    api.findExistingConfig().then((result) => {
      if (result.success && result.data) {
        const config = result.data
        if (config.accentColor) {
          document.documentElement.style.setProperty('--accent', config.accentColor)
        }
        if (config.theme === 'dark') {
          document.documentElement.dataset.theme = 'dark'
        } else {
          delete document.documentElement.dataset.theme
        }
        setState((prev) => ({
          ...prev,
          rootPath: config.rootPath,
          activeWorkspace: config.activeWorkspace ?? '',
          userName: config.userName ?? '',
          isLoading: false
        }))
      } else {
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    })
  }, [])

  // Load projects + calendar whenever workspacePath changes
  useEffect(() => {
    if (!workspacePath) return
    setState((prev) => ({ ...prev, isLoading: true }))
    Promise.all([
      api.getProjects(workspacePath),
      api.getCalendarEvents(workspacePath)
    ]).then(([projectsResult, eventsResult]) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        projects: projectsResult.success && projectsResult.data ? projectsResult.data : [],
        calendarEvents: eventsResult.success && eventsResult.data ? eventsResult.data : []
      }))
    })
  }, [workspacePath])

  return (
    <AppContext.Provider
      value={{
        ...state,
        workspacePath,
        setRootPath,
        setActiveWorkspace,
        switchWorkspace,
        refreshProjects,
        refreshCalendar,
        addProject,
        removeProject,
        clearError,
        openAssignment,
        openAssignmentModal,
        closeAssignmentModal,
        dashboardPage,
        setDashboardPage,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
