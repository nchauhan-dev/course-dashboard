import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import CalendarPanel from '../components/CalendarPanel'
import FileTree from '../components/FileTree'
import type { Assignment, TreeNode } from '../../../../types/index'

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const { courses, calendarEvents } = useApp()
  const navigate = useNavigate()

  const course = courses.find((c) => c.id === courseId)

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeTab, setActiveTab] = useState<'assignments' | 'folder'>('assignments')
  const [topLevelFolders, setTopLevelFolders] = useState<TreeNode[]>([])
  const [selectedFolder, setSelectedFolder] = useState<TreeNode | null>(null)
  const [creatingTopFolder, setCreatingTopFolder] = useState(false)
  const [newTopFolderName, setNewTopFolderName] = useState('')
  const [creatingSubfolder, setCreatingSubfolder] = useState(false)
  const [newSubfolderName, setNewSubfolderName] = useState('')
  const [fileTreeKey, setFileTreeKey] = useState(0)
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [showNewAssignment, setShowNewAssignment] = useState(false)

  // New assignment form state
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newPoints, setNewPoints] = useState('100')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!course) return
    setIsLoadingAssignments(true)
    api
      .getAssignments(course.id, course.path, course.name, course.color)
      .then((res) => {
        if (res.success && res.data) setAssignments(res.data)
        setIsLoadingAssignments(false)
      })
    api.readDirectory(course.path).then((res) => {
      if (res.success && res.data) {
        const dirs = res.data.filter((n) => n.isDirectory)
        setTopLevelFolders(dirs)
        if (dirs.length > 0) {
          setSelectedFolder(dirs[0])
          setActiveTab('folder')
        }
      }
    })
  }, [course])

  async function reloadTopLevelFolders(selectName?: string) {
    if (!course) return
    const res = await api.readDirectory(course.path)
    if (!res.success || !res.data) return
    const dirs = res.data.filter((n) => n.isDirectory)
    setTopLevelFolders(dirs)
    if (selectName) {
      const target = dirs.find((d) => d.name === selectName)
      if (target) { setSelectedFolder(target); setActiveTab('folder') }
    } else if (dirs.length > 0) {
      setSelectedFolder(dirs[0])
      setActiveTab('folder')
    } else {
      setSelectedFolder(null)
      setActiveTab('assignments')
    }
  }

  async function handleCreateSubfolder(e: React.FormEvent) {
    e.preventDefault()
    const name = newSubfolderName.trim()
    if (!name || !selectedFolder) return
    await api.createFolder(`${selectedFolder.path}/${name}`)
    setCreatingSubfolder(false)
    setNewSubfolderName('')
    setFileTreeKey((k) => k + 1)
  }

  async function handleCreateTopFolder(e: React.FormEvent) {
    e.preventDefault()
    const name = newTopFolderName.trim()
    if (!name || !course) return
    await api.createFolder(`${course.path}/${name}`)
    setCreatingTopFolder(false)
    setNewTopFolderName('')
    reloadTopLevelFolders(name)
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!course || !newName.trim() || !newDueDate) return
    setIsCreating(true)
    setCreateError(null)

    const result = await api.createAssignment({
      coursePath: course.path,
      courseId: course.id,
      name: newName.trim(),
      description: newDesc.trim(),
      due_date: new Date(newDueDate).toISOString(),
      points: Number(newPoints) || 0,
      instructions: ''
    })

    if (!result.success || !result.data) {
      setCreateError(result.error ?? 'Failed to create assignment')
      setIsCreating(false)
      return
    }

    setAssignments((prev) => [
      ...prev,
      { ...result.data!, courseId: course.id, courseName: course.name, courseColor: course.color }
    ])
    setNewName('')
    setNewDesc('')
    setNewDueDate('')
    setNewPoints('100')
    setShowNewAssignment(false)
    setIsCreating(false)
  }

  if (!course) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Course not found.</p>
          <button className="btn-primary mt-4" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const now = new Date()
  const upcoming = assignments.filter((a) => a.due_date && new Date(a.due_date) >= now)
  const past = assignments.filter((a) => a.due_date && new Date(a.due_date) < now)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50 overflow-hidden">
        <div className="drag-region h-8 flex-shrink-0" />
        <div className="flex flex-col flex-1 overflow-hidden px-3 pb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="sidebar-item mb-3 w-full no-drag"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>

          <div className="mb-3 flex items-center gap-2 px-1">
            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: course.color }} />
            <span className="text-sm font-semibold text-gray-800 truncate">{course.name}</span>
          </div>

          <div className="flex-1 overflow-y-auto no-drag">
            <button
              onClick={() => setActiveTab('assignments')}
              className={`sidebar-item w-full ${activeTab === 'assignments' ? 'active' : ''}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Assignments
            </button>

            <div className="my-8 border-t border-gray-300" />

            {topLevelFolders.map((folder) => (
              <FolderSidebarItem
                key={folder.path}
                folder={folder}
                isActive={activeTab === 'folder' && selectedFolder?.path === folder.path}
                onSelect={(f) => { setSelectedFolder(f); setActiveTab('folder') }}
                onReload={reloadTopLevelFolders}
              />
            ))}

            {creatingTopFolder ? (
              <form
                onSubmit={handleCreateTopFolder}
                className="flex items-center gap-2 px-2 py-1"
              >
                <svg className="h-4 w-4 flex-shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <input
                  autoFocus
                  type="text"
                  value={newTopFolderName}
                  onChange={(e) => setNewTopFolderName(e.target.value)}
                  onBlur={() => { setCreatingTopFolder(false); setNewTopFolderName('') }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingTopFolder(false); setNewTopFolderName('') } }}
                  className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-0.5 text-xs"
                  placeholder="Folder name"
                />
              </form>
            ) : (
              <button
                onClick={() => setCreatingTopFolder(true)}
                className="sidebar-item w-full text-gray-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Folder
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Center */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="drag-region h-8 flex-shrink-0" />

        {/* Course header */}
        <div className="border-b border-gray-200 px-6 py-4" style={{ borderTopColor: course.color, borderTopWidth: 3 }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{course.name}</h1>
              {course.description && (
                <p className="mt-0.5 text-sm text-gray-500">{course.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'assignments' ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Assignments</h2>
                <button
                    onClick={() => setShowNewAssignment(true)}
                    className="btn-primary no-drag text-xs py-1.5 px-3"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    New Assignment
                  </button>
              </div>

              {isLoadingAssignments ? (
                <div className="flex justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                </div>
              ) : (
                <>
                  {upcoming.length > 0 && (
                    <div className="mb-6">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Upcoming</p>
                      <div className="space-y-2">
                        {upcoming.map((a) => (
                          <AssignmentRow key={a.id} assignment={a} courseId={course.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {past.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Past</p>
                      <div className="space-y-2">
                        {past.map((a) => (
                          <AssignmentRow key={a.id} assignment={a} courseId={course.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {assignments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <p className="text-gray-400 text-sm">No assignments yet.</p>
                      <button
                        onClick={() => setShowNewAssignment(true)}
                        className="btn-primary mt-3 no-drag text-xs"
                      >
                        Add First Assignment
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : selectedFolder ? (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">{selectedFolder.name}</h2>
                <button
                  onClick={() => { setCreatingSubfolder(true); setNewSubfolderName('') }}
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="New subfolder"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              {creatingSubfolder && (
                <form onSubmit={handleCreateSubfolder} className="mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 flex-shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <input
                    autoFocus
                    type="text"
                    value={newSubfolderName}
                    onChange={(e) => setNewSubfolderName(e.target.value)}
                    onBlur={() => { setCreatingSubfolder(false); setNewSubfolderName('') }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingSubfolder(false); setNewSubfolderName('') } }}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Subfolder name"
                  />
                </form>
              )}
              <FileTree key={fileTreeKey} rootPath={selectedFolder.path} />
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4">Select a folder from the sidebar.</p>
          )}
        </div>
      </main>

      {/* Right — Calendar */}
      <aside className="hidden w-72 flex-shrink-0 overflow-hidden border-l border-gray-200 bg-white lg:flex lg:flex-col">
        <div className="drag-region h-8 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-4 no-drag">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Course Calendar</h2>
          <CalendarPanel events={calendarEvents} courseId={course.id} />
        </div>
      </aside>

      {/* New assignment modal */}
      {showNewAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Assignment</h2>
              <button
                onClick={() => setShowNewAssignment(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Due date</label>
                  <input
                    type="datetime-local"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Points</label>
                  <input
                    type="number"
                    value={newPoints}
                    onChange={(e) => setNewPoints(e.target.value)}
                    min={0}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {createError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{createError}</div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNewAssignment(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={isCreating} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {isCreating ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Folder sidebar item ───────────────────────────────────────────────────────

function FolderSidebarItem({
  folder,
  isActive,
  onSelect,
  onReload
}: {
  folder: TreeNode
  isActive: boolean
  onSelect: (folder: TreeNode) => void
  onReload: (selectName?: string) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [menuOpen])

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    const newName = renameValue.trim()
    if (!newName || newName === folder.name) { setIsRenaming(false); return }
    await api.renameFolder({ oldPath: folder.path, newName })
    setIsRenaming(false)
    onReload(newName)
  }

  async function handleDelete() {
    await api.deleteFolder({ folderPath: folder.path })
    onReload()
  }

  if (isRenaming) {
    return (
      <form onSubmit={handleRename} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
        <svg className="h-4 w-4 flex-shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <input
          autoFocus
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => setIsRenaming(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setIsRenaming(false) }}
          className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-0.5 text-xs"
        />
      </form>
    )
  }

  if (isDeleting) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1.5">
        <span className="flex-1 truncate text-xs font-medium text-red-600">Delete?</span>
        <button
          onClick={handleDelete}
          className="flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600"
        >
          Delete
        </button>
        <button
          onClick={() => setIsDeleting(false)}
          className="flex-shrink-0 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={() => onSelect(folder)}
        className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
        style={{ paddingRight: isHovered || menuOpen ? '1.75rem' : undefined }}
      >
        <svg className="h-4 w-4 flex-shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span className="truncate">{folder.name}</span>
      </button>

      {(isHovered || menuOpen) && (
        <div ref={menuRef} className="absolute right-1 top-1/2 -translate-y-1/2 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="flex items-center justify-center rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-28 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg z-50">
              <button
                onClick={() => { setMenuOpen(false); setRenameValue(folder.name); setIsRenaming(true) }}
                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Rename
              </button>
              <button
                onClick={() => { setMenuOpen(false); setIsDeleting(true) }}
                className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tracked assignment row ────────────────────────────────────────────────────

function AssignmentRow({ assignment, courseId }: { assignment: Assignment; courseId: string }) {
  const navigate = useNavigate()
  const due = new Date(assignment.due_date)
  const isOverdue = due < new Date()
  const hasLate = assignment.submissions.some((s) => s.is_late)
  const hasSubmission = assignment.submissions.length > 0

  return (
    <button
      onClick={() => navigate(`/course/${courseId}/assignment/${assignment.id}`)}
      className="card w-full p-4 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{assignment.name}</p>
          {assignment.description && (
            <p className="mt-0.5 text-sm text-gray-500 truncate">{assignment.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasSubmission && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              hasLate ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              {hasLate ? 'Late' : 'Submitted'}
            </span>
          )}
          {!hasSubmission && isOverdue && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Overdue
            </span>
          )}
          {assignment.points > 0 && (
            <span className="text-xs text-gray-400">{assignment.points}pts</span>
          )}
        </div>
      </div>
      <p className={`mt-2 text-xs ${isOverdue && !hasSubmission ? 'text-red-500' : 'text-gray-400'}`}>
        Due {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </p>
    </button>
  )
}

