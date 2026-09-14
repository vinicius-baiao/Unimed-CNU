# Débito técnico e performance — sweep de 03/08/2026

> Varredura de `Code.gs` e `tarefas-shadcn.html` após a publicação do piloto. Priorização
> pelo framework `(Impacto + Risco) × (6 − Esforço)`, notas de 1 a 5.
> As fases 0 e 1 já foram implementadas no mesmo dia — ver "O que foi feito" no fim.

## Medição real — 03/08/2026, app publicado

Colhida no Chrome autenticado do Aurélio (extensão Claude para Chrome), chamando as rotas
direto na mesma origem do wrapper. Uma amostra, cache de perfis quente, rede corporativa.

**Peso da primeira tela**

| Métrica | Valor |
|---|---|
| HTML descomprimido (app + fontes base64 + wrapper) | **403 KB** |
| Transferido (gzip) | **181 KB** |
| Tempo de carga do iframe do app | **4.354 ms** |

Os 403 KB confirmam a decomposição estimada: ~122 KB do app, ~254 KB de fontes, ~27 KB de
wrapper. Depois do gzip, as fontes seguem dominando — o base64 de woff2 é praticamente
incompressível, então a maior parte dos 181 KB transferidos é fonte, não aplicação.

**Custo por rota**

| Rota | Isolada | Em paralelo (as 6 juntas) | Payload |
|---|---|---|---|
| `getUsuario` | 1.215 ms | 1.606 ms | 0,1 KB |
| `listarUsuarios` | 2.637 ms | 3.443 ms | 5,9 KB |
| `listarTarefas` | 1.886 ms | **4.353 ms** | 17 KB |
| `listarTemplates` | 1.934 ms | 1.778 ms | **0 KB** |
| `listarChecklist_Status` | 1.927 ms | 3.443 ms | 5,3 KB |
| `listarProjetos` | 2.024 ms | 3.244 ms | 0,3 KB |
| **Total** | soma 11.623 ms | **4.353 ms** (a mais lenta manda) | |

**O que os números dizem**

1. **O custo é overhead de execução, não volume de dados.** `getUsuario` devolve 0,1 KB e
   custa 1,2 s; `listarTarefas` devolve 17 KB e custa 1,9 s. O piso por execução do Apps
   Script é ~1,2-1,9 s. Transferir dados é barato; **abrir uma execução é caro**. Isso
   confirma P1 como o item de maior retorno: 6 execuções → 1 elimina 5 pisos.
2. **Há contenção real entre as execuções.** `listarTarefas` sozinha faz 1,9 s; disputando
   com as outras cinco, 4,35 s — mais que o dobro. As 6 chamadas concorrentes se atrapalham.
3. **A carga inicial é as 6 chamadas.** O iframe fecha em 4.354 ms e o paralelo em 4.353 ms:
   o tempo de abrir o app é, essencialmente, esperar as rotas.
4. **`listarTemplates` é 1,9 s para receber lista vazia** (item P0 abaixo).

**Ressalva:** medições isoladas rodaram com o cache de perfis (`CacheService`, TTL 5 min) já
quente. No primeiro acesso do dia, `mapaPerfis()` varre a aba `Usuários` e cada rota fica mais
lenta que o registrado aqui.

## Prioridades

> **Status 03/08/2026:** fases 0 e 1 implementadas (P0, P1, P4, P5, D6, D1) — ver
> "O que foi feito" no fim do documento. Medição pós-deploy pendente.

| # | Item | Tipo | I | R | E | Score |
|---|---|---|---|---|---|---|
| ~~P1~~ ✅ | Carga inicial faz 6 execuções separadas do Apps Script | Arquitetura | 5 | 4 | 2 | **36** |
| ~~P0~~ ✅ | `listarTemplates` custa 1,9 s na carga e o dado nunca é usado | Código morto | 4 | 1 | 1 | **25** |
| D2 | `tarefas.html` duplicado (97 KB) como rollback, já defasado | Código | 3 | 3 | 1 | **30** |
| ~~D6~~ ✅ | `TOKEN_GEMINI_FALLBACK` hardcoded — endpoint `doPost` removido de vez | Segurança | 1 | 5 | 1 | **30** |
| D3 | Índices de coluna fixos, inclusive um `[7]` literal | Arquitetura | 3 | 4 | 2 | **28** |
| P2 | 254 KB de fontes base64 inline em cada abertura | Performance | 4 | 2 | 2 | **24** |
| P3 | `salvarChecklist` reescreve a aba inteira a cada gravação | Performance | 4 | 4 | 3 | **24** |
| D4 | Nenhum teste automatizado | Teste | 4 | 4 | 3 | **24** |
| ~~P4~~ ✅ | Leituras redundantes de aba dentro da mesma requisição | Performance | 3 | 2 | 2 | **20** |
| ~~P5~~ ✅ | `gravarLogs` chama a API 2× por entrada, dentro do laço | Performance | 2 | 2 | 1 | **20** |
| ~~D1~~ ✅ | Mock com nomes/e-mails reais viaja no HTML de produção | Privacidade | 1 | 2 | 1 | **15** |
| P6 ↓ | `carregarTudo()` recarrega tudo depois de cada save | Performance | 3 | 2 | 3 | **15** |
| D5 | JSONP em vez de `google.script.run` | Arquitetura | 3 | 3 | 4 | **12** |
| P7 | `.ckl-bar-fill` anima `width` (layout thrash); migrar para `transform: scaleX()` | Performance | 2 | 1 | 2 | **12** |

## Detalhamento dos itens de topo

### P0 — `listarTemplates`: 1,9 s por um dado que ninguém lê (score 25)

`carregarTudo()` chama `listarTemplates` e guarda o resultado em `templates`
(`tarefas-shadcn.html:918, 1089, 1111-1119`). Essa variável **não é lida em nenhum outro
ponto do arquivo** — a UI de templates de checklist não existe no MVP. A aba `Checklists`
está vazia, então a rota devolve `{"templates":[]}`: 0 KB, em 1,9 s de execução.

É uma das 6 execuções concorrentes que degradam as outras, gasta quota compartilhada e não
entrega nada. Remover a chamada (e a variável) é o melhor retorno por esforço de todo o
sweep. Manter `listarTemplates` no backend é inofensivo — fica disponível para quando a
feature existir.

### P1 — Carga inicial: 6 execuções do Apps Script (score 36)

**Confirmado pela medição:** 4.353 ms de espera, com cada execução custando 1,2-1,9 s de
overhead fixo independente do volume de dados, e as chamadas concorrentes dobrando o tempo
individual da mais pesada.

`DOMContentLoaded` dispara `getUsuario` e `listarUsuarios`; `carregarTudo()` dispara
`listarTarefas`, `listarTemplates`, `listarChecklist_Status` e `listarProjetos`
(`tarefas-shadcn.html:993-1136`). São **6 execuções independentes** do Web App para pintar
a primeira tela. Cada uma paga sozinha o custo de abrir a planilha e reler abas, e — como o
app roda "executando como o deployer" — todas consomem a **mesma quota**, compartilhada
entre os usuários do piloto.

Pior: há releitura em cascata. `listarTarefas` lê `Tarefas` e, via `idsTarefasVisiveis`, lê
`Checklist_Status` inteira. `listarChecklist_Status` lê `Tarefas` de novo (para achar
órfãos) **e** chama `idsTarefasVisiveis`, que relê `Checklist_Status` e `Tarefas` outra vez.
Só nessas duas rotas, `Tarefas` é lida 3× e `Checklist_Status` 3× para dados que poderiam
ser lidos uma vez.

**Correção:** endpoint `bootstrap` único que lê cada aba uma vez e devolve tudo
(tarefas, checklists, projetos, usuários, perfil) num só JSON. 6 execuções → 1.
Já estava anotado no backlog do handoff; é o item de maior retorno do sweep.

**Ganho estimado com base na medição:** uma execução única pagando um piso de ~1,5 s mais as
leituras das abas deve fechar em ~2-2,5 s, contra 4,35 s hoje — algo entre 45% e 55% do tempo
de abertura. Somado a P0 (uma execução a menos concorrendo), a expectativa é abrir o app em
menos da metade do tempo atual.

### D2 — `tarefas.html` duplicado (score 30)

97 KB e 2.188 linhas mantidos como rollback do layout clássico, servindo apenas se alguém
trocar `HTML_FILE` no `Code.gs`. Já divergiu: o fix do checklist de hoje, o de prazo legado
e o botão Duplicar existem só no shadcn. Ou seja, o rollback **não é mais um rollback** —
voltar para ele reintroduz bugs corrigidos. Cada correção futura carrega a pergunta "replico
lá?".

**Correção:** decidir. Se o shadcn é definitivo, apagar (o git guarda o histórico) e tirar a
constante `HTML_FILE`. Se o rollback importa, marcar no topo do arquivo até que ponto ele
está defasado.

### D3 — Índices de coluna fixos (score 28)

`COL` e `COL_PROJ` mapeiam posição de coluna por número, e o `CLAUDE.md` avisa para nunca
reordenar as abas. O caso pior está em `idsTarefasVisiveis` (`Code.gs:367`), que lê
`rowsC[i][7]` — um literal, sem nem passar por um mapa nomeado. Se alguém inserir uma coluna
no meio de `Checklist_Status`, a visibilidade por perfil passa a comparar a coluna errada:
**falha silenciosa de permissão**, não erro visível.

**Correção:** ler a linha de header uma vez por requisição e montar `{nome → índice}`.
Mantém compatibilidade e transforma "reordenou e quebrou de um jeito estranho" em erro claro.

### P2 — 254 KB de fontes base64 inline (score 24)

`Estilos_Fontes.html` (256 KB) entra inline no HTML a cada abertura, via
`<?!= include('Estilos_Fontes') ?>`. São 6 `@font-face`: Inter 400/500/600/700 em woff2
(~128 KB de base64) e **Unimed Slab 400/700 em TTF (~126 KB de base64)**.

O detalhe que dói: `--serif` (Unimed Slab) é usado em **um único seletor** —
`.brand .wm b`, a marca d'água do cabeçalho (`tarefas-shadcn.html:114`). São ~126 KB de
base64, em formato não comprimido, para renderizar uma palavra. Além disso o CSS pede
`font-weight: 600`, que não existe entre os pesos embutidos (400 e 700) — o browser
sintetiza.

Como é base64 dentro do HTML, o browser **não cacheia a fonte separadamente**: o payload
volta a cada carregamento.

**Correção (sem editar o arquivo à mão — ele é gerado):** regerar `Estilos_Fontes.html` com
Unimed Slab em woff2 e subsetada nos glifos da marca (~5-10 KB em vez de 126 KB) e cortar o
peso que não é usado. Ganho estimado: ~120 KB por abertura. Manter o base64 do Inter é
defensável (portabilidade no embed do Sites), mas os pesos 500/600 merecem uma conferida de
uso real.

### P3 — `salvarChecklist` reescreve a aba inteira (score 24)

`salvarChecklist` faz `clearContents()` e regrava **todas as linhas de todas as tarefas**
(`Code.gs:707-720`), com lock de script em volta. O custo cresce com o total de itens da
base, não com o tamanho da checklist editada.

Isto ficou mais sensível com a mudança de hoje: agora **cada clique em checkbox** no modo
visualização dispara uma gravação. Com o piloto de 5 pessoas e poucas dezenas de itens não
aparece; com centenas de itens e uso simultâneo, cada clique serializa no lock e o tempo
sobe para todos.

**Correção:** gravar só a faixa da tarefa em questão — localizar as linhas daquele
`ID_Tarefa` e atualizar in-place, apendando o excedente. Mantém o lock, mas o trabalho passa
a ser proporcional à checklist editada. Mitigação imediata, se quiser algo de baixo risco
antes: dar um debounce de ~1s no front, agrupando cliques rápidos numa gravação só.

### D4 — Nenhum teste automatizado (score 24)

Toda verificação é manual no browser. Funcionou até aqui porque o app é pequeno e o mock
permite reproduzir cenários, mas já houve regressão em produção (o save travado por prazo
legado). Há funções puras fáceis de cobrir sem framework: `parseData`, `isoDate`,
`prazoClass`, `serializarCkl`, `validarTarefa`, `parsePrazoLocal`, `acessoPermitido`.

**Correção:** um arquivo `testes.html` que carrega as funções e imprime verde/vermelho, mais
um punhado de casos por função. Sem npm, sem build — coerente com o projeto.

### P7 — `.ckl-bar-fill` anima `width` (score 12)

A barra de progresso do checklist (`atualizarProgressoCkl()`, no modal, e a barra inline
equivalente gerada nos cards) anima a propriedade `width` a cada mudança de progresso. Isso
força o browser a recalcular layout a cada frame (layout thrash) em vez de só recompor.

**Correção:** migrar para `transform: scaleX()` com `transform-origin: left`, que anima só em
composição. Mexe em três lugares: o CSS da `.ckl-bar-fill`, `atualizarProgressoCkl()` (que hoje
escreve `fill.style.width`) e a barra inline gerada nos cards. Este é o item que a exceção
`layout-transition` em `.impeccable/config.json` (linha sobre `.ckl-bar-fill`, `tarefas-shadcn.html:309`)
cobre — a regra do hook de design está suprimida neste arquivo justamente para não reabrir esta
divida a cada varredura.

## Instrumentação antes da fase 1

Para trocar estimativa por número. **Só leitura** — nenhuma rota de escrita é chamada.
Rodar no console do app publicado, após hard reload (Ctrl+Shift+R).

Não é possível rodar isto por ferramenta: o Web App exige sessão Google autenticada, e o
browser interno do Claude Code cai na tela de login (verificado em 03/08/2026). As opções são
colar no console ou instalar a extensão Claude para Chrome, que dá acesso ao Chrome já logado.

```js
(async function(){
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const rotas = ['getUsuario','listarUsuarios','listarTarefas','listarTemplates','listarChecklist_Status','listarProjetos'];
  const t = a => new Promise(r => { const s=Date.now(); chamarAPI({acao:a}, d => r({rota:a, ms:Date.now()-s, erro:(d&&d.erro)||''})); });
  const t0 = Date.now();
  const paralelo = await Promise.all(rotas.map(t));
  const totalParalelo = Date.now() - t0;
  const isolado = [];
  for (const r of rotas) isolado.push(await t(r));
  const recursos = performance.getEntriesByType('resource')
    .filter(e => e.name.indexOf('acao=') > -1)
    .map(e => ({ rota:(e.name.match(/acao=([^&]+)/)||[])[1], ms:Math.round(e.duration), bytes:e.transferSize||0 }));
  const out = {
    htmlInicial: { descomprimidoKB: Math.round((nav.decodedBodySize||0)/1024), transferidoKB: Math.round((nav.transferSize||0)/1024), ms: Math.round(nav.duration||0) },
    seisEmParalelo: { totalMs: totalParalelo, porRota: paralelo },
    isolado, recursos
  };
  console.log(JSON.stringify(out, null, 2));
  return out;
})()
```

Como ler o resultado:

- `htmlInicial.descomprimidoKB` — o peso do HTML com as fontes base64 dentro. Quantifica P2:
  se vier perto de 380 KB, os ~254 KB de fonte são a maior parte da primeira tela.
  `transferidoKB` mostra quanto o gzip recupera (pouco, no caso do woff2 já comprimido).
- `seisEmParalelo.totalMs` — o custo real da carga inicial hoje, com as 6 rotas concorrendo
  pela mesma quota. É o número que P1 promete derrubar.
- `isolado` — custo de cada rota sozinha. Se a soma for muito menor que o paralelo, há
  contenção de quota; se for parecida, o gargalo é a leitura das abas.
- `recursos[].bytes` — payload de cada rota; indica se algum JSON está grande demais para
  caber num GET quando a base crescer (relevante para D5).

## Plano em fases

**Fase 0 — 5 minutos, sem risco** (P0)
Remover a chamada `listarTemplates` e a variável `templates` do front. Uma execução a menos
na carga, sem mudança de comportamento.

**Fase 1 — backend, baixo risco, um único deploy** (P1, P4, P5 + higiene D6/D1)
Endpoint `bootstrap`, memoização das leituras por requisição, `gravarLogs` em bloco, token
fora do código e remoção do mock do arquivo servido. O front passa a fazer 1 chamada na
carga; o resto é invisível para o usuário. Medir de novo depois, com o mesmo snippet, para
confirmar o ganho em vez de presumir.

**Fase 2 — escrita, exige teste cuidadoso** (P3, D3)
Gravação incremental do checklist e mapa de colunas por header. Mexe em permissão e em
gravação, então entra depois da fase 1 estar estável e com o piloto ativo para retestar.

**Fase 3 — manutenção** (D2, D4, P2)
Decidir o destino do `tarefas.html`, criar o harness de testes, regerar as fontes.

**Fase 4 — só quando o piloto virar produção** (D5, P6)
JSONP → `google.script.run` e fim do `carregarTudo()` pós-save. São mudanças grandes, de
benefício estrutural, sem urgência enquanto o piloto tem 5 usuários.

## O que foi feito — 03/08/2026 (fases 0 e 1)

**Front (`tarefas-shadcn.html`)**

- `carregarTudo()` faz **uma** chamada (`bootstrap`) em vez de quatro, e traz também perfil e
  usuários — as chamadas avulsas de `getUsuario` e `listarUsuarios` saíram do
  `DOMContentLoaded`. Total na abertura: 6 → 1.
- `listarTemplates` e a variável `templates` removidas (P0).
- Efeito colateral bem-vindo: `renderUserBadge()` e `aplicarFiltroInicial()` rodam já com o
  perfil em mãos, então a saudação, o nome e o filtro inicial aparecem no primeiro render.
  Antes a tela pintava com e-mails crus e sem filtro, e se corrigia quando as chamadas
  avulsas voltavam.
- `carregarTudo()` é o recarregador pós-save, então **todo save também caiu de 4 chamadas
  para 1** — P6 melhorou de graça (o que resta dele é evitar o recarregamento por completo).
- Mock local: dados agora fictícios (`@exemplo.test`) e com suporte a `bootstrap` (D1).

**Backend (`Code.gs`)**

- `bootstrap()` novo, com rota no `doGet`.
- `lerAba()` / `invalidarAba()`: cache de leitura **por execução**. `Tarefas` e
  `Checklist_Status` eram lidas 3× cada numa carga; agora 1× (P4). Rotas de escrita
  invalidam o cache depois de gravar.
- `mapaPerfis()` memoizado por execução, por cima do `CacheService` (P4).
- `gravarLogs()`: `getLastRow()` uma vez, fora do laço — um save de 5 campos fazia 10
  chamadas de API, agora faz 6 (P5). **Mantido `appendRow`** de propósito: trocar por um
  `setValues` em bloco seria mais rápido e reintroduziria a perda de linhas sob concorrência
  que o comentário no código registra.
- `TOKEN_GEMINI_FALLBACK` removido (D6). **Encerrado em definitivo no mesmo dia:** a
  integração do Gem foi descontinuada por decisão do Aurélio, e o `doPost`, o
  `tokenGemini()` e o `jsonResponse()` saíram do `Code.gs` — sem endpoint, não há token a
  proteger nem superfície de ataque a manter.

**Deliberadamente não alterado**

- A leitura dentro do lock em `salvarChecklist` continua indo direto à planilha, com
  comentário explicando: usar o cache ali abriria uma janela para sobrescrever o que outra
  execução gravou entre a leitura e o lock.
- As leituras diretas nas funções de trigger (`relatorioDiario`, `lembretesDiarios`,
  `arquivarTarefasAntigas`) — rodam isoladas, sem concorrer com requisições de usuário.

**Verificação (preview local com mock)**

Carga faz exatamente `["bootstrap"]`; 9 tarefas, 5 usuários, 7 projetos e 2 checklists
populados; badge com nome e perfil no primeiro render; filtro inicial aplicado uma única vez
(5 de 9 tarefas) e "limpar filtros" devolvendo as 9; Kanban, Lista, progresso de checklist na
Lista, modal em edição e o fix de hoje (checkbox marcável em visualização, salvando na hora)
todos funcionando; save disparando `atualizarTarefa` + `salvarChecklist` + **um** `bootstrap`;
console sem erros. Sintaxe do `Code.gs` validada com `node --check`.

## Medição pós-deploy — e a premissa que estava errada

Medido no app publicado, mesma sessão e mesmo dia da linha de base. Dados de produção:
38 tarefas, 34 itens de checklist, 41 usuários, 4 projetos. `bootstrap` devolve 28,7 KB.

| Modelo | Amostras (ms) |
|---|---|
| Antigo (6 rotas em paralelo) | 2.812 · 3.084 · 3.197 |
| Novo (`bootstrap`, 1 rota) | 4.718 · 3.220 · 4.363 |
| `bootstrap` repetido, isolado | 8.167 (primeira pós-deploy) · 2.518 · 3.828 · 3.034 · 3.107 |

**O bootstrap não ficou mais rápido. Na mediana, ficou pior.**

A premissa da análise original estava errada. Eu tratei "6 execuções" como "6 pisos de
overhead somados", mas o Apps Script atende as requisições **em paralelo de verdade** — o
tempo de parede do modelo antigo era ≈ o da rota mais lenta (~3 s), com os outros cinco
pisos pagos simultaneamente. O `bootstrap` paga o piso uma vez só, mas **serializa** as
quatro leituras de aba dentro de uma execução. Resultado: latência equivalente ou pior.

O que a mudança de fato entregou:

- **Tempo de servidor consumido**: a soma das 6 rotas era ~11,6 s de execução por carga;
  agora é ~3,5 s. A quota do Apps Script é por tempo total de execução e é **compartilhada**
  entre os usuários do piloto, então isso é ganho real — só não é ganho de latência.
- **Contenção com uso simultâneo**: 5 pessoas abrindo o app disparavam ~30 execuções
  concorrentes; agora disparam 5.
- **Primeiro render completo**: nome, perfil e filtro inicial chegam com os dados, sem a
  tela pintar com e-mail cru e se corrigir depois.
- **Consistência**: todos os dados vêm da mesma leitura, não de 6 fotos em momentos
  diferentes.

**Ressalvas honestas sobre esta medição:** variância enorme (2,5 s a 8,2 s para a mesma
chamada), amostra pequena, e as próprias medições saturaram o script — as rodadas mais
longas passaram a enfileirar, o que contamina comparações. Uma resposta de `bootstrap` veio
com 3,1 KB em vez de 28,7 KB numa das tentativas e **não se reproduziu em 5 repetições**;
provavelmente resposta de erro transitória sob saturação. O front trata isso (`d.erro` e
`onerror` do JSONP), mas fica registrado.

## Terceira medição — com usuários e projetos em cache

Cache de `listarUsuarios`/`listarProjetos` publicado. Medido com uma chamada em voo por vez
(ver "armadilha de medição" abaixo).

| Modelo | Execuções | Amostras (ms) | Mediana |
|---|---|---|---|
| `bootstrap` com cache | 1 | 2.296 · 4.634 · 3.002 · 3.757 | ~3.400 |
| Paralelo enxuto (5 rotas, com cache) | 5 | 2.388 · 2.209 | ~2.300 |
| Paralelo original (6 rotas, sem cache) | 6 | 2.812 · 3.084 · 3.197 | ~3.100 |

Detalhe das 5 rotas em paralelo, na melhor amostra: `getUsuario` 1.079, `listarProjetos`
1.289 (cache), `listarUsuarios` 1.371 (cache), `listarTarefas` 2.147,
`listarChecklist_Status` 2.208 — total 2.209 ms, ou seja, o tempo da mais lenta.

**O cache ajudou** (bootstrap de ~4,4 s para ~3,4 s; rotas de lista para ~1,3 s, que é
essencialmente só o piso de execução). **Mas o paralelo continua ~1 s à frente**, e o sinal se
repetiu em duas sessões de medição independentes. Em latência, o paralelismo que o Apps Script
dá de graça vence a consolidação numa execução.

O balanço real, com números:

| Critério | `bootstrap` (1 exec.) | Paralelo enxuto (5 exec.) |
|---|---|---|
| Espera do usuário | ~3,4 s | **~2,3 s** |
| Tempo de servidor por carga | **~3,4 s** | ~8,5 s |
| Execuções simultâneas por usuário | **1** | 5 |
| Primeiro render completo | **sim** | não (nomes chegam depois) |

Sobre a quota: ~8,5 s por carga, com 5 pessoas e ~20 cargas/dia cada, dá ~14 min/dia contra
um limite de 90 min. **A quota não é gargalo no piloto** — o que muda a conclusão: neste
tamanho, latência pesa mais que economia de execução.

**Recomendação:** duas rotas em paralelo — `bootstrap` (perfil + tarefas) e uma segunda com
checklist + usuários + projetos. Pelas medições das partes, cada uma fica em ~2,3-2,4 s e as
duas em paralelo fecham em ~2,4 s, com 2 execuções em vez de 5 e mantendo o render único
(o front espera as duas antes de pintar). Junta a latência do paralelo com a economia do
consolidado.

## Placar final das topologias — 03/08/2026

Todas medidas no mesmo dia, no app publicado, com uma medição em voo por vez. As três últimas
já contam com o cache de usuários/projetos e sem a chamada morta de templates.

| Topologia | Execuções | Espera do usuário | Tempo de servidor |
|---|---|---|---|
| 6 rotas paralelas (ponto de partida) | 6 | ~4.350 ms | ~11,6 s |
| 1 rota consolidada | 1 | ~3.400 ms | ~3,4 s |
| 2 rotas, divisão desbalanceada | 2 | ~3.600 ms | ~5,5 s |
| **2 rotas equilibradas (no ar)** | **2** | **~2.850 ms** | **~4,6 s** |
| 5 rotas paralelas | 5 | ~2.300 ms | ~8,5 s |

**Resultado do dia: 4.350 ms → 2.850 ms na abertura do app (-35%), com o tempo de servidor
por carga caindo de ~11,6 s para ~4,6 s (-60%).**

**O ótimo de latência medido não é o que está no ar.** As 5 rotas paralelas são ~0,5 s mais
rápidas, porque o Apps Script paraleliza tão bem que espalhar as leituras em execuções
distintas ganha de agrupá-las — as duas leituras pesadas (`Tarefas` e `Checklist_Status`)
rodam simultaneamente em vez de somar. O preço é 1,8× mais tempo de servidor e 5 execuções
concorrentes por usuário em vez de 2.

Ficou com as 2 rotas por julgamento de valor, não por medição: 0,5 s está dentro da variância
observada na própria rota crítica (2.415-3.088 ms), enquanto metade do consumo de servidor é
diferença estrutural que só melhora quando o piloto crescer. **Se alguém reclamar da abertura,
trocar para 5 rotas é a alavanca conhecida** — e está medida.

**Parar aqui é deliberado.** O retorno marginal caiu para ~0,5 s por rodada de
publicação manual, e cada rodada depende de o Aurélio publicar a Nova versão. Os itens que
sobraram no backlog (P2 fontes, P3 gravação incremental do checklist, D3 mapa de colunas)
valem mais que os próximos milissegundos de topologia.

## Lição que atravessou as três medições

A intuição de "menos chamadas = mais rápido" está errada num backend que já paraleliza. O
overhead por execução (~1,2-1,9 s aqui) é pago **em paralelo** quando as chamadas são
simultâneas, então o tempo de parede é o da rota mais lenta, não a soma. Consolidar troca
paralelismo por serialização: economiza quota, não tempo. Duas previsões minhas erraram por
ignorar isso, e a terceira só acertou depois de medir as partes.

Corolário prático: ao dividir rotas, contar as leituras **de dentro das funções**, não pelo
nome delas. `listarChecklist_Status()` lê `Tarefas` sem anunciar no nome, e foi isso que
desbalanceou a primeira divisão.

## Armadilha de medição (registrar para não repetir)

1. **Rajadas saturam o script.** Sequências longas de chamadas levaram a `Failed to fetch` e
   a uma resposta truncada (3,1 KB em vez de 28,7 KB). Medir com uma chamada em voo por vez.
2. **Chamada pendurada envenena as seguintes.** Com um `fetch` zumbi de `bootstrap` em voo, a
   chamada seguinte levou **24,6 s**; com o estado limpo, a mesma chamada levou 2,8 s. Se um
   número vier absurdo, recarregar a página e repetir antes de acreditar nele.
3. **Primeira execução após publicar é sempre pior** (recompilação + caches frios). Descartar.
