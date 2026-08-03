# HANDOFF — Cora. Gestão de Tarefas

> Estado do projeto ao final da sessão de **03/08/2026** (atualizado no bloco do
> feedback do Guilherme sobre o checklist).
> Ponto de partida para a próxima sessão: ler este arquivo + `CLAUDE.md` + `README.md`.
> Manter atualizado ao fim de cada bloco de trabalho.

## Onde estamos

- Branch de trabalho: **`mvp-shadcn-piloto`** (PR #3 aberto contra `main`, ainda não mergeado).
- Último commit: `8213b38` — *fix: save bloqueado por prazo legado + feat: duplicar tarefa*.
- Código já enviado ao Apps Script via `npx clasp push -f`.
- Frontend servido: **`tarefas-shadcn.html`** (constante `HTML_FILE` no `Code.gs`).
  `tarefas.html` continua no repo apenas como rollback.
- Beta ativo com allowlist (`PILOTO_ATIVO = true`): Aurélio, Jacqueline, Guilherme,
  Thiago e Dra. Glaucia Ruggeri (Gestora).
- `.claude/settings.local.json` fica **sempre modificado e não commitado** de propósito
  (config local de ferramentas).

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
| 1 | **Publicar Nova versão** | Apps Script → Implantar → Gerenciar implantações → ✏️ → Nova versão. `clasp push` já feito em 03/08 12:51 — cobre o fix do checklist (`2630914`) e a fase 1 de performance (`84ec1e8`). Depois hard reload (Ctrl+Shift+R). Regra de ouro: **nunca** criar implantação nova. |
| 1b | ⚠️ **Definir `TOKEN_GEMINI`** | **Obrigatório agora**: o fallback hardcoded foi removido (o valor estava exposto em repo público). Sem a Script Property `TOKEN_GEMINI` definida, o `doPost` rejeita tudo com "Integração não configurada no servidor" — se o Gem do Gemini estiver em uso, ele para até você criar a propriedade com um valor novo. Apps Script → Configurações do projeto → Propriedades do script. |
| 2 | **Jac retestar** | Confirmar que salvar edição em tarefa atribuída a ela não bloqueia mais no prazo, e testar o botão **Duplicar**. |
| 3 | **Glaucia** | Testar em janela anônima (o "Olá, …" vazio vem de `Session.getActiveUser()` sem e-mail quando há várias contas Google logadas). Se o perfil não aparecer, rodar `adicionarUsuariosPiloto()` no Apps Script. |
| 4 | **Repo da organização** | Criar repo **privado e vazio** `Unimed-CNU/cora-gestao-de-tarefas`. O remote `cnu` já está configurado localmente; depois é só `git push cnu main mvp-shadcn-piloto`. |
| 5 | **Segurança** | Tornar **privado** o repo `vinicius-baiao/Unimed-CNU` (hoje público com token queimado + lista de e-mails) e definir a Script Property `TOKEN_GEMINI` com um valor novo (o fallback hardcoded no `Code.gs` deve ser considerado comprometido). |
| 6 | ~~**Remetente `taskcenter@`**~~ **resolvido em 03/08** | `verificarAliases()` retornou `true` com o alias na conta que executa o script (`aurelio.pereira.ext@`): `["taskcenter@unimedcnu.coop.br"]`. Nada a mudar no código — `enviarEmail()` consulta `GmailApp.getAliases()` a cada envio e usa `from: taskcenter@`. **Falta só conferir no primeiro e-mail real** se o cliente exibe "enviado por aurelio.pereira.ext@…" abaixo do `De:`: Send-As por alias mantém a conta real no cabeçalho `Sender:`, e remover isso exigiria a TI configurar SMTP do domínio em vez de alias. |
| 7 | **Gui retestar checklist** | Depois de publicar a Nova versão: abrir uma tarefa pelo clique na linha da Lista (modo visualização) e marcar itens do checklist — deve salvar sozinho, com toast "Checklist atualizada." e a barra do card atualizando. |
| 8 | **URL do Google Sites** | Escolher endereço curto (sugestão: `/cora`) e tornar a página do app a home do site. Depois disso posso adicionar uma constante `URL_PORTAL` no `Code.gs` para os links dos e-mails. |

## Backlog técnico (fase 2)

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
