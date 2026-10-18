import Image from 'next/image'
import { isAnvioGame } from '../lib/anvio'
import styles from './GameGuideCategory.module.css'

export default function AnvioBadge({ gameId }: { gameId: string }) {
  if (!isAnvioGame(gameId)) return null
  return <span className={styles.badge} role="img" aria-label="Powered by Anvio" lang="en"><small>Powered by</small><Image src="/brand/anvio-logo-vertical-red@3x.png" alt="Anvio" width={40} height={40} /></span>
}
