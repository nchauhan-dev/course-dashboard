import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import type { Project } from '../../../../types/index'

interface Props {
  project: Project
}

export default function ProjectCard({ project }: Props) {
  const navigate = useNavigate()
  const { calendarEvents } = useApp()

  const overdue = calendarEvents.filter((e) => e.projectId === project.id && e.isLate).length
  const upcoming = calendarEvents.filter((e) => e.projectId === project.id && !e.isLate).length
  const nextTask = calendarEvents.find((e) => e.projectId === project.id && !e.isLate)

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className="project-card"
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left color bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: project.color }} />

      <div style={{ paddingLeft: 8 }}>
        {/* Top row: overdue badge + arrow */}
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          {overdue > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: 'var(--color-danger)',
              background: 'var(--color-danger-soft)',
              padding: '1px 6px', borderRadius: 3,
            }}>
              {overdue} overdue
            </span>
          )}
          <div style={{ flex: 1 }} />
          {/* Arrow right */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--color-mute)', flexShrink: 0 }}>
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </div>

        {/* Name */}
        <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--color-ink)', marginBottom: 3 }}>{project.name}</div>

        {/* Next task or description */}
        <div style={{ fontSize: 12, color: 'var(--color-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nextTask
            ? <><span style={{ color: 'var(--color-ink2)' }}>Next: </span>{nextTask.title}</>
            : project.description
              ? project.description
              : <span style={{ fontStyle: 'italic' }}>No upcoming tasks</span>
          }
        </div>

        {/* Footer: sections + upcoming count */}
        <div
          className="flex items-center justify-between"
          style={{ marginTop: 12, fontSize: 11, color: 'var(--color-mute)', fontFamily: '"Geist Mono", monospace' }}
        >
          <span>{project.sections.length} {project.sections.length === 1 ? 'section' : 'sections'}</span>
          {upcoming > 0 && (
            <span style={{ color: 'var(--accent)', fontWeight: 500, fontFamily: '"Geist", sans-serif' }}>
              {upcoming} upcoming
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
