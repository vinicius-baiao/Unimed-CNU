# Modernização visual do Design System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um `Tokens.html` canônico (paleta atual + escalas nomeadas de tipo/raio/elevação/espaço/motion/foco) no Design System e adotá-lo no Cora como piloto, subindo toda a UI para a escala nova sem mudar layout, fluxo, texto ou dado.

**Architecture:** `Tokens.html` nasce no repo do Design System (`starter-kit/`) e é distribuído por **cópia byte-idêntica** para cada portal (mesmo modelo de `Estilos_Fontes.html`). O Cora inclui o arquivo via `<?!= include('Tokens') ?>`, remove seu bloco `:root` local, e migra o CSS para os tokens de escala. Invariantes (sem `:root` local, sem tipo < 12px, sem `scale()` em `:hover`, cópia idêntica ao DS) são travadas por um teste Node novo. Painéis (PF/GT/Spravato) e o tema escuro ficam fora desta rodada.

**Tech Stack:** Google Apps Script (HtmlService `include`), HTML/CSS/JS vanilla (ES5 no front), testes Node sem dependências (`npm test`, `tests/run.js`), clasp para deploy.

## Global Constraints

- **Dois repositórios.** Design System em `C:\Users\Aurélio\UNIMED - Design System` (branch próprio); Cora em `C:\Users\Aurélio\UNIMED - Gestão de Projetos` (branch `mvp-shadcn-piloto`). Cada tarefa diz em qual repo roda.
- **`Tokens.html` é cópia byte-idêntica** entre DS e Cora (após normalizar CRLF/LF e espaço de fim de linha). A fonte é o DS.
- **Sem CDN/framework** — CSS/JS vanilla puro (regra do DS). Nunca React/Tailwind.
- **Tipografia: mínimo 12px** fora de `@media print`. Escala em tokens `--fs-*`.
- **Sem `transform: scale()` em `:hover`** (hover só cor/borda/sombra/≤1px translate). Keyframes de entrada (modal) podem manter scale.
- **Invariantes do Cora que NÃO mudam:** layout, grid, navegação, textos, dados, mock embutido (bloco final de `tarefas-shadcn.html`), comportamento de `@media print`, nomes de função, classes e ids do markup.
- **Deploy do Cora:** nunca criar implantação nova; sempre `clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8`. O push do Cora passa a listar **8 arquivos** (7 de hoje + `Tokens.html`).
- **Guardrails de subagente (repo Cora):** `git status --short` antes de editar e antes de commitar; `Edit` no arquivo alvo (nunca `Write` em arquivo existente, nunca criar arquivo fora do listado); `git add` só dos arquivos alvo; temporários fora do repo; não tocar em `.claude/`, `.clasp.json`, `.superpowers/`, nem no `settings.local.json`.

---

### Task 1: `Tokens.html` canônico (repo Design System)

**Files:**
- Create: `C:\Users\Aurélio\UNIMED - Design System\starter-kit\Tokens.html`

**Interfaces:**
- Produces: um arquivo `.html` com um único `<style>` contendo só `:root{…}` + um bloco
  `@media (prefers-reduced-motion:reduce)`. Consumido por cópia no Cora (Task 2) e, no futuro, pelos painéis.
  Superset que cobre **todos** os tokens hoje referenciados pelo CSS do Cora e pela doutrina do DS.

- [ ] **Step 1: Criar `starter-kit/Tokens.html` com o conteúdo integral abaixo**

```html
<!-- ============================================================
  Tokens.html — tokens canônicos do Design System Unimed CNU.
  Distribuição por CÓPIA byte-idêntica em cada portal (como Estilos_Fontes),
  incluído no <head> LOGO APÓS Estilos_Fontes e ANTES de ChartJs:
      <?!= include('Estilos_Fontes') ?>
      <?!= include('Tokens') ?>
      <?!= include('ChartJs') ?>
  Nenhum portal define :root próprio: consome tudo daqui via var(--...).
  Fonte da verdade: este arquivo no repo do Design System.
============================================================ -->
<style>
:root{
  /* ── shadcn: superfícies e texto ── */
  --background:#F8F7F4;            /* creme — canvas de todos os portais */
  --card:#FFFFFF; --surface:#FFFFFF; --popover:#FFFFFF;
  --card-foreground:#16302E; --popover-foreground:#16302E;
  --foreground:#16302E;           /* ink */
  --muted-bg:#EFECE4;             /* superfície neutra (segmented, trilhos) */
  --muted:#EFECE4;                /* alias de superfície neutra (= --muted-bg).
                                     Nota: supera o legado do Shell (--muted =
                                     texto); texto muted usa --muted-foreground. */
  --surface-2:#F1EFE9;            /* creme neutro: cabeçalho de tabela, notas */
  --muted-foreground:#6E807D;
  --text-secondary:#4A5F5C;

  /* ── shadcn: marca e ação ── */
  --primary:#004E4C; --primary-hover:#03605D; --primary-foreground:#FFFFFF;
  --secondary:#EFECE4; --secondary-foreground:#16302E;
  --accent:#C9A84C;               /* dourado (assinatura) — não é hover neutro */
  --accent-bg:#FAF4E6; --accent-foreground:#2A2205;
  --accent-ink:#7A5F16;           /* ÚNICO texto dourado sobre fundo claro */
  --accent-active:var(--accent-bg);
  --hover-bg:#EFECE4;             /* hover neutro de itens/botões ghost */
  --destructive:#C4402E; --destructive-foreground:#FFFFFF;

  /* ── shadcn: bordas, foco, raio ── */
  --border:#E7E3DB; --border-hover:#D9D3C7; --input:#E7E3DB;
  --ring:#004E4C;

  /* ── acentos de marca Unimed CNU ── */
  --verde:#00995D; --verde-claro:#0A6B45; --verde-bg:#E4F3EC;
  --dourado:#C9A84C; --dourado-hover:#B8963F; --dourado-bg:#FAF4E6;
  --lima:#B1D34B; --laranja:#F47920;
  --roxo:#6B4FA0; --roxo-bg:#F1ECF6;
  --teal:#3B5D59; --teal-bg:#E7EEEC;
  --grade:#F1EFE9;                /* grade de gráfico (Chart.js DS) */

  /* ── semânticos de estado (prazo/status) ── */
  --ok:#00995D;   --ok-bg:#E4F3EC;   --ok-ink:#0A6B45;
  --warn:#E4761B; --warn-bg:#FBEEDF; --warn-ink:#8A4406;
  --late:#C4402E; --late-bg:#F8E4E0; --late-ink:#8F2417;

  /* ── Status (Kanban do Cora) — paleta da marca, sem azuis ── */
  --col-backlog:#6E807D; --col-afazer:#4A5F5C; --col-andamento:#C9A84C;
  --col-bloqueado:#C4402E; --col-concluido:#00995D;

  /* ── sidebar (rail escura do Shell) ── */
  --sidebar:#004E4C; --sidebar-foreground:#B9CAC7; --sidebar-active:#FFFFFF;
  --sidebar-label:#6E938F; --sidebar-muted:#7C918E;

  /* ══ ESCALAS (modernização 09/2026) ══ */
  /* Tipografia — 12px é o mínimo absoluto */
  --fs-eyebrow:12px;   /* labels caixa-alta, eyebrows, meta, célula densa */
  --fs-sm:13px;        /* texto de apoio */
  --fs-base:14px;      /* corpo */
  --fs-lg:16px;        /* subtítulo, número de card pequeno */
  --fs-title:20px;     /* título de view/seção */
  --fs-display:28px;   /* número de stat */
  --fw-normal:400; --fw-medium:500; --fw-semibold:600; --fw-bold:700;
  --lh-tight:1.2; --lh-base:1.5;
  /* Raio */
  --radius-sm:6px; --radius:10px; --radius-lg:14px; --radius-pill:999px;
  /* Elevação — três níveis */
  --elev-rest:0 1px 2px 0 rgba(0,0,0,.05);
  --elev-hover:0 6px 18px rgba(0,40,38,.07);
  --elev-modal:0 24px 70px rgba(0,30,28,.28);
  /* Espaço — múltiplos de 4 */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-8:32px;
  /* Motion — uma curva, dois tempos; hover nunca com scale */
  --motion-fast:150ms; --motion-med:250ms; --ease:cubic-bezier(.4,0,.2,1);
  /* Foco — anel verde sobre halo do fundo */
  --focus-ring:0 0 0 2px var(--background),0 0 0 4px var(--ring);

  /* ── sombras (aliases das elevações — compat com markup existente) ── */
  --shadow-sm:var(--elev-rest);
  --shadow:0 1px 3px 0 rgba(0,30,28,.08);
  --shadow-hover:var(--elev-hover);
  --shadow-modal:var(--elev-modal);
  --shadow-lg:var(--elev-modal);

  /* ── tipografia (famílias) ── Inter = UI; Slab SÓ na assinatura ── */
  --font:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  --serif:'Unimed Slab',Georgia,'Times New Roman',serif;

  /* ── compat — nomes legados; NÃO usar em código novo ── */
  --bg-app:var(--background); --bg-card:var(--card); --bg-toolbar:var(--surface);
  --canvas:var(--background); --ink:var(--foreground); --hair:var(--border);
  --green-deep:var(--primary); --green-deep-2:var(--primary-hover); --gold:var(--dourado);
  --text-primary:var(--foreground); --text-muted:var(--muted-foreground);
  --cinza-50:#EFECE4; --cinza-100:#E7E3DB; --cinza-200:#D9D3C7;
  --cinza-400:#9AA8A5; --cinza-700:#4A5F5C; --cinza-900:#16302E;
  --erro-bg:var(--late-bg); --erro-cor:var(--late);
  --aviso-bg:var(--warn-bg); --aviso-cor:var(--warn-ink);
  --info-bg:var(--dourado-bg); --info-cor:#8A6D1F;
}
@media (prefers-reduced-motion:reduce){
  :root{ --motion-fast:0ms; --motion-med:0ms; }
}
</style>
```

- [ ] **Step 2: Verificar que o arquivo é CSS válido e cobre os nomes exigidos**

Run (no diretório do DS):
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('starter-kit/Tokens.html','utf8');const css=s.match(/<style>([\s\S]*)<\/style>/)[1];const need=['--background','--primary','--muted','--muted-foreground','--accent-ink','--surface-2','--col-afazer','--erro-cor','--hover-bg','--verde-claro','--dourado-hover','--fs-eyebrow','--fs-display','--radius-sm','--radius-lg','--elev-rest','--elev-modal','--sp-4','--motion-fast','--focus-ring','--shadow-sm','--shadow-modal','--grade','--roxo','--teal','--lima'];const miss=need.filter(n=>!new RegExp(n.replace(/[-]/g,'\\\\-')+'\\\\s*:').test(css));if(miss.length){console.log('FALTAM:',miss);process.exit(1)}if((s.match(/:root\\s*\\{/g)||[]).length!==1){console.log('deve haver exatamente 1 :root');process.exit(1)}console.log('Tokens.html ok:',(css.match(/--[\\w-]+\\s*:/g)||[]).length,'tokens')"
```
Expected: `Tokens.html ok: N tokens` (N ≈ 90), sem `FALTAM`.

- [ ] **Step 3: Commit (repo DS)**

```bash
git add starter-kit/Tokens.html
git commit -m "feat(ds): Tokens.html canônico — paleta atual + escalas (tipo/raio/elevação/espaço/motion/foco)"
```

---

### Task 2: Cora adota `Tokens.html` (include + remoção do `:root` local) + teste de invariantes

**Files:**
- Create: `C:\Users\Aurélio\UNIMED - Gestão de Projetos\Tokens.html` (cópia do DS)
- Create: `tests/test_tokens.js`
- Modify: `tarefas-shadcn.html` (linha 7: include; linhas 13–96: remover bloco `:root`)

**Interfaces:**
- Consumes: `Tokens.html` do DS (Task 1).
- Produces: `include('Tokens')` no head do Cora; `tests/test_tokens.js` com as **4 checagens já ativas**.
  Ao fim desta task, as checagens 1 e 2 (cópia idêntica + sem `:root` local) ficam verdes; as 3 e 4
  (tipo ≥ 12px, sem `scale` em hover) permanecem **falhando de propósito** até a Task 3 as fechar. Por isso,
  nesta task roda-se só `node tests/test_tokens.js` (não o `npm test` agregado, que ficaria vermelho).

- [ ] **Step 1: Copiar o `Tokens.html` do DS para o repo do Cora**

Run (no diretório do Cora):
```bash
cp "C:/Users/Aurélio/UNIMED - Design System/starter-kit/Tokens.html" ./Tokens.html
```

- [ ] **Step 2: Escrever `tests/test_tokens.js`** (as 4 checagens; a #3 e #4 já entram ligadas — vão FALHAR até a Task 3)

```js
// Invariantes visuais do Cora: Tokens.html idêntico ao do DS, sem :root local,
// tipografia >= 12px fora de @media print, sem scale() em :hover.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync('tarefas-shadcn.html', 'utf8');
const norm = s => s.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trimEnd();

// 1. Tokens.html do Cora idêntico ao do DS (conteúdo normalizado)
const DS = 'C:/Users/Aurélio/UNIMED - Design System/starter-kit/Tokens.html';
if (fs.existsSync(DS)) {
  assert.strictEqual(norm(fs.readFileSync('Tokens.html','utf8')), norm(fs.readFileSync(DS,'utf8')),
    'Tokens.html do Cora difere do DS');
} else {
  console.log('  (aviso: DS não encontrado neste ambiente; pulei a comparação 1)');
}

// 2. tarefas-shadcn.html inclui Tokens e NÃO tem :root próprio
assert.ok(/<\?!=\s*include\('Tokens'\)\s*\?>/.test(HTML), 'falta o include de Tokens');
assert.ok(!/:root\s*\{/.test(HTML), 'tarefas-shadcn.html ainda tem um :root local');

// Isola o CSS (só os <style> do arquivo), removendo @media print
const estilos = (HTML.match(/<style>([\s\S]*?)<\/style>/g) || []).join('\n');
const semPrint = estilos.replace(/@media\s+print\s*\{[\s\S]*?\n\s*\}\s*\n/g, '');

// 3. Nenhum font-size < 12px fora de @media print
const fs12 = [];
const reFs = /font-size:\s*([\d.]+)(px|rem)/g; let m;
while ((m = reFs.exec(semPrint))) {
  const px = m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
  if (px < 12) fs12.push(m[0] + ' (' + px.toFixed(1) + 'px)');
}
assert.deepStrictEqual(fs12, [], 'font-size < 12px fora de print: ' + fs12.join(', '));

// 4. Nenhum scale() dentro de uma regra :hover
const hoverScale = [];
const reHover = /:hover[^{]*\{([^}]*)\}/g;
while ((m = reHover.exec(estilos))) { if (/scale\(/.test(m[1])) hoverScale.push(m[0].slice(0,60)); }
assert.deepStrictEqual(hoverScale, [], 'scale() em :hover: ' + hoverScale.join(' | '));

console.log('test_tokens: ok');
```

- [ ] **Step 3: Rodar e ver falhar nas checagens 3 e 4**

Run: `node tests/test_tokens.js` — Expected: FAIL na checagem 3 (font-size < 12px) — ainda não migramos a escala. (As checagens 1 e 2 também falham enquanto o include não estiver no lugar; o próximo passo resolve 1 e 2.)

- [ ] **Step 4: Wire do include e remoção do `:root`** em `tarefas-shadcn.html`

Trocar a linha 7 (o include de fontes) para incluir Tokens logo depois:
```html
  <?!= include('Estilos_Fontes') ?>
  <?!= include('Tokens') ?>
```
E **remover** o bloco `:root { … }` inteiro (linhas 13 a 96, do `:root {` até o `}` que fecha, logo antes de `*, *::before, *::after`). O `<style>` continua; só o `:root` sai. Nada mais no markup muda.

- [ ] **Step 5: Rodar o teste — checagens 1 e 2 verdes; 3 falha (esperado até a Task 3)**

Run: `node tests/test_tokens.js` — Expected: passa em 1 e 2; ainda FALHA em 3 (font-size < 12px). Deixe assim: a Task 3 fecha. **Não** rode `npm test` inteiro ainda (test_tokens quebraria o run agregado); rode só este arquivo.

- [ ] **Step 6: Registrar no `.claspignore`/gate que o push agora é 8 arquivos**

`.claspignore` não precisa mudar (não ignora `.html` da raiz). Apenas confirme que `Tokens.html` está rastreado:
```bash
git add Tokens.html tests/test_tokens.js tarefas-shadcn.html
git status --short
```
Esperado: `Tokens.html`, `tests/test_tokens.js` novos e `tarefas-shadcn.html` modificado.

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor(front): Cora consome Tokens.html do DS via include; remove :root local (+ teste de invariantes)"
```

---

### Task 3: Cora — migração de escala (tipo ≥ 12px, sombras, motion, foco)

**Files:**
- Modify: `tarefas-shadcn.html` (CSS entre a linha do `<style>` e `@media print` ~508; e o keyframe/hover de scale)

**Interfaces:**
- Consumes: tokens de escala de `Tokens.html` (Task 1/2).
- Produces: CSS sem tipo < 12px fora de print e sem `scale()` em `:hover` — faz `tests/test_tokens.js`
  passar por inteiro.

- [ ] **Step 1: Elevar todo `font-size` abaixo de 12px ao piso, preservando a hierarquia**

Mapa de substituição (aplicar em TODO o CSS fora de `@media print`):
| De | Para | px |
|---|---|---|
| `font-size: .6rem` / `.62rem` | `font-size: var(--fs-eyebrow)` | 9.6–9.9 → 12 |
| `font-size: .68rem` | `font-size: var(--fs-eyebrow)` | 10.9 → 12 |
| `font-size: .7rem` / `.72rem` / `.73rem` / `.74rem` | `font-size: var(--fs-eyebrow)` | 11.2–11.8 → 12 |
| `font-size: 9px` / `10px` / `11px` | `font-size: var(--fs-eyebrow)` | → 12 |

Regra: qualquer valor que resolva para < 12px vira `var(--fs-eyebrow)` (12px). Isso inclui variações com/sem
espaço (`font-size:.8rem` e `font-size: .8rem`) — `.8rem` (12.8px) NÃO entra, fica. Faça a troca por
correspondência exata do valor, não regex ampla, para não pegar `.875rem`.

- [ ] **Step 2: (opcional, mesma task) nomear a escala nos tamanhos ≥ 12px dos componentes tocados**

Onde já estiver editando (stat cards, tabelas, cabeçalhos de seção, barra de filtros), troque o valor por token:
`.75rem`/`12px`→`var(--fs-eyebrow)`; `.8rem`/`.82rem`/`13px`→`var(--fs-sm)`; `.875rem`/`14px`→`var(--fs-base)`;
`1rem`/`16px`→`var(--fs-lg)`; `1.15rem`/`1.2rem`/`19.2px`/`21px`→`var(--fs-title)`; `1.6rem`/`1.9rem`/`25.6px`/
`30.4px`→`var(--fs-display)`. **Fora** desses componentes, tamanhos ≥ 12px podem ficar como estão (evita
sweep de 100+ edições num arquivo vivo). Não é obrigatório para o teste passar; faça o que for barato.

- [ ] **Step 3: Colapsar sombras nas três elevações**

As sombras já viram alias no `Tokens.html` (`--shadow-sm`=rest, `--shadow-hover`=hover, `--shadow-modal`/`--shadow-lg`=modal).
No CSS do Cora, qualquer `box-shadow` hardcoded que replique uma dessas troca por `var(--elev-rest|hover|modal)`.
Sombras de foco (`0 0 0 Npx …`) NÃO entram aqui (viram `--focus-ring` no Step 5).

- [ ] **Step 4: Remover o `scale()` do hover do swatch (linha ~436)**

Trocar:
```css
.proj-color-swatch:hover { transform: scale(1.12); }
```
por (realce sem escala):
```css
.proj-color-swatch:hover { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--border-hover); }
```
O `scale` do keyframe `modalIn` (linha ~361) é animação de ENTRADA, não `:hover` — **mantém**.

- [ ] **Step 5: Foco visível tokenizado**

Onde houver foco de teclado sem anel claro, usar `--focus-ring`. Mínimo:
```css
.side .nav a:focus-visible,
.tarefas-table tbody tr:focus-visible,
.ind-tabela tbody tr[data-email]:focus-visible,
.ac-tabela select:focus-visible,
.ac-tabela input:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```
Os botões (`.btn:focus-visible`) já têm anel equivalente; alinhe o valor a `var(--focus-ring)` se for trivial.

- [ ] **Step 6: Rodar o teste — tudo verde**

Run: `node tests/test_tokens.js` → `test_tokens: ok`. Depois `npm test` → **10 arquivos verdes**.

- [ ] **Step 7: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "style(front): Cora sobe para a escala do DS — tipo >= 12px, três elevações, foco visível, sem scale em hover"
```

---

### Task 4: Cora — componentes do Spravato (stat card semântico, filtros fixos, cabeçalho de seção, tabela única)

**Files:**
- Modify: `tarefas-shadcn.html` (CSS de `.home-stat-card`, `.ind-totais`, `#indFiltros`, `.tarefas-table`)

**Interfaces:**
- Consumes: tokens de escala.
- Produces: mudança puramente visual (CSS), sem alterar markup/JS. Verificação por preview (sem teste unitário).

- [ ] **Step 1: Stat card com barra por significado (não por posição)**

Nos Indicadores, hoje `.home-stat-card` tem cor por `nth-child` no `#homePainel`. Garanta que os cards de
estado (a-fazer/andamento/bloqueado/atrasado) usem a borda-esquerda pela **classe semântica** que já existe
(`.home-stat-card.alert`=late, `.home-stat-card.warn`=warn). Onde um card representa um estado do Kanban, a
`border-left-color` vem do `--col-*` correspondente, não da posição. Não invente classe nova; use as
existentes (`.alert`, `.warn`) e os `--col-*`.

- [ ] **Step 2: Barra de filtros dos Indicadores fixa (sticky translúcida)**

Trocar o bloco de `#indFiltros` para grudar no topo ao rolar, no padrão `.fbar` do Spravato:
```css
    #indFiltros {
      position: sticky; top: 0; z-index: 30;
      background: color-mix(in srgb, var(--background) 94%, transparent);
      -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
      border: 1px solid var(--border); border-radius: var(--radius);
      padding: 10px 14px; box-shadow: var(--elev-rest);
    }
```
(Se `color-mix` preocupar em compatibilidade, usar `rgba(248,247,244,.94)` — o creme `--background`.)
Mantém os selects atuais; só a moldura muda. **Chips do filtro ativo ficam fora desta rodada** (não bloqueia).

- [ ] **Step 3: Cabeçalho de seção alinhado à receita (título + descrição)**

Home/Indicadores/Acessos já têm `.home-section-title`/`.home-subline`/`.ind-head`. Alinhe tamanhos aos tokens:
título `var(--fs-title)`, descrição `var(--fs-sm)` em `--muted-foreground`. Sem mudar a estrutura.

- [ ] **Step 4: Receita única de tabela**

Aproximar `.tarefas-table` de `.ind-tabela`: `th` em `var(--fs-eyebrow)` caixa-alta `--muted-foreground`;
`td` em `var(--fs-sm)`/`var(--fs-base)`; `tr:hover` fundo `var(--muted-bg)`. `.ind-tabela` e `.ac-tabela` já
seguem isso; só encoste `.tarefas-table` na mesma régua. Não mexer em colunas nem em ordenação.

- [ ] **Step 5: Verificar no preview local (todas as telas)**

```bash
npx serve -p 3000 .
```
No preview: Home, Kanban, Lista, Indicadores, Acessos + um modal. Conferir: tipografia legível, foco visível
ao tabular, hover sem "pulo" de escala, filtros dos Indicadores grudam ao rolar, tabelas homogêneas, console
sem erro. `npm test` continua verde.

- [ ] **Step 6: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "style(front): Cora adota componentes do Spravato — stat card semântico, filtros fixos, tabela única"
```

---

### Task 5: Doutrina e guia visual do Design System (repo DS)

**Files:**
- Modify: `CLAUDE.md` (§1 tokens; §2 tipografia; §7 arquitetura — registrar `Tokens.html`)
- Modify: `starter-kit/LEIA-ME.md` e `README.md` (tabela de arquivos + "como criar portal")
- Modify: `guia-referencia-visual.html` (nova seção "Escalas")

**Interfaces:**
- Consumes: `Tokens.html` (Task 1).
- Produces: documentação alinhada. Sem código executável; verificação por leitura.

- [ ] **Step 1: `CLAUDE.md`**

- §1: acrescentar subseção "Escalas" descrevendo `--fs-*` (mín. 12px), `--radius-*`, `--elev-*` (três níveis),
  `--sp-*`, `--motion-*`/`--ease`, `--focus-ring`, e a regra "hover nunca com `scale`".
- §2: trocar "labels 11–12px" por "**mínimo 12px; use `--fs-*`**".
- §1/§7: registrar `Tokens.html` como o 1º include depois de `Estilos_Fontes` (fonte única dos tokens; cada
  portal recebe cópia byte-idêntica; nenhum portal define `:root`).

- [ ] **Step 2: `starter-kit/LEIA-ME.md` e `README.md`**

Adicionar `Tokens.html` na tabela de arquivos ("tokens canônicos — paleta + escalas; cópia byte-idêntica, não
editar no portal") e no passo "como criar portal" (incluir logo após as fontes).

- [ ] **Step 3: `guia-referencia-visual.html` — seção "Escalas"**

Nova `<h2>` "Escalas" com amostras: os 6 tamanhos `--fs-*` (com o px ao lado), os raios, as 3 elevações, a
grade de espaço 4–32 e um campo com o anel de foco. Ajustar o texto da seção 2 (Tipografia) para "mínimo 12px".
O guia é offline (fallback de fonte) — não incluir `Tokens.html`; declarar os `--fs-*` no `:root` do próprio guia.

- [ ] **Step 4: Commit (repo DS)**

```bash
git add CLAUDE.md README.md starter-kit/LEIA-ME.md guia-referencia-visual.html
git commit -m "docs(ds): escalas (tipo/raio/elevação/espaço/motion/foco) na doutrina e no guia; registra Tokens.html"
```

---

### Task 6 (orquestrador): revisão final, publicação e docs do Cora

- [ ] Revisão final (opus) do diff do Cora (Tasks 2–4) e do `Tokens.html`: sem regressão de layout, tokens
  cobrindo todo `var(--…)` referenciado, invariantes do teste corretas. Uma onda de correções se preciso.
- [ ] `npm test` verde (10 arquivos). Preview local das 5 telas + modal, com screenshots de antes/depois.
- [ ] `clasp push` no Cora (gate: **8 arquivos** — os 7 de hoje + `Tokens.html`) →
  `clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8` (@71).
- [ ] Verificar em produção (JSONP `bootstrap` ok + screenshot da Home/Indicadores após hard reload; o painel
  vive em iframe, então cliques podem não registrar pela automação — screenshot basta).
- [ ] `docs/HANDOFF.md` (bloco @71) e `CLAUDE.md` do Cora (registrar o include `Tokens`); commit.
- [ ] Deixar registrado no HANDOFF: PF/GT/Spravato adotam o `Tokens.html` (trocar `:root` pelo include) no
  próximo deploy de cada um — fora desta rodada.
