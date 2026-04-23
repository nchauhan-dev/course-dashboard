import type {
  Course,
  Assignment,
  Submission,
  CalendarEvent,
  AppConfig,
  TreeNode,
  CreateCourseParams,
  CreateAssignmentParams,
  SubmitFilesParams,
  IpcResult
} from '../../../types/index'

declare global {
  interface Window {
    api: {
      selectDirectory: () => Promise<IpcResult<string>>
      loadConfig: () => Promise<IpcResult<AppConfig>>
      saveConfig: (rootPath: string, activeWorkspace: string, accentColor?: string) => Promise<IpcResult<void>>
      findExistingConfig: () => Promise<IpcResult<AppConfig>>

      getWorkspaces: (rootPath: string) => Promise<IpcResult<string[]>>
      createWorkspace: (rootPath: string, name: string) => Promise<IpcResult<void>>
      switchWorkspace: (rootPath: string, name: string) => Promise<IpcResult<void>>

      getCourses: (rootPath: string) => Promise<IpcResult<Course[]>>
      createCourse: (params: CreateCourseParams) => Promise<IpcResult<Course>>
      deleteCourse: (coursePath: string) => Promise<IpcResult<void>>

      getAssignments: (
        courseId: string,
        coursePath: string,
        courseName: string,
        courseColor: string
      ) => Promise<IpcResult<Assignment[]>>
      createAssignment: (params: CreateAssignmentParams) => Promise<IpcResult<Assignment>>

      submitFiles: (params: SubmitFilesParams) => Promise<IpcResult<Submission>>
      deleteSubmission: (submissionPath: string) => Promise<IpcResult<void>>

      getCalendarEvents: (
        rootPath: string,
        startDate: string,
        endDate: string
      ) => Promise<IpcResult<CalendarEvent[]>>

      getSectionFiles: (sectionPath: string) => Promise<IpcResult<string[]>>
      readFile: (filePath: string) => Promise<IpcResult<string>>
      openPath: (filePath: string) => Promise<void>

      readDirectory: (dirPath: string) => Promise<IpcResult<TreeNode[]>>
      createFolder: (folderPath: string) => Promise<IpcResult<void>>
      renameFolder: (params: { oldPath: string; newName: string }) => Promise<IpcResult<void>>
      deleteFolder: (params: { folderPath: string }) => Promise<IpcResult<void>>
      copyFile: (params: { sourcePath: string; destinationFolder: string }) => Promise<IpcResult<void>>
    }
  }
}

export const api = {
  selectDirectory: () => window.api.selectDirectory(),
  loadConfig: () => window.api.loadConfig(),
  saveConfig: (rootPath: string, activeWorkspace: string, accentColor?: string) => window.api.saveConfig(rootPath, activeWorkspace, accentColor),
  findExistingConfig: () => window.api.findExistingConfig(),

  getWorkspaces: (rootPath: string) => window.api.getWorkspaces(rootPath),
  createWorkspace: (rootPath: string, name: string) => window.api.createWorkspace(rootPath, name),
  switchWorkspace: (rootPath: string, name: string) => window.api.switchWorkspace(rootPath, name),

  getCourses: (rootPath: string) => window.api.getCourses(rootPath),
  createCourse: (params: CreateCourseParams) => window.api.createCourse(params),
  deleteCourse: (coursePath: string) => window.api.deleteCourse(coursePath),

  getAssignments: (courseId: string, coursePath: string, courseName: string, courseColor: string) =>
    window.api.getAssignments(courseId, coursePath, courseName, courseColor),
  createAssignment: (params: CreateAssignmentParams) => window.api.createAssignment(params),

  submitFiles: (params: SubmitFilesParams) => window.api.submitFiles(params),
  deleteSubmission: (submissionPath: string) => window.api.deleteSubmission(submissionPath),

  getCalendarEvents: (rootPath: string, startDate: string, endDate: string) =>
    window.api.getCalendarEvents(rootPath, startDate, endDate),

  getSectionFiles: (sectionPath: string) => window.api.getSectionFiles(sectionPath),
  readFile: (filePath: string) => window.api.readFile(filePath),
  openPath: (filePath: string) => window.api.openPath(filePath),

  readDirectory: (dirPath: string) => window.api.readDirectory(dirPath),
  createFolder: (folderPath: string) => window.api.createFolder(folderPath),
  renameFolder: (params: { oldPath: string; newName: string }) => window.api.renameFolder(params),
  deleteFolder: (params: { folderPath: string }) => window.api.deleteFolder(params),
  copyFile: (params: { sourcePath: string; destinationFolder: string }) => window.api.copyFile(params)
}
