type WorkbookSection = {
  title: string
  rows: Array<Record<string, unknown>>
}

function downloadBlob(filename: string, type: string, content: BlobPart) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function xmlCell(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xlsxColumnName(index: number) {
  let column = ''
  let value = index
  while (value > 0) {
    const remainder = (value - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    value = Math.floor((value - 1) / 26)
  }
  return column
}

function xlsxSafeSheetName(name: string, usedNames: Set<string>) {
  const cleaned = (name || 'Report').replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Report'
  const base = cleaned.slice(0, 31)
  let candidate = base
  let counter = 2
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` ${counter}`
    candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    counter += 1
  }
  usedNames.add(candidate.toLowerCase())
  return candidate
}

function xlsxCellXml(value: unknown, rowIndex: number, columnIndex: number, styleId = 0) {
  const reference = `${xlsxColumnName(columnIndex)}${rowIndex}`
  const style = styleId > 0 ? ` s="${styleId}"` : ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"${style}><v>${value}</v></c>`
  }
  return `<c r="${reference}" t="inlineStr"${style}><is><t>${xmlCell(value)}</t></is></c>`
}

function xlsxWorksheetXml(rows: Array<Record<string, unknown>>, noData: string) {
  const sourceRows = rows.length > 0 ? rows : [{ note: noData }]
  const sourceHeaders = Array.from(sourceRows.reduce<Set<string>>((keys, row) => {
    Object.keys(row).forEach((key) => keys.add(key))
    return keys
  }, new Set<string>()))
  const safeRows = sourceHeaders.length > 0 ? sourceRows : [{ note: noData }]
  const headers = sourceHeaders.length > 0 ? sourceHeaders : ['note']
  const headerRow = `<row r="1">${headers.map((header, index) => xlsxCellXml(header, 1, index + 1, 1)).join('')}</row>`
  const dataRows = safeRows.map((row, rowIndex) => {
    const excelRow = rowIndex + 2
    return `<row r="${excelRow}">${headers.map((header, columnIndex) => xlsxCellXml(row[header], excelRow, columnIndex + 1)).join('')}</row>`
  }).join('')
  const columnWidths = headers.map((header, index) => {
    const maxWidth = Math.min(46, Math.max(
      String(header).length,
      ...safeRows.map((row) => String(row[header] ?? '').length)
    ) + 2)
    return `<col min="${index + 1}" max="${index + 1}" width="${Math.max(12, maxWidth)}" customWidth="1"/>`
  }).join('')
  const filterRef = `A1:${xlsxColumnName(headers.length)}${safeRows.length + 1}`

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columnWidths}</cols>
  <sheetData>${headerRow}${dataRows}</sheetData>
  <autoFilter ref="${filterRef}"/>
</worksheet>`
}

function xlsxWorkbookXml(sheetNames: string[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetNames.map((name, index) => `<sheet name="${xmlCell(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>
</workbook>`
}

function xlsxWorkbookRels(sheetCount: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${Array.from({ length: sheetCount }, (_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('')}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function xlsxContentTypes(sheetCount: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${Array.from({ length: sheetCount }, (_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('')}
</Types>`
}

function xlsxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF4F7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
}

const xlsxCrcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let crc = index
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1)
    }
    table[index] = crc >>> 0
  }
  return table
})()

function xlsxCrc32(bytes: Uint8Array) {
  let crc = 0xFFFFFFFF
  bytes.forEach((byte) => {
    crc = xlsxCrcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  })
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function xlsxUint16(value: number) {
  return Uint8Array.of(value & 0xFF, (value >>> 8) & 0xFF)
}

function xlsxUint32(value: number) {
  return Uint8Array.of(value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF)
}

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(totalLength)
  let offset = 0
  chunks.forEach((chunk) => {
    output.set(chunk, offset)
    offset += chunk.length
  })
  return output
}

function buildZipFile(files: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder()
  const localFiles: Uint8Array[] = []
  const centralFiles: Uint8Array[] = []
  let offset = 0

  files.forEach((file) => {
    const name = encoder.encode(file.path)
    const content = encoder.encode(file.content)
    const crc = xlsxCrc32(content)
    const localHeader = concatBytes([
      xlsxUint32(0x04034B50),
      xlsxUint16(20),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint32(crc),
      xlsxUint32(content.length),
      xlsxUint32(content.length),
      xlsxUint16(name.length),
      xlsxUint16(0),
      name,
      content,
    ])
    localFiles.push(localHeader)
    centralFiles.push(concatBytes([
      xlsxUint32(0x02014B50),
      xlsxUint16(20),
      xlsxUint16(20),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint32(crc),
      xlsxUint32(content.length),
      xlsxUint32(content.length),
      xlsxUint16(name.length),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint32(0),
      xlsxUint32(offset),
      name,
    ]))
    offset += localHeader.length
  })

  const centralDirectory = concatBytes(centralFiles)
  const endRecord = concatBytes([
    xlsxUint32(0x06054B50),
    xlsxUint16(0),
    xlsxUint16(0),
    xlsxUint16(files.length),
    xlsxUint16(files.length),
    xlsxUint32(centralDirectory.length),
    xlsxUint32(offset),
    xlsxUint16(0),
  ])

  return concatBytes([...localFiles, centralDirectory, endRecord])
}

function buildXlsxWorkbook(sections: WorkbookSection[], noData: string) {
  const usedSheetNames = new Set<string>()
  const sheets = sections.length > 0 ? sections : [{ title: 'Report', rows: [{ note: noData }] }]
  const sheetNames = sheets.map((section) => xlsxSafeSheetName(section.title, usedSheetNames))
  const files: Array<{ path: string; content: string }> = [
    { path: '[Content_Types].xml', content: xlsxContentTypes(sheets.length) },
    { path: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { path: 'xl/workbook.xml', content: xlsxWorkbookXml(sheetNames) },
    { path: 'xl/_rels/workbook.xml.rels', content: xlsxWorkbookRels(sheets.length) },
    { path: 'xl/styles.xml', content: xlsxStylesXml() },
    ...sheets.map((section, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: xlsxWorksheetXml(section.rows, noData),
    })),
  ]
  return buildZipFile(files)
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ')
  if (/[",]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function pdfSafeText(value: unknown) {
  return String(value ?? '')
    .replace(/[đ₫]/gi, 'VND')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function buildSimplePdf(lines: string[], fallbackTitle: string) {
  const streamLines = [
    'BT',
    '/F1 18 Tf',
    '42 792 Td',
    `(${pdfSafeText(lines[0] || fallbackTitle)}) Tj`,
    '/F1 10 Tf',
    ...lines.slice(1, 48).flatMap((line) => ['0 -16 Td', `(${pdfSafeText(line)}) Tj`]),
    'ET',
  ]
  const stream = streamLines.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  const chunks = ['%PDF-1.4\n']
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(chunks.join('').length)
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`)
  })
  const xrefOffset = chunks.join('').length
  chunks.push(`xref\n0 ${objects.length + 1}\n`)
  chunks.push('0000000000 65535 f \n')
  offsets.slice(1).forEach((offset) => chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`))
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)
  return chunks.join('')
}

export function downloadExcelFile(filename: string, sections: WorkbookSection[], noData: string) {
  downloadBlob(
    filename.replace(/\.(xls|xlsx)$/i, '') + '.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buildXlsxWorkbook(sections, noData)
  )
}

export function downloadCsvFile(filename: string, rows: Array<Record<string, unknown>>, noData: string) {
  const safeRows = rows.length > 0 ? rows : [{ note: noData }]
  const headers = Array.from(safeRows.reduce<Set<string>>((keys, row) => {
    Object.keys(row).forEach((key) => keys.add(key))
    return keys
  }, new Set<string>()))
  const csv = [
    headers.map(csvCell).join(','),
    ...safeRows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n')
  downloadBlob(filename, 'text/csv;charset=utf-8;', `\uFEFF${csv}`)
}

export function downloadPdfFile(filename: string, lines: string[], fallbackTitle: string) {
  downloadBlob(filename, 'application/pdf', buildSimplePdf(lines, fallbackTitle))
}
