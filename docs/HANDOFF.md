# HANDOFF — Cora. Gestão de Tarefas

> Estado do projeto ao final da sessão de **03/08/2026**.
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

## Pendências do usuário (fora do código)

| # | Pendência | Detalhe |
|---|---|---|
| 1 | **Publicar Nova versão** | Apps Script → Implantar → Gerenciar implantações → ✏️ → Nova versão. Cobre os commits `1299593`, `d79df61` e `8213b38`. Depois hard reload (Ctrl+Shift+R). Regra de ouro: **nunca** criar implantação nova. |
| 2 | **Jac retestar** | Confirmar que salvar edição em tarefa atribuída a ela não bloqueia mais no prazo, e testar o botão **Duplicar**. |
| 3 | **Glaucia** | Testar em janela anônima (o "Olá, …" vazio vem de `Session.getActiveUser()` sem e-mail quando há várias contas Google logadas). Se o perfil não aparecer, rodar `adicionarUsuariosPiloto()` no Apps Script. |
| 4 | **Repo da organização** | Criar repo **privado e vazio** `Unimed-CNU/cora-gestao-de-tarefas`. O remote `cnu` já está configurado localmente; depois é só `git push cnu main mvp-shadcn-piloto`. |
| 5 | **Segurança** | Tornar **privado** o repo `vinicius-baiao/Unimed-CNU` (hoje público com token queimado + lista de e-mails) e definir a Script Property `TOKEN_GEMINI` com um valor novo (o fallback hardcoded no `Code.gs` deve ser considerado comprometido). |
| 6 | **Remetente `taskcenter@`** | Falta o *"Enviar e-mail como"* (Send-As) na conta que executa o script. A TI só fez **delegação** da caixa, o que não habilita Send-As. Validar com `verificarAliases()` — hoje retorna `false` / lista vazia, e o envio cai no remetente padrão mantendo só o nome "Tarefas CNU". |
| 7 | **URL do Google Sites** | Escolher endereço curto (sugestão: `/cora`) e tornar a página do app a home do site. Depois disso posso adicionar uma constante `URL_PORTAL` no `Code.gs` para os links dos e-mails. |

## Backlog técnico (fase 2)

- **JSONP → `google.script.run`**: transporte atual é GET com callback; migração remove a limitação de CSRF conhecida.
- **Endpoint `bootstrap` consolidado**: hoje a carga inicial dispara várias chamadas (`listarTarefas`, `listarTemplates`, `listarChecklist_Status`, `getUsuario`, projetos, usuários). Juntar numa só reduz latência e consumo de cota compartilhada.
- **Registro `MODULOS`/`PERFIS` do Shell**: a nav da rail é estática (Início/Tarefas) — divergência do DS registrada de propósito, migrar se o app ganhar módulos.
- **Rotina de correção dos prazos legados**: registros antigos foram gravados como 21:00 do dia anterior (bug de timezone já corrigido no código novo, mas os dados antigos seguem deslocados). Correção pontual em lote está oferecida e não foi executada.
- **Micro-otimização opcional**: `.ckl-bar-fill` anima `width`; poderia usar `transform: scaleX()`.

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
