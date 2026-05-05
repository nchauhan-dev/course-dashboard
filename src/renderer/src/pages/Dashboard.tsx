import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import ProjectCard from '../components/ProjectCard'
import CalendarPanel from '../components/CalendarPanel'
import NewProjectModal from '../components/NewProjectModal'
import Header from '../components/Header'
import greetingsData from '../data/greetings.json'
import quotesData from '../data/quotes_repository.json'
import type { ColorGroup } from '../../../../types/index'

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
  const { projects, calendarEvents, userName, openAssignmentModal, dashboardPage, setDashboardPage, rootPath, activeWorkspace } = useApp()
  const [showNewProject, setShowNewProject] = useState(false)

  // Color groups
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [groupMenu, setGroupMenu] = useState<{ color: string; x: number; y: number } | null>(null)
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [renameGroupValue, setRenameGroupValue] = useState('')

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

  // Dynamic greeting + quote — rotate by day-of-year and hour
  const { greeting, quote } = useMemo(() => {
    const now = new Date()
    const currentHour = now.getHours()
    const dayOfYear = Math.floor((Date.now() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)

    // Greeting
    const window = greetingsData.find((w) => w.hours.includes(currentHour)) ?? greetingsData[1]
    const rawGreeting = window.greetings[dayOfYear % 3]
    const greeting = userName
      ? rawGreeting.replace('{name}', userName)
      : rawGreeting.replace(', {name}', '').replace(' {name}', '')

    // Quote
    const allQuotes = quotesData.flatMap((cat) => cat.quotes)
    const quote = allQuotes[(dayOfYear * 24 + currentHour) % allQuotes.length]

    return { greeting, quote }
  }, [userName])

  // Swipe to reveal stat strip + projects
  const isTransitioning = useRef(false)
  const isTransitioningUp = useRef(false)
  const projectsScrollRef = useRef<HTMLDivElement>(null)

  function handleWheel(e: React.WheelEvent) {
    if (e.deltaY > 30 && dashboardPage === 0 && !isTransitioning.current) {
      isTransitioning.current = true
      setDashboardPage(1)
      setTimeout(() => { isTransitioning.current = false }, 800)
    } else if (e.deltaY < -30 && dashboardPage === 1 && projectsScrollRef.current?.scrollTop === 0 && !isTransitioningUp.current) {
      isTransitioningUp.current = true
      setDashboardPage(0)
      setTimeout(() => { isTransitioningUp.current = false }, 1500)
    }
  }

  // Sync color groups with current project colors
  useEffect(() => {
    if (!rootPath || !activeWorkspace) return
    api.getColorGroups(rootPath, activeWorkspace).then((res) => {
      const loaded: ColorGroup[] = res.success && res.data ? res.data : []
      const projectColors = [...new Set(projects.map((p) => p.color))]
      let updated = [...loaded]
      let changed = false
      for (const color of projectColors) {
        if (!updated.find((g) => g.color === color)) {
          updated.push({ color, name: `Group ${updated.length + 1}`, order: updated.length })
          changed = true
        }
      }
      const before = updated.length
      updated = updated.filter((g) => projectColors.includes(g.color))
      if (updated.length !== before) changed = true
      updated = updated.map((g, i) => ({ ...g, order: i }))
      setColorGroups(updated)
      if (changed) api.saveColorGroups(rootPath, activeWorkspace, updated)
    })
  }, [rootPath, activeWorkspace, projects]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close group menu on outside click
  useEffect(() => {
    if (!groupMenu) return
    const handler = () => setGroupMenu(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [groupMenu])

  async function handleRenameGroup(color: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed || !rootPath) { setRenamingGroup(null); setRenameGroupValue(''); return }
    await api.renameColorGroup(rootPath, activeWorkspace, color, trimmed)
    setColorGroups((prev) => prev.map((g) => g.color === color ? { ...g, name: trimmed } : g))
    setRenamingGroup(null)
    setRenameGroupValue('')
  }

  async function handleReorderGroup(color: string, direction: 'up' | 'down') {
    if (!rootPath) return
    const sorted = [...colorGroups].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((g) => g.color === color)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    ;[sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]]
    const reordered = sorted.map((g, i) => ({ ...g, order: i }))
    setColorGroups(reordered)
    await api.reorderColorGroups(rootPath, activeWorkspace, reordered)
  }

  return (
    <div className="flex w-full overflow-hidden" style={{ background: 'var(--color-bg)' }} onWheel={handleWheel}>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden min-w-0">

        <Header />

        {/* Content container */}
        <div
          className="flex-1"
          style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
        >

          {/* Stat strip — fades in on swipe down */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)',
              opacity: dashboardPage === 1 ? 1 : 0,
              pointerEvents: dashboardPage === 1 ? 'auto' : 'none',
              transition: 'opacity 400ms ease',
            }}
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
          </div>

          {/* Hero section — always visible */}
          <div style={{ padding: '28px 30px', display: 'flex', flexDirection: 'column' }}>
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
                "{quote.text}"
              </blockquote>
              <figcaption style={{
                marginTop: 5, fontSize: 10, color: 'var(--color-mute)',
                letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500, opacity: 0.5,
              }}>
                — {quote.author}
              </figcaption>
            </figure>
          </div>

          {/* Projects — fades in on swipe down */}
          <div
            ref={projectsScrollRef}
            className="no-scrollbar"
            style={{
              flex: 1, overflowY: 'auto', minHeight: 0,
              pointerEvents: dashboardPage === 0 ? 'none' : 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            } as React.CSSProperties}
          >
          <div style={{
            padding: '28px 30px',
            opacity: dashboardPage === 1 ? 1 : 0,
            pointerEvents: dashboardPage === 1 ? 'auto' : 'none',
            transition: 'opacity 400ms ease',
          }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {[...colorGroups].sort((a, b) => a.order - b.order).map((group) => {
                  const groupProjects = projects
                    .filter((p) => p.color === group.color)
                    .sort((a, b) => a.name.localeCompare(b.name))
                  if (groupProjects.length === 0) return null
                  const isCollapsed = collapsedGroups.has(group.color)
                  const sortedGroups = [...colorGroups].sort((a, b) => a.order - b.order)
                  const groupIdx = sortedGroups.findIndex((g) => g.color === group.color)
                  const isFirst = groupIdx === 0
                  const isLast = groupIdx === sortedGroups.length - 1
                  const arrowBtnStyle = (disabled: boolean): React.CSSProperties => ({
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20, borderRadius: 4,
                    border: 'none', background: 'transparent', padding: 0,
                    color: disabled ? 'var(--color-border)' : 'var(--color-mute)',
                    cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
                    transition: 'color 100ms ease',
                  })
                  return (
                    <div key={group.color}>
                      {/* Group header */}
                      <div
                        className="flex items-center gap-2"
                        style={{ marginBottom: 12, userSelect: 'none' }}
                      >
                        {/* Collapse chevron — left side */}
                        <button
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 20, height: 20, borderRadius: 4,
                            border: 'none', background: 'transparent', padding: 0,
                            color: 'var(--color-mute)', cursor: 'pointer', flexShrink: 0,
                            transition: 'color 100ms ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ink)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-mute)')}
                          onClick={() => setCollapsedGroups((prev) => {
                            const next = new Set(prev)
                            if (next.has(group.color)) next.delete(group.color)
                            else next.add(group.color)
                            return next
                          })}
                        >
                          <svg
                            width="10" height="10" viewBox="0 0 10 10"
                            fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 120ms ease' }}
                          >
                            <path d="M2 3.5 5 6.5 8 3.5" />
                          </svg>
                        </button>
                        {/* Colored dot */}
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                        {/* Name or rename input */}
                        {renamingGroup === group.color ? (
                          <input
                            autoFocus
                            value={renameGroupValue}
                            onChange={(e) => setRenameGroupValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); handleRenameGroup(group.color, renameGroupValue) }
                              if (e.key === 'Escape') { setRenamingGroup(null); setRenameGroupValue('') }
                            }}
                            className="sidebar-input"
                            style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', padding: 0, width: 160 }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em', opacity: 0.45 }}>
                            {group.name}
                          </span>
                        )}
                        <span style={{
                          fontSize: 10, fontFamily: '"Geist Mono", monospace', fontWeight: 500,
                          background: 'var(--color-panel2)', border: '1px solid var(--color-border)',
                          borderRadius: 99, padding: '1px 6px', color: 'var(--color-mute)', lineHeight: 1.6,
                          fontVariantNumeric: 'tabular-nums',
                        }}>{groupProjects.length}</span>
                        {/* Right controls */}
                        <div className="flex items-center" style={{ marginLeft: 'auto', gap: 2 }}>
                          {/* Three-dot menu */}
                          <button
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 20, height: 20, borderRadius: 4,
                              border: 'none', background: 'transparent', padding: 0,
                              color: 'var(--color-mute)', cursor: 'pointer', flexShrink: 0,
                              transition: 'color 100ms ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ink)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-mute)')}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setGroupMenu({ color: group.color, x: rect.left, y: rect.bottom + 4 })
                            }}
                            title="Group options"
                          >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                              <circle cx="2" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="14" cy="8" r="1.5" />
                            </svg>
                          </button>
                          {/* Up arrow */}
                          <button
                            style={arrowBtnStyle(isFirst)}
                            disabled={isFirst}
                            onMouseEnter={(e) => { if (!isFirst) (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)' }}
                            onMouseLeave={(e) => { if (!isFirst) (e.currentTarget as HTMLElement).style.color = 'var(--color-mute)' }}
                            onClick={() => handleReorderGroup(group.color, 'up')}
                            title="Move group up"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                              <path d="M2 6.5 5 3.5 8 6.5" />
                            </svg>
                          </button>
                          {/* Down arrow */}
                          <button
                            style={arrowBtnStyle(isLast)}
                            disabled={isLast}
                            onMouseEnter={(e) => { if (!isLast) (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)' }}
                            onMouseLeave={(e) => { if (!isLast) (e.currentTarget as HTMLElement).style.color = 'var(--color-mute)' }}
                            onClick={() => handleReorderGroup(group.color, 'down')}
                            title="Move group down"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                              <path d="M2 3.5 5 6.5 8 3.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Projects grid */}
                      {!isCollapsed && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                          {groupProjects.map((project, index) => (
                            <div
                              key={project.id}
                              style={{ animation: 'sidebar-fade-in 200ms ease both', animationDelay: `${index * 60}ms` }}
                            >
                              <ProjectCard project={project} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </div>{/* end scrollable projects wrapper */}

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

      {/* Color group three-dot menu portal */}
      <AnimatePresence>
      {groupMenu && (() => {
        const rowStyle: React.CSSProperties = {
          padding: '8px 12px', cursor: 'pointer', fontSize: 13,
          color: 'var(--color-ink)', transition: 'background 80ms ease',
        }
        return createPortal(
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: groupMenu.y, left: groupMenu.x,
              zIndex: 9999, width: 140,
              background: 'var(--color-panel)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            <div
              style={rowStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border-s)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                const g = colorGroups.find((g) => g.color === groupMenu.color)
                setRenameGroupValue(g?.name ?? '')
                setRenamingGroup(groupMenu.color)
                setGroupMenu(null)
              }}
            >
              Rename
            </div>
          </motion.div>,
          document.body
        )
      })()}
      </AnimatePresence>

    </div>
  )
}
