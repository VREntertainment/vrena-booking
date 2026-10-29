export const birthdayPackages = [
  { id: 'mini-mission', name: 'Mini Mission', players: 4, price: 1900000, arenas: 1 },
  { id: 'birthday-squad', name: 'Birthday Squad', players: 8, price: 3600000, arenas: 1 },
  { id: 'epic-birthday', name: 'Epic Birthday', players: 12, price: 4500000, arenas: 2 },
] as const
export type BirthdayPackage = typeof birthdayPackages[number]
export type BirthdayPackageId = BirthdayPackage['id']

export function birthdayPackageById(id: string | null | undefined) {
  return birthdayPackages.find(item => item.id === id) ?? null
}

// This is a package request carried through the existing staff-confirmed birthday flow,
// never a client-authoritative price or a bypass of arena availability validation.
export function birthdayPackageNote(item: BirthdayPackage) {
  return `Birthday package: ${item.name} | ${item.players} players | 120 min | ${item.price.toLocaleString('en-US')} VND (staff confirmation)`
}
export function withoutBirthdayPackageNote(note: string) {
  return note.split('\n').filter(line => !line.startsWith('Birthday package: ')).join('\n').trim()
}
export function selectedBirthdayPackage(type: string, players: number, duration: number, note: string) {
  if (type !== 'birthday' || duration !== 120) return null
  return birthdayPackages.find(item => item.players === players && note.split('\n')[0] === birthdayPackageNote(item)) ?? null
}
export function birthdayPackageSelection(id: string | null | undefined, venue: string) {
  const item = birthdayPackageById(id)
  return item ? { item, players: item.players, duration: 120, arenas: venue === 'cafe-des-stagiaires' ? 1 : item.arenas, note: birthdayPackageNote(item) } : null
}
