import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CalendarEvent } from '../../../../types/index'

interface Props {
  events: CalendarEvent[]
  projectId?: string
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function CalendarPanel({ events, projectId }: Props) {
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
      const key = ev.due_date.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return map
  }, [filtered])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }

  function dateKey(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function isToday(d: number) {
    return year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
  }

  // Classify upcoming events by status
  const todayStr = today.toISOString().slice(0, 10)
  const weekEnd = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  }, [today])

  const grouped = useMemo(() => {
    const overdue: CalendarEvent[] = []
    const dueToday: CalendarEvent[] = []
    const later: CalendarEvent[] = []
    for (const ev of filtered) {
      if (ev.isLate) { overdue.push(ev); continue }
      const d = ev.due_date.slice(0, 10)
      if (d === todayStr) { dueToday.push(ev); continue }
      later.push(ev)
    }
    overdue.sort((a, b) => a.due_date.localeCompare(b.due_date))
    dueToday.sort((a, b) => a.due_date.localeCompare(b.due_date))
    later.sort((a, b) => a.due_date.localeCompare(b.due_date))
    return { overdue, dueToday, later }
  }, [filtered, todayStr])

  const totalUpcoming = grouped.overdue.length + grouped.dueToday.length + grouped.later.length

  const chevBtn: React.CSSProperties = {
    width: 22, height: 22, borderRadius: 6, border: '1px solid var(--color-border)',
    background: 'transparent', color: 'var(--color-mute)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={prevMonth} style={chevBtn}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em' }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} style={chevBtn}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: -8 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 500, color: 'var(--color-mute)', letterSpacing: '0.06em', paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e-${i}`} style={{ height: 28 }} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const key = dateKey(day)
          const dayEvents = eventsByDate.get(key) ?? []
          const hasLate = dayEvents.some((e) => e.isLate)
          const hasToday = dayEvents.some((e) => !e.isLate && key === todayStr)
          const dotColor = hasLate ? 'var(--color-danger)' : hasToday ? 'var(--accent)' : 'var(--color-mute)'
          const sel = isToday(day)
          return (
            <div key={day} style={{
              height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6, background: sel ? 'var(--accent)' : 'transparent',
              color: sel ? 'white' : 'var(--color-ink)', fontSize: 12, fontWeight: sel ? 600 : 400,
              position: 'relative', cursor: 'pointer',
            }}>
              <span>{day}</span>
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
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--color-mute)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block' }} /> Overdue
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} /> Today
        </span>
      </div>

      {/* Upcoming — grouped by status */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--color-mute)', fontWeight: 500, textTransform: 'uppercase' }}>Upcoming</span>
          <span style={{ fontSize: 11, color: 'var(--color-mute)', fontFamily: '"Geist Mono", monospace' }}>{totalUpcoming}</span>
        </div>

        {totalUpcoming === 0 && (
          <p style={{ fontSize: 12, color: 'var(--color-mute)', textAlign: 'center', padding: '8px 0' }}>Nothing coming up — nice.</p>
        )}

        {grouped.overdue.length > 0 && (
          <UpcomingGroup label="Overdue" tone="danger" events={grouped.overdue} projectId={projectId} navigate={navigate} />
        )}
        {grouped.dueToday.length > 0 && (
          <UpcomingGroup label="Today" tone="today" events={grouped.dueToday} projectId={projectId} navigate={navigate} />
        )}
        {grouped.later.length > 0 && (
          <UpcomingGroup label="Later" tone="mute" events={grouped.later} projectId={projectId} navigate={navigate} />
        )}
      </div>
    </div>
  )
}

function UpcomingGroup({
  label, tone, events, projectId, navigate
}: {
  label: string
  tone: 'danger' | 'today' | 'mute'
  events: CalendarEvent[]
  projectId?: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const dotColor = tone === 'danger' ? 'var(--color-danger)' : tone === 'today' ? 'var(--accent)' : 'var(--color-mute)'
  return (
    <div style={{ marginBottom: 14 }}>
      {/* Group header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--color-ink2)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--color-mute)', fontFamily: '"Geist Mono", monospace' }}>{events.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {events.map((ev) => {
          const due = new Date(ev.due_date)
          const timeLabel = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          const dateLabel = ev.isLate
            ? due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <button
              key={ev.id}
              onClick={() => navigate(`/project/${ev.projectId}/assignment/${ev.assignmentId}`)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%' }}
            >
              {/* Check circle */}
              <div style={{
                width: 13, height: 13, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                border: `1.5px solid ${tone === 'danger' ? 'var(--color-danger)' : 'var(--color-border)'}`,
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
                  color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-mute)',
                  fontFamily: '"Geist Mono", monospace', letterSpacing: '0.01em',
                }}>
                  {dateLabel} · {timeLabel}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
