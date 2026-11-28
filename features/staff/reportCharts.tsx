'use client'

import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './ReportCharts.module.css'

export type ChartColor = 'hado' | 'thao' | 'other' | 'primary' | 'secondary'
type ChartPoint = number | null
type Series = { label: string; color: ChartColor; values: ChartPoint[]; dates?: string[]; comparison?: boolean }

export function reportNumber(language: 'en' | 'vi', value: number, digits = 0) {
  return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { maximumFractionDigits: digits }).format(value)
}

function scaleFor(values: number[]) {
  const upper = Math.max(0, ...values)
  const lower = Math.min(0, ...values)
  const target = Math.max(1, (upper - lower) / 4)
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const step = ([1, 2, 2.5, 5, 10].find((unit) => unit * magnitude >= target) ?? 10) * magnitude
  const top = Math.max(step, Math.ceil(upper / step) * step)
  const bottom = Math.floor(lower / step) * step
  const ticks = Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, index) => top - step * index)
  return { ticks, y: (value: number) => (top - value) / (top - bottom) * 100 }
}

type BarSeries = { label: string; comparison?: boolean; color?: ChartColor }
type VenuePeriod = BarSeries & { dates: string }

export function ReportVenueLegend({ periods }: { periods: VenuePeriod[] }) {
  return <ul className={styles.venueChartLegend}>
    {periods.map((period) => <li key={period.label}>
      <i aria-hidden="true" data-previous={period.comparison || undefined} />
      <span><strong>{period.label}</strong> {period.dates}</span>
    </li>)}
  </ul>
}

export function ReportVenueBars({ label, venues, periods, formatValue, formatTick, axisLabel, compact }: {
  label: string
  venues: { id: string; name: string; color?: ChartColor; values: ChartPoint[]; details?: string[] }[]
  periods: BarSeries[]
  formatValue: (value: ChartPoint) => string
  formatTick: (value: number) => string
  axisLabel?: string
  compact?: boolean
}) {
  const { ticks, y } = scaleFor(venues.flatMap((venue) => venue.values.filter((value): value is number => value !== null)))
  const axis = ticks.slice().reverse()
  const x = (value: number) => 100 - y(value)
  const zero = x(0)
  const id = useId()
  const showMidpoint = zero === 0 || zero === 100

  return <div className={styles.venueChart} data-compact={compact || undefined} role="group" aria-labelledby={id} aria-describedby={axisLabel ? `${id}-units` : undefined}>
    <h5 id={id} className={styles.venueChartTitle}>{label}</h5>
    <div className={styles.venuePlot}>
      <div className={styles.venueGridlines} aria-hidden="true">
        {axis.map((tick) => <i key={tick} data-zero={tick === 0 || undefined} style={{ left: `${x(tick)}%` }} />)}
      </div>
      <ul className={styles.venueBarGroups}>
        {venues.map((venue) => <li key={venue.id} data-color={venue.color} className={styles.venueBarGroup}>
          <p>{venue.name}</p>
          <div className={styles.venueBarRows}>
            {periods.map((period, index) => {
              const value = venue.values[index]
              const end = x(value ?? 0)
              const detail = venue.details?.[index]
              return <div key={period.label} className={styles.venueBarRow}>
                {value !== null && value !== 0 && <div className={styles.venueBar} data-color={period.color} data-previous={period.comparison || undefined}
                  style={{ left: `${Math.min(zero, end)}%`, width: `${Math.abs(end - zero)}%` }}>
                  {detail && <span aria-hidden="true">{detail}</span>}
                </div>}
                <strong className={styles.venueBarValue} style={{ left: `${Math.max(end, zero)}%` }}>
                  <span className="sr-only">{period.label}: </span>{formatValue(value)}
                  {detail && <span className="sr-only">, {detail}</span>}
                </strong>
              </div>
            })}
          </div>
        </li>)}
      </ul>
    </div>
    <div className={styles.venueBarAxis}>
      <div aria-hidden="true">
        {axis.map((tick, index) => <span key={tick}
          data-interior={index > 0 && index < axis.length - 1 && tick !== 0
            && !(showMidpoint && index === Math.floor(axis.length / 2)) || undefined}
          style={{ left: `${x(tick)}%` }}>{formatTick(tick)}</span>)}
      </div>
      {axisLabel && <p id={`${id}-units`}>{axisLabel}</p>}
    </div>
  </div>
}

export function ReportPanel({ title, period, description, children, wide, actions }: {
  title: string; period?: string; description?: string; children: ReactNode; wide?: boolean; actions?: ReactNode
}) {
  const id = useId()
  return <section className={wide ? `${styles.panel} ${styles.wide}` : styles.panel} aria-labelledby={id}>
    <header className={styles.panelHead}>
      <div>
        <h4 id={id}>{title}</h4>
        {period && <p className={styles.chartPeriod}>{period}</p>}
        {description && <p>{description}</p>}
      </div>
      {actions}
    </header>
    {children}
  </section>
}

export function ReportTrend({ label, labels, series, mode = 'line', valueLabel, tickLabel = valueLabel, language }: {
  label: string; labels: string[]; series: Series[]; mode?: 'line' | 'columns'
  valueLabel: (value: number) => string; tickLabel?: (value: number) => string; language: 'en' | 'vi'
}) {
  const [focus, setFocus] = useState<number | null>(null)
  const [showData, setShowData] = useState(false)
  const values = series.flatMap((item) => item.values.filter((value): value is number => value != null && Number.isFinite(value)))
  if (!labels.length || !values.length) return <p className={styles.empty}>{language === 'vi' ? 'Không có dữ liệu trong kỳ này.' : 'No data for this period.'}</p>

  const scale = scaleFor(values)
  const last = labels.length - 1
  const active = Math.min(focus ?? last, last)
  const x = (index: number) => mode === 'columns'
    ? (index + 0.5) * 100 / labels.length
    : last === 0 ? 50 : 2 + index * 96 / last
  const indexAt = (position: number) => Math.max(0, Math.min(last, mode === 'columns'
    ? Math.floor(position * labels.length)
    : Math.round((position - 0.02) * last / 0.96)))
  const path = (points: ChartPoint[]) => points.map((point, index) => point == null ? ''
    : `${index === 0 || points[index - 1] == null ? 'M' : 'L'} ${x(index)} ${scale.y(point)}`).join(' ')
  const summary = series.map((line) => `${line.label}: ${line.values[active] == null ? '—' : valueLabel(line.values[active])}`).join(', ')
  const axisLabels = [...new Set([0, Math.round(last * 0.25), Math.round(last * 0.5), Math.round(last * 0.75), last])]

  return <div className={styles.trend}>
    <div className={styles.legend}>
      {series.map((line) => <span key={line.label}><i data-color={line.color} data-comparison={line.comparison || undefined} />{line.label}</span>)}
    </div>
    <div className={styles.plotFrame}>
      <div className={styles.scale} aria-hidden="true">
        {scale.ticks.map((tick) => <span key={tick} style={{ top: `${scale.y(tick)}%` }}>{tickLabel(tick)}</span>)}
      </div>
      <div className={styles.plot} role={last ? 'slider' : 'group'} tabIndex={last ? 0 : undefined}
        aria-label={label} aria-valuemin={last ? 1 : undefined} aria-valuemax={last ? labels.length : undefined}
        aria-valuenow={last ? active + 1 : undefined} aria-valuetext={last ? `${labels[active]} · ${summary}` : undefined}
        onPointerMove={(event) => {
          if (event.pointerType === 'touch') return
          const bounds = event.currentTarget.getBoundingClientRect()
          setFocus(indexAt((event.clientX - bounds.left) / bounds.width))
        }}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          setFocus(indexAt((event.clientX - bounds.left) / bounds.width))
        }}
        onKeyDown={(event) => {
          const next = { ArrowLeft: active - 1, ArrowDown: active - 1, ArrowRight: active + 1, ArrowUp: active + 1, Home: 0, End: last }[event.key]
          if (next === undefined) return
          event.preventDefault()
          setFocus(Math.max(0, Math.min(last, next)))
        }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {scale.ticks.map((tick) => <line key={tick} className={tick === 0 ? styles.baseline : styles.gridline} x2="100" y1={scale.y(tick)} y2={scale.y(tick)} />)}
          <line className={styles.cursor} x1={x(active)} x2={x(active)} y2="100" />
          {series.map((line, lineIndex) => mode === 'line'
            ? <path key={line.label} data-color={line.color} className={styles.path} data-comparison={line.comparison || undefined} d={path(line.values)} />
            : <g key={line.label} data-color={line.color} className={styles.columns} data-comparison={line.comparison || undefined}>
              {line.values.map((point, index) => {
                if (point == null || point === 0) return null
                const width = Math.min(8, 72 / labels.length) / series.length
                return <rect key={index} x={x(index) + (lineIndex - series.length / 2) * width} y={Math.min(scale.y(point), scale.y(0))}
                  width={width * 0.87} height={Math.abs(scale.y(point) - scale.y(0))} />
              })}
            </g>)}
        </svg>
        {mode === 'line' && series.map((line) => {
          const point = line.values[active]
          return point == null ? null : <i aria-hidden="true" key={line.label} className={styles.dot} data-color={line.color}
            style={{ left: `${x(active)}%`, top: `${scale.y(point)}%` }} />
        })}
      </div>
      <div className={styles.axis} aria-hidden="true">
        {axisLabels.map((index, position) => <span key={index} data-middle={position % 2 === 1 && index !== last || undefined}
          style={{ left: `${x(index)}%` }}>{labels[index]}</span>)}
      </div>
    </div>
    <div className={styles.readout} aria-live="off">
      <strong>{labels[active]}</strong>
      {series.map((line) => <span key={line.label} data-color={line.color}>{line.label}{line.dates?.[active] && line.dates[active] !== labels[active] ? ` · ${line.dates[active]}` : ''}
        <b>{line.values[active] == null ? '—' : valueLabel(line.values[active])}</b></span>)}
    </div>
    <details className={styles.details} onToggle={(event) => setShowData(event.currentTarget.open)}>
      <summary>{language === 'vi' ? 'Xem số liệu' : 'View data'}</summary>
      {showData && <div className={styles.tableWrap}><table>
        <thead><tr><th scope="col">{label}</th>{series.map((line) => <th scope="col" key={line.label}>{line.label}</th>)}</tr></thead>
        <tbody>{labels.map((item, index) => <tr key={index}><th scope="row">{item}</th>{series.map((line) =>
          <td key={line.label}>{line.dates?.[index] && line.dates[index] !== item && <small>{line.dates[index]} · </small>}
            {line.values[index] == null ? '—' : valueLabel(line.values[index])}</td>)}</tr>)}</tbody>
      </table></div>}
    </details>
  </div>
}

export type RankRow = { id?: string; label: string; value: number; color?: ChartColor; detail?: string; parts?: { label: string; value: number; color: ChartColor }[] }

export function ReportRanking({ rows, valueLabel, empty }: { rows: RankRow[]; valueLabel: (value: number) => string; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  if (!rows.length) return <p className={styles.empty}>{empty}</p>
  return <ul className={styles.ranking}>
    {rows.map((row) => <li key={row.id || row.label}>
      <div><span>{row.label}</span><strong>{valueLabel(row.value)}</strong></div>
      <div className={styles.track} aria-hidden="true">
        {(row.parts ?? [{ label: row.label, value: row.value, color: row.color ?? 'primary' }]).map((part) =>
          <i key={part.label} data-color={part.color} style={{ width: `${Math.max(0, part.value) / max * 100}%` }} />)}
      </div>
      {row.detail && <small>{row.detail}</small>}
    </li>)}
  </ul>
}

export function ReportHeatmap({ rows, columns, values, label, legend, language }: {
  rows: string[]; columns: string[]; values: number[][]; label: string; legend: [string, string]; language: 'en' | 'vi'
}) {
  const max = Math.max(1, ...values.flat())
  const [selection, setSelection] = useState<[number, number] | null>(null)
  const active = selection && values[selection[0]]?.[selection[1]] != null ? selection : null
  return <>
    <div className={styles.tableWrap}><table className={styles.heatmap} aria-label={label}>
      <thead><tr><th scope="col">{language === 'vi' ? 'Ngày' : 'Day'}</th>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>{rows.map((row, rowIndex) => <tr key={row}><th scope="row">{row}</th>{columns.map((column, index) => {
        const value = values[rowIndex]?.[index] ?? 0
        const description = `${row} · ${column} · ${reportNumber(language, value)}`
        return <td key={column}><button type="button" title={description} aria-label={description}
          aria-pressed={active?.[0] === rowIndex && active[1] === index}
          style={{ '--cell-intensity': `${value ? 12 + value / max * 43 : 0}%` } as CSSProperties}
          onClick={() => setSelection([rowIndex, index])}>{reportNumber(language, value)}</button></td>
      })}</tr>)}</tbody>
    </table></div>
    <div className={styles.heatLegend}><span>{legend[0]}</span><i aria-hidden="true" /><span>{legend[1]}</span></div>
    {active && <p className={styles.selection}>{rows[active[0]]} · {columns[active[1]]} · {reportNumber(language, values[active[0]][active[1]])}</p>}
  </>
}
