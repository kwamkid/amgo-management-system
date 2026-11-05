// Shapes shared by /api/vault and the /vault page. Password and note are not in list shapes: they
// leave the server only through POST /api/vault/[id]/reveal, one account at a time, logged.

export interface VaultSecret {
  username: string
  password: string
  otpPhone: string
  note: string
}

export const EMPTY_SECRET: VaultSecret = { username: '', password: '', otpPhone: '', note: '' }

export interface VaultPerm {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
}

export interface VaultGrant extends VaultPerm {
  userId: string
  name?: string
}

export interface VaultItem {
  id: string
  platform: string
  name: string
  updatedAt: string
  perm: VaultPerm
  /** decrypted for the list; absent when the row cannot be decrypted */
  username?: string
  otpPhone?: string
  /** admin only */
  access?: VaultGrant[]
}

export interface VaultPerson {
  id: string
  name: string
}

export type VaultAction = 'create' | 'reveal' | 'update' | 'delete' | 'access'

export interface VaultLogRow {
  id: number
  action: VaultAction
  who: string
  ip: string | null
  detail: { fields?: string[]; granted?: string[]; removed?: string[] } | null
  createdAt: string
}

/** Edit and delete include view; a grant with nothing ticked is dropped. */
export function normalizeGrant(g: VaultGrant): VaultGrant | null {
  const canEdit = !!g.canEdit
  const canDelete = !!g.canDelete
  const canView = !!g.canView || canEdit || canDelete
  return canView ? { userId: g.userId, canView, canEdit, canDelete } : null
}
