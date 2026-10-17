/** Approved reception-booklet artwork, exported with its transparent silhouette intact. */
export const gameGuidePosters: Record<string, string> = Object.fromEntries([
  'arcade-2-0', 'arc-of-the-covenant', 'birthday-party', 'castle-unspunnen',
  'city-z', 'joller-house', 'laser-limbo', 'laser-tag', 'mini-block-towers',
  'office-war', 'orc-kings-arena', 'paintball', 'party-games', 'portal-mafia',
  'portal-zombie', 'revolta', 'snow-battle', 'spatial-ops', 'station-zarya',
  'vr-arena-strike', 'wild-west',
].map((id) => [id, `/games/posters/${id}.webp`]))
