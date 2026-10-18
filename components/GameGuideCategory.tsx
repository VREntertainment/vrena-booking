import AnvioBadge from './AnvioBadge'
import styles from './GameGuideCategory.module.css'

export default function GameGuideCategory({ gameId, category }: { gameId: string; category: string }) {
  return <div className={styles.category}><span>{category}</span><AnvioBadge gameId={gameId} /></div>
}
