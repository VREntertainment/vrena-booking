import { games } from './bookingStaticData'
import type { RetentionAchievement } from './profileAchievements'

export type StaffAchievementAwardKind = 'game' | 'retention'

export type StaffAchievementAwardCatalogItem = {
  id: string
  kind: StaffAchievementAwardKind
  title: string
  description: string
  group: string
  image?: string
}

const retentionAchievementCatalog: Array<Pick<RetentionAchievement, 'category' | 'description' | 'id' | 'title'>> = [
  { category: 'special', id: 'first-blood', title: 'First Blood', description: 'Complete your first checked-in session.' },
  { category: 'comeback', id: 'weekly-warrior', title: 'Weekly Warrior', description: 'Play one checked-in session this week.' },
  { category: 'comeback', id: 'streak-builder', title: 'Streak Builder', description: 'Play in two consecutive weeks.' },
  { category: 'comeback', id: 'arena-regular', title: 'Arena Regular', description: 'Play in four consecutive weeks.' },
  { category: 'comeback', id: 'back-for-more', title: 'Back for More', description: 'Return after a break of 30 days or more.' },
  { category: 'explore', id: 'perfect-rotation', title: 'Perfect Rotation', description: 'Try every VRena game at least once.' },
  { category: 'explore', id: 'genre-explorer', title: 'Genre Explorer', description: 'Play at least one FPS/PVP game and one Escape game.' },
  { category: 'explore', id: 'specialist', title: 'Specialist', description: 'Play the same game ten times.' },
  { category: 'explore', id: 'completionist', title: 'Completionist', description: 'Unlock Bronze on every game.' },
  { category: 'social', id: 'squad-starter', title: 'Squad Starter', description: 'Create a session with at least three checked-in players.' },
  { category: 'social', id: 'challenge-accepted', title: 'Challenge Accepted', description: 'Complete a challenge session.' },
  { category: 'social', id: 'friendly-rivalry', title: 'Friendly Rivalry', description: 'Play with the same player three times.' },
  { category: 'social', id: 'club-loyalist', title: 'Club Loyalist', description: 'Play three checked-in club sessions.' },
  { category: 'social', id: 'bring-the-crew', title: 'Bring the Crew', description: 'Create a session where three other players check in.' },
  { category: 'performance', id: 'personal-best', title: 'Personal Best', description: 'Beat your previous recorded score.' },
  { category: 'performance', id: 'clutch-player', title: 'Clutch Player', description: 'Finish first or top-score a checked-in session.' },
  { category: 'performance', id: 'accuracy-upgrade', title: 'Accuracy Upgrade', description: 'Improve one recorded accuracy result above your previous average.' },
  { category: 'performance', id: 'escape-breakthrough', title: 'Escape Breakthrough', description: 'Beat your previous recorded Escape completion time.' },
  { category: 'performance', id: 'top-ten-moment', title: 'Top 10% Moment', description: 'Place in the top 10% of a checked-in scored session.' },
  { category: 'special', id: 'birthday-hero', title: 'Birthday Hero', description: 'Play during your birthday month.' },
  { category: 'social', id: 'team-builder', title: 'Team Builder', description: 'Join a checked-in corporate/event session.' },
  { category: 'special', id: 'off-peak-explorer', title: 'Off-Peak Explorer', description: 'Play during quieter weekday hours.' },
  { category: 'comeback', id: 'double-session-day', title: 'Double Session Day', description: 'Complete two checked-in sessions in one day.' },
  { category: 'special', id: 'weekend-raider', title: 'Weekend Raider', description: 'Play on a Saturday or Sunday.' },
  { category: 'special', id: 'night-owl', title: 'Night Owl', description: 'Play an evening session.' },
  { category: 'special', id: 'secret-hunter', title: 'Secret Hunter', description: 'Reveal the hidden profile achievement by trying three different games.' },
  { category: 'special', id: 'mask-mode', title: 'Mask Mode', description: 'Complete a session with anonymous mode enabled.' },
]

const gameAchievementCatalog: StaffAchievementAwardCatalogItem[] = games.map((game) => ({
  id: game.id,
  kind: 'game',
  title: game.title,
  description: `Unlock the ${game.title} game achievement for this player.`,
  group: 'Game achievements',
  image: game.image,
}))

const retentionAwardGroups: Record<RetentionAchievement['category'], string> = {
  comeback: 'Return habits',
  explore: 'Exploration',
  performance: 'Performance',
  social: 'Social play',
  special: 'Special moments',
}

const retentionAwards: StaffAchievementAwardCatalogItem[] = retentionAchievementCatalog.map((achievement) => ({
  id: achievement.id,
  kind: 'retention',
  title: achievement.title,
  description: achievement.description,
  group: retentionAwardGroups[achievement.category],
}))

export const staffAchievementAwardCatalog: StaffAchievementAwardCatalogItem[] = [
  ...retentionAwards,
  ...gameAchievementCatalog,
]

export function staffAchievementAwardById(achievementId: string) {
  return staffAchievementAwardCatalog.find((item) => item.id === achievementId) || null
}
