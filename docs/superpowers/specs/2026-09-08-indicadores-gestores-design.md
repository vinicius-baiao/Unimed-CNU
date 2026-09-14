# Indicadores para gestores — carga por pessoa e saúde dos projetos — design

> Data: 08/09/2026. Aprovado pelo Aurélio em conversa (foco: carga e gargalos por pessoa **e** saúde dos
> projetos; todas as pessoas com filtro por unidade; aba própria só para Gestor/Admin).
> Contexto: a aba Usuários passou a 79 pessoas e os planos de ação dos painéis viraram projetos no Cora.
> O painel de gestor da Home tem só 4 contadores globais, sem recorte por pessoa, projeto ou prazo.

## Objetivo

Uma tela "Indicadores", visível para Gestor/Admin, que responda: **quem está sobrecarregado ou travado** e
**como está cada projeto** — calculada no front com os dados que o `bootstrap` já entrega (tarefas,
checklists, usuários, projetos). Nenhuma mudança de backend, rota ou planilha.

Só `tarefas-shadcn.html` muda (markup + CSS + JS), mais um teste Node novo em `tests/`.

## 1. Navegação e acesso

- Novo item na rail (`<aside class="side">`), depois de Tarefas: `<a id="nav-indicadores" onclick="setModo('indicadores')" title="Indicadores">` com ícone de barras (SVG inline no padrão dos outros dois). Renderizado sempre, mas `style.display='none'` a menos que `currentUserPodeExcluir`; `renderUserBadge()` (que roda após a carga) ajusta a visibilidade.
- `setModo('indicadores')`: esconde `#homeView` e `#appLayout`, mostra `#indicadoresView`, marca `nav-indicadores` como `.on`, mostra `#btnInicio`, esconde `.view-toggle`, e chama `renderIndicadores()`. Se `!currentUserPodeExcluir`, `setModo('indicadores')` cai para `setModo('home')` (guarda contra chamada manual).
- Home: no painel de gestor (`#homePainel`), um link "Ver indicadores →" (`class="home-link"`, `onclick="setModo('indicadores')"`) alinhado à direita do grid de contadores.
- Sem deep link (`?indicadores`) nesta versão.

## 2. Filtros (`#indFiltros`, topo da view)

- **Unidade** `<select id="indUnidade">`: "Todas as unidades" + unidades distintas da lista `usuarios` (ordem alfabética, ignorando vazias). Valor inicial: a unidade do usuário logado, se existir na lista; senão "Todas".
- **Projeto** `<select id="indProjeto">`: "Todos os projetos" + nomes de `projetos` ativos, mais nomes órfãos presentes em tarefas (mesma regra de `popularFiltros`).
- **Próximas do prazo** `<select id="indJanela">`: 7 (padrão), 14, 30 dias.
- **Busca por nome** `<input id="indBusca">`: filtra só a tabela de Pessoas (nome, e-mail, cargo), sem afetar Projetos.
- Qualquer mudança re-renderiza tudo via `renderIndicadores()`. Estado dos filtros em variáveis globais (`indFiltroUnidade`, `indFiltroProjeto`, `indJanelaDias`, `indBuscaTermo`), sem persistência.

## 3. Cálculo — `calcularIndicadores(dados, filtros, hoje, deps)`

Função **pura** (sem DOM, sem globais), definida no `<script>` principal entre marcadores
`/* @indicadores:inicio */` e `/* @indicadores:fim */` para o teste Node extrair.

Entrada: `dados = {tarefas, cklStatus, usuarios, projetos}` — `tarefas` (objetos como vêm do `bootstrap`, campos `ID`,
`Projeto`, `Responsável`, `Prazo`, `Status`, `Prioridade`), `cklStatus` (`{idTarefa: [{Responsavel,
'Concluído', …}]}`), `usuarios` (`{nome, email, perfil, unidade, cargo}`); `filtros = {unidade, projeto,
janelaDias}` (strings vazias = sem filtro); `hoje` (`Date`, injetado para o teste ser determinístico);
`deps = {parseData, dataValida, nomeDeEmail}` (funções do próprio front, injetadas para a função continuar
pura e testável fora do navegador).

Regras:
- `ativa` = `Status !== 'Concluído'`. `atrasada` = ativa e `Prazo` válido e `< hoje` (dia). `proxima` = ativa e
  `hoje <= Prazo <= hoje + janelaDias`. `bloqueada` = `Status === 'Bloqueado'`; `andamento` = `'Em andamento'`.
- Datas via `deps.parseData`/`deps.dataValida`; nome de quem não está em `usuarios` via `deps.nomeDeEmail`.
- Filtro de **projeto** restringe as tarefas consideradas nas duas seções. Filtro de **unidade** restringe as
  pessoas listadas (e a linha "Sem responsável" só aparece com "Todas as unidades"); não afeta a seção Projetos.
- **Pessoas** — uma entrada por e-mail que é `Responsável` de alguma tarefa (ativa ou concluída) **ou**
  `Responsavel` de algum item de checklist de tarefa ativa. Campos: `email`, `nome` (`u.nome` se cadastrada, senão `deps.nomeDeEmail(email)`), `cargo`,
  `unidade`, `ativas`, `andamento`, `bloqueadas`, `atrasadas`, `proximas`, `itensPendentes` (itens não
  concluídos atribuídos, em tarefas ativas), `concluidas`. Pessoa sem cadastro em `usuarios` entra com
  `unidade=''` e nome humanizado. Ordenação padrão: `atrasadas` desc, `ativas` desc, nome asc.
- **Sem responsável** — entrada especial `{email:'', nome:'Sem responsável'}` com as mesmas contagens sobre
  tarefas com `Responsável` vazio; só quando houver ao menos 1 tarefa ativa nessa condição.
- **Projetos** — uma entrada por nome de projeto presente nas tarefas consideradas (mais projetos ativos sem
  tarefa aparecem com zeros, para o gestor ver que estão vazios). Campos: `nome`, `cor` (de `projetos`, ou
  `#64748b`), `publico`, `total`, `concluidas`, `pct` (0–100, inteiro; 0 se `total=0`), `andamento`,
  `bloqueadas`, `atrasadas`, `proximas`, `cklTotal`, `cklFeitos` (itens das tarefas ativas do projeto).
  Ordenação: `atrasadas` desc, `bloqueadas` desc, `pct` asc, nome asc.
- Retorno: `{ pessoas: [...], semResponsavel: obj|null, projetos: [...], totais: {ativas, atrasadas, bloqueadas, proximas} }`.

## 4. Renderização — `renderIndicadores()`

- Lê filtros, chama `calcularIndicadores`, aplica `indBuscaTermo` sobre `pessoas` (nome/e-mail/cargo) e desenha:
- **Cabeçalho** com os 4 totais (reusa `.home-stat-card`, classe `.alert` quando atrasadas > 0).
- **Pessoas** (`#indPessoas`): `<table class="ind-tabela">` com colunas Pessoa (avatar `avatarInitials` + nome +
  `<small>cargo</small>`), Unidade, Ativas, Em andamento, Bloqueadas, Atrasadas, Próximas, Itens pendentes,
  Concluídas. Cabeçalhos clicáveis ordenam (asc/desc alternando; estado em `indOrdem = {campo, dir}`).
  Células com valor 0 em cinza (`.zero`); atrasadas > 0 em `var(--erro-cor)`; bloqueadas > 0 em âmbar.
  Linha "Sem responsável" fixa no topo, em itálico, quando existir. Clique na linha:
  `setFiltroProjeto(indFiltroProjeto || '')`, `setFiltroResponsavel(email)`, `setModo('tarefas')`.
  Vazio: "Nenhuma pessoa com tarefas nos filtros atuais."
- **Projetos** (`#indProjetos`): grid de cards `.ind-proj` com barra lateral na cor do projeto (padrão dos
  `.home-card`), nome + chip `público` quando for, `concluidas/total` com barra de progresso (`.ind-barra`,
  largura = `pct`), e uma linha de contadores (andamento · bloqueadas · atrasadas · próximas) e progresso de
  checklist (`cklFeitos/cklTotal`). Clique: `setFiltroResponsavel('')`, `setFiltroProjeto(nome)`,
  `setModo('tarefas')`. Vazio: "Nenhum projeto nos filtros atuais."
- Todo texto de dado passa por `esc()`; cores só de `corSegura`-like (o front já valida hex ao desenhar
  projetos — reutilizar `corDoProjeto`).
- Impressão: `#indicadoresView` imprime; filtros e rail somem (regras já existentes para `.side`; acrescentar
  `#indFiltros`).

## 5. CSS

`.ind-filtros` (linha flex com gap, wrap), `.ind-tabela` (largura 100%, células numéricas à direita,
`th` clicável com seta ▲/▼ no ativo, `tr:hover` com `var(--hover-bg)`, `cursor:pointer`), `.ind-tabela .zero`
(`color: var(--muted-foreground)`), `.ind-tabela .ruim` (`color: var(--erro-cor); font-weight:600`),
`.ind-tabela .aviso` (âmbar do DS), `.ind-proj-grid` (grid auto-fill, min 260px), `.ind-proj` (card com
`border-left: 4px solid <cor>`), `.ind-barra` e `.ind-barra > span` (fundo `var(--muted)`, preenchimento
`var(--primary)`, altura 6px, raio 3px), `.home-link` (link discreto na Home). Cores do DS
(`docs/design_system.md`): verde `#004e4c`, dourado `#c9a84c`; erro via `var(--erro-cor)`.

## 6. Testes

- Novo `tests/test_indicadores_front.js`, rodado pelo `tests/run.js` como os demais: lê `tarefas-shadcn.html`,
  extrai o trecho entre `/* @indicadores:inicio */` e `/* @indicadores:fim */`, roda num `vm` com stubs de
  `parseData`/`dataValida` (mesma lógica do front: `YYYY-MM-DD` → `Date` local) e verifica com `hoje` fixo:
  1. contagens por pessoa (ativas, andamento, bloqueadas, atrasadas, próximas na janela, itens pendentes,
     concluídas) num conjunto pequeno de 6 tarefas / 2 pessoas / 1 sem responsável;
  2. linha "Sem responsável" só quando há tarefa ativa sem dono e sem filtro de unidade;
  3. filtro de unidade remove pessoas de outra unidade e não altera a seção Projetos;
  4. filtro de projeto restringe as duas seções;
  5. projeto ativo sem tarefa aparece com zeros; `pct` arredondado; ordenação de projetos e de pessoas;
  6. pessoa fora de `usuarios` entra com nome humanizado e unidade vazia;
  7. tarefa concluída não conta como atrasada nem como próxima.
- Verificação manual no preview (mock) e depois em produção: rail mostra o item só para Gestor/Admin; filtros
  funcionam; clique em linha/card leva para Tarefas filtrada; impressão sem filtros/rail.

## Fora de escopo

Tendência no tempo (criadas/concluídas por semana, tempo até concluir), gráficos além das barras em CSS,
exportação (CSV/PDF), metas por pessoa ou projeto, deep link para a view, persistência de filtros, mudanças
no backend.

## Publicação

`npm test` → `clasp push` → `clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8`
(nova versão na implantação existente) → hard reload → registrar no HANDOFF.
