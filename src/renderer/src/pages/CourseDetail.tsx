import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import CalendarPanel from '../components/CalendarPanel'
import type { Assignment } from '../../../../types/index'

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const { courses, calendarEvents } = useApp()
  const navigate = useNavigate()

  const course = courses.find((c) => c.id === courseId)

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedSection, setSelectedSection] = useState('Assignments')
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
  }, [course])

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

          <p className="px-1 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Sections
          </p>
          <div className="flex-1 overflow-y-auto space-y-0.5 no-drag">
            {course.sections.map((section) => (
              <button
                key={section}
                onClick={() => setSelectedSection(section)}
                className={`sidebar-item w-full ${selectedSection === section ? 'active' : ''}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                {section}
              </button>
            ))}
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
          {selectedSection === 'Assignments' ? (
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
          ) : (
            <SectionView
              sectionPath={`${course.path}/${selectedSection}`}
              sectionName={selectedSection}
            />
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

// ── Section file browser ─────────────────────────────────────────────────────

function SectionView({ sectionPath, sectionName }: { sectionPath: string; sectionName: string }) {
  const [files, setFiles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.getSectionFiles(sectionPath).then((res) => {
      if (res.success && res.data) setFiles(res.data)
      setIsLoading(false)
    })
  }, [sectionPath])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-gray-900">{sectionName}</h2>
      {files.length === 0 ? (
        <p className="text-sm text-gray-400">No files in this section yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <button
              key={file}
              onClick={() => api.openPath(`${sectionPath}/${file}`)}
              className="card flex w-full items-center gap-3 p-3 text-left hover:shadow-md transition-shadow no-drag"
            >
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-gray-700">{file}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
