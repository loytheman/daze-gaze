// one-off conversion of the mxgmn/WaveFunctionCollapse tileset XML files
// (src/assets/tilesets/*.xml) into equivalent JSON, same shape, so the app
// can load them without a runtime XML parser.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'

const dir = join(import.meta.dirname, '..', 'src', 'assets', 'tilesets')

function attrs(tag) {
  const out = {}
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2]
  return out
}

function section(xml, tagName) {
  const m = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`))
  return m ? m[1] : ''
}

function convert(xml) {
  const setTag = xml.match(/<set[^>]*>/)?.[0] ?? '<set>'
  const setAttrs = attrs(setTag)

  const tiles = [...section(xml, 'tiles').matchAll(/<tile\s+([^/]*?)\/>/g)].map((m) => {
    const a = attrs(m[0])
    return { name: a.name, symmetry: a.symmetry, weight: a.weight ? Number(a.weight) : 1.0 }
  })

  const neighbors = [...section(xml, 'neighbors').matchAll(/<neighbor\s+([^/]*?)\/>/g)].map((m) => {
    const a = attrs(m[0])
    return { left: a.left, right: a.right }
  })

  const subsetsXml = section(xml, 'subsets')
  const subsets = [...subsetsXml.matchAll(/<subset\s+name="([^"]*)"\s*>([\s\S]*?)<\/subset>/g)].map((m) => ({
    name: m[1],
    tiles: [...m[2].matchAll(/<tile\s+name="([^"]*)"\s*\/>/g)].map((t) => t[1]),
  }))

  const out = { tiles, neighbors }
  if (setAttrs.unique) out.unique = setAttrs.unique.toLowerCase() === 'true'
  if (subsets.length) out.subsets = subsets
  return out
}

// one compact line per array element instead of full pretty-print — see
// "JSON formatting" in the repo's CLAUDE.md
function inlineObj(obj) {
  const parts = Object.entries(obj).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
  return `{ ${parts.join(', ')} }`
}

function toCompactJson(data) {
  const lines = ['{']
  const keys = Object.keys(data)
  keys.forEach((key, i) => {
    const trailingComma = i < keys.length - 1 ? ',' : ''
    if (key === 'unique') {
      lines.push(`  "unique": ${data.unique}${trailingComma}`)
    } else if (key === 'subsets') {
      lines.push(`  "subsets": [`)
      data.subsets.forEach((s, j) => {
        const comma = j < data.subsets.length - 1 ? ',' : ''
        const tiles = `[${s.tiles.map((t) => JSON.stringify(t)).join(', ')}]`
        lines.push(`    { "name": ${JSON.stringify(s.name)}, "tiles": ${tiles} }${comma}`)
      })
      lines.push(`  ]${trailingComma}`)
    } else {
      const items = data[key]
      lines.push(`  "${key}": [`)
      items.forEach((item, j) => {
        const comma = j < items.length - 1 ? ',' : ''
        lines.push(`    ${inlineObj(item)}${comma}`)
      })
      lines.push(`  ]${trailingComma}`)
    }
  })
  lines.push('}')
  return lines.join('\n') + '\n'
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.xml'))) {
  const xml = readFileSync(join(dir, file), 'utf-8')
  const json = convert(xml)
  const outPath = join(dir, basename(file, '.xml') + '.json')
  writeFileSync(outPath, toCompactJson(json))
  console.log(`${file} -> ${basename(outPath)} (${json.tiles.length} tiles, ${json.neighbors.length} neighbors${json.subsets ? `, ${json.subsets.length} subsets` : ''})`)
}
