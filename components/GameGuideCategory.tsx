import Image from 'next/image'
import styles from './GameGuideCategory.module.css'

const anvioGames = new Set(['revolta', 'city-z', 'station-zarya'])

export default function GameGuideCategory({ gameId, category }: { gameId: string; category: string }) {
  if (!anvioGames.has(gameId)) return <span>{category}</span>

  return (
    <div className={styles.category}>
      <span>{category}</span>
      <div className={styles.badge} role="img" aria-label="Powered by ANVIO" lang="en">
        <small>Powered by</small>
        <Image src="/brand/anvio-logo-vertical-red@3x.png" alt="" width={40} height={40} />
      </div>
    </div>
  )
}
