'use client'

// Dev tracker — grid of project cards that open a project's board (Bug report · Releases pick a project here)

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button, Card, Pill } from '@/components/aoo'
import { ROLE_LABELS, type DevProject } from '@/lib/dev/uat'

export default function DevProjectGrid({
  projects,
  href,
  badges,
}: {
  projects: DevProject[]
  href: (p: DevProject) => string
  /** pills before the role pill, e.g. open bug count */
  badges?: (p: DevProject) => ReactNode
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {projects.map((p) => (
        <Card key={p.id} padding={16}>
          <Link href={href(p)} style={{ display: 'block' }}>
            <div style={{ fontSize: 'var(--fs-h4)', fontWeight: 700 }}>{p.name}</div>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--fg-3)' }}>{p.slug}</div>
          </Link>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {badges?.(p)}
            <Pill>{ROLE_LABELS[p.myRole]}</Pill>
          </div>
          <Link href={href(p)} style={{ display: 'block', marginTop: 12 }}>
            <Button variant="secondary" style={{ width: '100%' }}>เปิด</Button>
          </Link>
        </Card>
      ))}
    </div>
  )
}
