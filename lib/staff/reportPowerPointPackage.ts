import { strToU8, zipSync } from 'fflate'

const presentationNs = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const drawingNs = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const documentRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const packageRel = 'http://schemas.openxmlformats.org/package/2006/relationships'
const presentationType = 'application/vnd.openxmlformats-officedocument.presentationml'
const width = 12_192_000
const height = 6_858_000
const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const namespaces = 'xmlns:p="' + presentationNs + '" xmlns:a="' + drawingNs + '" xmlns:r="' + documentRel + '"'
const treeStart = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>'
const mappedColors = '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>'
const overrideColors = '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'

function escaped(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function relationships(items: [id: string, type: string, target: string][]) {
  return '<Relationships xmlns="' + packageRel + '">' + items.map(([id, type, target]) =>
    '<Relationship Id="' + id + '" Type="' + documentRel + '/' + type + '" Target="' + target + '"/>'
  ).join('') + '</Relationships>'
}

function theme() {
  const colorValues = {
    dk1: '101819', lt1: 'FFFFFF', dk2: '566769', lt2: 'EDF2FF',
    accent1: '0D8CE1', accent2: 'FF710B', accent3: '0A8894', accent4: '3D38F3',
    accent5: '12B469', accent6: 'FFB800', hlink: '0979C2', folHlink: '332CD6',
  }
  const colors = Object.entries(colorValues).map(([name, rgb]) =>
    '<a:' + name + '><a:srgbClr val="' + rgb + '"/></a:' + name + '>'
  ).join('')
  const typeface = '<a:latin typeface="Inter"/><a:ea typeface=""/><a:cs typeface=""/>'
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
  const lines = [6350, 12700, 19050].map(size => '<a:ln w="' + size + '">' + fill + '</a:ln>').join('')
  return '<a:theme xmlns:a="' + drawingNs + '" name="VRena"><a:themeElements><a:clrScheme name="VRena">' + colors +
    '</a:clrScheme><a:fontScheme name="VRena"><a:majorFont>' + typeface + '</a:majorFont><a:minorFont>' + typeface +
    '</a:minorFont></a:fontScheme><a:fmtScheme name="VRena"><a:fillStyleLst>' + fill.repeat(3) +
    '</a:fillStyleLst><a:lnStyleLst>' + lines + '</a:lnStyleLst><a:effectStyleLst>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3) + '</a:effectStyleLst><a:bgFillStyleLst>' +
    fill.repeat(3) + '</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'
}

export function buildReportPowerPoint(slides: { title: string; image: Uint8Array }[]) {
  const files: Record<string, Uint8Array> = {}
  function add(path: string, xml: string) { files[path] = strToU8(xmlHeader + xml) }
  const overrides: [string, string][] = [
    ['presentation.xml', '.presentation.main+xml'], ['slideMasters/slideMaster1.xml', '.slideMaster+xml'],
    ['slideLayouts/slideLayout1.xml', '.slideLayout+xml'],
  ]
  const slideIds = slides.map((_, index) => '<p:sldId id="' + (256 + index) + '" r:id="rId' + (index + 2) + '"/>').join('')
  add('_rels/.rels', relationships([['rId1', 'officeDocument', 'ppt/presentation.xml']]))
  add('ppt/presentation.xml', '<p:presentation ' + namespaces + '><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>' +
    slideIds + '</p:sldIdLst><p:sldSz cx="' + width + '" cy="' + height + '" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>')
  add('ppt/_rels/presentation.xml.rels', relationships([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
    ...slides.map((_, index): [string, string, string] => ['rId' + (index + 2), 'slide', 'slides/slide' + (index + 1) + '.xml']),
  ]))
  add('ppt/theme/theme1.xml', theme())
  add('ppt/slideMasters/slideMaster1.xml', '<p:sldMaster ' + namespaces + '><p:cSld>' + treeStart + '</p:spTree></p:cSld>' +
    mappedColors + '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>')
  add('ppt/slideMasters/_rels/slideMaster1.xml.rels', relationships([
    ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml'],
  ]))
  add('ppt/slideLayouts/slideLayout1.xml', '<p:sldLayout ' + namespaces + ' type="blank"><p:cSld name="Blank">' + treeStart +
    '</p:spTree></p:cSld>' + overrideColors + '</p:sldLayout>')
  add('ppt/slideLayouts/_rels/slideLayout1.xml.rels', relationships([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]))
  slides.forEach((slide, index) => {
    const part = 'slide' + (index + 1)
    const filename = part + '.png'
    const title = escaped(slide.title)
    overrides.push(['slides/' + part + '.xml', '.slide+xml'])
    files['ppt/media/' + filename] = slide.image
    add('ppt/slides/' + part + '.xml', '<p:sld ' + namespaces + '><p:cSld name="' + title + '">' + treeStart +
      '<p:pic><p:nvPicPr><p:cNvPr id="2" name="' + title + '" descr="' + title + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
      '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + width +
      '" cy="' + height + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld>' +
      overrideColors + '</p:sld>')
    add('ppt/slides/_rels/' + part + '.xml.rels', relationships([
      ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'image', '../media/' + filename],
    ]))
  })
  add('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/>' +
    overrides.map(([part, suffix]) => '<Override PartName="/ppt/' + part + '" ContentType="' + presentationType + suffix + '"/>').join('') +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>')
  return zipSync(files, { level: 0 })
}
