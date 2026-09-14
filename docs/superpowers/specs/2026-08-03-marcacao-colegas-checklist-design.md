# Marcação de colegas em itens de checklist — design

> Spec validado com o Aurélio em 03/08/2026. Reativa uma feature desligada em 15/07/2026
> (commit `0a08c3a`), corrigindo a causa da desativação.

## Por que foi desligada

A marcação existia e funcionava, mas o e-mail de notificação **renotificava todos os
marcados a cada salvamento** da checklist — `salvarChecklist` reescreve todos os itens, e a
notificação disparava para toda a lista, não só para quem acabara de ser marcado.

Isso hoje seria pior: desde 03/08/2026 o checklist salva **a cada clique de checkbox** em
modo visualização. Religar a flag `CHECKLIST_MARCACAO_ATIVA` sem mudar o gatilho faria cada
clique renotificar todos os marcados da tarefa.

## O que já existe (não precisa ser construído)

| Peça | Estado |
|---|---|
| Coluna `Responsavel` na aba `Checklist_Status` (índice 7) | existe e é gravada por `salvarChecklist` |
| Preservação da marcação no save | `div.dataset.responsavel` → `serializarCkl()` → backend |
| Visibilidade por marcação | `idsTarefasVisiveis()` já trata "marcado em item" como critério |
| E-mail de notificação | `notificarMarcadoChecklist()` existe, com HTML pronto |
| CSS do seletor | `.ckl-responsavel-sel` existe, órfão desde julho |

Falta apenas: a UI para **atribuir**, o disparo **manual** do e-mail e as validações no
backend.

## Decisões

| Questão | Decisão |
|---|---|
| Significado da marcação | **"Este item é dele"** — atribuição do item. A tarefa mantém seu responsável principal. |
| Quando notifica | **Só quando o usuário pedir.** Nenhum e-mail automático. |
| Granularidade do aviso | **Um botão por pessoa marcada**, abaixo do checklist. Um e-mail por pessoa, com todos os itens dela naquela tarefa. |
| Quem pode marcar | **Qualquer um do piloto**, coerente com a regra atual de edição. Log registra quem marcou. |
| Em que modo | **Visualização e edição.** Em visualização salva na hora, como o checkbox. |
| UI do seletor | **`<select>` nativo** no item. |

Sobre a UI: um item de checklist é uma linha estreita que já carrega checkbox, texto e `×`.
Um dropdown com busca (como o do campo Responsável) briga por espaço e transforma cada linha
num mini-formulário. Se a lista de 41 nomes incomodar na prática, migrar para o dropdown é
incremental.

## Comportamento

### No item

Ordem no DOM: `checkbox` · `texto` · `select` · `×`.

O `<select>` lista os colegas (`usuarios`, do bootstrap) com uma opção vazia para "sem
atribuição", e vem com o responsável atual selecionado. O chip somente-leitura
(`.ckl-responsavel-marcado`) é removido — o select já mostra o nome — e seu CSS sai com ele.

- **Visualização:** select ativo; mudar a escolha chama `salvarCklImediato()`, herdando o
  enfileiramento de gravações (`cklSalvando`/`cklPendente`) e a reversão em erro. O `×`
  continua desabilitado. A regra em `abrirModal` muda de `'select, button'` para `'button'`.
- **Edição:** entra na detecção de mudanças (`serializarCkl()` já inclui o responsável),
  habilita o Salvar e grava junto com o resto.

### Os avisos

Abaixo da barra de progresso, um botão por colega marcado, rotulado com o primeiro nome via
`nomeDeUsuario()` ("Avisar Jacqueline"), montado a partir das marcações atuais e
re-renderizado quando um select muda. Clicar chama `avisarMarcadoChecklist` e o botão vira
**"Aviso enviado ✓"** (forma neutra, sem flexão de gênero) até o modal fechar — estado só de
sessão, sem persistência.

Desmarcar alguém remove o botão dela na mesma re-renderização.

Em modo `create` os botões não aparecem: sem ID salvo não há tarefa para referenciar.

## Backend

### Rota nova: `avisarMarcadoChecklist({ idTarefa, email })`

Valida, em ordem, antes de enviar:

1. **Visibilidade** — `idsTarefasVisiveis()`, mesma regra de `salvarChecklist`.
2. **A pessoa está marcada** em algum item daquela tarefa. Sem esta checagem a rota seria um
   formulário aberto para disparar e-mail em nome do sistema; validar só o domínio não basta,
   porque qualquer `@unimedcnu` passaria.
3. **Domínio permitido** — reusa `DOMINIOS_PERMITIDOS`.

Depois: monta o e-mail com assunto `[Tarefas CNU] Itens de checklist atribuídos a você` e
corpo com nome da tarefa, os itens atribuídos àquela pessoa, quem atribuiu e link do app;
envia por `enviarEmail()` (que já usa o remetente `taskcenter@`) e grava no `Log` quem avisou
quem.

`notificarMarcadoChecklist()` é adaptada para receber a lista de itens, em vez de só o nome da
tarefa.

**Anti-repetição:** chave no `CacheService` por `idTarefa`+`email`, TTL 60 s. Clique dentro
da janela responde "aviso já enviado agora" sem reenviar. O botão desabilitado cobre o caso
normal; isto cobre duplo-clique e reabertura do modal.

### Remoções

- O bloco de notificação automática em `salvarChecklist`.
- A flag `CHECKLIST_MARCACAO_ATIVA`.

Não é só desligar: o código sai. Mantê-lo seria uma armadilha para quem religasse a flag sem
saber que hoje o save acontece a cada clique de checkbox.

### Correção de passagem

`salvarChecklist` não valida o campo `responsavel` dos itens — aceita qualquer string. Como
esse campo **concede visibilidade**, passa a exigir e-mail de domínio permitido, na linha do
que `validarTarefa` já faz para o responsável da tarefa.

## Efeito colateral que fica documentado

**Marcar alguém dá a essa pessoa acesso de leitura à tarefa inteira.** É como
`idsTarefasVisiveis()` funciona desde antes desta mudança, mas com a UI de volta isso passa a
acontecer com frequência. Quem marca precisa saber que está compartilhando a tarefa, não só
atribuindo um item.

## Verificação

No preview local com mock:

- select com os colegas e o responsável atual selecionado;
- marcar em visualização → exatamente uma chamada de gravação;
- marcar em edição → habilita Salvar, sem gravar na hora;
- botões de aviso aparecem/desaparecem conforme as marcações;
- sem botões de aviso em tarefa nova;
- `×` travado em visualização, select ativo;
- erro na gravação reverte a marcação.

`node --check` no `Code.gs`.

**Fora do alcance do mock:** as três validações da rota nova rodam no Apps Script. Vão por
revisão de leitura mais um teste real após o deploy — atribuir um item a mim mesmo, avisar e
conferir a chegada; depois tentar avisar um e-mail não marcado e confirmar a recusa. O
resultado é reportado antes de considerar pronto.

## Fora de escopo

- Notificação automática em qualquer forma (foi a causa da desativação).
- Persistir "já avisei" na planilha — o estado de sessão basta e evita coluna nova.
- Acompanhar conclusão por pessoa ("quem já fez o item dele") — a barra de progresso da
  tarefa continua sendo a única medida.
- Resolver a incoerência do botão *Editar* (backlog): esta feature funciona em visualização
  justamente para não depender dela.
