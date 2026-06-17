# Resumo do Projeto — Tarefas CNU

## Objetivo

Módulo de gestão de tarefas (Lista + Kanban) para a equipe da Rede Ambulatorial da Unimed CNU,
integrado ao portal interno (Google Sites). Substitui protótipo em AppSheet que tinha duas
limitações no plano free:

- E-mails redirecionados só para o criador do app
- Sem integração com Google Calendar

Apps Script resolve ambos nativamente (`MailApp` + `CalendarApp`).

## Arquitetura

```
Google Sheets "Tarefas CNU"  ←→  Apps Script Web App (Code.gs)  ←→  tarefas.html (frontend)
                                          ↓
                          triggers diários: relatorioDiario() (17h) + lembretesDiarios() (8h)
```

- **Backend:** `Code.gs` — roteador `doGet(e)` despacha por `e.parameter.acao`.
- **Transporte:** JSONP (script tag dinâmica) — POST cross-origin não funciona com Web App.
- **Persistência:** 5 abas no Google Sheets (ver Esquema abaixo).
- **Índices fixos:** `Code.gs` usa o objeto `COL` com base 0 — **não reordenar colunas**.

## Fases

| Fase | Entregável | Status |
|------|-----------|--------|
| 1 | Backend `Code.gs` (endpoints + triggers + setup) | ✅ Entregue |
| 2 | Frontend `tarefas.html` (Lista/Kanban, modal, checklist, PDF, histórico) | ✅ Entregue |
| 3 | Configurar variáveis e publicar Web App no Google Sites | ⏳ Pendente |
| 4 | Testes com usuários do domínio `@unimedcnu.coop.br` | ⏳ Pendente |

## Config pendente antes do go-live

| Arquivo | Variável/Linha | O que preencher |
|---------|---------------|-----------------|
| `Code.gs:5` | `SHEET_ID` | ID da planilha (vazio = container-bound, OK para a maioria dos casos) |
| `Code.gs:11` | `EMAIL_REPORTE` | E-mail(s) para o relatório diário, separados por vírgula |
| `tarefas.html:524` | `WEBAPP_URL` | URL do Web App publicado no Apps Script |

## Endpoints do backend (`acao` em `doGet`)

| Ação | Função | Descrição |
|------|--------|-----------|
| `listarTarefas` | `listarTarefas()` | Retorna tarefas ativas (`Ativo = true`) |
| `criarTarefa` | `criarTarefa(dados)` | Cria tarefa, notifica responsável, cria evento Calendar |
| `atualizarTarefa` | `atualizarTarefa(dados)` | Edita campos com validação de permissão |
| `excluirTarefa` | `excluirTarefa(dados)` | Soft delete (`Ativo = false`) |
| `listarTemplates` | `listarTemplates()` | Templates de checklist da aba `Checklists` |
| `listarChecklist_Status` | `listarChecklist_Status()` | Estado dos itens de checklist por tarefa |
| `salvarChecklist` | `salvarChecklist(dados)` | Substitui (remove + regrava) itens de uma tarefa |
| `listarInteracoes` | `listarInteracoes(dados)` | Histórico de interações filtrado por `idTarefa` |
| `adicionarInteracao` | `adicionarInteracao(dados)` | Grava comentário/interação na aba `Interações` |
| `getUsuario` | — | Retorna e-mail via `Session.getActiveUser()` |

Funções sem rota (acionadas por trigger ou manualmente):

- `setup()` — cria as 5 abas, cabeçalhos, validações e formatação (rodar 1 vez)
- `relatorioDiario()` — e-mail HTML com resumo de status e tarefas por prazo (trigger 17h)
- `lembretesDiarios()` — e-mail de lembrete D-1 para o responsável (trigger 8h)

## Regras de negócio

- **Só o criador** pode marcar a tarefa como `Concluído` ou alterar o `Prazo`.
- Toda mudança de **status** gera uma interação automática na aba `Interações`.
- Toda escrita relevante grava na aba **`Log`** (auditoria: editor, ação, campo, antes/depois).
- Exclusão é **soft delete** — `Ativo = false`; filtros excluem essas linhas.

## Esquema das abas (Google Sheets)

### Aba `Tarefas` — índices fixos no objeto `COL`

| Col | Nome | Tipo | Observação |
|-----|------|------|------------|
| A | ID | Número | Sequencial, gerado pelo backend |
| B | Tarefa | Texto | Descrição |
| C | Projeto | Texto | Livre. Ativos: Gestão de Demandas, Rede Higiene, Cuidado Transicional, Alto Custo |
| D | Responsável | E-mail | **Obrigatório `@unimedcnu.coop.br`** — usado por MailApp e CalendarApp |
| E | Prazo | Data | Base do trigger D-1 e do evento Calendar |
| F | Status | Lista | `A fazer` / `Em andamento` / `Bloqueado` / `Concluído` |
| G | Prioridade | Lista | `Crítica` / `Alta` / `Média` / `Baixa` |
| H | Criado por | E-mail | Backend via `Session.getActiveUser()` |
| I | Data criação | Data/Hora | Backend |
| J | Observações | Texto | Contexto adicional |
| K | Ativo | Boolean | `TRUE` padrão; soft delete seta `FALSE` |

### Aba `Log`
`ID | Data/Hora | Editor | Ação | Campo | Valor Anterior | Valor Novo`

### Aba `Checklists` (templates)
`ID_Template | Nome_Template | Item | Ordem`

### Aba `Checklist_Status` (estado por tarefa)
`ID | ID_Tarefa | ID_Template | Item | Ordem | Concluído | Data conclusão`

### Aba `Interações`
`ID | ID_Tarefa | Data/Hora | Editor | Tipo | Conteúdo`

## Setup inicial (uma vez)

1. Criar planilha "Tarefas CNU" no Google Drive (pode ser container-bound ao script)
2. No Apps Script vinculado, colar `Code.gs` e rodar a função `setup()` — ela cria todas as
   5 abas, cabeçalhos, validações e formatação automaticamente
3. Preencher `EMAIL_REPORTE` em `Code.gs:11`
4. Publicar como Web App: **executar como usuário que acessa**, **acesso restrito ao domínio**
5. Copiar URL do Web App para `WEBAPP_URL` em `tarefas.html:524`
6. Criar dois triggers temporais no Apps Script:
   - `lembretesDiarios` → diário, 8h, fuso `America/Sao_Paulo`
   - `relatorioDiario` → diário, 17h, fuso `America/Sao_Paulo`
7. `clasp push` para subir versões via CLI (`.clasp.json` não vem no clone — ver CLAUDE.md)

## Lições aprendidas (projeto Rede Premium — não repetir)

1. HtmlService sandboxeia JS complexo → hospedar frontend fora do Apps Script
2. POST cross-origin não funciona → usar JSONP (script tag dinâmica)
3. **NUNCA** criar nova implantação → sempre editar a existente (lápis ✏️ → Nova versão)
4. Cache do browser → hard reload (Ctrl+Shift+R) ou aba anônima após publicar
5. Filtros devem excluir registros inativos (`Ativo = false`) explicitamente

## Migração do AppSheet

A planilha original (`CNU_TaskTracker_Template.xlsx`) tinha 5 tarefas de exemplo com `Responsável`
preenchido com **nomes** (Aurélio, Michel, Tainara, Baião, Thiago). Ao migrar:

1. Substituir os nomes na coluna D pelos e-mails `@unimedcnu.coop.br` correspondentes
2. Adicionar coluna K (`Ativo`) com valor `TRUE` para todas as linhas existentes
3. Rodar `setup()` para criar as demais abas
