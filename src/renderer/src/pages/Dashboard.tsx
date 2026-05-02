import { useMemo, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useApp } from '../store/AppContext'
import ProjectCard from '../components/ProjectCard'
import CalendarPanel from '../components/CalendarPanel'
import NewProjectModal from '../components/NewProjectModal'
import Header from '../components/Header'

// Stat helpers — local time so date boundaries match the user's clock
function localDate(d: Date): string {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}
function todayStr() { return localDate(new Date()) }
function weekEndStr() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return localDate(d)
}

// Format today's date as "THURSDAY, APRIL 23"
function formatDateLabel() {
  const d = new Date()
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const chevBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: '1px solid var(--color-border)',
  background: 'transparent', color: 'var(--color-mute)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  transition: 'background-color 120ms ease, color 120ms ease, transform 120ms ease',
}

export default function Dashboard() {
  const { projects, calendarEvents, userName, openAssignmentModal } = useApp()
  const [showNewProject, setShowNewProject] = useState(false)

  // Lifted calendar nav state
  const today = new Date()
  const [calViewDate, setCalViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const calYear  = calViewDate.getFullYear()
  const calMonth = calViewDate.getMonth()
  function prevMonth() { setCalViewDate(new Date(calYear, calMonth - 1, 1)) }
  function nextMonth() { setCalViewDate(new Date(calYear, calMonth + 1, 1)) }

  const stats = useMemo(() => {
    const today = todayStr()
    const weekEnd = weekEndStr()
    const active = calendarEvents.filter((e) => !e.completed)
    const overdue  = active.filter((e) => e.isLate).length
    const dueToday = active.filter((e) => !e.isLate && localDate(new Date(e.due_date)) === today).length
    const thisWeek = active.filter((e) => {
      const d = localDate(new Date(e.due_date))
      return !e.isLate && d > today && d <= weekEnd
    }).length
    const total = active.length
    return { overdue, dueToday, thisWeek, total }
  }, [calendarEvents])

  const greeting = userName ? `Good morning, ${userName}.` : 'Good morning.'

  // Parallax scroll tracking
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ container: containerRef })

  const heroY       = useTransform(scrollYProgress, [0, 1], [0, -50])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.3])
  const projOpacity = useTransform(scrollYProgress, [0, 1], [0, 1])
  const stripOpacity = useTransform(scrollYProgress, [0, 0.5], [0.3, 1])

  return (
    <div className="flex w-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden min-w-0">

        <Header />

        {/* Scrollable body — two snap pages */}
        <div ref={containerRef} className="flex-1 overflow-y-auto" style={{ scrollSnapType: 'y mandatory' }}>

          {/* Page 1 — Hero centered */}
          <div style={{ height: '100%', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 30px' }}>
            <motion.div style={{ y: heroY, opacity: heroOpacity }}>
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
                  fontSize: 14.5, lineHeight: 1.5, color: 'var(--color-ink2)',
                  letterSpacing: '0.02em', fontWeight: 300, opacity: 0.75,
                }}>
                  "It's not what we do once in a while that shapes our lives. It's what we do consistently."
                </blockquote>
                <figcaption style={{
                  marginTop: 5, fontSize: 10, color: 'var(--color-mute)',
                  letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500, opacity: 0.5,
                }}>
                  — Tony Robbins
                </figcaption>
              </figure>
            </motion.div>
          </div>

          {/* Page 2 — Full dashboard layout */}
          <div style={{ height: '100%', scrollSnapAlign: 'start', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Stat strip */}
            <motion.div
              className="flex-shrink-0 grid"
              style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', opacity: stripOpacity }}
            >
              {[
                { label: 'Overdue',   value: stats.overdue,  color: 'var(--color-danger)' },
                { label: 'Due today', value: stats.dueToday, color: 'var(--accent)' },
                { label: 'This week', value: stats.thisWeek, color: 'var(--color-ink)' },
                { label: 'Total',     value: stats.total,    color: 'var(--color-ink)' },
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
                  <div style={{ fontSize: 24, fontWeight: 500, color: s.color, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                </div>
              ))}
            </motion.div>

            {/* Hero in normal position */}
            <div style={{ padding: '28px 30px 0' }}>
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
                  fontSize: 14.5, lineHeight: 1.5, color: 'var(--color-ink2)',
                  letterSpacing: '0.02em', fontWeight: 300, opacity: 0.75,
                }}>
                  "It's not what we do once in a while that shapes our lives. It's what we do consistently."
                </blockquote>
                <figcaption style={{
                  marginTop: 5, fontSize: 10, color: 'var(--color-mute)',
                  letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500, opacity: 0.5,
                }}>
                  — Tony Robbins
                </figcaption>
              </figure>
            </div>

            {/* Projects */}
            <div style={{ padding: '28px 30px', flex: 1 }}>
              <div className="flex items-baseline gap-3" style={{ marginBottom: 14 }}>
                <h2 style={{
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontSize: 16, margin: 0, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--color-ink)',
                }}>Projects</h2>
                <span style={{ fontSize: 12, color: 'var(--color-mute)' }}>{projects.length} active</span>
              </div>

              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--color-panel2)' }}>
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-mute)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 4px' }}>No projects yet</h3>
                  <p style={{ fontSize: 13, color: 'var(--color-mute)', margin: 0 }}>Create your first project to get started.</p>
                  <button onClick={() => setShowNewProject(true)} className="btn-primary no-drag" style={{ marginTop: 16 }}>
                    Create a Project
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {projects.map((project, index) => (
                    <div
                      key={project.id}
                      style={{
                        animation: 'sidebar-fade-in 200ms ease both',
                        animationDelay: `${index * 60}ms`,
                      }}
                    >
                      <ProjectCard project={project} />
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* Right rail — Calendar */}
      <aside
        className="hidden lg:flex lg:flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 288, borderLeft: '1px solid var(--color-border)', background: 'var(--color-panel)' }}
      >
        <div
          className="drag-region flex-shrink-0 flex items-center justify-between px-4"
          style={{ height: 44, borderBottom: '1px solid var(--color-border-s)' }}
        >
          <button className="no-drag" onClick={prevMonth} style={chevBtn}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-border-s)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-mute)' }}
            onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.88)')}
            onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <span className="no-drag" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
            {MONTHS[calMonth]} {calYear}
          </span>
          <button className="no-drag" onClick={nextMonth} style={chevBtn}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-border-s)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-mute)' }}
            onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.88)')}
            onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-drag" style={{ padding: '14px 16px' }}>
          <CalendarPanel
            events={calendarEvents.filter((e) => !e.completed)}
            onSelectAssignment={(pid, aid) => openAssignmentModal(pid, aid)}
            month={calMonth}
            year={calYear}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            hideMonthNav
          />
        </div>
      </aside>

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} />
      )}

    </div>
  )
}
