import type {
  Project,
  Assignment,
  Submission,
  CalendarEvent,
  AppConfig,
  TreeNode,
  CreateProjectParams,
  CreateAssignmentParams,
  SubmitFilesParams,
  IpcResult
} from '../../../types/index'

declare global {
  interface Window {
    api: {
      selectDirectory: () => Promise<IpcResult<string>>
      loadConfig: () => Promise<IpcResult<AppConfig>>
      saveConfig: (rootPath: string, activeWorkspace: string, accentColor?: string, userName?: string) => Promise<IpcResult<void>>
      findExistingConfig: () => Promise<IpcResult<AppConfig>>

      getWorkspaces: (rootPath: string) => Promise<IpcResult<string[]>>
      createWorkspace: (rootPath: string, name: string) => Promise<IpcResult<void>>
      switchWorkspace: (rootPath: string, name: string) => Promise<IpcResult<void>>

      getProjects: (rootPath: string) => Promise<IpcResult<Project[]>>
      createProject: (params: CreateProjectParams) => Promise<IpcResult<Project>>
      deleteProject: (projectPath: string) => Promise<IpcResult<void>>

      getAssignments: (
        projectId: string,
        projectPath: string,
        projectName: string,
        projectColor: string
      ) => Promise<IpcResult<Assignment[]>>
      createAssignment: (params: CreateAssignmentParams) => Promise<IpcResult<Assignment>>

      submitFiles: (params: SubmitFilesParams) => Promise<IpcResult<Submission>>
      deleteSubmission: (submissionPath: string) => Promise<IpcResult<void>>

      getCalendarEvents: (
        rootPath: string,
        startDate: string,
        endDate: string
      ) => Promise<IpcResult<CalendarEvent[]>>

      getActivity: (projectPath: string) => Promise<IpcResult<{ start: string; end: string; durationMinutes: number }[]>>
      getProjectMeta: (projectPath: string) => Promise<IpcResult<{ createdAt: string }>>
      getProjectNotes: (projectPath: string) => Promise<IpcResult<{ description: string; outcome: string }>>
      setProjectNotes: (projectPath: string, description: string, outcome: string) => Promise<IpcResult<void>>

      getSectionFiles: (sectionPath: string) => Promise<IpcResult<string[]>>
      readFile: (filePath: string) => Promise<IpcResult<string>>
      openPath: (filePath: string) => Promise<void>

      readDirectory: (dirPath: string) => Promise<IpcResult<TreeNode[]>>
      createFolder: (folderPath: string) => Promise<IpcResult<void>>
      renameFolder: (params: { oldPath: string; newName: string }) => Promise<IpcResult<void>>
      deleteFolder: (params: { folderPath: string }) => Promise<IpcResult<void>>
      copyFile: (params: { sourcePath: string; destinationFolder: string }) => Promise<IpcResult<void>>
      restoreArchiveItem: (params: { itemPath: string; rootPath: string }) => Promise<IpcResult<void>>
      deletePermanent: (params: { itemPath: string }) => Promise<IpcResult<void>>
    }
  }
}

export const api = {
  selectDirectory: () => window.api.selectDirectory(),
  loadConfig: () => window.api.loadConfig(),
  saveConfig: (rootPath: string, activeWorkspace: string, accentColor?: string, userName?: string) => window.api.saveConfig(rootPath, activeWorkspace, accentColor, userName),
  findExistingConfig: () => window.api.findExistingConfig(),

  getWorkspaces: (rootPath: string) => window.api.getWorkspaces(rootPath),
  createWorkspace: (rootPath: string, name: string) => window.api.createWorkspace(rootPath, name),
  switchWorkspace: (rootPath: string, name: string) => window.api.switchWorkspace(rootPath, name),

  getProjects: (rootPath: string) => window.api.getProjects(rootPath),
  createProject: (params: CreateProjectParams) => window.api.createProject(params),
  deleteProject: (projectPath: string) => window.api.deleteProject(projectPath),

  getAssignments: (projectId: string, projectPath: string, projectName: string, projectColor: string) =>
    window.api.getAssignments(projectId, projectPath, projectName, projectColor),
  createAssignment: (params: CreateAssignmentParams) => window.api.createAssignment(params),

  submitFiles: (params: SubmitFilesParams) => window.api.submitFiles(params),
  deleteSubmission: (submissionPath: string) => window.api.deleteSubmission(submissionPath),

  getCalendarEvents: (rootPath: string, startDate: string, endDate: string) =>
    window.api.getCalendarEvents(rootPath, startDate, endDate),

  getActivity: (projectPath: string) => window.api.getActivity(projectPath),
  getProjectMeta: (projectPath: string) => window.api.getProjectMeta(projectPath),
  getProjectNotes: (projectPath: string) => window.api.getProjectNotes(projectPath),
  setProjectNotes: (projectPath: string, description: string, outcome: string) => window.api.setProjectNotes(projectPath, description, outcome),

  getSectionFiles: (sectionPath: string) => window.api.getSectionFiles(sectionPath),
  readFile: (filePath: string) => window.api.readFile(filePath),
  openPath: (filePath: string) => window.api.openPath(filePath),

  readDirectory: (dirPath: string) => window.api.readDirectory(dirPath),
  createFolder: (folderPath: string) => window.api.createFolder(folderPath),
  renameFolder: (params: { oldPath: string; newName: string }) => window.api.renameFolder(params),
  deleteFolder: (params: { folderPath: string }) => window.api.deleteFolder(params),
  copyFile: (params: { sourcePath: string; destinationFolder: string }) => window.api.copyFile(params),
  restoreArchiveItem: (params: { itemPath: string; rootPath: string }) => window.api.restoreArchiveItem(params),
  deletePermanent: (params: { itemPath: string }) => window.api.deletePermanent(params)
}
