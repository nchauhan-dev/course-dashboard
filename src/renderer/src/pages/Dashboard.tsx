import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import CourseCard from '../components/CourseCard'
import CalendarPanel from '../components/CalendarPanel'
import NewCourseModal from '../components/NewCourseModal'
import SettingsModal from '../components/SettingsModal'

export default function Dashboard() {
  const { courses, calendarEvents, rootPath, activeWorkspace, switchWorkspace } = useApp()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [showNewCourse, setShowNewCourse] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
  const [wsBtnHovered, setWsBtnHovered] = useState(false)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rootPath) return
    api.getWorkspaces(rootPath).then((res) => {
      if (res.success && res.data) setWorkspaces(res.data)
    })
  }, [rootPath, activeWorkspace])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(e.target as Node)) {
        setShowWorkspaceMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSwitchWorkspace(name: string) {
    setShowWorkspaceMenu(false)
    if (name === activeWorkspace) return
    await switchWorkspace(name)
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    const name = newWorkspaceName.trim()
    if (!name || !rootPath) return
    setIsCreatingWorkspace(true)
    await api.createWorkspace(rootPath, name)
    await switchWorkspace(name)
    setNewWorkspaceName('')
    setShowNewWorkspace(false)
    setShowWorkspaceMenu(false)
    setIsCreatingWorkspace(false)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar */}
      <aside
        className="flex flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50 overflow-hidden"
        style={{ width: collapsed ? 60 : 224, transition: 'width 200ms ease-in-out' }}
      >
        <div className="drag-region h-8 flex-shrink-0" />

        {/* ── Collapsed state ── */}
        {collapsed && (
          <div className="flex flex-1 flex-col items-center py-2 no-drag">
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="flex flex-1 items-center justify-center overflow-hidden py-4">
              <span
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                className="text-xs font-medium text-gray-400 select-none"
              >
                {activeWorkspace || 'Courses'}
              </span>
            </div>

            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Expanded state ── */}
        {!collapsed && (
          <div className="flex flex-1 flex-col overflow-hidden px-3 pb-2">
            {/* Collapse arrow */}
            <div className="mb-2 flex justify-end no-drag">
              <button
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* App name */}
            <div className="mb-3 flex items-center gap-2 px-1">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-800 truncate">Courses</span>
            </div>

            {/* Workspace selector */}
            <div className="relative mb-3 no-drag" ref={workspaceMenuRef}>
              <button
                onClick={() => { setShowWorkspaceMenu((v) => !v); setShowNewWorkspace(false) }}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <span className="truncate font-medium text-gray-700">
                  {activeWorkspace || 'No workspace'}
                </span>
                <svg className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </button>

              {showWorkspaceMenu && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {workspaces.map((ws) => (
                    <button
                      key={ws}
                      onClick={() => handleSwitchWorkspace(ws)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 transition-colors ${
                        ws === activeWorkspace ? 'font-medium' : 'text-gray-700'
                      }`}
                      style={ws === activeWorkspace ? { color: 'var(--accent)' } : undefined}
                    >
                      {ws === activeWorkspace && (
                        <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={ws === activeWorkspace ? '' : 'ml-5'}>{ws}</span>
                    </button>
                  ))}

                  <div className="my-1 border-t border-gray-100" />

                  {showNewWorkspace ? (
                    <form onSubmit={handleCreateWorkspace} className="px-2 py-1.5">
                      <input
                        type="text"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        placeholder="Workspace name…"
                        autoFocus
                        className="mb-1.5 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowNewWorkspace(false)}
                          className="flex-1 rounded-md border border-gray-200 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isCreatingWorkspace || !newWorkspaceName.trim()}
                          className="flex-1 rounded-md py-1 text-xs font-medium text-white disabled:opacity-50"
                          style={{ backgroundColor: 'var(--accent)', filter: wsBtnHovered ? 'brightness(0.9)' : undefined }}
                          onMouseEnter={() => setWsBtnHovered(true)}
                          onMouseLeave={() => setWsBtnHovered(false)}
                        >
                          {isCreatingWorkspace ? '…' : 'Create'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowNewWorkspace(true)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      New Workspace
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Nav links */}
            <div className="flex-1 overflow-y-auto space-y-0.5 no-drag">
              <button
                onClick={() => navigate('/dashboard')}
                className="sidebar-item active w-full"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </button>

              {courses.length > 0 && (
                <div className="pt-2">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Courses
                  </p>
                  {courses.map((course) => (
                    <button
                      key={course.id}
                      onClick={() => navigate(`/course/${course.id}`)}
                      className="sidebar-item w-full"
                    >
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: course.color }} />
                      <span className="truncate">{course.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom actions + hamburger */}
            <div className="space-y-0.5 border-t border-gray-200 pt-2 no-drag">
              <button
                onClick={() => setShowNewCourse(true)}
                className="sidebar-item w-full"
                style={{ color: 'var(--accent)' }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Course
              </button>

              {/* Settings gear — opens SettingsModal */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="sidebar-item w-full"
                title={`Vault: ${rootPath}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>

              <button
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
                className="sidebar-item w-full text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Collapse
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Center — Course grid */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="drag-region h-8 flex-shrink-0" />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500">
                {courses.length === 0
                  ? 'No courses yet'
                  : `${courses.length} course${courses.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button onClick={() => setShowNewCourse(true)} className="btn-primary no-drag">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Course
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No courses yet</h3>
              <p className="mt-1 text-sm text-gray-500">Create your first course to get started.</p>
              <button onClick={() => setShowNewCourse(true)} className="btn-primary mt-4 no-drag">
                Create a Course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Right — Calendar */}
      <aside className="hidden w-72 flex-shrink-0 overflow-hidden border-l border-gray-200 bg-white lg:flex lg:flex-col">
        <div className="drag-region h-8 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-4 no-drag">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Calendar</h2>
          <CalendarPanel events={calendarEvents} />
        </div>
      </aside>

      {showNewCourse && (
        <NewCourseModal onClose={() => setShowNewCourse(false)} />
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
