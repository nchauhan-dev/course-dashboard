import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import type { TreeNode } from '../../../../types/index'

interface Props {
  rootPath: string
}

export default function FileTree({ rootPath }: Props) {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await api.readDirectory(rootPath)
    if (res.success && res.data) setNodes(res.data)
    setIsLoading(false)
  }, [rootPath])

  useEffect(() => { load() }, [load])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-x-hidden">
      {nodes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-400">
          No files yet. Drop files onto folders to add them.
        </p>
      ) : (
        nodes.map((node) => (
          <TreeNodeRow key={node.path} node={node} depth={0} onRefresh={load} />
        ))
      )}
    </div>
  )
}

function TreeNodeRow({
  node,
  depth,
  onRefresh
}: {
  node: TreeNode
  depth: number
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropSuccess, setDropSuccess] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const dragCounter = useRef(0)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        !menuButtonRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setMenuOpen(false)
        setMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [menuOpen])

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (menuOpen) { setMenuOpen(false); setMenuPos(null); return }
    const rect = menuButtonRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setMenuOpen(true)
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    const name = newFolderName.trim()
    if (!name) return
    await api.createFolder(`${node.path}/${name}`)
    setCreating(false)
    setNewFolderName('')
    setExpanded(true)
    onRefresh()
  }

  function cancelCreate() {
    setCreating(false)
    setNewFolderName('')
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    const newName = renameValue.trim()
    if (!newName || newName === node.name) { setIsRenaming(false); return }
    await api.renameFolder({ oldPath: node.path, newName })
    setIsRenaming(false)
    onRefresh()
  }

  async function handleDelete() {
    await api.deleteFolder({ folderPath: node.path })
    onRefresh()
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setIsDragOver(true)
    if (!expandTimer.current) {
      expandTimer.current = setTimeout(() => {
        setExpanded(true)
        expandTimer.current = null
      }, 800)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragOver(false)
      if (expandTimer.current) {
        clearTimeout(expandTimer.current)
        expandTimer.current = null
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragOver(false)
    if (expandTimer.current) {
      clearTimeout(expandTimer.current)
      expandTimer.current = null
    }

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    for (const file of files) {
      const sourcePath = (file as unknown as { path: string }).path
      console.log('[FileTree] drop — sourcePath:', sourcePath, '| destinationFolder:', node.path)
      if (!sourcePath) continue
      const result = await api.copyFile({ sourcePath, destinationFolder: node.path })
      console.log('[FileTree] copyFile result:', result)
    }

    setDropSuccess(true)
    setExpanded(true)
    onRefresh()

    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setDropSuccess(false), 1000)
  }

  const indent = 12 + depth * 20

  const dragHandlers = node.isDirectory
    ? { onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDragOver: handleDragOver, onDrop: handleDrop }
    : {}

  let rowBg = isHovered ? 'bg-gray-50' : 'bg-white'
  if (node.isDirectory) {
    if (dropSuccess) rowBg = 'bg-green-50'
    else if (isDragOver) rowBg = 'bg-amber-50'
  }

  // ── Rename mode ──────────────────────────────────────────────────────────────
  if (isRenaming) {
    return (
      <div>
        <form
          onSubmit={handleRename}
          className="flex items-center gap-2 border-b border-gray-100 pr-3"
          style={{ height: 40, paddingLeft: `${indent}px` }}
        >
          <div className="h-5 w-5 flex-shrink-0" />
          {node.isDirectory ? (
            <svg className="h-5 w-5 flex-shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => setIsRenaming(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsRenaming(false) }}
            className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </form>
        {node.isDirectory && expanded && (
          <div>
            {(node.children ?? []).map((child) => (
              <TreeNodeRow key={child.path} node={child} depth={depth + 1} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Delete confirm mode ───────────────────────────────────────────────────────
  if (isDeleting) {
    return (
      <div>
        <div
          className="flex items-center gap-2 border-b border-gray-100 bg-red-50 pr-3"
          style={{ height: 40, paddingLeft: `${indent}px` }}
        >
          <div className="h-5 w-5 flex-shrink-0" />
          {node.isDirectory ? (
            <svg className="h-5 w-5 flex-shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 flex-shrink-0 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          <span className="flex-1 truncate text-sm font-medium text-red-600">{node.name}</span>
          <span className="flex-shrink-0 text-xs font-medium text-red-500 mr-1">Delete?</span>
          <button
            onClick={handleDelete}
            className="flex-shrink-0 rounded px-2 py-0.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600"
          >
            Delete
          </button>
          <button
            onClick={() => setIsDeleting(false)}
            className="flex-shrink-0 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
        {node.isDirectory && expanded && (
          <div>
            {(node.children ?? []).map((child) => (
              <TreeNodeRow key={child.path} node={child} depth={depth + 1} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Row */}
      <div
        className={`flex items-center gap-2 border-b border-gray-100 pr-3 transition-colors ${rowBg}`}
        style={{ height: 40, paddingLeft: `${indent}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...dragHandlers}
      >
        {node.isDirectory ? (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-600"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <svg
              className={`flex-shrink-0 text-amber-400 transition-transform duration-150 ${isDragOver ? 'h-6 w-6 scale-110' : 'h-5 w-5'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>

            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 min-w-0 text-left"
            >
              <span className="truncate text-sm font-medium text-gray-800">{node.name}</span>
            </button>

            {(isHovered || menuOpen) && (
              <div className="flex flex-shrink-0 items-center gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setCreating(true); setExpanded(true) }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="New subfolder"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <button
                  ref={menuButtonRef}
                  onClick={openMenu}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="More options"
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </button>

                {menuOpen && menuPos && (
                  <div
                    ref={dropdownRef}
                    className="w-28 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                    style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); setMenuPos(null); setRenameValue(node.name); setIsRenaming(true) }}
                      className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); setMenuPos(null); setIsDeleting(true) }}
                      className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="h-5 w-5 flex-shrink-0" />

            <svg
              className="h-5 w-5 flex-shrink-0 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>

            <span className="flex-1 truncate text-sm text-gray-700">{node.name}</span>

            {(isHovered || menuOpen) && (
              <div className="flex flex-shrink-0 items-center gap-0.5">
                <button
                  onClick={() => api.openPath(node.path)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Open file"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>

                <button
                  ref={menuButtonRef}
                  onClick={openMenu}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="More options"
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </button>

                {menuOpen && menuPos && (
                  <div
                    ref={dropdownRef}
                    className="w-28 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                    style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); setMenuPos(null); setRenameValue(node.name); setIsRenaming(true) }}
                      className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); setMenuPos(null); setIsDeleting(true) }}
                      className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Children */}
      {node.isDirectory && expanded && (
        <div>
          {creating && (
            <div
              className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 pr-3"
              style={{ height: 40, paddingLeft: `${indent + 20 + 8 + 4}px` }}
            >
              <svg className="h-5 w-5 flex-shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <form onSubmit={handleCreateFolder} className="flex-1 min-w-0">
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={cancelCreate}
                  onKeyDown={(e) => { if (e.key === 'Escape') cancelCreate() }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="Folder name"
                />
              </form>
            </div>
          )}
          {(node.children ?? []).map((child) => (
            <TreeNodeRow key={child.path} node={child} depth={depth + 1} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  )
}
