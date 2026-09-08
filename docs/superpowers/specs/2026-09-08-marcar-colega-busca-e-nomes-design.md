# Marcar colega no checklist com busca de nomes + nomes normalizados — design

> Data: 08/09/2026. Aprovado pelo Aurélio em conversa (opção "chip por item + busca compartilhada").
> Contexto: com a Etapa 3 do roteiro dos planos de ação, a aba Usuários passou de 41 para 79 pessoas.
> O `<select>` de colega em cada item de checklist ficou inviável e, onde o front não acha o nome,
> mostra a parte local do e-mail crua (`fabiane.minozzo`).

## Objetivo

1. Marcar um colega num item de checklist por **busca de nome**, com o mesmo componente que o campo
   Responsável da tarefa já usa.
2. Nunca mostrar e-mail cru como nome: fallback humanizado em todo o front.

Só `tarefas-shadcn.html` muda. Backend, planilha e rotas ficam iguais.

## 1. Chip por item + popover de busca compartilhado

### Chip (substitui `.ckl-responsavel-sel`)

- Um `<button type="button" class="ckl-chip">` por item, criado em `criarItemCkl`.
- Com marcação: iniciais (`avatarInitials`) + primeiro nome (`nomeDeUsuario(email).split(' ')[0]`);
  `title` = nome completo. Sem marcação: texto "+ colega", estilo discreto (`.ckl-chip.vazio`).
- Ativo em **visualização e edição**, como o select hoje (marcar item é execução, não edição de
  cadastro). Não existe estado desabilitado.
- Clique abre o popover ancorado ao item. Clique no chip do item que já está com o popover aberto fecha.

### Popover (`#cklDropdown`, único no DOM)

- Markup: `<div id="cklDropdown" class="combo-dropdown" style="display:none">` contendo
  `<input id="cklBuscaInput" placeholder="Buscar colega…" autocomplete="off">` e `<div id="cklOpcoes">`.
- Ao abrir: o nó é movido (`appendChild`) para dentro do `.ckl-item` clicado, que recebe
  `position: relative`; assim o CSS existente de `.combo-dropdown` (`top: calc(100% + 4px)`) posiciona
  sem cálculo de coordenadas. Guarda o item alvo em `cklComboAlvo`. Limpa e foca o input, renderiza a
  lista com termo vazio.
- Lista: função comum `montarOpcoesUsuarios(termo, emailAtual, extras)` extraída de
  `renderRespDropdown`, devolvendo HTML de `.combo-opt` — "— Nenhum —" primeiro (valor vazio), depois
  `usuariosOrdenados()` filtrados por `nome + email + cargo` contendo o termo (case-insensitive),
  com `<small>· cargo</small>`; `.combo-empty` quando vazio com termo. `renderRespDropdown` passa a
  usar a mesma função (sem mudança de comportamento).
- `extras`: se a marcação atual não está em `usuarios`, entra como opção extra ativa com
  `nomeDeUsuario(email)`, para a marcação legada não sumir e o próximo save não a apagar.
- Teclado no input: digitar filtra; **Enter** escolhe a primeira opção com e-mail (igual ao combo do
  Responsável); **Esc** fecha o popover e `stopPropagation` (o modal não fecha). Sem navegação por setas.
- Mouse: `mousedown` com `preventDefault` nas opções (mesmo truque do combo existente).
- Fecha em: seleção, Esc, clique fora (o handler global que já fecha `respDropdown` passa a fechar
  `cklDropdown` também), fechamento do modal, re-render da lista de itens.

### Seleção

`selecionarCklColega(email)`:
1. `alvo.dataset.responsavel = email` (fonte de verdade, inalterada).
2. Redesenha o chip do item.
3. `renderAvisosCkl()`.
4. `modalModo === 'view' ? salvarCklImediato() : verificarMudancasModal()` — idêntico ao `change`
   do select hoje. Erro de gravação continua tratado por `salvarCklImediato` (reverte ao estado do
   servidor e avisa em toast); `sincronizarCklLocal` redesenha os chips a partir do dado devolvido.

### Fora de escopo

Setas no dropdown, agrupar por unidade, foto de perfil, alterar o botão Avisar e a rota
`avisarMarcadoChecklist`, qualquer mudança em `serializarCkl` ou `salvarChecklist`.

## 2. Nomes normalizados

- `nomeDeEmail(email)`: parte local do e-mail → remove segmentos `ext` → separa por `.`, `_` e `-` →
  capitaliza cada parte → junta com espaço. `fabiane.minozzo` → "Fabiane Minozzo";
  `guilherme.amorim.ext` → "Guilherme Amorim"; vazio → "".
- `nomeDeUsuario` não muda (já cai em `nomeDeEmail` quando não acha o usuário).
- Histórico: `esc(nomeDeEmail(i.Editor))` passa a `esc(nomeDeUsuario(i.Editor))`.
- Opção extra do popover e o chip usam `nomeDeUsuario`, logo herdam o fallback.
- Painéis (`integracoes/PlanoAcaoCora.html`, `pacNome`) já normalizam do mesmo jeito; nada muda.

## 3. CSS

- `.ckl-chip`: altura 28px, `border: 1px solid var(--input)`, `border-radius: 999px`, avatar de 18px
  + nome em `.75rem`, `max-width: 190px` com ellipsis, `flex-shrink: 0` — ocupa o lugar do select.
- `.ckl-chip.vazio`: `color: var(--muted-foreground)`, borda tracejada.
- `.ckl-item { position: relative; }` para ancorar o popover.
- `#cklDropdown .combo-busca`: input no topo do popover, largura 100%, borda inferior.
- Remover `.ckl-responsavel-sel` (sem uso).

## 4. Verificação

Sem testes Node para o front. Verificar no preview local (`npx serve -p 3000 .`, mock embutido):

1. Visualização como Usuário Padrão em tarefa de outro (`currentUser`/`currentUserPodeExcluir` no
   console): chip clicável; digitar filtra por nome, e-mail e cargo; Enter marca a primeira; o mock de
   `chamarAPI` recebe `salvarChecklist` com o e-mail no item (spy no console); chip mostra iniciais +
   primeiro nome; botão Avisar aparece para a pessoa marcada.
2. "— Nenhum —" remove a marcação e dispara o save.
3. Esc fecha só o popover (modal continua); clique fora fecha; abrir em outro item move o popover.
4. Edição: marcar não salva na hora, ativa "alterações pendentes"; Salvar envia todos os itens.
5. Item com e-mail fora da aba Usuários: chip com nome humanizado, opção extra presente, marcação
   preservada após save.
6. Histórico: editor exibido com nome real (cadastrado) ou humanizado (não cadastrado).
7. Console sem erros; modo criar inalterado.

Publicação: `npm test` (backend, deve seguir verde), `clasp push`, nova versão do Cora com
`clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8`
(vira @66), hard reload. Registrar no HANDOFF.
