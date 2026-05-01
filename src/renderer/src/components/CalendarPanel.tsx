import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarEvent } from '../../../../types/index'

interface Props {
  events: CalendarEvent[]
  projectId?: string
  completedEvents?: CalendarEvent[]
  onSelectAssignment?: (projectId: string, assignmentId: string) => void
  // Lifted nav state — when provided, CalendarPanel is controlled externally
  month?: number
  year?: number
  onPrevMonth?: () => void
  onNextMonth?: () => void
  hideMonthNav?: boolean
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function CalendarPanel({
  events, projectId, completedEvents = [], onSelectAssignment,
  month: monthProp, year: yearProp, onPrevMonth, onNextMonth,
  hideMonthNav = false,
}: Props) {
  const navigate = useNavigate()
  const today = useMemo(() => new Date(), [])
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const filtered = useMemo(
    () => (projectId ? events.filter((e) => e.projectId === projectId) : events),
    [events, projectId]
  )

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of filtered) {
      const d = new Date(ev.due_date)
      const key = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return map
  }, [filtered])

  // Use externally lifted state when provided, otherwise use internal state
  const year  = yearProp  ?? viewDate.getFullYear()
  const month = monthProp ?? viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }
  const handlePrev = onPrevMonth ?? prevMonth
  const handleNext = onNextMonth ?? nextMonth

  function dateKey(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function isToday(d: number) {
    return year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
  }

  // Classify upcoming events by status — all in local time
  const todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0')
  const weekEnd = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
  }, [today])

  const grouped = useMemo(() => {
    const overdue: CalendarEvent[] = []
    const dueToday: CalendarEvent[] = []
    const later: CalendarEvent[] = []
    for (const ev of filtered) {
      if (ev.isLate) { overdue.push(ev); continue }
      const dl = new Date(ev.due_date)
      const d = dl.getFullYear() + '-' +
        String(dl.getMonth() + 1).padStart(2, '0') + '-' +
        String(dl.getDate()).padStart(2, '0')
      if (d === todayStr) { dueToday.push(ev); continue }
      later.push(ev)
    }
    overdue.sort((a, b) => a.due_date.localeCompare(b.due_date))
    dueToday.sort((a, b) => a.due_date.localeCompare(b.due_date))
    later.sort((a, b) => a.due_date.localeCompare(b.due_date))
    return { overdue, dueToday, later }
  }, [filtered, todayStr])

  const totalUpcoming = grouped.overdue.length + grouped.dueToday.length + grouped.later.length

  // 28×28 — better hit area than 22×22, still compact
  const chevBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 7, border: '1px solid var(--color-border)',
    background: 'transparent', color: 'var(--color-mute)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
    transition: 'background-color 120ms ease, color 120ms ease, transform 120ms ease',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    {/* Fixed top section */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
      {/* Month nav — hidden when lifted into aside header */}
      {!hideMonthNav && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={handlePrev} style={chevBtn}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-border-s)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-mute)' }}
            onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.88)')}
            onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
            {MONTHS[month]} {year}
          </span>
          <button onClick={handleNext} style={chevBtn}
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
      )}

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: -8 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 500, color: 'var(--color-mute)', letterSpacing: '0.06em', paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — always 6 rows × 7 cols = 42 cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {Array.from({ length: 42 }).map((_, i) => {
          const cellDay = i - firstDay + 1          // 1-based day within current month
          const isOverflow = cellDay < 1 || cellDay > daysInMonth

          // Compute the display number for overflow cells
          let displayDay: number
          if (cellDay < 1) {
            // Previous month — days counting back from end of prev month
            const prevMonthDays = new Date(year, month, 0).getDate()
            displayDay = prevMonthDays + cellDay
          } else if (cellDay > daysInMonth) {
            displayDay = cellDay - daysInMonth
          } else {
            displayDay = cellDay
          }

          if (isOverflow) {
            return (
              <div key={`overflow-${i}`} style={{
                height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 6, fontSize: 12, fontVariantNumeric: 'tabular-nums',
                color: 'var(--color-ink)', opacity: 0.25, pointerEvents: 'none',
              }}>
                {displayDay}
              </div>
            )
          }

          const key = dateKey(displayDay)
          const dayEvents = eventsByDate.get(key) ?? []
          const hasLate = dayEvents.some((e) => e.isLate)
          const hasToday = dayEvents.some((e) => !e.isLate && key === todayStr)
          const dotColor = hasLate ? 'var(--color-danger)' : hasToday ? 'var(--accent)' : 'var(--color-mute)'
          const sel = isToday(displayDay)
          return (
            <div key={displayDay} style={{
              height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6, background: sel ? 'var(--accent)' : 'transparent',
              color: sel ? 'white' : 'var(--color-ink)', fontSize: 12, fontWeight: sel ? 600 : 400,
              position: 'relative', cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
              transition: 'background-color 100ms ease, transform 100ms ease',
            }}
            onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--color-border-s)' }}
            onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.82)')}
            onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
            >
              <span>{displayDay}</span>
              {dayEvents.length > 0 && (
                <span style={{
                  position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: '50%',
                  background: sel ? 'rgba(255,255,255,0.85)' : dotColor,
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 10, color: 'var(--color-mute)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block' }} /> Overdue
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} /> Today
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-mute)', display: 'inline-block' }} /> Later
        </span>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--color-border)' }} />

      {/* Upcoming — label (fixed) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
        <span style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--color-mute)', fontWeight: 500, textTransform: 'uppercase' }}>Assignments</span>
        <span style={{ fontSize: 11, color: 'var(--color-mute)', fontFamily: '"Geist Mono", monospace' }}>{totalUpcoming}</span>
      </div>
    </div>

    {/* Scrollable upcoming groups */}
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: 16, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <UpcomingGroup label="Completed" tone="success" events={completedEvents}  projectId={projectId} navigate={navigate} onSelectAssignment={onSelectAssignment} />
      <UpcomingGroup label="Overdue"   tone="danger"  events={grouped.overdue}  projectId={projectId} navigate={navigate} onSelectAssignment={onSelectAssignment} />
      <UpcomingGroup label="Today"     tone="today"   events={grouped.dueToday} projectId={projectId} navigate={navigate} onSelectAssignment={onSelectAssignment} />
      <UpcomingGroup label="Later"     tone="mute"    events={grouped.later}    projectId={projectId} navigate={navigate} onSelectAssignment={onSelectAssignment} />
    </div>
    </div>
  )
}

function UpcomingGroup({
  label, tone, events, projectId, navigate, onSelectAssignment
}: {
  label: string
  tone: 'success' | 'danger' | 'today' | 'mute'
  events: CalendarEvent[]
  projectId?: string
  navigate: ReturnType<typeof useNavigate>
  onSelectAssignment?: (projectId: string, assignmentId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const dotColor = tone === 'success' ? 'var(--color-success)' : tone === 'danger' ? 'var(--color-danger)' : tone === 'today' ? 'var(--accent)' : 'var(--color-mute)'

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Group header — clickable row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          background: 'var(--color-border-s)', border: 'none', padding: '3px 6px', cursor: 'pointer',
          marginBottom: expanded ? 8 : 0, borderRadius: 5,
          transition: 'background-color 120ms ease, transform 120ms ease',
        }}
        onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.97)')}
        onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
      >
        {/* Chevron — points down when expanded, left when collapsed */}
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          style={{
            color: 'var(--color-mute)', flexShrink: 0,
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        {/* Status dot */}
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />
        {/* Label */}
        <span style={{ fontSize: 11, color: 'var(--color-ink2)', fontWeight: 500, flex: 1, textAlign: 'left' }}>{label}</span>
        {/* Count pill */}
        <span style={{
          fontSize: 10, fontFamily: '"Geist Mono", monospace', fontWeight: 500,
          background: 'var(--color-panel2)', border: '1px solid var(--color-border)',
          borderRadius: 99, padding: '1px 6px', color: 'var(--color-mute)', lineHeight: 1.6,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {events.length}
        </span>
      </button>

      {/* Items or empty state */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            {events.length === 0 ? (
              <p style={{ fontSize: 11.5, color: 'var(--color-mute)', margin: 0, padding: '2px 0 4px 17px', fontStyle: 'italic' }}>
                None, you're on track.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {events.map((ev, idx) => {
                  const due = new Date(ev.due_date)
                  const timeLabel = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  const dateLabel = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onSelectAssignment
                        ? onSelectAssignment(ev.projectId, ev.assignmentId)
                        : navigate(`/project/${ev.projectId}/assignment/${ev.assignmentId}`)
                      }
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left',
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%',
                        /* Staggered entrance: each item delays by 40ms × its index */
                        animation: 'sidebar-fade-in 200ms ease both',
                        animationDelay: `${idx * 40}ms`,
                        transition: 'transform 120ms ease',
                      }}
                      onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.97)')}
                      onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
                    >
                      {/* Check circle */}
                      <div style={{
                        width: 13, height: 13, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                        border: `1.5px solid ${tone === 'success' ? 'var(--color-success)' : tone === 'danger' ? 'var(--color-danger)' : 'var(--color-border)'}`,
                        background: 'transparent',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ev.title}
                        </div>
                        {!projectId && (
                          <div style={{ fontSize: 11, color: 'var(--color-mute)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5, opacity: 0.75 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: ev.projectColor, display: 'inline-block', flexShrink: 0 }} />
                            <span>{ev.projectName}</span>
                          </div>
                        )}
                        <div style={{
                          fontSize: 10.5, marginTop: 2,
                          color: tone === 'danger' ? 'var(--color-danger)' : tone === 'success' ? 'var(--color-success)' : 'var(--color-mute)',
                          fontFamily: '"Geist Mono", monospace', letterSpacing: '0.01em',
                        }}>
                          {dateLabel} · {timeLabel}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
