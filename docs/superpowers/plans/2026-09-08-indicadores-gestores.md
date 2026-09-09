# Indicadores para gestores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma aba "Indicadores" no Cora, só para Gestor/Admin, com carga e gargalos por pessoa e saúde dos projetos, calculada no front com os dados do `bootstrap`.

**Architecture:** Uma função pura `calcularIndicadores(dados, filtros, hoje, deps)` (ES5, entre marcadores no `<script>` de `tarefas-shadcn.html`) devolve pessoas, "sem responsável", projetos e totais; um teste Node extrai o trecho pelo marcador e valida as regras. A renderização (`renderIndicadores`) só desenha: filtros, 4 totais, tabela ordenável de pessoas e grid de cards de projetos, com cliques que reaproveitam os filtros da aba Tarefas. Nada muda no backend.

**Tech Stack:** HTML/CSS/JS vanilla ES5 inline (`tarefas-shadcn.html`), testes Node sem dependências (`tests/run.js` roda todo `tests/test_*.js`), Apps Script Web App, `clasp`.

**Spec:** `docs/superpowers/specs/2026-09-08-indicadores-gestores-design.md`

## Global Constraints

- Só `tarefas-shadcn.html` muda de código de app; único arquivo novo: `tests/test_indicadores_front.js`. Nenhuma alteração em `Code.gs`, rotas ou planilha.
- JS estilo ES5 no HTML: `var`, `function`, sem arrow functions, sem template strings, sem `const/let`. (Nos testes Node pode usar ES2015+, como os testes existentes.)
- Todo texto de dado injetado em `innerHTML` passa por `esc()`; cores de projeto só via `corDoProjeto(nome)` (já valida).
- `calcularIndicadores` é **pura**: sem DOM, sem globais; recebe `dados = {tarefas, cklStatus, usuarios, projetos}`, `filtros = {unidade, projeto, janelaDias}`, `hoje` (Date) e `deps = {parseData, dataValida, nomeDeEmail}`. Fica entre `/* @indicadores:inicio */` e `/* @indicadores:fim */`.
- Regras (spec §3): `ativa` = `Status !== 'Concluído'`; `atrasada` = ativa e prazo válido `< hoje` (dia); `proxima` = ativa e `hoje <= prazo <= hoje + janelaDias`; `bloqueada` = ativa e `Status === 'Bloqueado'`; `andamento` = ativa e `Status === 'Em andamento'`. Filtro de projeto restringe as duas seções; filtro de unidade só a lista de pessoas (e suprime "Sem responsável").
- Textos de UI em português, literais deste plano.
- Acesso: item da rail e a view só para `currentUserPodeExcluir`; `setModo('indicadores')` sem permissão cai em `home`.
- `npm test` verde antes de todo `clasp push`. Publicação só na Task 5, com `clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8` (nunca sem `-i`).
- Preview local: `npx serve -p 3000 .` → `http://localhost:3000/tarefas-shadcn.html` (mock embutido; para virar Gestor no console: `currentUserPodeExcluir = true; renderUserBadge(); setModo('indicadores');`).

---

### Task 1: `calcularIndicadores` (função pura) + teste Node

**Files:**
- Create: `tests/test_indicadores_front.js`
- Modify: `tarefas-shadcn.html` — inserir a função logo **antes** de `function parseData(val)` (≈ linha 2440)

**Interfaces:**
- Produces: `calcularIndicadores(dados, filtros, hoje, deps)` → `{ pessoas: Pessoa[], semResponsavel: Pessoa|null, projetos: Projeto[], totais: {ativas, atrasadas, bloqueadas, proximas} }`.
  `Pessoa = {email, nome, cargo, unidade, ativas, andamento, bloqueadas, atrasadas, proximas, itensPendentes, concluidas}`.
  `Projeto = {nome, cor, publico, total, concluidas, pct, andamento, bloqueadas, atrasadas, proximas, cklTotal, cklFeitos}`.
  Ordenações: pessoas por `atrasadas` desc, `ativas` desc, `nome` asc; projetos por `atrasadas` desc, `bloqueadas` desc, `pct` asc, `nome` asc.

- [ ] **Step 1: Escrever o teste (falha porque a função não existe)**

Criar `tests/test_indicadores_front.js`:
```js
// Testa calcularIndicadores() do front: extrai o trecho entre os marcadores
// /* @indicadores:inicio */ ... /* @indicadores:fim */ de tarefas-shadcn.html e roda num vm.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'tarefas-shadcn.html'), 'utf8');
const ini = html.indexOf('/* @indicadores:inicio */'), fim = html.indexOf('/* @indicadores:fim */');
assert.ok(ini > -1 && fim > ini, 'marcadores @indicadores não encontrados em tarefas-shadcn.html');
const ctx = vm.createContext({});
vm.runInContext(html.slice(ini, fim), ctx, { filename: 'indicadores.js' });
const calcular = ctx.calcularIndicadores;
assert.strictEqual(typeof calcular, 'function', 'calcularIndicadores deve existir no trecho marcado');

// deps iguais às do front
function parseData(v) { if (v instanceof Date) return v; const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); return new Date(v); }
function dataValida(v) { if (!v) return false; const d = parseData(v); return !isNaN(d.getTime()) && d.getFullYear() >= 2000; }
function nomeDeEmail(e) { const l = String(e || '').split('@')[0]; if (!l) return ''; return l.split(/[._-]+/).filter(p => p && p.toLowerCase() !== 'ext').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' '); }
const deps = { parseData, dataValida, nomeDeEmail };
const HOJE = new Date(2026, 8, 8); // 08/09/2026

const ANA = 'ana@x.test', BRU = 'bruno@x.test', ZECA = 'zeca.ninguem@x.test';
const usuarios = [
  { nome: 'Ana Souza',  email: ANA, perfil: 'Gestor',         unidade: 'Rede', cargo: 'Coordenadora' },
  { nome: 'Bruno Lima', email: BRU, perfil: 'Usuário Padrão', unidade: 'Onco', cargo: 'Analista' }
];
const T = (id, proj, resp, prazo, status) => ({ ID: id, Tarefa: 't' + id, Projeto: proj, 'Responsável': resp, Prazo: prazo, Status: status, Prioridade: 'Média' });
const tarefas = [
  T(1, 'P1', ANA,  '2026-09-01', 'Em andamento'), // atrasada + em andamento
  T(2, 'P1', ANA,  '2026-09-10', 'A fazer'),      // próxima (dentro de 7 dias)
  T(3, 'P1', BRU,  '2026-09-30', 'Bloqueado'),    // bloqueada; próxima só com janela 30
  T(4, 'P2', ANA,  '2026-08-01', 'Concluído'),    // concluída: nunca atrasada/próxima
  T(5, 'P2', '',   '2026-09-05', 'Backlog'),      // sem responsável, atrasada
  T(6, 'P2', ZECA, '',           'A fazer')       // sem prazo; pessoa fora da aba Usuários
];
const cklStatus = {
  '1': [{ Responsavel: BRU, 'Concluído': false }, { Responsavel: BRU, 'Concluído': true }],
  '3': [{ Responsavel: '',  'Concluído': false }],
  '4': [{ Responsavel: BRU, 'Concluído': false }] // tarefa concluída: não conta
};
const projetos = [
  { id: 1, nome: 'P1', cor: '#111111', publico: false },
  { id: 2, nome: 'P2', cor: '#222222', publico: true },
  { id: 3, nome: 'P3', cor: '#333333', publico: false } // sem tarefas: aparece com zeros
];
const dados = { tarefas, cklStatus, usuarios, projetos };
const por = (lista, nome) => lista.filter(x => x.nome === nome)[0];

// 1. contagens por pessoa, sem filtros, janela 7
{
  const r = calcular(dados, { unidade: '', projeto: '', janelaDias: 7 }, HOJE, deps);
  assert.deepStrictEqual(r.pessoas.map(p => p.nome), ['Ana Souza', 'Bruno Lima', 'Zeca Ninguem'], 'ordem: atrasadas desc, ativas desc, nome asc');
  const ana = por(r.pessoas, 'Ana Souza');
  assert.deepStrictEqual({ ativas: ana.ativas, andamento: ana.andamento, bloqueadas: ana.bloqueadas, atrasadas: ana.atrasadas, proximas: ana.proximas, itensPendentes: ana.itensPendentes, concluidas: ana.concluidas, unidade: ana.unidade, cargo: ana.cargo },
    { ativas: 2, andamento: 1, bloqueadas: 0, atrasadas: 1, proximas: 1, itensPendentes: 0, concluidas: 1, unidade: 'Rede', cargo: 'Coordenadora' });
  const bru = por(r.pessoas, 'Bruno Lima');
  assert.deepStrictEqual({ ativas: bru.ativas, bloqueadas: bru.bloqueadas, atrasadas: bru.atrasadas, proximas: bru.proximas, itensPendentes: bru.itensPendentes, concluidas: bru.concluidas },
    { ativas: 1, bloqueadas: 1, atrasadas: 0, proximas: 0, itensPendentes: 1, concluidas: 0 }, 'item feito e item de tarefa concluída não contam');
  // 6. pessoa fora da aba Usuários
  const zeca = por(r.pessoas, 'Zeca Ninguem');
  assert.deepStrictEqual({ email: zeca.email, unidade: zeca.unidade, cargo: zeca.cargo, ativas: zeca.ativas, atrasadas: zeca.atrasadas, proximas: zeca.proximas }, { email: ZECA, unidade: '', cargo: '', ativas: 1, atrasadas: 0, proximas: 0 }, 'sem prazo não é atrasada nem próxima');
  // 2. sem responsável
  assert.ok(r.semResponsavel, 'há tarefa ativa sem dono');
  assert.deepStrictEqual({ nome: r.semResponsavel.nome, ativas: r.semResponsavel.ativas, atrasadas: r.semResponsavel.atrasadas }, { nome: 'Sem responsável', ativas: 1, atrasadas: 1 });
  // 5. projetos
  assert.deepStrictEqual(r.projetos.map(p => p.nome), ['P1', 'P2', 'P3'], 'ordem: atrasadas desc, bloqueadas desc, pct asc, nome');
  const p1 = por(r.projetos, 'P1'), p2 = por(r.projetos, 'P2'), p3 = por(r.projetos, 'P3');
  assert.deepStrictEqual({ total: p1.total, concluidas: p1.concluidas, pct: p1.pct, andamento: p1.andamento, bloqueadas: p1.bloqueadas, atrasadas: p1.atrasadas, proximas: p1.proximas, cklTotal: p1.cklTotal, cklFeitos: p1.cklFeitos, cor: p1.cor, publico: p1.publico },
    { total: 3, concluidas: 0, pct: 0, andamento: 1, bloqueadas: 1, atrasadas: 1, proximas: 1, cklTotal: 3, cklFeitos: 1, cor: '#111111', publico: false });
  assert.deepStrictEqual({ total: p2.total, concluidas: p2.concluidas, pct: p2.pct, atrasadas: p2.atrasadas, cklTotal: p2.cklTotal, publico: p2.publico }, { total: 3, concluidas: 1, pct: 33, atrasadas: 1, cklTotal: 0, publico: true }, 'pct arredondado; itens de tarefa concluída não contam');
  assert.deepStrictEqual({ total: p3.total, pct: p3.pct, cor: p3.cor }, { total: 0, pct: 0, cor: '#333333' }, 'projeto sem tarefa aparece com zeros');
  // totais
  assert.deepStrictEqual(r.totais, { ativas: 5, atrasadas: 2, bloqueadas: 1, proximas: 1 });
  // 7. concluída não é atrasada nem próxima: t4 (prazo 2026-08-01, concluída) não entrou em atrasadas de Ana nem de P2 além da t5
  assert.strictEqual(ana.atrasadas, 1); assert.strictEqual(p2.atrasadas, 1);
}

// 3. filtro de unidade: só pessoas da unidade, sem "Sem responsável", projetos intactos
{
  const r = calcular(dados, { unidade: 'Rede', projeto: '', janelaDias: 7 }, HOJE, deps);
  assert.deepStrictEqual(r.pessoas.map(p => p.nome), ['Ana Souza']);
  assert.strictEqual(r.semResponsavel, null);
  assert.strictEqual(r.projetos.length, 3);
}

// 4. filtro de projeto restringe as duas seções
{
  const r = calcular(dados, { unidade: '', projeto: 'P2', janelaDias: 7 }, HOJE, deps);
  assert.deepStrictEqual(r.pessoas.map(p => p.nome), ['Zeca Ninguem', 'Ana Souza'], 'Zeca 1 ativa; Ana só concluída (0 ativas); Bruno fora (item em tarefa concluída)');
  assert.strictEqual(por(r.pessoas, 'Ana Souza').concluidas, 1);
  assert.ok(r.semResponsavel && r.semResponsavel.atrasadas === 1);
  assert.deepStrictEqual(r.projetos.map(p => p.nome), ['P2']);
  assert.deepStrictEqual(r.totais, { ativas: 2, atrasadas: 1, bloqueadas: 0, proximas: 0 });
}

// janela de 30 dias alcança a bloqueada de Bruno
{
  const r = calcular(dados, { unidade: '', projeto: '', janelaDias: 30 }, HOJE, deps);
  assert.strictEqual(por(r.pessoas, 'Bruno Lima').proximas, 1);
  assert.strictEqual(r.totais.proximas, 2);
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tests/test_indicadores_front.js`
Expected: `AssertionError: marcadores @indicadores não encontrados em tarefas-shadcn.html`

- [ ] **Step 3: Implementar a função no HTML**

Em `tarefas-shadcn.html`, imediatamente antes de `function parseData(val) {`, inserir:
```js
/* @indicadores:inicio */
// Indicadores para gestores (carga por pessoa e saúde dos projetos). Função PURA:
// sem DOM nem globais — recebe dados, filtros, a data de hoje e as dependências
// (parseData, dataValida, nomeDeEmail). Coberta por tests/test_indicadores_front.js,
// que extrai este trecho pelos marcadores. Mantenha tudo entre os marcadores.
function calcularIndicadores(dados, filtros, hoje, deps) {
  filtros = filtros || {};
  var janela = Number(filtros.janelaDias) || 7;
  var dia0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  var limite = new Date(dia0); limite.setDate(dia0.getDate() + janela);
  var tarefas = (dados.tarefas || []).filter(function(t) {
    return !filtros.projeto || String(t.Projeto || '') === filtros.projeto;
  });
  var ckl = dados.cklStatus || {}, usuarios = dados.usuarios || [], projetos = dados.projetos || [];

  function low(v) { return String(v || '').trim().toLowerCase(); }
  function classificar(t) {
    var ativa = t.Status !== 'Concluído';
    var c = { ativa: ativa, andamento: ativa && t.Status === 'Em andamento', bloqueada: ativa && t.Status === 'Bloqueado', atrasada: false, proxima: false };
    if (ativa && deps.dataValida(t.Prazo)) {
      var d = deps.parseData(t.Prazo); d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      c.atrasada = d < dia0;
      c.proxima  = d >= dia0 && d <= limite;
    }
    return c;
  }
  var porEmail = {};
  usuarios.forEach(function(u) { if (u && u.email) porEmail[low(u.email)] = u; });
  function novaPessoa(email) {
    var u = porEmail[low(email)];
    return { email: email, nome: (u && u.nome) ? u.nome : deps.nomeDeEmail(email), cargo: (u && u.cargo) || '', unidade: (u && u.unidade) || '',
      ativas: 0, andamento: 0, bloqueadas: 0, atrasadas: 0, proximas: 0, itensPendentes: 0, concluidas: 0 };
  }
  function somar(alvo, c) {
    if (c.ativa) { alvo.ativas++; if (c.andamento) alvo.andamento++; if (c.bloqueada) alvo.bloqueadas++; if (c.atrasada) alvo.atrasadas++; if (c.proxima) alvo.proximas++; }
    else alvo.concluidas++;
  }
  var pessoas = {}, semResp = null, totais = { ativas: 0, atrasadas: 0, bloqueadas: 0, proximas: 0 }, projMap = {};
  function proj(nome) {
    if (!projMap[nome]) {
      var p = null;
      for (var i = 0; i < projetos.length; i++) { if (String(projetos[i].nome) === nome) { p = projetos[i]; break; } }
      projMap[nome] = { nome: nome, cor: (p && p.cor) || '#64748b', publico: !!(p && p.publico), total: 0, concluidas: 0, pct: 0,
        andamento: 0, bloqueadas: 0, atrasadas: 0, proximas: 0, cklTotal: 0, cklFeitos: 0 };
    }
    return projMap[nome];
  }
  // Projetos cadastrados aparecem mesmo sem tarefa (zeros), respeitando o filtro de projeto
  projetos.forEach(function(p) { if (p && p.nome && (!filtros.projeto || String(p.nome) === filtros.projeto)) proj(String(p.nome)); });

  tarefas.forEach(function(t) {
    var c = classificar(t), email = String(t['Responsável'] || '').trim();
    if (email) { var k = low(email); if (!pessoas[k]) pessoas[k] = novaPessoa(email); somar(pessoas[k], c); }
    else if (c.ativa) {
      if (!semResp) semResp = { email: '', nome: 'Sem responsável', cargo: '', unidade: '', ativas: 0, andamento: 0, bloqueadas: 0, atrasadas: 0, proximas: 0, itensPendentes: 0, concluidas: 0 };
      somar(semResp, c);
    }
    var pr = proj(String(t.Projeto || '') || '(sem projeto)');
    pr.total++;
    if (c.ativa) {
      if (c.andamento) pr.andamento++; if (c.bloqueada) pr.bloqueadas++; if (c.atrasada) pr.atrasadas++; if (c.proxima) pr.proximas++;
      totais.ativas++; if (c.atrasada) totais.atrasadas++; if (c.bloqueada) totais.bloqueadas++; if (c.proxima) totais.proximas++;
      (ckl[String(t.ID)] || []).forEach(function(i) {
        var feito = i['Concluído'] === true || i['Concluído'] === 'true' || i['Concluído'] === 'TRUE';
        pr.cklTotal++; if (feito) pr.cklFeitos++;
        var r = String(i.Responsavel || '').trim();
        if (r && !feito) { var kr = low(r); if (!pessoas[kr]) pessoas[kr] = novaPessoa(r); pessoas[kr].itensPendentes++; }
      });
    } else {
      pr.concluidas++;
    }
  });

  var listaP = Object.keys(pessoas).map(function(k) { return pessoas[k]; });
  if (filtros.unidade) { listaP = listaP.filter(function(p) { return p.unidade === filtros.unidade; }); semResp = null; }
  listaP.sort(function(a, b) { return (b.atrasadas - a.atrasadas) || (b.ativas - a.ativas) || a.nome.localeCompare(b.nome, 'pt-BR'); });
  var listaProj = Object.keys(projMap).map(function(k) { var p = projMap[k]; p.pct = p.total ? Math.round(p.concluidas * 100 / p.total) : 0; return p; });
  listaProj.sort(function(a, b) { return (b.atrasadas - a.atrasadas) || (b.bloqueadas - a.bloqueadas) || (a.pct - b.pct) || a.nome.localeCompare(b.nome, 'pt-BR'); });
  return { pessoas: listaP, semResponsavel: semResp, projetos: listaProj, totais: totais };
}
/* @indicadores:fim */
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node tests/test_indicadores_front.js && npm test`
Expected: sem saída de erro no primeiro; `7 arquivo(s) verdes` no segundo.

- [ ] **Step 5: Commit**

```bash
git add tests/test_indicadores_front.js tarefas-shadcn.html
git commit -m "feat(front): calcularIndicadores — carga por pessoa e saúde dos projetos, com teste Node"
```

---

### Task 2: Aba Indicadores — navegação, view, filtros e totais

**Files:**
- Modify: `tarefas-shadcn.html`
  - rail `<nav class="nav">` (≈ linha 592–599): novo item
  - `#homePainel` (≈ 662–681): link "Ver indicadores"
  - após o `</div>` que fecha `#appLayout` (≈ linha 760) e antes de `<!-- Modal -->`: a view nova
  - CSS: junto das regras `.home-*` (≈ 529–538); `@media print` (≈ 509)
  - JS: globais (≈ linha 980, junto de `filtroProjetoAtual`), `setModo` (≈ 1358), `renderUserBadge` (≈ 1111), novas funções `popularFiltrosInd`, `lerFiltrosInd`, `renderIndicadores`

**Interfaces:**
- Consumes: `calcularIndicadores` (Task 1), `parseData`, `dataValida`, `nomeDeEmail`, `uniq`, `esc`, `currentUserPodeExcluir`, `currentUser`, `usuarios`, `tarefas`, `projetos`, `cklStatus`.
- Produces: globais `indFiltroUnidade`, `indFiltroProjeto`, `indJanelaDias`, `indBuscaTermo`, `indOrdem`, `indUltimo` (último resultado de `calcularIndicadores`); `renderIndicadores()` que, ao final, chama `renderIndPessoas(indUltimo)` e `renderIndProjetos(indUltimo)` **se existirem** (`typeof === 'function'`) — Tasks 3 e 4 definem essas funções.

- [ ] **Step 1: Rail — novo item depois de Tarefas**

Após o `</a>` do `<a id="nav-tarefas" …>` inserir:
```html
    <a id="nav-indicadores" onclick="setModo('indicadores')" title="Indicadores" style="display:none">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>
      <span>Indicadores</span></a>
```

- [ ] **Step 2: Link na Home**

Dentro de `#homePainel`, logo após `</div>` que fecha `.home-stat-grid`, inserir:
```html
    <div class="home-link-row"><a class="home-link" onclick="setModo('indicadores')">Ver indicadores →</a></div>
```

- [ ] **Step 3: Markup da view** (após o `</div>` que fecha `#appLayout`, antes de `<!-- Modal -->`)

```html
<!-- Indicadores (Gestor/Admin) -->
<div id="indicadoresView" style="display:none">
  <div class="ind-head">
    <div>
      <div class="home-section-title">Indicadores</div>
      <div class="home-subline">Carga por pessoa e saúde dos projetos, com base nas tarefas ativas.</div>
    </div>
  </div>
  <div class="ind-filtros" id="indFiltros">
    <label>Unidade <select id="indUnidade" onchange="renderIndicadores()"></select></label>
    <label>Projeto <select id="indProjeto" onchange="renderIndicadores()"></select></label>
    <label>Próximas do prazo <select id="indJanela" onchange="renderIndicadores()">
      <option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option>
    </select></label>
    <label class="ind-busca">Pessoa <input type="text" id="indBusca" placeholder="Buscar por nome, e-mail ou cargo…" autocomplete="off" oninput="renderIndicadores()"></label>
  </div>
  <div class="home-stat-grid ind-totais">
    <div class="home-stat-card"><div class="stat-num" id="indTotAtivas">—</div><div class="stat-label">Ativas</div></div>
    <div class="home-stat-card"><div class="stat-num" id="indTotAndamento">—</div><div class="stat-label">Bloqueadas</div></div>
    <div class="home-stat-card" id="indTotAtrasadasCard"><div class="stat-num" id="indTotAtrasadas">—</div><div class="stat-label">Atrasadas</div></div>
    <div class="home-stat-card"><div class="stat-num" id="indTotProximas">—</div><div class="stat-label" id="indTotProximasLabel">Próximas (7 dias)</div></div>
  </div>
  <div class="home-section">
    <div class="home-section-title">Pessoas</div>
    <div id="indPessoas"></div>
  </div>
  <div class="home-section">
    <div class="home-section-title">Projetos</div>
    <div id="indProjetos"></div>
  </div>
</div>
```
(O segundo card usa o id `indTotAndamento` por legado do template mas exibe **Bloqueadas** — mantenha o id e o rótulo exatamente assim; o JS abaixo preenche com `totais.bloqueadas`.)

- [ ] **Step 4: CSS** — junto das regras `.home-*`:

```css
    .home-link-row { display: flex; justify-content: flex-end; margin: -20px 0 24px; }
    .home-link { font-size: .85rem; font-weight: 600; color: var(--primary); cursor: pointer; text-decoration: none; }
    .home-link:hover { text-decoration: underline; }
    #indicadoresView { padding: 28px 32px 40px; max-width: 1240px; }
    .ind-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; }
    .ind-filtros { display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: flex-end; margin-bottom: 20px; }
    .ind-filtros label { display: flex; flex-direction: column; gap: 4px; font-size: .75rem; color: var(--muted-foreground); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .ind-filtros select, .ind-filtros input { height: 34px; padding: 0 10px; border: 1px solid var(--input); border-radius: calc(var(--radius) - 2px); background: var(--surface); color: var(--foreground); font-size: .875rem; font-weight: 400; text-transform: none; letter-spacing: 0; min-width: 180px; }
    .ind-filtros .ind-busca input { min-width: 260px; }
    .ind-totais { margin-bottom: 28px; }
```
Dentro do bloco `@media print { … }` existente, acrescentar: `#indFiltros, .home-link-row { display: none !important; }`

- [ ] **Step 5: JS — globais** (junto de `var filtroProjetoAtual = '';`)

```js
// Indicadores (Gestor/Admin)
var indFiltroUnidade = null;   // null = ainda não inicializado (usa a unidade do usuário na 1ª render)
var indFiltroProjeto = '';
var indJanelaDias    = 7;
var indBuscaTermo    = '';
var indOrdem         = { campo: '', dir: 'desc' }; // '' = ordem natural de calcularIndicadores
var indUltimo        = null;   // último resultado de calcularIndicadores
```

- [ ] **Step 6: JS — `setModo` passa a conhecer a view**

Substituir a função inteira por:
```js
function setModo(m) {
  if (m === 'indicadores' && !currentUserPodeExcluir) m = 'home'; // guarda: só Gestor/Admin
  modoAtual = m;
  var isHome = m === 'home', isInd = m === 'indicadores';
  document.getElementById('homeView').style.display        = isHome ? 'block' : 'none';
  document.getElementById('appLayout').style.display       = (isHome || isInd) ? 'none' : 'flex';
  document.getElementById('indicadoresView').style.display = isInd ? 'block' : 'none';
  document.getElementById('btnInicio').style.display       = isHome ? 'none' : '';
  var vt = document.querySelector('.view-toggle');
  if (vt) vt.style.display = (isHome || isInd) ? 'none' : '';
  // Item ativo na rail (padrão Shell)
  var ni = document.getElementById('nav-inicio');
  var nt = document.getElementById('nav-tarefas');
  var nd = document.getElementById('nav-indicadores');
  if (ni) ni.classList.toggle('on', isHome);
  if (nt) nt.classList.toggle('on', !isHome && !isInd);
  if (nd) nd.classList.toggle('on', isInd);
  if (isHome) {
    renderHome();
  } else if (isInd) {
    renderIndicadores();
  } else {
    popularFiltros();
    renderView();
  }
}
```

- [ ] **Step 7: JS — visibilidade do item da rail em `renderUserBadge`**

Ao final do corpo de `renderUserBadge()` (antes do `}` de fechamento), acrescentar:
```js
  var nd = document.getElementById('nav-indicadores');
  if (nd) nd.style.display = currentUserPodeExcluir ? '' : 'none';
```

- [ ] **Step 8: JS — filtros e render** (inserir logo após `function setModo`)

```js
// ── Indicadores (Gestor/Admin) ────────────────────────────────
function popularFiltrosInd() {
  var selU = document.getElementById('indUnidade'), selP = document.getElementById('indProjeto'), selJ = document.getElementById('indJanela');
  if (indFiltroUnidade === null) {
    var eu = usuarios.filter(function(u) { return String(u.email).toLowerCase() === String(currentUser).toLowerCase(); })[0];
    indFiltroUnidade = (eu && eu.unidade) ? eu.unidade : '';
  }
  var unidades = uniq(usuarios.map(function(u) { return u.unidade; })).sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });
  if (indFiltroUnidade && unidades.indexOf(indFiltroUnidade) === -1) indFiltroUnidade = '';
  var htmlU = '<option value="">Todas as unidades</option>';
  unidades.forEach(function(u) { htmlU += '<option value="' + esc(u) + '"' + (u === indFiltroUnidade ? ' selected' : '') + '>' + esc(u) + '</option>'; });
  selU.innerHTML = htmlU;

  var nomesProj = projetos.map(function(p) { return p.nome; });
  var orfs = uniq(tarefas.map(function(t) { return t.Projeto; })).filter(function(n) { return n && nomesProj.indexOf(n) === -1; }).sort();
  var todos = nomesProj.concat(orfs);
  if (indFiltroProjeto && todos.indexOf(indFiltroProjeto) === -1) indFiltroProjeto = '';
  var htmlP = '<option value="">Todos os projetos</option>';
  todos.forEach(function(n) { if (n) htmlP += '<option value="' + esc(n) + '"' + (n === indFiltroProjeto ? ' selected' : '') + '>' + esc(n) + '</option>'; });
  selP.innerHTML = htmlP;
  selJ.value = String(indJanelaDias);
}

function lerFiltrosInd() {
  indFiltroUnidade = document.getElementById('indUnidade').value;
  indFiltroProjeto = document.getElementById('indProjeto').value;
  indJanelaDias    = Number(document.getElementById('indJanela').value) || 7;
  indBuscaTermo    = document.getElementById('indBusca').value.trim().toLowerCase();
}

function renderIndicadores() {
  if (!currentUserPodeExcluir) return;
  var primeiraVez = indFiltroUnidade === null;
  if (primeiraVez) popularFiltrosInd(); else { lerFiltrosInd(); popularFiltrosInd(); }
  indUltimo = calcularIndicadores(
    { tarefas: tarefas, cklStatus: cklStatus, usuarios: usuarios, projetos: projetos },
    { unidade: indFiltroUnidade, projeto: indFiltroProjeto, janelaDias: indJanelaDias },
    new Date(),
    { parseData: parseData, dataValida: dataValida, nomeDeEmail: nomeDeEmail }
  );
  var t = indUltimo.totais;
  document.getElementById('indTotAtivas').textContent    = t.ativas;
  document.getElementById('indTotAndamento').textContent = t.bloqueadas;
  document.getElementById('indTotAtrasadas').textContent = t.atrasadas;
  document.getElementById('indTotProximas').textContent  = t.proximas;
  document.getElementById('indTotProximasLabel').textContent = 'Próximas (' + indJanelaDias + ' dias)';
  document.getElementById('indTotAtrasadasCard').className = 'home-stat-card' + (t.atrasadas > 0 ? ' alert' : '');
  if (typeof renderIndPessoas === 'function')  renderIndPessoas(indUltimo);
  if (typeof renderIndProjetos === 'function') renderIndProjetos(indUltimo);
}
```

- [ ] **Step 9: Verificar no preview**

`npx serve -p 3000 .` → abrir `http://localhost:3000/tarefas-shadcn.html`. No console: `currentUserPodeExcluir = true; renderUserBadge();` → o item "Indicadores" aparece na rail; clicar abre a view com os filtros (Unidade pré-selecionada com a unidade da Ana do mock, Projeto "Todos", 7 dias) e 4 totais coerentes com os cards da Home (Atrasadas vermelho quando > 0). Trocar a janela para 30 muda o rótulo e o número de próximas. Voltar para Início e Tarefas funciona; `.view-toggle` some na view. Com `currentUserPodeExcluir = false; renderUserBadge(); setModo('indicadores')` → cai na Home e o item da rail some. `npm test` → 7 verdes. Console sem erros.

- [ ] **Step 10: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat(front): aba Indicadores (Gestor/Admin) com filtros e totais"
```

---

### Task 3: Tabela de pessoas (ordenável, busca, clique → Tarefas)

**Files:**
- Modify: `tarefas-shadcn.html` — CSS (junto de `.ind-*`), JS: nova função `renderIndPessoas(res)` + `ordenarInd(campo)` (após `renderIndicadores`)

**Interfaces:**
- Consumes: `indUltimo`, `indBuscaTermo`, `indOrdem`, `indFiltroProjeto`, `avatarInitials(email)`, `esc`, `setFiltroProjeto`, `setFiltroResponsavel`, `setModo`.
- Produces: `renderIndPessoas(res)`; `ordenarInd(campo)` (usado pelos `th`).

- [ ] **Step 1: CSS**

```css
    .ind-tabela { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; font-size: .875rem; }
    .ind-tabela th, .ind-tabela td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap; }
    .ind-tabela th:first-child, .ind-tabela td:first-child, .ind-tabela th:nth-child(2), .ind-tabela td:nth-child(2) { text-align: left; }
    .ind-tabela th { background: var(--muted-bg); color: var(--text-secondary); font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; cursor: pointer; user-select: none; }
    .ind-tabela th.on { color: var(--primary); }
    .ind-tabela tbody tr { cursor: pointer; }
    .ind-tabela tbody tr:hover { background: var(--hover-bg); }
    .ind-tabela tbody tr.sem-resp { font-style: italic; color: var(--text-secondary); cursor: default; }
    .ind-tabela tbody tr.sem-resp:hover { background: transparent; }
    .ind-tabela .zero { color: var(--muted-foreground); }
    .ind-tabela .ruim { color: var(--erro-cor); font-weight: 600; }
    .ind-tabela .aviso { color: var(--warn-ink); font-weight: 600; }
    .ind-pessoa { display: flex; align-items: center; gap: 10px; }
    .ind-pessoa .avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: #fff; font-size: .68rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ind-pessoa small { display: block; color: var(--muted-foreground); font-size: .72rem; }
    .ind-vazio { padding: 24px; text-align: center; color: var(--muted-foreground); font-size: .875rem; border: 1px dashed var(--border); border-radius: var(--radius); }
```

- [ ] **Step 2: JS**

```js
var IND_COLUNAS = [
  { campo: 'nome',           rotulo: 'Pessoa' },
  { campo: 'unidade',        rotulo: 'Unidade' },
  { campo: 'ativas',         rotulo: 'Ativas' },
  { campo: 'andamento',      rotulo: 'Em andamento' },
  { campo: 'bloqueadas',     rotulo: 'Bloqueadas' },
  { campo: 'atrasadas',      rotulo: 'Atrasadas' },
  { campo: 'proximas',       rotulo: 'Próximas' },
  { campo: 'itensPendentes', rotulo: 'Itens pendentes' },
  { campo: 'concluidas',     rotulo: 'Concluídas' }
];

function ordenarInd(campo) {
  if (indOrdem.campo === campo) indOrdem.dir = indOrdem.dir === 'desc' ? 'asc' : 'desc';
  else indOrdem = { campo: campo, dir: (campo === 'nome' || campo === 'unidade') ? 'asc' : 'desc' };
  if (indUltimo) renderIndPessoas(indUltimo);
}

function indCelNum(v, classeRuim) {
  var cls = v === 0 ? 'zero' : (classeRuim || '');
  return '<td class="' + cls + '">' + v + '</td>';
}

function renderIndPessoas(res) {
  var el = document.getElementById('indPessoas');
  var lista = res.pessoas.slice();
  if (indBuscaTermo) {
    lista = lista.filter(function(p) { return (p.nome + ' ' + p.email + ' ' + (p.cargo || '')).toLowerCase().indexOf(indBuscaTermo) !== -1; });
  }
  if (indOrdem.campo) {
    var c = indOrdem.campo, dir = indOrdem.dir === 'asc' ? 1 : -1;
    lista.sort(function(a, b) {
      var x = a[c], y = b[c];
      if (typeof x === 'string' || typeof y === 'string') return String(x || '').localeCompare(String(y || ''), 'pt-BR') * dir;
      return ((x || 0) - (y || 0)) * dir || a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }
  if (!lista.length && !res.semResponsavel) {
    el.innerHTML = '<div class="ind-vazio">Nenhuma pessoa com tarefas nos filtros atuais.</div>';
    return;
  }
  var html = '<table class="ind-tabela"><thead><tr>';
  IND_COLUNAS.forEach(function(col) {
    var on = indOrdem.campo === col.campo;
    html += '<th class="' + (on ? 'on' : '') + '" onclick="ordenarInd(\'' + col.campo + '\')">' + col.rotulo + (on ? (indOrdem.dir === 'asc' ? ' ▲' : ' ▼') : '') + '</th>';
  });
  html += '</tr></thead><tbody>';
  function linha(p, semResp) {
    var s = '<tr class="' + (semResp ? 'sem-resp' : '') + '"' + (semResp ? '' : ' data-email="' + esc(p.email) + '"') + '>';
    s += '<td><div class="ind-pessoa">' + (semResp ? '' : '<span class="avatar">' + esc(avatarInitials(p.email)) + '</span>')
      + '<span>' + esc(p.nome) + (p.cargo ? '<small>' + esc(p.cargo) + '</small>' : '') + '</span></div></td>';
    s += '<td>' + esc(p.unidade || '—') + '</td>';
    s += indCelNum(p.ativas) + indCelNum(p.andamento) + indCelNum(p.bloqueadas, 'aviso') + indCelNum(p.atrasadas, 'ruim')
      + indCelNum(p.proximas) + indCelNum(p.itensPendentes) + indCelNum(p.concluidas);
    return s + '</tr>';
  }
  if (res.semResponsavel && !indBuscaTermo) html += linha(res.semResponsavel, true);
  lista.forEach(function(p) { html += linha(p, false); });
  html += '</tbody></table>';
  el.innerHTML = html;
  Array.from(el.querySelectorAll('tbody tr[data-email]')).forEach(function(tr) {
    tr.addEventListener('click', function() {
      setFiltroProjeto(indFiltroProjeto || '');
      setFiltroResponsavel(tr.getAttribute('data-email'));
      setModo('tarefas');
    });
  });
}
```
(A linha "Sem responsável" não é clicável: a aba Tarefas não tem filtro de "sem responsável" — decisão de desenho registrada aqui.)

- [ ] **Step 3: Verificar no preview**

Console: `currentUserPodeExcluir = true; renderUserBadge(); setModo('indicadores'); document.getElementById('indUnidade').value=''; renderIndicadores();` → tabela com as pessoas do mock, "Sem responsável" no topo se o mock tiver tarefa sem dono, zeros em cinza, atrasadas em vermelho, bloqueadas em âmbar. Clicar em "Ativas" ordena desc e mostra ▼; clicar de novo, asc ▲; clicar em "Pessoa" ordena por nome asc. Digitar "bru" na busca deixa só Bruno (e some a linha "Sem responsável"). Clicar numa linha abre Tarefas filtrada naquele responsável (sidebar com o nome ativo). `npm test` 7 verdes. Console limpo.

- [ ] **Step 4: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat(front): indicadores — tabela de carga por pessoa, ordenável, com busca e atalho para Tarefas"
```

---

### Task 4: Cards de projetos (saúde) com clique → Tarefas

**Files:**
- Modify: `tarefas-shadcn.html` — CSS (junto de `.ind-*`), JS: nova função `renderIndProjetos(res)` (após `renderIndPessoas`)

**Interfaces:**
- Consumes: `indUltimo`, `corDoProjeto(nome)`, `esc`, `setFiltroProjeto`, `setFiltroResponsavel`, `setModo`; classe existente `.proj-chip-publico`.
- Produces: `renderIndProjetos(res)`.

- [ ] **Step 1: CSS**

```css
    .ind-proj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .ind-proj { background: var(--card); border: 1px solid var(--border); border-left: 4px solid var(--border-hover); border-radius: var(--radius); padding: 14px 16px; cursor: pointer; box-shadow: var(--shadow-sm); }
    .ind-proj:hover { border-color: var(--border-hover); background: var(--hover-bg); }
    .ind-proj-titulo { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 600; margin-bottom: 8px; }
    .ind-proj-titulo span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ind-barra { height: 6px; border-radius: 3px; background: var(--muted); overflow: hidden; margin: 6px 0 10px; }
    .ind-barra > span { display: block; height: 100%; background: var(--primary); border-radius: 3px; }
    .ind-proj-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: .78rem; color: var(--text-secondary); }
    .ind-proj-meta .ruim { color: var(--erro-cor); font-weight: 600; }
    .ind-proj-meta .aviso { color: var(--warn-ink); font-weight: 600; }
    .ind-proj-pct { font-size: .8rem; color: var(--muted-foreground); }
```

- [ ] **Step 2: JS**

```js
function renderIndProjetos(res) {
  var el = document.getElementById('indProjetos');
  if (!res.projetos.length) { el.innerHTML = '<div class="ind-vazio">Nenhum projeto nos filtros atuais.</div>'; return; }
  var html = '<div class="ind-proj-grid">';
  res.projetos.forEach(function(p) {
    html += '<div class="ind-proj" data-nome="' + esc(p.nome) + '" style="border-left-color:' + corDoProjeto(p.nome) + '">'
      + '<div class="ind-proj-titulo"><span title="' + esc(p.nome) + '">' + esc(p.nome) + '</span>'
      + (p.publico ? '<span class="proj-chip-publico" title="Visível a todo o domínio">público</span>' : '') + '</div>'
      + '<div class="ind-proj-pct">' + p.concluidas + ' de ' + p.total + ' concluída' + (p.total === 1 ? '' : 's') + ' · ' + p.pct + '%</div>'
      + '<div class="ind-barra"><span style="width:' + p.pct + '%"></span></div>'
      + '<div class="ind-proj-meta">'
      + '<span>' + p.andamento + ' em andamento</span>'
      + '<span class="' + (p.bloqueadas ? 'aviso' : '') + '">' + p.bloqueadas + ' bloqueada' + (p.bloqueadas === 1 ? '' : 's') + '</span>'
      + '<span class="' + (p.atrasadas ? 'ruim' : '') + '">' + p.atrasadas + ' atrasada' + (p.atrasadas === 1 ? '' : 's') + '</span>'
      + '<span>' + p.proximas + ' próxima' + (p.proximas === 1 ? '' : 's') + '</span>'
      + '<span>checklist ' + p.cklFeitos + '/' + p.cklTotal + '</span>'
      + '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
  Array.from(el.querySelectorAll('.ind-proj')).forEach(function(card) {
    card.addEventListener('click', function() {
      setFiltroResponsavel('');
      setFiltroProjeto(card.getAttribute('data-nome'));
      setModo('tarefas');
    });
  });
}
```
Observação: `corDoProjeto(nome)` devolve `#64748b` para projeto desconhecido e a cor cadastrada nos demais (já validada ao cadastrar); por isso o valor entra direto no `style`.

- [ ] **Step 3: Verificar no preview**

Com a view aberta como Gestor: cards para todos os projetos do mock (o "GT Onco" com chip público), barra de progresso proporcional ao `pct`, contadores com cor em atrasadas/bloqueadas > 0, projeto sem tarefa com "0 de 0 · 0%". Filtro de projeto deixa um card só. Clicar num card abre Tarefas filtrada naquele projeto (sidebar com o projeto ativo, responsável "Todos"). Impressão (Ctrl+P): view imprime sem filtros. `npm test` 7 verdes. Console limpo.

- [ ] **Step 4: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat(front): indicadores — cards de saúde dos projetos com atalho para Tarefas"
```

---

### Task 5: Publicar e registrar

**Files:**
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Testes e push**

```bash
npm test
npx clasp push -f
```
Esperado: `7 arquivo(s) verdes`; o push lista exatamente 7 arquivos (`appsscript.json`, `Code.gs`, `Estilos_Fontes.html`, `ImportacaoPlanos.gs`, `ImportacaoUsuarios.gs`, `tarefas-shadcn.html`, `tarefas.html`) — **conferir a lista antes do deploy**; qualquer arquivo extra significa `.claspignore` incompleto.

- [ ] **Step 2: Nova versão na implantação existente**

```bash
npx clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8 -d "aba Indicadores para gestores (carga por pessoa e saúde dos projetos)"
```
Esperado: `Deployed AKfycbyFDVg… @68` (anotar o número real).

- [ ] **Step 3: Verificar em produção**

Hard reload (Ctrl+Shift+R) no Cora como Admin: item "Indicadores" na rail; view com 79 usuários filtrável por unidade; projetos Spravato/Carteira PF/GT Onco com chip público e percentuais; clique em pessoa e em projeto leva a Tarefas filtrada. Console sem erros.

- [ ] **Step 4: HANDOFF**

Em `docs/HANDOFF.md`: novo bloco "### Último bloco — <data>: aba Indicadores para gestores" (o que entrou, versão publicada, decisões: pessoas com filtro por unidade, "Sem responsável" não clicável, nada de tendência temporal), atualizar o bullet "Publicado em 08/09" de "Onde estamos" com a nova versão, e remover "Visão de gestores para indicadores" do backlog (ou marcar feito).

- [ ] **Step 5: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs: handoff — aba Indicadores para gestores publicada"
```

---

## Self-review

- **Spec coverage:** §1 navegação/acesso → Task 2 (rail, `setModo`, guarda, link na Home, `renderUserBadge`); §2 filtros → Task 2 (`popularFiltrosInd`, unidade inicial do usuário, órfãos, janela, busca só em pessoas → Task 3); §3 cálculo → Task 1 (todas as regras, ordenações, "Sem responsável", projetos sem tarefa, `deps`); §4 renderização → Task 2 (totais), Task 3 (tabela, ordenação, cores, clique, vazio), Task 4 (cards, barra, chip, clique, vazio); impressão → Tasks 2 e 4; §5 CSS → Tasks 2–4; §6 testes → Task 1 (casos 1–7) e verificações manuais em cada task; publicação → Task 5.
- **Placeholders:** nenhum; todo passo de código traz o código.
- **Consistência:** `calcularIndicadores(dados, filtros, hoje, deps)` com `dados = {tarefas, cklStatus, usuarios, projetos}` em Task 1 e Task 2; campos de `Pessoa`/`Projeto` iguais em Task 1, IND_COLUNAS (Task 3) e cards (Task 4); `indUltimo`, `indOrdem`, `indBuscaTermo`, `indFiltroProjeto` definidos em Task 2 e usados em Tasks 3–4; `renderIndPessoas`/`renderIndProjetos` chamadas condicionalmente em Task 2 e definidas em Tasks 3/4.
