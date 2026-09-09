# Indicadores — monitoramento de ações (Para agir hoje, lista de risco, estagnação, matriz) — design

> Data: 09/09/2026. Aprovado pelo Aurélio em conversa. Evolui a aba Indicadores publicada na @68
> (spec `2026-09-08-indicadores-gestores-design.md`), que hoje mostra estoque (totais, pessoas, projetos).
> Objetivo deste bloco: acompanhar as **ações** de perto — o que está parado, o que vence, o que é crítico e não
> anda — e transformar números em decisões.

## Objetivo

Na aba Indicadores (Gestor/Admin): um bloco **"Para agir hoje"** com frases acionáveis, uma aba **Ações** com a
**lista de risco** por tarefa e a **matriz prioridade × situação**, e a métrica de **estagnação** ("parada há N
dias"), que exige uma rota nova de leitura no backend e o registro do ID da tarefa no Log a cada edição.

Arquivos: `tarefas-shadcn.html` (front), `Code.gs` (rota + log), `tests/test_indicadores_front.js` (estender),
`tests/test_indicadores_rota.js` (novo). Nenhuma mudança de esquema nas abas do Sheets.

## 1. Estrutura da tela

- Topo fixo da view: filtros atuais (unidade, projeto, janela de próximas, busca) **mais** um seletor
  `<select id="indParada">` "Parada há" com 7 (padrão), 14 e 30 dias; os quatro totais; o bloco "Para agir hoje".
- Abaixo, três abas internas (`.ind-abas`, botões `data-aba`): **Ações** (padrão), **Pessoas** (tabela atual),
  **Projetos** (cards atuais). Estado em `indAba` ('acoes' | 'pessoas' | 'projetos'); só a aba ativa é renderizada.
- A busca por nome continua filtrando a aba Pessoas; na aba Ações ela filtra por título da tarefa, projeto e nome do
  responsável.

## 2. Backend — rota `indicadoresMovimento` e ID no Log

### 2.1 Registro do ID da tarefa nas edições

Em `atualizarTarefa`, quando `logEntradas.length > 0`, acrescentar **uma** entrada
`['ATUALIZAR', 'ID_Tarefa', '', dados.id]` ao mesmo `gravarLogs(logEntradas)` (uma linha de Log por save, no padrão
já usado por `CHECKLIST`, `INTERACAO` e `AVISO_CHECKLIST`). Sem mudança nas colunas do Log
(`ID, Data/Hora, Editor, Ação, Campo, Valor Anterior, Valor Novo`). O histórico anterior a esta versão fica sem ID
nas edições — aceito; a movimentação dessas tarefas cai nas outras fontes.

### 2.2 Rota `acao=indicadoresMovimento`

- Despachada no `switch` do ramo autenticado + allowlist do `doGet`. Exige `podeExcluir(email)` (Gestor/Admin);
  senão `{ erro: 'Apenas Admin ou Gestor.' }`.
- Resposta: `{ movimento: { "<idTarefa>": "yyyy-MM-dd'T'HH:mm:ss" }, geradoEm: "…" }`, uma chave por tarefa
  **ativa** (`Ativo !== false`, qualquer status; concluídas entram também, custo desprezível).
- Última movimentação de uma tarefa = a **maior** entre:
  1. `Data criação` (Tarefas, col I);
  2. `Data/Hora` de qualquer linha de **Interações** com aquele `ID_Tarefa` (comentários e "Atualização de status");
  3. `Data/Hora` de linhas do **Log** com `Campo === 'ID_Tarefa'` e `Valor Novo == id` (ações `CHECKLIST`,
     `INTERACAO`, `AVISO_CHECKLIST` e, a partir desta versão, `ATUALIZAR`);
  4. `Data conclusão` de itens de **Checklist_Status** daquele `ID_Tarefa` (col G), quando preenchida.
- Datas formatadas com `Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss")`
  (mesmo padrão de `montarPlanoAcaoProjeto`). Valores inválidos são ignorados.
- Cache: `comCache('indMovimento_v1', 120, fn)`. Sem invalidação por escrita (atraso máximo de 2 min é aceitável);
  as leituras usam `lerAba` (cache por execução).
- O front chama a rota **só ao abrir Indicadores** (`setModo('indicadores')`), uma vez por abertura, e re-render
  com o resultado; enquanto não chega, a coluna "parada há" mostra "…" e as regras de estagnação não disparam.
  Erro da rota → toast "Não foi possível calcular a estagnação: <erro>" e a tela segue sem essa métrica.

## 3. Cálculo — extensão de `calcularIndicadores`

Continua pura e entre os marcadores. Nova assinatura: `calcularIndicadores(dados, filtros, hoje, deps)` com
`dados = {tarefas, cklStatus, usuarios, projetos, movimento}` (`movimento` = mapa da rota, pode ser `null`) e
`filtros = {unidade, projeto, janelaDias, paradaDias}`. Além de `pessoas`, `semResponsavel`, `projetos`, `totais`,
devolve:

### 3.1 `acoes: Acao[]` — uma por tarefa **ativa** (após filtro de projeto; o filtro de unidade **não** se aplica
— a lista é da ação, não da pessoa)

`Acao = { id, tarefa, projeto, cor, responsavel, responsavelNome, prioridade, status, prazo, diasAtraso,
diasParaPrazo, ultimaMov, diasParada, cklTotal, cklFeitos, flags, severidade }`

- `diasAtraso` = dias inteiros entre prazo e hoje quando atrasada, senão 0; `diasParaPrazo` = dias até o prazo quando
  futuro (0 se hoje), `null` sem prazo.
- `ultimaMov` = `movimento[id]` ou `null`; `diasParada` = dias inteiros desde `ultimaMov` (`null` se não houver
  movimento conhecido). Tarefa concluída não entra.
- `flags` (todas as que valerem): `atrasadaCritica` (atrasada e prioridade Crítica ou Alta), `atrasada`,
  `bloqueada`, `parada` (`diasParada >= paradaDias`), `vence` (próxima, dentro da janela), `semResponsavel`,
  `semPrazo`.
- `severidade` (número, menor = mais grave): 1 `atrasadaCritica`, 2 `atrasada`, 3 `bloqueada`, 4 `parada`,
  5 `vence`, 6 `semResponsavel`, 7 `semPrazo`, 9 nenhuma (tarefa saudável — entra na lista, mas por último).
- Ordenação: `severidade` asc, depois `diasAtraso` desc, depois `diasParada` desc, depois `id` asc.

### 3.2 `matriz`

`{ linhas: ['Crítica','Alta','Média','Baixa'], colunas: ['Atrasada','Bloqueada','Em andamento','A fazer'],
celulas: {'Crítica': {'Atrasada': n, …}, …}, total }` sobre as mesmas `acoes`. Regras de coluna, exclusivas e nesta
ordem: `Atrasada` (flag atrasada), senão `Bloqueada` (status), senão `Em andamento` (status), senão `A fazer`
(Backlog e A fazer). Prioridade vazia conta como `Média`.

### 3.3 `alertas: Alerta[]` — "Para agir hoje", no máximo 5, nesta ordem de prioridade

`Alerta = { texto, aba: 'acoes'|'pessoas', filtro: {severidadeMax?, flag?, projeto?, pessoa?} }`

1. Para cada projeto com ≥ 1 `atrasadaCritica`: "**N** ação(ões) crítica(s)/alta(s) atrasada(s) em **Projeto**"
   (uma frase por projeto, do maior N para o menor; no máximo 3 frases desta regra).
2. Se houver `parada`: "**N** ação(ões) sem movimento há **P** dias ou mais" (P = `paradaDias`).
3. Se houver `semResponsavel`: "**N** ação(ões) sem responsável".
4. A pessoa com mais `atrasadas` (≥ 2) **na lista `pessoas` já filtrada por unidade** (mesma visão da aba Pessoas): "**Nome** concentra **N** ações atrasadas".
5. Se houver `vence`: "**N** ação(ões) vencem nos próximos **J** dias".
Se nenhuma regra disparar: lista vazia (o front mostra "Nenhuma ação exige atenção imediata.").

## 4. Renderização

### 4.1 Topo

- "Para agir hoje" (`#indAgir`): caixa destacada (`.ind-agir`, borda esquerda dourada `var(--dourado)`), título
  "Para agir hoje", lista de frases clicáveis (`.ind-agir-item`). Clique: muda para a aba do alerta e aplica o
  filtro (`indFiltroAcoes = alerta.filtro`), rolando até a lista. Frases usam `<b>` nos números/nomes; todo dado
  via `esc()`.
- Seletor "Parada há" ao lado da janela de próximas; mudança re-renderiza (não chama a rota de novo).

### 4.2 Aba Ações (`#indAcoes`)

- **Filtros locais** (`.ind-acoes-filtros`): chips de severidade (Todas · Atrasadas · Bloqueadas · Paradas · Vencem ·
  Sem responsável · Sem prazo · Saudáveis) — um ativo por vez; estado em `indFiltroAcoes` ({flag} ou {}). A busca
  do topo filtra por título/projeto/nome.
- **Lista de risco** (`<table class="ind-tabela ind-acoes">`): colunas Situação (chip `.sev-N` com o texto da flag
  principal: "Atrasada · crítica", "Atrasada", "Bloqueada", "Parada", "Vence", "Sem responsável", "Sem prazo",
  "Em dia"), Ação (título + `<small>` projeto com bolinha da cor), Responsável (avatar + primeiro nome, ou "—"),
  Prioridade (badge existente `badgePrio`), Prazo (relativo: "há N d" em `.ruim` quando atrasada, "hoje", "em N d",
  "—"), Parada há ("N d", `.aviso` quando `parada`; "…" enquanto a rota não voltou; "—" sem movimento conhecido),
  Desdobramentos (`.ind-barra` com `cklFeitos/cklTotal`, ou "—"). Ordenação fixa pela severidade (sem cabeçalhos
  clicáveis nesta versão).
- Clique na linha: `abrirModal(tarefaOriginal, 'view')` — o modal existente abre por cima da view; ao fechar o modal
  (`fecharModal`), se `modoAtual === 'indicadores'`, chama `renderIndicadores()` para refletir marcações feitas ali
  (o mapa de movimentação não é recarregado; só na próxima abertura da aba).
- Vazio: "Nenhuma ação nos filtros atuais."
- **Matriz prioridade × situação** (`#indMatriz`, abaixo da lista): tabela 4×4 + totais de linha/coluna; célula com
  contagem, fundo em escala de 3 tons (0 = neutro, 1–2 = claro, ≥ 3 = forte) e coluna Atrasada em tons de
  `var(--late-bg)`/`var(--erro-cor)`. Clique numa célula aplica `indFiltroAcoes = {prioridade, coluna}` na lista
  (e um chip "limpar" aparece). Célula 0 não é clicável.

### 4.3 Abas Pessoas e Projetos

Sem mudança funcional; passam a ser renderizadas só quando a aba está ativa.

### 4.4 Impressão

Aba ativa imprime; `.ind-abas`, filtros e chips somem no `@media print`.

## 5. CSS

`.ind-abas` (linha de botões, ativo com borda inferior `var(--primary)`), `.ind-agir` (caixa com borda esquerda 4px
`var(--dourado)`, fundo `var(--dourado-bg)`), `.ind-agir-item` (cursor pointer, hover sublinhado), `.ind-acoes-filtros`
e `.ind-chip` (pílulas; ativa em `var(--primary)` com texto branco), `.sev-1`…`.sev-9` (chips de situação: 1–2
vermelho `var(--late-bg)`/`var(--erro-cor)`, 3 âmbar `var(--warn-bg)`/`var(--warn-ink)`, 4 âmbar claro, 5 dourado
`var(--dourado-bg)`, 6–7 cinza `var(--muted-bg)`, 9 verde `var(--verde-bg)`/`var(--primary)`), `.ind-matriz`
(tabela compacta, células centradas, `.m0/.m1/.m2` para intensidade, `.late` para a coluna Atrasada, `cursor:
pointer` só em células > 0). Cores só do DS (`docs/design_system.md`).

## 6. Testes

- `tests/test_indicadores_front.js` (estender, mesmo mecanismo de extração): com `movimento` e `paradaDias: 7`,
  casos: severidade e ordenação (crítica atrasada antes de atrasada média antes de bloqueada antes de parada antes de
  vence); `diasAtraso`/`diasParaPrazo`/`diasParada` inteiros e `null` sem prazo/sem movimento; tarefa concluída fora de
  `acoes`; `flags` múltiplas (atrasada e parada) com severidade mínima; `matriz` com contagens e totais, prioridade
  vazia → Média, coluna exclusiva; `alertas`: as 5 regras, o limite de 3 frases da regra 1, ordem, lista vazia sem
  problemas; `movimento: null` → `diasParada null` e nenhum `parada`; filtro de projeto restringe `acoes`/`matriz`/
  `alertas`; filtro de unidade **não** afeta `acoes`.
- `tests/test_indicadores_rota.js` (novo, via `harness.carregar` com abas stub): Gestor recebe mapa com a maior data
  entre criação, interação, log `ID_Tarefa` e conclusão de item; tarefa sem nada além da criação devolve a criação;
  Usuário Padrão recebe `{erro}`; linhas de Log sem `Campo === 'ID_Tarefa'` são ignoradas; `atualizarTarefa` com
  mudança grava a entrada `['ATUALIZAR','ID_Tarefa','',id]` além das entradas por campo e não grava nada quando nada
  mudou. (Verificar em `tests/test_smoke.js`/outros se já há asserções sobre a contagem de linhas de Log em
  `atualizarTarefa` e ajustá-las.)
- Preview (mock): estender o mock com `indicadoresMovimento` devolvendo datas variadas; verificar abas, alertas
  clicáveis, chips, lista, matriz, clique abrindo o modal e re-render ao fechar, impressão.

## Fora de escopo

Ritmo por semana (criadas/concluídas), tendência com snapshot diário, e-mail semanal, edição em massa, ordenação
por cabeçalho na lista de risco, deep link para a aba.

## Publicação

`npm test` → `clasp push` (conferir a lista de 7 arquivos) → `clasp deploy -i
AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8` (front + backend na mesma versão) → hard
reload → registrar no HANDOFF.
