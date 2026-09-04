<template>
  <div class="app-layout">
    <!-- Header -->
    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <span class="brand-icon">⬡</span>
          <span class="brand-name">Protocol<em>MD</em></span>
        </div>
        <p class="brand-tagline">Conversor de protocolos para Markdown</p>
      </div>
    </header>

    <!-- Main -->
    <main class="app-main">
      <div class="panels">

        <!-- Painel esquerdo: input -->
        <section class="panel panel--input">
          <div class="panel-header">
            <h2 class="panel-title">Texto do protocolo</h2>
            <button
              v-if="rawInput"
              class="btn btn--ghost btn--sm"
              id="btn-clear-input"
              @click="clearInput"
            >
              Limpar
            </button>
          </div>

          <textarea
            id="textarea-protocol-input"
            v-model="rawInput"
            class="protocol-textarea"
            placeholder="Cole aqui o texto bruto do protocolo...

Exemplo:
#7003 [PHB] - ATUALIZAR MÓDULO DE TURMAS
Funcionalidade: ...
Contexto: ...

Regra: Permissões no módulo Turmas
Cenário: Visualizar turmas
  Dado que...
  Quando...
  Então...

Esquema do Cenário: Criar usuário
  Quando criar um usuário do tipo &quot;&lt;tipo&gt;&quot;
Exemplos:
| tipo |
| Diretor |"
            spellcheck="false"
            @input="onInput"
          />

          <div class="panel-footer">
            <span class="char-count" :class="{ 'char-count--active': rawInput.length > 0 }">
              {{ rawInput.length.toLocaleString('pt-BR') }} caracteres
            </span>
            <button
              id="btn-convert"
              class="btn btn--primary"
              :disabled="!rawInput.trim()"
              @click="convert"
            >
              Converter →
            </button>
          </div>
        </section>

        <!-- Divisor -->
        <div class="panel-divider" aria-hidden="true">
          <div class="divider-line" />
          <div class="divider-badge" :class="{ 'divider-badge--ready': result }">
            <span v-if="!result">MD</span>
            <span v-else>✓</span>
          </div>
          <div class="divider-line" />
        </div>

        <!-- Painel direito: output -->
        <section class="panel panel--output" :class="{ 'panel--empty': !result }">
          <div class="panel-header">
            <h2 class="panel-title">
              Markdown gerado
              <span v-if="result" class="result-meta">
                <template v-if="result.regraCount">
                  · {{ result.regraCount }} regra{{ result.regraCount !== 1 ? 's' : '' }}
                </template>
                · {{ result.cenarioCount }} cenário{{ result.cenarioCount !== 1 ? 's' : '' }}
              </span>
            </h2>
            <div v-if="result" class="output-actions">
              <button
                id="btn-copy"
                class="btn btn--ghost btn--sm"
                @click="copyMarkdown"
              >
                {{ copied ? '✓ Copiado' : 'Copiar' }}
              </button>
              <button
                id="btn-download"
                class="btn btn--primary btn--sm"
                @click="downloadMarkdown"
              >
                ↓ Baixar .md
              </button>
            </div>
          </div>

          <div v-if="!result" class="output-empty">
            <div class="empty-icon">◻</div>
            <p>O markdown aparecerá aqui após a conversão</p>
          </div>

          <div v-else class="output-wrapper">
            <pre
              id="pre-markdown-output"
              class="markdown-output"
              ref="outputRef"
            >{{ result.markdown }}</pre>
          </div>

          <div v-if="result" class="panel-footer panel-footer--output">
            <span class="filename-preview" id="span-filename">
              {{ filename }}
            </span>
          </div>
        </section>

      </div>
    </main>

    <!-- Toast -->
    <transition name="toast">
      <div v-if="toast.visible" class="toast" :class="`toast--${toast.type}`" role="alert">
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useProtocolParser } from '../composables/useProtocolParser.js'

const { parse } = useProtocolParser()

const rawInput = ref('')
const result = ref(null)
const copied = ref(false)
const outputRef = ref(null)

const toast = ref({ visible: false, message: '', type: 'success' })

// Nome sugerido para o arquivo
const filename = computed(() => {
  if (!result.value) return ''
  const num = result.value.ticketNumber
  const titleSlug = result.value.title
    .toLowerCase()
    .replace(/^#?\d+\s*\[.*?\]\s*-\s*/i, '')
    .replace(/[^a-záéíóúãõâêôàç\s]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
  return num ? `${num}-${titleSlug}.md` : `${titleSlug}.md`
})

function onInput() {
  // Auto-convert se já tinha resultado (live update)
  if (result.value) convert()
}

function convert() {
  if (!rawInput.value.trim()) return
  result.value = parse(rawInput.value)
}

function clearInput() {
  rawInput.value = ''
  result.value = null
  copied.value = false
}

async function copyMarkdown() {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(result.value.markdown)
    copied.value = true
    showToast('Markdown copiado!', 'success')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    showToast('Não foi possível copiar. Selecione e copie manualmente.', 'error')
  }
}

function downloadMarkdown() {
  if (!result.value) return
  const blob = new Blob([result.value.markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.value
  a.click()
  URL.revokeObjectURL(url)
  showToast(`Arquivo "${filename.value}" baixado!`, 'success')
}

function showToast(message, type = 'success') {
  toast.value = { visible: true, message, type }
  setTimeout(() => { toast.value.visible = false }, 3000)
}
</script>

<style>
/* ── Reset & base ─────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:          #0f1117;
  --surface:     #181c27;
  --surface-2:   #1e2333;
  --border:      #2a3045;
  --border-soft: #222840;
  --accent:      #5b7fff;
  --accent-dim:  #3a52cc;
  --accent-glow: rgba(91,127,255,.18);
  --success:     #34d399;
  --error:       #f87171;
  --text:        #e2e8f0;
  --text-muted:  #64748b;
  --text-dim:    #94a3b8;
  --mono:        'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  --sans:        'Inter', 'Segoe UI', system-ui, sans-serif;
  --radius:      10px;
  --radius-sm:   6px;
}

html, body { height: 100%; }

body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ── Layout ───────────────────────────────────────────── */
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  padding: 0 2rem;
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  height: 56px;
}

.brand {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -.01em;
  color: var(--text);
}

.brand-icon {
  color: var(--accent);
  font-size: 1.2rem;
}

.brand em {
  font-style: normal;
  color: var(--accent);
}

.brand-tagline {
  color: var(--text-muted);
  font-size: .8rem;
  border-left: 1px solid var(--border);
  padding-left: 1.5rem;
}

.app-main {
  flex: 1;
  padding: 1.5rem 2rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

/* ── Panels ───────────────────────────────────────────── */
.panels {
  display: grid;
  grid-template-columns: 1fr 40px 1fr;
  gap: 0;
  height: calc(100vh - 56px - 3.5rem);
  min-height: 500px;
}

.panel {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.panel--input  { border-radius: var(--radius) 0 0 var(--radius); border-right: none; }
.panel--output { border-radius: 0 var(--radius) var(--radius) 0; border-left: none; }

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .75rem 1.25rem;
  border-bottom: 1px solid var(--border-soft);
  background: var(--surface-2);
  flex-shrink: 0;
}

.panel-title {
  font-size: .8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-muted);
}

.result-meta {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--accent);
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .75rem 1.25rem;
  border-top: 1px solid var(--border-soft);
  background: var(--surface-2);
  flex-shrink: 0;
}

.panel-footer--output {
  justify-content: flex-start;
}

.output-actions {
  display: flex;
  gap: .5rem;
}

/* ── Divider ──────────────────────────────────────────── */
.panel-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  padding: 0 4px;
}

.divider-line {
  flex: 1;
  width: 1px;
  background: var(--border);
}

.divider-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .65rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: .04em;
  transition: all .3s;
}

.divider-badge--ready {
  border-color: var(--accent);
  background: var(--accent-glow);
  color: var(--accent);
}

/* ── Textarea ─────────────────────────────────────────── */
.protocol-textarea {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-family: var(--mono);
  font-size: .82rem;
  line-height: 1.65;
  padding: 1.1rem 1.25rem;
  caret-color: var(--accent);
}

.protocol-textarea::placeholder {
  color: var(--text-muted);
  opacity: .6;
}

/* ── Output ───────────────────────────────────────────── */
.output-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-muted);
  opacity: .5;
}

.empty-icon {
  font-size: 2.5rem;
}

.output-wrapper {
  flex: 1;
  overflow: auto;
}

.markdown-output {
  font-family: var(--mono);
  font-size: .82rem;
  line-height: 1.65;
  padding: 1.1rem 1.25rem;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-dim);
}

.filename-preview {
  font-family: var(--mono);
  font-size: .75rem;
  color: var(--text-muted);
}

/* ── Char count ───────────────────────────────────────── */
.char-count {
  font-size: .75rem;
  color: var(--text-muted);
  transition: color .2s;
}

.char-count--active {
  color: var(--text-dim);
}

/* ── Buttons ──────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--sans);
  font-weight: 600;
  transition: background .15s, opacity .15s, transform .1s;
  white-space: nowrap;
}

.btn:active { transform: scale(.97); }
.btn:disabled { opacity: .35; cursor: not-allowed; pointer-events: none; }

.btn--primary {
  background: var(--accent);
  color: #fff;
  padding: .5rem 1.1rem;
  font-size: .82rem;
}

.btn--primary:hover { background: var(--accent-dim); }

.btn--ghost {
  background: transparent;
  color: var(--text-dim);
  padding: .45rem .9rem;
  font-size: .8rem;
  border: 1px solid var(--border);
}

.btn--ghost:hover {
  background: var(--surface-2);
  color: var(--text);
}

.btn--sm {
  padding: .3rem .75rem;
  font-size: .78rem;
}

/* ── Toast ────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  padding: .6rem 1.4rem;
  border-radius: 999px;
  font-size: .82rem;
  font-weight: 600;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0,0,0,.4);
}

.toast--success {
  background: var(--success);
  color: #0f2b1f;
}

.toast--error {
  background: var(--error);
  color: #2b0f0f;
}

.toast-enter-active, .toast-leave-active { transition: all .25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* ── Scrollbar ────────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* ── Responsive ───────────────────────────────────────── */
@media (max-width: 900px) {
  .panels {
    grid-template-columns: 1fr;
    grid-template-rows: auto 40px auto;
    height: auto;
  }

  .panel-divider {
    flex-direction: row;
    height: 40px;
    padding: 4px 0;
  }

  .divider-line { flex: 1; height: 1px; width: auto; }

  .panel--input  { border-radius: var(--radius) var(--radius) 0 0; border-right: 1px solid var(--border); border-bottom: none; }
  .panel--output { border-radius: 0 0 var(--radius) var(--radius); border-left: 1px solid var(--border); border-top: none; }

  .protocol-textarea { min-height: 300px; }
  .output-wrapper { min-height: 300px; }

  .app-main { padding: 1rem; }
  .brand-tagline { display: none; }
}
</style>
