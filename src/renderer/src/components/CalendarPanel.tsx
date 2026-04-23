import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CalendarEvent } from '../../../../types/index'

interface Props {
  events: CalendarEvent[]
  courseId?: string // if set, filter to this course only
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function CalendarPanel({ events, courseId }: Props) {
  const navigate = useNavigate()
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const filtered = useMemo(
    () => (courseId ? events.filter((e) => e.courseId === courseId) : events),
    [events, courseId]
  )

  // Build map: "YYYY-MM-DD" → CalendarEvent[]
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

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1))
  }

  function dateKey(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function isToday(d: number) {
    return year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
  }

  // All upcoming events sorted by due date
  const upcoming = useMemo(() => {
    return filtered
      .filter((e) => new Date(e.due_date) >= today)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
  }, [filtered])

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium uppercase text-gray-400 pb-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-gray-50 h-10" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const key = dateKey(day)
          const dayEvents = eventsByDate.get(key) ?? []
          const hasLate = dayEvents.some((e) => e.isLate)

          return (
            <div
              key={day}
              className="bg-white h-10 flex flex-col items-center pt-1 relative"
              style={isToday(day) ? { boxShadow: 'inset 0 0 0 1px var(--accent)' } : undefined}
            >
              <span
                className="text-xs leading-none font-medium"
                style={{ color: isToday(day) ? 'var(--accent)' : '#374151' }}
              >
                {day}
              </span>
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-full px-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      title={`${ev.title} — ${ev.courseName}`}
                      onClick={() => navigate(`/course/${ev.courseId}/assignment/${ev.assignmentId}`)}
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0 hover:scale-150 transition-transform"
                      style={{ backgroundColor: hasLate && ev.isLate ? '#ef4444' : ev.courseColor }}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[8px] text-gray-400 leading-none">+{dayEvents.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Upcoming assignments list */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Upcoming
        </h4>
        {upcoming.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-2">No upcoming assignments</p>
        ) : (
          <div className="space-y-1">
            {upcoming.map((ev) => {
              const due = new Date(ev.due_date)
              const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000)
              const dateLabel = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const timeLabel = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              return (
                <button
                  key={ev.id}
                  onClick={() => navigate(`/course/${ev.courseId}/assignment/${ev.assignmentId}`)}
                  className="w-full flex items-start gap-2 rounded-lg p-2 hover:bg-gray-50 text-left transition-colors"
                >
                  <div
                    className="mt-0.5 h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ev.isLate ? '#ef4444' : ev.courseColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-800">{ev.title}</p>
                    {!courseId && (
                      <p className="text-[10px] text-gray-400 truncate">{ev.courseName}</p>
                    )}
                    <p className={`text-[10px] font-medium mt-0.5 ${
                      daysLeft <= 2 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-gray-400'
                    }`}>
                      {daysLeft === 0 ? `Today ${timeLabel}` : daysLeft === 1 ? `Tomorrow ${timeLabel}` : `${dateLabel} · ${timeLabel}`}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold mt-0.5 ${
                    daysLeft <= 2 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-gray-400'
                  }`}>
                    {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tmrw' : `${daysLeft}d`}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
