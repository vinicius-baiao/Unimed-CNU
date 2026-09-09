# Cora. — Gestão de Tarefas

> Portal de gestão de tarefas (Kanban + Lista) da **Rede Ambulatorial · Unimed CNU**,
> construído sobre Google Apps Script + Google Sheets, no padrão institucional
> **Design System Unimed CNU** (assinatura `Cora.`, casca Shell com rail escura).

## O que é

Gestor de tarefas colaborativo para as equipes da Rede Ambulatorial, embutível no
portal interno (Google Sites) e acessível por qualquer pessoa do domínio autorizada:

- **Home** com saudação, indicadores (Pendentes / Em andamento / Bloqueado / Atrasadas),
  "Minhas Tarefas", atrasadas e próximas do vencimento;
- **Kanban** (Backlog → A fazer → Em andamento → Bloqueado → Concluído) com
  arrastar-e-soltar, ordenação por prioridade/prazo e cartões com checklist;
- **Lista** ordenável com os mesmos filtros;
- **Filtros** por projeto e responsável (sidebar), busca por tarefa/projeto/responsável/observações;
- **Checklists** por tarefa com barra de progresso;
- **Atribuição de itens**: cada item de checklist pode ser atribuído a um colega
  (`<select>` no item, ativo também em modo visualização). Atribuir **dá a essa pessoa
  acesso de leitura à tarefa**, porque a regra de visibilidade considera quem está marcado.
  O aviso por e-mail é **manual**, pelo botão "Avisar `<Nome>`" abaixo da checklist — nunca
  automático, para não renotificar a cada salvamento;
- **Notificações por e-mail** (atribuição, reatribuição, lembrete D-1) enviadas como
  `taskcenter@unimedcnu.coop.br`;
- **Eventos no Google Calendar** no prazo da tarefa;
- **Auditoria** completa na aba `Log`.

## Arquitetura

```
Google Sheets "Tarefas CNU"  ←→  Apps Script Web App (Code.gs)  ←→  tarefas-shadcn.html
        (persistência)                (API JSONP + HTML)               (frontend vanilla)
                                          ↓ triggers
                        lembretesDiarios (D-1) · arquivarTarefasAntigas (mensal)
                        relatorioDiario (desativado por flag no MVP)
```

- **Backend** — `Code.gs`: roteador `doGet(e)` despacha por `e.parameter.acao`
  (JSONP) e serve o frontend via `createTemplateFromFile().evaluate()`.
- **Transporte** — JSONP (script tag dinâmica): POST cross-origin não funciona em
  Web App embutido. O frontend monta as chamadas em `chamarAPI()`.
- **Persistência** — abas do Sheets: `Tarefas`, `Log`, `Checklists`,
  `Checklist_Status`, `Interações`, `Usuários`, `Projetos`, `Arquivo`.
  ⚠️ `Code.gs` usa índices de coluna fixos (objeto `COL`) — **não reordenar colunas**.
- **Concorrência** — `LockService` nas gravações críticas (criação, checklist),
  escrita célula-a-célula em updates (edições simultâneas não se sobrescrevem),
  logs via `appendRow` atômico, cache de perfis (`CacheService`, 5 min).

## Stack

- Google Apps Script (V8, estilo ES5) — sem framework, sem build
- HTML + CSS + JS vanilla em arquivo único (`tarefas-shadcn.html`)
- Design System Unimed CNU (tokens shadcn em CSS puro; Inter embutida em base64)
- `clasp` para deploy via CLI

## Estrutura

| Arquivo | Papel |
|---|---|
| `Code.gs` | Backend: roteador, CRUD, permissões, visibilidade, checklists, interações, e-mails, triggers |
| `tarefas-shadcn.html` | Frontend completo (Shell/rail `Cora.`, Home, Kanban, Lista, modais) |
| `tarefas.html` | Layout clássico anterior (rollback; trocar `HTML_FILE` no `Code.gs`) |
| `Estilos_Fontes.html` | Inter + Unimed Slab embutidas (base64) — do starter kit do DS; não editar à mão |
| `appsscript.json` | Manifesto (`executeAs: USER_DEPLOYING`, `access: DOMAIN`) |
| `docs/` | Contexto do projeto e design system legado |

## Perfis e permissões

Perfis vêm da aba `Usuários` (`Admin` / `Gestor` / `Usuário Padrão`).

| Ação | Usuário Padrão | Admin / Gestor |
|---|---|---|
| Ver tarefas | As suas (responsável, criador ou marcado em checklist) **e as de projetos públicos** — aplicado no servidor | Todas |
| Criar / editar / concluir | ✔ (no que enxerga) | ✔ |
| Alterar **prazo** | Só se for o criador | ✔ |
| Excluir tarefa | Só se for o criador | ✔ |
| Gerenciar projetos | ✖ | ✔ |

O board abre pré-filtrado nas próprias tarefas, para todos os perfis ("Limpar filtros" desfaz).

## Planos de ação dos painéis (desde 08/09/2026)

Os painéis **Raio X Spravato**, **Raio X da Carteira PF** e **GT Terapias Oncológicas** não
têm mais storage próprio de plano de ação: cada ação é uma tarefa do Cora nos projetos
**Spravato**, **Carteira PF** e **GT Onco**, marcados como **públicos** (coluna `Publico` da
aba `Projetos`, checkbox "Visível a todo o domínio" no modal). Desdobramentos são itens de
checklist. Cada tarefa importada traz `Origem: <painel>#<id>` na última linha de Observações.

- **Rota `planoAcaoProjeto`** (`dados={"projetoId":N}` ou `{"projetoNome":"..."}`): devolve
  projeto, tarefas ativas com checklist e última interação. Exige conta do domínio, **não** a
  allowlist. Recusa projeto inexistente, arquivado ou não público com a mesma mensagem.
  Cache de 60 s por projeto, invalidado pelas escritas.
- **Link profundo**: `…/exec?projeto=<id>` abre Tarefas filtradas no projeto;
  `…/exec?tarefa=<id>` abre o modal da tarefa. É o destino dos botões "Abrir/Editar no Cora"
  dos painéis.
- **Importações manuais** (editor do Apps Script, nesta ordem, cada uma primeiro com `true`):
  `migrarProjetosPublico()`, `remapearEmailUsuario(de, para, simular)`,
  `importarUsuariosEquipe(simular)`, `importarPlanosDeAcao(simular)`. Ver
  `ImportacaoUsuarios.gs` e `ImportacaoPlanos.gs`.
- Bloco de leitura copiado nos três painéis: `integracoes/PlanoAcaoCora.html`.

## Configuração (1ª instalação)

1. **Planilha**: crie o Google Sheets e ajuste `SHEET_ID` no `Code.gs`.
2. **Abas**: execute `setup()` uma vez (cria abas, cabeçalhos e validações).
3. **Dados iniciais**: `popularUsuarios()` e `popularProjetos()` (editar listas antes).
4. **Remetente das notificações**: configure `taskcenter@unimedcnu.coop.br` como
   *"Enviar e-mail como"* (Send As) na conta que executa o script e rode
   `verificarAliases()` para conferir (`true` = ativo; sem isso o envio cai no
   remetente padrão, mantendo o nome "Tarefas CNU").
5. **Triggers** (Apps Script → Gatilhos):
   - `lembretesDiarios` — diário (lembrete D-1 ao responsável);
   - `arquivarTarefasAntigas` — mensal (move concluídas há 30+ dias para `Arquivo`);
   - `relatorioDiario` — opcional; controlado pelo flag `RESUMO_DIario_ATIVO`.
6. **Acesso restrito (beta)**: `PILOTO_ATIVO = true` limita o acesso a quem está na aba
   `Usuários` (qualquer perfil). Desative quando abrir para o domínio inteiro.

## Desenvolvimento e deploy

```bash
# preview local da UI (dados mockados quando hostname = localhost)
npx serve -p 3000 .

# testes dos .gs (Node, sem dependências; carrega Code.gs num vm com stubs do Apps Script)
npm test

# subir código para o Apps Script
# .clasp.json não vem no clone (gitignore) — recriar: {"scriptId":"<id>","rootDir":"."}
npx clasp push

# publicar: nova versão NA IMPLANTAÇÃO EXISTENTE (a URL /exec é preservada)
npx clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8 -d "descrição"
```

**Regra de ouro do deploy:** NUNCA criar uma nova implantação (`clasp deploy` sem `-i`, ou
"Nova implantação" na UI). Sempre nova versão da existente. Depois, hard reload
(Ctrl+Shift+R) para furar o cache. `.claspignore` mantém `tests/`, `docs/` e `integracoes/`
fora do script.

O preview local usa um **mock de dados** (ativo apenas em `localhost`) — a UI
renderiza populada sem backend; em produção o mock é inerte.

## Design System

Segue o **Design System Unimed CNU** (starter-kit de 17/07/2026):

- Tokens canônicos (creme `#F8F7F4`, ink `#16302E`, primário `#004E4C`,
  dourado `#C9A84C`, semânticos ok/warn/late) — consumidos via `var(--…)`;
- Casca **Shell**: rail escura 64→236px com símbolo oficial (pinheiro),
  assinatura **`Cora.`** (Unimed Slab itálico + ponto dourado) e subtítulo
  "Gestão de Tarefas"; rodapé com avatar de iniciais;
- Tipografia **Inter** (UI) e **Unimed Slab** (exclusiva da assinatura),
  embutidas em `Estilos_Fontes.html`;
- Divergência registrada: nav estática (Início/Tarefas) em vez do registro
  `MODULOS`/`PERFIS` do Shell — app de view única; migrar se ganhar módulos.

## Segurança

- Autorização **no servidor**: visibilidade por perfil aplicada em
  `listarTarefas`, `listarChecklist_Status`, `listarInteracoes`,
  `atualizarTarefa`, `salvarChecklist` e `adicionarInteracao`;
- Validações de entrada (domínios de e-mail por sufixo, cores hex, limites de
  tamanho e de lote), HTML escapado em telas e e-mails;
- Allowlist de beta no `doGet`; carteirinhas nunca trafegam neste app;
- Limitação conhecida (fase 2): transporte JSONP via GET — migração planejada
  para `google.script.run`.

---

Unimed CNU · Rede Ambulatorial — uso interno.
