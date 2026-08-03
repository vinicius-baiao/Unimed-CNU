# Débito técnico e performance — sweep de 03/08/2026

> Varredura de `Code.gs` (1.347 linhas) e `tarefas-shadcn.html` (2.412 linhas) após a
> publicação do piloto. Priorização pelo framework `(Impacto + Risco) × (6 − Esforço)`,
> notas de 1 a 5. Nada aqui foi implementado — é o mapa para decidir o que atacar.

## Método e limites

Medido de fato: contagem de execuções na carga inicial, número de leituras de aba por
requisição, tamanho dos payloads de fonte, pontos de reescrita de aba inteira, chamadas de
API dentro de laços.

**Não medido:** latência real do backend em produção — não tenho como executar o Web App
autenticado. Os ganhos abaixo são estimativas fundamentadas na contagem de chamadas, não
em cronometragem. Antes de investir na fase 1, vale colher o número real (ver
"Instrumentação" no fim).

## Prioridades

| # | Item | Tipo | I | R | E | Score |
|---|---|---|---|---|---|---|
| P1 | Carga inicial faz 6 execuções separadas do Apps Script | Arquitetura | 5 | 4 | 2 | **36** |
| D2 | `tarefas.html` duplicado (97 KB) como rollback, já defasado | Código | 3 | 3 | 1 | **30** |
| D6 | `TOKEN_GEMINI_FALLBACK` hardcoded (`Code.gs:1291`) | Segurança | 1 | 5 | 1 | **30** |
| D3 | Índices de coluna fixos, inclusive um `[7]` literal | Arquitetura | 3 | 4 | 2 | **28** |
| P2 | 254 KB de fontes base64 inline em cada abertura | Performance | 4 | 2 | 2 | **24** |
| P3 | `salvarChecklist` reescreve a aba inteira a cada gravação | Performance | 4 | 4 | 3 | **24** |
| D4 | Nenhum teste automatizado | Teste | 4 | 4 | 3 | **24** |
| P4 | Leituras redundantes de aba dentro da mesma requisição | Performance | 3 | 2 | 2 | **20** |
| P5 | `gravarLogs` chama a API 2× por entrada, dentro do laço | Performance | 2 | 2 | 1 | **20** |
| D1 | Mock com nomes/e-mails reais viaja no HTML de produção | Privacidade | 1 | 2 | 1 | **15** |
| P6 | `carregarTudo()` recarrega tudo depois de cada save | Performance | 3 | 2 | 3 | **15** |
| D5 | JSONP em vez de `google.script.run` | Arquitetura | 3 | 3 | 4 | **12** |

## Detalhamento dos itens de topo

### P1 — Carga inicial: 6 execuções do Apps Script (score 36)

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
(tarefas, checklists, templates, projetos, usuários, perfil) num só JSON. 6 execuções → 1.
Já estava anotado no backlog do handoff; é o item de maior retorno do sweep.

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

## Instrumentação sugerida antes da fase 1

Para trocar estimativa por número, rodar no console do app publicado (hard reload antes):

```js
(function(){ var t0=Date.now(), n=0;
  var orig=chamarAPI;
  window.chamarAPI=function(p,cb){ var s=Date.now(), a=p.acao; n++;
    orig(p,function(d){ console.log(a, (Date.now()-s)+'ms'); cb(d); }); };
  setTimeout(function(){ console.log('total', n, 'chamadas em', (Date.now()-t0)+'ms'); }, 15000);
  carregarTudo();
})()
```

Isso dá o custo por rota e o total da carga — a base para dizer se P1 vale antes de P2.

## Plano em fases

**Fase 1 — backend, baixo risco, um único deploy** (P1, P4, P5 + higiene D6/D1)
Endpoint `bootstrap`, memoização das leituras por requisição, `gravarLogs` em bloco, token
fora do código e remoção do mock do arquivo servido. O front passa a fazer 1 chamada na
carga; o resto é invisível para o usuário.

**Fase 2 — escrita, exige teste cuidadoso** (P3, D3)
Gravação incremental do checklist e mapa de colunas por header. Mexe em permissão e em
gravação, então entra depois da fase 1 estar estável e com o piloto ativo para retestar.

**Fase 3 — manutenção** (D2, D4, P2)
Decidir o destino do `tarefas.html`, criar o harness de testes, regerar as fontes.

**Fase 4 — só quando o piloto virar produção** (D5, P6)
JSONP → `google.script.run` e fim do `carregarTudo()` pós-save. São mudanças grandes, de
benefício estrutural, sem urgência enquanto o piloto tem 5 usuários.
