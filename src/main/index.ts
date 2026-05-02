import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import matter from 'gray-matter'
import { v4 as uuidv4 } from 'uuid'
import chokidar from 'chokidar'
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
  ProjectLink,
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
  process.on('unhandledRejection', (reason) => {
    console.warn('[main] unhandled rejection (suppressed):', reason)
  })

  let vaultPath: string | null = null

  // 1. Sync migration — must complete before window loads
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig
      if (config.rootPath && fs.existsSync(config.rootPath)) {
        migrateCourseMdFiles(config.rootPath)
        vaultPath = config.rootPath
      }
    }
  } catch (e) {
    console.error('[migration] failed to read config:', e)
  }

  // 2. Show the window immediately — don't block on activity scan
  createWindow()

  // 3. Activity init runs in the background after the window is ready
  if (vaultPath) {
    initAllProjectActivity(vaultPath).catch((e) =>
      console.error('[activity] background init failed:', e)
    )
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  // Close all chokidar watchers on exit
  for (const watcher of watchers.values()) {
    watcher.close().catch(() => { /* ignore close errors on exit */ })
  }
  watchers.clear()
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

function getAssignmentsForProject(
  projectPath: string,
  projectId: string,
  projectName: string,
  projectColor: string
): Assignment[] {
  const assignmentsDir = path.join(projectPath, 'Assignments')
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
      projectId,
      projectName,
      projectColor,
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

// ─── One-time migration: course.md → project.md ───────────────────────────────

function migrateCourseMdFiles(rootPath: string): void {
  if (!fs.existsSync(rootPath)) return
  let found = false

  // Quick check: does any course.md exist anywhere under rootPath?
  function hasCoursemd(dir: string): boolean {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          if (fs.existsSync(path.join(dir, entry.name, 'course.md'))) return true
          if (hasCoursemd(path.join(dir, entry.name))) return true
        }
      }
    } catch { /* ignore unreadable dirs */ }
    return false
  }

  found = hasCoursemd(rootPath)
  if (!found) return

  console.log('[migration] course.md → project.md detected, running migration…')

  function migrate(dir: string): void {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue
        const subDir = path.join(dir, entry.name)
        const oldMd = path.join(subDir, 'course.md')
        const newMd = path.join(subDir, 'project.md')
        if (fs.existsSync(oldMd) && !fs.existsSync(newMd)) {
          fs.renameSync(oldMd, newMd)
          console.log(`[migration] renamed: ${oldMd} → ${newMd}`)
        }
        migrate(subDir) // recurse into subdirectories
      }
    } catch (e) {
      console.error('[migration] error:', e)
    }
  }

  migrate(rootPath)
  console.log('[migration] complete')
}

// ─── Activity Tracking ────────────────────────────────────────────────────────

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActivityEvent {
  path: string               // relative to project root
  mtime: string              // ISO 8601, rounded to nearest second
  source: 'mtime' | 'chokidar'
}

interface ActivityFile {
  events: ActivityEvent[]
}

interface Session {
  start: string
  end: string
  durationMinutes: number
}

// ── In-memory state ────────────────────────────────────────────────────────────

/** Dedup set per project: `${relativePath}|${mtime}` */
const activityKeys  = new Map<string, Set<string>>()
/** Serialised write promise per project (write queue) */
const writeQueues   = new Map<string, Promise<void>>()
/** Live chokidar watcher per project */
const watchers      = new Map<string, ReturnType<typeof chokidar.watch>>()

// ── Junk-file filter ───────────────────────────────────────────────────────────

const JUNK_NAMES = new Set([
  'activity.json', 'activity.json.tmp',
  'project.md', 'assignment.md',
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
])
const JUNK_EXTS = new Set(['.tmp', '.swp', '.swo', '.bak'])

function isJunk(filePath: string): boolean {
  const name = path.basename(filePath)
  if (name.startsWith('.') || name.startsWith('~')) return true
  if (JUNK_NAMES.has(name)) return true
  if (JUNK_EXTS.has(path.extname(name).toLowerCase())) return true
  // Skip auto-generated submission .md files (always inside a submissions/ dir)
  if (filePath.includes(`${path.sep}submissions${path.sep}`) && name.endsWith('.md')) return true
  return false
}

// ── Timestamp helpers ──────────────────────────────────────────────────────────

function roundToSecond(d: Date): Date {
  return new Date(Math.round(d.getTime() / 1000) * 1000)
}

function makeActivityKey(relPath: string, mtime: string): string {
  return `${relPath}|${mtime}`
}

// ── activity.json I/O ──────────────────────────────────────────────────────────

function readActivityFile(projectPath: string): ActivityFile {
  try {
    const raw = fs.readFileSync(path.join(projectPath, 'activity.json'), 'utf-8')
    const parsed = JSON.parse(raw) as ActivityFile
    return Array.isArray(parsed?.events) ? parsed : { events: [] }
  } catch {
    return { events: [] }
  }
}

/** Atomic write: write to .tmp then rename so we never corrupt the live file. */
async function writeActivityFile(projectPath: string, file: ActivityFile): Promise<void> {
  const dest = path.join(projectPath, 'activity.json')
  const tmp  = dest + '.tmp'
  await fs.promises.writeFile(tmp, JSON.stringify(file, null, 2), 'utf-8')
  await fs.promises.rename(tmp, dest)
}

// ── Write queue ────────────────────────────────────────────────────────────────

function enqueueActivityWrite(projectPath: string, fn: () => Promise<void>): void {
  const prev = writeQueues.get(projectPath) ?? Promise.resolve()
  const next = prev
    .then(fn)
    .catch((e) => console.error('[activity] write error:', projectPath, e))
  writeQueues.set(projectPath, next)
}

/** Append new events to activity.json via the per-project write queue. */
function appendActivityEvents(projectPath: string, newEvents: ActivityEvent[]): void {
  if (newEvents.length === 0) return
  enqueueActivityWrite(projectPath, async () => {
    const file = readActivityFile(projectPath)
    file.events.push(...newEvents)
    await writeActivityFile(projectPath, file)
  })
}

// ── Session clustering ─────────────────────────────────────────────────────────

const SESSION_GAP_MS = 30 * 60 * 1000 // 30 minutes

function clusterSessions(events: ActivityEvent[]): Session[] {
  if (events.length === 0) return []

  const sorted = [...events].sort(
    (a, b) => new Date(a.mtime).getTime() - new Date(b.mtime).getTime()
  )

  const sessions: Session[] = []
  let sessionStart = new Date(sorted[0].mtime)
  let sessionEnd   = new Date(sorted[0].mtime)

  for (let i = 1; i < sorted.length; i++) {
    const t = new Date(sorted[i].mtime)
    if (t.getTime() - sessionEnd.getTime() > SESSION_GAP_MS) {
      sessions.push({
        start: sessionStart.toISOString(),
        end: sessionEnd.toISOString(),
        durationMinutes: Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 60000),
      })
      sessionStart = t
    }
    sessionEnd = t
  }

  sessions.push({
    start: sessionStart.toISOString(),
    end: sessionEnd.toISOString(),
    durationMinutes: Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 60000),
  })

  return sessions
}

function getProjectSessions(projectPath: string): Session[] {
  return clusterSessions(readActivityFile(projectPath).events)
}

// ── Startup mtime scan ─────────────────────────────────────────────────────────

async function scanProjectMtimes(projectPath: string): Promise<void> {
  const keySet = activityKeys.get(projectPath)!
  const newEvents: ActivityEvent[] = []

  async function walk(dir: string): Promise<void> {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) await walk(fullPath)
      } else if (entry.isFile()) {
        if (isJunk(fullPath)) continue
        try {
          const stat  = await fs.promises.stat(fullPath)
          const mtime = roundToSecond(stat.mtime).toISOString()
          const rel   = path.relative(projectPath, fullPath)
          const key   = makeActivityKey(rel, mtime)
          if (!keySet.has(key)) {
            keySet.add(key)
            newEvents.push({ path: rel, mtime, source: 'mtime' })
          }
        } catch {
          /* file vanished between readdir and stat — skip */
        }
      }
    }
  }

  await walk(projectPath)
  appendActivityEvents(projectPath, newEvents)
}

// ── Chokidar live watcher ──────────────────────────────────────────────────────

function startProjectWatcher(projectPath: string): void {
  if (watchers.has(projectPath)) return

  const keySet = activityKeys.get(projectPath)!

  try {
    const watcher = chokidar.watch(projectPath, {
      ignoreInitial: true,         // don't re-fire for files already scanned on startup
      persistent: true,
      followSymlinks: false,       // avoid infinite loops from circular symlinks
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
      ignored: (p: string) => isJunk(p),
      usePolling: true,            // avoid FSEvents native module crash on macOS
      interval: 2000,              // poll every 2s — low overhead for background tracking
    })

    function handleFile(filePath: string): void {
      try {
        const stat  = fs.statSync(filePath)
        const mtime = roundToSecond(stat.mtime).toISOString()
        const rel   = path.relative(projectPath, filePath)
        const key   = makeActivityKey(rel, mtime)
        if (keySet.has(key)) return
        keySet.add(key)
        appendActivityEvents(projectPath, [{ path: rel, mtime, source: 'chokidar' }])
      } catch {
        /* file disappeared before stat — ignore */
      }
    }

    watcher.on('add', handleFile)
    watcher.on('change', handleFile)
    watcher.on('error', (err) => console.warn('[activity] watcher error:', err))

    watchers.set(projectPath, watcher)
  } catch (err) {
    console.warn(`[activity] chokidar watch failed for ${projectPath}, falling back to mtime-only tracking:`, err)
  }
}

// ── Project initialisation ─────────────────────────────────────────────────────

async function initProjectActivity(projectPath: string): Promise<void> {
  if (activityKeys.has(projectPath)) return  // already initialised (idempotent)

  // Populate dedup set from existing activity.json so we never re-record known events
  const existing = readActivityFile(projectPath)
  const keySet   = new Set<string>()
  for (const ev of existing.events) {
    keySet.add(makeActivityKey(ev.path, ev.mtime))
  }
  activityKeys.set(projectPath, keySet)

  // Mtime scan first; watcher starts after so ignoreInitial is always safe
  await scanProjectMtimes(projectPath)
  startProjectWatcher(projectPath)
}

async function initAllProjectActivity(vaultPath: string): Promise<void> {
  if (!fs.existsSync(vaultPath)) return

  async function findProjects(dir: string): Promise<string[]> {
    const results: string[] = []
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return results
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === '_Archive') continue
      const sub = path.join(dir, entry.name)
      if (fs.existsSync(path.join(sub, 'project.md'))) {
        results.push(sub)
      } else {
        results.push(...(await findProjects(sub)))
      }
    }
    return results
  }

  const projects = await findProjects(vaultPath)
  await Promise.all(projects.map(initProjectActivity))
  console.log(`[activity] initialised ${projects.length} project(s)`)
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('dialog:select-directory', async (): Promise<IpcResult<string>> => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    message: 'Select your projects vault folder'
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

ipcMain.handle('config:get-theme', (): IpcResult<string> => {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) return { success: true, data: 'light' }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig
    return { success: true, data: config.theme ?? 'light' }
  } catch {
    return { success: true, data: 'light' }
  }
})

ipcMain.handle('config:set-theme', (_e, theme: string): IpcResult<void> => {
  try {
    const configPath = getConfigPath()
    let config: Partial<AppConfig> = {}
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppConfig
    } catch { /* no existing config yet */ }
    config.theme = theme as 'light' | 'dark'
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
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

ipcMain.handle('fs:get-projects', (_e, rootPath: string): IpcResult<Project[]> => {
  if (!fs.existsSync(rootPath)) return { success: false, error: 'Root path does not exist' }
  try {
    const projects: Project[] = []

    function scanProjectsDir(dir: string) {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue
        const projectMdPath = path.join(dir, entry.name, 'project.md')
        if (!fs.existsSync(projectMdPath)) continue
        const data = parseMd<Record<string, unknown>>(projectMdPath)
        if (!data) continue
        projects.push({
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

    scanProjectsDir(rootPath)

    return { success: true, data: projects }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:create-project', (_e, params: CreateProjectParams): IpcResult<Project> => {
  const { rootPath, name, description, color } = params
  const projectPath = path.join(rootPath, name)
  if (fs.existsSync(projectPath)) return { success: false, error: 'A project with that name already exists' }

  try {
    fs.mkdirSync(projectPath, { recursive: true })
    for (const section of ['Resources', 'Weekly', 'Assignments']) {
      fs.mkdirSync(path.join(projectPath, section), { recursive: true })
    }

    const id = uuidv4()
    writeMd(path.join(projectPath, 'project.md'), {
      id,
      name,
      description,
      color,
      created: new Date().toISOString(),
      sections: ['Resources', 'Weekly', 'Assignments']
    })

    // Start activity tracking for the new project (fire-and-forget)
    initProjectActivity(projectPath).catch((e) =>
      console.error('[activity] failed to init new project:', e)
    )

    return {
      success: true,
      data: {
        id,
        name,
        description,
        color,
        created: new Date().toISOString(),
        sections: ['Resources', 'Weekly', 'Assignments'],
        path: projectPath
      }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:delete-project', (_e, projectPath: string): IpcResult<void> => {
  if (!fs.existsSync(projectPath)) return { success: false, error: 'Project path not found' }
  try {
    fs.rmSync(projectPath, { recursive: true, force: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle(
  'fs:get-assignments',
  (_e, projectId: string, projectPath: string, projectName: string, projectColor: string): IpcResult<Assignment[]> => {
    try {
      const assignments = getAssignmentsForProject(projectPath, projectId, projectName, projectColor)
      return { success: true, data: assignments }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
)

ipcMain.handle('fs:create-assignment', (_e, params: CreateAssignmentParams): IpcResult<Assignment> => {
  const { projectPath, projectId, name, description, due_date, points, instructions } = params
  const assignmentsDir = path.join(projectPath, 'Assignments')
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
        projectId,
        projectName: '',
        projectColor: '',
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

ipcMain.handle('fs:update-assignment', (_e, params: { assignmentPath: string; name: string; due_date: string }): IpcResult<void> => {
  const { assignmentPath, name, due_date } = params
  const mdPath = path.join(assignmentPath, 'assignment.md')
  if (!fs.existsSync(mdPath)) return { success: false, error: 'assignment.md not found' }
  try {
    const parsed = parseMdWithContent(mdPath)
    if (!parsed) return { success: false, error: 'Failed to parse assignment.md' }
    const { data, content } = parsed
    writeMd(mdPath, { ...data, name, due_date }, content)
    return { success: true }
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
  (_e, rootPath: string): IpcResult<CalendarEvent[]> => {
    if (!fs.existsSync(rootPath)) return { success: false, error: 'Root path does not exist' }
    try {
      const now = new Date()
      const entries = fs.readdirSync(rootPath, { withFileTypes: true })
      const events: CalendarEvent[] = []

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue
        const projectPath = path.join(rootPath, entry.name)
        const projectMdPath = path.join(projectPath, 'project.md')
        if (!fs.existsSync(projectMdPath)) continue

        const projectData = parseMd<Record<string, unknown>>(projectMdPath)
        if (!projectData) continue
        const projectId = String(projectData.id ?? '')
        const projectName = String(projectData.name ?? entry.name)
        const projectColor = String(projectData.color ?? '#6366f1')

        const todayStr = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0')
        const assignments = getAssignmentsForProject(projectPath, projectId, projectName, projectColor)
        for (const assignment of assignments) {
          if (!assignment.due_date) continue
          const completed = assignment.submissions.length > 0
          const dueLocal = new Date(assignment.due_date)
          const dueDateStr = dueLocal.getFullYear() + '-' +
            String(dueLocal.getMonth() + 1).padStart(2, '0') + '-' +
            String(dueLocal.getDate()).padStart(2, '0')
          const isLate = !completed && dueDateStr < todayStr
          events.push({
            id: assignment.id,
            title: assignment.name,
            due_date: assignment.due_date,
            projectId,
            projectName,
            projectColor,
            assignmentId: assignment.id,
            type: 'assignment',
            completed,
            isLate
          })
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

ipcMain.handle('shell:open-external', (_e, url: string): void => {
  shell.openExternal(url)
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

ipcMain.handle('fs:get-activity', (_e, projectPath: string): IpcResult<Session[]> => {
  try {
    return { success: true, data: getProjectSessions(projectPath) }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:get-project-meta', (_e, projectPath: string): IpcResult<{ createdAt: string }> => {
  try {
    const stat = fs.statSync(projectPath)
    return { success: true, data: { createdAt: stat.birthtime.toISOString() } }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:get-project-notes', (_e, projectPath: string): IpcResult<{ description: string; outcome: string }> => {
  try {
    const mdPath = path.join(projectPath, 'project.md')
    const parsed = parseMdWithContent(mdPath)
    if (!parsed) return { success: true, data: { description: '', outcome: '' } }
    const body = parsed.content.trim()
    const descMatch = body.match(/##\s+Description\s*\n([\s\S]*?)(?=\n##\s+|\s*$)/)
    const outcomeMatch = body.match(/##\s+Outcome\s*\n([\s\S]*?)(?=\n##\s+|\s*$)/)
    return {
      success: true,
      data: {
        description: descMatch ? descMatch[1].trim() : '',
        outcome: outcomeMatch ? outcomeMatch[1].trim() : '',
      }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:set-project-notes', (_e, projectPath: string, description: string, outcome: string): IpcResult<void> => {
  try {
    const mdPath = path.join(projectPath, 'project.md')
    const parsed = parseMdWithContent(mdPath)
    if (!parsed) return { success: false, error: 'project.md not found' }
    const body = `## Description\n${description}\n\n## Outcome\n${outcome}`
    writeMd(mdPath, parsed.data, body)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

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

// ── Project links ─────────────────────────────────────────────────────────────

function linksPath(projectPath: string): string {
  return path.join(projectPath, 'links.json')
}

function readLinks(projectPath: string): ProjectLink[] {
  const p = linksPath(projectPath)
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return [] }
}

function writeLinks(projectPath: string, links: ProjectLink[]): void {
  fs.writeFileSync(linksPath(projectPath), JSON.stringify(links, null, 2), 'utf-8')
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: 5000 }, (res) => {
      // Follow one redirect
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject)
        return
      }
      let body = ''
      res.setEncoding('utf-8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => resolve(body))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function extractMeta(html: string): { title: string; description: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const descMatch  = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
                  ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
  return {
    title:       titleMatch ? titleMatch[1].trim() : '',
    description: descMatch  ? descMatch[1].trim()  : '',
  }
}

ipcMain.handle('fs:get-links', (_e, projectPath: string): IpcResult<ProjectLink[]> => {
  try {
    return { success: true, data: readLinks(projectPath) }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:save-link', async (_e, { projectPath, url }: { projectPath: string; url: string }): Promise<IpcResult<ProjectLink>> => {
  try {
    let title = url
    let description = ''
    let favicon = ''

    try {
      const parsed = new URL(url)
      favicon = `${parsed.protocol}//${parsed.hostname}/favicon.ico`
      const html = await fetchUrl(url)
      const meta = extractMeta(html)
      if (meta.title) title = meta.title
      description = meta.description
    } catch {
      // metadata fetch failed — use url as title, leave others empty
    }

    const newLink: ProjectLink = {
      id: uuidv4(),
      url,
      title,
      description,
      favicon,
      createdAt: new Date().toISOString(),
    }

    const links = readLinks(projectPath)
    links.push(newLink)
    writeLinks(projectPath, links)
    return { success: true, data: newLink }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:delete-link', (_e, { projectPath, linkId }: { projectPath: string; linkId: string }): IpcResult<void> => {
  try {
    const links = readLinks(projectPath).filter((l) => l.id !== linkId)
    writeLinks(projectPath, links)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('fs:rename-link', (_e, { projectPath, linkId, title }: { projectPath: string; linkId: string; title: string }): IpcResult<void> => {
  try {
    const links = readLinks(projectPath).map((l) => l.id === linkId ? { ...l, title } : l)
    writeLinks(projectPath, links)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})
