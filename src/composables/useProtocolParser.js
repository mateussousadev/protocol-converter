/**
 * useProtocolParser
 * Converte texto bruto de protocolo no padrão interno para Markdown formatado.
 */

export function useProtocolParser() {

  const SEP = '(?:[:\\-\u2013\u2014]\\s*(.*))?\\s*$'

  const BLOCK_PATTERNS = [
    { type: 'funcionalidade', re: new RegExp('^Funcionalidades?\\s*' + SEP, 'i') },
    { type: 'contexto', re: new RegExp('^Contexto\\s*' + SEP, 'i') },
    { type: 'regra', re: new RegExp('^Regra\\s*\\d*\\s*' + SEP, 'i') },
    { type: 'esquema', re: new RegExp('^Esquema\\s+d[eo]\\s+Cen[áa]rios?\\s*(\\d*)\\s*' + SEP, 'i') },
    { type: 'cenario', re: new RegExp('^Cen[áa]rios?\\s*(\\d*)\\s*' + SEP, 'i') },
    { type: 'exemplos', re: new RegExp('^Exemplos?\\s*' + SEP, 'i') },
    { type: 'observacoes', re: new RegExp('^Observa[çc][õo]es\\s*' + SEP, 'i') },
  ]

  const GHERKIN_KEYWORDS = /^(Dado que|Dado|Quando|Ent[ãa]o|E que|E|Mas que|Mas|Se o|Se)\b\s*/i

  const NOISE_LINES = /^(Mensagem|Descri[çc][ãa]o|Anexos?|Evid[êe]ncias?)\s*:?\s*$/i

  function isTableLine(line) {
    return /^\|/.test(line) && line.includes('|', 1)
  }

  function isSeparatorRow(cells) {
    return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c))
  }

  function splitRow(line) {
    const cells = line.split('|')
    if (cells.length && !cells[0].trim()) cells.shift()
    if (cells.length && !cells[cells.length - 1].trim()) cells.pop()
    return cells.map(c => c.trim())
  }

  /**
   * Normaliza um bloco de linhas com pipes em tabela markdown válida,
   * inserindo a linha separadora quando o texto colado do protocolo não a traz.
   */
  function renderTable(tableLines) {
    const rows = tableLines.map(splitRow).filter(r => r.length > 0)
    if (!rows.length) return []

    const body = rows.filter(r => !isSeparatorRow(r))
    if (!body.length) return []

    const width = Math.max(...body.map(r => r.length))
    const pad = row => {
      const filled = row.slice()
      while (filled.length < width) filled.push('')
      return `| ${filled.join(' | ')} |`
    }

    const out = [pad(body[0]), `|${' --- |'.repeat(width)}`]
    for (const row of body.slice(1)) out.push(pad(row))
    return out
  }

  /**
   * Placeholders de Esquema do Cenário (<algo>) viram código,
   * senão o markdown os interpreta como HTML e eles somem na renderização.
   */
  function escapePlaceholders(text) {
    return text.replace(/<([^<>\n]+)>/g, '`<$1>`')
  }

  function matchBlock(line) {
    for (const { type, re } of BLOCK_PATTERNS) {
      const m = line.match(re)
      if (!m) continue
      if (type === 'esquema' || type === 'cenario') {
        return { type, numero: m[1] ? parseInt(m[1]) : null, titulo: (m[2] || '').trim() }
      }
      return { type, numero: null, titulo: (m[1] || '').trim() }
    }
    return null
  }

  /**
   * Quebra o texto bruto em blocos sequenciais { type, titulo, numero, lines }.
   */
  function splitBlocks(text, titleLineIndex) {
    const lines = text.split('\n')
    const blocks = []
    let current = null

    for (let i = 0; i < lines.length; i++) {
      if (i === titleLineIndex) continue
      const line = lines[i].trim()

      if (!line) {
        if (current) current.lines.push('')
        continue
      }

      if (NOISE_LINES.test(line)) continue

      const header = matchBlock(line)
      if (header) {
        current = { ...header, lines: [] }
        blocks.push(current)
        if (header.type !== 'esquema' && header.type !== 'cenario' && header.type !== 'regra' && header.titulo) {
          current.lines.push(header.titulo)
          current.titulo = ''
        }
        continue
      }

      if (current) current.lines.push(line)
    }

    for (const block of blocks) {
      while (block.lines.length && !block.lines[0]) block.lines.shift()
      while (block.lines.length && !block.lines[block.lines.length - 1]) block.lines.pop()
    }

    return blocks
  }

  /**
   * Converte as linhas de um corpo (cenário, contexto) em bullets.
   */
  function parseBody(bodyLines) {
    const result = []
    const lines = bodyLines.filter(l => l.trim())

    const gherkinLines = new Set()
    lines.forEach((l, i) => { if (GHERKIN_KEYWORDS.test(l)) gherkinLines.add(i) })

    const migrationLines = lines.filter((l, i) => /➔|→/.test(l) && !gherkinLines.has(i))
    const hasMigrationTable = migrationLines.length >= 2
    let migrationHeaderEmitted = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const isMigrationRow = hasMigrationTable && /➔|→/.test(line) && !gherkinLines.has(i)

      if (migrationHeaderEmitted && !isMigrationRow) {
        result.push('')
        migrationHeaderEmitted = false
      }

      if (isTableLine(line)) {
        const tableLines = []
        while (i < lines.length && isTableLine(lines[i].trim())) {
          tableLines.push(lines[i].trim())
          i++
        }
        i--
        result.push('')
        result.push(...renderTable(tableLines).map(escapePlaceholders))
        result.push('')
        continue
      }

      if (/^Obs[.:]/i.test(line)) {
        result.push('')
        result.push(`> **Obs.:** ${escapePlaceholders(line.replace(/^Obs[.:]\s*/i, ''))}`)
        continue
      }

      if (isMigrationRow) {
        if (!migrationHeaderEmitted) {
          result.push('')
          result.push('| Opção antiga | Nova opção |')
          result.push('| --- | --- |')
          migrationHeaderEmitted = true
        }
        const parts = line.split(/➔|→/).map(s => s.trim())
        result.push(`| ${parts[0]} | ${parts[1] || 'Sem alteração'} |`)
        continue
      }

      if (gherkinLines.has(i)) {
        const kw = line.match(GHERKIN_KEYWORDS)[1]
        const rest = line.slice(kw.length).trim()
        result.push(`- **${kw}** ${escapePlaceholders(rest)}`)
        continue
      }

      if (/^[•\-*]\s/.test(line) || /^\d+[.)]\s/.test(line) || /^[a-z][.)]\s/.test(line)) {
        const cleaned = line.replace(/^([•\-*]|\d+[.)]|[a-z][.)])\s*/i, '').trim()
        result.push(`  - ${escapePlaceholders(cleaned)}`)
        continue
      }

      if (/>>/.test(line)) {
        result.push(`- **Caminho:** \`${line}\``)
        continue
      }

      result.push(`- ${escapePlaceholders(line)}`)
    }

    return result.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  function parseObservacoes(bodyLines) {
    return bodyLines
      .filter(l => l.trim())
      .map(l => `- ${escapePlaceholders(l.trim().replace(/^[•\-*]\s*/, '').replace(/;$/, ''))}`)
      .join('\n')
  }

  function extractTitle(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      if (/^#?\s*\d+\s*(\[.*?\])?\s*[-–—]\s*.+/.test(line)) {
        return { title: line.replace(/^#\s*/, '#'), index: i }
      }
    }
    return { title: null, index: -1 }
  }

  function extractTicketNumber(title) {
    if (!title) return null
    const match = title.match(/#?(\d+)/)
    return match ? match[1] : null
  }

  function parse(rawText) {
    const text = rawText.replace(/\r\n?/g, '\n').trim()
    const rawLines = text.split('\n')

    const { title, index: titleIndex } = extractTitle(rawLines)
    const blocks = splitBlocks(text, titleIndex)
    const ticketNumber = extractTicketNumber(title)

    const out = []
    out.push(`# ${title ? (title.startsWith('#') ? title : '#' + title) : '[SEM TÍTULO]'}`)
    out.push('')

    let cenarioCount = 0
    let regraCount = 0
    let dentroDeRegra = false
    let lastScenarioLevel = 2

    const pushRule = () => {
      if (out[out.length - 1] !== '') out.push('')
      out.push('---')
      out.push('')
    }

    for (const block of blocks) {
      switch (block.type) {
        case 'funcionalidade': {
          const body = block.lines.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
          if (!body) break
          out.push('## Funcionalidade')
          out.push('')
          out.push(escapePlaceholders(body))
          pushRule()
          break
        }

        case 'contexto': {
          const body = parseBody(block.lines)
          if (!body) break
          out.push('## Contexto')
          out.push('')
          out.push(body)
          pushRule()
          break
        }

        case 'regra': {
          regraCount++
          dentroDeRegra = true
          lastScenarioLevel = 3
          out.push(`## Regra: ${escapePlaceholders(block.titulo || `Regra ${regraCount}`)}`)
          out.push('')
          const body = parseBody(block.lines)
          if (body) {
            out.push(body)
            out.push('')
          }
          break
        }

        case 'cenario':
        case 'esquema': {
          cenarioCount++
          const level = dentroDeRegra ? '###' : '##'
          lastScenarioLevel = dentroDeRegra ? 3 : 2
          const label = block.type === 'esquema' ? 'Esquema do Cenário' : 'Cenário'
          const numero = block.numero ? ` ${block.numero}` : ''
          const titulo = block.titulo ? `: ${escapePlaceholders(block.titulo)}` : ''
          out.push(`${level} ${label}${numero}${titulo}`)
          out.push('')
          const body = parseBody(block.lines)
          if (body) out.push(body)
          pushRule()
          break
        }

        case 'exemplos': {
          if (out[out.length - 1] === '') out.pop()
          if (out[out.length - 1] === '---') { out.pop(); while (out[out.length - 1] === '') out.pop() }
          out.push('')
          out.push(`${'#'.repeat(lastScenarioLevel + 1)} Exemplos`)
          out.push('')
          const body = parseBody(block.lines)
          if (body) out.push(body)
          pushRule()
          break
        }

        case 'observacoes': {
          const body = parseObservacoes(block.lines)
          if (!body) break
          out.push('## Observações')
          out.push('')
          out.push(body)
          out.push('')
          break
        }
      }
    }

    while (out.length && (out[out.length - 1] === '' || out[out.length - 1] === '---')) out.pop()
    out.push('')

    const markdown = out.join('\n').replace(/\n{3,}/g, '\n\n')

    return {
      markdown,
      ticketNumber,
      title: title || '[SEM TÍTULO]',
      cenarioCount,
      regraCount,
    }
  }

  return { parse }
}
