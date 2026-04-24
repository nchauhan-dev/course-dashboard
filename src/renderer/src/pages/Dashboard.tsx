import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import CourseCard from '../components/CourseCard'
import CalendarPanel from '../components/CalendarPanel'
import NewCourseModal from '../components/NewCourseModal'

// Stat helpers
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function weekEndStr() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

// Format today's date as "THURSDAY, APRIL 23"
function formatDateLabel() {
  const d = new Date()
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
}

export default function Dashboard() {
  const { courses, calendarEvents, userName, activeWorkspace } = useApp()
  const [showNewCourse, setShowNewCourse] = useState(false)

  const stats = useMemo(() => {
    const today = todayStr()
    const weekEnd = weekEndStr()
    const overdue = calendarEvents.filter((e) => e.isLate).length
    const dueToday = calendarEvents.filter((e) => !e.isLate && e.due_date.slice(0, 10) === today).length
    const thisWeek = calendarEvents.filter((e) => {
      const d = e.due_date.slice(0, 10)
      return !e.isLate && d > today && d <= weekEnd
    }).length
    const total = calendarEvents.length
    return { overdue, dueToday, thisWeek, total }
  }, [calendarEvents])

  const greeting = userName ? `Good morning, ${userName}.` : 'Good morning.'

  return (
    <div className="flex w-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* Linear-style breadcrumb header */}
        <header
          className="drag-region flex flex-shrink-0 items-center gap-2.5 px-5"
          style={{ height: 44, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 no-drag" style={{ fontSize: 12, color: 'var(--color-mute)' }}>
            <span>{activeWorkspace || 'Workspace'}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
            <span className="font-medium" style={{ color: 'var(--color-ink)' }}>Dashboard</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div
            className="no-drag flex items-center gap-2 rounded-md px-2.5 py-1.5"
            style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)', fontSize: 11.5, color: 'var(--color-mute)', minWidth: 200 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <span>Search files, tasks, courses…</span>
            <span style={{ marginLeft: 'auto', fontFamily: '"Geist Mono", monospace', fontSize: 10, color: 'var(--color-mute)' }}>⌘K</span>
          </div>

        </header>

        {/* Stat strip */}
        <div
          className="flex-shrink-0 grid"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
        >
          {[
            { label: 'Overdue',    value: stats.overdue,  color: 'var(--color-danger)' },
            { label: 'Due today',  value: stats.dueToday, color: 'var(--accent)' },
            { label: 'This week',  value: stats.thisWeek, color: 'var(--color-ink)' },
            { label: 'Total',      value: stats.total,    color: 'var(--color-ink)' },
          ].map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: '12px 20px',
                borderRight: i < 3 ? '1px solid var(--color-border)' : 'none',
                display: 'flex', flexDirection: 'column', gap: 3,
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--color-mute)', fontWeight: 500, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: s.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '28px 30px' }}>

          {/* Hero */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--color-mute)', fontWeight: 500, marginBottom: 8 }}>
              {formatDateLabel()}
            </div>
            <h1 style={{
              fontFamily: '"Geist", system-ui, sans-serif',
              fontSize: 40, letterSpacing: '-0.04em', margin: 0, fontWeight: 500, lineHeight: 1.05,
              color: 'var(--color-ink)',
            }}>
              {greeting}
            </h1>
            <figure style={{ margin: '12px 0 0', maxWidth: 560 }}>
              <blockquote style={{
                margin: 0,
                fontFamily: '"Instrument Serif", Georgia, serif',
                fontSize: 14.5, lineHeight: 1.5, color: 'var(--color-ink2)',
              }}>
                "It's not what we do once in a while that shapes our lives. It's what we do consistently."
              </blockquote>
              <figcaption style={{
                marginTop: 5, fontSize: 10, color: 'var(--color-mute)',
                letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500,
              }}>
                — Tony Robbins
              </figcaption>
            </figure>
          </section>

          {/* Courses */}
          <section>
            <div className="flex items-baseline gap-3" style={{ marginBottom: 14 }}>
              <h2 style={{
                fontFamily: '"Geist", system-ui, sans-serif',
                fontSize: 16, margin: 0, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--color-ink)',
              }}>Courses</h2>
              <span style={{ fontSize: 12, color: 'var(--color-mute)' }}>{courses.length} active</span>
            </div>

            {courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--color-panel2)' }}>
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-mute)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 4px' }}>No courses yet</h3>
                <p style={{ fontSize: 13, color: 'var(--color-mute)', margin: 0 }}>Create your first course to get started.</p>
                <button onClick={() => setShowNewCourse(true)} className="btn-primary no-drag" style={{ marginTop: 16 }}>
                  Create a Course
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Right rail — Calendar */}
      <aside
        className="hidden lg:flex lg:flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 288, borderLeft: '1px solid var(--color-border)', background: 'var(--color-panel)' }}
      >
        <div
          className="drag-region flex-shrink-0 flex items-center px-4"
          style={{ height: 44, borderBottom: '1px solid var(--color-border-s)' }}
        >
          <span className="no-drag" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink)' }}>Calendar</span>
        </div>
        <div className="flex-1 overflow-y-auto no-drag" style={{ padding: '14px 16px' }}>
          <CalendarPanel events={calendarEvents} />
        </div>
      </aside>

      {showNewCourse && (
        <NewCourseModal onClose={() => setShowNewCourse(false)} />
      )}
    </div>
  )
}
