# Planos de ação dos painéis dentro do Cora — design

> Spec validado com o Aurélio em 08/09/2026. Os planos de ação dos painéis **Raio X Spravato**,
> **Raio X da Carteira PF** e **GT Terapias Oncológicas** deixam de ter storage próprio e passam
> a ser tarefas do Cora. Os painéis continuam mostrando o plano, lido do Cora, somente leitura.
> Junto, entra o cadastro da equipe de Atenção à Saúde (39 pessoas da planilha mais a Fabiane) como usuários do Cora.

## Situação atual

Três painéis, três modelos para a mesma coisa:

| Painel | Repositório local | Modelo hoje | Storage |
|---|---|---|---|
| Spravato (v4.73) | `UNIMED - Raio X Spravata/appscript` (git) | 8 ações fixas em `PLANO_ACAO_ITENS` + ações custom; status e prazo editáveis; histórico | abas `PLANO_ACAO` e `HISTORICO` na planilha `ID_REGISTROS` (`1nZGEIK0T4lJBc9HrSEg3x8YIXkKlwlRjOUo11meoqA4`) |
| Carteira PF (v8.46) | `UNIMED - Análise de Requisitos/cora-carteira-pf` (sem git) | mesmo código, portado; 12 ações fixas em `PA_ITENS` + custom | planilha criada sob demanda, ID em Script Properties `PA_SHEET_ID` |
| GT Onco (v1.38) | `UNIMED - Painel GT/cora-painel-gt` (sem git) | 20 macroações e 35 desdobramentos **estáticos no HTML**, responsável e período em texto | nenhum; atualizado a mão a cada versão |

Os quatro apps (três painéis e o Cora) rodam como `USER_DEPLOYING` com `access: DOMAIN`.
A identidade do usuário é a mesma em todos.

O Cora hoje tem 5 usuários no piloto, em allowlist fixa no código (`EMAILS_PILOTO`), e a aba
`Usuários` com o perfil de cada um.

## Decisões

| Questão | Decisão |
|---|---|
| Onde o plano vive | **No Cora.** Ação = tarefa; desdobramento = item de checklist. |
| O que o painel mostra | **Seção embutida, somente leitura, lida do Cora** via JSONP. Botões "Abrir no Cora" e "Editar no Cora". |
| Quem vê | **Projeto marcado como público** é visível a todo o domínio, no painel e dentro do Cora. Demais projetos seguem a regra atual. |
| Migração | **Script de importação único**, com modo de simulação, idempotente. |
| Canceladas do GT (9, 18, 19) | **Não entram.** Motivo vai na descrição do projeto GT Onco. |
| Responsáveis | **GT pelos nomes** (Guilherme Amorim, Fabiane, Taiara). Spravato e PF entram sem responsável. |
| Board do Usuário Padrão | Pré-filtro "minhas tarefas" ao abrir passa a valer para **todos os perfis**. |
| Transporte painel → Cora | **JSONP no navegador**, mesmo padrão de `chamarAPI()`. Descartado ler a planilha do Cora direto dos painéis: replicaria regras em três repositórios. |
| Novos usuários | Os **40 da planilha `Equipe Atenção a saúde.xlsx`** entram na aba `Usuários`. Gestores: Fabiane Minozzo, Guilherme Borges, Glaucia Ruggeri, Taiara Rodrigues e Carina Guardia. Os demais, Usuário Padrão. |
| Allowlist do piloto | **Deixa de ser lista no código e passa a ser a aba `Usuários`.** Quem tem perfil entra. Manter 45 e-mails duplicados em dois lugares seria erro esperando para acontecer. |

## 1. Cora — modelo de dados

### Aba `Projetos`

Ganha a coluna **F `Publico`** (boolean, padrão `FALSE`). `COL_PROJ.PUBLICO = 5`.

- `getOrCreateProjetosSheet()` cria o cabeçalho com a coluna nova. Para a aba já existente, uma
  função de manutenção `migrarProjetosPublico()` (execução manual, uma vez) escreve o cabeçalho
  em F1 e `FALSE` nas linhas existentes.
- `listarProjetosDaPlanilha()` devolve `publico: true|false` em cada projeto. Chega ao front por
  `bootstrapApoio` sem mudança de rota.
- `criarProjeto` e `atualizarProjeto` aceitam `dados.publico` (só Admin/Gestor, regra que já
  existe). O log registra `Publico` como campo alterado.

### Aba `Tarefas`

Sem mudança de esquema. Convenções para tarefas importadas:

- `Tarefa`: título da ação, sem emoji (os títulos do PF começam com 💰 ⚖️ 🧭; o emoji sai).
- `Projeto`: nome exato do projeto criado.
- `Prioridade`: `Média`.
- `Observações`: descrição original da ação, quebra de linha, notas livres do GT quando houver
  (bullets não numerados), e na última linha a marca de origem **`Origem: <painel>#<id>`**, por
  exemplo `Origem: spravato#protocolo`, `Origem: pf#custo-onco`, `Origem: gt#11`.
  A marca é o que torna a importação idempotente e permite ao painel reconhecer itens especiais.
- `Criado por`: quem executa a importação.

### Aba `Checklist_Status`

Desdobramentos numerados do GT (`1.1`, `11.4`…) viram itens, um por linha, na ordem do painel:
`ID` sequencial, `ID_Tarefa`, `ID_Template` vazio, `Item` com o texto sem o ✓, `Ordem`,
`Concluído` = `TRUE` quando o texto original tem ✓ ou a palavra "concluído", `Data conclusão`
vazia, `Responsavel` vazio.

### Três projetos novos

| Nome | Cor | Descrição |
|---|---|---|
| `Spravato` | `#004e4c` | Plano de ação do Raio X Spravato (saúde mental). Frentes definidas com o Dr. Guilherme em 20/08/2026. |
| `Carteira PF` | `#c9a84c` | Plano de ação do Raio X da Carteira Pessoa Física. Alavancas que saem do raio X. |
| `GT Onco` | `#7c3aed` | Plano de ação do GT Terapias Oncológicas e Imunobiológicas, planejamento 2026. Macroações canceladas no ciclo e não importadas: 9 (busca ativa de excepcionalidades), 18 (compra abaixo da tabela, absorvida pela 6.3) e 19 (painel de custo por praça, duplicidade com 4 e 6). |

Todos com `Publico = TRUE`. Os painéis referenciam o projeto **pelo ID numérico**, nunca pelo nome.

## 2. Cora — visibilidade e acesso

### Tarefas de projeto público

`idsTarefasVisiveis(email, rowsTarefas)` ganha um critério: tarefa cujo `Projeto` está no
conjunto de nomes de projetos ativos com `Publico = TRUE` é visível. O conjunto vem de
`lerAba(ABA_PROJETOS)`, que já usa o cache por execução. Admin e Gestor continuam sem restrição.

Efeitos colaterais que ficam documentados:

- `salvarChecklist`, `adicionarInteracao` e `atualizarTarefa` usam essa mesma função, então
  Usuário Padrão passa a poder **editar** tarefas de projeto público, coerente com a regra atual
  de "edita o que enxerga". Prazo e conclusão continuam restritos ao criador.
- Front: `aplicarFiltroInicial()` deixa de sair cedo quando `!currentUserPodeExcluir`. O
  pré-filtro por responsável passa a valer para todos. O comportamento "sem tarefas próprias,
  não filtra" permanece.

### Allowlist pela aba `Usuários`

`acessoPermitido(email)` passa a devolver `getPerfil(email) !== ''`. A constante
`EMAILS_PILOTO` sai. `PILOTO_ATIVO` continua existindo com o mesmo significado: `false` abre
para o domínio inteiro. O `mapaPerfis()` já é cacheado 5 min, então o custo é zero; a tela
"Acesso restrito" e a mensagem da API não mudam. Quem for removido da aba perde o acesso no
próximo TTL ou após `limparCachePerfis()`.

### Modal de projetos

Checkbox **"Visível a todo o domínio"** no formulário de criação, abaixo da cor. Na lista de
projetos, os públicos mostram um chip `público`. Sem edição inline de projeto existente: a
mudança do flag em projeto já criado é feita na planilha ou por `atualizarProjeto` via console,
como já acontece com nome e cor hoje.

## 3. Cora — rota de leitura `planoAcaoProjeto`

```
GET WEBAPP_URL?acao=planoAcaoProjeto&dados={"projetoId":12}&callback=_cb_x
```

**Autorização.** No `doGet`, esta ação é tratada **antes** do bloco `acessoPermitido`: exige
`emailReq` não vazio (conta identificada) e nada mais. A allowlist não se aplica. O
`access: DOMAIN` do Web App já garante que só conta do domínio chega até aqui.

**Validação.** `projetoId` inteiro positivo. Projeto precisa existir, estar ativo e ser público.
Caso contrário `{ erro: 'Projeto não disponível.' }`, mensagem única de propósito para não
revelar se o projeto existe.

**Resposta.**

```json
{
  "projeto": { "id": 12, "nome": "GT Onco", "cor": "#7c3aed", "descricao": "..." },
  "urlCora": "https://script.google.com/a/macros/unimedcnu.coop.br/s/.../exec",
  "geradoEm": "2026-09-08T14:03:00-03:00",
  "tarefas": [
    {
      "id": 41, "tarefa": "Protocolos assistenciais em Oncologia",
      "status": "Em andamento", "prioridade": "Média",
      "prazo": "2026-12-31", "responsavel": "guilherme.amorim.ext@unimedcnu.coop.br",
      "observacoes": "...\nOrigem: gt#5",
      "ultimaAtualizacao": "2026-09-02T10:15:00-03:00",
      "checklist": { "total": 2, "feitos": 1,
        "itens": [ { "item": "5.1 Protocolo de tumores sólidos", "feito": true, "responsavel": "" }, ... ] }
    }
  ]
}
```

- Só tarefas com `Ativo` verdadeiro e `Projeto` igual ao nome do projeto.
- `prazo` no formato `yyyy-MM-dd` via `Utilities.formatDate` no fuso do script, ou `""`.
- `ultimaAtualizacao`: maior `Data/Hora` da aba `Interações` para aquela tarefa, ou `""`.
  Uma leitura da aba por chamada, não uma por tarefa.
- Sem ordenação no servidor. O painel ordena.
- **Cache** de 60 s por projeto no `CacheService` (chave `planoAcao_<id>`). Invalidado em
  `criarTarefa`, `atualizarTarefa`, `excluirTarefa` e `salvarChecklist` quando a tarefa pertence
  a projeto público, e em `atualizarProjeto`/`arquivarProjeto`. Se a invalidação falhar, o
  pior caso é o painel atrasar 60 s.

## 4. Cora — link profundo

O Web App aceita `projeto=<id>` e `tarefa=<id>` na URL de abertura (sem `acao`).

- `doGet` sanitiza os dois para `/^\d{1,9}$/` e injeta no template como atributo:
  `<body data-deep-link="<?= deepLink ?>">`, onde `deepLink` é JSON escapado. Atributo em vez de
  variável JS para o preview local (`file://`, sem template) continuar funcionando: ali o
  atributo fica com o texto cru do scriptlet e o `JSON.parse` cai no `catch`.
- Front: após `carregarTudo()` popular `tarefas` e `projetos`, `aplicarDeepLink()` roda uma vez.
  Com `projeto`, resolve o nome pelo ID e chama `setFiltroProjeto(nome)`, mudando para a visão
  Tarefas. Com `tarefa`, localiza a tarefa e chama `abrirModal(tarefa, 'view')`. Se o ID não
  existir ou não for visível, ignora em silêncio.
- O link profundo substitui `aplicarFiltroInicial()` quando presente: não faz sentido filtrar
  pelo responsável e pelo projeto ao mesmo tempo.
- Quem não está na aba `Usuários` vê a tela "Acesso restrito" que já existe. Esperado: os botões
  "Abrir/Editar no Cora" são para quem edita.

## 5. Importação dos planos — `ImportacaoPlanos.gs`

Arquivo novo no repositório do Cora, subido pelo `clasp push` junto com o resto. Nada nele é
roteado pelo `doGet`. Execução manual no editor do Apps Script pelo Aurélio.

### Funções

- `importarPlanosDeAcao(apenasSimular)`: com `true`, apenas registra no `Logger` o que criaria
  (projetos, tarefas, itens, contagens por origem) e não escreve nada. Com `false`, grava.
- Config no topo do arquivo: `IMPORT_SPRAVATO_SHEET_ID` (já conhecido, acima),
  `IMPORT_PF_SHEET_ID` (opcional) e `IMPORT_EMAILS_GT`:

  | Nome no painel | E-mail | Fonte |
  |---|---|---|
  | Dr. Guilherme Amorim | `guilherme.amorim.ext@unimedcnu.coop.br` | planilha da equipe |
  | Taiara Rodrigues | `taiara.rodrigues@unimedcnu.coop.br` | planilha da equipe |
  | Fabiane Minozzo | `fabiane.minozzo@unimedcnu.coop.br` | informado pelo Aurélio em 08/09 |

- **Planilha do PF.** O ID vive só nas Propriedades do script do PF, não está em disco. Como
  a planilha foi criada pelo script do PF rodando como o Aurélio, ela está no Drive dele com o
  nome `Raio X PF — Plano de Ação (armazenamento)`. A importação a localiza por
  `DriveApp.getFilesByName()` com esse nome exato; se `IMPORT_PF_SHEET_ID` estiver preenchido,
  ele tem prioridade. Zero arquivos ou mais de um: erro claro no `Logger`, sem gravar nada.
  Usar `DriveApp` acrescenta o escopo de Drive ao Cora, o que pede **reautorização** na próxima
  Nova versão. Aceito, porque tira uma etapa manual do caminho.

### Idempotência

Antes de criar, lê `Tarefas` inteira e monta o conjunto das marcas `Origem: …` presentes em
`Observações`, ativas ou não. Tarefa cuja marca já existe é pulada e contada como "já
importada". Projeto é localizado pelo nome; se existir, reaproveita e apenas garante
`Publico = TRUE`. Rodar duas vezes não duplica nada.

### Gravação

Direta na planilha, dentro de `LockService`, **sem** `notificarResponsavel` e **sem**
`criarEventoCalendar`. IDs via `proximoId()` e o equivalente para checklist. Uma linha de `Log`
por tarefa com ação `IMPORTAR`, campo `Origem`, valor novo a marca. `invalidarAba` e
`limparCacheListas` ao final.

### Fonte Spravato

As 8 ações fixas de `PLANO_ACAO_ITENS` (Codigo.gs do Spravato, linhas 1665–1692) copiadas como
constante, mescladas com a aba `PLANO_ACAO` do mesmo jeito que `montarPlanoAcao_` faz: status e
prazo salvos sobrepõem o padrão; linhas com `ID` não fixo e `Título` preenchido são ações custom
e viram tarefa também, com marca `spravato#<id da linha>`.

### Fonte PF

Idem com as 12 ações de `PA_ITENS` (Codigo.gs do PF, linhas 34–57) e a aba `PLANO_ACAO` da
planilha `IMPORT_PF_SHEET_ID`. Marca `pf#<id>`.

### Conversão Spravato e PF

| Origem | Cora |
|---|---|
| `em andamento` | `Em andamento` |
| `concluída` | `Concluído` |
| `backlog` | `Backlog` |
| prazo `aaaa-mm-dd` | prazo, via `parsePrazoLocal` |
| prazo vazio | sem prazo |
| título com emoji inicial | emoji removido |
| descrição | primeira linha de `Observações` |

Sem responsável, sem checklist.

### Fonte GT

Lista estática no próprio arquivo, transcrita de `cora-painel-gt/Painel.html` (seção
`#plano`, `<details class="macro">`). Só as 17 macroações não canceladas. Regras:

- Desdobramentos numerados (`n.m …`) → itens de checklist, feito conforme ✓ ou "concluído".
- Bullets não numerados (Evidência, Pendências, listas de patologias, texto livre) → notas em
  `Observações`, uma por linha, após a descrição. Tabelas e amostras (ação 4 e 20) não entram.
- Um responsável por tarefa. Quando o painel lista dois (ação 7), fica o primeiro e o segundo vai
  para as notas.
- Prazo: data explícita da conclusão quando concluída; senão fim do período do responsável;
  senão a data explícita no texto; senão vazio.

Tabela fechada, para não sobrar interpretação na implementação:

| # | Título (sem o número) | Status | Prazo | Responsável | Itens |
|---|---|---|---|---|---|
| 1 | Comitê de eficiência para terapias de alto custo | Concluído | 2026-08-06 | Guilherme Amorim | 6, todos feitos |
| 7 | Dashboard de pacientes de alto custo | Concluído | 2026-08-06 | Guilherme Amorim (Fabiane nas notas) | 3, todos feitos |
| 16 | Direcionar beneficiários de alto custo aos Recursos Próprios | Concluído | 2026-08-06 | Fabiane | 3, todos feitos |
| 17 | Divulgação da infusão nos Recursos Próprios | Concluído | 2026-07-07 | — | 0 |
| 2 | Aplicação assistida de MIB — MVP com Ymunity | Em andamento | 2026-09-30 | Taiara | 1 |
| 3 | Arquitetura sistêmica — medicamentos fracionados por princípio ativo | Em andamento | 2026-06-30 | Taiara | 3 (3.1, 3.2, 3.4), nenhum feito |
| 4 | Renegociar tabela por princípio ativo — curva A (SP e DF) | Em andamento | 2026-12-30 | Taiara | 1 |
| 5 | Protocolos assistenciais em Oncologia | Em andamento | 2026-12-31 | Guilherme Amorim | 2 (5.1 feito) |
| 6 | Ampliar princípio ativo e biossimilares | Em andamento | — | Taiara | 3 (6.3 feito) |
| 11 | Política de cuidados de suporte precoce (cuidado transicional) | Em andamento | 2026-12-31 | Guilherme Amorim | 5 (11.2 feito) |
| 12 | Padronizar os contratos de oncologia | Em andamento | — | — | 0 |
| 13 | Protocolos em Reumatologia (imunobiológicos) | Em andamento | 2026-10-30 | Guilherme Amorim | 1 |
| 14 | Rever o contrato da Oncoclínicas | Em andamento | — | — | 0 |
| 15 | Assistência farmacêutica ampliada e política de delivery | Em andamento | 2026-12-31 | Taiara | 2, todos feitos |
| 20 | Modelos preditivos para terapias de alto custo | Em andamento | 2026-09-30 | — | 0 |
| 21 | Prevenção e detecção precoce de neoplasias | Em andamento | — | Fabiane | 2 |
| 8 | Contador de ciclo de tratamento | A fazer | 2026-12-31 | Taiara | 1 |
| 10 | Aprimorar regulação — reduzir variabilidade com protocolos | A fazer | — | Guilherme Amorim | 1 |

A ação 3 fica **atrasada** de propósito: é o que o painel diz hoje (período mar–jun/26, em
andamento). O Cora vai mostrá-la em vermelho, e isso é informação, não erro.

Marca `gt#<número>`. Total esperado: 17 tarefas e 34 itens de checklist.

## 6. Importação dos usuários — `ImportacaoUsuarios.gs`

Arquivo novo, mesma natureza do anterior: execução manual, sem rota.

### Fonte

`Equipe Atenção a saúde.xlsx`, na raiz do projeto, aba `Planilha2`, 39 pessoas (40 linhas com cabeçalho) com
`Funcionários | Equipe | E-mail | Cargo | Obs`. Os dados entram no `.gs` como constante
`EQUIPE_ATENCAO_SAUDE`, transcrita da planilha na implementação. O `.xlsx` **entra no
`.gitignore`**: tem nome, e-mail e cargo de 40 pessoas, e o repositório vai para a organização.

### Conversão para a aba `Usuários` (`Nome | Email | Perfil | Unidade | Cargo`)

| Coluna | Regra |
|---|---|
| Nome | como na planilha, sem espaços duplicados |
| Email | minúsculas, sem espaços |
| Perfil | `Gestor` para os cinco abaixo; `Usuário Padrão` para os demais |
| Unidade | `Núcleo de Oncologia e Alto Custo` ou `Linhas de Cuidado`, conforme a coluna Equipe |
| Cargo | como na planilha, em Title Case (`Enfermeiro de Núcleo do Cuidado`) |

Gestores:

| Nome | E-mail | Situação |
|---|---|---|
| Glaucia Berreta Ruggeri | `glaucia.ruggeri@unimedcnu.coop.br` | já é Gestor; só atualiza Unidade e Cargo |
| Guilherme Borges G Da Silva | `guilherme.silva@unimedcnu.coop.br` | virou CLT e coordenador; a conta `.ext` foi abandonada. Vira Gestor com o e-mail novo. Ver remapeamento abaixo. |
| Taiara Rodrigues | `taiara.rodrigues@unimedcnu.coop.br` | novo |
| Carina Milanez Guardia | `carina.guardia@unimedcnu.coop.br` | novo |
| Fabiane Minozzo | `fabiane.minozzo@unimedcnu.coop.br` | novo; não está na planilha. Entra na constante com Cargo `Gerente` e Unidade vazia (responde pelas duas equipes). |

Aurélio continua Admin. Jacqueline e Thiago continuam como estão.

### Troca de e-mail do Guilherme Borges

A conta `guilherme.silva.ext@` aparece hoje na aba `Usuários`, em `Responsável` e `Criado por`
de tarefas dele e em `Responsavel` de itens de checklist. Se só o cadastro mudar, ele entra com a
conta nova e não vê nada do que era dele. Função `remapearEmailUsuario(de, para, apenasSimular)`,
execução manual, uma vez: troca o e-mail na aba `Usuários` e em todas as ocorrências nas abas
`Tarefas` e `Checklist_Status`, comparando em minúsculas, e grava uma linha de `Log` por célula
alterada com ação `REMAPEAR_EMAIL`. A aba `Log` e a `Interações` **não** são reescritas: são
histórico e devem continuar dizendo quem fez o quê com a conta da época. Ao final,
`limparCachePerfis()` e `limparCacheListas()`. Roda **antes** de `importarUsuariosEquipe`, para
esta encontrar a linha já com o e-mail novo e só atualizar o perfil.

### Função

`importarUsuariosEquipe(apenasSimular)`: lê a aba, indexa por e-mail em minúsculas, e para cada
linha da constante (os 39 da planilha mais a Fabiane): se não existe, adiciona; se existe,
atualiza Perfil (só se o novo for Gestor), Unidade e Cargo quando não vazios, sem rebaixar
ninguém. Registra no `Logger` adicionados, atualizados e ignorados. Ao final,
`limparCachePerfis()` e `limparCacheListas()`. `adicionarUsuariosPiloto()` sai, substituída por
esta.

Domínio: `cristiane.oltemann@unimednacional.coop.br` é o único fora de `@unimedcnu`; está em
`DOMINIOS_PERMITIDOS`, entra normalmente.

## 7. Painéis

### Bloco comum `PlanoAcaoCora`

Um trecho de HTML + JS copiado nos três `Painel.html` (padrão do Design System: includes por
cópia, sem dependência entre repositórios). Em cada painel só mudam duas constantes:

```js
var CORA_URL        = 'https://script.google.com/a/macros/unimedcnu.coop.br/s/AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8/exec';
var CORA_PROJETO_ID = 12;   // preenchido depois da importação
```

Comportamento:

- Ao inicializar a seção (`INIT.acoes` / `INIT.plano`), mostra "Carregando plano de ação…" e
  dispara JSONP para `CORA_URL?acao=planoAcaoProjeto&dados=…&callback=…`, com timeout de 15 s.
- **Ordenação**: Em andamento, Bloqueado, A fazer, Backlog, Concluído; dentro do grupo, por prazo
  crescente e sem prazo por último.
- **KPIs** no topo (os quatro do GT, recomputados; nos outros dois painéis passam a existir
  também): total de ações, % concluídas, em andamento, a iniciar (A fazer + Backlog).
- **Card por tarefa**: título; badge de status com as classes que cada painel já tem
  (`ok` / `wa` / `nd` no Spravato e PF; `ok` / `doing` / `wait` no GT); prazo em `dd/mm/aaaa`
  com destaque quando vencido e não concluído; responsável como nome antes do `@`, ou
  "a definir"; barra de progresso e `<details>` com os itens quando há checklist; "atualizado em"
  quando há `ultimaAtualizacao`; link **"Editar no Cora"** para `CORA_URL?tarefa=<id>`,
  `target="_blank"`.
- Botão **"Abrir no Cora"** no cabeçalho da seção, para `CORA_URL?projeto=<id>`.
- Nota de rodapé: "Plano gerido no Cora. Alterações feitas lá aparecem aqui em até um minuto."
- **Erro ou timeout**: banner "O plano de ação não pôde ser carregado" com o link "Abrir no
  Cora". No preview local (sem `google.script.run`, detectado por `temBackend()` onde existe),
  renderiza uma amostra estática de 3 cards com aviso visível, como os painéis já fazem.
- Spravato: a tarefa cuja `observacoes` contém `Origem: spravato#protocolo` ganha o link
  "Acessar o protocolo →" que existe hoje.

### Remoções

- **Spravato** `Codigo.gs`: `PLANO_ACAO_*`, `ensurePlanoAcao_`, `lerPlanoAcao_`,
  `montarPlanoAcao_`, `salvarAcaoJSON`, `criarAcaoJSON`, `editarAcaoJSON`, `excluirAcaoJSON`,
  a chave `planoAcao` em `getDados()` e a checagem de plano em `VERIFICAR_INSTALACAO`.
  `Painel.html`: todo o bloco `PA_*` (linhas 2756–3045) e o CSS de edição que ficar órfão.
- **PF** `Codigo.gs`: o bloco inteiro do plano (linhas 18–230), deixando só `doGet` e `include`.
  `Painel.html`: bloco `PA_*` e o `INIT.acoes` atual.
- **GT** `Painel.html`: os 20 `<details class="macro">`, os 4 KPIs escritos à mão, o parágrafo
  `.insight` com números manuais e o `.cap` "status atualizado pelo GT em 17/08". O `.note` sobre
  o Plano de Ação Emergencial **fica**: não é ação, é proposta pendente de diretoria.
- As planilhas antigas (`PLANO_ACAO`/`HISTORICO` do Spravato e a do PF) **não são apagadas**.
  Ficam como backup. Nada mais escreve nelas.

### Versões e changelog

Cada painel sobe uma versão pela sua convenção (`VERSAO` + `CHANGELOG.md` no Spravato e PF;
`versoes/painel_gt_vX.html` e o build no GT). Só o Spravato tem git; PF e GT são pastas sem
repositório, então a mudança fica registrada no changelog e na cópia versionada.

## Verificação

**Cora, no preview local com mock:**

1. Mock ganha um projeto público e tarefas nele; Usuário Padrão simulado (`currentUserPodeExcluir = false`) vê essas tarefas e abre pré-filtrado nas próprias.
2. Checkbox "Visível a todo o domínio" envia `publico` no `criarProjeto`; chip aparece na lista.
3. `data-deep-link` cru no preview não quebra o carregamento (console limpo).

**Cora, publicado:**

4. `planoAcaoProjeto` com projeto público, chamado por conta **que não está na aba Usuários**, devolve as tarefas.
5. `planoAcaoProjeto` com projeto não público devolve `Projeto não disponível.`; com ID inexistente, idem.
6. `?projeto=<id>` abre a visão Tarefas filtrada; `?tarefa=<id>` abre o modal; ID inválido não faz nada.
7. Usuário Padrão real enxerga as tarefas do GT Onco no board e consegue marcar checklist.
8. Conta fora da aba `Usuários` recebe "Acesso restrito" ao abrir o app; os 5 do piloto continuam entrando.

**Importação de usuários:**

9. `remapearEmailUsuario('guilherme.silva.ext@…', 'guilherme.silva@…', true)` lista as células que mudariam em `Usuários`, `Tarefas` e `Checklist_Status`; após `false`, o Guilherme abre o Cora com a conta nova e vê as tarefas que eram dele.
10. `importarUsuariosEquipe(true)` reporta 38 a adicionar e 2 a atualizar (Glaucia e Guilherme Borges já existem).
11. Após `false`, Taiara abre o Cora como Gestor e vê todas as tarefas; Carina e Fabiane idem.

**Importação de planos:**

12. `importarPlanosDeAcao(true)` localiza a planilha do PF pelo nome (exatamente um arquivo) e lista: Spravato 8 + N custom, PF 12 + M custom, GT 17 tarefas e 34 itens. Conferir N e M contra as abas de origem.
13. `importarPlanosDeAcao(false)` grava; rodar de novo com `true` reporta tudo como "já importada" e zero criações.
14. Nenhum e-mail chegou a Guilherme Amorim, Fabiane ou Taiara; nenhum evento novo no Calendar.

**Painéis, publicados:**

15. Seção carrega do Cora com contagens iguais às do passo 12; "Editar no Cora" abre a tarefa certa; "Abrir no Cora" abre o projeto filtrado.
16. Mudar um status no Cora reflete no painel em até 60 s.
17. Preview local de cada painel mostra a amostra com aviso, sem erro no console.

## Sequência de entrega

1. Cora: seções 1 a 6. `clasp push` (meu) e **Nova versão** (Aurélio), reautorizando o escopo de Drive. `migrarProjetosPublico()` uma vez.
2. `remapearEmailUsuario` do Guilherme Borges, em simulação e depois real.
3. `importarUsuariosEquipe` em simulação, depois real. Com a allowlist agora vindo da aba, isto libera o acesso dos 40.
4. `importarPlanosDeAcao` em simulação, conferência, importação real. Anotar os três IDs de projeto.
5. Painéis: preencher `CORA_PROJETO_ID`, aplicar seção 7, push e Nova versão em cada um.
6. Atualizar `docs/HANDOFF.md`, `README.md` e `CLAUDE.md` do Cora (rota nova, coluna nova, arquivos novos, allowlist pela aba).

## Pendências do Aurélio

Nenhuma. Resolvidas em 08/09/2026: e-mail da Fabiane (`fabiane.minozzo@`, cargo Gerente),
conta do Guilherme Borges (`guilherme.silva@`, CLT), planilha do PF (localizada pelo nome, sem
precisar do ID), nomes dos três projetos confirmados, e ciência de que os 40 usuários passam a
entrar no Cora assim que a importação rodar. Os três projetos entram na aba `Projetos` como
qualquer outro, só com `Publico = TRUE`.

## Fora de escopo

- Edição do plano dentro dos painéis. Editar é no Cora.
- Status "Cancelado" no Cora.
- Registros clínicos por beneficiário do Spravato (drawer, "Plano de ação" por caso). São outra coisa e continuam onde estão.
- Propagação de renome de projeto para as tarefas já gravadas com o nome antigo. Comportamento atual do Cora, não muda aqui.
- Migração de JSONP para `google.script.run` no Cora.
- E-mail de boas-vindas aos 40 novos usuários. Comunicação fica com o Aurélio.
