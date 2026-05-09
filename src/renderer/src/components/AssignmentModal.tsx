import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import type { Assignment, Submission } from '../../../../types/index'

interface Props {
  projectId: string
  assignmentId: string
  onClose: () => void
}

// Convert an ISO string to the value format datetime-local expects: "YYYY-MM-DDTHH:MM"
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + 'T' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0')
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

  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDueDate, setDraftDueDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function fetchAssignment() {
    if (!project) return
    api.getAssignments(project.id, project.path, project.name, project.color).then((res) => {
      if (res.success && res.data) {
        setAssignment(res.data.find((a) => a.id === assignmentId) ?? null)
      }
      setIsLoading(false)
    })
  }

  useEffect(() => {
    fetchAssignment()
  }, [project, assignmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  function startEditing() {
    if (!assignment) return
    setDraftName(assignment.name)
    setDraftDueDate(assignment.due_date ? toDatetimeLocal(assignment.due_date) : '')
    setSaveError(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setSaveError(null)
  }

  async function handleSave() {
    if (!assignment || !draftName.trim() || !draftDueDate) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const result = await api.updateAssignment({
        assignmentPath: assignment.path,
        name: draftName.trim(),
        due_date: new Date(draftDueDate).toISOString(),
      })
      if (!result.success) {
        setSaveError(result.error ?? 'Failed to save')
        return
      }
      setIsEditing(false)
      fetchAssignment()
      await refreshCalendar()
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setIsSaving(false)
    }
  }

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
    if (hasLateSubmission) return { label: 'Late Submission', bg: 'var(--color-danger-soft)',   color: 'var(--color-danger)' }
    if (hasSubmission)     return { label: 'Submitted',       bg: 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }
    if (isOverdue)         return { label: 'Overdue',         bg: 'var(--color-danger-soft)',   color: 'var(--color-danger)' }
    return                        { label: 'Upcoming',        bg: 'var(--accent-soft)',          color: 'var(--accent)' }
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
          width: 820, maxWidth: '96vw', maxHeight: '82vh',
          background: 'var(--color-panel)',
          border: '1px solid var(--color-border)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Close button — 32×32 for adequate hit area */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--color-panel2)', border: '1px solid var(--color-border)',
            color: 'var(--color-mute)', cursor: 'pointer',
            transition: 'color 120ms ease, transform 120ms ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-mute)')}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
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
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="flex items-start justify-between gap-10 pr-8">
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 11, color: 'var(--color-mute)', marginBottom: 3 }}>{project.name}</p>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%', fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em',
                        color: 'var(--color-ink)', background: 'var(--color-panel2)',
                        border: '1px solid var(--color-border)', borderRadius: 6,
                        padding: '3px 8px', fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-ink)', margin: 0, lineHeight: 1.2 }}>
                        {assignment.name}
                      </h2>
                      <button
                        onClick={startEditing}
                        title="Edit assignment"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: 6,
                          color: 'var(--color-mute)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                          transition: 'background-color 120ms ease, color 120ms ease, transform 120ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-border-s)'; e.currentTarget.style.color = 'var(--color-ink2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-mute)' }}
                        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
                        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {!isEditing && (() => { const b = statusBadge(); return (
                  <span style={{ flexShrink: 0, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 500, background: b.bg, color: b.color }}>
                    {b.label}
                  </span>
                )})()}
              </div>

              {isEditing && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--color-mute)', marginBottom: 4 }}>Due date &amp; time</label>
                    <input
                      type="datetime-local"
                      value={draftDueDate}
                      onChange={(e) => setDraftDueDate(e.target.value)}
                      className="form-input"
                      style={{
                        fontSize: 13, color: 'var(--color-ink)', background: 'var(--color-panel2)',
                        border: '1px solid var(--color-border)', borderRadius: 6,
                        padding: '4px 8px', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  {saveError && (
                    <p style={{ fontSize: 12, color: 'var(--color-danger)', margin: 0 }}>{saveError}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !draftName.trim() || !draftDueDate}
                      className="btn-primary disabled:opacity-50"
                      style={{ fontSize: 12, padding: '5px 14px' }}
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn-secondary"
                      style={{ fontSize: 12, padding: '5px 14px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable body — two columns */}
            <div className="flex-1 overflow-hidden" style={{ display: 'flex', minHeight: 0, borderTop: '1px solid var(--color-border-s)' }}>

              {/* ── Left column: details ── */}
              <div
                className="no-scrollbar"
                style={{
                  flex: '0 0 44%', overflowY: 'auto',
                  padding: '20px 20px 24px 24px',
                  display: 'flex', flexDirection: 'column', gap: 20,
                  borderRight: '1px solid var(--color-border-s)',
                }}
              >
                {/* Description — always shown */}
                <div>
                  <p style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Description</p>
                  {assignment.description ? (
                    <p style={{ fontSize: 12.5, color: 'var(--color-ink2)', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{assignment.description}</p>
                  ) : (
                    <p style={{ fontSize: 12.5, color: 'var(--color-mute)', fontStyle: 'italic', margin: 0 }}>No description provided.</p>
                  )}
                </div>

                {/* Instructions */}
                {assignment.instructions && (
                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Instructions</p>
                    <p style={{ fontSize: 12.5, color: 'var(--color-ink2)', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{assignment.instructions}</p>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--color-border-s)' }} />

                {/* Requirements — always shown */}
                <div>
                  <p style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Submission Guidelines</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      'Upload file(s) for completed work',
                      'Submission reflects assignment outcome',
                      'Note context and important details',
                      'Include relevant supporting materials',
                    ].map((req) => (
                      <div key={req} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                          style={{ color: 'var(--color-mute)', flexShrink: 0, marginTop: 1 }}>
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="9 12 11 14 15 10" />
                        </svg>
                        <span style={{ fontSize: 12.5, color: 'var(--color-ink2)', lineHeight: 1.5 }}>{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border-s)' }} />

                {/* Assignment Info */}
                <div>
                  <p style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Assignment Info</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {due && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                          style={{ color: 'var(--color-mute)', flexShrink: 0 }}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span style={{ fontSize: 12, color: 'var(--color-mute)', width: 52, flexShrink: 0 }}>Due</span>
                        <div>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: isOverdue && !hasSubmission ? 'var(--color-danger)' : 'var(--color-ink)' }}>
                            {due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                          {!isOverdue && (
                            <span style={{ fontSize: 11.5, color: daysLeft <= 2 ? 'var(--color-danger)' : 'var(--color-mute)', marginLeft: 6 }}>
                              ({daysLeft === 0 ? 'today' : `${daysLeft}d left`})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {assignment.points > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                          style={{ color: 'var(--color-mute)', flexShrink: 0 }}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span style={{ fontSize: 12, color: 'var(--color-mute)', width: 52, flexShrink: 0 }}>Points</span>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-ink)' }}>{assignment.points}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                        style={{ color: 'var(--color-mute)', flexShrink: 0 }}>
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                      <span style={{ fontSize: 12, color: 'var(--color-mute)', width: 52, flexShrink: 0 }}>Project</span>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-ink)' }}>{project.name}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Right column: submissions + upload ── */}
              <div
                style={{
                  flex: 1,
                  padding: '20px 24px 24px 20px',
                  display: 'flex', flexDirection: 'column',
                  minHeight: 0,
                }}
              >
                <p style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, flexShrink: 0 }}>Submissions</p>

                {/* Top — submissions list, scrollable */}
                <div
                  className="no-scrollbar"
                  style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
                >
                  {assignment.submissions.length > 0 ? (
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
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                        style={{ color: 'var(--color-mute)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <p style={{ fontSize: 12.5, color: 'var(--color-mute)', margin: 0 }}>No submissions yet</p>
                    </div>
                  )}
                </div>

                {/* Bottom — upload form, pinned */}
                <div style={{ flexShrink: 0, paddingTop: 12 }}>
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
                        className="form-input w-full resize-none rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)', color: 'var(--color-ink)' }}
                        placeholder="Any notes about this submission…"
                      />
                    </div>

                    {submitError && (
                      <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>{submitError}</div>
                    )}
                  </form>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderTop: '1px solid var(--color-border-s)' }}>
              <button
                onClick={onClose}
                className="btn-secondary"
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
                disabled={isSubmitting || selectedFiles.length === 0}
                className="btn-primary disabled:opacity-50"
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : 'Submit'}
              </button>
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
  const ts = new Date(submission.submission_timestamp)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Close on outside click
  useEffect(() => {
    if (!menu) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-submission-menu]')) { setMenu(null); setConfirming(false) }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [menu])

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-ink)' }}>
              {ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
            {submission.is_late ? (
              <span style={{ borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 500, background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
                {submission.days_late > 0 ? `${submission.days_late}d ${submission.hours_late}h late` : `${submission.hours_late}h late`}
              </span>
            ) : (
              <span style={{ borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 500, background: 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}>On time</span>
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
          <button
            onMouseDown={(e) => {
              e.stopPropagation()
              setMenu(menu ? null : { x: e.clientX, y: e.clientY })
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
              color: 'var(--color-mute)', background: 'transparent',
              transition: 'color 120ms ease, transform 120ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-mute)')}
            onMouseDown={e => { e.stopPropagation(); e.currentTarget.style.transform = 'scale(0.88)'; setMenu(menu ? null : { x: e.clientX, y: e.clientY }) }}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            title="Delete submission"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {menu && createPortal(
        <div
          data-submission-menu
          style={{
            position: 'fixed', top: menu.y, left: menu.x, zIndex: 9999,
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            padding: '4px',
            minWidth: 120,
          }}
        >
          {confirming ? (
            <button
              data-submission-menu
              onClick={() => { onDelete(); setMenu(null); setConfirming(false) }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium"
              style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-danger-soft)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              Confirm delete
            </button>
          ) : (
            <button
              data-submission-menu
              onClick={() => setConfirming(true)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
              style={{ color: 'var(--color-ink2)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-mute)' }}>
                <path d="M3 6h18m-2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Delete
            </button>
          )}
          <button
            data-submission-menu
            onMouseDown={(e) => { e.stopPropagation(); setMenu(null); setConfirming(false) }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 12px', fontSize: 13, borderRadius: 5,
              color: 'var(--color-ink2)', background: 'none', border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Cancel
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
