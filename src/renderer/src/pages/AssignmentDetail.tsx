import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import type { Assignment, Submission } from '../../../../types/index'

export default function AssignmentDetail() {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>()
  const { courses, refreshCalendar } = useApp()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const course = courses.find((c) => c.id === courseId)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [submitNotes, setSubmitNotes] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  useEffect(() => {
    if (!course) return
    api.getAssignments(course.id, course.path, course.name, course.color).then((res) => {
      if (res.success && res.data) {
        const found = res.data.find((a) => a.id === assignmentId)
        setAssignment(found ?? null)
      }
      setIsLoading(false)
    })
  }, [course, assignmentId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!assignment || selectedFiles.length === 0) return

    setIsSubmitting(true)
    setSubmitError(null)

    // In Electron, File objects have a .path property on macOS/Windows
    const filePaths = selectedFiles.map((f) => (f as File & { path: string }).path)

    const result = await api.submitFiles({
      assignmentPath: assignment.path,
      assignmentId: assignment.id,
      due_date: assignment.due_date,
      filePaths,
      notes: submitNotes
    })

    if (!result.success || !result.data) {
      setSubmitError(result.error ?? 'Submission failed')
      setIsSubmitting(false)
      return
    }

    setAssignment((prev) =>
      prev ? { ...prev, submissions: [result.data!, ...prev.submissions] } : prev
    )
    setSelectedFiles([])
    setSubmitNotes('')
    refreshCalendar()
    setIsSubmitting(false)
  }

  async function handleDeleteSubmission(submission: Submission) {
    if (!assignment) return
    const path = `${assignment.path}/submissions/${submission.id}.md`
    await api.deleteSubmission(path)
    setAssignment((prev) =>
      prev ? { ...prev, submissions: prev.submissions.filter((s) => s.id !== submission.id) } : prev
    )
  }

  if (!course || (!isLoading && !assignment)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Assignment not found.</p>
          <button className="btn-primary mt-4" onClick={() => navigate(`/course/${courseId}`)}>
            Back to Course
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !assignment) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const due = assignment.due_date ? new Date(assignment.due_date) : null
  const now = new Date()
  const isOverdue = due ? due < now : false
  const timeRemaining = due ? due.getTime() - now.getTime() : 0
  const daysLeft = Math.ceil(timeRemaining / 86400000)
  const hasSubmission = assignment.submissions.length > 0
  const hasLateSubmission = assignment.submissions.some((s) => s.is_late)

  function statusBadge() {
    if (hasLateSubmission) return { label: 'Late Submission', cls: 'bg-red-100 text-red-700' }
    if (hasSubmission) return { label: 'Submitted', cls: 'bg-green-100 text-green-700' }
    if (isOverdue) return { label: 'Overdue', cls: 'bg-amber-100 text-amber-700' }
    return { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700' }
  }

  const badge = statusBadge()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Title bar drag region */}
      <div className="drag-region h-8 flex-shrink-0" />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4" style={{ borderTopColor: course.color, borderTopWidth: 3 }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <button
                onClick={() => navigate(`/course/${courseId}`)}
                className="mb-1 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors no-drag"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {course.name}
              </button>
              <h1 className="text-xl font-bold text-gray-900">{assignment.name}</h1>
            </div>
            <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>
              {badge.label}
            </span>
          </div>

          {due && (
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
              <span>
                Due:{' '}
                <span className={`font-medium ${isOverdue && !hasSubmission ? 'text-red-600' : 'text-gray-800'}`}>
                  {due.toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit'
                  })}
                </span>
              </span>
              {assignment.points > 0 && (
                <span>
                  Points: <span className="font-medium text-gray-800">{assignment.points}</span>
                </span>
              )}
              {!isOverdue && (
                <span>
                  Time left:{' '}
                  <span className={`font-medium ${daysLeft <= 2 ? 'text-red-600' : 'text-gray-800'}`}>
                    {daysLeft === 0 ? 'Due today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl p-6 space-y-6">
            {/* Description */}
            {assignment.description && (
              <div className="card p-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-700">Description</h2>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{assignment.description}</p>
              </div>
            )}

            {/* Instructions */}
            {assignment.instructions && (
              <div className="card p-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-700">Instructions</h2>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{assignment.instructions}</p>
              </div>
            )}

            {/* Submit new files */}
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Upload Submission</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
                  />
                  {/* Drop zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragActive(true) }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false) }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDragActive(false)
                      const dropped = Array.from(e.dataTransfer.files)
                      if (dropped.length > 0) setSelectedFiles((prev) => [...prev, ...dropped])
                    }}
                    className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 transition-colors"
                    style={isDragActive
                      ? { borderColor: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 8%, white)' }
                      : { borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }
                    }
                    onMouseEnter={(e) => { if (!isDragActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#f3f4f6' }}
                    onMouseLeave={(e) => { if (!isDragActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb' }}
                  >
                    <svg
                      className="h-6 w-6"
                      style={{ color: isDragActive ? 'var(--accent)' : '#d1d5db' }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-xs font-medium" style={{ color: isDragActive ? 'var(--accent)' : '#9ca3af' }}>
                      {isDragActive ? 'Drop files here' : 'Drop files or click to choose'}
                    </span>
                  </div>
                  {selectedFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {selectedFiles.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {f.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Notes (optional)</label>
                  <textarea
                    value={submitNotes}
                    onChange={(e) => setSubmitNotes(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Any notes about this submission…"
                  />
                </div>

                {submitError && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || selectedFiles.length === 0}
                  className="btn-primary disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Submit'
                  )}
                </button>
              </form>
            </div>

            {/* Submissions history */}
            {assignment.submissions.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-gray-700">
                  Submissions ({assignment.submissions.length})
                </h2>
                <div className="space-y-3">
                  {assignment.submissions.map((sub) => (
                    <SubmissionCard
                      key={sub.id}
                      submission={sub}
                      assignmentPath={assignment.path}
                      onDelete={() => handleDeleteSubmission(sub)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SubmissionCard({
  submission,
  assignmentPath,
  onDelete
}: {
  submission: Submission
  assignmentPath: string
  onDelete: () => void
}) {
  const submissionsDir = `${assignmentPath}/submissions`
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ts = new Date(submission.submission_timestamp)

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800">
                {ts.toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit'
                })}
              </span>
              {submission.is_late ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {submission.days_late > 0
                    ? `${submission.days_late}d ${submission.hours_late}h late`
                    : `${submission.hours_late}h late`}
                </span>
              ) : (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  On time
                </span>
              )}
            </div>

          {submission.files.length > 0 && (
            <div className="mt-2 space-y-1">
              {submission.files.map((f) => (
                <div
                  key={f}
                  className="group flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5"
                >
                  {/* file icon */}
                  <svg className="h-3 w-3 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>

                  <span className="flex-1 truncate text-xs text-gray-600">{f}</span>

                  {/* Open File */}
                  <button
                    type="button"
                    title="Open file"
                    onClick={() => api.openPath(`${submissionsDir}/${f}`)}
                    className="ml-1 rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>

                  {/* Open Folder */}
                  <button
                    type="button"
                    title="Show in folder"
                    onClick={() => api.openPath(submissionsDir)}
                    className="rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L10.414 6.5A1 1 0 0011.121 6.793 1 1 0 0011.828 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {submission.notes && (
            <p className="mt-2 text-xs text-gray-500 italic">{submission.notes}</p>
          )}
        </div>

        <div className="flex-shrink-0">
            {confirmDelete ? (
              <div className="flex gap-2">
                <button
                  onClick={onDelete}
                  className="rounded-md px-2 py-1 text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                title="Delete submission"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
      </div>
    </div>
  )
}
