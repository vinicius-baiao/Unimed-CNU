# Resumo do Projeto — Tarefas CNU

## Objetivo

Módulo de gestão de tarefas (Kanban) para a equipe da Rede Ambulatorial da Unimed CNU, integrado ao portal interno (Google Sites).

## Por que Apps Script?

Substitui protótipo em AppSheet que tinha duas limitações no plano free:
- E-mails redirecionados só para o criador do app
- Sem integração com Google Calendar

Apps Script resolve ambos nativamente (`MailApp` + `CalendarApp`).

## Arquitetura

```
Google Sheets "Tarefas CNU"  ←→  Apps Script Web App  ←→  tarefas.html
                                        ↓
                               Trigger diário (D-1)
```

## Lições aprendidas (projeto Rede Premium — NÃO repetir)

1. HtmlService sandboxeia JS complexo → hospedar frontend fora do Apps Script
2. POST cross-origin não funciona → usar JSONP (script tag dinâmica)
3. **NUNCA** criar nova implantação → sempre editar a existente (lápis ✏️ → Nova versão)
4. Cache do browser → hard reload (Ctrl+Shift+R) ou aba anônima após atualizar
5. Filtros devem excluir registros inativos explicitamente

## Fases

| Fase | Entregável                          | Status   |
|------|-------------------------------------|----------|
| 1    | Backend `Code.gs` (endpoints REST)  | Pendente |
| 2    | Frontend `tarefas.html` (Kanban)    | Pendente |
| 3    | Integração no Google Sites          | Pendente |
| 4    | Testes com usuários do domínio      | Pendente |

## Esquema da aba Tarefas (Google Sheets)

Colunas na ordem exata — **não alterar posição**, o `Code.gs` usa índices fixos:

| Col | Nome | Tipo | Observação |
|-----|------|------|------------|
| A | ID | Número | Sequencial, gerado pelo backend |
| B | Tarefa | Texto | Descrição do que precisa ser feito |
| C | Projeto | Texto | Campo livre — projetos ativos: Gestão de Demandas, Rede Higiene, Cuidado Transicional, Alto Custo |
| D | Responsável | E-mail | **Obrigatório ser e-mail @unimedcnu.coop.br** — usado por MailApp e CalendarApp |
| E | Prazo | Data | Base para trigger D-1 e evento Calendar |
| F | Status | Lista | `A fazer` / `Em andamento` / `Bloqueado` / `Concluído` |
| G | Prioridade | Lista | `Crítica` / `Alta` / `Média` / `Baixa` |
| H | Criado por | E-mail | Preenchido pelo backend via `Session.getActiveUser()` |
| I | Data criação | Data/Hora | Preenchido pelo backend |
| J | Observações | Texto | Contexto adicional |
| K | Ativo | Boolean | `TRUE` padrão; soft delete seta `FALSE` — **coluna não existia no AppSheet** |

## Migração do AppSheet

A planilha original (`CNU_TaskTracker_Template.xlsx`) tinha 5 tarefas de exemplo com a coluna `Responsável` preenchida com **nomes** (Aurélio, Michel, Tainara, Baião, Thiago). Ao migrar para o Google Sheets:

1. Adicionar coluna K (`Ativo`) com valor `TRUE` para todas as linhas existentes
2. Substituir os nomes na coluna D pelos e-mails `@unimedcnu.coop.br` correspondentes

## Setup inicial

1. Criar planilha "Tarefas CNU" no Google Drive com as abas **Tarefas** e **Log**
2. Criar os cabeçalhos da aba Tarefas exatamente como na tabela acima (A→K)
3. Criar cabeçalhos da aba Log: `ID | Data/Hora | Editor | Ação | Campo | Valor Anterior | Valor Novo`
4. Abrir Apps Script vinculado à planilha → colar `Code.gs`
5. Definir `SHEET_ID` em `Code.gs` (ou deixar vazio se o script for container-bound)
6. Implantar como Web App: **executar como usuário que acessa**, **acesso restrito ao domínio**
7. Copiar URL do Web App para `WEBAPP_URL` em `tarefas.html`
8. Criar trigger temporal para `lembretesDiarios()`: diário, 8h, fuso `America/Sao_Paulo`
9. `clasp push` para subir versões via linha de comando
