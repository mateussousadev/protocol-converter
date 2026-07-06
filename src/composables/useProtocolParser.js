/**
 * useProtocolParser
 * Converte texto bruto de protocolo no padrão interno para Markdown formatado.
 */

export function useProtocolParser() {

  /**
   * Extrai o título principal do protocolo (linha que começa com #NNNN ou similar)
   */
  function extractTitle(text) {
    const match = text.match(/^(#?\d+\s*\[.*?\]\s*-\s*.+)/m)
    return match ? match[1].trim() : null
  }

  /**
   * Extrai a seção de "Funcionalidade"
   */
  function extractFuncionalidade(text) {
    const match = text.match(/Funcionalidade[:\s]*\n?([\s\S]*?)(?=\nContexto[:\s]|\nCenário\s*1[:\s]|\nObservações[:\s]|$)/i)
    if (!match) return null
    return match[1]
      .replace(/^[\s\u2022\-*]+/gm, '')
      .trim()
  }

  /**
   * Extrai o bloco de "Contexto"
   */
  function extractContexto(text) {
    const match = text.match(/Contexto[:\s]*\n([\s\S]*?)(?=\nCenário\s*1[:\s]|$)/i)
    if (!match) return null
    return match[1].trim()
  }

  /**
   * Extrai todos os cenários como array de { numero, titulo, corpo }
   */
  function extractCenarios(text) {
    const cenarioRegex = /Cenário\s*(\d+)[:\s]+([^\n]+)\n([\s\S]*?)(?=\nCenário\s*\d+[:\s]|\nObservações[:\s]|$)/gi
    const cenarios = []
    let match

    while ((match = cenarioRegex.exec(text)) !== null) {
      cenarios.push({
        numero: parseInt(match[1]),
        titulo: match[2].trim(),
        corpo: match[3].trim(),
      })
    }

    return cenarios
  }

  /**
   * Extrai o bloco de "Observações"
   */
  function extractObservacoes(text) {
    const match = text.match(/Observações[:\s]*\n([\s\S]*?)$/i)
    if (!match) return null
    return match[1].trim()
  }

  /**
   * Converte linhas de um corpo de cenário em bullets Gherkin.
   * Linhas que começam com Dado/Quando/Então/E/Mas viram negrito.
   * Listas com *, -, ou números viram sub-bullets.
   * Linhas de observação (Obs:) viram blockquote.
   */
  function parseCenarioBody(corpo) {
    const lines = corpo.split('\n')
    const result = []
    const gherkinKeywords = /^(Dado que|Dado|Quando|Então|E que|E|Mas|Se o|Se)\s/i

    // Detectar se há tabela implícita (linhas "X ➔ Y" ou "X → Y")
    const tableLines = lines.filter(l => /➔|→/.test(l))
    const hasTable = tableLines.length >= 2

    let tableEmitted = false

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const line = raw.trim()

      if (!line) continue

      // Obs: vira blockquote
      if (/^Obs[.:]/.test(line)) {
        result.push(`\n> **Obs.:** ${line.replace(/^Obs[.:]\s*/i, '')}`)
        continue
      }

      // Tabela de migração (X ➔ Y)
      if (/➔|→/.test(line) && hasTable) {
        if (!tableEmitted) {
          // emitir cabeçalho da tabela antes da primeira linha
          result.push('\n| Opção antiga | Nova opção |')
          result.push('|---|---|')
          tableEmitted = true
        }
        const parts = line.split(/➔|→/).map(s => s.trim())
        result.push(`| ${parts[0]} | ${parts[1] || 'Sem alteração'} |`)
        continue
      }

      // Keyword Gherkin
      if (gherkinKeywords.test(line)) {
        // Detectar keyword
        const kwMatch = line.match(/^(Dado que|Dado|Quando|Então|E que|E|Mas|Se o|Se)\s/i)
        const kw = kwMatch ? kwMatch[1] : ''
        const rest = line.slice(kw.length).trim()
        result.push(`- **${kw}** ${rest}`)
        continue
      }

      // Sub-itens de lista (*, -, números, letras minúsculas seguidas de ponto)
      if (/^[\u2022\-*]/.test(line) || /^\d+[.)]\s/.test(line) || /^[a-z]\)\s/.test(line)) {
        const cleaned = line.replace(/^[\u2022\-*\d+.)a-z)]\s*/i, '').trim()
        result.push(`  - ${cleaned}`)
        continue
      }

      // Caminho de navegação (>> separador)
      if (/>>/.test(line)) {
        result.push(`- **Caminho:** \`${line}\``)
        continue
      }

      // Linha de texto normal dentro do cenário
      result.push(`- ${line}`)
    }

    return result.join('\n')
  }

  /**
   * Processa o contexto em bullets "Dado/E que..."
   */
  function parseContexto(contexto) {
    if (!contexto) return null
    const lines = contexto.split('\n').map(l => l.trim()).filter(Boolean)
    return lines.map(line => {
      const gherkin = line.match(/^(Dado que|Dado|Quando|E que|E|Então)\s/i)
      if (gherkin) {
        const kw = gherkin[1]
        const rest = line.slice(kw.length).trim()
        return `${kw} ${rest}`
      }
      return line
    }).join(', ')
  }

  /**
   * Processa observações em lista de bullets
   */
  function parseObservacoes(obs) {
    if (!obs) return ''
    const lines = obs.split('\n').map(l => l.trim()).filter(Boolean)
    return lines.map(l => {
      const cleaned = l.replace(/^[\u2022\-*]\s*/, '')
      return `- ${cleaned}`
    }).join('\n')
  }

  /**
   * Detecta o número do ticket a partir do título (#NNNN)
   */
  function extractTicketNumber(title) {
    if (!title) return null
    const match = title.match(/#(\d+)/)
    return match ? match[1] : null
  }

  /**
   * Função principal: recebe texto bruto, retorna markdown formatado
   */
  function parse(rawText) {
    const text = rawText.trim()

    const title = extractTitle(text)
    const funcionalidade = extractFuncionalidade(text)
    const contexto = extractContexto(text)
    const cenarios = extractCenarios(text)
    const observacoes = extractObservacoes(text)
    const ticketNumber = extractTicketNumber(title)

    const lines = []

    // Título
    if (title) {
      lines.push(`# ${title.startsWith('#') ? title : '#' + title}`)
    } else {
      lines.push(`# [SEM TÍTULO]`)
    }

    lines.push('')

    // Funcionalidade
    if (funcionalidade) {
      lines.push(`## Funcionalidade`)
      lines.push('')
      lines.push(funcionalidade.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
      lines.push('')
      lines.push('---')
      lines.push('')
    }

    // Contexto
    if (contexto) {
      lines.push(`## Contexto`)
      lines.push('')
      const ctxLines = contexto.split('\n').map(l => l.trim()).filter(Boolean)
      lines.push(ctxLines.join(' ').trim())
      lines.push('')
      lines.push('---')
      lines.push('')
    }

    // Cenários
    if (cenarios.length > 0) {
      lines.push(`## Cenários`)
      lines.push('')

      for (const cenario of cenarios) {
        lines.push(`### Cenário ${cenario.numero}: ${cenario.titulo}`)
        lines.push('')
        lines.push(parseCenarioBody(cenario.corpo))
        lines.push('')
        lines.push('---')
        lines.push('')
      }
    }

    // Observações
    if (observacoes) {
      lines.push(`## Observações`)
      lines.push('')
      lines.push(parseObservacoes(observacoes))
      lines.push('')
    }

    return {
      markdown: lines.join('\n'),
      ticketNumber,
      title: title || '[SEM TÍTULO]',
      cenarioCount: cenarios.length,
    }
  }

  return { parse }
}
