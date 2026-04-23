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
  const [isChangingVault, setIsChangingVault] = useState(false)

  // Sync selected color from CSS variable whenever modal opens
  useEffect(() => {
    if (open) {
      const current = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim()
      setSelectedColor(current || '#4F46E5')
    }
  }, [open])

  if (!open) return null

  function handlePickColor(hex: string) {
    setSelectedColor(hex)
    document.documentElement.style.setProperty('--accent', hex)
    if (rootPath) {
      api.saveConfig(rootPath, activeWorkspace, hex)
    }
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
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Accent Color */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Accent Color</h3>
          <div className="flex gap-2.5">
            {ACCENT_COLORS.map(({ name, hex }) => {
              const isSelected = selectedColor.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  key={name}
                  title={name}
                  onClick={() => handlePickColor(hex)}
                  className="relative h-7 w-7 flex-shrink-0 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: hex,
                    boxShadow: isSelected
                      ? `inset 0 0 0 2px white, 0 0 0 2px ${hex}`
                      : undefined
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Vault Location */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Vault Location</h3>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={rootPath ?? ''}
              className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-default"
            />
            <button
              onClick={handleChangeVault}
              disabled={isChangingVault}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 focus:outline-none"
            >
              {isChangingVault ? '…' : 'Change'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
