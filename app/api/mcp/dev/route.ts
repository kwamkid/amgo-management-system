// Dev tracker MCP server — Streamable HTTP, stateless JSON responses (owner, 3 Nov 2569).
// Claude in every project connects once at user scope:
//   claude mcp add --scope user --transport http amgo-dev https://app.amgovenger.com/api/mcp/dev --header "Authorization: Bearer amgo_bot_…"
// Auth = the bot API key check (scope dev or superadmin → acts as the owner); tools live in lib/mcp/devTools.ts
// and reuse lib/services/bot/botDev.ts, so permissions equal /api/bot/dev. Every tools/call is logged to the server log.
import { NextRequest, NextResponse } from 'next/server'
import { authBotApi, type BotCaller } from '@/lib/services/bot/botApi'
import { DEV_TOOL_BY_NAME, DEV_TOOLS, DevToolError } from '@/lib/mcp/devTools'

export const maxDuration = 60

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'amgo-dev', title: 'amgo dev tracker (UAT)', version: '1.0.0' }
const INSTRUCTIONS =
  'UAT test cases of the owner\'s apps, one project per repo folder (slug). Testers record results with pictures on the amgo board; ' +
  'you write cases (uat_add) in plain Thai for a tester who never saw the feature, read results (uat_summary, uat_case), ' +
  'send fixed cases back (uat_retest) and close finished ones (uat_close). Call uat_list before adding to avoid duplicates. ' +
  'Case numbers (UAT-0001 …) are global across projects. A step can carry a reference picture of where to press: ' +
  'upload it with uat_upload_image, then put the returned path in steps[].image; uat_case returns steps[].image_url.'

interface RpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

const rpcResult = (id: RpcRequest['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result })
const rpcError = (id: RpcRequest['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

export async function POST(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) {
    const status = a.error.status
    const body = (await a.error.json().catch(() => ({}))) as { error?: string }
    return NextResponse.json(rpcError(null, -32001, body.error ?? 'Unauthorized'), {
      status,
      headers: status === 401 ? { 'WWW-Authenticate': 'Bearer realm="amgo-dev"' } : undefined,
    })
  }
  if (a.caller.scope === 'general') return NextResponse.json(rpcError(null, -32001, 'กุญแจนี้ใช้กับ dev tracker ไม่ได้'), { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'Parse error'), { status: 400 })
  }

  const batch = Array.isArray(body)
  const messages = (batch ? body : [body]) as RpcRequest[]
  const replies: unknown[] = []
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object' || typeof msg.method !== 'string') {
      if (msg && 'id' in msg) replies.push(rpcError(msg.id, -32600, 'Invalid request'))
      continue
    }
    const isNotification = msg.id === undefined || msg.id === null
    const reply = await handle(msg, a.caller)
    if (!isNotification && reply) replies.push(reply)
  }
  if (replies.length === 0) return new NextResponse(null, { status: 202 })
  return NextResponse.json(batch ? replies : replies[0], { headers: { 'Cache-Control': 'no-store' } })
}

async function handle(msg: RpcRequest, caller: BotCaller): Promise<unknown> {
  const params = msg.params ?? {}
  switch (msg.method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      return rpcResult(msg.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return rpcResult(msg.id, {})
    case 'tools/list':
      return rpcResult(msg.id, {
        tools: DEV_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: t.readOnly, destructiveHint: false, idempotentHint: t.readOnly },
        })),
      })
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : ''
      const tool = DEV_TOOL_BY_NAME.get(name)
      if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${name}`)
      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>
      const startedAt = Date.now()
      try {
        const result = await tool.run(caller, args)
        console.log(`[mcp-dev] ${name} ok ${Date.now() - startedAt}ms key=${caller.keyId.slice(0, 8)} args=${JSON.stringify(args).slice(0, 200)}`)
        return rpcResult(msg.id, { content: [{ type: 'text', text: JSON.stringify(result) }] })
      } catch (err) {
        const message = err instanceof DevToolError ? err.message : 'Internal error'
        if (!(err instanceof DevToolError)) console.error('[mcp-dev] tool failed', name, err)
        else console.log(`[mcp-dev] ${name} error ${message}`)
        return rpcResult(msg.id, { content: [{ type: 'text', text: message }], isError: true })
      }
    }
    default:
      if ((msg.method ?? '').startsWith('notifications/')) return null
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`)
  }
}

// No server-initiated stream / sessions in this stateless server.
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
