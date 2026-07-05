import BrandLoader from './BrandLoader'

type AppLoadingStateProps = {
  className?: string
  compact?: boolean
  label?: string
}

export default function AppLoadingState({
  className = 'section',
  compact = false,
  label,
}: AppLoadingStateProps) {
  return (
    <section className={['app-loading-section', className].filter(Boolean).join(' ')}>
      <BrandLoader compact={compact} label={label} />
    </section>
  )
}
