import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { v4 as uuidv4 } from 'uuid'
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
} from '../../types/index'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── File System Helpers ──────────────────────────────────────────────────────

function parseMd<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data } = matter(raw)
    return data as T
  } catch {
    return null
  }
}

function parseMdWithContent(filePath: string): { data: Record<string, unknown>; content: string } | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)
    return { data, content }
  } catch {
    return null
  }
}

function writeMd(filePath: string, frontmatter: Record<string, unknown>, body = ''): void {
  const content = matter.stringify(body, frontmatter)
  fs.writeFileSync(filePath, content, 'utf-8')
}

function getSubmissions(assignmentPath: string, assignmentId: string): Submission[] {
  const submissionsDir = path.join(assignmentPath, 'submissions')
  if (!fs.existsSync(submissionsDir)) return []

  const submissions: Submission[] = []
  const entries = fs.readdirSync(submissionsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const parsed = parseMdWithContent(path.join(submissionsDir, entry.name))
      if (!parsed) continue
      const { data, content } = parsed
      submissions.push({
        id: entry.name.replace('.md', ''),
        assignmentId,
        submission_timestamp: String(data.submission_timestamp ?? ''),
        assignment_due_date: String(data.assignment_due_date ?? ''),
        is_late: Boolean(data.is_late),
        days_late: Number(data.days_late ?? 0),
        hours_late: Number(data.hours_late ?? 0),
        files: Array.isArray(data.files_submitted) ? data.files_submitted : [],
        notes: content.trim()
      })
    }
  }

  return submissions.sort(
    (a, b) => new Date(b.submission_timestamp).getTime() - new Date(a.submission_timestamp).getTime()
  )
}

function getAssignmentsForCourse(
  coursePath: string,
  courseId: string,
  courseName: string,
  courseColor: string
): Assignment[] {
  const assignmentsDir = path.join(coursePath, 'Assignments')
  if (!fs.existsSync(assignmentsDir)) return []

  const assignments: Assignment[] = []
  const entries = fs.readdirSync(assignmentsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const assignmentPath = path.join(assignmentsDir, entry.name)
    const mdPath = path.join(assignmentPath, 'assignment.md')
    if (!fs.existsSync(mdPath)) continue

    const parsed = parseMdWithContent(mdPath)
    if (!parsed) continue
    const { data, content } = parsed

    assignments.push({
      id: String(data.id ?? uuidv4()),
      courseId,
      courseName,
      courseColor,
      name: String(data.name ?? entry.name),
      description: String(data.description ?? ''),
      due_date: String(data.due_date ?? ''),
      created: String(data.created ?? ''),
      points: Number(data.points ?? 0),
      instructions: content.trim(),
      path: assignmentPath,
      submissions: getSubmissions(assignmentPath, String(data.id ?? ''))
    })
  }

  return assignments
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('dialog:select-directory', async (): Promise<IpcResult<string>> => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    message: 'Select your courses vault folder'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'Cancelled' }
  }
  return { success: true, data: result.filePaths[0] }
})

function getConfigPath(): string {
  return path.join(app.getPath('userData'), '.app-config.json')
}

ipcMain.handle('app:load-config', (): IpcResult<AppConfig> => {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) return { success: false, error: 'No config found' }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig
    return { success: true, data: config }
  } catch {
    return { success: false, error: 'Failed to parse config' }
  }
})

ipcMain.handle('app:save-config', (_e, rootPath: string, activeWorkspace: string, accentColor?: string, userName?: string): IpcResult<void> => {
  try {
    const configPath = getConfigPath()
    let created = new Date().toISOString()
    let existingAccent: string | undefined
    let existingUserName: string | undefined
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig
      created = existing.created || created
      existingAccent = existing.accentColor
      existingUserName = existing.userName
    } catch { /* no existing config yet */ }
    const config: AppConfig = {
      rootPath,
      activeWorkspace,
      created,
      accentColor: accentColor ?? existingAccent,
      userName: userName ?? existingUserName
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    ensureArchiveFolder(rootPath)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('app:find-existing-config', (): IpcResult<AppConfig> => {
  const configPath = getConfigPath()
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig
      if (config.rootPath && fs.existsSync(config.rootPath)) {
        if (!config.activeWorkspace) config.activeWorkspace = ''
        return { success: true, data: config }
      }
    } catch {
      // ignore
    }
  }
  return { success: false }
})

ipcMain.handle('fs:get-workspaces', (_e, rootPath: string): IpcResult<string[]> => {
  if (!fs.existsSync(rootPath)) return { success: false, error: 'Root path does not exist' }
  try {
    const entries = fs.readdirSync(rootPath, { withFileTypes: true })
    const workspaces = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
    ensureArchiveFolder(rootPath)
    return { success: true, data: workspaces }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:create-workspace', (_e, rootPath: string, name: string): IpcResult<void> => {
  try {
    const workspacePath = path.join(rootPath, name)
    fs.mkdirSync(workspacePath, { recursive: true })
    const configPath = getConfigPath()
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig
    config.activeWorkspace = name
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:switch-workspace', (_e, rootPath: string, name: string): IpcResult<void> => {
  try {
    const configPath = getConfigPath()
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig
    config.activeWorkspace = name
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    ensureArchiveFolder(rootPath)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:get-courses', (_e, rootPath: string): IpcResult<Course[]> => {
  if (!fs.existsSync(rootPath)) return { success: false, error: 'Root path does not exist' }
  try {
    const courses: Course[] = []

    function scanCoursesDir(dir: string) {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue
        const courseMdPath = path.join(dir, entry.name, 'course.md')
        if (!fs.existsSync(courseMdPath)) continue
        const data = parseMd<Record<string, unknown>>(courseMdPath)
        if (!data) continue
        courses.push({
          id: String(data.id ?? uuidv4()),
          name: String(data.name ?? entry.name),
          description: String(data.description ?? ''),
          color: String(data.color ?? '#6366f1'),
          created: String(data.created ?? ''),
          sections: Array.isArray(data.sections) ? (data.sections as string[]) : ['Resources', 'Weekly', 'Assignments'],
          path: path.join(dir, entry.name)
        })
      }
    }

    scanCoursesDir(rootPath)

    return { success: true, data: courses }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:create-course', (_e, params: CreateCourseParams): IpcResult<Course> => {
  const { rootPath, name, description, color } = params
  const coursePath = path.join(rootPath, name)
  if (fs.existsSync(coursePath)) return { success: false, error: 'A course with that name already exists' }

  try {
    fs.mkdirSync(coursePath, { recursive: true })
    for (const section of ['Resources', 'Weekly', 'Assignments']) {
      fs.mkdirSync(path.join(coursePath, section), { recursive: true })
    }

    const id = uuidv4()
    writeMd(path.join(coursePath, 'course.md'), {
      id,
      name,
      description,
      color,
      created: new Date().toISOString(),
      sections: ['Resources', 'Weekly', 'Assignments']
    })

    return {
      success: true,
      data: {
        id,
        name,
        description,
        color,
        created: new Date().toISOString(),
        sections: ['Resources', 'Weekly', 'Assignments'],
        path: coursePath
      }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:delete-course', (_e, coursePath: string): IpcResult<void> => {
  if (!fs.existsSync(coursePath)) return { success: false, error: 'Course path not found' }
  try {
    fs.rmSync(coursePath, { recursive: true, force: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle(
  'fs:get-assignments',
  (_e, courseId: string, coursePath: string, courseName: string, courseColor: string): IpcResult<Assignment[]> => {
    try {
      const assignments = getAssignmentsForCourse(coursePath, courseId, courseName, courseColor)
      return { success: true, data: assignments }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
)

ipcMain.handle('fs:create-assignment', (_e, params: CreateAssignmentParams): IpcResult<Assignment> => {
  const { coursePath, courseId, name, description, due_date, points, instructions } = params
  const assignmentsDir = path.join(coursePath, 'Assignments')
  fs.mkdirSync(assignmentsDir, { recursive: true })

  const assignmentDir = path.join(assignmentsDir, name)
  if (fs.existsSync(assignmentDir)) return { success: false, error: 'Assignment with that name already exists' }

  try {
    fs.mkdirSync(assignmentDir, { recursive: true })
    fs.mkdirSync(path.join(assignmentDir, 'submissions'), { recursive: true })

    const id = uuidv4()
    writeMd(
      path.join(assignmentDir, 'assignment.md'),
      { id, name, description, due_date, created: new Date().toISOString(), points },
      instructions
    )

    return {
      success: true,
      data: {
        id,
        courseId,
        courseName: '',
        courseColor: '',
        name,
        description,
        due_date,
        created: new Date().toISOString(),
        points,
        instructions,
        path: assignmentDir,
        submissions: []
      }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:submit-files', async (_e, params: SubmitFilesParams): Promise<IpcResult<Submission>> => {
  const { assignmentPath, assignmentId, due_date, filePaths, notes } = params
  const submissionsDir = path.join(assignmentPath, 'submissions')
  fs.mkdirSync(submissionsDir, { recursive: true })

  const now = new Date()
  const dueDate = new Date(due_date)
  const timeDiff = now.getTime() - dueDate.getTime()
  const is_late = timeDiff > 0
  const days_late = is_late ? Math.floor(timeDiff / 86400000) : 0
  const hours_late = is_late ? Math.floor((timeDiff % 86400000) / 3600000) : 0

  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  const submissionId = `submission_${timestamp}`
  const copiedFiles: string[] = []

  try {
    for (const srcPath of filePaths) {
      const fileName = path.basename(srcPath)
      const destPath = path.join(submissionsDir, fileName)
      fs.copyFileSync(srcPath, destPath)
      copiedFiles.push(fileName)
    }

    writeMd(
      path.join(submissionsDir, `${submissionId}.md`),
      {
        submission_timestamp: now.toISOString(),
        is_late,
        days_late,
        hours_late,
        files_submitted: copiedFiles,
        assignment_due_date: due_date
      },
      notes
    )

    return {
      success: true,
      data: {
        id: submissionId,
        assignmentId,
        submission_timestamp: now.toISOString(),
        assignment_due_date: due_date,
        is_late,
        days_late,
        hours_late,
        files: copiedFiles,
        notes
      }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:delete-submission', (_e, submissionPath: string): IpcResult<void> => {
  try {
    fs.rmSync(submissionPath, { force: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle(
  'fs:get-calendar-events',
  (_e, rootPath: string, startDate: string, endDate: string): IpcResult<CalendarEvent[]> => {
    if (!fs.existsSync(rootPath)) return { success: false, error: 'Root path does not exist' }
    try {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const entries = fs.readdirSync(rootPath, { withFileTypes: true })
      const events: CalendarEvent[] = []

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue
        const coursePath = path.join(rootPath, entry.name)
        const courseMdPath = path.join(coursePath, 'course.md')
        if (!fs.existsSync(courseMdPath)) continue

        const courseData = parseMd<Record<string, unknown>>(courseMdPath)
        if (!courseData) continue
        const courseId = String(courseData.id ?? '')
        const courseName = String(courseData.name ?? entry.name)
        const courseColor = String(courseData.color ?? '#6366f1')

        const assignments = getAssignmentsForCourse(coursePath, courseId, courseName, courseColor)
        for (const assignment of assignments) {
          if (!assignment.due_date) continue
          const dueDate = new Date(assignment.due_date)
          // Include if within the requested window OR if overdue with no submission
          const isLate = assignment.submissions.length === 0 && dueDate < new Date()
          if (dueDate >= start && dueDate <= end || isLate) {
            events.push({
              id: assignment.id,
              title: assignment.name,
              due_date: assignment.due_date,
              courseId,
              courseName,
              courseColor,
              assignmentId: assignment.id,
              type: 'assignment',
              isLate
            })
          }
        }
      }

      events.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      return { success: true, data: events }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
)

ipcMain.handle('fs:get-section-files', (_e, sectionPath: string): IpcResult<string[]> => {
  if (!fs.existsSync(sectionPath)) return { success: true, data: [] }
  try {
    const files = fs
      .readdirSync(sectionPath, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
    return { success: true, data: files }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:read-file', (_e, filePath: string): IpcResult<string> => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, data: content }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})


ipcMain.handle('shell:open-path', (_e, filePath: string): void => {
  shell.openPath(filePath)
})

function ensureArchiveFolder(rootPath: string): void {
  fs.mkdirSync(path.join(rootPath, '_Archive'), { recursive: true })
}

function readDirRecursive(dirPath: string, skipName?: string): TreeNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  return entries
    .filter((e) => !e.name.startsWith('.') && e.name !== skipName)
    .map((e) => {
      const fullPath = path.join(dirPath, e.name)
      if (e.isDirectory()) {
        return {
          name: e.name,
          path: fullPath,
          isDirectory: true,
          children: readDirRecursive(fullPath)
        }
      }
      const size = (() => { try { return fs.statSync(fullPath).size } catch { return 0 } })()
      return { name: e.name, path: fullPath, isDirectory: false, size }
    })
}

ipcMain.handle('fs:read-directory', (_e, dirPath: string): IpcResult<TreeNode[]> => {
  if (!fs.existsSync(dirPath)) return { success: false, error: 'Path does not exist' }
  try {
    return { success: true, data: readDirRecursive(dirPath, 'Assignments') }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:create-folder', (_e, folderPath: string): IpcResult<void> => {
  try {
    fs.mkdirSync(folderPath, { recursive: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle(
  'fs:rename-folder',
  (_e, { oldPath, newName }: { oldPath: string; newName: string }): IpcResult<void> => {
    try {
      fs.renameSync(oldPath, path.join(path.dirname(oldPath), newName))
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
)

ipcMain.handle(
  'fs:delete-folder',
  (_e, { folderPath }: { folderPath: string }): IpcResult<void> => {
    try {
      const configPath = getConfigPath()
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig
      const archiveDir = path.join(config.rootPath, '_Archive')
      fs.mkdirSync(archiveDir, { recursive: true })

      const originalName = path.basename(folderPath)
      const ext = path.extname(originalName)
      const base = ext ? originalName.slice(0, -ext.length) : originalName
      const encoded = Buffer.from(folderPath).toString('base64')
      const archivedName = ext
        ? `${base}_${Date.now()}_${encoded}${ext}`
        : `${originalName}_${Date.now()}_${encoded}`

      fs.renameSync(folderPath, path.join(archiveDir, archivedName))
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
)

ipcMain.handle(
  'fs:restore-archive-item',
  (_e, { itemPath, rootPath }: { itemPath: string; rootPath: string }): IpcResult<void> => {
    try {
      const archivedName = path.basename(itemPath)
      const ext = path.extname(archivedName)
      // Strip extension to work on the stem, e.g. "report_1714000000000_<b64>"
      const stem = ext ? archivedName.slice(0, -ext.length) : archivedName

      // Format: originalBase_timestamp_base64
      const threePartMatch = stem.match(/^(.+)_(\d{13})_([A-Za-z0-9+/=]+)$/)
      if (!threePartMatch) {
        return { success: false, error: 'Archived name format not recognised' }
      }
      const originalBase = threePartMatch[1]
      const originalName = originalBase + ext
      const encoded = threePartMatch[3]
      const originalPath = Buffer.from(encoded, 'base64').toString('utf8')
      // originalPath is the full path the item was deleted from — use its directory
      const originalDir = path.dirname(originalPath)

      // If the original directory still exists, restore there; otherwise fall back
      // to the first workspace folder under rootPath
      let destDir: string
      if (fs.existsSync(originalDir)) {
        destDir = originalDir
      } else {
        const entries = fs.readdirSync(rootPath, { withFileTypes: true })
        const firstWorkspace = entries.find(
          (e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== '_Archive'
        )
        destDir = firstWorkspace ? path.join(rootPath, firstWorkspace.name) : rootPath
      }

      const destPath = path.join(destDir, originalName)
      fs.renameSync(itemPath, destPath)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
)

ipcMain.handle(
  'fs:delete-permanent',
  (_e, { itemPath }: { itemPath: string }): IpcResult<void> => {
    try {
      fs.rmSync(itemPath, { recursive: true, force: true })
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
)

ipcMain.handle(
  'fs:copy-file',
  (_e, { sourcePath, destinationFolder }: { sourcePath: string; destinationFolder: string }): IpcResult<void> => {
    console.log('[main] fs:copy-file — sourcePath:', sourcePath, '| destinationFolder:', destinationFolder)
    try {
      const dest = path.join(destinationFolder, path.basename(sourcePath))
      fs.copyFileSync(sourcePath, dest)
      console.log('[main] fs:copy-file — success, copied to:', dest)
      return { success: true }
    } catch (e) {
      console.error('[main] fs:copy-file — error:', e)
      return { success: false, error: String(e) }
    }
  }
)
