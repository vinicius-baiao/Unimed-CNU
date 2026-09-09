# Gerenciamento de acessos (super-admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba **Acessos** no Cora, visível só para o super-admin (Aurélio), para ver a aba Usuários e editar perfil/unidade/cargo inline, incluir e remover usuários.

**Architecture:** Backend `Code.gs` ganha o conceito de super-admin (`SUPER_ADMINS`/`ehSuperAdmin`, exposto em `bootstrap().usuario.superAdmin`) e três rotas de escrita na aba Usuários (`atualizarUsuario`, `adicionarUsuario`, `removerUsuario`), todas travadas por `ehSuperAdmin` e invalidando os caches de perfis/listas. Frontend `tarefas-shadcn.html` ganha o item de rail, a view `#acessosView`, o modo `'acessos'` em `setModo`, e as funções `renderAcessos`/`renderAcessosTabela`/`salvarCampoUsuario`/`salvarNovoUsuario`/`confirmarRemoverUsuario`. Spec: `docs/superpowers/specs/2026-09-09-gerenciamento-de-acessos-design.md`.

**Tech Stack:** Apps Script (ES5), HTML/CSS/JS vanilla (ES5 + `Array.from`), testes Node via `tests/harness.js` (`npm test`).

## Global Constraints

- ES5 no `.gs` e no front (`var`, `function`; `Array.from` aceito no front).
- Todo dado dinâmico em `innerHTML` passa por `esc()`.
- Perfis válidos, literais exatos: `'Admin'`, `'Gestor'`, `'Usuário Padrão'`.
- Mensagens de erro exatas (o front e os testes dependem delas):
  `'Apenas o administrador do sistema.'`, `'Usuário não encontrado.'`, `'Perfil inválido.'`,
  `'O administrador do sistema permanece Admin.'`, `'Nome é obrigatório.'`,
  `'E-mail deve ser @unimedcnu.coop.br ou @unimednacional.coop.br'`, `'Este e-mail já está cadastrado.'`,
  `'O administrador do sistema não pode ser removido.'`.
- Guardrails de repositório: `git status --short` antes de editar; **só `Edit`** nos arquivos alvo (nunca `Write`,
  nunca criar arquivos fora do listado); temporários fora do repo; **não commitar** (o orquestrador commita).
- Nunca tocar em `.claude/`, `.clasp.json`, `.superpowers/`.

---

### Task 1: Backend — super-admin + 3 rotas + testes

**Files:**
- Modify: `Code.gs` (constantes de perfil ~linha 493-512; `bootstrap()` ~648; `doGet` switch ~127-137)
- Create: `tests/test_acessos.js`

**Interfaces:**
- Produces: `ehSuperAdmin(email) → boolean`; `bootstrap().usuario.superAdmin`; `getUsuario` com `superAdmin`;
  rotas `atualizarUsuario(dados)`, `adicionarUsuario(dados)`, `removerUsuario(dados)` (retornos na spec §2).

- [ ] **Step 1: Criar o teste `tests/test_acessos.js`** (conteúdo integral)

```js
// Gerenciamento de acessos: super-admin, atualizarUsuario, adicionarUsuario, removerUsuario.
'use strict';
const assert = require('assert');
const { carregar } = require('./harness');
const J = v => JSON.parse(JSON.stringify(v));

const SUPER  = 'aurelio.pereira.ext@unimedcnu.coop.br';
const ADMIN2 = 'outro.admin@unimedcnu.coop.br';
const GESTOR = 'gestora@unimedcnu.coop.br';
const PADRAO = 'padrao@unimednacional.coop.br';
const cabT = ['ID','Tarefa','Projeto','Responsável','Prazo','Status','Prioridade','Criado por','Data criação','Observações','Ativo','Event ID'];
const cabC = ['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão','Responsavel'];
const cabL = ['ID','Data/Hora','Editor','Ação','Campo','Valor Anterior','Valor Novo'];
function abas() {
  return {
    Usuários: [['Nome','Email','Perfil','Unidade','Cargo'],
      ['Aurélio',     SUPER,  'Admin',          'Rede Ambulatorial', 'Analista'],
      ['Outro Admin', ADMIN2, 'Admin',          'Rede Ambulatorial', ''],
      ['Gestora',     GESTOR, 'Gestor',         'Negociação',        'Coord.'],
      ['Padrão',      PADRAO, 'Usuário Padrão', '',                  '']],
    Tarefas: [cabT], Checklist_Status: [cabC], Log: [cabL]
  };
}
const escUsuarios = ctx => ctx._escritas.filter(e => e.aba === 'Usuários');
const logsAcesso  = ctx => ctx._escritas.filter(e => e.aba === 'Log' && e.op === 'appendRow').map(e => e.args.slice(3));

// 1. superAdmin no bootstrap e no getUsuario
{
  const ctx = carregar({ abas: abas(), email: SUPER });
  assert.strictEqual(J(ctx.bootstrap()).usuario.superAdmin, true);
  assert.strictEqual(ctx.ehSuperAdmin('AURELIO.PEREIRA.EXT@unimedcnu.coop.br '), true, 'case/espaço-insensitive');
  const ctx2 = carregar({ abas: abas(), email: ADMIN2 });
  const b2 = J(ctx2.bootstrap()).usuario;
  assert.strictEqual(b2.superAdmin, false);
  assert.strictEqual(b2.admin, true);
  assert.strictEqual(ctx2.ehSuperAdmin(''), false);
}

// 2. Rotas negadas a quem não é super-admin (mesmo Admin), sem escrita
{
  const ctx = carregar({ abas: abas(), email: ADMIN2 });
  assert.deepStrictEqual(J(ctx.atualizarUsuario({ email: GESTOR, perfil: 'Admin' })), { erro: 'Apenas o administrador do sistema.' });
  assert.deepStrictEqual(J(ctx.adicionarUsuario({ nome: 'X', email: 'x@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'Apenas o administrador do sistema.' });
  assert.deepStrictEqual(J(ctx.removerUsuario({ email: PADRAO })), { erro: 'Apenas o administrador do sistema.' });
  assert.strictEqual(ctx._escritas.length, 0);
}

// 3. atualizarUsuario
{
  const ctx = carregar({ abas: abas(), email: SUPER });
  ctx.getPerfil(GESTOR); ctx.listarUsuarios();           // aquece os caches
  assert.ok('perfis_v1' in ctx._cache && 'usuarios_v1' in ctx._cache);
  const r = J(ctx.atualizarUsuario({ email: GESTOR, perfil: 'Admin' }));
  assert.strictEqual(r.sucesso, true);
  assert.strictEqual(r.alterados, 1);
  assert.deepStrictEqual(r.usuario, { nome: 'Gestora', email: GESTOR, perfil: 'Admin', unidade: 'Negociação', cargo: 'Coord.' });
  assert.deepStrictEqual(escUsuarios(ctx), [{ aba: 'Usuários', op: 'setValue', args: [4, 3, 'Admin'] }]);
  assert.deepStrictEqual(logsAcesso(ctx), [['ACESSO', GESTOR, 'Gestor', 'perfil: Admin']]);
  assert.ok(!('perfis_v1' in ctx._cache) && !('usuarios_v1' in ctx._cache), 'caches limpos');
  assert.strictEqual(ctx.getPerfil(GESTOR), 'Admin', 'perfil novo já vale');

  // vários campos de uma vez; e-mail em caixa diferente localiza a linha
  const ctx2 = carregar({ abas: abas(), email: SUPER });
  const r2 = J(ctx2.atualizarUsuario({ email: 'PADRAO@unimednacional.coop.br', unidade: 'Rede', cargo: ' Exec. ' }));
  assert.strictEqual(r2.alterados, 2);
  assert.deepStrictEqual(escUsuarios(ctx2).map(e => e.args), [[5, 4, 'Rede'], [5, 5, 'Exec.']]);
  assert.deepStrictEqual(logsAcesso(ctx2), [['ACESSO', PADRAO, '', 'unidade: Rede'], ['ACESSO', PADRAO, '', 'cargo: Exec.']]);

  // nada mudou: sem escrita, sem log
  const ctx3 = carregar({ abas: abas(), email: SUPER });
  assert.deepStrictEqual(J(ctx3.atualizarUsuario({ email: GESTOR, perfil: 'Gestor', cargo: 'Coord.' })).alterados, 0);
  assert.strictEqual(ctx3._escritas.length, 0);

  // erros
  const ctx4 = carregar({ abas: abas(), email: SUPER });
  assert.deepStrictEqual(J(ctx4.atualizarUsuario({ email: GESTOR, perfil: 'Chefe' })), { erro: 'Perfil inválido.' });
  assert.deepStrictEqual(J(ctx4.atualizarUsuario({ email: SUPER, perfil: 'Gestor' })), { erro: 'O administrador do sistema permanece Admin.' });
  assert.deepStrictEqual(J(ctx4.atualizarUsuario({ email: 'ninguem@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'Usuário não encontrado.' });
  assert.deepStrictEqual(J(ctx4.atualizarUsuario({ email: GESTOR, nome: '  ' })), { erro: 'Nome é obrigatório.' });
  assert.strictEqual(ctx4._escritas.length, 0);
  // super-admin pode editar os próprios dados que não sejam o perfil
  assert.strictEqual(J(ctx4.atualizarUsuario({ email: SUPER, cargo: 'Coordenador' })).alterados, 1);
}

// 4. adicionarUsuario
{
  const ctx = carregar({ abas: abas(), email: SUPER });
  ctx.listarUsuarios();
  const r = J(ctx.adicionarUsuario({ nome: ' Nova Pessoa ', email: ' nova.pessoa@unimednacional.coop.br ', perfil: 'Usuário Padrão', unidade: 'Rede' }));
  assert.deepStrictEqual(r, { sucesso: true, usuario: { nome: 'Nova Pessoa', email: 'nova.pessoa@unimednacional.coop.br', perfil: 'Usuário Padrão', unidade: 'Rede', cargo: '' } });
  assert.deepStrictEqual(escUsuarios(ctx), [{ aba: 'Usuários', op: 'appendRow', args: ['Nova Pessoa', 'nova.pessoa@unimednacional.coop.br', 'Usuário Padrão', 'Rede', ''] }]);
  assert.deepStrictEqual(logsAcesso(ctx), [['ACESSO', 'nova.pessoa@unimednacional.coop.br', '', 'incluído: Usuário Padrão']]);
  assert.ok(!('usuarios_v1' in ctx._cache));
  assert.strictEqual(ctx.getPerfil('nova.pessoa@unimednacional.coop.br'), 'Usuário Padrão');

  const ctx2 = carregar({ abas: abas(), email: SUPER });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: '', email: 'a@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'Nome é obrigatório.' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: 'a@gmail.com', perfil: 'Gestor' })), { erro: 'E-mail deve ser @unimedcnu.coop.br ou @unimednacional.coop.br' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: 'a@gmail.com?x=@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'E-mail deve ser @unimedcnu.coop.br ou @unimednacional.coop.br' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: '@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'E-mail deve ser @unimedcnu.coop.br ou @unimednacional.coop.br' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: 'a@unimedcnu.coop.br', perfil: 'Chefe' })), { erro: 'Perfil inválido.' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: 'GESTORA@UNIMEDCNU.COOP.BR', perfil: 'Gestor' })), { erro: 'Este e-mail já está cadastrado.' });
  assert.strictEqual(ctx2._escritas.length, 0);
}

// 5. removerUsuario
{
  const ctx = carregar({ abas: abas(), email: SUPER });
  ctx.getPerfil(PADRAO);
  assert.deepStrictEqual(J(ctx.removerUsuario({ email: 'Padrao@unimednacional.coop.br' })), { sucesso: true });
  assert.deepStrictEqual(escUsuarios(ctx), [{ aba: 'Usuários', op: 'deleteRow', args: [5] }]);
  assert.deepStrictEqual(logsAcesso(ctx), [['ACESSO', PADRAO, 'Usuário Padrão', 'removido']]);
  assert.strictEqual(ctx.getPerfil(PADRAO), '', 'perde o acesso na hora');

  const ctx2 = carregar({ abas: abas(), email: SUPER });
  assert.deepStrictEqual(J(ctx2.removerUsuario({ email: SUPER })), { erro: 'O administrador do sistema não pode ser removido.' });
  assert.deepStrictEqual(J(ctx2.removerUsuario({ email: 'ninguem@unimedcnu.coop.br' })), { erro: 'Usuário não encontrado.' });
  assert.strictEqual(ctx2._escritas.length, 0);
}

console.log('test_acessos: ok');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tests/test_acessos.js` — Expected: FAIL (`ctx.ehSuperAdmin is not a function` ou `superAdmin` undefined).
Se `bootstrap()` reclamar de alguma aba ausente (ex.: Projetos, Interações), acrescente essa aba **só com o cabeçalho**
em `abas()` — não altere nenhuma asserção.

- [ ] **Step 3: Adicionar super-admin e helpers em `Code.gs`**, logo depois de `podeExcluir(email)` (~linha 512):

```js
// ── Super-admin (gerenciamento de acessos) ────────────────────
// Capacidade ACIMA de Admin, restrita por código: só quem está aqui vê a aba
// Acessos e altera a aba Usuários pela tela. Não é um 4º perfil na planilha,
// justamente para que ninguém a conceda pela própria tela.
var SUPER_ADMINS   = ['aurelio.pereira.ext@unimedcnu.coop.br'];
var PERFIS_VALIDOS = ['Admin', 'Gestor', 'Usuário Padrão'];

function ehSuperAdmin(email) {
  if (!email) return false;
  return SUPER_ADMINS.indexOf(String(email).trim().toLowerCase()) !== -1;
}

// Sufixo real (não indexOf): "x@gmail.com?y=@unimedcnu.coop.br" não passa.
function dominioPermitido(email) {
  var e = String(email || '').trim().toLowerCase();
  if (e.indexOf('@') < 1) return false;
  return DOMINIOS_PERMITIDOS.some(function(d) { return e.slice(-d.length) === d; });
}

// Linha (1-based) de um e-mail na aba Usuários → { linha, dados } ou null.
function localizarUsuario_(sheet, email) {
  var alvo = String(email || '').trim().toLowerCase();
  if (!alvo) return null;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1] || '').trim().toLowerCase() === alvo) return { linha: i + 1, dados: rows[i] };
  }
  return null;
}

function usuarioDaLinha_(r) {
  return { nome: String(r[0] || ''), email: String(r[1] || ''), perfil: String(r[2] || ''), unidade: String(r[3] || ''), cargo: String(r[4] || '') };
}

// Após qualquer escrita na aba Usuários: a allowlist e os perfis mudaram.
// _perfis é o memo por execução de mapaPerfis(); sem zerá-lo, um getPerfil()
// na mesma execução (e os testes) ainda veria o perfil antigo.
function posEscritaUsuarios_() {
  SpreadsheetApp.flush();
  invalidarAba(ABA_USUARIOS);
  _perfis = null;
  limparCachePerfis();
  limparCacheListas();
}

// dados = { email, perfil?, nome?, unidade?, cargo? } — grava só o que mudou.
function atualizarUsuario(dados) {
  if (!ehSuperAdmin(Session.getActiveUser().getEmail())) return { erro: 'Apenas o administrador do sistema.' };
  dados = dados || {};
  if (dados.perfil !== undefined && PERFIS_VALIDOS.indexOf(dados.perfil) === -1) return { erro: 'Perfil inválido.' };
  if (dados.perfil !== undefined && dados.perfil !== 'Admin' && ehSuperAdmin(dados.email)) return { erro: 'O administrador do sistema permanece Admin.' };
  if (dados.nome !== undefined && !String(dados.nome).trim()) return { erro: 'Nome é obrigatório.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet  = getSheet(ABA_USUARIOS);
    var achado = sheet ? localizarUsuario_(sheet, dados.email) : null;
    if (!achado) return { erro: 'Usuário não encontrado.' };
    var email  = String(achado.dados[1]);
    var campos = [['nome', 1, 0], ['perfil', 3, 2], ['unidade', 4, 3], ['cargo', 5, 4]]; // [chave, coluna 1-based, índice]
    var linha  = achado.dados.slice(), logs = [];
    campos.forEach(function(c) {
      if (dados[c[0]] === undefined) return;
      var novo = String(dados[c[0]]).trim(), antes = String(achado.dados[c[2]] || '');
      if (novo === antes) return;
      sheet.getRange(achado.linha, c[1]).setValue(novo);
      linha[c[2]] = novo;
      logs.push(['ACESSO', email, antes, c[0] + ': ' + novo]);
    });
    if (logs.length) { gravarLogs(logs); posEscritaUsuarios_(); }
    return { sucesso: true, alterados: logs.length, usuario: usuarioDaLinha_(linha) };
  } finally { lock.releaseLock(); }
}

// dados = { nome, email, perfil, unidade?, cargo? } — incluir = conceder acesso.
function adicionarUsuario(dados) {
  if (!ehSuperAdmin(Session.getActiveUser().getEmail())) return { erro: 'Apenas o administrador do sistema.' };
  dados = dados || {};
  var nome = String(dados.nome || '').trim(), email = String(dados.email || '').trim();
  if (!nome) return { erro: 'Nome é obrigatório.' };
  if (!dominioPermitido(email)) return { erro: 'E-mail deve ser @unimedcnu.coop.br ou @unimednacional.coop.br' };
  if (PERFIS_VALIDOS.indexOf(dados.perfil) === -1) return { erro: 'Perfil inválido.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet(ABA_USUARIOS);
    if (!sheet) return { erro: 'Aba Usuários não encontrada.' };
    if (localizarUsuario_(sheet, email)) return { erro: 'Este e-mail já está cadastrado.' };
    var linha = [nome, email, dados.perfil, String(dados.unidade || '').trim(), String(dados.cargo || '').trim()];
    sheet.appendRow(linha);
    gravarLog('ACESSO', email, '', 'incluído: ' + dados.perfil);
    posEscritaUsuarios_();
    return { sucesso: true, usuario: usuarioDaLinha_(linha) };
  } finally { lock.releaseLock(); }
}

// dados = { email } — remover = revogar acesso (a linha sai da aba Usuários).
function removerUsuario(dados) {
  if (!ehSuperAdmin(Session.getActiveUser().getEmail())) return { erro: 'Apenas o administrador do sistema.' };
  dados = dados || {};
  if (ehSuperAdmin(dados.email)) return { erro: 'O administrador do sistema não pode ser removido.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet  = getSheet(ABA_USUARIOS);
    var achado = sheet ? localizarUsuario_(sheet, dados.email) : null;
    if (!achado) return { erro: 'Usuário não encontrado.' };
    sheet.deleteRow(achado.linha);
    gravarLog('ACESSO', String(achado.dados[1]), String(achado.dados[2] || ''), 'removido');
    posEscritaUsuarios_();
    return { sucesso: true };
  } finally { lock.releaseLock(); }
}
```

- [ ] **Step 4: Expor `superAdmin` e as rotas**

Em `bootstrap()` (~linha 652-657), o objeto `usuario` passa a ser:
```js
    usuario: {
      email:       email,
      perfil:      perfil,
      admin:       perfil === 'Admin',
      podeExcluir: perfil === 'Admin' || perfil === 'Gestor',
      superAdmin:  ehSuperAdmin(email)
    },
```
No `doGet`, `case 'getUsuario'` (~linha 134):
```js
        resultado = { email: _u, perfil: _p, admin: _p === 'Admin', podeExcluir: _p === 'Admin' || _p === 'Gestor', superAdmin: ehSuperAdmin(_u) };
```
E, logo após `case 'arquivarProjeto': …` (~linha 131), três cases novos:
```js
      case 'atualizarUsuario':      resultado = atualizarUsuario(dados);       break;
      case 'adicionarUsuario':      resultado = adicionarUsuario(dados);       break;
      case 'removerUsuario':        resultado = removerUsuario(dados);         break;
```

- [ ] **Step 5: Rodar tudo**

Run: `node tests/test_acessos.js` → `test_acessos: ok`; depois `npm test` → **9 arquivos verdes** (todos os existentes continuam passando).

- [ ] **Step 6: Reportar** `git status --short` (deve listar só `Code.gs` modificado e `tests/test_acessos.js` novo). **Não commitar.**

---

### Task 2: Frontend — aba Acessos

**Files:**
- Modify: `tarefas-shadcn.html` — CSS (após `.ind-filtros` ~549 e no `@media print` ~508-524), rail (~685), view (após `#indicadoresView` fechar, ~896), globals (~1094), `renderUserBadge` (~1265), `aplicar()` (~1327 e ~1348), `setModo` (~1508), bloco JS novo (antes de `// ── Indicadores (Gestor/Admin)` ~1537), mock (~3316-3345).

**Interfaces:**
- Consumes: `bootstrap().usuario.superAdmin`; rotas `atualizarUsuario`/`adicionarUsuario`/`removerUsuario` (Task 1) —
  retornos `{sucesso, alterados, usuario}` / `{sucesso, usuario}` / `{sucesso}` ou `{erro}`.
- Uses existing: `usuarios` (global), `esc`, `uniq`, `avatarInitials`, `nomeDeEmail`, `toast(msg, erro, sucesso)`,
  `abrirConfirm(nome, onOk, opts)`, `chamarAPI({acao, dados}, cb)`, `.ind-tabela`, `.ind-pessoa`, `.ind-vazio`,
  `.home-stat-card`, `.home-stat-grid`, `.ind-head`, `.btn.btn-primary`, `.btn.btn-ghost`.

- [ ] **Step 1: CSS.** Logo após a linha `.ind-filtros { … }` (~549), inserir:

```css
    /* ── Acessos (super-admin) ── */
    #acessosView { padding: 28px 32px 40px; max-width: 1240px; margin: 0 auto; }
    .ac-totais { grid-template-columns: repeat(3, 1fr); }
    .ac-barra { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .ac-barra input { flex: 1; max-width: 440px; height: 36px; padding: 0 12px; border: 1px solid var(--input); border-radius: var(--radius); background: var(--surface); color: var(--foreground); font: inherit; font-size: .875rem; }
    .ac-novo { display: grid; grid-template-columns: 1.3fr 1.6fr 1fr 1.2fr 1.2fr auto; gap: 10px; align-items: end; padding: 14px 16px; margin-bottom: 16px; background: var(--muted-bg); border: 1px solid var(--border); border-radius: var(--radius); }
    .ac-novo label { display: flex; flex-direction: column; gap: 4px; font-size: .7rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em; min-width: 0; }
    .ac-novo input, .ac-novo select { height: 34px; padding: 0 10px; border: 1px solid var(--input); border-radius: var(--radius); background: var(--surface); color: var(--foreground); font: inherit; font-size: .875rem; min-width: 0; }
    .ac-novo-acoes { display: flex; gap: 8px; }
    .ac-tabela th, .ac-tabela td { text-align: left; }
    .ac-tabela th { cursor: default; }
    .ac-tabela tbody tr { cursor: default; }
    .ac-tabela select, .ac-tabela input { height: 30px; padding: 0 8px; border: 1px solid transparent; border-radius: calc(var(--radius) - 2px); background: transparent; color: var(--foreground); font: inherit; font-size: .84rem; min-width: 150px; }
    .ac-tabela select { border-color: var(--input); background: var(--surface); cursor: pointer; }
    .ac-tabela select:disabled { opacity: .7; cursor: not-allowed; }
    .ac-tabela input:hover, .ac-tabela input:focus { border-color: var(--input); background: var(--surface); outline: none; }
    .ac-tabela select.ac-perfil-admin { color: var(--primary); font-weight: 600; }
    .ac-tabela td:last-child { text-align: right; width: 48px; }
    .ac-remover { width: 28px; height: 28px; border: 1px solid transparent; border-radius: 50%; background: transparent; color: var(--muted-foreground); font-size: 1.1rem; line-height: 1; cursor: pointer; }
    .ac-remover:hover { color: var(--erro-cor); border-color: var(--erro-cor); background: var(--late-bg); }
```

No bloco `@media print { … }`, após a linha `.ind-acoes-filtros { display: none !important; }`, inserir:
```css
      #acBarra, #acNovo { display: none !important; }
```

- [ ] **Step 2: Rail.** Após o `<a id="nav-indicadores" …>…</a>` (dentro de `<nav class="nav">`), inserir:

```html
    <a id="nav-acessos" onclick="setModo('acessos')" title="Acessos" style="display:none">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span>Acessos</span></a>
```

- [ ] **Step 3: View.** Imediatamente antes de `</div><!-- /.portal-main -->` (após o `</div>` que fecha `#indicadoresView`), inserir:

```html
<div id="acessosView" style="display:none">
  <div class="ind-head">
    <div>
      <div class="home-section-title">Acessos</div>
      <div class="home-subline">Quem entra no Cora e com qual papel. A lista é a aba Usuários da planilha.</div>
    </div>
  </div>
  <div class="home-stat-grid ac-totais">
    <div class="home-stat-card"><div class="stat-num" id="acTotAdmin">—</div><div class="stat-label">Admin</div></div>
    <div class="home-stat-card"><div class="stat-num" id="acTotGestor">—</div><div class="stat-label">Gestor</div></div>
    <div class="home-stat-card"><div class="stat-num" id="acTotPadrao">—</div><div class="stat-label">Usuário Padrão</div></div>
  </div>
  <div class="ac-barra" id="acBarra">
    <input type="text" id="acBusca" placeholder="Buscar por nome, e-mail, unidade ou cargo…" autocomplete="off" oninput="renderAcessosTabela()">
    <button type="button" class="btn btn-primary" id="acNovoBtn" onclick="abrirNovoUsuario()">+ Incluir usuário</button>
  </div>
  <form class="ac-novo" id="acNovo" style="display:none" onsubmit="salvarNovoUsuario(event)">
    <label>Nome <input type="text" id="acNovoNome" autocomplete="off" required></label>
    <label>E-mail <input type="email" id="acNovoEmail" autocomplete="off" placeholder="nome@unimedcnu.coop.br" required></label>
    <label>Perfil <select id="acNovoPerfil"><option>Usuário Padrão</option><option>Gestor</option><option>Admin</option></select></label>
    <label>Unidade <input type="text" id="acNovoUnidade" list="acUnidades" autocomplete="off"></label>
    <label>Cargo <input type="text" id="acNovoCargo" autocomplete="off"></label>
    <datalist id="acUnidades"></datalist>
    <div class="ac-novo-acoes">
      <button type="submit" class="btn btn-primary" id="acNovoSalvar">Salvar</button>
      <button type="button" class="btn btn-ghost" onclick="fecharNovoUsuario()">Cancelar</button>
    </div>
  </form>
  <div class="home-section" id="acTabela"></div>
</div>
```

- [ ] **Step 4: Globals e badge.**

Após `var currentUserPerfil      = '';` inserir `var currentUserSuperAdmin = false;`.

Em `aplicar()`, após `currentUserPerfil      = u.perfil      || '';` inserir `currentUserSuperAdmin  = u.superAdmin  || false;`.

Em `aplicar()`, trocar
```js
    } else if (modoAtual === 'indicadores') {
      renderIndicadores(); // dados novos após salvar pelo modal aberto da lista de risco
    } else {
```
por
```js
    } else if (modoAtual === 'indicadores') {
      renderIndicadores(); // dados novos após salvar pelo modal aberto da lista de risco
    } else if (modoAtual === 'acessos') {
      renderAcessos();
    } else {
```

Em `renderUserBadge()`, após `if (nd) nd.style.display = currentUserPodeExcluir ? '' : 'none';` inserir:
```js
  var na = document.getElementById('nav-acessos');
  if (na) na.style.display = currentUserSuperAdmin ? '' : 'none';
```

- [ ] **Step 5: `setModo`.** Substituir a função inteira por:

```js
function setModo(m) {
  if (m === 'indicadores' && !currentUserPodeExcluir) m = 'home'; // guarda: só Gestor/Admin
  if (m === 'acessos' && !currentUserSuperAdmin) m = 'home';      // guarda: só o super-admin
  modoAtual = m;
  var isHome = m === 'home', isInd = m === 'indicadores', isAc = m === 'acessos';
  var isTarefas = !isHome && !isInd && !isAc;
  document.getElementById('homeView').style.display        = isHome ? 'block' : 'none';
  document.getElementById('appLayout').style.display       = isTarefas ? 'flex' : 'none';
  document.getElementById('indicadoresView').style.display = isInd ? 'block' : 'none';
  document.getElementById('acessosView').style.display     = isAc ? 'block' : 'none';
  document.getElementById('btnInicio').style.display       = isHome ? 'none' : '';
  var vt = document.querySelector('.view-toggle');
  if (vt) vt.style.display = isTarefas ? '' : 'none';
  // Item ativo na rail (padrão Shell)
  var ni = document.getElementById('nav-inicio');
  var nt = document.getElementById('nav-tarefas');
  var nd = document.getElementById('nav-indicadores');
  var na = document.getElementById('nav-acessos');
  if (ni) ni.classList.toggle('on', isHome);
  if (nt) nt.classList.toggle('on', isTarefas);
  if (nd) nd.classList.toggle('on', isInd);
  if (na) na.classList.toggle('on', isAc);
  if (isHome) {
    renderHome();
  } else if (isInd) {
    indMovimento = null; indMovimentoErro = false;
    renderIndicadores();       // primeiro render sem estagnação ("…")
    carregarMovimentoInd();    // segundo render quando a rota voltar
  } else if (isAc) {
    renderAcessos();
  } else {
    popularFiltros();
    renderView();
  }
}
```

- [ ] **Step 6: Bloco JS de Acessos.** Inserir imediatamente antes da linha `// ── Indicadores (Gestor/Admin) ────…` (a que precede `function popularFiltrosInd`):

```js
// ── Acessos (super-admin) ─────────────────────────────────────
// A autorização real é ehSuperAdmin() em cada rota do backend; aqui é só UI.
var AC_PERFIS  = ['Admin', 'Gestor', 'Usuário Padrão'];
var acSalvando = false;

function acPerfilPeso(p) { var i = AC_PERFIS.indexOf(p); return i === -1 ? 9 : i; }
function usuarioPorEmail(email) {
  var e = String(email || '').toLowerCase();
  return usuarios.filter(function(u) { return String(u.email).toLowerCase() === e; })[0] || null;
}
function nomeUsuarioAc(u) { return (u && u.nome) || nomeDeEmail(u && u.email); }

function renderAcessos() {
  var n = { 'Admin': 0, 'Gestor': 0, 'Usuário Padrão': 0 };
  usuarios.forEach(function(u) { if (n[u.perfil] !== undefined) n[u.perfil]++; });
  document.getElementById('acTotAdmin').textContent  = n['Admin'];
  document.getElementById('acTotGestor').textContent = n['Gestor'];
  document.getElementById('acTotPadrao').textContent = n['Usuário Padrão'];
  renderAcUnidades();
  renderAcessosTabela();
}

function renderAcUnidades() {
  var dl = document.getElementById('acUnidades');
  if (!dl) return;
  var unidades = uniq(usuarios.map(function(u) { return u.unidade; })).sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });
  dl.innerHTML = unidades.map(function(u) { return '<option value="' + esc(u) + '"></option>'; }).join('');
}

function renderAcessosTabela() {
  var el = document.getElementById('acTabela');
  var termo = (document.getElementById('acBusca').value || '').trim().toLowerCase();
  var lista = usuarios.slice();
  if (termo) {
    lista = lista.filter(function(u) {
      return ((u.nome || '') + ' ' + u.email + ' ' + (u.unidade || '') + ' ' + (u.cargo || '')).toLowerCase().indexOf(termo) !== -1;
    });
  }
  lista.sort(function(a, b) {
    return (acPerfilPeso(a.perfil) - acPerfilPeso(b.perfil)) || nomeUsuarioAc(a).localeCompare(nomeUsuarioAc(b), 'pt-BR');
  });
  if (!lista.length) { el.innerHTML = '<div class="ind-vazio">Nenhum usuário encontrado.</div>'; return; }

  var html = '<table class="ind-tabela ac-tabela"><thead><tr><th>Pessoa</th><th>Perfil</th><th>Unidade</th><th>Cargo</th><th></th></tr></thead><tbody>';
  lista.forEach(function(u) {
    var eu = String(u.email).toLowerCase() === String(currentUser).toLowerCase();
    html += '<tr data-email="' + esc(u.email) + '">';
    html += '<td><div class="ind-pessoa"><span class="avatar">' + esc(avatarInitials(u.email)) + '</span><span>' + esc(nomeUsuarioAc(u)) + '<small>' + esc(u.email) + '</small></span></div></td>';
    html += '<td><select class="ac-perfil' + (u.perfil === 'Admin' ? ' ac-perfil-admin' : '') + '" data-campo="perfil"' + (eu ? ' disabled title="O administrador do sistema permanece Admin"' : '') + '>';
    AC_PERFIS.forEach(function(p) { html += '<option value="' + esc(p) + '"' + (p === u.perfil ? ' selected' : '') + '>' + esc(p) + '</option>'; });
    if (AC_PERFIS.indexOf(u.perfil) === -1) html += '<option value="' + esc(u.perfil) + '" selected>' + esc(u.perfil || '(sem perfil)') + '</option>';
    html += '</select></td>';
    html += '<td><input type="text" data-campo="unidade" value="' + esc(u.unidade || '') + '" placeholder="—" list="acUnidades" autocomplete="off"></td>';
    html += '<td><input type="text" data-campo="cargo" value="' + esc(u.cargo || '') + '" placeholder="—" autocomplete="off"></td>';
    html += '<td>' + (eu ? '' : '<button type="button" class="ac-remover" title="Remover acesso">×</button>') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;

  Array.from(el.querySelectorAll('tbody tr')).forEach(function(tr) {
    var email = tr.getAttribute('data-email');
    var sel = tr.querySelector('select[data-campo]');
    if (sel && !sel.disabled) sel.addEventListener('change', function() { salvarCampoUsuario(email, 'perfil', sel.value, sel); });
    Array.from(tr.querySelectorAll('input[data-campo]')).forEach(function(inp) {
      var campo = inp.getAttribute('data-campo');
      inp.addEventListener('blur', function() { salvarCampoUsuario(email, campo, inp.value, inp); });
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
        if (e.key === 'Escape') { var u = usuarioPorEmail(email); inp.value = u ? (u[campo] || '') : ''; inp.blur(); }
      });
    });
    var rm = tr.querySelector('.ac-remover');
    if (rm) rm.addEventListener('click', function() { confirmarRemoverUsuario(email); });
  });
}

// Salva um campo (perfil/unidade/cargo) de um usuário; só chama a rota se mudou.
function salvarCampoUsuario(email, campo, valor, el) {
  var u = usuarioPorEmail(email);
  if (!u) return;
  valor = String(valor || '').trim();
  var antes = String(u[campo] || '');
  if (valor === antes) { if (el && el.value !== valor) el.value = valor; return; }
  var dados = { email: u.email }; dados[campo] = valor;
  if (el) el.disabled = true;
  chamarAPI({ acao: 'atualizarUsuario', dados: dados }, function(r) {
    if (el) el.disabled = false;
    if (!r || r.erro) {
      if (el) el.value = antes;
      toast((r && r.erro) || 'Não foi possível salvar.', true);
      return;
    }
    if (r.usuario) { u.nome = r.usuario.nome; u.perfil = r.usuario.perfil; u.unidade = r.usuario.unidade; u.cargo = r.usuario.cargo; }
    else u[campo] = valor;
    if (campo === 'perfil') {
      toast('Perfil de ' + nomeUsuarioAc(u) + ' alterado para ' + u.perfil + '.', false, true);
      renderAcessos(); // reordena e atualiza os cards
    } else {
      toast('Dados de ' + nomeUsuarioAc(u) + ' atualizados.', false, true);
      renderAcUnidades();
    }
  });
}

function abrirNovoUsuario() {
  var f = document.getElementById('acNovo');
  f.reset();
  f.style.display = '';
  document.getElementById('acNovoNome').focus();
}
function fecharNovoUsuario() {
  var f = document.getElementById('acNovo');
  f.reset();
  f.style.display = 'none';
}
function salvarNovoUsuario(e) {
  if (e) e.preventDefault();
  if (acSalvando) return;
  var dados = {
    nome:    document.getElementById('acNovoNome').value.trim(),
    email:   document.getElementById('acNovoEmail').value.trim(),
    perfil:  document.getElementById('acNovoPerfil').value,
    unidade: document.getElementById('acNovoUnidade').value.trim(),
    cargo:   document.getElementById('acNovoCargo').value.trim()
  };
  if (!dados.nome)  { toast('Nome é obrigatório.', true); return; }
  if (!dados.email) { toast('E-mail é obrigatório.', true); return; }
  acSalvando = true;
  var btn = document.getElementById('acNovoSalvar');
  btn.disabled = true; btn.textContent = 'Salvando…';
  chamarAPI({ acao: 'adicionarUsuario', dados: dados }, function(r) {
    acSalvando = false; btn.disabled = false; btn.textContent = 'Salvar';
    if (!r || r.erro) { toast((r && r.erro) || 'Não foi possível incluir.', true); return; }
    usuarios.push(r.usuario || dados);
    fecharNovoUsuario();
    toast('Usuário incluído.', false, true);
    renderAcessos();
  });
}

function confirmarRemoverUsuario(email) {
  var u = usuarioPorEmail(email);
  if (!u) return;
  abrirConfirm(nomeUsuarioAc(u), function() {
    chamarAPI({ acao: 'removerUsuario', dados: { email: u.email } }, function(r) {
      if (!r || r.erro) { toast((r && r.erro) || 'Não foi possível remover.', true); return; }
      var ix = usuarios.indexOf(u);
      if (ix !== -1) usuarios.splice(ix, 1); // mesma referência: Indicadores e combos enxergam
      toast('Acesso de ' + nomeUsuarioAc(u) + ' removido.', false, true);
      renderAcessos();
    });
  }, { prefixo: 'Remover', okLabel: 'Remover', sub: 'A pessoa perde o acesso ao Cora imediatamente. As tarefas dela continuam existindo.' });
}
```

- [ ] **Step 7: Mock (preview local).** No bloco mock no fim do arquivo:

Em `case 'bootstrap'`, trocar `usuario:   { email: EU, perfil: 'Admin', admin: true, podeExcluir: true },` por
`usuario:   { email: EU, perfil: 'Admin', admin: true, podeExcluir: true, superAdmin: true },`.

Em `case 'getUsuario'`, trocar `resp = { email: EU, perfil: 'Admin', admin: true, podeExcluir: true };` por
`resp = { email: EU, perfil: 'Admin', admin: true, podeExcluir: true, superAdmin: true };`.

Em `case 'bootstrapApoio'`, trocar `usuarios: MOCK_USUARIOS,` por `usuarios: MOCK_USUARIOS.slice(),` e em
`case 'listarUsuarios'`, trocar `resp = { usuarios: MOCK_USUARIOS };` por `resp = { usuarios: MOCK_USUARIOS.slice() };`
(cópia: o front muta o array global `usuarios`; se fosse a mesma referência, incluir duplicaria).

Após `case 'avisarMarcadoChecklist': …; break;` inserir:
```js
      case 'atualizarUsuario': {
        var mu = MOCK_USUARIOS.filter(function(u) { return u.email.toLowerCase() === String(dados.email).toLowerCase(); })[0];
        if (!mu) { resp = { erro: 'Usuário não encontrado.' }; break; }
        if (mu.email === EU && dados.perfil !== undefined && dados.perfil !== 'Admin') { resp = { erro: 'O administrador do sistema permanece Admin.' }; break; }
        ['nome', 'perfil', 'unidade', 'cargo'].forEach(function(c) { if (dados[c] !== undefined) mu[c] = String(dados[c]).trim(); });
        resp = { sucesso: true, alterados: 1, usuario: { nome: mu.nome, email: mu.email, perfil: mu.perfil, unidade: mu.unidade, cargo: mu.cargo } };
        break;
      }
      case 'adicionarUsuario': {
        if (MOCK_USUARIOS.some(function(u) { return u.email.toLowerCase() === String(dados.email).toLowerCase(); })) { resp = { erro: 'Este e-mail já está cadastrado.' }; break; }
        var nu = { nome: dados.nome, email: dados.email, perfil: dados.perfil, unidade: dados.unidade || '', cargo: dados.cargo || '' };
        MOCK_USUARIOS.push(nu);
        resp = { sucesso: true, usuario: nu };
        break;
      }
      case 'removerUsuario': {
        if (dados.email === EU) { resp = { erro: 'O administrador do sistema não pode ser removido.' }; break; }
        var ix = -1; MOCK_USUARIOS.forEach(function(u, i) { if (u.email === dados.email) ix = i; });
        if (ix === -1) { resp = { erro: 'Usuário não encontrado.' }; break; }
        MOCK_USUARIOS.splice(ix, 1);
        resp = { sucesso: true };
        break;
      }
```

- [ ] **Step 8: Verificar sintaxe e testes.**

Run: `node -e "var fs=require('fs');var h=fs.readFileSync('tarefas-shadcn.html','utf8');var re=/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g,m,i=0;while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){console.log('script',i,'ERRO',e.message);process.exit(1);}}console.log('scripts ok',i);"`
Expected: `scripts ok N`. Depois `npm test` (o teste `tests/test_indicadores_front.js` extrai um bloco do HTML e precisa continuar verde).

- [ ] **Step 9: Reportar** `git status --short` (só `tarefas-shadcn.html` modificado). **Não commitar.**

---

### Task 3 (orquestrador): revisão, preview, publicação e docs

- [ ] `npm test` verde (9 arquivos) → commits separados (backend+teste; front).
- [ ] Preview local (`npx serve -p 3000 .` via launch.json): rail mostra "Acessos" (mock `superAdmin: true`); cards 2/2/1;
  busca; trocar perfil de Bruno → toast e reordenação; editar unidade → toast; incluir usuário → aparece; remover
  com confirmação; linha da Ana sem remover e select travado; console sem erros; `superAdmin:false` no console
  (`currentUserSuperAdmin=false; renderUserBadge(); setModo('acessos')`) cai na Home.
- [ ] Revisão final (opus) sobre o diff completo; uma onda de correções.
- [ ] `clasp push` (gate: exatamente 7 arquivos) → `clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8` (@70).
- [ ] Verificar em produção via JSONP: `bootstrap` devolve `usuario.superAdmin: true` para o Aurélio; abrir a aba Acessos.
- [ ] `docs/HANDOFF.md` (bloco @70, pendências), `CLAUDE.md` (3 rotas + conceito de super-admin), commit.
