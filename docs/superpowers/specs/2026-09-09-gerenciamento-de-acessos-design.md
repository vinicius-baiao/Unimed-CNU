# Gerenciamento de acessos (super-admin) — design

> Data: 09/09/2026. Pedido do Aurélio: "uma tela de gerenciamento de acessos visível somente para mim, assim
> poderei definir os papéis de cada usuário com mais facilidade; siga tudo sozinho sem perguntas, ajustamos depois".
> Decisões abaixo tomadas sem consulta; qualquer uma pode ser revista após o primeiro uso.

## Objetivo

Uma aba **Acessos** no Cora, visível só para o **super-admin** (o Aurélio), onde se vê a aba Usuários inteira e se
edita o **perfil** de cada pessoa inline, além de incluir e remover usuários. Como a allowlist do piloto **é** a aba
Usuários, incluir = conceder acesso e remover = revogar acesso.

Arquivos: `Code.gs` (super-admin, 3 rotas de escrita), `tarefas-shadcn.html` (rail, view, chamadas), testes
`tests/test_acessos.js` (novo). Sem mudança de esquema: a aba Usuários continua `Nome, Email, Perfil, Unidade, Cargo`.

## 1. Super-admin

- `var SUPER_ADMINS = ['aurelio.pereira.ext@unimedcnu.coop.br'];` e `function ehSuperAdmin(email)` (comparação
  case-insensitive) no `Code.gs`, junto das funções de perfil. Não é um 4º perfil na planilha: é uma capacidade
  acima de Admin, restrita por código, para que ninguém a conceda pela própria tela.
- `bootstrap()` e `getUsuario` passam a devolver `superAdmin: ehSuperAdmin(email)` em `usuario`.
- Front: global `currentUserSuperAdmin` (setado em `aplicar()` da carga inicial).
- O super-admin precisa também estar na aba Usuários (como hoje) para passar pela allowlist.

## 2. Rotas (todas exigem `ehSuperAdmin`; senão `{ erro: 'Apenas o administrador do sistema.' }`)

Convenções comuns: `LockService.getScriptLock().waitLock(10000)`; e-mail normalizado com `trim().toLowerCase()`
para busca, mas gravado como veio (trim); ao final `invalidarAba(ABA_USUARIOS)`, `limparCachePerfis()`,
`limparCacheListas()`; Log via `gravarLog(acao, campo, anterior, novo)` com o e-mail em `campo`.

### 2.1 `atualizarUsuario(dados)` — `dados = { email, perfil?, nome?, unidade?, cargo? }`
- Localiza a linha pelo e-mail (case-insensitive). Não achou → `{ erro: 'Usuário não encontrado.' }`.
- `perfil`, se presente, deve ser um de `Admin | Gestor | Usuário Padrão`; senão `{ erro: 'Perfil inválido.' }`.
- Guarda: se `email` é o do próprio super-admin e `perfil` ≠ `Admin` → `{ erro: 'O administrador do sistema
  permanece Admin.' }`.
- Grava só as células enviadas e que mudaram (`setValue` por célula, colunas 1/3/4/5); uma linha de Log por
  célula alterada: `gravarLog('ACESSO', email, anterior, novo)` com prefixo do campo no `novo`
  (`'perfil: Gestor'`, `'unidade: X'`, …). Nada mudou → `{ sucesso: true, alterados: 0 }`.
- Retorno: `{ sucesso: true, alterados: n, usuario: {nome, email, perfil, unidade, cargo} }`.

### 2.2 `adicionarUsuario(dados)` — `dados = { nome, email, perfil, unidade?, cargo? }`
- Validações, nesta ordem: `nome` obrigatório (trim) → `{ erro: 'Nome é obrigatório.' }`; e-mail com domínio em
  `DOMINIOS_PERMITIDOS` (mesma checagem por sufixo de `validarTarefa`) → `{ erro: 'E-mail deve ser @unimedcnu.coop.br
  ou @unimednacional.coop.br' }`; perfil válido → `{ erro: 'Perfil inválido.' }`; e-mail já existente
  (case-insensitive) → `{ erro: 'Este e-mail já está cadastrado.' }`.
- `appendRow([nome, email, perfil, unidade || '', cargo || ''])`; `gravarLog('ACESSO', email, '', 'incluído: ' + perfil)`.
- Retorno: `{ sucesso: true, usuario: {...} }`.

### 2.3 `removerUsuario(dados)` — `dados = { email }`
- Guarda: e-mail do super-admin → `{ erro: 'O administrador do sistema não pode ser removido.' }`.
- Não achou → `{ erro: 'Usuário não encontrado.' }`.
- `sheet.deleteRow(linha)` (remoção real: revoga acesso na hora; a pessoa continua aparecendo em tarefas antigas
  como responsável pelo e-mail, e o front humaniza o nome via `nomeDeEmail`). `gravarLog('ACESSO', email,
  perfilAnterior, 'removido')`.
- Retorno: `{ sucesso: true }`.

## 3. Front — aba Acessos

### 3.1 Navegação
- Item na rail após Indicadores: `<a id="nav-acessos" onclick="setModo('acessos')" title="Acessos" style="display:none">`
  com ícone de cadeado/pessoas; `renderUserBadge()` mostra só se `currentUserSuperAdmin`.
- `setModo('acessos')`: guarda (`!currentUserSuperAdmin` → `home`), esconde `#homeView`/`#appLayout`/
  `#indicadoresView`, mostra `#acessosView`, marca `nav-acessos` `.on`, esconde `.view-toggle`, mostra `#btnInicio`,
  chama `renderAcessos()`.

### 3.2 View `#acessosView` (dentro de `.portal-main`, irmã das outras views)
- Cabeçalho: título "Acessos", subtítulo "Quem entra no Cora e com qual papel. A lista é a aba Usuários da planilha."
- Três cards (`.home-stat-card`): Admin · Gestor · Usuário Padrão, com contagens.
- Barra: busca (`#acBusca`, filtra nome/e-mail/unidade/cargo) e botão **"+ Incluir usuário"** (`.btn.btn-primary`) que
  abre o formulário inline (`#acNovo`, oculto por padrão): Nome, E-mail, Perfil (select), Unidade (input com
  `<datalist>` das unidades existentes), Cargo; botões **Salvar** e **Cancelar**. Erros do servidor viram toast
  vermelho; sucesso fecha o form, insere na lista local e mostra toast "Usuário incluído.".
- Tabela `.ind-tabela .ac-tabela` (reaproveita o estilo da tabela de Indicadores): Pessoa (avatar + nome, e-mail em
  `<small>`), Perfil (`<select class="ac-perfil">` com as 3 opções; muda → `atualizarUsuario` imediato; sucesso →
  toast "Perfil de <nome> alterado para <perfil>."; erro → volta o valor anterior + toast), Unidade (`<input>`
  editável; salva no `blur`/Enter quando mudou), Cargo (idem), Remover (`×`, `.ckl-delete`-like; abre
  `abrirConfirm(nome, onOk, { prefixo: 'Remover', okLabel: 'Remover', sub: 'A pessoa perde o acesso ao Cora
  imediatamente. As tarefas dela continuam existindo.' })`). Ordenação: perfil (Admin, Gestor, Padrão) e depois nome.
- Linha do próprio super-admin: select de perfil desabilitado (title "O administrador do sistema permanece
  Admin") e sem botão de remover.
- Após qualquer escrita bem-sucedida: atualiza o array global `usuarios` (mesma referência usada por Indicadores e
  pelos combos), re-renderiza a tabela e os cards. Não recarrega tudo.
- Vazio na busca: "Nenhum usuário encontrado."
- Impressão: `#acessosView` não imprime formulários (`#acNovo`, busca) — regra no `@media print`.

### 3.3 Segurança no front
Só cosmética: a autorização real é `ehSuperAdmin` em cada rota. Todo dado em `innerHTML` via `esc()`; valores de
inputs via `value`/`textContent`.

## 4. CSS
`.ac-barra` (flex, gap, space-between), `.ac-novo` (grid de 5 colunas + botões, fundo `var(--muted-bg)`, borda,
raio), `.ac-tabela select, .ac-tabela input` (compactos, 30px, borda `var(--input)`; `input` sem borda até hover/
focus para parecer texto), `.ac-remover` (botão `×` discreto, vermelho no hover), `.ac-perfil-admin { color: var(--primary) }`.

## 5. Testes — `tests/test_acessos.js` (harness)
1. `bootstrap()` como Aurélio → `usuario.superAdmin === true`; como outro Admin → `false`.
2. Cada rota chamada por Admin não-super → `{ erro: 'Apenas o administrador do sistema.' }` e nenhuma escrita.
3. `atualizarUsuario`: muda perfil de X para Gestor → `setValue` na coluna 3 da linha certa, Log `ACESSO` com o
   e-mail e `'perfil: Gestor'`, caches limpos (`ctx._cache` sem `perfis_v1`/`usuarios_v1`); perfil inválido → erro;
   tentar rebaixar o super-admin → erro; e-mail inexistente → erro; nada mudou → `alterados: 0` sem escrita.
4. `adicionarUsuario`: válido → `appendRow` com 5 colunas e Log; nome vazio, domínio errado, perfil inválido e
   duplicado (com maiúsculas diferentes) → erros específicos e nenhuma escrita.
5. `removerUsuario`: remove a linha certa (`deleteRow` com o índice 1-based) e loga; super-admin → erro;
   inexistente → erro.
6. Preview (mock com `superAdmin: true` e casos para as 3 rotas): rail só com super-admin, cards, busca, editar
   perfil/unidade/cargo, incluir, remover com confirmação, linha própria travada, console limpo.

## Fora de escopo
Convite por e-mail, histórico de acessos na tela, múltiplos super-admins pela UI, edição de e-mail (chave da
linha), remoção em massa, sincronização com o diretório do Google.

## Publicação
`npm test` → `clasp push` (7 arquivos) → `clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8`
→ hard reload → HANDOFF e `CLAUDE.md` (rotas novas e o conceito de super-admin).
