// Dev tracker MCP tools — Claude in any project reads/adds/updates UAT cases live (owner, 3 Nov 2569:
// "no more running scripts/dev.mjs"). Same behaviour and permissions as /api/bot/dev (lib/services/bot/botDev.ts).
// Adding a tool = 1 entry in DEV_TOOLS.
//
// ⚠️ server only — service role via the bot caller

import { untyped, type BotCaller } from '@/lib/services/bot/botApi'
import {
  CASE_COLS,
  RESULT_COLS,
  devCaseByNo,
  devProject,
  attachStepImages,
  checkStepImages,
  insertCases,
  parseCaseInput,
  signShots,
  signStepImages,
  toBotCase,
  uploadStepImage,
  attachBugShots,
  BUG_COLS,
  bugDetail,
  devBugByNo,
  insertBugs,
  parseBugInput,
  setBugStatusAs,
  toBotBug,
  uatCaseId,
  caseBugs,
  listReleases,
  parseReleaseInput,
  releaseRef,
  setReleaseItems,
  RELEASE_STATUS_VALUES,
  type BugRow,
  type CaseRow,
  type ResultRow,
} from '@/lib/services/bot/botDev'
import { BUG_SEVERITIES, BUG_STATUSES, bugCode, parseBugNo, type BugStatus } from '@/lib/dev/bugs'
import { STEP_IMAGE_MAX_BYTES, STEP_IMAGE_TYPES, uatCode, type UatStatus, type UatStep } from '@/lib/dev/uat'

type Json = Record<string, unknown>

export interface DevTool {
  name: string
  description: string
  inputSchema: Json
  readOnly: boolean
  run(caller: BotCaller, args: Json): Promise<unknown>
}

export class DevToolError extends Error {}

const STATUSES: UatStatus[] = ['pending', 'retest', 'passed', 'failed', 'blocked', 'closed']
const MAX_ADD = 50

const PROJECT_DOC = 'project = repo folder name (slug), e.g. "aoocommerce", "amgo-management-system"'
const CASE_SCHEMA: Json = {
  type: 'object',
  required: ['title', 'steps'],
  properties: {
    title: { type: 'string', description: 'What is tested, plain Thai for a tester who never saw the feature' },
    steps: {
      type: 'array',
      minItems: 1,
      items: { type: 'object', required: ['action'], properties: { image: { type: 'string', description: 'Reference picture of where to press: the path returned by uat_upload_image (optional)' }, action: { type: 'string' }, expected: { type: 'string', description: 'What the tester should see' } } },
    },
    module: { type: 'string' },
    priority: { type: 'integer', enum: [1, 2, 3], description: '1 urgent · 2 normal (default) · 3 low' },
    environment: { type: 'string', enum: ['production', 'staging'] },
    shop: { type: 'string' },
    login_as: { type: 'string' },
    menu_path: { type: 'string' },
    page_url: { type: 'string', description: '/path on the project site or a full https URL' },
    device: { type: 'string', enum: ['any', 'mobile', 'desktop'] },
    preparation: { type: 'string', description: 'What must exist before starting' },
    source: { type: 'string', description: 'commit hash / chat that produced the case' },
  },
}

/** unwrap the {error: Response} shape of botDev helpers into a tool error */
type Ok<T> = Exclude<T, { error: unknown }>
async function unwrap<T>(p: Promise<T>): Promise<Ok<T>> {
  const r = await p
  if (r && typeof r === 'object' && 'error' in r && (r as { error: unknown }).error instanceof Response) {
    const body = (await (r as { error: Response }).error.json().catch(() => ({}))) as { error?: string }
    throw new DevToolError(body.error ?? `HTTP ${(r as { error: Response }).error.status}`)
  }
  return r as Ok<T>
}

const str = (args: Json, key: string): string | null => (typeof args[key] === 'string' && (args[key] as string).trim() ? (args[key] as string).trim() : null)
const caseNo = (args: Json): number => {
  const v = args.no
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/^uat-?/i, ''))
  if (!Number.isInteger(n) || n < 1) throw new DevToolError('no must be a case number (89 or "UAT-0089")')
  return n
}

async function listCases(caller: BotCaller, args: Json, withResults: boolean) {
  const p = await unwrap(devProject(caller, str(args, 'project')))
  const statusArg = (str(args, 'status') ?? 'open').toLowerCase()
  const statuses = statusArg === 'all' ? STATUSES : statusArg === 'open' ? STATUSES.filter((s) => s !== 'closed') : (statusArg.split(',').map((s) => s.trim()) as UatStatus[])
  if (statuses.some((s) => !STATUSES.includes(s))) throw new DevToolError(`status must be open, all or ${STATUSES.join(',')}`)
  const limit = Math.min(Math.max(Number(args.limit) || 200, 1), 500)
  const { data, error } = await untyped(caller.sb)
    .from('dev_uat_cases')
    .select(withResults ? `${CASE_COLS}, dev_uat_results(${RESULT_COLS})` : 'no, title, status, priority, round, module')
    .eq('project_id', p.project.id)
    .in('status', statuses)
    .order('priority')
    .order('no')
    .limit(limit)
  if (error) throw new DevToolError(error.message)
  return { project: p.project, rows: (data ?? []) as unknown as (CaseRow & { dev_uat_results?: ResultRow[] })[] }
}

export const DEV_TOOLS: DevTool[] = [
  {
    name: 'uat_projects',
    description: 'List dev-tracker projects the key may manage, with the number of open UAT cases. Call first if unsure of a project slug.',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    async run(caller) {
      const sb = untyped(caller.sb)
      let q = sb.from('dev_projects').select('slug, name, production_url, staging_url, is_active, dev_uat_cases(count)').neq('dev_uat_cases.status', 'closed').order('slug')
      if (!caller.isAdmin) {
        const { data: m } = await sb.from('dev_project_members').select('project_id').eq('user_id', caller.user.id).eq('role', 'manager')
        q = q.in('id', (m ?? []).map((x: { project_id: string }) => x.project_id))
      }
      const { data, error } = await q
      if (error) throw new DevToolError(error.message)
      return ((data ?? []) as unknown as Json[]).map((p) => ({
        slug: p.slug, name: p.name, production_url: p.production_url, staging_url: p.staging_url, is_active: p.is_active,
        open_cases: (p.dev_uat_cases as { count: number }[])?.[0]?.count ?? 0,
      }))
    },
  },
  {
    name: 'uat_summary',
    description: `Open UAT cases of a project with each case's latest result (what passed, failed, is blocked, waits for a retest). ${PROJECT_DOC}.`,
    inputSchema: {
      type: 'object',
      required: ['project'],
      properties: {
        project: { type: 'string' },
        status: { type: 'string', description: 'open (default) · all · comma list of pending,retest,passed,failed,blocked,closed' },
        limit: { type: 'integer', description: 'max cases, default 200' },
      },
    },
    readOnly: true,
    async run(caller, args) {
      const { project, rows } = await listCases(caller, args, true)
      return {
        project: project.slug,
        cases: rows.map(({ dev_uat_results, ...c }) => {
          const results = [...(dev_uat_results ?? [])].sort((x, y) => y.created_at.localeCompare(x.created_at))
          const latest = results[0]
          return { ...toBotCase(c), result_count: results.length, latest: latest ? { ...latest, shots: latest.shots.length } : null }
        }),
      }
    },
  },
  {
    name: 'uat_list',
    description: `Short list of a project's UAT cases (number, code, title, status, priority, round, module) — use to avoid adding duplicates. ${PROJECT_DOC}.`,
    inputSchema: {
      type: 'object',
      required: ['project'],
      properties: { project: { type: 'string' }, status: { type: 'string', description: 'open (default) · all · comma list' }, limit: { type: 'integer' } },
    },
    readOnly: true,
    async run(caller, args) {
      const { project, rows } = await listCases(caller, args, false)
      return { project: project.slug, cases: rows.map((c) => ({ ...c, code: uatCode(c.no) })) }
    },
  },
  {
    name: 'uat_case',
    description: 'One UAT case in full (steps, where to test, fix note) with its result history: tester, round, failed step, note and signed picture URLs (valid 1 hour — fetch them to look at screenshots), plus the bugs reported from it.',
    inputSchema: { type: 'object', required: ['no'], properties: { no: { type: ['integer', 'string'], description: 'case number, 89 or "UAT-0089"' } } },
    readOnly: true,
    async run(caller, args) {
      const r = await unwrap(devCaseByNo(caller, caseNo(args)))
      const { data } = await untyped(caller.sb).from('dev_uat_results').select(RESULT_COLS).eq('case_id', r.c.id).order('created_at', { ascending: false })
      const results = await Promise.all(((data ?? []) as ResultRow[]).map(async (x) => ({ ...x, shots: await signShots(caller, Array.isArray(x.shots) ? x.shots : []) })))
      return { case: { ...toBotCase(r.c, r.project), steps: await signStepImages(caller, r.c.steps) }, results, bugs: await caseBugs(caller, r.c.id) }
    },
  },
  {
    name: 'uat_upload_image',
    description: `Store one reference picture for a step (where to press, e.g. a small screenshot with the target boxed) and get its path. Put the path in steps[].image of uat_add or uat_update; saving the case moves it under the case. PNG, JPEG or WebP, base64, max ${STEP_IMAGE_MAX_BYTES / 1_000_000} MB: crop to the area that matters. ${PROJECT_DOC}`,
    inputSchema: {
      type: 'object',
      required: ['project', 'data_base64', 'content_type'],
      properties: {
        project: { type: 'string' },
        data_base64: { type: 'string', description: 'file bytes as base64 (a data: URL prefix is accepted)' },
        content_type: { type: 'string', enum: Object.keys(STEP_IMAGE_TYPES) },
      },
    },
    readOnly: false,
    async run(caller, args) {
      const p = await unwrap(devProject(caller, str(args, 'project')))
      const r = await uploadStepImage(caller, p.project, args.data_base64, args.content_type)
      if ('error' in r) throw new DevToolError(r.error)
      return { path: r.path, preview_url: r.url }
    },
  },
  {
    name: 'uat_add',
    description: `Add UAT cases to a project (max ${MAX_ADD}); returns the new numbers (UAT-0089 …). Every case needs title + steps (each step: action, expected). ${PROJECT_DOC}.`,
    inputSchema: {
      type: 'object',
      required: ['project', 'cases'],
      properties: { project: { type: 'string' }, cases: { type: 'array', minItems: 1, maxItems: MAX_ADD, items: CASE_SCHEMA } },
    },
    readOnly: false,
    async run(caller, args) {
      const p = await unwrap(devProject(caller, str(args, 'project')))
      const list = Array.isArray(args.cases) ? args.cases : []
      if (list.length === 0 || list.length > MAX_ADD) throw new DevToolError(`cases must hold 1–${MAX_ADD} items`)
      const rows: Json[] = []
      for (const raw of list) {
        const parsed = parseCaseInput(raw)
        if ('error' in parsed) throw new DevToolError(parsed.error)
        const bad = await checkStepImages(caller, p.project.id, parsed.row.steps as UatStep[])
        if (bad) throw new DevToolError(bad)
        rows.push({ ...parsed.row, project_id: p.project.id, created_by: caller.user.id, sort_order: Date.now() / 1000 + rows.length })
      }
      const added = await insertCases(caller, rows).catch((e: Error) => {
        throw new DevToolError(e.message)
      })
      return { project: p.project.slug, added: added.map((c) => ({ no: c.no, code: uatCode(c.no), title: c.title })) }
    },
  },
  {
    name: 'uat_update',
    description: 'Edit a UAT case: any of title, steps, module, priority, environment, shop, login_as, menu_path, page_url, device, preparation, source. Status/round are not edited here (use uat_retest / uat_close).',
    inputSchema: {
      type: 'object',
      required: ['no'],
      properties: { no: { type: ['integer', 'string'] }, ...(CASE_SCHEMA.properties as Json) },
    },
    readOnly: false,
    async run(caller, args) {
      const r = await unwrap(devCaseByNo(caller, caseNo(args)))
      // fields at top level (schema) — a nested `fields` object is accepted too; anything else is an error, never ignored
      const { no: _no, fields: nested, ...top } = args
      const sent: Json = { ...(nested && typeof nested === 'object' ? (nested as Json) : {}), ...top }
      const unknown = Object.keys(sent).filter((k) => !(k in (CASE_SCHEMA.properties as Json)))
      if (unknown.length) throw new DevToolError(`unknown field(s): ${unknown.join(', ')} — allowed: ${Object.keys(CASE_SCHEMA.properties as Json).join(', ')}`)
      if (Object.keys(sent).length === 0) throw new DevToolError('nothing to update — send at least one field')
      const parsed = parseCaseInput({ title: r.c.title, steps: r.c.steps, ...sent })
      if ('error' in parsed) throw new DevToolError(parsed.error)
      const patch = Object.fromEntries(Object.entries(parsed.row).filter(([k]) => k in sent))
      if (patch.steps) {
        const bad = await checkStepImages(caller, r.project.id, patch.steps as UatStep[], r.c.id)
        if (bad) throw new DevToolError(bad)
        patch.steps = (await attachStepImages(caller, r.c.id, patch.steps as UatStep[]).catch((e: Error) => {
          throw new DevToolError(e.message)
        })).steps
      }
      const { error } = await untyped(caller.sb).from('dev_uat_cases').update(patch).eq('id', r.c.id)
      if (error) throw new DevToolError(error.message)
      return { ok: true, code: uatCode(r.c.no), updated: Object.keys(patch) }
    },
  },
  {
    name: 'uat_retest',
    description: 'Send a case back to the tester for another round after a fix (status retest, round + 1). fix_note = what changed, plain Thai, shown to the tester.',
    inputSchema: { type: 'object', required: ['no', 'fix_note'], properties: { no: { type: ['integer', 'string'] }, fix_note: { type: 'string' } } },
    readOnly: false,
    async run(caller, args) {
      const r = await unwrap(devCaseByNo(caller, caseNo(args)))
      const patch = { status: 'retest', round: r.c.round + 1, fix_note: str(args, 'fix_note') }
      const { error } = await untyped(caller.sb).from('dev_uat_cases').update(patch).eq('id', r.c.id)
      if (error) throw new DevToolError(error.message)
      return { ok: true, code: uatCode(r.c.no), ...patch }
    },
  },
  {
    name: 'uat_close',
    description: 'Close a UAT case (done, or no longer needed). Only after looking at the passed result pictures.',
    inputSchema: { type: 'object', required: ['no'], properties: { no: { type: ['integer', 'string'] } } },
    readOnly: false,
    async run(caller, args) {
      const r = await unwrap(devCaseByNo(caller, caseNo(args)))
      const { error } = await untyped(caller.sb).from('dev_uat_cases').update({ status: 'closed' }).eq('id', r.c.id)
      if (error) throw new DevToolError(error.message)
      return { ok: true, code: uatCode(r.c.no), status: 'closed' }
    },
  },
]

const BUG_SCHEMA: Json = {
  type: 'object',
  required: ['title'],
  properties: {
    title: { type: 'string', description: 'What is wrong, short plain Thai' },
    severity: { type: 'string', enum: BUG_SEVERITIES, description: 'critical = unusable/data or money wrong · high = main feature broken, workaround exists · normal (default) · low = looks/typo' },
    steps: { type: 'string', description: 'How to make it happen (numbered lines)' },
    expected: { type: 'string' },
    actual: { type: 'string' },
    environment: { type: 'string', enum: ['production', 'staging'] },
    device: { type: 'string', enum: ['any', 'mobile', 'desktop'] },
    page_url: { type: 'string', description: '/path on the project site or a full https URL' },
    shots: { type: 'array', maxItems: 8, items: { type: 'string' }, description: 'paths from uat_upload_image' },
    uat_case: { type: ['integer', 'string'], description: 'UAT case this came from, 89 or "UAT-0089" (same project)' },
    source: { type: 'string', description: 'commit hash / chat that found it' },
  },
}
const bugNo = (args: Json): number => {
  const n = parseBugNo(args.no)
  if (!Number.isInteger(n) || n < 1) throw new DevToolError('no must be a bug number of the project (3 or "BUG-0003")')
  return n
}

DEV_TOOLS.push(
  {
    name: 'bug_list',
    description: `Bug reports of a project (numbers restart per project: BUG-0001 …), open ones by default. Call before bug_add to avoid duplicates. ${PROJECT_DOC}.`,
    inputSchema: {
      type: 'object',
      required: ['project'],
      properties: { project: { type: 'string' }, status: { type: 'string', description: `open (default) · all · comma list of ${BUG_STATUSES.join(',')}` }, limit: { type: 'integer' } },
    },
    readOnly: true,
    async run(caller, args) {
      const p = await unwrap(devProject(caller, str(args, 'project')))
      const arg = (str(args, 'status') ?? 'open').toLowerCase()
      const statuses = arg === 'all' ? BUG_STATUSES : arg === 'open' ? BUG_STATUSES.filter((x) => x !== 'closed' && x !== 'wont_fix') : (arg.split(',').map((x) => x.trim()) as BugStatus[])
      if (statuses.some((x) => !BUG_STATUSES.includes(x))) throw new DevToolError(`status must be open, all or ${BUG_STATUSES.join(',')}`)
      const { data, error } = await untyped(caller.sb)
        .from('dev_bugs')
        .select(`${BUG_COLS}, dev_uat_cases(no)`)
        .eq('project_id', p.project.id)
        .in('status', statuses)
        .order('no')
        .limit(Math.min(Math.max(Number(args.limit) || 200, 1), 500))
      if (error) throw new DevToolError(error.message)
      return { project: p.project.slug, bugs: ((data ?? []) as unknown as (BugRow & { dev_uat_cases: { no: number } | null })[]).map((b) => toBotBug(b, p.project, b.dev_uat_cases?.no)) }
    },
  },
  {
    name: 'bug_get',
    description: 'One bug in full with its history (who moved it, notes) and signed picture URLs (valid 1 hour).',
    inputSchema: { type: 'object', required: ['project', 'no'], properties: { project: { type: 'string' }, no: { type: ['integer', 'string'] } } },
    readOnly: true,
    async run(caller, args) {
      return bugDetail(caller, await unwrap(devBugByNo(caller, str(args, 'project'), bugNo(args))))
    },
  },
  {
    name: 'bug_add',
    description: `Report bugs to a project (max 20); returns BUG-0001 … Starts in "new" and pushes nobody (the owner is the caller). Pictures: upload with uat_upload_image, pass the paths in shots. ${PROJECT_DOC}.`,
    inputSchema: { type: 'object', required: ['project', 'bugs'], properties: { project: { type: 'string' }, bugs: { type: 'array', minItems: 1, maxItems: 20, items: BUG_SCHEMA } } },
    readOnly: false,
    async run(caller, args) {
      const p = await unwrap(devProject(caller, str(args, 'project')))
      const list = Array.isArray(args.bugs) ? args.bugs : []
      if (list.length === 0 || list.length > 20) throw new DevToolError('bugs must hold 1–20 items')
      const added = await insertBugs(caller, p.project, list).catch((e: Error) => {
        throw new DevToolError(e.message)
      })
      return { project: p.project.slug, added }
    },
  },
  {
    name: 'bug_update',
    description: 'Edit a bug: any of title, severity, steps, expected, actual, environment, device, page_url, shots (replaces the list), uat_case, source. Status is changed with bug_status.',
    inputSchema: { type: 'object', required: ['project', 'no'], properties: { project: { type: 'string' }, no: { type: ['integer', 'string'] }, ...(BUG_SCHEMA.properties as Json) } },
    readOnly: false,
    async run(caller, args) {
      const r = await unwrap(devBugByNo(caller, str(args, 'project'), bugNo(args)))
      const { project: _p, no: _n, ...fields } = args
      const parsed = parseBugInput(fields, true)
      if ('error' in parsed) throw new DevToolError(parsed.error)
      if (Object.keys(parsed.row).length === 0 && !parsed.uatNo) throw new DevToolError('nothing to update — send at least one field')
      try {
        if (parsed.row.shots) parsed.row.shots = await attachBugShots(caller, r.project.id, parsed.row.shots as string[])
        if (parsed.uatNo) parsed.row.uat_case_id = await uatCaseId(caller, r.project.id, parsed.uatNo)
      } catch (e) {
        throw new DevToolError((e as Error).message)
      }
      const { error } = await untyped(caller.sb).from('dev_bugs').update(parsed.row).eq('id', r.b.id)
      if (error) throw new DevToolError(error.message)
      return { ok: true, code: bugCode(r.b.no), updated: Object.keys(parsed.row) }
    },
  },
  {
    name: 'bug_status',
    description: 'Move a bug: accepted · fixing · testing (note = what was fixed, plain Thai, shown to the tester — the reporter is asked to retest) · closed · wont_fix (note = reason, required) · new.',
    inputSchema: {
      type: 'object',
      required: ['project', 'no', 'status'],
      properties: { project: { type: 'string' }, no: { type: ['integer', 'string'] }, status: { type: 'string', enum: BUG_STATUSES }, note: { type: 'string' } },
    },
    readOnly: false,
    async run(caller, args) {
      const r = await unwrap(devBugByNo(caller, str(args, 'project'), bugNo(args)))
      const bad = await setBugStatusAs(caller, r.b.id, args.status, args.note)
      if (bad) throw new DevToolError(bad)
      return { ok: true, code: bugCode(r.b.no), status: args.status }
    },
  }
)

const RELEASE_FIELDS: Json = {
  name: { type: 'string' },
  goal: { type: 'string', description: 'What this round must finish, plain Thai' },
  start_date: { type: 'string', description: 'YYYY-MM-DD' },
  target_date: { type: 'string', description: 'YYYY-MM-DD' },
  status: { type: 'string', enum: RELEASE_STATUS_VALUES },
}
const nums: Json = { type: 'array', items: { type: ['integer', 'string'] } }

DEV_TOOLS.push(
  {
    name: 'release_list',
    description: `Releases (rounds of work) of a project with progress: cases passed/closed and bugs closed out of what is in the round. items=true lists the cases and bugs too. ${PROJECT_DOC}.`,
    inputSchema: { type: 'object', required: ['project'], properties: { project: { type: 'string' }, items: { type: 'boolean' } } },
    readOnly: true,
    async run(caller, args) {
      const p = await unwrap(devProject(caller, str(args, 'project')))
      return { project: p.project.slug, releases: await listReleases(caller, p.project, args.items === true).catch((e: Error) => { throw new DevToolError(e.message) }) }
    },
  },
  {
    name: 'release_add',
    description: `Create a release (status planned unless given). ${PROJECT_DOC}.`,
    inputSchema: { type: 'object', required: ['project', 'name'], properties: { project: { type: 'string' }, ...RELEASE_FIELDS } },
    readOnly: false,
    async run(caller, args) {
      const p = await unwrap(devProject(caller, str(args, 'project')))
      const { project: _p, ...fields } = args
      const parsed = parseReleaseInput(fields, false)
      if ('error' in parsed) throw new DevToolError(parsed.error)
      const { data, error } = await untyped(caller.sb).from('dev_releases').insert({ ...parsed.row, project_id: p.project.id, created_by: caller.user.id }).select('id, name').single()
      if (error) throw new DevToolError(error.message)
      return data
    },
  },
  {
    name: 'release_update',
    description: 'Edit a release (name, goal, dates, status planned|active|released) and/or move UAT cases and bugs of the same project in or out: add_cases / remove_cases (89 or "UAT-0089"), add_bugs / remove_bugs (3 or "BUG-0003"). release = id or exact name.',
    inputSchema: {
      type: 'object',
      required: ['project', 'release'],
      properties: { project: { type: 'string' }, release: { type: 'string' }, ...RELEASE_FIELDS, add_cases: nums, add_bugs: nums, remove_cases: nums, remove_bugs: nums },
    },
    readOnly: false,
    async run(caller, args) {
      const p = await unwrap(devProject(caller, str(args, 'project')))
      const allowed = ['project', 'release', ...Object.keys(RELEASE_FIELDS), 'add_cases', 'add_bugs', 'remove_cases', 'remove_bugs']
      const unknown = Object.keys(args).filter((k) => !allowed.includes(k))
      if (unknown.length) throw new DevToolError(`unknown field(s): ${unknown.join(', ')}`)
      try {
        const r = await releaseRef(caller, p.project, args.release)
        const fields = Object.fromEntries(Object.entries(args).filter(([k]) => k in RELEASE_FIELDS))
        if (Object.keys(fields).length) {
          const parsed = parseReleaseInput(fields, true)
          if ('error' in parsed) throw new DevToolError(parsed.error)
          const { error } = await untyped(caller.sb).from('dev_releases').update(parsed.row).eq('id', r.id)
          if (error) throw new DevToolError(error.message)
        }
        const added = await setReleaseItems(caller, p.project, r.id, args.add_cases, args.add_bugs)
        const removed = await setReleaseItems(caller, p.project, null, args.remove_cases, args.remove_bugs, r.id)
        return { ok: true, release: r.name, updated: Object.keys(fields), added, removed }
      } catch (e) {
        throw e instanceof DevToolError ? e : new DevToolError((e as Error).message)
      }
    },
  }
)

export const DEV_TOOL_BY_NAME = new Map(DEV_TOOLS.map((t) => [t.name, t]))
