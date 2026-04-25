import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  loadConfig: () => ipcRenderer.invoke('app:load-config'),
  saveConfig: (rootPath: string, activeWorkspace: string, accentColor?: string, userName?: string) => ipcRenderer.invoke('app:save-config', rootPath, activeWorkspace, accentColor, userName),
  findExistingConfig: () => ipcRenderer.invoke('app:find-existing-config'),

  getWorkspaces: (rootPath: string) => ipcRenderer.invoke('fs:get-workspaces', rootPath),
  createWorkspace: (rootPath: string, name: string) => ipcRenderer.invoke('fs:create-workspace', rootPath, name),
  switchWorkspace: (rootPath: string, name: string) => ipcRenderer.invoke('fs:switch-workspace', rootPath, name),

  getProjects: (rootPath: string) => ipcRenderer.invoke('fs:get-projects', rootPath),
  createProject: (params: unknown) => ipcRenderer.invoke('fs:create-project', params),
  deleteProject: (projectPath: string) => ipcRenderer.invoke('fs:delete-project', projectPath),

  getAssignments: (projectId: string, projectPath: string, projectName: string, projectColor: string) =>
    ipcRenderer.invoke('fs:get-assignments', projectId, projectPath, projectName, projectColor),
  createAssignment: (params: unknown) => ipcRenderer.invoke('fs:create-assignment', params),

  submitFiles: (params: unknown) => ipcRenderer.invoke('fs:submit-files', params),
  deleteSubmission: (submissionPath: string) => ipcRenderer.invoke('fs:delete-submission', submissionPath),

  getCalendarEvents: (rootPath: string, startDate: string, endDate: string) =>
    ipcRenderer.invoke('fs:get-calendar-events', rootPath, startDate, endDate),

  getActivity: (projectPath: string) => ipcRenderer.invoke('fs:get-activity', projectPath),
  getProjectMeta: (projectPath: string) => ipcRenderer.invoke('fs:get-project-meta', projectPath),
  getProjectNotes: (projectPath: string) => ipcRenderer.invoke('fs:get-project-notes', projectPath),
  setProjectNotes: (projectPath: string, description: string, outcome: string) => ipcRenderer.invoke('fs:set-project-notes', projectPath, description, outcome),

  getSectionFiles: (sectionPath: string) => ipcRenderer.invoke('fs:get-section-files', sectionPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath),
  openPath: (filePath: string) => ipcRenderer.invoke('shell:open-path', filePath),

  readDirectory: (dirPath: string) => ipcRenderer.invoke('fs:read-directory', dirPath),
  createFolder: (folderPath: string) => ipcRenderer.invoke('fs:create-folder', folderPath),
  renameFolder: (params: { oldPath: string; newName: string }) =>
    ipcRenderer.invoke('fs:rename-folder', params),
  deleteFolder: (params: { folderPath: string }) =>
    ipcRenderer.invoke('fs:delete-folder', params),
  copyFile: (params: { sourcePath: string; destinationFolder: string }) =>
    ipcRenderer.invoke('fs:copy-file', params),
  restoreArchiveItem: (params: { itemPath: string; rootPath: string }) =>
    ipcRenderer.invoke('fs:restore-archive-item', params),
  deletePermanent: (params: { itemPath: string }) =>
    ipcRenderer.invoke('fs:delete-permanent', params)
})
