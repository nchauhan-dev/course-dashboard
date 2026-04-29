import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import type { Assignment, Submission } from '../../../../types/index'

interface Props {
  projectId: string
  assignmentId: string
  onClose: () => void
}

export default function AssignmentModal({ projectId, assignmentId, onClose }: Props) {
  const { projects, refreshCalendar } = useApp()
  const project = projects.find((c) => c.id === projectId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [submitNotes, setSubmitNotes] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  useEffect(() => {
    if (!project) return
    api.getAssignments(project.id, project.path, project.name, project.color).then((res) => {
      if (res.success && res.data) {
        setAssignment(res.data.find((a) => a.id === assignmentId) ?? null)
      }
      setIsLoading(false)
    })
  }, [project, assignmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!assignment || selectedFiles.length === 0) return
    setIsSubmitting(true)
    setSubmitError(null)
    const filePaths = selectedFiles.map((f) => (f as File & { path: string }).path)
    const result = await api.submitFiles({
      assignmentPath: assignment.path,
      assignmentId: assignment.id,
      due_date: assignment.due_date,
      filePaths,
      notes: submitNotes,
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
    await refreshCalendar()
    setIsSubmitting(false)
  }

  async function handleDeleteSubmission(submission: Submission) {
    if (!assignment) return
    await api.deleteSubmission(`${assignment.path}/submissions/${submission.id}.md`)
    setAssignment((prev) =>
      prev ? { ...prev, submissions: prev.submissions.filter((s) => s.id !== submission.id) } : prev
    )
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const due = assignment?.due_date ? new Date(assignment.due_date) : null
  const now = new Date()
  const isOverdue = due ? due < now : false
  const timeRemaining = due ? due.getTime() - now.getTime() : 0
  const daysLeft = Math.ceil(timeRemaining / 86400000)
  const hasSubmission = (assignment?.submissions.length ?? 0) > 0
  const hasLateSubmission = assignment?.submissions.some((s) => s.is_late) ?? false

  function statusBadge() {
    if (hasLateSubmission) return { label: 'Late Submission', cls: 'bg-red-100 text-red-700' }
    if (hasSubmission)     return { label: 'Submitted',       cls: 'bg-green-100 text-green-700' }
    if (isOverdue)         return { label: 'Overdue',         cls: 'bg-amber-100 text-amber-700' }
    return { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700' }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal panel */}
      <div
        className="relative flex flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{
          width: 700, maxWidth: '95vw', maxHeight: '80vh',
          background: 'var(--color-panel)',
          border: '1px solid var(--color-border)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 10,
            display: 'flex', padding: 5, borderRadius: 6,
            background: 'var(--color-panel2)', border: '1px solid var(--color-border)',
            color: 'var(--color-mute)', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-mute)')}
          title="Close (Esc)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Loading */}
        {(isLoading || !assignment || !project) ? (
          <div className="flex flex-1 items-center justify-center p-16">
            {isLoading ? (
              <div className="h-7 w-7 animate-spin rounded-full border-2" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            ) : (
              <p style={{ fontSize: 13, color: 'var(--color-mute)' }}>Assignment not found.</p>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              className="flex-shrink-0 px-6 pt-5 pb-4"
              style={{ borderBottom: '1px solid var(--color-border)', borderTop: `3px solid ${project.color}` }}
            >
              <div className="flex items-start justify-between gap-10 pr-8">
                <div className="min-w-0">
                  <p style={{ fontSize: 11, color: 'var(--color-mute)', marginBottom: 3 }}>{project.name}</p>
                  <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-ink)', margin: 0, lineHeight: 1.2 }}>
                    {assignment.name}
                  </h2>
                </div>
                <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusBadge().cls}`}>
                  {statusBadge().label}
                </span>
              </div>

              {due && (
                <div className="mt-2 flex flex-wrap gap-4" style={{ fontSize: 12.5, color: 'var(--color-mute)' }}>
                  <span>
                    Due:{' '}
                    <span style={{ fontWeight: 500, color: isOverdue && !hasSubmission ? 'var(--color-danger)' : 'var(--color-ink)' }}>
                      {due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </span>
                  {assignment.points > 0 && (
                    <span>Points: <span style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{assignment.points}</span></span>
                  )}
                  {!isOverdue && (
                    <span>
                      Time left:{' '}
                      <span style={{ fontWeight: 500, color: daysLeft <= 2 ? 'var(--color-danger)' : 'var(--color-ink)' }}>
                        {daysLeft === 0 ? 'Due today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Description */}
                {assignment.description && (
                  <div className="card p-4">
                    <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink2)', marginBottom: 6 }}>Description</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-ink2)', whiteSpace: 'pre-wrap', margin: 0 }}>{assignment.description}</p>
                  </div>
                )}

                {/* Instructions */}
                {assignment.instructions && (
                  <div className="card p-4">
                    <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink2)', marginBottom: 6 }}>Instructions</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-ink2)', whiteSpace: 'pre-wrap', margin: 0 }}>{assignment.instructions}</p>
                  </div>
                )}

                {/* Upload */}
                <div className="card p-4">
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink2)', marginBottom: 10 }}>Upload Submission</h3>
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                      onDragLeave={() => setIsDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragActive(false)
                        const dropped = Array.from(e.dataTransfer.files)
                        if (dropped.length > 0) setSelectedFiles((prev) => [...prev, ...dropped])
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 6, cursor: 'pointer', borderRadius: 8, padding: '18px 16px',
                        border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--color-border)'}`,
                        background: isDragActive ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : 'var(--color-panel2)',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={e => { if (!isDragActive) (e.currentTarget as HTMLElement).style.background = 'var(--color-border-s)' }}
                      onMouseLeave={e => { if (!isDragActive) (e.currentTarget as HTMLElement).style.background = 'var(--color-panel2)' }}
                    >
                      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                        style={{ color: isDragActive ? 'var(--accent)' : 'var(--color-mute)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 500, color: isDragActive ? 'var(--accent)' : 'var(--color-mute)' }}>
                        {isDragActive ? 'Drop files here' : 'Drop files or click to choose'}
                      </span>
                    </div>

                    {selectedFiles.length > 0 && (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {selectedFiles.map((f, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-ink2)' }}>
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-mute)', flexShrink: 0 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {f.name}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: 'var(--color-ink2)', marginBottom: 5 }}>Notes (optional)</label>
                      <textarea
                        value={submitNotes}
                        onChange={(e) => setSubmitNotes(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', color: 'var(--color-ink)' }}
                        placeholder="Any notes about this submission…"
                      />
                    </div>

                    {submitError && (
                      <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>{submitError}</div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || selectedFiles.length === 0}
                      className="btn-primary disabled:opacity-50"
                      style={{ alignSelf: 'flex-start' }}
                    >
                      {isSubmitting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : 'Submit'}
                    </button>
                  </form>
                </div>

                {/* Submission history */}
                {assignment.submissions.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink2)', marginBottom: 10 }}>
                      Submissions ({assignment.submissions.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          </>
        )}
      </div>
    </div>
  )
}

// ── Submission card ───────────────────────────────────────────────────────────

function SubmissionCard({ submission, assignmentPath, onDelete }: {
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-ink)' }}>
              {ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
            {submission.is_late ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {submission.days_late > 0 ? `${submission.days_late}d ${submission.hours_late}h late` : `${submission.hours_late}h late`}
              </span>
            ) : (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">On time</span>
            )}
          </div>

          {submission.files.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {submission.files.map((f) => (
                <div key={f} className="group flex items-center gap-1 rounded-md px-2 py-0.5" style={{ background: 'var(--color-panel2)' }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-mute)', flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="flex-1 truncate" style={{ fontSize: 11.5, color: 'var(--color-ink2)' }}>{f}</span>
                  <button type="button" title="Open file" onClick={() => api.openPath(`${submissionsDir}/${f}`)}
                    className="ml-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: 'var(--color-mute)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-mute)')}>
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                  <button type="button" title="Show in folder" onClick={() => api.openPath(submissionsDir)}
                    className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: 'var(--color-mute)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-mute)')}>
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L10.414 6.5A1 1 0 0011.121 6.793 1 1 0 0011.828 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {submission.notes && (
            <p style={{ marginTop: 6, fontSize: 11.5, color: 'var(--color-mute)', fontStyle: 'italic' }}>{submission.notes}</p>
          )}
        </div>

        <div className="flex-shrink-0">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button onClick={onDelete} className="rounded-md px-2 py-1 text-xs font-medium bg-red-500 text-white hover:bg-red-600">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1 text-xs font-medium hover:bg-gray-100" style={{ color: 'var(--color-ink2)' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="rounded-lg p-1 transition-colors"
              style={{ color: 'var(--color-mute)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-mute)')}
              title="Delete submission">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
