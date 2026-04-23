import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { api } from '../lib/api'
import type { Course } from '../../../../types/index'

interface Props {
  course: Course
}

export default function CourseCard({ course }: Props) {
  const navigate = useNavigate()
  const { removeCourse, calendarEvents } = useApp()
  const [isHovered, setIsHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const upcomingCount = calendarEvents.filter(
    (e) => e.courseId === course.id && new Date(e.due_date) >= new Date()
  ).length

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setIsDeleting(true)
    await api.deleteCourse(course.path)
    removeCourse(course.id)
  }

  function cancelDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDelete(false)
  }

  return (
    <div
      className="card group cursor-pointer p-5 transition-shadow hover:shadow-md relative"
      onClick={() => navigate(`/course/${course.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setConfirmDelete(false) }}
    >
      {/* Color bar */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: course.color }}
      />

      <div className="pl-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: course.color }}
            />
            <h3 className="font-semibold truncate text-gray-900">
              {course.name}
            </h3>
          </div>

          {isHovered && !isDeleting && (
            <div className="flex gap-1 no-drag flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {confirmDelete ? (
                <>
                  <button
                    onClick={handleDelete}
                    className="rounded-md px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={cancelDelete}
                    className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDelete}
                  className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Delete course"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {course.description && (
          <p className="mt-2 text-sm line-clamp-2 text-gray-500">
            {course.description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
          <span>{course.sections.length} sections</span>
          {upcomingCount > 0 && (
            <>
              <span>·</span>
              <span className="font-medium" style={{ color: 'var(--accent)' }}>
                {upcomingCount} upcoming
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
