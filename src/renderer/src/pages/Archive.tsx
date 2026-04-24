import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import type { TreeNode } from '../../../types/index'

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseArchivedName(name: string): { displayName: string; timestamp: number | null } {
  // Matches three-part format: originalBase_timestamp_base64[.ext]
  // e.g. report_1714000000000_L1VzZXJz.pdf, Weekly_1714000000000_L1VzZXJz
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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(ts))
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface ArchiveRowProps {
  node: TreeNode
  rootPath: string
  onRefresh: () => void
}

function ArchiveRow({ node, rootPath, onRefresh }: ArchiveRowProps) {
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

  async function handleDeletePermanent() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setIsDeleting(true)
    await api.deletePermanent({ itemPath: node.path })
    setIsDeleting(false)
    onRefresh()
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
      style={{ backgroundColor: isHovered ? 'color-mix(in srgb, var(--accent) 6%, white)' : undefined }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setConfirmDelete(false) }}
    >
      {/* Icon */}
      <div className="flex-shrink-0 text-gray-400">
        {node.isDirectory
          ? <FolderIcon className="h-4 w-4" />
          : <FileIcon className="h-4 w-4" />}
      </div>

      {/* Name + timestamp */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{displayName}</p>
        {timestamp && (
          <p className="text-xs text-gray-400">{formatTimestamp(timestamp)}</p>
        )}
      </div>

      {/* Actions — visible on hover */}
      {isHovered && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleRestore}
            disabled={isRestoring || isDeleting}
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isRestoring ? 'Restoring…' : 'Restore'}
          </button>

          <button
            onClick={handleDeletePermanent}
            disabled={isRestoring || isDeleting}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
              confirmDelete
                ? 'border-red-400 bg-red-50 text-red-600 hover:bg-red-100'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isDeleting ? 'Deleting…' : confirmDelete ? 'Confirm delete' : 'Delete permanently'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Archive() {
  const { rootPath } = useApp()
  const navigate = useNavigate()
  const [items, setItems] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEmptying, setIsEmptying] = useState(false)

  const archivePath = rootPath ? `${rootPath}/_Archive` : null

  const loadItems = useCallback(async () => {
    if (!archivePath) return
    setIsLoading(true)
    const res = await api.readDirectory(archivePath)
    setItems(res.success && res.data ? res.data : [])
    setIsLoading(false)
  }, [archivePath])

  useEffect(() => { loadItems() }, [loadItems])

  async function handleEmptyArchive() {
    if (!window.confirm('Permanently delete everything in the Archive? This cannot be undone.')) return
    setIsEmptying(true)
    await Promise.all(items.map((item) => api.deletePermanent({ itemPath: item.path })))
    setIsEmptying(false)
    loadItems()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {/* Drag region */}
      <div className="drag-region h-8 flex-shrink-0" />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3 no-drag">
        <button
          onClick={() => navigate('/dashboard')}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900">Archive</h1>
          <p className="text-xs text-gray-400">Items moved here instead of being deleted</p>
        </div>

        {items.length > 0 && (
          <button
            onClick={handleEmptyArchive}
            disabled={isEmptying}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {isEmptying ? 'Emptying…' : 'Empty Archive'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 no-drag">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Archive is empty</p>
            <p className="mt-1 text-xs text-gray-400">Deleted files and folders will appear here</p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <ArchiveRow
                    key={item.path}
                    node={item}
                    rootPath={rootPath!}
                    onRefresh={loadItems}
                  />
                ))}
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-gray-400">
              {items.length} item{items.length !== 1 ? 's' : ''} in archive
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
