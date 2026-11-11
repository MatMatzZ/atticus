/** Household roles and what each may do in the UI. RLS remains the real enforcement. */
export type MemberRole = 'owner' | 'caregiver' | 'sitter' | 'vet';

/** Vets (and users with no active role) see read-only views with no write controls. */
export function canWrite(role: MemberRole | null | undefined): boolean {
  return role === 'owner' || role === 'caregiver' || role === 'sitter';
}
