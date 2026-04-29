import { useState, useEffect } from 'react'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'

const ACCENT_COLORS = [
  { name: 'Red',    hex: '#EF4444' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Green',  hex: '#22C55E' },
  { name: 'Blue',   hex: '#3B82F6' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink',   hex: '#EC4899' },
  { name: 'Grey',   hex: '#6B7280' },
  { name: 'Indigo', hex: '#4F46E5' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: Props) {
  const { rootPath, activeWorkspace, setRootPath } = useApp()
  const [selectedColor, setSelectedColor] = useState('#4F46E5')
  const [isDark, setIsDark] = useState(false)
  const [isChangingVault, setIsChangingVault] = useState(false)
  const [userName, setUserName] = useState('')

  // Sync state from config/DOM whenever modal opens
  useEffect(() => {
    if (!open) return
    const current = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent')
      .trim()
    setSelectedColor(current || '#4F46E5')
    setIsDark(document.documentElement.dataset.theme === 'dark')
    api.loadConfig().then((res) => {
      if (res.success && res.data?.userName) {
        setUserName(res.data.userName)
      }
    })
  }, [open])

  if (!open) return null

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value
    setUserName(name)
    if (rootPath) {
      api.saveConfig(rootPath, activeWorkspace, selectedColor, name)
    }
  }

  function handlePickColor(hex: string) {
    setSelectedColor(hex)
    document.documentElement.style.setProperty('--accent', hex)
    if (rootPath) {
      api.saveConfig(rootPath, activeWorkspace, hex, userName)
    }
  }

  function handleToggleDark() {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.dataset.theme = 'dark'
    } else {
      delete document.documentElement.dataset.theme
    }
    api.setTheme(next ? 'dark' : 'light')
  }

  async function handleChangeVault() {
    setIsChangingVault(true)
    const result = await api.selectDirectory()
    if (result.success && result.data) {
      await api.saveConfig(result.data, activeWorkspace, selectedColor)
      setRootPath(result.data)
    }
    setIsChangingVault(false)
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--color-ink2)', marginBottom: 10,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{ display: 'flex', padding: 4, borderRadius: 6, color: 'var(--color-mute)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-s)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 22 }}>
          <p style={sectionLabel}>Name</p>
          <input
            type="text"
            value={userName}
            onChange={handleNameChange}
            placeholder="Your name"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              border: '1px solid var(--color-border)',
              background: 'var(--color-panel2)',
              color: 'var(--color-ink)',
            }}
          />
        </div>

        {/* Accent Color */}
        <div style={{ marginBottom: 22 }}>
          <p style={sectionLabel}>Accent Color</p>
          <div style={{ display: 'flex', gap: 10 }}>
            {ACCENT_COLORS.map(({ name, hex }) => {
              const isSelected = selectedColor.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  key={name}
                  title={name}
                  onClick={() => handlePickColor(hex)}
                  style={{
                    width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
                    background: hex, border: 'none', cursor: 'pointer',
                    transition: 'transform 0.1s',
                    boxShadow: isSelected ? `inset 0 0 0 2px white, 0 0 0 2px ${hex}` : undefined,
                    transform: isSelected ? 'scale(1.1)' : undefined,
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Dark Mode */}
        <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ ...sectionLabel, marginBottom: 0 }}>Dark Mode</p>
          {/* Toggle switch */}
          <button
            onClick={handleToggleDark}
            role="switch"
            aria-checked={isDark}
            style={{
              width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer',
              background: isDark ? 'var(--accent)' : 'var(--color-border)',
              position: 'relative', flexShrink: 0, transition: 'background 0.2s',
              padding: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: isDark ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%',
              background: 'white',
              transition: 'left 0.2s',
              display: 'block',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }} />
          </button>
        </div>

        {/* Vault Location */}
        <div>
          <p style={sectionLabel}>Vault Location</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              readOnly
              value={rootPath ?? ''}
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={{
                border: '1px solid var(--color-border)',
                background: 'var(--color-panel2)',
                color: 'var(--color-mute)',
                cursor: 'default',
              }}
            />
            <button
              onClick={handleChangeVault}
              disabled={isChangingVault}
              className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
              style={{
                border: '1px solid var(--color-border)',
                background: 'var(--color-panel)',
                color: 'var(--color-ink2)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-panel2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-panel)')}
            >
              {isChangingVault ? '…' : 'Change'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
