import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import type { TreeNode } from '../../../../types/index'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArchivedName(name: string): { displayName: string; timestamp: number | null } {
  const extMatch = name.match(/(\.[^.]+)?$/)
  const ext = extMatch?.[1] ?? ''
  const stem = ext ? name.slice(0, -ext.length) : name
  const match = stem.match(/^(.+)_(\d{13})_[A-Za-z0-9+/=]+$/)
  if (!match) return { displayName: name, timestamp: null }
  const displayName = match[1] + ext
  const timestamp = parseInt(match[2], 10)
  return { displayName, timestamp }
}

function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(ts))
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function FolderIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps {
  node: TreeNode
  rootPath: string
  onRefresh: () => void
}

function ArchiveItemRow({ node, rootPath, onRefresh }: RowProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { displayName, timestamp } = parseArchivedName(node.name)

  async function handleRestore() {
    setIsRestoring(true)
    await api.restoreArchiveItem({ itemPath: node.path, rootPath })
    setIsRestoring(false)
    onRefresh()
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setIsDeleting(true)
    await api.deletePermanent({ itemPath: node.path })
    setIsDeleting(false)
    onRefresh()
  }

  const btnBase: React.CSSProperties = {
    height: 24, borderRadius: 6, padding: '0 8px',
    fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
    border: '1px solid var(--color-border)', transition: 'background 100ms ease',
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderBottom: '1px solid var(--color-border-s)',
        background: isHovered ? 'var(--color-border-s)' : 'transparent',
        transition: 'background 100ms ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setConfirmDelete(false) }}
    >
      {/* Icon */}
      <span style={{ flexShrink: 0, color: 'var(--color-mute)' }}>
        {node.isDirectory ? <FolderIcon /> : <FileIcon />}
      </span>

      {/* Name + timestamp */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </div>
        {timestamp !== null && (
          <div style={{ fontSize: 11, color: 'var(--color-mute)', marginTop: 1 }}>
            {formatTimestamp(timestamp)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: isHovered ? 1 : 0, transition: 'opacity 100ms ease', pointerEvents: isHovered ? 'auto' : 'none' }}>
        <button
          onClick={handleRestore}
          disabled={isRestoring || isDeleting}
          style={{ ...btnBase, background: 'var(--color-panel)', color: 'var(--color-ink2)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-panel)')}
        >
          {isRestoring ? 'Restoring…' : 'Restore'}
        </button>
        <button
          onClick={handleDelete}
          disabled={isRestoring || isDeleting}
          style={{
            ...btnBase,
            background: confirmDelete ? 'var(--color-danger-soft)' : 'var(--color-panel)',
            color: confirmDelete ? 'var(--color-danger)' : 'var(--color-ink2)',
            borderColor: confirmDelete ? 'var(--color-danger)' : 'var(--color-border)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = confirmDelete ? 'color-mix(in oklch, var(--color-danger) 20%, transparent)' : 'var(--color-border)')}
          onMouseLeave={e => (e.currentTarget.style.background = confirmDelete ? 'var(--color-danger-soft)' : 'var(--color-panel)')}
        >
          {isDeleting ? 'Deleting…' : confirmDelete ? 'Confirm delete' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export default function ArchiveModal({ onClose }: Props) {
  const { rootPath } = useApp()
  const archivePath = rootPath ? `${rootPath}/_Archive` : null

  const [items, setItems] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEmptying, setIsEmptying] = useState(false)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const loadItems = useCallback(async () => {
    if (!archivePath) return
    setIsLoading(true)
    const res = await api.readDirectory(archivePath)
    setItems(res.success && res.data ? res.data : [])
    setIsLoading(false)
  }, [archivePath])

  useEffect(() => { loadItems() }, [loadItems])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleEmptyArchive() {
    if (!confirmEmpty) { setConfirmEmpty(true); return }
    setIsEmptying(true)
    await Promise.all(items.map((item) => api.deletePermanent({ itemPath: item.path })))
    setIsEmptying(false)
    setConfirmEmpty(false)
    loadItems()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%', maxWidth: 600,
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--color-panel)',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-mute)' }}>
              <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>Archive</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 7,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-mute)', transition: 'background 120ms ease, transform 120ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                style={{ color: 'var(--color-mute)', animation: 'spin 0.8s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
          ) : items.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--color-panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-mute)' }}>
                  <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 4px' }}>Archive is empty</p>
              <p style={{ fontSize: 12, color: 'var(--color-mute)', margin: 0 }}>Deleted files and folders will appear here</p>
            </div>
          ) : (
            <div>
              {items.map((item) => (
                <ArchiveItemRow
                  key={item.path}
                  node={item}
                  rootPath={rootPath!}
                  onRefresh={loadItems}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && items.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--color-mute)' }}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleEmptyArchive}
              disabled={isEmptying}
              style={{
                height: 28, borderRadius: 7, padding: '0 12px',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${confirmEmpty ? 'var(--color-danger)' : 'var(--color-border)'}`,
                background: confirmEmpty ? 'var(--color-danger-soft)' : 'transparent',
                color: confirmEmpty ? 'var(--color-danger)' : 'var(--color-mute)',
                transition: 'background 100ms ease, border-color 100ms ease, color 100ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = confirmEmpty ? 'color-mix(in oklch, var(--color-danger) 20%, transparent)' : 'var(--color-border-s)')}
              onMouseLeave={e => (e.currentTarget.style.background = confirmEmpty ? 'var(--color-danger-soft)' : 'transparent')}
            >
              {isEmptying ? 'Emptying…' : confirmEmpty ? 'Confirm empty archive' : 'Empty Archive'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
