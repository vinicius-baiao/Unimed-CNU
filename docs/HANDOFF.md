# HANDOFF — Cora. Gestão de Tarefas

> Estado do projeto ao final da sessão de **08/09/2026 (tarde)** — roteiro de conclusão dos planos de
> ação executado (Etapas 1, 2 e 4 concluídas; painéis republicados com os IDs; Etapa 3 gravada às 14:51).
> Ponto de partida para a próxima sessão: ler este arquivo + `CLAUDE.md` + `README.md`.
> Manter atualizado ao fim de cada bloco de trabalho.

## Onde estamos

- Branch de trabalho: **`mvp-shadcn-piloto`** (PR #3 aberto contra `main`, ainda não mergeado).
- (Manhã) Publicado em 08/09/2026 via `clasp deploy -i` (nova versão na implantação existente):
  Cora **@65**; Spravato **v4.74** (@251 e @252, as duas implantações existentes); Carteira PF
  **v8.47** (@77); GT Onco **v1.39** (@64). Os três painéis já leem do Cora; até a importação
  rodar, a seção deles mostra "Nenhuma ação cadastrada" (projeto ainda não existe) ou o erro
  "Projeto não disponível" — esperado. **Superado à tarde: importação feita, painéis republicados — ver bullet abaixo e o bloco de 08/09 (tarde).**
- Endpoints da carga inicial: `bootstrap` + `bootstrapApoio`, chamados em paralelo pelo front.
- O Web App atende **somente GET** — o `doPost` saiu com a integração do Gem.
- Frontend servido: **`tarefas-shadcn.html`** (constante `HTML_FILE` no `Code.gs`).
  `tarefas.html` continua no repo apenas como rollback.
- Beta ativo (`PILOTO_ATIVO = true`): a allowlist é a **aba `Usuários`**. Depois de
  `importarUsuariosEquipe(false)`, são 40 pessoas da Atenção à Saúde mais os 5 do piloto.
- Testes: `npm test` (Node, sem dependências) — rodar antes de todo `clasp push`.
- `.claude/settings.local.json` fica **sempre modificado e não commitado** de propósito
  (config local de ferramentas).

### Último bloco — 08/09 (noite): marcar colega com busca + nomes humanizados + alerta de carga — publicado @67

Spec: `docs/superpowers/specs/2026-09-08-marcar-colega-busca-e-nomes-design.md`; plano:
`docs/superpowers/plans/2026-09-08-marcar-colega-busca-e-nomes.md`. Executado por subagentes (implementador +
revisor por tarefa, revisão final da branch), commits `47f0dcd..76286ec`, só `tarefas-shadcn.html`.

- **Checklist:** o `<select>` de colega virou um **chip** por item (iniciais + primeiro nome, ou "+ colega") que abre
  um **popover de busca único** (nome, e-mail, cargo; Enter escolhe; Esc fecha só o popover; clique fora fecha).
  Ativo em visualização (salva na hora) e edição. `montarOpcoesUsuarios()` é compartilhada com o combo de Responsável.
- **Nomes:** `nomeDeEmail` humaniza o fallback (`fabiane.minozzo` → "Fabiane Minozzo", `.ext` removido); o
  Histórico usa `nomeDeUsuario`.
- **Erro de carga visível na Home** (`#homeAlerta`, com a orientação de conta e "Tentar de novo") — caso Glaucia.
- **Publicação:** @66 subiu com um arquivo de teste Node do workspace `.superpowers/` por engano (definia `esc` e
  `usuarios` globais — perigoso); corrigido em ~1 min com `.claspignore += .superpowers/**` e **@67** limpa.
  Verificado em produção via JSONP: `bootstrap` 80 tarefas / 103 itens, `bootstrapApoio` 79 usuários / 7 projetos.
  A verificação visual do front em produção não é possível pelo Chrome automatizado (iframe cross-origin) — o arquivo
  é o mesmo verificado no preview; **conferir com hard reload** ao abrir.
- **Parqueado (revisão final, sem bloqueio):** foco não volta ao chip após Esc/seleção e Tab não fecha o popover
  (igual ao combo de Responsável); alerta da Home não é visível se a recarga pós-save falhar com a Home oculta
  (toast + board cobrem); `nomeDeEmail` devolve vazio para e-mail só com `ext`.

### Último bloco — 08/09 (tarde): roteiro de conclusão executado pelo Claude Code

Executado via Chrome (sessão do Aurélio) + `clasp`, seguindo
[`docs/ROTEIRO_CONCLUSAO_PLANOS_DE_ACAO.md`](ROTEIRO_CONCLUSAO_PLANOS_DE_ACAO.md). Simulação antes de cada gravação.

| Etapa | Resultado |
|---|---|
| 1 `migrarProjetosPublico` | OK 13:28 — coluna `Publico` criada, 4 projetos legados em FALSE |
| 2 remap Guilherme Borges | OK — sim 13:39 (3 células: Usuários L40; Tarefas L19/L20 col 4) → gravado 13:58. Ele é `guilherme.silva@` (ainda *Usuário Padrão*) |
| 3 `importarUsuariosEquipe` | OK — simulação 14:02 ("38 a adicionar, 2 a atualizar") → **gravada 14:51** após autorização do Aurélio. Aba Usuários com **79** pessoas; Guilherme, Taiara, Carina e Fabiane = Gestor; Glaucia com unidade/cargo. **O Cora está aberto para a equipe** (comunicar: pendência 10) |
| 4 `importarPlanosDeAcao` | OK — sim 14:24 (`Spravato 10 · PF 17 · GT 18 · novas 45 · itens 34`, N=2, M=5) → gravado ~14:26. **IDs: Spravato 5 · Carteira PF 6 · GT Onco 7** (verificado pela rota `planoAcaoProjeto`: 10/17/18 tarefas) |
| 6 painéis | OK — `projetoId` 5/6/7 em `Painel.html` (Spravato, PF, GT) e `build/body_gt.html`; bumps v4.75 / v8.48 (+CHANGELOG) / v1.40; `clasp push -f` + `clasp deploy -i` → @253 / @78 / @65 |

Correção no caminho: `IMPORT_PF_SHEET_ID` preenchido com o `PA_SHEET_ID` do PF
(`1QD-jYJl8j8a5Ww0oJ_Hru-7zRHZ1VcIGdbgKdrQGyaQ`), porque a busca por nome no Drive não casava (nome com travessão);
teste ajustado. A 1ª tentativa da Etapa 4 (14:10) falhou por isso — aparece como "Falha" na página Execuções.

**Glaucia (abriu a sessão):** está na aba Usuários como Gestor e na allowlist. `bootstrapApoio` devolve projetos e
usuários normalmente e não filtra por usuário → o "vê o site mas não vê projetos/usuários" foi falha pontual da 2ª
chamada da carga inicial (o front abre mesmo assim, por desenho). Hard reload resolve; se repetir, investigar rede.

**Verificação da spec (17 passos):** feitos os checks server-side (rota pública por nome para os 3 projetos,
contagens, projetos ativos e públicos). Pendentes os que exigem navegador/pessoas — Etapa 5 itens 1–3 (Cora: chip
`público`, `?projeto=7`, `?tarefa=<id>`), 4–5 (seção Plano de Ação nos 3 painéis), 6 (conta fora da aba Usuários) e
7 (Taiara/Carina — depende da Etapa 3).

**Limpeza:** `_Roteiro.gs` e os `case '_roteiro_*'` temporários do `doGet` foram removidos e o HEAD re-pushado;
a `@65` do Cora nunca mudou. O Cora **não** foi republicado (a única mudança de código é a constante da importação).

### Último bloco — planos de ação dos painéis dentro do Cora (08/09/2026)

Spec: [`docs/superpowers/specs/2026-09-08-planos-de-acao-dos-paineis-no-cora-design.md`](superpowers/specs/2026-09-08-planos-de-acao-dos-paineis-no-cora-design.md).
Plano: [`docs/superpowers/plans/2026-09-08-planos-de-acao-dos-paineis-no-cora.md`](superpowers/plans/2026-09-08-planos-de-acao-dos-paineis-no-cora.md).

Os painéis Spravato, Carteira PF e GT Onco passam a ler o plano de ação do Cora (rota
`planoAcaoProjeto`, JSONP, somente leitura, botões "Abrir/Editar no Cora"). No Cora:

- Coluna **`Publico`** (F) na aba Projetos; checkbox no modal; chip na lista.
- `idsTarefasVisiveis()` inclui tarefas de projeto público. Pré-filtro "minhas tarefas" ao
  abrir vale para todos os perfis.
- **Allowlist = aba Usuários** (`EMAILS_PILOTO` saiu).
- Rota `planoAcaoProjeto` fora da allowlist, cache 60 s invalidado pelas escritas.
- Link profundo `?projeto=` / `?tarefa=` (atributo `data-deep-link` no `<body>`).
- `ImportacaoUsuarios.gs`: 39 pessoas da planilha da equipe (não versionada) + Fabiane;
  Gestores: Fabiane, Guilherme Borges (`guilherme.silva@`, CLT; a conta `.ext` é remapeada),
  Glaucia, Taiara, Carina. `remapearEmailUsuario()` troca o e-mail em Usuários, Tarefas e
  Checklist_Status (Log e Interações ficam como histórico).
- `ImportacaoPlanos.gs`: 8 ações do Spravato + custom, 12 do PF + custom (planilha do PF
  localizada pelo nome no Drive), 18 macroações do GT com 34 desdobramentos como checklist.
  Idempotente pela marca `Origem: <painel>#<id>` em Observações. Sem e-mail, sem Calendar.
  ⚠️ O painel GT diz "20 macroações", mas numera de 1 a 21; menos 3 canceladas = 18.
- Harness de testes Node em `tests/` (`npm test`), `.claspignore` para não subir testes/docs.

**Roteiro passo a passo, com o que anotar e o que colar no Claude Code depois:**
[`docs/ROTEIRO_CONCLUSAO_PLANOS_DE_ACAO.md`](ROTEIRO_CONCLUSAO_PLANOS_DE_ACAO.md). Resumo:

**Roteiro de execução no editor do Apps Script (nesta ordem; cada uma primeiro com `true`,
conferindo o Logger, depois com `false`):**

1. `migrarProjetosPublico()` — cria a coluna F na aba Projetos existente.
2. `remapearEmailUsuario('guilherme.silva.ext@unimedcnu.coop.br', 'guilherme.silva@unimedcnu.coop.br', true)`
3. `importarUsuariosEquipe(true)` — esperado: 38 a adicionar, 2 a atualizar (Glaucia e Guilherme).
   A partir do `false`, **os 40 entram no Cora**.
4. `importarPlanosDeAcao(true)` — esperado: Spravato 8+custom, PF 12+custom, GT 18; 34 itens.
   Pede autorização do escopo de Drive na primeira execução. Anotar os **IDs dos projetos**
   que o Logger imprime: eles vão em `CORA_PROJETO_ID` de cada painel.

**Painéis já publicados** com `PAC_CONFIG.projetoId = 0` (localizam o projeto pelo **nome**; a
rota aceita `projetoNome` como fallback). Depois da importação, preencher o ID em cada
`Painel.html` (Spravato `appscript/`, PF `cora-carteira-pf/`, GT `cora-painel-gt/` + `build/body_gt.html`)
e republicar com `clasp deploy -i` — ou deixar pelo nome, que funciona enquanto ninguém renomear
o projeto. O bloco copiado nos três é `integracoes/PlanoAcaoCora.html`; reaplicar com
`python integracoes/aplicar_painel.py <spravato|pf|gt>` (idempotente por asserções).

**Ainda não executado (depende do editor do Apps Script, `clasp run` não está habilitado):** o
roteiro abaixo. **Verificação publicada pendente:** os 17 passos da seção Verificação da spec.

⚠️ Efeito imediato da publicação @65 que já está no ar: a allowlist virou a aba `Usuários`. Os 5
do piloto continuam entrando (estão na aba). O Guilherme Borges ainda entra pela conta `.ext`
até o remapeamento rodar.

### Bloco anterior — marcação de colegas em itens de checklist

Feature reativada (estava desligada desde 15/07 pelo commit `0a08c3a`, por spam de e-mail).
Spec: [`docs/superpowers/specs/2026-08-03-marcacao-colegas-checklist-design.md`](superpowers/specs/2026-08-03-marcacao-colegas-checklist-design.md).

Cada item tem um `<select>` de colega, ativo em visualização e em edição; em visualização
salva na hora. Abaixo da checklist, um botão por pessoa marcada envia um e-mail com os itens
dela. **Nenhuma notificação automática** — a antiga renotificava todos a cada save, e hoje
seria pior porque o save ocorre a cada clique de checkbox. A flag `CHECKLIST_MARCACAO_ATIVA`
e o código dela saíram.

⚠️ **Lembrete de comportamento:** atribuir um item a alguém **dá a essa pessoa acesso de
leitura à tarefa inteira** (`idsTarefasVisiveis` trata "marcado em item" como critério).

**Importante saber ao usar:** o botão de avisar aparece **só em modo visualização**. Em edição
a marcação ainda não está na planilha, e a rota valida contra ela — o botão ficaria recusando.
Fluxo certo: montar/atribuir em edição, **Salvar**, e avisar na visualização.

**Pendente de teste real** (o mock não exercita o backend). As três validações da rota, uma a
uma:

1. **Caminho felizardo** — atribuir um item a si mesmo, salvar, clicar em avisar; o e-mail deve
   chegar pelo `taskcenter@` com o item listado.
2. **Colega não marcado** — chamar a rota com um e-mail que não está marcado na tarefa; deve
   recusar com "Este colega não está marcado em nenhum item desta tarefa."
3. **Visibilidade** — Guilherme (Usuário Padrão) chamando a rota com o ID de uma tarefa que ele
   não enxerga; deve recusar com "Sem permissão para avisar nesta tarefa." Esta é a validação
   que impede disparar e-mail sobre tarefa de outra pessoa, e é a que nenhuma verificação local
   alcança.

Já conferido antes de publicar: as 16 marcações existentes em produção usam só domínios
permitidos, então a validação nova de domínio no `salvarChecklist` não bloqueia o save de
nenhuma tarefa legada.

### Último bloco — performance da carga inicial (fechado)

**Resultado: abertura do app de 4.350 ms para 2.850 ms (-35%), tempo de servidor por carga de
~11,6 s para ~4,6 s (-60%).** Topologia no ar: duas rotas em paralelo — `bootstrap`
(perfil + tarefas + checklist) e `bootstrapApoio` (usuários + projetos, ambos do
`CacheService`). Mais o fim da chamada morta `listarTemplates`, cache de leitura por execução
no backend e `gravarLogs` sem `getLastRow()` no laço.

Percurso completo, com as duas previsões que erraram e o placar das cinco topologias
testadas, em [`docs/DEBITO_TECNICO.md`](DEBITO_TECNICO.md). Resumo da lição: **num backend que
já paraleliza, consolidar chamadas economiza quota, não tempo** — o overhead por execução é
pago em paralelo, então o tempo de parede é o da rota mais lenta.

⚠️ **Alavanca conhecida, caso alguém reclame da abertura:** 5 rotas paralelas medem ~0,5 s
mais rápido que as 2 atuais, ao custo de 1,8× de tempo de servidor. Optei pelas 2 porque
0,5 s cabe na variância da própria rota crítica e o consumo pela metade escala melhor com o
piloto crescendo. Trocar é uma decisão de uma linha no front e uma no backend.

### Bloco anterior — fase 1 de performance (histórico)

Sweep de débito técnico virou implementação no mesmo dia. Medição no app publicado mostrou
que abrir o app custava **4.353 ms**, quase tudo esperando **6 execuções** do Apps Script, e
que o gargalo é o overhead por execução (~1,2-1,9 s cada, independente do payload), não o
volume de dados. Detalhes e números em [`docs/DEBITO_TECNICO.md`](DEBITO_TECNICO.md).

Feito: endpoint `bootstrap` (6 chamadas → 1, e o save pós-edição de 4 → 1), remoção do
`listarTemplates` (1,9 s para devolver lista vazia, dado que ninguém lia), cache de leitura
por execução no backend (`Tarefas` e `Checklist_Status` eram lidas 3× por carga),
`mapaPerfis()` memoizado, `gravarLogs()` sem `getLastRow()` no laço, token do Gem sem
fallback hardcoded e mock local anonimizado.

**Medido depois de publicar — e a premissa estava errada.** O `bootstrap` **não** ficou mais
rápido: mediana ~4,4 s contra ~3,1 s do modelo de 6 rotas, medidos lado a lado. Motivo: o
Apps Script atende as requisições em paralelo de verdade, então o tempo de parede antigo era
o da rota mais lenta, não a soma dos overheads; o `bootstrap` paga o overhead uma vez mas
serializa as 4 leituras de aba.

O que a mudança entregou de fato: tempo de servidor por carga de ~11,6 s → ~3,5 s (a quota é
por tempo de execução e é compartilhada), contenção de ~30 → 5 execuções simultâneas com o
piloto todo abrindo junto, primeiro render já completo e dados consistentes numa leitura só.

Números e ressalvas em [`docs/DEBITO_TECNICO.md`](DEBITO_TECNICO.md). Atenção: as medições
saturaram o script momentaneamente ("Failed to fetch" por alguns instantes) — evitar rajadas
de teste com o piloto em uso.

### Bloco anterior — checklist marcável em visualização

Feedback do Guilherme: não conseguia dar check nos itens do checklist. Causa-raiz: o modal
abre em modo **visualização** quando se clica na linha da Lista ou no card da Home, e o
modo view desabilitava *todos* os controles do checklist. A saída (botão **Editar**) só
aparece para criador/Admin/Gestor — logo, Usuário Padrão em tarefa de terceiro ficava sem
saída, com o checkbox travado e sem indicação visual disso.

Correção em `tarefas-shadcn.html`:

- Em view o **checkbox segue ativo** e o clique **salva na hora** (`salvarCklImediato`),
  sem passar por Editar/Salvar — marcar item é execução, não edição de cadastro.
  Um envio por vez (`cklSalvando`/`cklPendente`): cliques em rajada viram um reenvio com o
  estado final, porque o backend reescreve a aba inteira.
- Erro na gravação reverte o checkbox ao estado do servidor (`salvarCkl` agora passa o
  `data` ao callback) e mantém o aviso em toast.
- `sincronizarCklLocal()` atualiza `cklStatus` e re-renderiza Home/Board, então a barra de
  progresso do card reflete na hora, sem novo `carregarTudo()`.
- Excluir item (`×`) e selects continuam travados em view, agora **com** estilo de
  desabilitado (opacidade + `not-allowed`) — a ausência disso é o que fez o bug parecer
  "o clique não funciona".

Verificado no preview com mocks simulando o perfil do Guilherme (Usuário Padrão, tarefa
criada por outra pessoa): checkbox ativo, envio com o item marcado, reversão em erro,
concorrência (3 cliques → 2 envios, o segundo com o estado final), modos edit/create
inalterados, console sem erros.

## Pendências do usuário (fora do código)

| # | Pendência | Detalhe |
|---|---|---|
| 1 | ~~**Publicar Nova versão**~~ **feito em 03/08** | Publicado cobrindo tudo até `bcbe051`. Para os próximos deploys: `clasp push` é meu; publicar é Apps Script → Implantar → Gerenciar implantações → ✏️ → Nova versão, seguido de hard reload (Ctrl+Shift+R). Regra de ouro: **nunca** criar implantação nova. |
| 2 | **Jac retestar** | Confirmar que salvar edição em tarefa atribuída a ela não bloqueia mais no prazo, e testar o botão **Duplicar**. |
| 3 | **Glaucia** | Testar em janela anônima (o "Olá, …" vazio vem de `Session.getActiveUser()` sem e-mail quando há várias contas Google logadas). O cadastro dela é mantido/atualizado por `importarUsuariosEquipe()`. |
| 4 | **Repo da organização** | Criar repo **privado e vazio** `Unimed-CNU/cora-gestao-de-tarefas`. O remote `cnu` já está configurado localmente; depois é só `git push cnu main mvp-shadcn-piloto`. |
| 5 | **Segurança** | Tornar **privado** o repo `vinicius-baiao/Unimed-CNU` (hoje público com a lista de e-mails da equipe). O token que também estava exposto lá deixou de importar: o endpoint que o usava foi removido em 03/08/2026 junto com a integração do Gem. |
| 6 | ~~**Remetente `taskcenter@`**~~ **resolvido em 03/08** | `verificarAliases()` retornou `true` com o alias na conta que executa o script (`aurelio.pereira.ext@`): `["taskcenter@unimedcnu.coop.br"]`. Nada a mudar no código — `enviarEmail()` consulta `GmailApp.getAliases()` a cada envio e usa `from: taskcenter@`. **Falta só conferir no primeiro e-mail real** se o cliente exibe "enviado por aurelio.pereira.ext@…" abaixo do `De:`: Send-As por alias mantém a conta real no cabeçalho `Sender:`, e remover isso exigiria a TI configurar SMTP do domínio em vez de alias. |
| 7 | ~~**Gui retestar checklist**~~ **validado em 03/08** | Guilherme testou na versão publicada e aprovou: marcar itens do checklist em modo visualização funciona. Encerra o feedback que abriu a sessão. |
| 8 | **URL do Google Sites** | Escolher endereço curto (sugestão: `/cora`) e tornar a página do app a home do site. Depois disso posso adicionar uma constante `URL_PORTAL` no `Code.gs` para os links dos e-mails. |
| 9 | **Executar o roteiro do bloco de 08/09** | `migrarProjetosPublico` → `remapearEmailUsuario` → `importarUsuariosEquipe` → `importarPlanosDeAcao`, cada uma em simulação antes. Depois, passar os IDs dos projetos para os painéis e publicar os três. **→ Feito em 08/09 à tarde (Etapas 1, 2 e 4 + painéis republicados); resta só a Etapa 3 — ver pendência 11.** |
| 10 | **Comunicar a equipe** | **Já vale (Etapa 3 gravada 14:51):** Os 40 passam a entrar no Cora após a importação. E-mail de boas-vindas fica com o Aurélio. |
| 11 | ~~**Etapa 3 — liberar os 38 da equipe**~~ **feita em 08/09 às 14:51** | `importarUsuariosEquipe(false)` está simulada e aprovada (38 a adicionar, 2 a atualizar). Gravar **abre o Cora para as 40 pessoas** — decisão sua. Se preferir liberar por etapas, pedir um filtro por equipe. Enquanto não gravar, o Guilherme Borges segue *Usuário Padrão* e Taiara/Carina/Fabiane não entram. |

## Backlog técnico (fase 2)
- **Visão de gestores para indicadores** — próximo passo pedido pelo Aurélio em 08/09/2026: painel de indicadores
  para o perfil Gestor (escopo a levantar em brainstorming: quais indicadores, por projeto/equipe/pessoa, período).

> 📋 Sweep completo de performance e débito técnico em
> [`docs/DEBITO_TECNICO.md`](DEBITO_TECNICO.md) (03/08/2026): 12 itens priorizados por
> `(Impacto + Risco) × (6 − Esforço)` e plano em 4 fases. Os itens soltos abaixo estão
> cobertos lá com mais contexto.

- **JSONP → `google.script.run`**: transporte atual é GET com callback; migração remove a limitação de CSRF conhecida.
- **Endpoint `bootstrap` consolidado**: hoje a carga inicial dispara várias chamadas (`listarTarefas`, `listarTemplates`, `listarChecklist_Status`, `getUsuario`, projetos, usuários). Juntar numa só reduz latência e consumo de cota compartilhada.
- **Registro `MODULOS`/`PERFIS` do Shell**: a nav da rail é estática (Início/Tarefas) — divergência do DS registrada de propósito, migrar se o app ganhar módulos.
- **Rotina de correção dos prazos legados**: registros antigos foram gravados como 21:00 do dia anterior (bug de timezone já corrigido no código novo, mas os dados antigos seguem deslocados). Correção pontual em lote está oferecida e não foi executada.
- **Micro-otimização opcional**: `.ckl-bar-fill` anima `width`; poderia usar `transform: scaleX()`.
- **Botão "Editar" incoerente com a regra de permissão** (achado do bloco do checklist, não
  corrigido): `podeEditarTarefa()` retorna `true` para todos, mas o botão **Editar** do modal
  exige criador/Admin/Gestor (`tarefas-shadcn.html:1837`, resíduo do modelo antigo). Efeito:
  Usuário Padrão em tarefa de terceiro edita pelo lápis do Kanban, mas não pela linha da
  Lista / card da Home — mesmo campo, dois resultados. Decidir se libera o botão para todos
  (coerente com a regra atual) ou se o modo view volta a ser realmente somente-leitura.

## Achados de design classificados (não mexer)

O hook de design aponta recorrentemente em `tarefas-shadcn.html`, e os 3 primeiros são
**padrão oficial do Design System** — decisão: manter.

- `side-tab` em `.home-stat-card` e `.home-card` — barra colorida de 4px à esquerda é
  exigência do DS (`.stat`) e, nos cards, codifica status da tarefa.
- `layout-transition` em `.side` — `transition: width .18s` é cópia verbatim do Shell do
  starter kit (rail 64→236px no hover); elemento é `position: fixed`.
- `em-dash-overuse` — os travessões são placeholders de UI (`— Selecionar projeto —`) e
  comentários, não prosa.

Silenciar esses avisos via config do hook depende de OK explícito do Aurélio.

## Armadilhas conhecidas (não repetir)

- **Não reordenar colunas** das abas do Sheets — o `Code.gs` usa índices fixos (`COL`).
- **Timezone**: `new Date('YYYY-MM-DD')` é UTC e volta 1 dia em Brasília. Usar
  `parseData()` no front e `parsePrazoLocal()` no back; comparações com
  `Utilities.formatDate(..., Session.getScriptTimeZone(), 'yyyy-MM-dd')`.
- **`gh` CLI nunca autenticou** nesta máquina — PRs e repos são criados pelo navegador.
- **`git push` falha intermitente** com `could not read Username ... /dev/tty`; repetir o
  push isolado resolve.
- **Screenshots do browser dão timeout** com frequência — verificar via `javascript_tool`
  (computed styles, spy em `chamarAPI`) em vez de captura de tela.
- **`Estilos_Fontes.html`** é o arquivo do starter kit com as fontes em base64: nunca
  editar à mão.
- **Automação do editor do Apps Script pelo Chrome é frágil**: o frame de coordenadas do Claude-in-Chrome mudou
  no meio da sessão (1568×698 → 784×349) e cliques "no Executar" caíram fora do botão; um `zoom` fora do frame
  falha *antes* do clique e serve de trava. Clique por **ref** resolve a posição real, mas só "pega" com a página
  assentada há bastante tempo. O editor congela ~30 s após cada Run (log renderizando). A página **Execuções**
  tem Trusted Types (sem JSONP), mas é o lugar confiável para ler status/log (`get_page_text` com a linha expandida).
- **Rodar função manual sem o IDE**: `case` temporário no `doGet` (ramo da allowlist) que executa a função e devolve
  `Logger.getLog()` + erro; chamar via JSONP pela implantação **@HEAD** (`AKfycbybhelw1wWoAAlm0UXUfh_90QMqkjwgWL75OlYHc-0`)
  a partir da página do app (esperar ≥12 s após o load). A `@65` não muda. Remover o `case` depois. Gravações longas
  (>40 s) estouram o cliente — verificar o efeito por outra rota.
- **`get_page_text` não lê valores de `<input>`** (ex.: Propriedades do script) — usar `javascript_tool` lendo `.value`.
- **`clasp push` espelha tudo que não está no `.claspignore`** — em 08/09 um `.js` de teste deixado em
  `.superpowers/` subiu na @66 e definia globais no Apps Script. Ler a lista de arquivos que o push imprime **antes**
  do `clasp deploy`; qualquer diretório de trabalho novo entra no `.claspignore` primeiro.
