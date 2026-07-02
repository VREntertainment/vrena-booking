type BrandLoaderProps = {
  label?: string
  compact?: boolean
}

export default function BrandLoader({ label = 'Loading VRena', compact = false }: BrandLoaderProps) {
  return (
    <div className={compact ? 'brand-loader brand-loader-compact' : 'brand-loader'} aria-busy="true" aria-live="polite">
      <picture className="brand-loader-mark">
        <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-mark-dark.svg" />
        <img src="/brand/vrena-mark-light.svg" alt="" aria-hidden="true" />
      </picture>
      <span>{label}</span>
    </div>
  )
}
