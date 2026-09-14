# Indicadores — monitoramento de ações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba Indicadores do Cora, um bloco "Para agir hoje", uma aba Ações com lista de risco e matriz prioridade × situação, e a métrica de estagnação ("parada há N dias") alimentada por uma rota nova de leitura.

**Architecture:** Backend: rota `indicadoresMovimento` (Gestor/Admin, cache 120 s) devolve a última movimentação por tarefa a partir de Tarefas, Interações, Log (`Campo = 'ID_Tarefa'`) e Checklist_Status; `atualizarTarefa` passa a gravar `['ATUALIZAR','ID_Tarefa','',id]` no Log. Front: `calcularIndicadores` (pura, testada em Node) ganha `acoes`, `matriz` e `alertas`; a view ganha seletor "Parada há", bloco "Para agir hoje" e abas internas Ações/Pessoas/Projetos; a aba Ações renderiza matriz e lista de risco com clique abrindo o modal da tarefa.

**Tech Stack:** Apps Script (`Code.gs`, ES5), HTML/CSS/JS vanilla ES5 inline (`tarefas-shadcn.html`), testes Node sem dependências (`tests/run.js` + `tests/harness.js`), `clasp`.

**Spec:** `docs/superpowers/specs/2026-09-09-indicadores-monitoramento-acoes-design.md`

## Global Constraints

- Arquivos de código: `Code.gs` (Task 1), `tarefas-shadcn.html` (Tasks 2–4); testes: `tests/test_indicadores_rota.js` (novo, Task 1) e `tests/test_indicadores_front.js` (estender, Task 2). Nenhuma mudança de esquema nas abas do Sheets.
- JS ES5 no `.gs` e no HTML: `var`, `function`, sem arrow functions, sem template strings, sem `const/let` (`Array.from` é convenção aceita no HTML). Nos testes Node, ES2015+ é permitido.
- Todo dado injetado em `innerHTML` passa por `esc()`; cor de projeto só via `corDoProjeto(nome)` (já valida hex).
- `calcularIndicadores` continua pura, entre `/* @indicadores:inicio */` e `/* @indicadores:fim */`; nova entrada `dados.movimento` (mapa `{id: 'yyyy-MM-ddTHH:mm:ss'}` ou `null`) e `filtros.paradaDias`.
- Textos de UI em português, literais deste plano.
- Regras de segurança do repo para quem implementa: `git status --short` antes de editar e antes de commitar (só ` M .claude/settings.local.json` é tolerado além do alvo); `Edit` no arquivo alvo (nunca `Write`, nunca criar arquivo fora dos listados); `git add` só dos arquivos da task; arquivos temporários fora do repo.
- `npm test` verde antes de todo `clasp push`; publicação só na Task 5 com `clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8` após conferir que o push listou exatamente 7 arquivos.
- Preview local: `npx serve -p 3000 .` → `http://localhost:3000/tarefas-shadcn.html`; no console `currentUserPodeExcluir = true; renderUserBadge(); setModo('indicadores');`.

---

### Task 1: Backend — rota `indicadoresMovimento` e ID da tarefa no Log

**Files:**
- Create: `tests/test_indicadores_rota.js`
- Modify: `Code.gs` — `switch` do `doGet` (após `case 'bootstrapApoio':`), `atualizarTarefa` (antes de `gravarLogs(logEntradas);`, ≈ linha 818), e uma seção nova logo após `function bootstrapApoio()`

**Interfaces:**
- Produces: rota `acao=indicadoresMovimento` → `{ movimento: {"<id>": "yyyy-MM-dd'T'HH:mm:ss"}, geradoEm }` ou `{ erro: 'Apenas Admin ou Gestor.' }`; funções `indicadoresMovimento()` e `montarMovimentoTarefas()`; constantes `CACHE_MOV_KEY = 'indMovimento_v1'`, `CACHE_MOV_SEG = 120`. `atualizarTarefa` grava uma linha extra de Log `['ATUALIZAR','ID_Tarefa','',id]` quando algo mudou.
- Consumes: `lerAba`, `comCache`, `podeExcluir`, `COL`, `ABA_*`, `Utilities.formatDate`.

- [ ] **Step 1: Escrever o teste (falha porque a rota não existe)**

Criar `tests/test_indicadores_rota.js`:
```js
// Rota indicadoresMovimento (última movimentação por tarefa) e ID da tarefa no Log ao editar.
'use strict';
const assert = require('assert');
const { carregar } = require('./harness');
const J = v => JSON.parse(JSON.stringify(v));

const ADMIN = 'aurelio.pereira.ext@unimedcnu.coop.br', PADRAO = 'padrao@unimedcnu.coop.br';
const cabT = ['ID','Tarefa','Projeto','Responsável','Prazo','Status','Prioridade','Criado por','Data criação','Observações','Ativo','Event ID'];
const cabI = ['ID','ID_Tarefa','Data/Hora','Editor','Tipo','Conteúdo'];
const cabL = ['ID','Data/Hora','Editor','Ação','Campo','Valor Anterior','Valor Novo'];
const cabC = ['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão','Responsavel'];
const D = (y, m, d, h) => new Date(y, m - 1, d, h || 0, 0, 0);
function abas() {
  return {
    Usuários: [['Nome','Email','Perfil','Unidade','Cargo'], ['Aurélio', ADMIN, 'Admin', '', ''], ['Padrão', PADRAO, 'Usuário Padrão', '', '']],
    Tarefas: [cabT,
      [1, 'Com tudo',        'P1', ADMIN, '', 'Em andamento', 'Média', ADMIN, D(2026, 9, 1, 9),  '', true,  ''],
      [2, 'Só criação',      'P1', ADMIN, '', 'A fazer',      'Média', ADMIN, D(2026, 9, 2, 8),  '', true,  ''],
      [3, 'Inativa',         'P1', ADMIN, '', 'A fazer',      'Média', ADMIN, D(2026, 9, 3, 8),  '', false, ''],
      [4, 'Só item feito',   'P1', ADMIN, '', 'A fazer',      'Média', ADMIN, D(2026, 9, 1, 8),  '', true,  '']],
    Interações: [cabI,
      [1, 1, D(2026, 9, 3, 10), ADMIN, 'Comentário', 'a'],
      [2, 1, D(2026, 9, 5, 10), ADMIN, 'Atualização de status', 'b'],
      [3, 3, D(2026, 9, 9, 10), ADMIN, 'Comentário', 'inativa: ignorar']],
    Log: [cabL,
      [1, D(2026, 9, 6, 10), ADMIN, 'CHECKLIST', 'ID_Tarefa', '', 1],           // conta (Valor Novo = id)
      [2, D(2026, 9, 7, 10), ADMIN, 'AVISO_CHECKLIST', 'ID_Tarefa', 1, 'x@y'],  // conta (Valor Anterior = id)
      [3, D(2026, 9, 8, 10), ADMIN, 'ATUALIZAR', 'prazo', '2026-09-01', '2026-09-10'], // sem ID: ignorar
      [4, D(2026, 9, 9, 10), ADMIN, 'CHECKLIST', 'ID_Tarefa', '', 99]],          // tarefa inexistente: ignorar
    Checklist_Status: [cabC,
      [1, 1, '', 'i1', 1, true,  D(2026, 9, 4, 12), ''],
      [2, 4, '', 'i2', 1, true,  D(2026, 9, 6, 15), ''],
      [3, 4, '', 'i3', 2, false, '',                 '']]
  };
}

// Gestor/Admin: maior data entre criação, interação, log ID_Tarefa e item concluído
{
  const ctx = carregar({ abas: abas(), email: ADMIN });
  const r = J(ctx.indicadoresMovimento());
  assert.ok(!r.erro, 'admin não recebe erro');
  assert.strictEqual(r.movimento['1'], '2026-09-07T10:00:00', 'tarefa 1: aviso de checklist (log com id em Valor Anterior) é o mais recente');
  assert.strictEqual(r.movimento['2'], '2026-09-02T08:00:00', 'tarefa 2: só a criação');
  assert.strictEqual(r.movimento['4'], '2026-09-06T15:00:00', 'tarefa 4: data de conclusão do item');
  assert.strictEqual(r.movimento['3'], undefined, 'inativa não entra');
  assert.strictEqual(r.movimento['99'], undefined, 'log de tarefa inexistente ignorado');
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(r.geradoEm));
}

// Usuário Padrão: recusado
{
  const ctx = carregar({ abas: abas(), email: PADRAO });
  assert.deepStrictEqual(J(ctx.indicadoresMovimento()), { erro: 'Apenas Admin ou Gestor.' });
}

// cache: segunda chamada devolve o mesmo resultado sem reler (usa CacheService do harness)
{
  const ctx = carregar({ abas: abas(), email: ADMIN });
  const a = J(ctx.indicadoresMovimento());
  ctx._planilhas && 0; // no-op: mantém a referência do harness
  const b = J(ctx.indicadoresMovimento());
  assert.deepStrictEqual(a, b);
  assert.ok(Object.keys(ctx._cache).some(k => /indMovimento_v1/.test(k)), 'gravou no cache com a chave indMovimento_v1');
}

// atualizarTarefa grava a linha ['ATUALIZAR','ID_Tarefa','',id] quando algo mudou, e nada quando nada mudou
{
  const ctx = carregar({ abas: abas(), email: ADMIN });
  const r = J(ctx.atualizarTarefa({ id: 2, prioridade: 'Alta' }));
  assert.ok(r.sucesso, JSON.stringify(r));
  const logs = ctx._escritas.filter(e => e.aba === 'Log' && e.op === 'appendRow').map(e => J(e.args));
  assert.ok(logs.some(l => l[3] === 'ATUALIZAR' && l[4] === 'prioridade'), 'log do campo');
  const comId = logs.filter(l => l[3] === 'ATUALIZAR' && l[4] === 'ID_Tarefa');
  assert.strictEqual(comId.length, 1, 'exatamente uma linha com o ID');
  assert.strictEqual(String(comId[0][6]), '2');
}
{
  const ctx = carregar({ abas: abas(), email: ADMIN });
  const r = J(ctx.atualizarTarefa({ id: 2, prioridade: 'Média' })); // já era Média
  assert.ok(r.sucesso, JSON.stringify(r));
  assert.strictEqual(ctx._escritas.filter(e => e.aba === 'Log').length, 0, 'nada mudou, nada logado');
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tests/test_indicadores_rota.js`
Expected: `TypeError: ctx.indicadoresMovimento is not a function`

- [ ] **Step 3: Rota no `doGet`**

Após a linha `case 'bootstrapApoio':         resultado = bootstrapApoio();              break;` inserir:
```js
      case 'indicadoresMovimento':   resultado = indicadoresMovimento();        break;
```

- [ ] **Step 4: Funções da rota** (inserir logo após o fechamento `}` de `function bootstrapApoio()`)

```js
// ── Indicadores: última movimentação por tarefa ───────────────
// Lida só pela aba Indicadores (Gestor/Admin) para a métrica "parada há N dias".
// Maior data entre: criação da tarefa, qualquer interação, linhas do Log com
// Campo 'ID_Tarefa' (checklist, interação, aviso e, desde esta versão, edição)
// e conclusão de itens de checklist. Cache de 2 min; sem invalidação por escrita.
var CACHE_MOV_KEY = 'indMovimento_v1';
var CACHE_MOV_SEG = 120;

function indicadoresMovimento() {
  var email = Session.getActiveUser().getEmail();
  if (!podeExcluir(email)) return { erro: 'Apenas Admin ou Gestor.' };
  return comCache(CACHE_MOV_KEY, CACHE_MOV_SEG, montarMovimentoTarefas);
}

function montarMovimentoTarefas() {
  var tz = Session.getScriptTimeZone();
  var mov = {}, ativas = {};
  function ms(v) {
    if (!v) return 0;
    var d = v instanceof Date ? v : new Date(v);
    var t = d.getTime();
    return isNaN(t) ? 0 : t;
  }
  function marcar(id, v) {
    var k = String(id == null ? '' : id), t = ms(v);
    if (!k || !ativas[k] || !t) return;
    if (!mov[k] || t > mov[k]) mov[k] = t;
  }
  var rowsT = lerAba(ABA_TAREFAS) || [];
  for (var i = 1; i < rowsT.length; i++) {
    var l = rowsT[i];
    if (!l[COL.ID]) continue;
    if (l[COL.ATIVO] === false || l[COL.ATIVO] === 'false') continue;
    ativas[String(l[COL.ID])] = true;
    marcar(l[COL.ID], l[COL.DATA_CRIACAO]);
  }
  var rowsI = lerAba(ABA_INTERACOES) || [];
  for (var a = 1; a < rowsI.length; a++) marcar(rowsI[a][1], rowsI[a][2]);
  var rowsL = lerAba(ABA_LOG) || [];
  for (var b = 1; b < rowsL.length; b++) {
    if (String(rowsL[b][4]) !== 'ID_Tarefa') continue;
    // O id fica em Valor Novo (CHECKLIST, INTERACAO, ATUALIZAR) ou em Valor Anterior (AVISO_CHECKLIST)
    if (ativas[String(rowsL[b][6])]) marcar(rowsL[b][6], rowsL[b][1]);
    else if (ativas[String(rowsL[b][5])]) marcar(rowsL[b][5], rowsL[b][1]);
  }
  var rowsC = lerAba(ABA_CKL_STATUS) || [];
  for (var c = 1; c < rowsC.length; c++) marcar(rowsC[c][1], rowsC[c][6]);
  var out = {};
  Object.keys(mov).forEach(function(k) { out[k] = Utilities.formatDate(new Date(mov[k]), tz, "yyyy-MM-dd'T'HH:mm:ss"); });
  return { movimento: out, geradoEm: Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss") };
}
```

- [ ] **Step 5: ID da tarefa no Log ao editar**

Em `atualizarTarefa`, trocar a linha `    gravarLogs(logEntradas);` por:
```js
    // Uma linha com o ID da tarefa por save (padrão de CHECKLIST/INTERACAO): permite
    // atribuir edições à tarefa na leitura do Log (indicadoresMovimento).
    if (logEntradas.length) logEntradas.push(['ATUALIZAR', 'ID_Tarefa', '', dados.id]);
    gravarLogs(logEntradas);
```

- [ ] **Step 6: Rodar e ver passar**

Run: `node tests/test_indicadores_rota.js && npm test`
Expected: sem erro; `8 arquivo(s) verdes` (os 7 atuais, que já incluem `test_indicadores_front.js`, mais este). Se algum teste existente contar linhas de Log de `atualizarTarefa`, ajustar a expectativa (+1 linha por save com mudança) e registrar no relatório.

- [ ] **Step 7: Commit**

```bash
git add Code.gs tests/test_indicadores_rota.js
git commit -m "feat(backend): rota indicadoresMovimento (última movimentação por tarefa) e ID da tarefa no Log ao editar"
```

---

### Task 2: `calcularIndicadores` — `acoes`, `matriz` e `alertas`

**Files:**
- Modify: `tests/test_indicadores_front.js` (acrescentar blocos ao final)
- Modify: `tarefas-shadcn.html` — substituir a função `calcularIndicadores` inteira (entre os marcadores, ≈ linhas 2694–2768; os marcadores ficam)

**Interfaces:**
- Consumes: `deps = {parseData, dataValida, nomeDeEmail}`.
- Produces (além de `pessoas`, `semResponsavel`, `projetos`, `totais`): `acoes: Acao[]`, `matriz`, `alertas: Alerta[]`.
  `Acao = { id, tarefa, projeto, cor, responsavel, responsavelNome, prioridade, status, prazo, diasAtraso, diasParaPrazo, ultimaMov, diasParada, cklTotal, cklFeitos, flags, severidade, matrizLinha, matrizColuna }`;
  `flags = { atrasadaCritica, atrasada, bloqueada, parada, vence, semResponsavel, semPrazo }`; `severidade` 1..7 ou 9.
  `matriz = { linhas: ['Crítica','Alta','Média','Baixa'], colunas: ['Atrasada','Bloqueada','Em andamento','A fazer'], celulas: {linha: {coluna: n}}, total }`.
  `Alerta = { partes: [{texto, forte}], aba: 'acoes'|'pessoas', filtro: {flag?, projeto?, pessoa?} }` (texto legível = concatenação de `partes[].texto`).

- [ ] **Step 1: Acrescentar os testes ao final de `tests/test_indicadores_front.js`**

```js

// ───────────── Bloco 2: ações, matriz e alertas (monitoramento) ─────────────
{
  const txt = a => a.partes.map(p => p.texto).join('');
  const tarefas2 = tarefas.map(t => Object.assign({}, t));
  tarefas2[0].Prioridade = 'Crítica';                 // t1: atrasada + crítica
  const movimento = { '1': '2026-08-25T10:00:00', '2': '2026-09-07T09:00:00', '5': '2026-08-30T08:00:00', '6': '2026-09-08T08:00:00' }; // t3 sem movimento
  const dados2 = { tarefas: tarefas2, cklStatus, usuarios, projetos, movimento };
  const F = { unidade: '', projeto: '', janelaDias: 7, paradaDias: 7 };

  const r = calcular(dados2, F, HOJE, deps);
  assert.deepStrictEqual(r.acoes.map(a => a.id), [1, 5, 3, 2, 6], 'ordem: sev asc, diasAtraso desc');
  const a1 = r.acoes[0], a5 = r.acoes[1], a3 = r.acoes[2], a2 = r.acoes[3], a6 = r.acoes[4];
  assert.deepStrictEqual({ sev: a1.severidade, atraso: a1.diasAtraso, parada: a1.diasParada, flags: a1.flags, nome: a1.responsavelNome, cor: a1.cor, ckl: [a1.cklFeitos, a1.cklTotal] },
    { sev: 1, atraso: 7, parada: 14, flags: { atrasadaCritica: true, atrasada: true, bloqueada: false, parada: true, vence: false, semResponsavel: false, semPrazo: false }, nome: 'Ana Souza', cor: '#111111', ckl: [1, 2] });
  assert.deepStrictEqual({ sev: a5.severidade, atraso: a5.diasAtraso, parada: a5.diasParada, semResp: a5.flags.semResponsavel, nome: a5.responsavelNome }, { sev: 2, atraso: 3, parada: 9, semResp: true, nome: '' });
  assert.deepStrictEqual({ sev: a3.severidade, parada: a3.diasParada, mov: a3.ultimaMov, paraPrazo: a3.diasParaPrazo }, { sev: 3, parada: null, mov: null, paraPrazo: 22 }, 'sem movimento conhecido → diasParada null');
  assert.deepStrictEqual({ sev: a2.severidade, vence: a2.flags.vence, paraPrazo: a2.diasParaPrazo, parada: a2.diasParada }, { sev: 5, vence: true, paraPrazo: 2, parada: 1 });
  assert.deepStrictEqual({ sev: a6.severidade, semPrazo: a6.flags.semPrazo, paraPrazo: a6.diasParaPrazo, nome: a6.responsavelNome, atraso: a6.diasAtraso }, { sev: 7, semPrazo: true, paraPrazo: null, nome: 'Zeca Ninguem', atraso: 0 });
  assert.ok(!r.acoes.some(a => a.id === 4), 'concluída não entra em acoes');

  // matriz
  assert.deepStrictEqual(r.matriz.linhas, ['Crítica', 'Alta', 'Média', 'Baixa']);
  assert.deepStrictEqual(r.matriz.colunas, ['Atrasada', 'Bloqueada', 'Em andamento', 'A fazer']);
  assert.deepStrictEqual(r.matriz.celulas['Crítica'], { 'Atrasada': 1, 'Bloqueada': 0, 'Em andamento': 0, 'A fazer': 0 });
  assert.deepStrictEqual(r.matriz.celulas['Média'],   { 'Atrasada': 1, 'Bloqueada': 1, 'Em andamento': 0, 'A fazer': 2 }, 'atrasada tem precedência sobre status; Backlog conta como A fazer');
  assert.strictEqual(r.matriz.total, 5);
  assert.deepStrictEqual([a1.matrizLinha, a1.matrizColuna, a3.matrizColuna, a6.matrizColuna], ['Crítica', 'Atrasada', 'Bloqueada', 'A fazer']);

  // alertas (regra 4 não dispara: Ana tem 1 atrasada)
  assert.deepStrictEqual(r.alertas.map(txt), [
    '1 ação crítica/alta atrasada em P1',
    '2 ações sem movimento há 7 dias ou mais',
    '1 ação sem responsável',
    '1 ação vence nos próximos 7 dias'
  ]);
  assert.deepStrictEqual(r.alertas[0].filtro, { flag: 'atrasadaCritica', projeto: 'P1' });
  assert.deepStrictEqual([r.alertas[1].filtro, r.alertas[2].filtro, r.alertas[3].filtro], [{ flag: 'parada' }, { flag: 'semResponsavel' }, { flag: 'vence' }]);
  assert.ok(r.alertas.every(a => a.aba === 'acoes'));
  assert.deepStrictEqual(r.alertas[0].partes.map(p => p.forte), [true, false, true], 'número e projeto em destaque');

  // sem mapa de movimento: nenhuma parada, diasParada null, alerta de estagnação ausente
  const r0 = calcular({ tarefas: tarefas2, cklStatus, usuarios, projetos, movimento: null }, F, HOJE, deps);
  assert.ok(r0.acoes.every(a => a.diasParada === null && !a.flags.parada));
  assert.deepStrictEqual(r0.alertas.map(txt), ['1 ação crítica/alta atrasada em P1', '1 ação sem responsável', '1 ação vence nos próximos 7 dias']);

  // paradaDias maior: só t1 (14 d) fica parada
  const r30 = calcular(dados2, Object.assign({}, F, { paradaDias: 10 }), HOJE, deps);
  assert.deepStrictEqual(r30.acoes.filter(a => a.flags.parada).map(a => a.id), [1]);
  assert.strictEqual(txt(r30.alertas[1]), '1 ação sem movimento há 10 dias ou mais');

  // filtro de projeto restringe acoes/matriz/alertas; filtro de unidade não afeta acoes
  const rp = calcular(dados2, Object.assign({}, F, { projeto: 'P1' }), HOJE, deps);
  assert.deepStrictEqual(rp.acoes.map(a => a.id), [1, 3, 2]);
  assert.strictEqual(rp.matriz.total, 3);
  assert.deepStrictEqual(rp.alertas.map(txt), ['1 ação crítica/alta atrasada em P1', '1 ação sem movimento há 7 dias ou mais', '1 ação vence nos próximos 7 dias']);
  const ru = calcular(dados2, Object.assign({}, F, { unidade: 'Onco' }), HOJE, deps);
  assert.strictEqual(ru.acoes.length, 5);

  // regra 4: pessoa que concentra ≥ 2 atrasadas (sobre pessoas já filtradas por unidade)
  const tarefas3 = tarefas2.concat([T(7, 'P1', ANA, '2026-09-02', 'A fazer')]);
  const r4 = calcular({ tarefas: tarefas3, cklStatus, usuarios, projetos, movimento }, F, HOJE, deps);
  const a4 = r4.alertas.filter(a => a.aba === 'pessoas')[0];
  assert.ok(a4, 'alerta de pessoa presente');
  assert.strictEqual(txt(a4), 'Ana Souza concentra 2 ações atrasadas');
  assert.deepStrictEqual(a4.filtro, { pessoa: ANA });
  const r4u = calcular({ tarefas: tarefas3, cklStatus, usuarios, projetos, movimento }, Object.assign({}, F, { unidade: 'Onco' }), HOJE, deps);
  assert.ok(!r4u.alertas.some(a => a.aba === 'pessoas'), 'Ana é de Rede: com filtro Onco a regra 4 não dispara');

  // limite: no máximo 5 alertas e no máximo 3 da regra 1
  const muitos = tarefas2.concat([T(8, 'P2', ANA, '2026-09-01', 'A fazer'), T(9, 'P3', ANA, '2026-09-01', 'A fazer'), T(10, 'P4', ANA, '2026-09-01', 'A fazer')].map(t => Object.assign(t, { Prioridade: 'Alta' })));
  const rm = calcular({ tarefas: muitos, cklStatus, usuarios, projetos, movimento }, F, HOJE, deps);
  assert.strictEqual(rm.alertas.length, 5);
  assert.strictEqual(rm.alertas.filter(a => a.filtro && a.filtro.flag === 'atrasadaCritica').length, 3);

  // sem nada a apontar: lista vazia
  const calmo = [T(11, 'P1', ANA, '2026-12-01', 'Em andamento')];
  const rc = calcular({ tarefas: calmo, cklStatus: {}, usuarios, projetos, movimento: { '11': '2026-09-08T08:00:00' } }, F, HOJE, deps);
  assert.deepStrictEqual(rc.alertas, []);
  assert.strictEqual(rc.acoes[0].severidade, 9);
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tests/test_indicadores_front.js`
Expected: `TypeError: Cannot read properties of undefined (reading 'map')` (não existe `acoes`).

- [ ] **Step 3: Substituir a função `calcularIndicadores` inteira** (do `function calcularIndicadores(` até o `}` antes de `/* @indicadores:fim */`) por:

```js
function calcularIndicadores(dados, filtros, hoje, deps) {
  filtros = filtros || {};
  var janela = Number(filtros.janelaDias) || 7;
  var paradaDias = Number(filtros.paradaDias) || 7;
  var dia0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  var limite = new Date(dia0); limite.setDate(dia0.getDate() + janela);
  var tarefas = (dados.tarefas || []).filter(function(t) {
    return !filtros.projeto || String(t.Projeto || '') === filtros.projeto;
  });
  var ckl = dados.cklStatus || {}, usuarios = dados.usuarios || [], projetos = dados.projetos || [];
  var movimento = dados.movimento || null;

  function low(v) { return String(v || '').trim().toLowerCase(); }
  function soDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function diasEntre(a, b) { return Math.round((b - a) / 86400000); }
  function feitoItem(i) { return i['Concluído'] === true || i['Concluído'] === 'true' || i['Concluído'] === 'TRUE'; }
  function classificar(t) {
    var ativa = t.Status !== 'Concluído';
    var c = { ativa: ativa, andamento: ativa && t.Status === 'Em andamento', bloqueada: ativa && t.Status === 'Bloqueado', atrasada: false, proxima: false, prazoDia: null };
    if (ativa && deps.dataValida(t.Prazo)) {
      var d = soDia(deps.parseData(t.Prazo));
      c.prazoDia = d;
      c.atrasada = d < dia0;
      c.proxima  = d >= dia0 && d <= limite;
    }
    return c;
  }
  var porEmail = {};
  usuarios.forEach(function(u) { if (u && u.email) porEmail[low(u.email)] = u; });
  function nomeDe(email) { var u = porEmail[low(email)]; return (u && u.nome) ? u.nome : deps.nomeDeEmail(email); }
  function novaPessoa(email) {
    var u = porEmail[low(email)];
    return { email: email, nome: nomeDe(email), cargo: (u && u.cargo) || '', unidade: (u && u.unidade) || '',
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

  var acoes = [];
  tarefas.forEach(function(t) {
    var c = classificar(t), email = String(t['Responsável'] || '').trim();
    if (email) { var k = low(email); if (!pessoas[k]) pessoas[k] = novaPessoa(email); somar(pessoas[k], c); }
    else if (c.ativa) {
      if (!semResp) semResp = { email: '', nome: 'Sem responsável', cargo: '', unidade: '', ativas: 0, andamento: 0, bloqueadas: 0, atrasadas: 0, proximas: 0, itensPendentes: 0, concluidas: 0 };
      somar(semResp, c);
    }
    var nomeProj = String(t.Projeto || '') || '(sem projeto)';
    var pr = proj(nomeProj);
    pr.total++;
    if (!c.ativa) { pr.concluidas++; return; }

    if (c.andamento) pr.andamento++; if (c.bloqueada) pr.bloqueadas++; if (c.atrasada) pr.atrasadas++; if (c.proxima) pr.proximas++;
    totais.ativas++; if (c.atrasada) totais.atrasadas++; if (c.bloqueada) totais.bloqueadas++; if (c.proxima) totais.proximas++;
    var itens = ckl[String(t.ID)] || [], feitos = 0;
    itens.forEach(function(i) {
      var feito = feitoItem(i);
      pr.cklTotal++; if (feito) { pr.cklFeitos++; feitos++; }
      var r = String(i.Responsavel || '').trim();
      if (r && !feito) { var kr = low(r); if (!pessoas[kr]) pessoas[kr] = novaPessoa(r); pessoas[kr].itensPendentes++; }
    });

    // ── Ação (lista de risco) ──
    var diasAtraso = c.atrasada ? diasEntre(c.prazoDia, dia0) : 0;
    var diasParaPrazo = (c.prazoDia && !c.atrasada) ? diasEntre(dia0, c.prazoDia) : null;
    var ultimaMov = (movimento && movimento[String(t.ID)]) ? String(movimento[String(t.ID)]) : null;
    var diasParada = null;
    if (ultimaMov) {
      var m = deps.parseData(ultimaMov.slice(0, 10));
      if (!isNaN(m.getTime())) diasParada = Math.max(0, diasEntre(soDia(m), dia0));
    }
    var prio = String(t.Prioridade || '') || 'Média';
    var flags = {
      atrasadaCritica: c.atrasada && (prio === 'Crítica' || prio === 'Alta'),
      atrasada: c.atrasada,
      bloqueada: c.bloqueada,
      parada: diasParada !== null && diasParada >= paradaDias,
      vence: c.proxima,
      semResponsavel: !email,
      semPrazo: !c.prazoDia
    };
    var sev = flags.atrasadaCritica ? 1 : flags.atrasada ? 2 : flags.bloqueada ? 3 : flags.parada ? 4 : flags.vence ? 5 : flags.semResponsavel ? 6 : flags.semPrazo ? 7 : 9;
    var linhaM = ['Crítica', 'Alta', 'Média', 'Baixa'].indexOf(prio) >= 0 ? prio : 'Média';
    var colunaM = flags.atrasada ? 'Atrasada' : c.bloqueada ? 'Bloqueada' : c.andamento ? 'Em andamento' : 'A fazer';
    acoes.push({ id: t.ID, tarefa: String(t.Tarefa || ''), projeto: nomeProj, cor: pr.cor, responsavel: email,
      responsavelNome: email ? nomeDe(email) : '', prioridade: prio, status: String(t.Status || ''), prazo: c.prazoDia ? t.Prazo : '',
      diasAtraso: diasAtraso, diasParaPrazo: diasParaPrazo, ultimaMov: ultimaMov, diasParada: diasParada,
      cklTotal: itens.length, cklFeitos: feitos, flags: flags, severidade: sev, matrizLinha: linhaM, matrizColuna: colunaM });
  });

  var listaP = Object.keys(pessoas).map(function(k) { return pessoas[k]; });
  if (filtros.unidade) { listaP = listaP.filter(function(p) { return p.unidade === filtros.unidade; }); semResp = null; }
  listaP.sort(function(a, b) { return (b.atrasadas - a.atrasadas) || (b.ativas - a.ativas) || a.nome.localeCompare(b.nome, 'pt-BR'); });
  var listaProj = Object.keys(projMap).map(function(k) { var p = projMap[k]; p.pct = p.total ? Math.round(p.concluidas * 100 / p.total) : 0; return p; });
  listaProj.sort(function(a, b) { return (b.atrasadas - a.atrasadas) || (b.bloqueadas - a.bloqueadas) || (a.pct - b.pct) || a.nome.localeCompare(b.nome, 'pt-BR'); });

  acoes.sort(function(a, b) { return (a.severidade - b.severidade) || (b.diasAtraso - a.diasAtraso) || ((b.diasParada || 0) - (a.diasParada || 0)) || (Number(a.id) - Number(b.id)); });

  // ── Matriz prioridade × situação ──
  var linhasM = ['Crítica', 'Alta', 'Média', 'Baixa'], colunasM = ['Atrasada', 'Bloqueada', 'Em andamento', 'A fazer'], celulas = {};
  linhasM.forEach(function(l) { celulas[l] = {}; colunasM.forEach(function(cn) { celulas[l][cn] = 0; }); });
  acoes.forEach(function(a) { celulas[a.matrizLinha][a.matrizColuna]++; });
  var matriz = { linhas: linhasM, colunas: colunasM, celulas: celulas, total: acoes.length };

  // ── "Para agir hoje" ──
  function alerta(partes, aba, filtro) { return { partes: partes, aba: aba, filtro: filtro }; }
  function forte(t) { return { texto: String(t), forte: true }; }
  function texto(t) { return { texto: t, forte: false }; }
  var alertas = [];
  var porProj = {};
  acoes.forEach(function(a) { if (a.flags.atrasadaCritica) porProj[a.projeto] = (porProj[a.projeto] || 0) + 1; });
  Object.keys(porProj).sort(function(x, y) { return (porProj[y] - porProj[x]) || x.localeCompare(y, 'pt-BR'); }).slice(0, 3).forEach(function(p) {
    var n = porProj[p];
    alertas.push(alerta([forte(n), texto(n === 1 ? ' ação crítica/alta atrasada em ' : ' ações críticas/altas atrasadas em '), forte(p)], 'acoes', { flag: 'atrasadaCritica', projeto: p }));
  });
  var nParada = acoes.filter(function(a) { return a.flags.parada; }).length;
  if (nParada) alertas.push(alerta([forte(nParada), texto(nParada === 1 ? ' ação sem movimento há ' : ' ações sem movimento há '), forte(paradaDias), texto(' dias ou mais')], 'acoes', { flag: 'parada' }));
  var nSemResp = acoes.filter(function(a) { return a.flags.semResponsavel; }).length;
  if (nSemResp) alertas.push(alerta([forte(nSemResp), texto(nSemResp === 1 ? ' ação sem responsável' : ' ações sem responsável')], 'acoes', { flag: 'semResponsavel' }));
  var top = listaP.length ? listaP[0] : null; // listaP já vem ordenada por atrasadas desc
  if (top && top.atrasadas >= 2) alertas.push(alerta([forte(top.nome), texto(' concentra '), forte(top.atrasadas), texto(' ações atrasadas')], 'pessoas', { pessoa: top.email }));
  var nVence = acoes.filter(function(a) { return a.flags.vence; }).length;
  if (nVence) alertas.push(alerta([forte(nVence), texto(nVence === 1 ? ' ação vence nos próximos ' : ' ações vencem nos próximos '), forte(janela), texto(' dias')], 'acoes', { flag: 'vence' }));
  alertas = alertas.slice(0, 5);

  return { pessoas: listaP, semResponsavel: semResp, projetos: listaProj, totais: totais, acoes: acoes, matriz: matriz, alertas: alertas };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node tests/test_indicadores_front.js && npm test`
Expected: sem erro; todos os arquivos verdes (o bloco 1 do teste continua passando: `pessoas/projetos/totais` não mudaram de comportamento).

- [ ] **Step 5: Commit**

```bash
git add tests/test_indicadores_front.js tarefas-shadcn.html
git commit -m "feat(front): calcularIndicadores — ações com severidade e estagnação, matriz prioridade × situação e alertas"
```

---

### Task 3: View — "Parada há", carga da movimentação, "Para agir hoje", abas internas e matriz

**Files:**
- Modify: `tarefas-shadcn.html`
  - markup `#indicadoresView` (≈ 812–841): seletor, bloco Agir, abas, contêineres
  - CSS junto das regras `.ind-*`
  - JS: globais (junto de `var indUltimo`), `setModo` (ramo `isInd`), `lerFiltrosInd`, `renderIndicadores`, novas `carregarMovimentoInd`, `renderIndAgir`, `aplicarAlerta`, `setAbaInd`, `renderIndAbas`, `renderIndAcoes`, `renderIndMatriz`; `@media print`; mock (`case 'indicadoresMovimento'`)

**Interfaces:**
- Consumes: `calcularIndicadores` (Task 2) com `dados.movimento` e `filtros.paradaDias`; rota `indicadoresMovimento` (Task 1) via `chamarAPI`; `renderIndPessoas`, `renderIndProjetos`, `esc`, `toast`.
- Produces: globais `indParadaDias` (7), `indAba` ('acoes'), `indMovimento` (mapa ou `null`), `indMovimentoErro` (bool), `indFiltroAcoes` ({} | {flag} | {flag, projeto} | {prioridade, coluna}); funções `setAbaInd(aba)`, `aplicarAlerta(i)`, `renderIndAcoes(res)` (chama `renderIndMatriz(res)` e, a partir da Task 4, `renderIndLista(res)`), `renderIndMatriz(res)`, `limparFiltroAcoes()`. Contêineres `#indAgir`, `#indAbas`, `#indAcoes` (com `#indLista` e `#indMatriz` dentro), `#indPessoasSec`, `#indProjetosSec`.

- [ ] **Step 1: Markup** — substituir o conteúdo de `#indicadoresView` a partir de `<div class="ind-filtros" id="indFiltros">` até o `</div>` que fecha a view por:

```html
  <div class="ind-filtros" id="indFiltros">
    <label>Unidade <select id="indUnidade" onchange="renderIndicadores()"></select></label>
    <label>Projeto <select id="indProjeto" onchange="renderIndicadores()"></select></label>
    <label>Próximas do prazo <select id="indJanela" onchange="renderIndicadores()">
      <option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option>
    </select></label>
    <label>Parada há <select id="indParada" onchange="renderIndicadores()">
      <option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option>
    </select></label>
    <label class="ind-busca">Buscar <input type="text" id="indBusca" placeholder="Ação, projeto, pessoa…" autocomplete="off" oninput="renderIndicadores()"></label>
  </div>
  <div class="home-stat-grid ind-totais">
    <div class="home-stat-card"><div class="stat-num" id="indTotAtivas">—</div><div class="stat-label">Ativas</div></div>
    <div class="home-stat-card"><div class="stat-num" id="indTotBloqueadas">—</div><div class="stat-label">Bloqueadas</div></div>
    <div class="home-stat-card" id="indTotAtrasadasCard"><div class="stat-num" id="indTotAtrasadas">—</div><div class="stat-label">Atrasadas</div></div>
    <div class="home-stat-card"><div class="stat-num" id="indTotProximas">—</div><div class="stat-label" id="indTotProximasLabel">Próximas (7 dias)</div></div>
  </div>
  <div class="ind-agir" id="indAgir"></div>
  <div class="ind-abas" id="indAbas">
    <button type="button" class="ind-aba on" data-aba="acoes" onclick="setAbaInd('acoes')">Ações</button>
    <button type="button" class="ind-aba" data-aba="pessoas" onclick="setAbaInd('pessoas')">Pessoas</button>
    <button type="button" class="ind-aba" data-aba="projetos" onclick="setAbaInd('projetos')">Projetos</button>
  </div>
  <div class="home-section" id="indAcoes">
    <div id="indLista"></div>
    <div class="home-section-title" style="margin-top:24px">Prioridade × situação</div>
    <div id="indMatriz"></div>
  </div>
  <div class="home-section" id="indPessoasSec" style="display:none">
    <div id="indPessoas"></div>
  </div>
  <div class="home-section" id="indProjetosSec" style="display:none">
    <div id="indProjetos"></div>
  </div>
</div>
```

- [ ] **Step 2: CSS** — acrescentar após `.ind-totais { margin-bottom: 28px; }`:

```css
    .ind-agir { border: 1px solid var(--border); border-left: 4px solid var(--dourado); background: var(--dourado-bg); border-radius: var(--radius); padding: 14px 18px; margin-bottom: 24px; }
    .ind-agir-titulo { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-secondary); margin-bottom: 8px; }
    .ind-agir-item { display: block; padding: 4px 0; font-size: .95rem; color: var(--foreground); cursor: pointer; }
    .ind-agir-item:hover { text-decoration: underline; }
    .ind-agir-item b { color: var(--primary); }
    .ind-agir-ok { color: var(--muted-foreground); font-size: .9rem; }
    .ind-abas { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
    .ind-aba { background: none; border: none; border-bottom: 2px solid transparent; padding: 10px 14px; font-size: .9rem; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
    .ind-aba.on { color: var(--primary); border-bottom-color: var(--primary); }
    .ind-matriz { border-collapse: collapse; font-size: .875rem; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .ind-matriz th, .ind-matriz td { padding: 10px 14px; border-bottom: 1px solid var(--border); text-align: center; min-width: 96px; }
    .ind-matriz th { background: var(--muted-bg); color: var(--text-secondary); font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; }
    .ind-matriz th:first-child, .ind-matriz td:first-child { text-align: left; font-weight: 600; }
    .ind-matriz td.m0 { color: var(--muted-foreground); }
    .ind-matriz td.m1 { background: var(--muted-bg); font-weight: 600; cursor: pointer; }
    .ind-matriz td.m2 { background: var(--hover-bg); font-weight: 700; cursor: pointer; }
    .ind-matriz td.late.m1 { background: var(--late-bg); color: var(--erro-cor); }
    .ind-matriz td.late.m2 { background: var(--late-bg); color: var(--erro-cor); box-shadow: inset 0 0 0 1px var(--erro-cor); }
    .ind-matriz td.on { outline: 2px solid var(--primary); outline-offset: -2px; }
    .ind-matriz td.total, .ind-matriz tr.total td { color: var(--text-secondary); font-weight: 600; }
```
E dentro do bloco `@media print { … }`: `.ind-abas, .ind-agir-item:hover { text-decoration: none; }` **e** `.ind-abas { display: none !important; }` (acrescentar a segunda regra; a primeira pode ser omitida).

- [ ] **Step 3: JS — globais** (junto de `var indUltimo = null;`)

```js
var indParadaDias    = 7;      // limiar de "parada há N dias"
var indAba           = 'acoes';// aba interna ativa: 'acoes' | 'pessoas' | 'projetos'
var indMovimento     = null;   // mapa {idTarefa: 'yyyy-MM-ddTHH:mm:ss'} da rota indicadoresMovimento
var indMovimentoErro = false;  // rota falhou nesta abertura da aba
var indFiltroAcoes   = {};     // {} | {flag} | {flag, projeto} | {prioridade, coluna}
```

- [ ] **Step 4: JS — `setModo` carrega a movimentação ao abrir a aba**

No ramo `} else if (isInd) {` de `setModo`, substituir `renderIndicadores();` por:
```js
    indMovimento = null; indMovimentoErro = false;
    renderIndicadores();       // primeiro render sem estagnação ("…")
    carregarMovimentoInd();    // segundo render quando a rota voltar
```

- [ ] **Step 5: JS — filtros e render** — substituir `lerFiltrosInd` e `renderIndicadores` por:

```js
function lerFiltrosInd() {
  indFiltroUnidade = document.getElementById('indUnidade').value;
  indFiltroProjeto = document.getElementById('indProjeto').value;
  indJanelaDias    = Number(document.getElementById('indJanela').value) || 7;
  indParadaDias    = Number(document.getElementById('indParada').value) || 7;
  indBuscaTermo    = document.getElementById('indBusca').value.trim().toLowerCase();
}

function carregarMovimentoInd() {
  chamarAPI({ acao: 'indicadoresMovimento' }, function(d) {
    if (d && d.erro) { indMovimentoErro = true; toast('Não foi possível calcular a estagnação: ' + d.erro, true); }
    else indMovimento = (d && d.movimento) || {};
    if (modoAtual === 'indicadores') renderIndicadores();
  });
}

function renderIndicadores() {
  if (!currentUserPodeExcluir) return;
  var primeiraVez = indFiltroUnidade === null;
  if (primeiraVez) popularFiltrosInd(); else { lerFiltrosInd(); popularFiltrosInd(); }
  document.getElementById('indParada').value = String(indParadaDias);
  indUltimo = calcularIndicadores(
    { tarefas: tarefas, cklStatus: cklStatus, usuarios: usuarios, projetos: projetos, movimento: indMovimento },
    { unidade: indFiltroUnidade, projeto: indFiltroProjeto, janelaDias: indJanelaDias, paradaDias: indParadaDias },
    new Date(),
    { parseData: parseData, dataValida: dataValida, nomeDeEmail: nomeDeEmail }
  );
  var t = indUltimo.totais;
  document.getElementById('indTotAtivas').textContent    = t.ativas;
  document.getElementById('indTotBloqueadas').textContent = t.bloqueadas;
  document.getElementById('indTotAtrasadas').textContent = t.atrasadas;
  document.getElementById('indTotProximas').textContent  = t.proximas;
  document.getElementById('indTotProximasLabel').textContent = 'Próximas (' + indJanelaDias + ' dias)';
  document.getElementById('indTotAtrasadasCard').className = 'home-stat-card' + (t.atrasadas > 0 ? ' alert' : '');
  renderIndAgir(indUltimo);
  renderIndAbas();
  if (indAba === 'acoes')         renderIndAcoes(indUltimo);
  else if (indAba === 'pessoas')  renderIndPessoas(indUltimo);
  else                            renderIndProjetos(indUltimo);
}

// "Para agir hoje": frases clicáveis geradas pelo cálculo
function renderIndAgir(res) {
  var el = document.getElementById('indAgir');
  var html = '<div class="ind-agir-titulo">Para agir hoje</div>';
  if (!res.alertas.length) {
    html += '<div class="ind-agir-ok">Nenhuma ação exige atenção imediata.</div>';
  } else {
    res.alertas.forEach(function(a, i) {
      html += '<a class="ind-agir-item" data-i="' + i + '">' + a.partes.map(function(p) { return p.forte ? '<b>' + esc(p.texto) + '</b>' : esc(p.texto); }).join('') + '</a>';
    });
  }
  el.innerHTML = html;
  Array.from(el.querySelectorAll('.ind-agir-item')).forEach(function(a) {
    a.addEventListener('click', function() { aplicarAlerta(Number(a.getAttribute('data-i'))); });
  });
}

function aplicarAlerta(i) {
  var a = indUltimo && indUltimo.alertas[i];
  if (!a) return;
  indAba = a.aba;
  if (a.aba === 'pessoas') {
    var p = indUltimo.pessoas.filter(function(x) { return x.email === a.filtro.pessoa; })[0];
    document.getElementById('indBusca').value = p ? p.nome : '';
    indFiltroAcoes = {};
  } else {
    document.getElementById('indBusca').value = '';
    indFiltroAcoes = a.filtro || {};
  }
  renderIndicadores();
  var abas = document.getElementById('indAbas');
  if (abas && abas.scrollIntoView) abas.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function setAbaInd(aba) {
  indAba = aba;
  renderIndicadores();
}

function renderIndAbas() {
  Array.from(document.querySelectorAll('#indAbas .ind-aba')).forEach(function(b) { b.classList.toggle('on', b.getAttribute('data-aba') === indAba); });
  document.getElementById('indAcoes').style.display       = indAba === 'acoes'    ? '' : 'none';
  document.getElementById('indPessoasSec').style.display  = indAba === 'pessoas'  ? '' : 'none';
  document.getElementById('indProjetosSec').style.display = indAba === 'projetos' ? '' : 'none';
}

function limparFiltroAcoes() { indFiltroAcoes = {}; renderIndicadores(); }

// Aba Ações: matriz (esta task) e lista de risco (Task 4 acrescenta renderIndLista aqui)
function renderIndAcoes(res) {
  renderIndMatriz(res);
}

function renderIndMatriz(res) {
  var el = document.getElementById('indMatriz'), m = res.matriz;
  if (!m.total) { el.innerHTML = '<div class="ind-vazio">Nenhuma ação nos filtros atuais.</div>'; return; }
  var html = '<table class="ind-matriz"><thead><tr><th>Prioridade</th>';
  m.colunas.forEach(function(c) { html += '<th>' + esc(c) + '</th>'; });
  html += '<th>Total</th></tr></thead><tbody>';
  var totCol = {}; m.colunas.forEach(function(c) { totCol[c] = 0; });
  m.linhas.forEach(function(l) {
    var totL = 0;
    html += '<tr><td>' + esc(l) + '</td>';
    m.colunas.forEach(function(c) {
      var n = m.celulas[l][c]; totL += n; totCol[c] += n;
      var cls = (n === 0 ? 'm0' : n <= 2 ? 'm1' : 'm2') + (c === 'Atrasada' ? ' late' : '')
        + (indFiltroAcoes.prioridade === l && indFiltroAcoes.coluna === c ? ' on' : '');
      html += '<td class="' + cls + '"' + (n ? ' data-l="' + esc(l) + '" data-c="' + esc(c) + '"' : '') + '>' + n + '</td>';
    });
    html += '<td class="total">' + totL + '</td></tr>';
  });
  html += '<tr class="total"><td>Total</td>';
  m.colunas.forEach(function(c) { html += '<td>' + totCol[c] + '</td>'; });
  html += '<td>' + m.total + '</td></tr></tbody></table>';
  el.innerHTML = html;
  Array.from(el.querySelectorAll('td[data-l]')).forEach(function(td) {
    td.addEventListener('click', function() {
      var l = td.getAttribute('data-l'), c = td.getAttribute('data-c');
      indFiltroAcoes = (indFiltroAcoes.prioridade === l && indFiltroAcoes.coluna === c) ? {} : { prioridade: l, coluna: c };
      renderIndicadores();
    });
  });
}
```

- [ ] **Step 6: Mock do preview** — no `switch (acao)` do mock, após `case 'listarInteracoes': …; break;` inserir:

```js
      case 'indicadoresMovimento': {
        var mov = {};
        MOCK_TAREFAS.forEach(function(t, i) {
          var d = new Date(); d.setDate(d.getDate() - [2, 12, 30, 0, 9, 45, 1][i % 7]);
          mov[String(t.ID)] = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + 'T09:00:00';
        });
        resp = { movimento: mov, geradoEm: '' };
        break;
      }
```

- [ ] **Step 7: Verificar**

Sintaxe: extrair os `<script>` com Node para um `.js` fora do repo e `node --check`; `npm test` verde. Preview: abrir Indicadores como gestor → seletor "Parada há" presente; bloco "Para agir hoje" com frases (ou "Nenhuma ação exige atenção imediata."); abas Ações/Pessoas/Projetos alternam e só a ativa aparece; aba Ações mostra a matriz com totais e células clicáveis (clique marca `.on` e o clique de novo desmarca); clicar numa frase de pessoa muda para Pessoas com a busca preenchida; clicar numa frase de ação vai para Ações; trocar "Parada há" para 30 muda a frase de estagnação; console sem erros. Pessoas e Projetos continuam iguais.

- [ ] **Step 8: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat(front): indicadores — Parada há, Para agir hoje, abas internas e matriz prioridade × situação"
```

---

### Task 4: Aba Ações — chips, lista de risco e clique abrindo o modal

**Files:**
- Modify: `tarefas-shadcn.html` — CSS junto das regras `.ind-matriz`; JS: `renderIndAcoes` (chamar a lista), nova `renderIndLista(res)` e helpers `indPrazoRel(a)`, `indParadaTxt(a)`, `indSevTexto(a)`; `fecharModal` (re-render)

**Interfaces:**
- Consumes: `indUltimo.acoes` (Task 2), `indFiltroAcoes`, `indBuscaTermo`, `indMovimento`, `indMovimentoErro`, `limparFiltroAcoes`, `abrirModal(tarefa, 'view')`, `tarefas`, `avatarInitials`, `badgePrio`, `corDoProjeto`, `esc`.
- Produces: `renderIndLista(res)`.

- [ ] **Step 1: CSS**

```css
    .ind-acoes-filtros { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .ind-chip { border: 1px solid var(--border); background: var(--card); color: var(--text-secondary); border-radius: 999px; padding: 4px 12px; font-size: .78rem; font-weight: 600; cursor: pointer; }
    .ind-chip:hover { background: var(--hover-bg); }
    .ind-chip.on { background: var(--primary); border-color: var(--primary); color: #fff; }
    .ind-chip .n { opacity: .75; font-weight: 500; margin-left: 4px; }
    .ind-acoes td:nth-child(2), .ind-acoes th:nth-child(2) { text-align: left; white-space: normal; }
    .ind-acoes td:nth-child(3), .ind-acoes th:nth-child(3) { text-align: left; }
    .ind-acoes .ind-titulo small { display: block; color: var(--muted-foreground); font-size: .72rem; margin-top: 2px; }
    .ind-acoes .proj-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
    .ind-acoes .ind-barra { width: 90px; margin: 0; display: inline-block; vertical-align: middle; }
    .ind-acoes .ind-barra + small { margin-left: 6px; color: var(--muted-foreground); }
    .sev { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: .72rem; font-weight: 700; white-space: nowrap; }
    .sev-1, .sev-2 { background: var(--late-bg); color: var(--erro-cor); }
    .sev-1 { box-shadow: inset 0 0 0 1px var(--erro-cor); }
    .sev-3 { background: var(--warn-bg); color: var(--warn-ink); }
    .sev-4 { background: var(--warn-bg); color: var(--warn-ink); opacity: .85; }
    .sev-5 { background: var(--dourado-bg); color: var(--dourado-hover); }
    .sev-6, .sev-7 { background: var(--muted-bg); color: var(--text-secondary); }
    .sev-9 { background: var(--verde-bg); color: var(--primary); }
```
E no `@media print`: acrescentar `.ind-acoes-filtros { display: none !important; }`.

- [ ] **Step 2: JS — a lista** (inserir logo após `renderIndMatriz`), e em `renderIndAcoes` acrescentar `renderIndLista(res);` **antes** de `renderIndMatriz(res);`:

```js
var IND_SEV_TXT = { 1: 'Atrasada · crítica', 2: 'Atrasada', 3: 'Bloqueada', 4: 'Parada', 5: 'Vence', 6: 'Sem responsável', 7: 'Sem prazo', 9: 'Em dia' };
var IND_CHIPS = [
  { k: '',               rotulo: 'Todas' },
  { k: 'atrasada',       rotulo: 'Atrasadas' },
  { k: 'bloqueada',      rotulo: 'Bloqueadas' },
  { k: 'parada',         rotulo: 'Paradas' },
  { k: 'vence',          rotulo: 'Vencem' },
  { k: 'semResponsavel', rotulo: 'Sem responsável' },
  { k: 'semPrazo',       rotulo: 'Sem prazo' },
  { k: 'saudavel',       rotulo: 'Em dia' }
];

function indSevTexto(a) { return IND_SEV_TXT[a.severidade] || 'Em dia'; }

function indPrazoRel(a) {
  if (a.flags.atrasada) return '<span class="ruim">há ' + a.diasAtraso + ' d</span>';
  if (a.diasParaPrazo === null) return '<span class="zero">—</span>';
  if (a.diasParaPrazo === 0) return '<span class="aviso">hoje</span>';
  return 'em ' + a.diasParaPrazo + ' d';
}

function indParadaTxt(a) {
  if (indMovimento === null && !indMovimentoErro) return '<span class="zero">…</span>';
  if (a.diasParada === null) return '<span class="zero">—</span>';
  return '<span class="' + (a.flags.parada ? 'aviso' : '') + '">' + a.diasParada + ' d</span>';
}

function indFiltraAcao(a) {
  var f = indFiltroAcoes || {};
  if (f.prioridade && f.coluna) return a.matrizLinha === f.prioridade && a.matrizColuna === f.coluna;
  if (f.flag === 'saudavel') return a.severidade === 9;
  if (f.flag && !a.flags[f.flag]) return false;
  if (f.projeto && a.projeto !== f.projeto) return false;
  return true;
}

function renderIndLista(res) {
  var el = document.getElementById('indLista');
  var f = indFiltroAcoes || {};
  // Chips (contagens sobre todas as ações, sem a busca)
  var html = '<div class="ind-acoes-filtros">';
  IND_CHIPS.forEach(function(c) {
    var n = c.k === '' ? res.acoes.length : c.k === 'saudavel' ? res.acoes.filter(function(a) { return a.severidade === 9; }).length : res.acoes.filter(function(a) { return a.flags[c.k]; }).length;
    var on = (!f.prioridade && (f.flag || '') === c.k && !f.projeto);
    html += '<button type="button" class="ind-chip' + (on ? ' on' : '') + '" data-k="' + c.k + '">' + c.rotulo + '<span class="n">' + n + '</span></button>';
  });
  if (f.prioridade || f.projeto) {
    html += '<button type="button" class="ind-chip on" data-k="__limpar">' + esc(f.prioridade ? (f.prioridade + ' · ' + f.coluna) : ('Projeto: ' + f.projeto)) + ' ✕</button>';
  }
  html += '</div>';

  var lista = res.acoes.filter(indFiltraAcao);
  if (indBuscaTermo) lista = lista.filter(function(a) { return (a.tarefa + ' ' + a.projeto + ' ' + a.responsavelNome).toLowerCase().indexOf(indBuscaTermo) !== -1; });

  if (!lista.length) {
    html += '<div class="ind-vazio">Nenhuma ação nos filtros atuais.</div>';
  } else {
    html += '<table class="ind-tabela ind-acoes"><thead><tr><th>Situação</th><th>Ação</th><th>Responsável</th><th>Prioridade</th><th>Prazo</th><th>Parada há</th><th>Desdobramentos</th></tr></thead><tbody>';
    lista.forEach(function(a) {
      var pct = a.cklTotal ? Math.round(a.cklFeitos * 100 / a.cklTotal) : 0;
      html += '<tr data-id="' + esc(String(a.id)) + '">'
        + '<td><span class="sev sev-' + a.severidade + '">' + esc(indSevTexto(a)) + '</span></td>'
        + '<td><div class="ind-titulo">' + esc(a.tarefa) + '<small><span class="proj-dot" style="background:' + corDoProjeto(a.projeto) + '"></span>' + esc(a.projeto) + '</small></div></td>'
        + '<td>' + (a.responsavel ? '<div class="ind-pessoa"><span class="avatar">' + esc(avatarInitials(a.responsavel)) + '</span><span>' + esc(a.responsavelNome.split(' ')[0]) + '</span></div>' : '<span class="zero">—</span>') + '</td>'
        + '<td><span class="badge ' + badgePrio(a.prioridade) + '">' + esc(a.prioridade) + '</span></td>'
        + '<td>' + indPrazoRel(a) + '</td>'
        + '<td>' + indParadaTxt(a) + '</td>'
        + '<td>' + (a.cklTotal ? '<span class="ind-barra"><span style="width:' + pct + '%"></span></span><small>' + a.cklFeitos + '/' + a.cklTotal + '</small>' : '<span class="zero">—</span>') + '</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
  }
  el.innerHTML = html;

  Array.from(el.querySelectorAll('.ind-chip')).forEach(function(b) {
    b.addEventListener('click', function() {
      var k = b.getAttribute('data-k');
      indFiltroAcoes = (k === '__limpar' || k === '') ? {} : { flag: k };
      renderIndicadores();
    });
  });
  Array.from(el.querySelectorAll('tbody tr[data-id]')).forEach(function(tr) {
    tr.addEventListener('click', function() {
      var id = tr.getAttribute('data-id');
      var t = tarefas.filter(function(x) { return String(x.ID) === id; })[0];
      if (t) abrirModal(t, 'view');
    });
  });
}
```

- [ ] **Step 3: JS — re-render ao fechar o modal**

Em `fecharModal()`, acrescentar como última linha do corpo:
```js
  if (modoAtual === 'indicadores') renderIndicadores(); // reflete marcações feitas no modal
```

- [ ] **Step 4: Verificar**

Sintaxe (`node --check` nos scripts extraídos) e `npm test` verdes. Preview como gestor, aba Ações: chips com contagens; lista ordenada por severidade com chips de situação coloridos, projeto com bolinha, responsável com avatar, prazo relativo ("há N d" vermelho, "em N d", "hoje", "—"), "Parada há" com "…" até a rota do mock voltar e depois "N d" (âmbar quando ≥ limiar), barra de desdobramentos; clicar num chip filtra (e "Todas" limpa); clicar numa célula da matriz filtra a lista e mostra o chip de limpar "Prioridade · Coluna ✕"; clicar numa frase do "Para agir hoje" aplica o filtro correspondente; a busca filtra por título/projeto/nome; clicar numa linha abre o modal da tarefa em visualização por cima da view, e fechar o modal re-renderiza (marcar um item do checklist no modal e fechar atualiza a barra de desdobramentos). Console sem erros. Impressão sem chips/abas.

- [ ] **Step 5: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat(front): indicadores — lista de risco por ação com chips, prazo relativo, estagnação e modal"
```

---

### Task 5: Publicar e registrar

**Files:**
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Testes e push com conferência da lista**

```bash
npm test
npx clasp push -f
```
Esperado: todos os arquivos de teste verdes; o push lista **exatamente 7 arquivos** (`appsscript.json`, `Code.gs`, `Estilos_Fontes.html`, `ImportacaoPlanos.gs`, `ImportacaoUsuarios.gs`, `tarefas-shadcn.html`, `tarefas.html`). Qualquer outro nome → parar e corrigir `.claspignore` antes do deploy.

- [ ] **Step 2: Nova versão na implantação existente**

```bash
npx clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8 -d "indicadores: Para agir hoje, lista de risco, estagnação (rota indicadoresMovimento) e matriz"
```
Esperado: `Deployed AKfycbyFDVg… @69` (anotar o número real).

- [ ] **Step 3: Verificar em produção**

Como Admin, hard reload → Indicadores: "Para agir hoje" com frases reais; aba Ações com a lista (coluna "Parada há" preenchida após ~2 s); matriz; clique abrindo o modal. Chamada direta à rota pelo console do app (`chamarAPI({acao:'indicadoresMovimento'}, console.log)`) devolve `movimento` com ~80 chaves. Editar uma tarefa e conferir na aba Log da planilha a linha `ATUALIZAR | ID_Tarefa | | <id>`.

- [ ] **Step 4: HANDOFF**

Novo bloco "### Último bloco — 09/09: Indicadores — monitoramento de ações (@NN)" com: o que entrou (Para agir hoje, abas, lista de risco, matriz, estagnação), a rota nova e o registro do ID no Log (com a observação de que edições anteriores a esta versão não têm ID), decisões (severidade 1..7/9, totais só por projeto, ordenação fixa da lista), o que ficou fora (ritmo semanal, tendência, e-mail). Atualizar o bullet "Publicado em 08/09" de "Onde estamos" com a nova versão e a tabela de endpoints do `CLAUDE.md` com `indicadoresMovimento` (uma linha).

- [ ] **Step 5: Commit**

```bash
git add docs/HANDOFF.md CLAUDE.md
git commit -m "docs: handoff e CLAUDE.md — indicadores de monitoramento de ações publicados"
```

---

## Self-review

- **Spec coverage:** §1 estrutura/abas/Parada há → Task 3; §2.1 Log com ID → Task 1 (Step 5 + teste); §2.2 rota, cache, chamada ao abrir, "…" e toast de erro → Task 1 + Task 3 (`carregarMovimentoInd`, `indParadaTxt`); §3.1 `acoes` (campos, flags, severidade, ordenação, unidade não afeta) → Task 2 + testes; §3.2 matriz (colunas exclusivas, prioridade vazia → Média) → Task 2; §3.3 alertas (5 regras, limite 3 da regra 1, máximo 5, regra 4 sobre `pessoas` filtradas, lista vazia) → Task 2 + testes; §4.1 Agir clicável e seletor → Task 3; §4.2 chips, lista, colunas, clique no modal, re-render ao fechar, vazio, matriz clicável com chip de limpar → Tasks 3–4; §4.3 abas → Task 3; §4.4 impressão → Tasks 3–4; §5 CSS → Tasks 3–4; §6 testes → Tasks 1–2 (Node) + verificações manuais; publicação → Task 5.
- **Placeholders:** nenhum. (A `renderIndAcoes` da Task 3 renderiza a matriz de verdade; a Task 4 acrescenta a lista.)
- **Consistência:** `dados.movimento`/`filtros.paradaDias` (Task 2) usados em `renderIndicadores` (Task 3); `Acao.matrizLinha/matrizColuna` (Task 2) usados por `indFiltraAcao` (Task 4) e pelo clique da matriz (Task 3); `Alerta.partes/aba/filtro` (Task 2) usados por `renderIndAgir`/`aplicarAlerta` (Task 3) e por `indFiltraAcao` (`flag`+`projeto`, Task 4); `indMovimento`/`indMovimentoErro` (Task 3) lidos por `indParadaTxt` (Task 4); rota `indicadoresMovimento` (Task 1) chamada por `carregarMovimentoInd` (Task 3) e mockada (Task 3).
