# CLAUDE.md — Tarefas CNU

> Carregado automaticamente pelo Claude Code no início de cada sessão neste diretório.
> Ponto de partida para entender o projeto e continuar de onde paramos.

## O que é este projeto

**Gestor de tarefas (Lista + Kanban)** para a equipe da **Rede Ambulatorial da Unimed CNU**,
pensado para ser embutido no portal interno (Google Sites). Substitui um protótipo anterior em
**AppSheet**, que no plano free não redirecionava e-mails corretamente nem integrava com o Calendar
— limitações que o Apps Script resolve nativamente (`MailApp` + `CalendarApp`).

## Arquitetura

```
Google Sheets "Tarefas CNU"  ←→  Apps Script Web App (Code.gs)  ←→  tarefas.html (frontend)
                                          ↓
                          triggers diários: relatorioDiario() + lembretesDiarios() (D-1)
```

- **Backend:** `Code.gs` (Apps Script). Roteador `doGet(e)` despacha por `e.parameter.acao`.
- **Transporte:** **JSONP** (script tag dinâmica) — POST cross-origin não funciona com Web App.
  O frontend monta a chamada em `chamarAPI()` passando `callback=` e o backend embrulha o JSON.
- **Persistência:** abas do Google Sheets (`Tarefas`, `Log`, `Checklists`, `Checklist_Status`,
  `Interações`). O `Code.gs` usa **índices de coluna fixos** (objeto `COL`) — não reordenar colunas.

## Stack

- **Google Apps Script** (backend `.gs`, JS estilo ES5 — `var`, sem módulos)
- **HTML + JS vanilla** no frontend (`tarefas.html`, ~49 KB, tudo inline: markup + CSS + JS)
- **clasp** para subir o código pro Apps Script via CLI
- Sem framework, sem build step

## Endpoints do backend (`acao` no `doGet`)

| Ação | Função | Papel |
|---|---|---|
| `listarTarefas` | `listarTarefas()` | Lista tarefas ativas (ignora `Ativo = false`) |
| `criarTarefa` | `criarTarefa(dados)` | Cria + notifica responsável + cria evento no Calendar |
| `atualizarTarefa` | `atualizarTarefa(dados)` | Edita campos; regras de permissão (ver abaixo) |
| `excluirTarefa` | `excluirTarefa(dados)` | **Soft delete** (seta `Ativo = false`) |
| `listarTemplates` | `listarTemplates()` | Templates de checklist agrupados por `ID_Template` |
| `listarChecklist_Status` | `listarChecklist_Status()` | Estado dos itens de checklist por tarefa |
| `salvarChecklist` | `salvarChecklist(dados)` | Substitui (remove + regrava) os itens de uma tarefa |
| `listarInteracoes` | `listarInteracoes(dados)` | Histórico de interações de uma tarefa |
| `adicionarInteracao` | `adicionarInteracao(dados)` | Adiciona comentário/interação |
| `getUsuario` | — | Retorna e-mail do usuário logado (`Session.getActiveUser`) |

Funções **sem rota** (rodam por trigger/manual): `setup()` (cria abas e validações, rodar 1x),
`relatorioDiario()` (e-mail HTML de resumo), `lembretesDiarios()` (lembrete D-1).

## Esquema da aba Tarefas (ordem fixa — `Code.gs` usa índices)

| Col | Nome | Tipo | Observação |
|-----|------|------|------------|
| A | ID | Número | Sequencial, gerado pelo backend (`proximoId`) |
| B | Tarefa | Texto | Descrição |
| C | Projeto | Texto | Livre. Ativos: Gestão de Demandas, Rede Higiene, Cuidado Transicional, Alto Custo |
| D | Responsável | E-mail | **Deve ser `@unimedcnu.coop.br`** — usado por MailApp/CalendarApp |
| E | Prazo | Data | Base do trigger D-1 e do evento no Calendar |
| F | Status | Lista | `A fazer` / `Em andamento` / `Bloqueado` / `Concluído` |
| G | Prioridade | Lista | `Crítica` / `Alta` / `Média` / `Baixa` |
| H | Criado por | E-mail | Backend via `Session.getActiveUser()` |
| I | Data criação | Data/Hora | Backend |
| J | Observações | Texto | Contexto adicional |
| K | Ativo | Boolean | `TRUE` padrão; soft delete seta `FALSE` |

## Regras de negócio importantes

- **Só quem criou a tarefa** pode marcá-la como `Concluído` ou alterar o `Prazo`
  (`atualizarTarefa` valida `editor === criador`).
- Toda mudança de **status** vira uma **interação automática** na aba `Interações`.
- Toda escrita relevante grava na aba **`Log`** (auditoria: editor, ação, campo, antes/depois).
- Exclusão é **soft delete** — nada é apagado de fato; filtros excluem `Ativo = false`.

## Como rodar / desenvolver

```bash
npx serve -p 3000 .     # preview local da UI (config em .claude/launch.json)
```

⚠️ O preview local mostra **só a interface**: `tarefas.html` chama um `WEBAPP_URL` real (linha
~524, atualmente **vazio**), então os dados não carregam sem backend publicado ou mock.

**Deploy do backend (clasp):**
```bash
clasp login
# .clasp.json está no .gitignore e NÃO vem no clone — recriar com o scriptId do projeto:
#   { "scriptId": "<id>", "rootDir": "." }
clasp push
```

**Regra de ouro do deploy (lição do projeto Rede Premium):** **NUNCA** criar uma nova implantação
no Apps Script. Sempre editar a existente (lápis ✏️ → Nova versão). Após publicar, fazer
**hard reload** (Ctrl+Shift+R) ou aba anônima pra furar o cache do browser.

## Config que precisa ser preenchida

| Onde | Variável | Estado | Para quê |
|---|---|---|---|
| `Code.gs:5` | `SHEET_ID` | vazio | Necessário se o script for standalone (vazio = container-bound) |
| `Code.gs:11` | `EMAIL_REPORTE` | vazio | Destinatário(s) do relatório diário |
| `tarefas.html:524` | `WEBAPP_URL` | vazio | URL do Web App que o frontend consome |

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `Code.gs` | Backend Apps Script: roteador, CRUD, checklists, interações, e-mails, triggers |
| `tarefas.html` | Frontend completo (markup + CSS + JS vanilla): Kanban/Lista, modal, checklist, PDF |
| `appsscript.json` | Manifesto do Apps Script |
| `docs/resumo_projeto.md` | Contexto do projeto (⚠️ tabela de fases está desatualizada — código já entregue) |
| `docs/design_system.md` | Paleta (verde `#004e4c`, dourado `#c9a84c`), tipografia (DM Sans / DM Serif Display) |
| `.claude/launch.json` | Config do preview local (`npx serve -p 3000`) |

## Comunicação

Em **português**.
