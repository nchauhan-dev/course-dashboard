import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  loadConfig: () => ipcRenderer.invoke('app:load-config'),
  saveConfig: (rootPath: string, activeWorkspace: string, accentColor?: string) => ipcRenderer.invoke('app:save-config', rootPath, activeWorkspace, accentColor),
  findExistingConfig: () => ipcRenderer.invoke('app:find-existing-config'),

  getWorkspaces: (rootPath: string) => ipcRenderer.invoke('fs:get-workspaces', rootPath),
  createWorkspace: (rootPath: string, name: string) => ipcRenderer.invoke('fs:create-workspace', rootPath, name),
  switchWorkspace: (rootPath: string, name: string) => ipcRenderer.invoke('fs:switch-workspace', rootPath, name),

  getCourses: (rootPath: string) => ipcRenderer.invoke('fs:get-courses', rootPath),
  createCourse: (params: unknown) => ipcRenderer.invoke('fs:create-course', params),
  deleteCourse: (coursePath: string) => ipcRenderer.invoke('fs:delete-course', coursePath),

  getAssignments: (courseId: string, coursePath: string, courseName: string, courseColor: string) =>
    ipcRenderer.invoke('fs:get-assignments', courseId, coursePath, courseName, courseColor),
  createAssignment: (params: unknown) => ipcRenderer.invoke('fs:create-assignment', params),

  submitFiles: (params: unknown) => ipcRenderer.invoke('fs:submit-files', params),
  deleteSubmission: (submissionPath: string) => ipcRenderer.invoke('fs:delete-submission', submissionPath),

  getCalendarEvents: (rootPath: string, startDate: string, endDate: string) =>
    ipcRenderer.invoke('fs:get-calendar-events', rootPath, startDate, endDate),

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
    ipcRenderer.invoke('fs:copy-file', params)
})
