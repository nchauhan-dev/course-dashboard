import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Course, CalendarEvent } from '../../../../types/index'
import { api } from '../lib/api'

interface AppState {
  rootPath: string | null
  activeWorkspace: string
  courses: Course[]
  calendarEvents: CalendarEvent[]
  isLoading: boolean
  error: string | null
}

interface AppContextValue extends AppState {
  workspacePath: string | null
  setRootPath: (path: string) => void
  setActiveWorkspace: (name: string) => void
  switchWorkspace: (name: string) => Promise<void>
  refreshCourses: () => Promise<void>
  refreshCalendar: () => Promise<void>
  addCourse: (course: Course) => void
  removeCourse: (courseId: string) => void
  clearError: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    rootPath: null,
    activeWorkspace: '',
    courses: [],
    calendarEvents: [],
    isLoading: true,
    error: null
  })

  const workspacePath = state.rootPath
    ? state.activeWorkspace
      ? `${state.rootPath}/${state.activeWorkspace}`
      : state.rootPath
    : null

  const refreshCourses = useCallback(async () => {
    if (!workspacePath) return
    const result = await api.getCourses(workspacePath)
    if (result.success && result.data) {
      setState((prev) => ({ ...prev, courses: result.data! }))
    }
  }, [workspacePath])

  const refreshCalendar = useCallback(async () => {
    if (!workspacePath) return
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + 60)
    const result = await api.getCalendarEvents(workspacePath, start.toISOString(), end.toISOString())
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

  const addCourse = useCallback((course: Course) => {
    setState((prev) => ({ ...prev, courses: [...prev.courses, course] }))
  }, [])

  const removeCourse = useCallback((courseId: string) => {
    setState((prev) => ({
      ...prev,
      courses: prev.courses.filter((c) => c.id !== courseId)
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
        setState((prev) => ({
          ...prev,
          rootPath: config.rootPath,
          activeWorkspace: config.activeWorkspace ?? '',
          isLoading: false
        }))
      } else {
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    })
  }, [])

  // Load courses + calendar whenever workspacePath changes
  useEffect(() => {
    if (!workspacePath) return
    setState((prev) => ({ ...prev, isLoading: true }))
    Promise.all([
      api.getCourses(workspacePath),
      api.getCalendarEvents(
        workspacePath,
        new Date().toISOString(),
        (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString() })()
      )
    ]).then(([coursesResult, eventsResult]) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        courses: coursesResult.success && coursesResult.data ? coursesResult.data : [],
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
        refreshCourses,
        refreshCalendar,
        addCourse,
        removeCourse,
        clearError
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
