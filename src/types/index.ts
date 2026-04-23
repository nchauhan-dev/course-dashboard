export interface Course {
  id: string
  name: string
  description: string
  color: string
  created: string
  sections: string[]
  path: string
}

export interface Assignment {
  id: string
  courseId: string
  courseName: string
  courseColor: string
  name: string
  description: string
  due_date: string
  created: string
  points: number
  instructions: string
  path: string
  submissions: Submission[]
}

export interface Submission {
  id: string
  assignmentId: string
  submission_timestamp: string
  assignment_due_date: string
  is_late: boolean
  days_late: number
  hours_late: number
  files: string[]
  notes: string
}

export interface CalendarEvent {
  id: string
  title: string
  due_date: string
  courseId: string
  courseName: string
  courseColor: string
  assignmentId: string
  type: 'assignment'
  isLate: boolean
}

export interface AppConfig {
  rootPath: string
  created: string
  activeWorkspace: string
  accentColor?: string
}

export interface CreateCourseParams {
  rootPath: string
  name: string
  description: string
  color: string
}

export interface CreateAssignmentParams {
  coursePath: string
  courseId: string
  name: string
  description: string
  due_date: string
  points: number
  instructions: string
}

export interface SubmitFilesParams {
  assignmentPath: string
  assignmentId: string
  due_date: string
  filePaths: string[]
  notes: string
}

export interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: TreeNode[]
}

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}
