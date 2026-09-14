# Planos de ação dos painéis no Cora — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os planos de ação dos painéis Spravato, Carteira PF e GT Onco passam a ser tarefas do Cora em projetos públicos; os painéis leem do Cora por JSONP; a equipe de Atenção à Saúde (40 pessoas) entra como usuária.

**Architecture:** Cora ganha coluna `Publico` em Projetos, critério de visibilidade por projeto público, rota `planoAcaoProjeto` fora da allowlist, link profundo e dois arquivos de importação manual. Os três painéis trocam o storage próprio por um bloco comum de leitura. Spec: `docs/superpowers/specs/2026-09-08-planos-de-acao-dos-paineis-no-cora-design.md`.

**Tech Stack:** Google Apps Script (V8, estilo ES5), HTML/JS vanilla, clasp 3.3, Node 24 para testes (`vm` + `assert`, sem dependências).

## Global Constraints

- Não reordenar colunas das abas; `COL`/`COL_PROJ` são índices fixos. Coluna nova só no fim (`Publico` = F).
- Datas `yyyy-MM-dd` passam por `parsePrazoLocal` no backend; nunca `new Date('YYYY-MM-DD')`.
- Deploy: `clasp push` e depois `clasp deploy -i <id existente>`; **nunca** `clasp deploy` sem `-i`.
  - Cora: `AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8` (@64)
  - Spravato: `AKfycbwqmNJXHV_4oEUj5ikTEWseLO0hAOIHVq2yTmR5KSS68yoo3OIBCaPXH8Y4yEKcC04d` (@250) e `AKfycbzXe-XQqJqrMGGezUNNcHcdLEr74Qbi6UY2y63QbTzTuCOitY40c9tybtySOEBDe9x1` (@249)
  - PF: `AKfycbwj1G7iUOoszEbJmPtVTccja2U_El5RTlz-CPFfQdXzqb07HIa-yKXP-wtM7Hg--FWK` (@76)
  - GT: `AKfycbw8MrrfeEIIkI4D6Us4MxUIi09FHF1lDYkPAJqWzR2ASgebMm3XwfdYFoYab0kgXygE` (@63)
- Importações nunca chamam `notificarResponsavel` nem `criarEventoCalendar`.
- `Equipe*.xlsx` não é versionado. Os dados entram como constante no `.gs`.
- Texto de UI em português; sem emoji nos títulos importados.
- Commits pequenos, mensagem em português, rodapé `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Harness de testes Node para os `.gs`

**Files:**
- Create: `tests/harness.js`, `tests/run.js`, `tests/test_smoke.js`
- Modify: `package.json` (criar, só com `"scripts": {"test": "node tests/run.js"}`)

**Interfaces:**
- Produces: `carregar(stubs)` em `tests/harness.js` devolve um contexto `vm` com `Code.gs`, `ImportacaoPlanos.gs` e `ImportacaoUsuarios.gs` avaliados (arquivos ausentes são ignorados). `stubs.abas` é `{ nomeAba: [[...linhas]] }`; `stubs.email` é o e-mail de `Session.getActiveUser()`. O contexto expõe `_escritas` (array de `{aba, op, args}`) e `_cache` (mapa do CacheService fake).

- [x] Escrever `tests/harness.js` com stubs mínimos: `SpreadsheetApp.openById().getSheetByName(n)` devolvendo objeto com `getDataRange().getValues()`, `getLastRow()`, `getRange(...).getValue/getValues/getDisplayValue/setValue/setValues`, `appendRow`, `deleteRow`, `insertSheet`; `Session`, `CacheService` (mapa em memória), `LockService`, `PropertiesService`, `Utilities.formatDate` (yyyy-MM-dd via `getFullYear` etc.), `Logger.log` (acumula em `_logs`), `ScriptApp.getService().getUrl()`, `HtmlService` (só o suficiente para não quebrar ao carregar), `MailApp`, `GmailApp`, `CalendarApp`, `DriveApp.getFilesByName` (configurável via `stubs.drive`).
- [x] `tests/run.js`: executa todos `tests/test_*.js` em sequência e sai com código 1 se algum lançar.
- [x] `tests/test_smoke.js`: carrega o contexto e afirma `typeof ctx.doGet === 'function'` e `ctx.COL.ATIVO === 10`.
- [x] Rodar `node tests/run.js`; esperado: `ok test_smoke`.
- [x] Commit `test: harness Node para os .gs do Cora`.

### Task 2: Coluna `Publico` em Projetos (backend + front + mock)

**Files:**
- Modify: `Code.gs` (`COL_PROJ`, `getOrCreateProjetosSheet`, `listarProjetosDaPlanilha`, `criarProjeto`, `atualizarProjeto`, `setup`, `popularProjetos`; nova `migrarProjetosPublico`)
- Modify: `tarefas-shadcn.html` (modal de projetos: checkbox `projPublico`; `renderListaProjetos` chip; `salvarNovoProjeto` envia `publico`; `MOCK_PROJETOS` com `publico`)
- Test: `tests/test_projetos.js`

**Interfaces:**
- Produces: `COL_PROJ.PUBLICO = 5`; `listarProjetos().projetos[i].publico` boolean; `criarProjeto({nome, descricao, cor, publico})`; `atualizarProjeto({id, ..., publico})`; `projetosPublicos()` devolve `{ nomeDoProjeto: true }` só para ativos e públicos (usa `lerAba`); `migrarProjetosPublico()` manual.

- [x] Teste: com aba Projetos `[cab, [1,'A','','#000',true,true],[2,'B','','#000',true,false],[3,'C','','#000',false,true]]`, `listarProjetosDaPlanilha().projetos` tem 2 itens com `publico` true/false e `projetosPublicos()` é `{A:true}`. `criarProjeto({nome:'N', publico:true})` como Admin faz `appendRow` de 6 colunas com `true` na 6ª.
- [x] Rodar, ver falhar (`projetosPublicos is not a function`).
- [x] Implementar. `publico` normaliza `true/'true'/'TRUE'` para boolean. `migrarProjetosPublico()`: se `getLastColumn() < 6`, escreve `Publico` em F1 e `false` em F2:F(último).
- [x] Front: checkbox abaixo da cor `<label class="proj-check"><input type="checkbox" id="projPublico"> Visível a todo o domínio</label>`; chip `<span class="proj-chip-publico">público</span>` na lista quando `p.publico`; CSS mínimo com tokens existentes.
- [x] Rodar testes; commit `feat: projetos públicos (coluna Publico, flag no modal)`.

### Task 3: Visibilidade por projeto público + pré-filtro para todos

**Files:**
- Modify: `Code.gs` (`idsTarefasVisiveis`), `tarefas-shadcn.html` (`aplicarFiltroInicial`)
- Test: `tests/test_visibilidade.js`

- [x] Teste: Usuário Padrão `x@unimedcnu.coop.br` (aba Usuários com perfil), Tarefas com uma tarefa de projeto `A` (público) de outra pessoa e uma de projeto `B` (não público): `idsTarefasVisiveis('x@…')` contém a primeira e não a segunda. Admin devolve `null`.
- [x] Implementar: `var pub = projetosPublicos();` e no laço `|| pub[String(rowsT[j][COL.PROJETO] || '')]`.
- [x] Front: remover `if (!currentUserPodeExcluir) return;` de `aplicarFiltroInicial`; atualizar comentário.
- [x] Rodar testes; commit `feat: tarefas de projeto público visíveis a todos; pré-filtro para todos os perfis`.

### Task 4: Allowlist pela aba Usuários

**Files:**
- Modify: `Code.gs` (`EMAILS_PILOTO` sai; `acessoPermitido`)
- Test: `tests/test_acesso.js`

- [x] Teste: com `PILOTO_ATIVO` true e aba Usuários contendo `a@unimedcnu.coop.br`, `acessoPermitido('a@…')` é true, `acessoPermitido('b@…')` false, `acessoPermitido('')` false.
- [x] Implementar: `return !!getPerfil(email);`. Remover `EMAILS_PILOTO`. Ajustar comentário.
- [x] Commit `feat: allowlist do piloto passa a ser a aba Usuários`.

### Task 5: Rota `planoAcaoProjeto` com cache e invalidação

**Files:**
- Modify: `Code.gs` (`doGet`: tratamento antes de `acessoPermitido`; nova `planoAcaoProjeto(dados)`; `invalidarCachePlano(nomeProjeto)`; chamadas em `criarTarefa`, `atualizarTarefa`, `excluirTarefa`, `salvarChecklist`, `atualizarProjeto`, `arquivarProjeto`)
- Test: `tests/test_plano_rota.js`

**Interfaces:**
- Produces: `planoAcaoProjeto({projetoId})` ou `({projetoNome})` → `{projeto, urlCora, geradoEm, tarefas[]}` ou `{erro:'Projeto não disponível.'}`. Chave de cache `planoAcao_<id>`.

- [x] Teste: projeto 12 público com 2 tarefas ativas, 1 inativa e 1 de outro projeto; checklist com 2 itens (1 feito) na primeira; Interações com 2 datas para ela → resposta tem 2 tarefas, `checklist.total 2/feitos 1`, `ultimaAtualizacao` igual à maior data, `prazo` `'2026-12-31'`. Projeto não público → erro. `projetoId:'abc'` → erro. Chamado com e-mail fora da aba Usuários → funciona.
- [x] Implementar. No `doGet`, antes do `else if (!acessoPermitido(...))`: `else if (acao === 'planoAcaoProjeto') { resultado = planoAcaoProjeto(dados); }`. Cache via `comCache('planoAcao_'+id, 60, fn)`; `invalidarCachePlano(nome)` resolve id pelo nome em `lerAba(ABA_PROJETOS)` e faz `CacheService.getScriptCache().remove('planoAcao_'+id)`.
- [x] Commit `feat: rota planoAcaoProjeto para os painéis (leitura pública por projeto)`.

### Task 6: Link profundo (`?projeto=`, `?tarefa=`)

**Files:**
- Modify: `Code.gs` (`doGet` sem `acao`: `tpl.deepLink`), `tarefas-shadcn.html` (`<body data-deep-link="<?= deepLink ?>">`, `aplicarDeepLink()` chamada em `carregarTudo` antes de `aplicarFiltroInicial`)
- Test: `tests/test_deeplink.js` (só o saneamento: função `deepLinkJson(params)` devolve `{"projeto":"12","tarefa":""}` para `{projeto:'12', tarefa:'x'}`)

- [x] Teste e implementação de `deepLinkJson(e.parameter)`.
- [x] Front: `aplicarDeepLink()` lê `document.body.dataset.deepLink`, `JSON.parse` em `try`; com `projeto`, acha `projetos` por `String(p.id) === projeto`, `setModo('tarefas')`, `setFiltroProjeto(nome)`, marca `filtroInicialAplicado = true`; com `tarefa`, acha em `tarefas` e `abrirModal(t, 'view')`.
- [x] Commit `feat: link profundo por projeto e tarefa`.

### Task 7: `ImportacaoUsuarios.gs`

**Files:**
- Create: `ImportacaoUsuarios.gs`
- Modify: `Code.gs` (remover `adicionarUsuariosPiloto`)
- Test: `tests/test_import_usuarios.js`

**Interfaces:**
- Produces: `EQUIPE_ATENCAO_SAUDE` (40 linhas `[nome, email, perfil, unidade, cargo]`), `remapearEmailUsuario(de, para, apenasSimular)`, `importarUsuariosEquipe(apenasSimular)`, `planoImportacaoUsuarios(rowsAtuais)` (pura: devolve `{adicionar:[], atualizar:[]}`).

- [x] Teste: `EQUIPE_ATENCAO_SAUDE.length === 40`; 5 com perfil Gestor; nenhum e-mail repetido; todos terminam em domínio permitido. `planoImportacaoUsuarios` com aba contendo Glaucia (Gestor) e Guilherme Borges (Usuário Padrão, e-mail novo) → 38 adicionar, 2 atualizar (Glaucia só unidade/cargo; Guilherme vira Gestor). Remap: `planoRemap(rows, de, para)` lista células em Usuários/Tarefas/Checklist_Status.
- [x] Implementar. Gravação célula a célula com `getRange(...).setValue`, `gravarLog('REMAPEAR_EMAIL', aba+'!'+célula, de, para)` e `gravarLog('IMPORTAR_USUARIO', 'Email', '', email)`.
- [x] Commit `feat: importação da equipe de Atenção à Saúde e remapeamento de e-mail`.

### Task 8: `ImportacaoPlanos.gs`

**Files:**
- Create: `ImportacaoPlanos.gs`
- Test: `tests/test_import_planos.js`

**Interfaces:**
- Produces: `IMPORT_SPRAVATO_SHEET_ID`, `IMPORT_PF_SHEET_ID` (''), `IMPORT_PF_NOME_PLANILHA`, `IMPORT_EMAILS_GT`, `PLANO_SPRAVATO_FIXOS` (8), `PLANO_PF_FIXOS` (12), `PLANO_GT` (18 objetos `{n, titulo, status, prazo, resp, desc, itens:[{texto, feito}], notas:[]}`), `PROJETOS_PLANO` (3), `converterAcaoPainel(item, origem)` → `{tarefa, status, prazo, observacoes, marca}`, `mesclarPlanoPainel(fixos, rowsAba, origem)` → lista de ações (fixas + custom), `importarPlanosDeAcao(apenasSimular)`.

- [x] Teste: `PLANO_GT.length === 18`, soma de `itens` = 34, nenhum `n` em `[9,18,19]`; `converterAcaoPainel({titulo:'💰 X', desc:'d', status:'concluída', prazo:'2026-01-05'}, 'pf#custo')` → `{tarefa:'X', status:'Concluído', prazo:'2026-01-05', observacoes:'d\nOrigem: pf#custo'}`; `mesclarPlanoPainel` com aba contendo override de status e uma linha custom devolve 9 itens para os 8 fixos. Simulação com `Tarefas` já contendo `Origem: gt#1` pula 1.
- [x] Implementar. Planilha do PF: `IMPORT_PF_SHEET_ID || DriveApp.getFilesByName(IMPORT_PF_NOME_PLANILHA)` exigindo exatamente 1. Gravação: `LockService`, `appendRow` em Tarefas com 12 colunas (EVENT_ID vazio), itens em `Checklist_Status` (8 colunas), `gravarLog('IMPORTAR', 'Origem', '', marca)`, `invalidarAba` + `limparCacheListas` + `invalidarCachePlano`.
- [x] Commit `feat: importação dos planos de ação dos painéis`.

### Task 9: Docs do Cora, push e deploy

**Files:**
- Modify: `docs/HANDOFF.md`, `README.md`, `CLAUDE.md`

- [x] Atualizar: rota nova, coluna `Publico`, arquivos novos, allowlist pela aba, roteiro de execução das funções manuais (ordem: `migrarProjetosPublico`, `remapearEmailUsuario`, `importarUsuariosEquipe`, `importarPlanosDeAcao`), IDs de implantação.
- [x] `node tests/run.js` verde; commit `docs: handoff, readme e claude.md para os planos de ação`.
- [x] `clasp push` e `clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8 -d "planos de ação dos painéis + equipe"`.
- [ ] Executar as funções manuais — `clasp run` NÃO está habilitado; roteiro no HANDOFF para o Aurélio. Anotar IDs dos projetos.

### Task 10: Bloco comum `PlanoAcaoCora` e aplicação nos três painéis

**Files:**
- Create: `integracoes/PlanoAcaoCora.html` (fonte de referência no repo do Cora: CSS + JS do bloco)
- Modify: `UNIMED - Raio X Spravata/appscript/Codigo.gs` e `Painel.html`; `UNIMED - Raio X Spravata/CHANGELOG.md`; cópia em `versoes/painel_spravato_v4.74.html`
- Modify: `UNIMED - Análise de Requisitos/cora-carteira-pf/Codigo.gs`, `Painel.html`, `CHANGELOG.md`; cópia em `../versoes/painel_pf_v8.47.html`
- Modify: `UNIMED - Painel GT/cora-painel-gt/Painel.html`, `UNIMED - Painel GT/build/body_gt.html`; cópia em `versoes/painel_gt_v1.39.html`

**Interfaces:**
- Consumes: rota `planoAcaoProjeto` (Task 5), links `?projeto=`/`?tarefa=` (Task 6).
- Produces: `PAC_CONFIG = { url, projetoId, projetoNome, hostId, badge:{...}, kpisId }`; `pacIniciar()`.

- [x] Escrever o bloco: JSONP com timeout 15 s, ordenação, KPIs, cards, `<details>` de itens, links, banner de erro, amostra em preview.
- [x] Spravato: remover backend e front do PA; inserir bloco; `VERSAO = 'v4.74'`; changelog; `node tests/run.js` do Spravato verde; `clasp push`; `clasp deploy -i …@250`.
- [x] PF: idem, `v8.47`; `clasp push`; `clasp deploy -i …@76`.
- [x] GT: substituir seção `#plano` no `Painel.html` e no `build/body_gt.html`; `v1.39` no rodapé; `clasp push`; `clasp deploy -i …@63`.
- [x] Commit no repo do Cora (bloco de referência) e no repo do Spravato.

### Task 11: Verificação publicada

- [ ] Rodar os 17 passos da seção Verificação da spec; registrar o resultado no `HANDOFF.md`. (Pendente: depende do roteiro manual.)
