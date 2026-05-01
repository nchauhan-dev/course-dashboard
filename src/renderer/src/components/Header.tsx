import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import SearchBar from './SearchBar'

function ChevronRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const { activeWorkspace, projects } = useApp()

  const isDashboard = location.pathname === '/dashboard'
  const project = projectId ? projects.find((p) => p.id === projectId) : null

  return (
    <header
      className="drag-region flex flex-shrink-0 items-center gap-2.5 px-5"
      style={{ height: 44, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 no-drag" style={{ fontSize: 12, color: 'var(--color-mute)' }}>
        <span>{activeWorkspace || 'Workspace'}</span>
        <ChevronRight />
        {isDashboard ? (
          <span className="font-medium" style={{ color: 'var(--color-ink)' }}>Dashboard</span>
        ) : (
          <>
            <span
              onClick={() => navigate('/dashboard')}
              style={{ cursor: 'pointer', transition: 'color 120ms ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '')}
            >Dashboard</span>
            <ChevronRight />
            <span className="font-medium" style={{ color: 'var(--color-ink)' }}>{project?.name ?? ''}</span>
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Search */}
      <SearchBar
        scope={isDashboard ? 'global' : 'project'}
        placeholder={isDashboard ? 'Search files, tasks, projects…' : 'Search files, tasks…'}
        projectPath={project?.path}
      />
    </header>
  )
}
