import type { LanguageCode } from './i18n/languages'

type LocalText = { en: string; vi: string }
type GuideEntry = { title: string; description: LocalText; minimumAge?: 12 }
type GuideCollection = { summary: LocalText; games?: GuideEntry[]; modes?: GuideEntry[]; maps?: string[] }
const entry = (title: string, en: string, vi: string, minimumAge?: 12): GuideEntry => ({ title, description: { en, vi }, minimumAge })
const deathmatch = entry('Deathmatch', 'Compete individually for the highest elimination score.', 'Thi đấu cá nhân để đạt điểm hạ đối thủ cao nhất.')
const teamDeathmatch = entry('Team Deathmatch', 'Work together to outscore the opposing team.', 'Phối hợp để đội mình ghi nhiều điểm hơn đối thủ.')
const arcadeModes = [deathmatch, teamDeathmatch,
  entry('Gun Game', 'Your weapon changes after each elimination. Keep scoring to win.', 'Vũ khí thay đổi sau mỗi lần hạ đối thủ. Tiếp tục ghi điểm để chiến thắng.'),
  entry('Tournament', 'Team rounds with no respawn until the round ends.', 'Thi đấu theo vòng giữa các đội; chỉ hồi sinh khi vòng đấu kết thúc.')]

/** Publisher-verified content; see docs/game-guide/publisher-sources.md. Names remain searchable in every language. */
export const gameGuideCollections: Record<string, GuideCollection> = {
  'party-games': {
    summary: { en: 'Five playful mini-games for friends, families and birthday groups.', vi: 'Năm trò chơi nhỏ vui nhộn dành cho bạn bè, gia đình và nhóm sinh nhật.' },
    games: [
      entry('Kill the Mole!', 'Use your hammer to hit moles wearing your colour.', 'Dùng búa đập những chú chuột chũi đội mũ cùng màu với bạn.'),
      entry('Catching Animals', 'Catch flying animals with your net; rarer animals earn more points.', 'Dùng vợt bắt các con vật bay; con vật càng hiếm càng được nhiều điểm.'),
      entry('Snowballs', 'Charge your snow cannon, aim at rivals and use ice barriers for cover.', 'Nạp pháo tuyết, ngắm đối thủ và dùng tường băng để che chắn.'),
      entry('Car Wash', 'Spray paint stains off passing cars to score points.', 'Xịt sạch vết sơn trên những chiếc xe chạy qua để ghi điểm.'),
      entry('Space Invaders', 'Defend your spaceship together against alien attackers.', 'Cùng bảo vệ tàu vũ trụ trước những kẻ xâm lăng ngoài hành tinh.'),
    ],
  },
  'birthday-party': {
    summary: { en: 'Three linked mini-games turn caps, candles and presents into one birthday celebration.', vi: 'Ba trò chơi liên tiếp với mũ, nến và quà tạo nên một buổi sinh nhật đáng nhớ.' },
    games: [
      entry('Balloon Blast', 'Team up and collect party hats by tagging opponents in a balloon-filled arena.', 'Lập đội và thu thập mũ tiệc khi bắn trúng đối thủ trong đấu trường đầy bóng bay.'),
      entry('Candle Hunt', 'Find candles in your team colour and place them on the giant cake.', 'Tìm nến cùng màu với đội và đặt lên chiếc bánh khổng lồ.'),
      entry('Piñatas', 'The birthday player bursts piñatas while teammates collect matching presents.', 'Nhân vật sinh nhật bắn vỡ piñata, đồng đội thu thập những món quà cùng màu.'),
    ],
  },
  'arcade-2-0': {
    summary: { en: 'Colourful arena battles across six imaginative maps, with four ways to compete.', vi: 'Đấu trường rực rỡ với sáu bản đồ sáng tạo và bốn chế độ thi đấu.' },
    maps: ['CyberPunk', 'Egypt', 'Fridge', 'House', 'Medieval', 'Pirates'], modes: arcadeModes,
  },
  'portal-mafia': {
    summary: { en: 'Police and mafia face off in a 1950s-inspired tactical arena.', vi: 'Cảnh sát và mafia đối đầu trong đấu trường chiến thuật lấy cảm hứng từ thập niên 1950.' },
    maps: ['Street (City)', 'Casino'], modes: [deathmatch, teamDeathmatch],
  },
  'portal-zombie': {
    summary: { en: 'Survive together in a three-storey haunted mansion. Restart generators, send an SOS and face the boss.', vi: 'Cùng sinh tồn trong dinh thự ma ám ba tầng. Khởi động máy phát điện, gửi SOS và đối mặt với trùm.' },
    maps: ['Mansion'], modes: [entry('Survival', 'Hold off zombie waves, upgrade your weapons and help your teammates reach rescue.', 'Chống các đợt zombie, nâng cấp vũ khí và giúp đồng đội chờ cứu viện.')],
  },
  'vr-arena-strike': {
    summary: { en: 'Tactical arena shooting with individual, team and round-based matches.', vi: 'Bắn súng chiến thuật với các trận cá nhân, đồng đội và theo vòng.' },
    maps: ['Hangar (Angar)', 'Battlefield', 'City', 'Metro', 'Construction', 'Office', 'Jungle'],
    modes: arcadeModes,
  },
  'laser-limbo': {
    summary: { en: 'Bring an augmented-reality arena to your event, with nine competitive, cooperative and weapon-free modes.', vi: 'Mang đấu trường thực tế tăng cường đến sự kiện với chín chế độ đối kháng, hợp tác và không dùng vũ khí.' },
    modes: [teamDeathmatch,
      entry('Team Elimination', 'One life per round. The surviving team wins.', 'Mỗi người có một mạng mỗi vòng. Đội còn sống giành chiến thắng.'),
      entry('Domination', 'Capture and defend control points to build your team score.', 'Chiếm và bảo vệ điểm kiểm soát để ghi điểm cho đội.'),
      entry('Drone Hunt', 'Compete in teams to destroy drones and score points.', 'Thi đấu theo đội, tiêu diệt drone để ghi điểm.'),
      entry('Drone Waves', 'Work together to survive ten increasingly challenging drone waves.', 'Phối hợp vượt qua mười đợt drone với độ khó tăng dần.'),
      entry('Saber Fight', 'Face cooperative drone waves using laser sabers.', 'Cùng chống các đợt drone bằng kiếm laser.'),
      entry('Coin Clash', 'Collect coins and bring them back to your team vault.', 'Thu thập xu và mang về kho của đội.'),
      entry('Puzzle Battle', 'Bring puzzle pieces to your base and assemble them for points.', 'Mang mảnh ghép về căn cứ và hoàn thành câu đố để ghi điểm.', 12),
      entry("Pop’N’Stop", 'Pop bubbles for your team, then freeze when the sound plays.', 'Thử thách không dùng vũ khí với các bẫy laser cần vượt qua.'),
    ],
  },
  'spatial-ops': {
    summary: { en: 'Turn your event space into a mixed-reality battlefield with five arena modes.', vi: 'Biến không gian sự kiện thành chiến trường thực tế hỗn hợp với năm chế độ đấu trường.' },
    modes: [
      entry('Co-op Survival', 'Join forces against computer-controlled enemies.', 'Hợp sức chống lại đối thủ do máy điều khiển.'),
      entry('Free For All', 'Every player competes individually.', 'Mỗi người thi đấu độc lập.'), teamDeathmatch,
      entry('Capture the Flag', 'Take the opposing flag and bring it back to your base.', 'Lấy cờ đối phương và mang về căn cứ.'),
      entry('Domination', 'Hold control points to earn points over time.', 'Giữ điểm kiểm soát để liên tục ghi điểm.'),
    ],
  },
}

export function collectionText(value: LocalText, language: LanguageCode) {
  return language === 'vi' ? value.vi : value.en
}
export function guideSearchText(id: string, playerAge = 'all') {
  const collection = gameGuideCollections[id]
  return collection ? [...(collection.games || []), ...(collection.modes || [])].filter((item) => playerAge === 'all' || (item.minimumAge || 7) <= Number(playerAge)).map((item) => item.title).concat(collection.maps || []).join(' ') : ''
}
