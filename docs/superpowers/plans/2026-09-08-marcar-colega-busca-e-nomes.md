# Marcar colega com busca + nomes normalizados + erro de carga visível — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No Cora, marcar um colega num item de checklist por busca de nome (chip + popover compartilhado), nunca exibir e-mail cru como nome, e mostrar na Home o erro da carga inicial quando ela falha.

**Architecture:** Tudo em `tarefas-shadcn.html` (markup + CSS + JS vanilla ES5, inline). O `<select>` de colega de cada item vira um `<button class="ckl-chip">`; um único popover `#cklDropdown` (reaproveita o CSS `.combo-dropdown` do campo Responsável) é movido para dentro do item clicado ao abrir e devolvido a um contêiner oculto ao fechar. A montagem da lista de usuários é extraída de `renderRespDropdown` para `montarOpcoesUsuarios()` e usada pelos dois combos. A fonte de verdade da marcação continua `div.dataset.responsavel`; backend, planilha e rotas não mudam.

**Tech Stack:** HTML/CSS/JS vanilla (ES5, sem build), Apps Script Web App (JSONP), preview local com mock (`npx serve -p 3000 .`), `clasp` para publicar.

**Spec:** `docs/superpowers/specs/2026-09-08-marcar-colega-busca-e-nomes-design.md`

## Global Constraints

- Só `tarefas-shadcn.html` muda de código. Nenhuma alteração em `Code.gs`, abas do Sheets ou rotas.
- JS estilo ES5 do arquivo: `var`, `function`, sem arrow functions, sem template strings, sem `const/let`.
- Escapar todo texto vindo de dados com `esc()` antes de injetar em `innerHTML`.
- `div.dataset.responsavel` continua a única fonte de verdade da marcação; `serializarCkl`, `salvarCkl`, `salvarChecklist` não mudam.
- O chip é ativo em visualização **e** edição (como o select era). Em `view` a seleção chama `salvarCklImediato()`; em `edit`/`create`, `verificarMudancasModal()`.
- Textos de UI em português; copiar os literais deste plano.
- Não há testes Node para o front: cada tarefa termina com verificação no preview local (mock). `npm test` (backend) deve continuar verde.
- Publicação só na Task 5: `clasp push` + `clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8` (nunca `clasp deploy` sem `-i`).

**Como abrir o preview (usado em todas as tarefas):** `npx serve -p 3000 .` na raiz do repo e abrir `http://localhost:3000/tarefas-shadcn.html`. Em localhost o mock embutido substitui `chamarAPI`. Para simular Usuário Padrão em tarefa de outro, no console: `currentUser = 'elisa.nogueira@exemplo.test'; currentUserPodeExcluir = false;` antes de abrir uma tarefa pela Lista (abre em `view`).

---

### Task 1: Nome humanizado no fallback e no Histórico

**Files:**
- Modify: `tarefas-shadcn.html` — `function nomeDeEmail` (≈ linha 2334) e o `hist-editor` em `renderInteracoes` (≈ linha 2263)

**Interfaces:**
- Produces: `nomeDeEmail(email)` → string humanizada ("fabiane.minozzo@x" → "Fabiane Minozzo"; "guilherme.amorim.ext@x" → "Guilherme Amorim"; "" → ""). `nomeDeUsuario(email)` não muda de assinatura e continua caindo em `nomeDeEmail`.

- [ ] **Step 1: Substituir `nomeDeEmail`**

Localizar:
```js
function nomeDeEmail(email) {
  return email ? email.split('@')[0] : '';
}
```
Trocar por:
```js
// Fallback quando o e-mail não está na aba Usuários: humaniza a parte local.
// "fabiane.minozzo" → "Fabiane Minozzo"; "guilherme.amorim.ext" → "Guilherme Amorim".
function nomeDeEmail(email) {
  var local = String(email || '').split('@')[0];
  if (!local) return '';
  return local.split(/[._-]+/)
    .filter(function(p) { return p && p.toLowerCase() !== 'ext'; })
    .map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); })
    .join(' ');
}
```

- [ ] **Step 2: Histórico usa o nome real quando houver**

Localizar em `renderInteracoes`:
```js
      + '<span class="hist-editor">' + esc(nomeDeEmail(i.Editor || '')) + '</span>'
```
Trocar por:
```js
      + '<span class="hist-editor">' + esc(nomeDeUsuario(i.Editor || '')) + '</span>'
```

- [ ] **Step 3: Verificar no preview**

Abrir o preview, no console:
```js
nomeDeEmail('fabiane.minozzo@unimedcnu.coop.br')        // "Fabiane Minozzo"
nomeDeEmail('guilherme.amorim.ext@unimedcnu.coop.br')   // "Guilherme Amorim"
nomeDeEmail('maria_j-silva@x')                          // "Maria J Silva"
nomeDeEmail('')                                         // ""
nomeDeUsuario('bruno.martins@exemplo.test')             // "Bruno Martins" (cadastrado no mock)
nomeDeUsuario('zeca.ninguem@exemplo.test')              // "Zeca Ninguem" (fallback)
```
Abrir uma tarefa → aba Histórico: editores aparecem com nome, nunca com `ana.souza`.

- [ ] **Step 4: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat(front): nome humanizado no fallback de e-mail e no editor do histórico"
```

---

### Task 2: Extrair `montarOpcoesUsuarios()` do combobox de Responsável

**Files:**
- Modify: `tarefas-shadcn.html` — `function renderRespDropdown` (≈ linhas 1685–1708)

**Interfaces:**
- Produces: `montarOpcoesUsuarios(termo, emailAtual, extras)` → string HTML de `.combo-opt`/`.combo-empty`. `termo` string (filtro, pode ser vazio); `emailAtual` string (marca `.active`); `extras` array opcional de `{email, nome}` para incluir quem não está em `usuarios` (Task 3 usa). Opção "— Nenhum —" com `data-email=""` sempre em primeiro.
- Consumes: `usuariosOrdenados()`, `esc()`.

- [ ] **Step 1: Criar a função comum logo acima de `renderRespDropdown`**

```js
// Lista de usuários para os combos com busca (campo Responsável e chip do
// checklist). "— Nenhum —" primeiro; `extras` inclui e-mails fora da aba
// Usuários (marcação legada) para a opção não sumir.
function montarOpcoesUsuarios(termo, emailAtual, extras) {
  termo = (termo || '').toLowerCase().trim();
  emailAtual = String(emailAtual || '').toLowerCase();
  var lista = usuariosOrdenados().filter(function(u) {
    if (!u.email) return false;
    if (!termo) return true;
    return (u.nome + ' ' + u.email + ' ' + (u.cargo || '')).toLowerCase().indexOf(termo) !== -1;
  });
  (extras || []).forEach(function(x) {
    if (!x || !x.email) return;
    var ja = lista.some(function(u) { return String(u.email).toLowerCase() === String(x.email).toLowerCase(); });
    if (!ja && (!termo || (x.nome + ' ' + x.email).toLowerCase().indexOf(termo) !== -1)) lista.push({ email: x.email, nome: x.nome, cargo: '' });
  });
  var html = '<div class="combo-opt' + (!emailAtual ? ' active' : '') + '" data-email="">— Nenhum —</div>';
  lista.forEach(function(u) {
    var ativo = String(u.email).toLowerCase() === emailAtual;
    html += '<div class="combo-opt' + (ativo ? ' active' : '') + '" data-email="' + esc(u.email) + '">'
      + esc(u.nome) + (u.cargo ? ' <small>· ' + esc(u.cargo) + '</small>' : '') + '</div>';
  });
  if (!lista.length && termo) html += '<div class="combo-empty">Nenhum colega encontrado</div>';
  return html;
}
```

- [ ] **Step 2: `renderRespDropdown` passa a usar a função**

Substituir o corpo desde `termo = (termo || '')...` até `dd.innerHTML = html;` por:
```js
function renderRespDropdown(termo) {
  var dd    = document.getElementById('respDropdown');
  var atual = document.getElementById('campoResponsavel').value;
  dd.innerHTML = montarOpcoesUsuarios(termo, atual, []);
```
Manter intacto o restante (o `forEach` que adiciona `mousedown` nas `.combo-opt` e o `dd.style.display = 'block'`).

- [ ] **Step 3: Verificar no preview**

Abrir uma tarefa em edição → campo Responsável: clicar abre a lista com "— Nenhum —" e os 5 do mock em ordem alfabética; digitar "bru" filtra para Bruno; digitar "coord" filtra por cargo; termo sem resultado mostra "Nenhum colega encontrado"; Enter escolhe; Esc fecha sem fechar o modal. Console sem erros.

- [ ] **Step 4: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "refactor(front): montarOpcoesUsuarios compartilhada pelo combobox de responsável"
```

---

### Task 3: Chip por item + popover de busca compartilhado no checklist

**Files:**
- Modify: `tarefas-shadcn.html`
  - CSS: bloco `/* ── Checklist no modal ── */` (≈ linhas 440–452) — trocar `.ckl-responsavel-sel` por `.ckl-chip` e adicionar `.combo-busca`
  - Markup: após `<div class="ckl-items" id="cklItems"></div>` (≈ linha 867)
  - JS: globais (≈ linha 953), `criarItemCkl` (≈ 2021–2088), `fecharModal` (≈ 1947), `abrirModal` antes de `var itensEl = document.getElementById('cklItems');` (≈ 1847), click-outside no `DOMContentLoaded` (≈ 1071)

**Interfaces:**
- Consumes: `montarOpcoesUsuarios(termo, emailAtual, extras)` (Task 2), `nomeDeUsuario`, `avatarInitials`, `renderAvisosCkl`, `salvarCklImediato`, `verificarMudancasModal`, `modalModo`.
- Produces: `renderCklChip(div)`, `abrirCklCombo(div)`, `fecharCklCombo()`, `renderCklOpcoes(termo)`, `selecionarCklColega(email)`; global `cklComboAlvo` (o `.ckl-item` com o popover aberto, ou `null`).

- [ ] **Step 1: CSS — substituir as duas regras `.ckl-responsavel-sel*` por**

```css
    .ckl-item { position: relative; }  /* ancora o popover de colega */
    .ckl-chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; max-width: 190px; padding: 0 10px 0 4px; border: 1px solid var(--input); border-radius: 999px; background: var(--surface); color: var(--text-secondary); font-size: .75rem; cursor: pointer; flex-shrink: 0; }
    .ckl-chip:hover { border-color: var(--border-hover); }
    .ckl-chip:focus-visible { outline: none; border-color: var(--ring); }
    .ckl-chip .ckl-chip-av { width: 18px; height: 18px; border-radius: 50%; background: var(--primary); color: #fff; font-size: .6rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ckl-chip .ckl-chip-nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ckl-chip.vazio { border-style: dashed; color: var(--muted-foreground); padding-left: 10px; }
    .combo-busca { display: block; width: 100%; box-sizing: border-box; padding: 8px 10px; margin-bottom: 4px; border: none; border-bottom: 1px solid var(--border); border-radius: 0; background: transparent; color: var(--foreground); font-size: .875rem; }
    .combo-busca:focus { outline: none; box-shadow: none; }
```
(Remover `.ckl-responsavel-sel` e `.ckl-responsavel-sel:focus`; a regra `.ckl-item { display:flex; ... }` existente permanece — a nova linha só acrescenta `position: relative`.)

- [ ] **Step 2: Markup — popover único, guardado num contêiner oculto**

Logo após a linha `<div class="ckl-items" id="cklItems"></div>` inserir:
```html
            <div id="cklDropdownHome" style="display:none">
              <div id="cklDropdown" class="combo-dropdown" style="display:none">
                <input type="text" id="cklBuscaInput" class="combo-busca" placeholder="Buscar colega…" autocomplete="off">
                <div id="cklOpcoes"></div>
              </div>
            </div>
```

- [ ] **Step 3: JS — global e funções do popover** (inserir logo antes de `// ── Checklist ───` / `function criarItemCkl`)

```js
var cklComboAlvo = null; // .ckl-item com o popover de colega aberto (ou null)

// Chip do item: iniciais + primeiro nome de quem está marcado, ou "+ colega".
function renderCklChip(div) {
  var chip = div.querySelector('.ckl-chip');
  if (!chip) return;
  var email = div.dataset.responsavel || '';
  chip.innerHTML = '';
  if (email) {
    var nome = nomeDeUsuario(email);
    var av = document.createElement('span'); av.className = 'ckl-chip-av'; av.textContent = avatarInitials(email);
    var nm = document.createElement('span'); nm.className = 'ckl-chip-nome'; nm.textContent = nome.split(' ')[0];
    chip.appendChild(av); chip.appendChild(nm);
    chip.classList.remove('vazio');
    chip.title = nome;
  } else {
    var vazio = document.createElement('span'); vazio.className = 'ckl-chip-nome'; vazio.textContent = '+ colega';
    chip.appendChild(vazio);
    chip.classList.add('vazio');
    chip.title = 'Atribuir este item a um colega';
  }
}

function renderCklOpcoes(termo) {
  if (!cklComboAlvo) return;
  var atual  = cklComboAlvo.dataset.responsavel || '';
  var extras = [];
  if (atual && !usuarios.some(function(u) { return String(u.email).toLowerCase() === atual.toLowerCase(); })) {
    extras.push({ email: atual, nome: nomeDeUsuario(atual) });
  }
  var box = document.getElementById('cklOpcoes');
  box.innerHTML = montarOpcoesUsuarios(termo, atual, extras);
  Array.from(box.querySelectorAll('.combo-opt')).forEach(function(el) {
    el.addEventListener('mousedown', function(e) {
      e.preventDefault(); // não perde o foco do input antes do clique
      selecionarCklColega(el.getAttribute('data-email'));
    });
  });
}

function abrirCklCombo(div) {
  if (cklComboAlvo === div) { fecharCklCombo(); return; } // clicar de novo fecha
  fecharCklCombo();
  cklComboAlvo = div;
  var dd = document.getElementById('cklDropdown');
  div.appendChild(dd); // .ckl-item é position:relative → o CSS de .combo-dropdown posiciona
  var input = document.getElementById('cklBuscaInput');
  input.value = '';
  renderCklOpcoes('');
  dd.style.display = 'block';
  input.focus();
}

function fecharCklCombo() {
  var dd = document.getElementById('cklDropdown');
  if (!dd) return;
  dd.style.display = 'none';
  var home = document.getElementById('cklDropdownHome');
  if (home && dd.parentNode !== home) home.appendChild(dd); // sai do item antes que ele seja removido/recriado
  cklComboAlvo = null;
}

function selecionarCklColega(email) {
  var div = cklComboAlvo;
  fecharCklCombo();
  if (!div) return;
  div.dataset.responsavel = email || '';
  renderCklChip(div);
  renderAvisosCkl();
  if (modalModo === 'view') salvarCklImediato();
  else verificarMudancasModal();
}

function cklBuscaKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    var opts = document.querySelectorAll('#cklOpcoes .combo-opt');
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].getAttribute('data-email')) { selecionarCklColega(opts[i].getAttribute('data-email')); return; }
    }
  } else if (e.key === 'Escape') {
    e.stopPropagation(); // fecha só o popover, não o modal
    fecharCklCombo();
  }
}
```

- [ ] **Step 4: JS — ligar o input do popover** (no `DOMContentLoaded`, junto do click-outside existente)

Substituir o bloco:
```js
  // Fecha o dropdown de responsável ao clicar fora
  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('respWrap');
    var dd   = document.getElementById('respDropdown');
    if (wrap && dd && !wrap.contains(e.target)) dd.style.display = 'none';
  });
```
por:
```js
  // Fecha os dropdowns (responsável e colega do checklist) ao clicar fora
  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('respWrap');
    var dd   = document.getElementById('respDropdown');
    if (wrap && dd && !wrap.contains(e.target)) dd.style.display = 'none';
    var cdd = document.getElementById('cklDropdown');
    if (cklComboAlvo && cdd && !cdd.contains(e.target) && !(e.target.closest && e.target.closest('.ckl-chip'))) fecharCklCombo();
  });
  var cklBusca = document.getElementById('cklBuscaInput');
  if (cklBusca) {
    cklBusca.addEventListener('input',   function() { renderCklOpcoes(cklBusca.value); });
    cklBusca.addEventListener('keydown', cklBuscaKeydown);
  }
```

- [ ] **Step 5: JS — `criarItemCkl` troca o select pelo chip**

Substituir todo o trecho desde o comentário `// Select de colega: atribui o item a alguém...` até o `sel.addEventListener('change', ...);` (fechamento inclusive) por:
```js
  // Chip de colega: abre o popover de busca compartilhado. Ativo também em
  // visualização — atribuir é execução, como marcar o checkbox.
  var chip = document.createElement('button');
  chip.type      = 'button';
  chip.className = 'ckl-chip';
  chip.addEventListener('click', function(e) {
    e.stopPropagation();
    abrirCklCombo(div);
  });
```
E trocar `div.appendChild(sel);` por `div.appendChild(chip);` seguido de `renderCklChip(div);` (depois do `appendChild`, pois `renderCklChip` procura o chip dentro do `div`):
```js
  div.appendChild(chk);
  div.appendChild(span);
  div.appendChild(chip);
  div.appendChild(del);
  renderCklChip(div);
  return div;
```
No handler do `del` (excluir item), acrescentar `fecharCklCombo();` como primeira linha, antes de `div.remove();`.

- [ ] **Step 6: JS — fechar o popover ao fechar o modal e ao reconstruir os itens**

Em `fecharModal()` acrescentar `fecharCklCombo();` como primeira linha do corpo.
Em `abrirModal`, imediatamente antes da linha `var itensEl = document.getElementById('cklItems');` (≈ 1847), inserir `fecharCklCombo();`.

- [ ] **Step 7: Remover resíduos**

`grep -n "ckl-responsavel-sel" tarefas-shadcn.html` deve devolver vazio. `grep -n "optVazia\|oExtra" tarefas-shadcn.html` deve devolver vazio.

- [ ] **Step 8: Verificar no preview (roteiro da spec, seção 5)**

1. Console: `currentUser = 'elisa.nogueira@exemplo.test'; currentUserPodeExcluir = false;` → Lista → clicar numa tarefa com checklist (abre em `view`). Cada item mostra chip "+ colega" ou iniciais + primeiro nome.
2. Antes de clicar, no console: `var _o = chamarAPI; chamarAPI = function(p, cb) { if (p.acao === 'salvarChecklist') console.log('SAVE', JSON.stringify(p.dados.itens)); return _o(p, cb); };`
3. Clicar no chip: popover abre dentro do item, input focado, lista com "— Nenhum —" e os 5 do mock. Digitar "cla" → só Clara; digitar "gerent" → filtra por cargo; "zzz" → "Nenhum colega encontrado". Enter → marca Clara: chip vira "CR Clara", console mostra `SAVE` com `responsavel: clara.ribeiro@…` no item, toast "Checklist atualizada.", botão "Avisar Clara" aparece abaixo da lista.
4. Clicar no chip de novo → popover; clicar "— Nenhum —" → chip volta a "+ colega", novo `SAVE` com `responsavel: ""`.
5. Abrir popover, Esc → fecha só o popover (modal segue aberto). Abrir, clicar fora → fecha. Abrir no item 1 e depois no item 2 → o popover muda de item (só um aberto).
6. Fechar e abrir a tarefa em edição (lápis): marcar colega não gera `SAVE`, o botão Salvar fica habilitado; Salvar envia todos os itens com os responsáveis. Adicionar item novo → chip "+ colega". Excluir um item com popover aberto → sem erro no console.
7. Marcação legada: no console, antes de abrir a tarefa, `cklStatus['1'][0].Responsavel = 'zeca.ninguem@exemplo.test'` (ajustar o ID para uma tarefa do mock com checklist) → chip mostra "ZN Zeca"; popover lista "Zeca Ninguem" como opção ativa; marcar outro item e salvar não apaga o Zeca.
8. Console sem erros em todo o fluxo; modo criar (Nova tarefa) inalterado.

- [ ] **Step 9: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat(front): marcar colega no checklist por chip + busca de nomes compartilhada"
```

---

### Task 4: Erro de carga visível na Home

**Files:**
- Modify: `tarefas-shadcn.html`
  - Markup: `#homeView`, logo após o fechamento de `<div class="home-hero">…</div>` (≈ linha 641)
  - CSS: junto das regras `.home-*`; e dentro de `@media print` (≈ linha 502)
  - JS: `carregarTudo()` e sua `aplicar()` (≈ linhas 1116–1130)

**Interfaces:**
- Produces: `renderHomeAlerta(msg)` (mostra) e `limparHomeAlerta()` (esconde). Consumes: `esc()`, `toast()`, `carregarTudo()`.

- [ ] **Step 1: Markup**

Após o `</div>` que fecha `.home-hero`, inserir:
```html
  <div id="homeAlerta" class="home-alerta" role="alert" style="display:none">
    <div class="home-alerta-txt">
      <strong>Não foi possível carregar seus dados</strong>
      <div id="homeAlertaMsg"></div>
      <div class="home-alerta-dica">Se você usa mais de uma conta Google neste navegador, abra o app com a conta <b>@unimedcnu.coop.br</b> pelo link direto ou em janela anônima.</div>
    </div>
    <button type="button" class="btn btn-ghost" onclick="carregarTudo()">Tentar de novo</button>
  </div>
```

- [ ] **Step 2: CSS**

Junto das regras `.home-*`:
```css
    .home-alerta { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 0 0 16px; padding: 12px 14px; border: 1px solid var(--border); border-left: 4px solid var(--erro-cor); border-radius: var(--radius); background: var(--surface); color: var(--foreground); font-size: .875rem; }
    .home-alerta-txt strong { display: block; margin-bottom: 2px; }
    .home-alerta-dica { margin-top: 6px; color: var(--muted-foreground); font-size: .82rem; }
```
Dentro de `@media print { … }` acrescentar: `.home-alerta { display: none !important; }`

- [ ] **Step 3: JS — helpers e uso em `carregarTudo`**

Antes de `function carregarTudo()`:
```js
function renderHomeAlerta(msg) {
  var el = document.getElementById('homeAlerta');
  if (!el) return;
  document.getElementById('homeAlertaMsg').textContent = msg || '';
  el.style.display = 'flex';
}
function limparHomeAlerta() {
  var el = document.getElementById('homeAlerta');
  if (el) el.style.display = 'none';
}
```
Em `carregarTudo()`, primeira linha do corpo: `limparHomeAlerta();`
Em `aplicar()`, o bloco:
```js
    if (erroCritico) {
      document.getElementById('board').innerHTML =
        '<div id="loading" style="color:var(--erro-cor)">Erro ao carregar tarefas: ' + esc(erroCritico) + '</div>';
      return;
    }
```
vira:
```js
    if (erroCritico) {
      document.getElementById('board').innerHTML =
        '<div id="loading" style="color:var(--erro-cor)">Erro ao carregar tarefas: ' + esc(erroCritico) + '</div>';
      renderHomeAlerta(erroCritico); // o app abre na Home: o erro precisa aparecer lá
      toast(erroCritico, true);
      return;
    }
```

- [ ] **Step 4: Verificar no preview**

Console, antes de recarregar dados:
```js
var _o = chamarAPI; chamarAPI = function(p, cb) { if (p.acao === 'bootstrap') { cb({ erro: 'Conta Google não identificada. Feche outras contas ou use janela anônima com a conta @unimedcnu.coop.br.' }); return; } return _o(p, cb); }; carregarTudo();
```
→ Home mostra o alerta com a mensagem e a dica, toast vermelho, aba Tarefas mostra o texto em vermelho no board. Depois `chamarAPI = _o;` e clicar **Tentar de novo** → alerta some, dados carregam. Simular só `bootstrapApoio` com erro → sem alerta, só o toast "Alguns dados não carregaram: …" (comportamento atual). Ctrl+P: o alerta não aparece na impressão.

- [ ] **Step 5: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat(front): alerta na Home quando a carga inicial falha, com orientação de conta"
```

---

### Task 5: Publicar e registrar

**Files:**
- Modify: `docs/HANDOFF.md` (bloco novo + backlog), `README.md` se listar a versão publicada

- [ ] **Step 1: Backend continua verde e push**

```bash
npm test
npx clasp push -f
```
Esperado: `6 arquivo(s) verdes`; push lista `tarefas-shadcn.html`.

- [ ] **Step 2: Nova versão na implantação existente do Cora**

```bash
npx clasp deploy -i AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8 -d "marcar colega com busca, nomes humanizados, alerta de carga na Home"
```
Esperado: `Deployed AKfycbyFDVg… @66`. Anotar o número.

- [ ] **Step 3: Verificar em produção (hard reload)**

Abrir o app com Ctrl+Shift+R. Abrir uma tarefa do GT Onco: chips com nomes (Fabiane Minozzo, Taiara Rodrigues); marcar-se num item e desmarcar; Histórico com nomes. Console sem erros.

- [ ] **Step 4: HANDOFF**

Adicionar bloco "### Último bloco — 08/09 (fim de tarde): marcar colega com busca + nomes + alerta de carga" com: o que mudou, versão @66, e o caso Glaucia (causa: chamadas JSONP sem sessão da conta corporativa no embed do Sites; teste: link direto em janela anônima). Na seção de backlog, incluir: **"Visão de gestores para indicadores"** — próximo passo pedido pelo Aurélio em 08/09 (painel de indicadores para perfil Gestor; escopo a levantar em brainstorming).

- [ ] **Step 5: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs: handoff — marcar colega com busca, nomes humanizados, alerta de carga (@66); backlog indicadores"
```

---

## Self-review

- **Spec coverage:** §1 chip/popover → Task 3; §2 nomes → Task 1; §3 alerta → Task 4; §4 CSS → Tasks 3 e 4; §5 verificação → Steps de verificação de cada task + Task 5. Publicação → Task 5.
- **Placeholders:** nenhum; todo passo de código traz o código.
- **Consistência de nomes:** `montarOpcoesUsuarios(termo, emailAtual, extras)` (Task 2) é usada com essa assinatura em Task 3; `fecharCklCombo`, `abrirCklCombo`, `renderCklChip`, `renderCklOpcoes`, `selecionarCklColega`, `cklBuscaKeydown`, `cklComboAlvo` coerentes entre os passos; `renderHomeAlerta`/`limparHomeAlerta` só na Task 4.
