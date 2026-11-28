import { buildReportPowerPoint } from '../../lib/staff/reportPowerPointPackage'
import { vrenaPalette } from '../../lib/theme/vrenaPalette'
import { reportScale, type ChartColor } from './reportCharts'

type Point = number | null
type Series = { label: string; color: ChartColor; values: Point[]; comparison?: boolean }
type RankingRow = { label: string; value: number; detail?: string; parts?: { label: string; value: number; color: ChartColor }[] }
type SlideHeader = { title: string; period: string }
type Trend = SlideHeader & { kind: 'trend'; unit: string; labels: string[]; series: Series[]; format: (value: number) => string; columns?: boolean }
type Venue = SlideHeader & { kind: 'venue'; unit: string; groups: { name: string; color: ChartColor; values: Point[]; details?: string[] }[]; periods: { label: string; dates: string; comparison?: boolean }[]; valueLabel: (value: Point) => string; format: (value: number) => string }
type Heat = SlideHeader & { kind: 'heat'; unit: string; labels: string[]; rows: string[]; values: number[][]; max: number }
type Ranking = SlideHeader & { kind: 'ranking'; unit: string; rows: RankingRow[]; format: (value: number) => string; empty: string; note?: string; legend?: { label: string; color: ChartColor }[] }
type Summary = SlideHeader & { kind: 'summary'; previousLabel: string; rows: { label: string; value: string; previous?: string }[] }
export type ReportSlide = Trend | Venue | Heat | Ranking | Summary
type Deck = { from: string; to: string; dates: string; venue: string; slides: ReportSlide[] }
type Drawing = CanvasRenderingContext2D

const width = 1600
const height = 900
const ink = vrenaPalette.neutral[950]
const muted = vrenaPalette.neutral[600]
const axisColor = vrenaPalette.neutral[300]
const grid = vrenaPalette.neutral[200]
const palette: Record<ChartColor, string> = {
  hado: vrenaPalette.blue[600], thao: vrenaPalette.orange[500], other: vrenaPalette.neutral[500],
  primary: vrenaPalette.cyan[700], secondary: vrenaPalette.purple[600],
}

function rect(ctx: Drawing, x: number, y: number, w: number, h: number, color: string, alpha = 1) {
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fillRect(x, y, w, h)
  ctx.globalAlpha = 1
}

function line(ctx: Drawing, x: number, y: number, endX: number, endY: number, color: string, weight = 1) {
  ctx.strokeStyle = color
  ctx.lineWidth = weight
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(endX, endY)
  ctx.stroke()
}

function label(ctx: Drawing, value: string, x: number, y: number, opts: {
  size?: number; weight?: number; color?: string; align?: CanvasTextAlign; width?: number
} = {}) {
  const { size = 23, weight = 400, color = ink, align = 'left', width: limit } = opts
  ctx.font = `${weight} ${size}px "VRena Slide Inter", Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
  if (limit) ctx.fillText(value, x, y, limit)
  else ctx.fillText(value, x, y)
}

function plotScale(values: Point[], min: number, max: number) {
  const scale = reportScale(values.filter((value): value is number => value != null))
  return { ticks: scale.ticks, position: (value: number) => min + (max - min) * scale.y(value) / 100 }
}

function plotLegend(ctx: Drawing, items: { label: string; color: string; comparison?: boolean }[], y = 242) {
  const spacing = 1430 / Math.max(1, items.length)
  items.forEach((item, index) => {
    const x = 84 + index * spacing
    ctx.setLineDash(item.comparison ? [7, 5] : [])
    line(ctx, x, y - 7, x + 28, y - 7, item.color, 4)
    ctx.setLineDash([])
    label(ctx, item.label, x + 38, y, { size: 20, color: muted, width: spacing - 52 })
  })
}

function header(ctx: Drawing, slide: SlideHeader, venue: string, logo: HTMLImageElement, page: number) {
  label(ctx, slide.title, 84, 104, { size: 54, weight: 740, width: 1390 })
  label(ctx, slide.period, 86, 150, { size: 25, color: muted, width: 1370 })
  line(ctx, 84, 181, 1516, 181, grid, 2)
  line(ctx, 84, 812, 1516, 812, grid, 2)
  drawLogo(ctx, logo, 84, 832, 95)
  label(ctx, venue, 205, 852, { size: 19, color: muted, width: 1170 })
  label(ctx, String(page), 1516, 852, { size: 19, color: muted, align: 'right' })
}

function drawLogo(ctx: Drawing, logo: HTMLImageElement, x: number, y: number, w: number) {
  ctx.drawImage(logo, x, y, w, w * logo.naturalHeight / logo.naturalWidth)
}

function drawTrend(ctx: Drawing, slide: Trend) {
  const left = 175, right = 1490, top = 310, bottom = 720
  const scale = plotScale(slide.series.flatMap(series => series.values), top, bottom)
  const span = right - left
  const count = slide.labels.length
  const slot = span / Math.max(count, 1)
  const xFor = (i: number) => slide.columns || count <= 1 ? left + (i + .5) * slot : left + i * span / (count - 1)
  label(ctx, slide.unit, 85, 279, { size: 21, color: muted })
  plotLegend(ctx, slide.series.map(series => ({ ...series, color: palette[series.color] })), 230)
  scale.ticks.forEach(tick => {
    const y = scale.position(tick)
    line(ctx, left, y, right, y, tick === 0 ? axisColor : grid, 1.5)
    label(ctx, slide.format(tick), left - 15, y + 7, { size: 20, color: muted, align: 'right', width: 72 })
  })
  const skip = Math.max(1, Math.ceil(count / (slide.columns ? 20 : 9)))
  slide.labels.forEach((name, i) => {
    if (i % skip !== 0 && i !== count - 1) return
    if (i !== count - 1 && i > 0 && count - 1 - i < skip) return
    label(ctx, name, xFor(i), bottom + 37, { size: 20, color: muted, align: 'center', width: Math.max(36, slot * skip - 4) })
  })
  slide.series.forEach((series, seriesIndex) => {
    const color = palette[series.color]
    if (slide.columns) {
      const bar = Math.min(68, slot * .74 / Math.max(1, slide.series.length))
      const zero = scale.position(0)
      series.values.forEach((value, index) => {
        if (value == null) return
        const x = xFor(index) + (seriesIndex - slide.series.length / 2) * bar
        const y = scale.position(value)
        rect(ctx, x + 2, Math.min(y, zero), bar - 4, Math.abs(y - zero), color, series.comparison ? .43 : 1)
        if (value && bar > 25) label(ctx, slide.format(value), x + bar / 2, Math.min(y, zero) - 8, { size: 16, align: 'center', width: bar + 4 })
      })
      return
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.setLineDash(series.comparison ? [10, 8] : [])
    ctx.beginPath()
    let penDown = false
    series.values.forEach((value, index) => {
      if (value == null) { penDown = false; return }
      const x = xFor(index), y = scale.position(value)
      if (penDown) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
      penDown = true
    })
    ctx.stroke()
    ctx.setLineDash([])
    if (series.values.filter(value => value != null).length === 1) {
      const index = series.values.findIndex(value => value != null)
      rect(ctx, xFor(index) - 4, scale.position(series.values[index]!) - 4, 8, 8, color)
    }
  })
}

function drawVenue(ctx: Drawing, slide: Venue) {
  const left = 360, right = 1390, top = 303, bottom = 691
  const scale = plotScale(slide.groups.flatMap(group => group.values), right, left)
  const zero = scale.position(0)
  const groupSlot = (bottom - top) / slide.groups.length
  const groupHeight = Math.min(112, groupSlot * .73)
  const barHeight = groupHeight / slide.periods.length
  plotLegend(ctx, slide.periods.map(period => ({ label: period.label + '  ' + period.dates, color: muted, comparison: period.comparison })), 229)
  scale.ticks.forEach(tick => {
    const x = scale.position(tick)
    line(ctx, x, top - 11, x, bottom + 12, tick === 0 ? axisColor : grid, 1.5)
    label(ctx, slide.format(tick), x, bottom + 43, { size: 21, color: muted, align: 'center', width: 100 })
  })
  slide.groups.forEach((group, index) => {
    const center = top + (index + .5) * groupSlot
    label(ctx, group.name, left - 25, center + 8, { size: 26, weight: 620, align: 'right', width: 255 })
    group.values.forEach((value, bin) => {
      const topBar = center - groupHeight / 2 + bin * barHeight
      const x = value == null ? zero : scale.position(value)
      if (value) rect(ctx, Math.min(zero, x), topBar, Math.abs(x - zero), barHeight - 8, palette[group.color], slide.periods[bin]?.comparison ? .60 : 1)
      const exact = slide.valueLabel(value)
      label(ctx, exact, Math.max(zero, x) + 12, topBar + barHeight * .55, { size: 25, weight: 710, width: 106 })
      const detail = group.details?.[bin]
      if (!detail) return
      if (x - zero > 365) label(ctx, detail, x - 15, topBar + barHeight * .55, { size: 21, weight: 650, color: '#101819', align: 'right', width: x - zero - 30 })
      else label(ctx, detail, Math.max(zero, x) + 128, topBar + barHeight * .55, { size: 19, color: muted, width: Math.max(100, 1510 - Math.max(zero, x) - 128) })
    })
  })
  label(ctx, slide.unit, (left + right) / 2, bottom + 84, { size: 23, color: muted, align: 'center' })
}

function drawHeat(ctx: Drawing, slide: Heat) {
  const left = 159, top = 314, cellWidth = 1339 / slide.labels.length, cellHeight = 55
  label(ctx, slide.unit, 85, 240, { size: 23, color: muted })
  slide.labels.forEach((name, index) => label(ctx, name, left + (index + .5) * cellWidth, top - 18,
    { size: 20, align: 'center', color: muted, width: cellWidth - 7 }))
  slide.values.forEach((row, index) => {
    const y = top + index * cellHeight
    label(ctx, slide.rows[index], 85, y + 34, { weight: 650, size: 22, width: 67 })
    row.forEach((value, i) => {
      const heat = value / Math.max(1, slide.max)
      const x = left + i * cellWidth
      rect(ctx, x + 2, y + 2, cellWidth - 4, cellHeight - 4, palette.primary, value ? .19 + heat * .81 : .045)
      label(ctx, String(value), x + cellWidth / 2, y + 35, { size: 22, weight: 640, align: 'center', color: heat > .69 ? '#fff' : ink, width: cellWidth - 6 })
    })
  })
  const x = 1240, y = 759
  for (let i = 0; i < 14; i++) rect(ctx, x + i * 14, y - 12, 14, 10, palette.primary, .045 + i * .073)
  label(ctx, '0', x - 13, y, { align: 'right', size: 19, color: muted })
  label(ctx, String(slide.max), x + 206, y, { size: 19, color: muted })
}

function drawRanking(ctx: Drawing, slide: Ranking) {
  const left = 490, right = 1370, top = 298, bottom = 716
  if (slide.note) label(ctx, slide.note, 85, 226, { size: 22, color: muted, width: 1410 })
  if (slide.legend?.length) plotLegend(ctx, slide.legend.map(item => ({ ...item, color: palette[item.color] })), 264)
  if (!slide.rows.length) { label(ctx, slide.empty, 84, 379, { size: 29, color: muted }); return }
  const scale = plotScale(slide.rows.map(row => row.value), right, left)
  const zero = scale.position(0)
  scale.ticks.forEach(tick => {
    const x = scale.position(tick)
    line(ctx, x, top, x, bottom, tick === 0 ? axisColor : grid, 1.5)
    label(ctx, slide.format(tick), x, bottom + 38, { size: 19, color: muted, align: 'center', width: 155 })
  })
  const slot = (bottom - top) / Math.max(slide.rows.length, 4)
  slide.rows.forEach((row, index) => {
    const y = top + slot * (index + .5)
    label(ctx, row.label, 84, y + (row.detail ? -2 : 8), { size: 24, weight: 625, width: 385 })
    if (row.detail) label(ctx, row.detail, 84, y + 21, { size: 18, color: muted, width: 385 })
    let x = zero
    const bar = Math.min(32, slot * .58)
    if (row.parts?.length) {
      for (const part of row.parts) {
        const w = scale.position(part.value) - zero
        rect(ctx, x, y - bar / 2, w, bar, palette[part.color])
        x += w
      }
    } else {
      x = scale.position(row.value)
      rect(ctx, Math.min(zero, x), y - bar / 2, Math.abs(x - zero), bar, palette.primary)
    }
    label(ctx, slide.format(row.value), Math.max(x, zero) + 12, y + 8, { size: 23, weight: 700, width: 140 })
  })
  label(ctx, slide.unit, (left + right) / 2, bottom + 72, { size: 21, color: muted, align: 'center' })
}

function drawSummary(ctx: Drawing, slide: Summary) {
  slide.rows.forEach((row, index) => {
    const x = 84 + index % 4 * 359
    const y = 280 + Math.floor(index / 4) * 235
    line(ctx, x, y - 38, x + 325, y - 38, grid, 2)
    label(ctx, row.label, x, y, { size: 25, color: muted, width: 320 })
    label(ctx, row.value, x, y + 75, { size: 49, weight: 760, width: 320 })
    if (row.previous) label(ctx, slide.previousLabel + ' · ' + row.previous, x, y + 121, { size: 20, color: muted, width: 320 })
  })
}

function drawCover(ctx: Drawing, deck: Deck, logo: HTMLImageElement) {
  drawLogo(ctx, logo, 100, 96, 237)
  rect(ctx, 100, 305, 94, 7, vrenaPalette.purple[600])
  label(ctx, 'VRena Report', 93, 453, { size: 114, weight: 790, width: 1390 })
  label(ctx, deck.dates, 101, 544, { size: 40, weight: 575, width: 1390 })
  label(ctx, deck.venue, 103, 605, { size: 34, color: muted, width: 1390 })
}

async function slideAssets() {
  const logo = new Image()
  logo.src = '/brand/vrena-logo-full-light.png'
  const font = new FontFace('VRena Slide Inter', 'url("/fonts/InterVariable.woff2")', { weight: '100 900' })
  await Promise.all([logo.decode(), font.load()])
  document.fonts.add(font)
  return logo
}

async function renderSlide(draw: (context: Drawing) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width * 1.5
  canvas.height = height * 1.5
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Chart export is unavailable in this browser.')
  context.scale(1.5, 1.5)
  rect(context, 0, 0, width, height, '#ffffff')
  draw(context)
  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('A report chart could not be rendered.')), 'image/png')
  })
  return new Uint8Array(await png.arrayBuffer())
}

const drawings = {
  trend: drawTrend, venue: drawVenue, heat: drawHeat, ranking: drawRanking, summary: drawSummary,
}

export async function downloadReportPowerPoint(deck: Deck) {
  const logo = await slideAssets()
  const images = [{ title: 'VRena Report', image: await renderSlide(ctx => drawCover(ctx, deck, logo)) }]
  const slides = deck.slides.flatMap(slide => slide.kind === 'ranking' && slide.rows.length > 8
    ? Array.from({ length: Math.ceil(slide.rows.length / 8) }, (_, index) => ({
      ...slide, title: slide.title + ' (' + (index + 1) + '/' + Math.ceil(slide.rows.length / 8) + ')',
      rows: slide.rows.slice(index * 8, (index + 1) * 8),
    })) : [slide])
  for (const [index, slide] of slides.entries()) {
    const image = await renderSlide(ctx => {
      header(ctx, slide, deck.venue, logo, index + 2)
      switch (slide.kind) {
        case 'trend': drawings.trend(ctx, slide); break
        case 'venue': drawings.venue(ctx, slide); break
        case 'heat': drawings.heat(ctx, slide); break
        case 'ranking': drawings.ranking(ctx, slide); break
        case 'summary': drawings.summary(ctx, slide); break
      }
    })
    images.push({ title: slide.title, image })
  }
  const bytes = buildReportPowerPoint(images)
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'VRena-Report-' + deck.from + '-' + deck.to + '.pptx'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
