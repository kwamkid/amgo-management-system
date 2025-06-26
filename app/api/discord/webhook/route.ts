// app/api/discord/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { DiscordWebhook } from '@/lib/discord/webhook'
import { WebhookChannel, NotificationEvent } from '@/types/discord'
import * as webhookHandlers from '@/lib/discord/webhook'

export async function POST(request: NextRequest) {
  try {
    const { event, channel }: {
      event: NotificationEvent
      channel: WebhookChannel
    } = await request.json()
    
    // Route to appropriate handler
    switch (event.type) {
      case 'check_in':
        await webhookHandlers.sendCheckInNotification(event)
        break
        
      case 'check_out':
        await webhookHandlers.sendCheckOutNotification(event)
        break
        
      case 'overtime':
        await webhookHandlers.sendOvertimeAlert(event)
        break
        
      default:
        const webhook = new DiscordWebhook(channel)
        await webhook.send({
          content: `New event: ${event.type}`,
          embeds: [{
            title: event.type,
            description: JSON.stringify(event.data),
            timestamp: new Date().toISOString()
          }]
        })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to send webhook' },
      { status: 500 }
    )
  }
}