// lib/discord/embeds.ts

import { DiscordEmbed, EmbedColors } from '@/types/discord'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

// Helper to create consistent embeds
export class EmbedBuilder {
  private embed: DiscordEmbed = {}

  setTitle(title: string): this {
    this.embed.title = title
    return this
  }

  setDescription(description: string): this {
    this.embed.description = description
    return this
  }

  setColor(color: number): this {
    this.embed.color = color
    return this
  }

  setAuthor(name: string, iconUrl?: string, url?: string): this {
    this.embed.author = { name, icon_url: iconUrl, url }
    return this
  }

  addField(name: string, value: string, inline = false): this {
    if (!this.embed.fields) this.embed.fields = []
    this.embed.fields.push({ name, value, inline })
    return this
  }

  setFooter(text: string, iconUrl?: string): this {
    this.embed.footer = { text, icon_url: iconUrl }
    return this
  }

  setTimestamp(date: Date = new Date()): this {
    this.embed.timestamp = date.toISOString()
    return this
  }

  setThumbnail(url: string): this {
    this.embed.thumbnail = { url }
    return this
  }

  build(): DiscordEmbed {
    return this.embed
  }
}

// Pre-built embed templates
export const embedTemplates = {
  checkIn: (userName: string, locationName: string, time: Date) => 
    new EmbedBuilder()
      .setAuthor(`✅ ${userName}`)
      .setDescription(`เช็คอินเรียบร้อย`)
      .setColor(EmbedColors.SUCCESS)
      .addField('📍 สถานที่', locationName, true)
      .addField('🕐 เวลา', format(time, 'HH:mm', { locale: th }), true)
      .setFooter('AMGO Check-in System')
      .setTimestamp()
      .build(),

  checkOut: (userName: string, hours: number, overtime: number = 0) =>
    new EmbedBuilder()
      .setAuthor(`🔴 ${userName}`)
      .setDescription(`เช็คเอาท์เรียบร้อย`)
      .setColor(EmbedColors.INFO)
      .addField('⏱️ ชั่วโมงทำงาน', `${hours} ชม.`, true)
      .addField('💰 โอที', overtime > 0 ? `${overtime} ชม.` : 'ไม่มี', true)
      .setFooter('AMGO Check-in System')
      .setTimestamp()
      .build(),

  leaveRequest: (userName: string, leaveType: string, startDate: string, endDate: string, reason: string) =>
    new EmbedBuilder()
      .setTitle('📋 คำขอลาใหม่')
      .setAuthor(userName)
      .setColor(EmbedColors.INFO)
      .addField('ประเภท', leaveType, true)
      .addField('วันที่', `${startDate} - ${endDate}`, true)
      .addField('เหตุผล', reason)
      .addField('สถานะ', '⏳ รออนุมัติ', true)
      .setFooter('กรุณาอนุมัติผ่าน /approve หรือในระบบ')
      .setTimestamp()
      .build(),

  overtimeWarning: (userName: string, hours: number, location: string) =>
    new EmbedBuilder()
      .setTitle('⚠️ แจ้งเตือนทำงานนาน')
      .setDescription(`**${userName}** ทำงานมา ${hours} ชั่วโมงแล้ว`)
      .setColor(EmbedColors.WARNING)
      .addField('📍 สถานที่', location, true)
      .addField('💡 คำแนะนำ', 'ควรให้พักผ่อนบ้าง')
      .setTimestamp()
      .build(),

  error: (title: string, error: string) =>
    new EmbedBuilder()
      .setTitle(`❌ ${title}`)
      .setDescription(error)
      .setColor(EmbedColors.DANGER)
      .setTimestamp()
      .build()
}