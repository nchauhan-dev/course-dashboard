import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'

type Step = 'select-folder' | 'create-workspace'

export default function Setup() {
  const { setRootPath, setActiveWorkspace } = useApp()
  const [step, setStep] = useState<Step>('select-folder')
  const [pendingRootPath, setPendingRootPath] = useState('')
  const [workspaceName, setWorkspaceName] = useState('Spring 2026')
  const [error, setError] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  async function handleSelectDirectory() {
    setIsWorking(true)
    setError(null)
    try {
      const result = await api.selectDirectory()
      if (!result.success || !result.data) {
        setIsWorking(false)
        return
      }
      setPendingRootPath(result.data)
      setStep('create-workspace')
    } catch (e) {
      setError(String(e))
    }
    setIsWorking(false)
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    const name = workspaceName.trim()
    if (!name || !pendingRootPath) return
    setIsWorking(true)
    setError(null)
    try {
      await api.saveConfig(pendingRootPath, name)
      await api.createWorkspace(pendingRootPath, name)
      setRootPath(pendingRootPath)
      setActiveWorkspace(name)
      // Navigation is handled by AppRoutes' useEffect once rootPath lands in context
    } catch (e) {
      setError(String(e))
      setIsWorking(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8">
      {/* Logo / title */}
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{ backgroundColor: 'var(--accent)' }}>
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Course Dashboard</h1>
        <p className="mt-2 text-gray-500">Your local-first course management workspace</p>
      </div>

      {step === 'select-folder' ? (
        <div className="card w-full max-w-md p-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Select your vault folder</h2>
          <p className="mb-6 text-sm text-gray-500">
            Choose a root folder where your workspaces will be stored. A{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">.app-config.json</code> file
            will be created there.
          </p>
          <button
            onClick={handleSelectDirectory}
            disabled={isWorking}
            className="btn-primary w-full justify-center py-3"
          >
            {isWorking ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Opening…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Choose Folder
              </>
            )}
          </button>
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
        </div>
      ) : (
        <div className="card w-full max-w-md p-8">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Name your first workspace</h2>
          <p className="mb-6 text-sm text-gray-500">
            Workspaces let you group courses by semester or year. You can create more later.
          </p>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Workspace name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
                autoFocus
                placeholder="e.g. Spring 2026"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('select-folder')}
                className="btn-secondary flex-1 justify-center"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isWorking || !workspaceName.trim()}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {isWorking ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Get Started'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        All data stays on your machine. No accounts, no sync, no internet required.
      </p>
    </div>
  )
}
