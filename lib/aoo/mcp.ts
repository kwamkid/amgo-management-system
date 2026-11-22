// aoocommerce MCP (read-only key AOO_MCP_KEY) — server only, never import from client code.
// Tools: company_overview · sales_summary · stock · list_orders · get_order (see .claude/rules/domains/marketing.md)

const AOO_MCP_URL = process.env.AOO_MCP_URL || 'https://app.aoocommerce.com/api/mcp'

export class AooMcpError extends Error {}

/** call one aoo MCP tool and parse its JSON text result */
export async function aooMcp<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
  const key = process.env.AOO_MCP_KEY
  if (!key) throw new AooMcpError('ยังไม่ได้ตั้งกุญแจ MCP ของ aoo (AOO_MCP_KEY)')
  const res = await fetch(AOO_MCP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
    cache: 'no-store',
  })
  if (!res.ok) throw new AooMcpError(`aoo MCP ${res.status}`)
  const body = (await res.json()) as { result?: { content?: { text?: string }[]; isError?: boolean } }
  const text = body.result?.content?.[0]?.text
  if (!text || body.result?.isError) throw new AooMcpError(text ?? 'aoo MCP ไม่ตอบ')
  return JSON.parse(text) as T
}

export interface AooOverview {
  brands: string[]
  marketplace_shops: { platform: string; shop_name: string; is_active: boolean }[]
  sales_channels: { name: string; channel_type: string; platform: string | null; is_active: boolean }[]
}

export interface AooSalesRow {
  day?: string
  brand?: string
  flow?: string
  source?: string
  channel?: string
  orders: number
  qty: number
  revenue: number
}
