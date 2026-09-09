# Marcação de colegas em itens de checklist — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Devolver a capacidade de atribuir itens de checklist a colegas, com aviso por e-mail apenas quando o usuário pedir.

**Architecture:** A infraestrutura já existe (coluna `Responsavel`, persistência, visibilidade por marcação, e-mail HTML). O trabalho é: (1) backend com rota de aviso manual validada e remoção da notificação automática que causou o spam; (2) `<select>` de colega em cada item, salvando na hora em modo visualização; (3) botões "Avisar &lt;Nome&gt;" por pessoa marcada.

**Tech Stack:** Google Apps Script (ES5, `var`, sem módulos) + HTML/JS vanilla inline. Sem build, sem framework de teste.

**Spec:** [`docs/superpowers/specs/2026-08-03-marcacao-colegas-checklist-design.md`](../specs/2026-08-03-marcacao-colegas-checklist-design.md)

## Global Constraints

- **Backend em ES5:** `var`, sem arrow function, sem template literal, sem `let`/`const`. O `Code.gs` inteiro segue esse estilo.
- **Não reordenar colunas** das abas. Índices fixos: aba `Checklist_Status` = `ID`(0), `ID_Tarefa`(1), `ID_Template`(2), `Item`(3), `Ordem`(4), `Concluído`(5), `Data conclusão`(6), `Responsavel`(7).
- **Leituras de aba** usam `lerAba(nome)` (cache por execução), **exceto** dentro do lock de `salvarChecklist`, que lê direto de propósito.
- **Verificação, não testes unitários:** o projeto não tem framework. O análogo de "teste que falha" aqui é um script rodado com `javascript_tool` no preview (`http://localhost:3000/tarefas-shadcn.html`, mock ativo em localhost), mais `node --check` no backend. Cada tarefa escreve a verificação **antes** da implementação e confirma que ela falha.
- **Sintaxe do backend** valida assim (o `.gs` não é aceito direto pelo node):
  ```bash
  cp Code.gs /tmp/Code.check.js && node --check /tmp/Code.check.js
  ```
  Use o diretório de scratchpad da sessão em vez de `/tmp` se ele estiver definido.
- **Deploy não faz parte deste plano.** `clasp push` só depois da última tarefa; publicar a Nova versão é do Aurélio.

## File Structure

| Arquivo | Responsabilidade nesta mudança |
|---|---|
| `Code.gs` | Rota `avisarMarcadoChecklist`, e-mail com lista de itens, validação de domínio do colega marcado, remoção da notificação automática e da flag |
| `tarefas-shadcn.html` | `<select>` de colega no item, botões de aviso, CSS, mock local |
| `CLAUDE.md` | Tabela de endpoints |
| `README.md` | Menção à feature |
| `docs/HANDOFF.md` | Estado e pendência de teste real |

---

### Task 1: Backend — rota de aviso e fim da notificação automática

**Files:**
- Modify: `Code.gs` (remoção do bloco de notificação em `salvarChecklist`; flag na linha ~33; validação em `salvarChecklist`; `notificarMarcadoChecklist`; nova função; `case` no `doGet`)

**Interfaces:**
- Consumes: `idsTarefasVisiveis(email)`, `lerAba(nome)`, `DOMINIOS_PERMITIDOS`, `COL`, `ABA_CKL_STATUS`, `ABA_TAREFAS`, `enviarEmail(to, subject, html)`, `escHtml(s)`, `gravarLog(acao, campo, anterior, novo)`
- Produces: `avisarMarcadoChecklist(dados)` → `{sucesso: true, itens: <número>}` ou `{erro: <string>}`; rota `acao=avisarMarcadoChecklist` com `dados = {idTarefa, email}`; `notificarMarcadoChecklist(email, nomeTarefa, itens, quemAvisou)` onde `itens` é array de strings

- [ ] **Step 1: Escrever a verificação (que vai falhar)**

Crie `<scratchpad>/verifica-task1.sh`:

```bash
#!/usr/bin/env bash
# Verificação estática da Task 1 — roda sem Apps Script.
cd "$(dirname "$0")" || exit 1
REPO="C:/Users/Aurélio/UNIMED - Gestão de Projetos"
cd "$REPO" || exit 1
falhas=0
check() { # nome, comando
  if eval "$2" >/dev/null 2>&1; then echo "PASS  $1"; else echo "FAIL  $1"; falhas=$((falhas+1)); fi
}
check "flag CHECKLIST_MARCACAO_ATIVA removida"      '! grep -q "CHECKLIST_MARCACAO_ATIVA" Code.gs'
check "notificação automática removida do save"     '! grep -q "Notificar colegas marcados em itens" Code.gs'
check "função avisarMarcadoChecklist existe"        'grep -q "function avisarMarcadoChecklist" Code.gs'
check "rota avisarMarcadoChecklist no doGet"        "grep -q \"case 'avisarMarcadoChecklist'\" Code.gs"
check "valida colega marcado"                       'grep -q "não está marcado em nenhum item" Code.gs'
check "anti-repetição por cache"                    'grep -q "aviso_" Code.gs'
check "valida domínio do colega no salvarChecklist" 'grep -q "Colega marcado precisa ter e-mail" Code.gs'
check "e-mail recebe lista de itens"                'grep -q "function notificarMarcadoChecklist(email, nomeTarefa, itens, quemAvisou)" Code.gs'
echo "---"; [ "$falhas" -eq 0 ] && echo "TASK 1 OK" || { echo "$falhas falha(s)"; exit 1; }
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
bash "<scratchpad>/verifica-task1.sh"
```

Esperado: 8 linhas `FAIL` e saída `8 falha(s)` com exit 1.

- [ ] **Step 3: Remover a flag `CHECKLIST_MARCACAO_ATIVA`**

Em `Code.gs`, apague este bloco (linhas ~30-33):

```js
// Marcação de colegas em itens de checklist (e o e-mail de notificação).
// Desativado por ora — o front não oferece mais a UI; marcações antigas
// são preservadas nos dados e seguem valendo para visibilidade.
var CHECKLIST_MARCACAO_ATIVA = false;
```

- [ ] **Step 4: Remover a notificação automática de `salvarChecklist`**

Substitua (em `salvarChecklist`, logo após o `finally` que solta o lock):

```js
  // Notificar colegas marcados em itens da checklist (desativado por flag)
  var marcados = [];
  if (CHECKLIST_MARCACAO_ATIVA) {
    itens.forEach(function(it) {
      if (it.responsavel && marcados.indexOf(it.responsavel) === -1) marcados.push(it.responsavel);
    });
  }
  if (marcados.length && dados.nomeTarefa) {
    marcados.forEach(function(email) {
      try { notificarMarcadoChecklist(email, dados.nomeTarefa, dados.idTarefa); } catch(e) { Logger.log('Email checklist erro: ' + e.message); }
    });
  }

  gravarLog('CHECKLIST', 'ID_Tarefa', '', idTarefa);
```

por:

```js
  // Sem notificação automática aqui, de propósito. Até 15/07/2026 este ponto
  // notificava todos os marcados a cada salvamento, e como o save reescreve a
  // aba inteira, quem já estava marcado era renotificado sempre. Hoje seria
  // pior: em modo visualização o save acontece a cada clique de checkbox.
  // O aviso é manual, por avisarMarcadoChecklist().
  gravarLog('CHECKLIST', 'ID_Tarefa', '', idTarefa);
```

- [ ] **Step 5: Validar o domínio do colega marcado**

Em `salvarChecklist`, substitua o laço de limites defensivos:

```js
  for (var v = 0; v < itensIn.length; v++) {
    if (String(itensIn[v].item || '').length > 300) return { erro: 'Item de checklist excede 300 caracteres.' };
  }
```

por:

```js
  for (var v = 0; v < itensIn.length; v++) {
    if (String(itensIn[v].item || '').length > 300) return { erro: 'Item de checklist excede 300 caracteres.' };
    // O campo Responsavel concede visibilidade da tarefa (idsTarefasVisiveis),
    // então não pode aceitar string arbitrária.
    var rspItem = String(itensIn[v].responsavel || '').trim().toLowerCase();
    if (rspItem) {
      var domItemOk = DOMINIOS_PERMITIDOS.some(function(d) { return rspItem.slice(-d.length) === d; });
      if (!domItemOk) return { erro: 'Colega marcado precisa ter e-mail @unimedcnu.coop.br ou @unimednacional.coop.br' };
    }
  }
```

- [ ] **Step 6: Reescrever `notificarMarcadoChecklist` para receber a lista de itens**

Substitua a função inteira por:

```js
// Aviso manual (disparado por avisarMarcadoChecklist). `itens` é um array com
// os textos dos itens atribuídos a este colega nesta tarefa.
function notificarMarcadoChecklist(email, nomeTarefa, itens, quemAvisou) {
  var url  = ScriptApp.getService().getUrl();
  var li   = '';
  for (var i = 0; i < itens.length; i++) {
    li += '<li style="margin-bottom:4px">' + escHtml(itens[i]) + '</li>';
  }
  var plural = itens.length > 1 ? 'itens' : 'item';
  var html = '<div style="font-family:Arial,sans-serif;max-width:600px;color:#212529">'
    + '<div style="background:#004e4c;padding:16px 24px;border-radius:8px 8px 0 0">'
    + '<h2 style="color:#fff;margin:0;font-size:16px">[Tarefas CNU] Itens de checklist atribuídos a você</h2>'
    + '<p style="color:#a8d5d4;margin:4px 0 0;font-size:12px">Unimed CNU · Rede Ambulatorial</p>'
    + '</div>'
    + '<div style="background:#fff;padding:20px 24px;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px">'
    + '<p style="font-size:14px;margin-top:0">Você ficou com ' + itens.length + ' ' + plural + ' de checklist na tarefa:</p>'
    + '<p style="font-size:15px;font-weight:600;color:#004e4c">' + escHtml(nomeTarefa) + '</p>'
    + '<ul style="font-size:14px;padding-left:20px">' + li + '</ul>'
    + (quemAvisou ? '<p style="font-size:12px;color:#6c757d">Atribuído por ' + escHtml(quemAvisou) + '</p>' : '')
    + '<a href="' + url + '" style="display:inline-block;background:#004e4c;color:#fff;'
    +   'padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">'
    + 'Abrir Gestão de Tarefas →</a>'
    + '<p style="font-size:11px;color:#adb5bd;margin-top:18px;padding-top:12px;border-top:1px solid #f1f1f1">'
    + 'Unimed CNU · Sistema de Gestão de Tarefas — Rede Ambulatorial</p>'
    + '</div></div>';
  enviarEmail(email, '[Tarefas CNU] Itens de checklist atribuídos a você', html);
}
```

- [ ] **Step 7: Criar `avisarMarcadoChecklist`**

Insira logo **antes** de `notificarMarcadoChecklist`:

```js
// ── avisarMarcadoChecklist ────────────────────────────────────
// Aviso manual: o front chama quando o usuário clica em "Avisar <Nome>".
// Nada aqui confia no que vem do front — nem o nome da tarefa, que é lido da
// planilha para o texto do e-mail não ser controlado por quem chama.
function avisarMarcadoChecklist(dados) {
  var idTarefa = String((dados && dados.idTarefa) || '');
  var email    = String((dados && dados.email) || '').trim().toLowerCase();
  if (!idTarefa || !email) return { erro: 'Tarefa e colega são obrigatórios.' };

  // 1. Visibilidade: quem não enxerga a tarefa não dispara e-mail sobre ela.
  var solicitante = Session.getActiveUser().getEmail();
  var visiveis = idsTarefasVisiveis(solicitante);
  if (visiveis && !visiveis[idTarefa]) {
    return { erro: 'Sem permissão para avisar nesta tarefa.' };
  }

  // 2. Domínio permitido.
  var dominioOk = DOMINIOS_PERMITIDOS.some(function(d) { return email.slice(-d.length) === d; });
  if (!dominioOk) return { erro: 'E-mail fora dos domínios permitidos.' };

  // 3. O colega precisa estar marcado nesta tarefa. Sem isto, a rota seria um
  // formulário aberto para mandar e-mail em nome do sistema; só validar o
  // domínio não basta, porque qualquer @unimedcnu passaria.
  var rows  = lerAba(ABA_CKL_STATUS) || [];
  var itens = [];
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== idTarefa) continue;
    if (String(rows[i][7] || '').trim().toLowerCase() !== email) continue;
    itens.push(String(rows[i][3]));
  }
  if (!itens.length) {
    return { erro: 'Este colega não está marcado em nenhum item desta tarefa.' };
  }

  // Anti-repetição: cobre duplo-clique e reabertura do modal.
  var chaveCache = 'aviso_' + idTarefa + '_' + email;
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  if (cache) {
    try {
      if (cache.get(chaveCache)) {
        return { erro: 'Aviso já enviado agora há pouco para este colega.' };
      }
      cache.put(chaveCache, '1', 60);
    } catch (e) {}
  }

  // Nome da tarefa vem da planilha, não do front.
  var nomeTarefa = '';
  var rowsT = lerAba(ABA_TAREFAS) || [];
  for (var j = 1; j < rowsT.length; j++) {
    if (String(rowsT[j][COL.ID]) === idTarefa) { nomeTarefa = String(rowsT[j][COL.TAREFA]); break; }
  }

  try {
    notificarMarcadoChecklist(email, nomeTarefa, itens, solicitante);
  } catch (e) {
    Logger.log('avisarMarcadoChecklist erro: ' + e.message);
    return { erro: 'Falha ao enviar o e-mail: ' + e.message };
  }

  gravarLog('AVISO_CHECKLIST', 'ID_Tarefa', idTarefa, email);
  return { sucesso: true, itens: itens.length };
}
```

- [ ] **Step 8: Registrar a rota no `doGet`**

Em `doGet`, no `switch (acao)`, logo depois da linha de `salvarChecklist`:

```js
      case 'salvarChecklist':        resultado = salvarChecklist(dados);        break;
      case 'avisarMarcadoChecklist': resultado = avisarMarcadoChecklist(dados); break;
```

- [ ] **Step 9: Rodar a verificação e o `node --check`**

```bash
bash "<scratchpad>/verifica-task1.sh"
```

Esperado: 8 linhas `PASS` e `TASK 1 OK`.

```bash
cp Code.gs "<scratchpad>/Code.check.js" && node --check "<scratchpad>/Code.check.js" && echo "SINTAXE OK"
```

Esperado: `SINTAXE OK`.

- [ ] **Step 10: Commit**

```bash
git add Code.gs
git commit -m "feat: rota de aviso manual para colega marcado em checklist

Reativa a marcação pelo backend. O aviso deixa de ser automático: a nova rota
avisarMarcadoChecklist envia um e-mail com os itens daquela pessoa naquela
tarefa, e só quando o usuário pede.

Validações antes de enviar: visibilidade da tarefa, domínio permitido e o
colega estar realmente marcado nela — sem esta última a rota seria um
formulário aberto para disparar e-mail em nome do sistema. O nome da tarefa é
lido da planilha, não do payload. Cache de 60 s cobre duplo-clique.

Remove a notificação automática e a flag CHECKLIST_MARCACAO_ATIVA: era ela que
renotificava todos os marcados a cada salvamento, e hoje seria pior porque o
save ocorre a cada clique de checkbox.

Passa a validar o domínio do colega marcado em salvarChecklist — o campo
concede visibilidade da tarefa e aceitava string arbitrária."
```

---

### Task 2: Front — `<select>` de colega no item

**Files:**
- Modify: `tarefas-shadcn.html` — `criarItemCkl()` (~1964), regra de desabilitar em `abrirModal()` (~1817), CSS `.ckl-responsavel-marcado` (~455)

**Interfaces:**
- Consumes: `usuarios` (array de `{nome, email, perfil, unidade, cargo}`), `modalModo`, `salvarCklImediato()`, `verificarMudancasModal()`, `nomeDeUsuario(email)`, `renderAvisosCkl()` (criada na Task 3 — **nesta tarefa, chame-a com guarda `typeof`**)
- Produces: item de checklist com `<select class="ckl-responsavel-sel">`; `div.dataset.responsavel` continua sendo a fonte de verdade da marcação

- [ ] **Step 1: Escrever a verificação (que vai falhar)**

Servidor de preview rodando (`preview_start` com `{name: "tarefas"}`), página em `http://localhost:3000/tarefas-shadcn.html`. Rode com `javascript_tool`:

```js
(function(){
  var res=[]; function ok(n,c,d){res.push({teste:n,passou:!!c,detalhe:d});}
  currentUser='ana.souza@exemplo.test'; currentUserPodeExcluir=true; currentUserIsAdmin=true;
  var t3 = tarefas.filter(function(x){return String(x.ID)==='3';})[0];

  abrirModal(t3,'view');
  var sels = [].slice.call(document.querySelectorAll('#cklItems .ckl-responsavel-sel'));
  ok('1 um select por item', sels.length===3, 'selects: '+sels.length);
  ok('2 select lista os colegas', sels.length>0 && sels[0].options.length===usuarios.length+1,
     'options: '+(sels[0]?sels[0].options.length:0)+' para '+usuarios.length+' usuarios');
  ok('3 marcação atual selecionada', sels.length>0 && sels[0].value==='ana.souza@exemplo.test',
     'value: '+(sels[0]?sels[0].value:''));
  ok('4 select ativo em view', sels.length>0 && !sels[0].disabled, '');
  ok('5 x segue travado em view',
     [].slice.call(document.querySelectorAll('.ckl-delete')).every(function(b){return b.disabled;}), '');
  ok('6 chip antigo não existe mais', document.querySelectorAll('.ckl-responsavel-marcado').length===0, '');

  // marcar em view salva na hora
  var chamadas=[]; var orig=window.chamarAPI;
  window.chamarAPI=function(p,cb){chamadas.push(p.acao); return orig(p,cb);};
  sels[1].value='clara.ribeiro@exemplo.test';
  sels[1].dispatchEvent(new Event('change'));
  ok('7 marcar em view salva na hora', chamadas.indexOf('salvarChecklist')>=0, 'chamadas: '+chamadas);
  ok('8 dataset atualizado', sels[1].closest('.ckl-item').dataset.responsavel==='clara.ribeiro@exemplo.test',
     'dataset: '+sels[1].closest('.ckl-item').dataset.responsavel);

  // em edição: acumula, não salva na hora
  abrirModal(t3,'edit');
  chamadas=[];
  var s2=document.querySelector('#cklItems .ckl-responsavel-sel');
  s2.value='diego.almeida@exemplo.test'; s2.dispatchEvent(new Event('change'));
  ok('9 edit não salva na hora', chamadas.indexOf('salvarChecklist')<0, 'chamadas: '+chamadas);
  ok('10 edit habilita Salvar', !document.getElementById('btnSalvar').disabled, '');
  window.chamarAPI=orig; fecharModal();
  return res;
})()
```

- [ ] **Step 2: Rodar e confirmar que falha**

Esperado: falham os testes 1, 2, 3, 4, 7, 8, 9 e 10 (não existe select ainda — `selects: 0`) e
também o 6 (o chip ainda existe: no mock, a tarefa 3 tem o item 1 atribuído a Ana e o item 3 a
Bruno). Passa apenas o 5, porque o `×` já é desabilitado em visualização hoje.

- [ ] **Step 3: Trocar o chip pelo `<select>` em `criarItemCkl`**

Substitua, em `criarItemCkl`, o comentário do `dataset.responsavel` e o bloco do chip.

Primeiro, o comentário (linhas ~1968-1970):

```js
  // Marcação de colegas desabilitada por ora: preserva o valor existente
  // (usado pela regra de visibilidade), mas sem UI para criar/alterar.
  div.dataset.responsavel = responsavel || '';
```

vira:

```js
  // Fonte de verdade da marcação: o select escreve aqui e serializarCkl lê daqui.
  div.dataset.responsavel = responsavel || '';
```

Depois, insira a criação do select logo após o bloco do `span` (antes do `var del`):

```js
  // Select de colega: atribui o item a alguém. Ativo também em visualização —
  // atribuir é execução, como marcar o checkbox.
  var sel = document.createElement('select');
  sel.className = 'ckl-responsavel-sel';
  var optVazia = document.createElement('option');
  optVazia.value = '';
  optVazia.textContent = '— colega —';
  sel.appendChild(optVazia);
  usuarios.forEach(function(u) {
    var o = document.createElement('option');
    o.value = u.email;
    o.textContent = u.nome || u.email;
    sel.appendChild(o);
  });
  // Marcação de alguém que não está mais na aba Usuários: cria a opção mesmo
  // assim, senão o select viria vazio e o próximo save apagaria a marcação.
  if (responsavel && !usuarios.some(function(u) { return u.email === responsavel; })) {
    var oExtra = document.createElement('option');
    oExtra.value = responsavel;
    oExtra.textContent = responsavel;
    sel.appendChild(oExtra);
  }
  sel.value = responsavel || '';
  sel.title = responsavel ? nomeDeUsuario(responsavel) : 'Atribuir este item a um colega';
  sel.addEventListener('change', function() {
    div.dataset.responsavel = sel.value;
    sel.title = sel.value ? nomeDeUsuario(sel.value) : 'Atribuir este item a um colega';
    if (typeof renderAvisosCkl === 'function') renderAvisosCkl();
    if (modalModo === 'view') salvarCklImediato();
    else verificarMudancasModal();
  });
```

E substitua o bloco de montagem final:

```js
  div.appendChild(chk);
  div.appendChild(span);
  if (responsavel) {
    var chip = document.createElement('span');
    chip.className   = 'ckl-responsavel-marcado';
    chip.title       = responsavel;
    chip.textContent = nomeDeUsuario(responsavel);
    div.appendChild(chip);
  }
  div.appendChild(del);
  return div;
```

por:

```js
  div.appendChild(chk);
  div.appendChild(span);
  div.appendChild(sel);
  div.appendChild(del);
  return div;
```

- [ ] **Step 4: Manter o select ativo em modo visualização**

Em `abrirModal`, substitua:

```js
  // Em visualização o checkbox continua ativo: marcar item é execução da tarefa,
  // não edição de cadastro — salva na hora (ver salvarCklImediato). Os demais
  // controles (excluir item, selects) seguem travados.
  if (!modoEdicao) {
    itensEl.querySelectorAll('select, button').forEach(function(el) { el.disabled = true; });
  }
```

por:

```js
  // Em visualização, checkbox e select de colega continuam ativos: marcar item
  // e atribuir são execução da tarefa, não edição de cadastro, e salvam na hora
  // (ver salvarCklImediato). Só excluir item fica travado.
  if (!modoEdicao) {
    itensEl.querySelectorAll('button').forEach(function(el) { el.disabled = true; });
  }
```

- [ ] **Step 5: Remover o CSS órfão do chip**

Apague a regra (linha ~455):

```css
    .ckl-responsavel-marcado { font-size: .72rem; color: var(--primary); font-weight: 600; background: var(--verde-bg); border-radius: calc(var(--radius) - 2px); padding: 2px 7px; flex-shrink: 0; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 6: Rodar a verificação — todos passam**

Recarregue a página (`navigate` com a mesma URL) e rode o script do Step 1.

Esperado: 10 linhas com `passou: true`.

Confirme também que o console está limpo (`read_console_messages` com `onlyErrors: true`).

- [ ] **Step 7: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat: select de colega em cada item de checklist

Devolve a UI de atribuir item a colega, removida em 0a08c3a. O select
substitui o chip somente-leitura (que só mostrava o nome) e fica ativo também
em modo visualização, salvando na hora como o checkbox — sem isso, quem abre
uma tarefa de terceiro pela Lista não conseguiria atribuir nada, o mesmo beco
sem saída do bug do checklist.

Marcação de alguém que saiu da aba Usuários ganha uma opção própria no select,
senão o campo viria vazio e o save seguinte apagaria a marcação."
```

---

### Task 3: Front — botões "Avisar &lt;Nome&gt;"

**Files:**
- Modify: `tarefas-shadcn.html` — HTML do bloco checklist (~858-861), CSS (perto de `.ckl-progress`, ~459), `atualizarProgressoCkl()` (~2022), novas funções perto de `salvarCklImediato()`, mock (~2367)

**Interfaces:**
- Consumes: `modalTarefaAtual`, `nomeDeUsuario(email)`, `chamarAPI(params, cb)`, `toast(msg, erro, sucesso)`, rota `avisarMarcadoChecklist` da Task 1
- Produces: `renderAvisosCkl()` (sem parâmetros, idempotente, lê o DOM dos itens), `avisarColega(email, btn)`

- [ ] **Step 1: Escrever a verificação (que vai falhar)**

```js
(function(){
  var res=[]; function ok(n,c,d){res.push({teste:n,passou:!!c,detalhe:d});}
  currentUser='ana.souza@exemplo.test'; currentUserPodeExcluir=true; currentUserIsAdmin=true;
  var t3 = tarefas.filter(function(x){return String(x.ID)==='3';})[0];

  abrirModal(t3,'view');
  var wrap = document.getElementById('cklAvisos');
  ok('1 container existe', !!wrap, '');
  var btns = wrap ? [].slice.call(wrap.querySelectorAll('button')) : [];
  // mock: tarefa 3 tem itens de ana.souza e bruno.martins marcados
  ok('2 um botão por pessoa marcada', btns.length===2, 'botões: '+btns.length);
  ok('3 rótulo com primeiro nome', btns.length>0 && /^Avisar (Ana|Bruno)$/.test(btns[0].textContent),
     'rótulo: '+(btns[0]?btns[0].textContent:''));

  // desmarcar remove o botão
  var sels=[].slice.call(document.querySelectorAll('#cklItems .ckl-responsavel-sel'));
  sels[0].value=''; sels[0].dispatchEvent(new Event('change'));
  ok('4 desmarcar remove o botão', wrap.querySelectorAll('button').length===1,
     'botões: '+wrap.querySelectorAll('button').length);

  // clicar avisa
  var chamadas=[]; var orig=window.chamarAPI;
  window.chamarAPI=function(p,cb){chamadas.push(p); return orig(p,cb);};
  var b = wrap.querySelector('button');
  b.click();
  var env = chamadas.filter(function(c){return c.acao==='avisarMarcadoChecklist';})[0];
  ok('5 chama a rota certa', !!env && !!env.dados.email && String(env.dados.idTarefa)==='3',
     'envio: '+JSON.stringify(env));
  window.__b=b; window.__wrap=wrap; window.__orig=orig; window.__res=res;

  // tarefa nova não mostra avisos
  abrirModal();
  ok('6 sem avisos em tarefa nova', document.getElementById('cklAvisos').style.display==='none',
     'display: '+document.getElementById('cklAvisos').style.display);
  return res;
})()
```

Segunda parte, em chamada separada (depois do callback do mock):

```js
(function(){
  var res=window.__res; function ok(n,c,d){res.push({teste:n,passou:!!c,detalhe:d});}
  ok('7 botão vira Aviso enviado', window.__b.textContent==='Aviso enviado ✓', 'texto: '+window.__b.textContent);
  ok('8 botão desabilitado após enviar', window.__b.disabled===true, '');
  window.chamarAPI=window.__orig;
  return res;
})()
```

- [ ] **Step 2: Rodar e confirmar que falha**

Esperado: teste 1 falhando (`container existe` → false) e os demais falhando em cascata por `wrap` ausente.

- [ ] **Step 3: Adicionar o container no HTML**

Em `tarefas-shadcn.html`, no bloco `.ckl-section`, insira o container entre `cklProgress` e `.ckl-add-row`:

```html
            <div class="ckl-progress" id="cklProgress" style="display:none">
              <span id="cklProgText"></span>
              <div class="ckl-bar"><div class="ckl-bar-fill" id="cklProgFill"></div></div>
            </div>
            <div class="ckl-avisos" id="cklAvisos" style="display:none"></div>
            <div class="ckl-add-row">
```

- [ ] **Step 4: Adicionar o CSS**

Logo após a regra `.ckl-progress .ckl-bar { flex: 1; height: 6px; }`:

```css
    .ckl-avisos { gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .ckl-aviso-btn { font-size: .78rem; height: 28px; padding: 0 10px; flex-shrink: 0; }
```

- [ ] **Step 5: Criar `renderAvisosCkl()` e `avisarColega()`**

Insira logo **antes** de `function salvarCklImediato()`:

```js
// Um botão por colega marcado na checklist. O aviso é sempre manual: até
// 15/07/2026 o backend notificava a cada salvamento e virava spam.
function renderAvisosCkl() {
  var wrap = document.getElementById('cklAvisos');
  if (!wrap) return;
  wrap.innerHTML = '';

  // Tarefa nova ainda não tem ID: não há o que avisar.
  if (!modalTarefaAtual) { wrap.style.display = 'none'; return; }

  var emails = [];
  document.querySelectorAll('#cklItems .ckl-item').forEach(function(el) {
    var e = el.dataset.responsavel;
    if (e && emails.indexOf(e) === -1) emails.push(e);
  });
  if (!emails.length) { wrap.style.display = 'none'; return; }

  wrap.style.display = 'flex';
  emails.forEach(function(email) {
    var b = document.createElement('button');
    b.type      = 'button';
    b.className = 'btn btn-ghost ckl-aviso-btn';
    b.textContent = 'Avisar ' + nomeDeUsuario(email).split(' ')[0];
    b.title     = 'Enviar e-mail para ' + email + ' com os itens atribuídos a ele nesta tarefa';
    b.addEventListener('click', function() { avisarColega(email, b); });
    wrap.appendChild(b);
  });
}

function avisarColega(email, btn) {
  var original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  chamarAPI({ acao: 'avisarMarcadoChecklist', dados: { idTarefa: String(modalTarefaAtual.ID), email: email } }, function(d) {
    if (d.erro) {
      btn.disabled = false;
      btn.textContent = original;
      toast('Erro: ' + d.erro, true);
      return;
    }
    btn.textContent = 'Aviso enviado ✓';
    toast('Aviso enviado para ' + nomeDeUsuario(email) + '.', false, true);
  });
}
```

- [ ] **Step 6: Chamar `renderAvisosCkl()` de `atualizarProgressoCkl()`**

`atualizarProgressoCkl()` já é chamada ao abrir o modal, ao adicionar item, ao remover item e ao marcar checkbox. Colocar a chamada na **primeira linha** cobre todos esses caminhos, inclusive o retorno antecipado de checklist vazia:

```js
function atualizarProgressoCkl() {
  renderAvisosCkl();
  var itens  = document.querySelectorAll('#cklItems .ckl-item');
  var progEl = document.getElementById('cklProgress');
  if (!itens.length) { progEl.style.display = 'none'; return; }
```

(O `change` do select já chama `renderAvisosCkl()` diretamente, implementado na Task 2.)

- [ ] **Step 7: Ensinar o mock a responder a rota**

No bloco de mock, no `switch (acao)`, após o `case 'adicionarInteracao'`:

```js
      case 'avisarMarcadoChecklist': resp = { sucesso: true, itens: 1 }; break;
```

- [ ] **Step 8: Rodar a verificação — todos passam**

Recarregue a página e rode as duas partes do script do Step 1.

Esperado: 8 linhas com `passou: true`. Console sem erros.

- [ ] **Step 9: Commit**

```bash
git add tarefas-shadcn.html
git commit -m "feat: botão de avisar por colega marcado na checklist

Um botão por pessoa marcada, abaixo da barra de progresso, enviando um e-mail
com todos os itens daquela pessoa naquela tarefa. Rótulo com o primeiro nome e
'Aviso enviado ✓' após o envio, estado só de sessão.

O aviso é manual por decisão de design: notificação automática foi o que
derrubou a feature em julho. Em tarefa nova os botões não aparecem, porque sem
ID salvo não há tarefa para referenciar."
```

---

### Task 4: Verificação integrada e documentação

**Files:**
- Modify: `CLAUDE.md` (tabela de endpoints), `README.md` (feature), `docs/HANDOFF.md` (estado + pendência de teste real)

**Interfaces:**
- Consumes: tudo das Tasks 1-3
- Produces: nenhum código novo

- [ ] **Step 1: Rodar a verificação integrada no preview**

Página recarregada, mock ativo. Rode:

```js
(function(){
  var res=[]; function ok(n,c,d){res.push({teste:n,passou:!!c,detalhe:d});}
  // Cenário do Guilherme: Usuário Padrão, tarefa criada por outra pessoa
  currentUser='elisa.nogueira@exemplo.test'; currentUserPodeExcluir=false; currentUserIsAdmin=false;
  var t3 = tarefas.filter(function(x){return String(x.ID)==='3';})[0];
  abrirModal(t3,'view');

  var sels=[].slice.call(document.querySelectorAll('#cklItems .ckl-responsavel-sel'));
  ok('1 usuário padrão pode atribuir em view', sels.length===3 && sels.every(function(s){return !s.disabled;}), '');
  ok('2 checkbox segue ativo (não regrediu)',
     [].slice.call(document.querySelectorAll('#cklItems input[type=checkbox]')).every(function(c){return !c.disabled;}), '');
  ok('3 x segue travado',
     [].slice.call(document.querySelectorAll('.ckl-delete')).every(function(b){return b.disabled;}), '');

  var chamadas=[]; var orig=window.chamarAPI;
  window.chamarAPI=function(p,cb){chamadas.push(p.acao); return orig(p,cb);};
  sels[2].value='elisa.nogueira@exemplo.test'; sels[2].dispatchEvent(new Event('change'));
  ok('4 atribuir salva na hora', chamadas.filter(function(a){return a==='salvarChecklist';}).length===1,
     'chamadas: '+chamadas);
  ok('5 botão de aviso apareceu para a nova marcação',
     document.getElementById('cklAvisos').textContent.indexOf('Elisa')>-1,
     'avisos: '+document.getElementById('cklAvisos').textContent);
  window.chamarAPI=orig;
  window.__res=res; window.__orig=orig;
  return res;
})()
```

Em seguida, o caminho de erro (gravação recusada deve reverter a marcação):

```js
(function(){
  var res=window.__res; function ok(n,c,d){res.push({teste:n,passou:!!c,detalhe:d});}
  var t3 = tarefas.filter(function(x){return String(x.ID)==='3';})[0];
  var orig=window.__orig;
  window.chamarAPI=function(p,cb){
    if (p.acao==='salvarChecklist'){ setTimeout(function(){ cb({erro:'Sem permissão para alterar esta checklist.'}); },20); return; }
    return orig(p,cb);
  };
  abrirModal(t3,'view');
  var s=document.querySelectorAll('#cklItems .ckl-responsavel-sel')[1];
  window.__antes = s.value;
  s.value='diego.almeida@exemplo.test'; s.dispatchEvent(new Event('change'));
  window.__res=res;
  return 'aguardando o erro…';
})()
```

E a conferência da reversão:

```js
(function(){
  var res=window.__res; function ok(n,c,d){res.push({teste:n,passou:!!c,detalhe:d});}
  var s=document.querySelectorAll('#cklItems .ckl-responsavel-sel')[1];
  ok('6 erro reverte a marcação', s.value===window.__antes, 'antes: '+window.__antes+' | agora: '+s.value);
  ok('7 erro avisa o usuário', document.getElementById('toast').className.indexOf('erro')>-1,
     'toast: '+document.getElementById('toast').textContent);
  window.chamarAPI=window.__orig;
  return res;
})()
```

Esperado: 7 linhas com `passou: true`. Console sem erros (`read_console_messages` com `onlyErrors: true`).

- [ ] **Step 2: Atualizar a tabela de endpoints no `CLAUDE.md`**

Depois da linha de `salvarChecklist`:

```markdown
| `avisarMarcadoChecklist` | `avisarMarcadoChecklist(dados)` | Envia e-mail manual ao colega marcado, com os itens dele naquela tarefa (valida visibilidade, domínio e se ele está marcado) |
```

- [ ] **Step 3: Atualizar o `README.md`**

Na seção de funcionalidades do checklist, acrescente:

```markdown
- **Atribuição de itens**: cada item de checklist pode ser atribuído a um colega
  (`<select>` no item, ativo também em modo visualização). Atribuir **dá a essa pessoa
  acesso de leitura à tarefa**, porque a regra de visibilidade considera quem está marcado.
  O aviso por e-mail é **manual**, pelo botão "Avisar <Nome>" abaixo da checklist — nunca
  automático, para não renotificar a cada salvamento.
```

- [ ] **Step 4: Atualizar o `docs/HANDOFF.md`**

Acrescente no topo da seção "Onde estamos", como bloco mais recente:

```markdown
### Último bloco — marcação de colegas em itens de checklist

Feature reativada (estava desligada desde 15/07 pelo commit `0a08c3a`, por spam de e-mail).
Spec: [`docs/superpowers/specs/2026-08-03-marcacao-colegas-checklist-design.md`](superpowers/specs/2026-08-03-marcacao-colegas-checklist-design.md).

Cada item tem um `<select>` de colega, ativo em visualização e em edição; em visualização
salva na hora. Abaixo da checklist, um botão por pessoa marcada envia um e-mail com os itens
dela. **Nenhuma notificação automática** — a antiga renotificava todos a cada save, e hoje
seria pior porque o save ocorre a cada clique de checkbox. A flag `CHECKLIST_MARCACAO_ATIVA`
e o código dela saíram.

⚠️ **Lembrete de comportamento:** atribuir um item a alguém **dá a essa pessoa acesso de
leitura à tarefa inteira** (`idsTarefasVisiveis` trata "marcado em item" como critério).

**Pendente de teste real** (o mock não exercita o backend): atribuir um item a si mesmo,
clicar em avisar e conferir se o e-mail chega pelo `taskcenter@`; depois confirmar que avisar
um e-mail não marcado é recusado.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md docs/HANDOFF.md
git commit -m "docs: marcação de colegas em itens de checklist

Endpoint novo na tabela do CLAUDE.md, comportamento no README (incluindo que
atribuir dá acesso de leitura à tarefa) e handoff com a pendência de teste real
do e-mail, que o mock não cobre."
```

- [ ] **Step 6: Enviar ao Apps Script**

```bash
npx clasp push -f
```

Esperado: `Pushed 5 files`.

Depois disso, avisar o Aurélio para publicar a Nova versão (editar a implantação existente, nunca criar nova) e informar as duas verificações que só rodam em produção:

1. atribuir um item a si mesmo → clicar em avisar → e-mail chega de `taskcenter@` com o item listado;
2. tentar avisar alguém que não está marcado → recusa com "Este colega não está marcado em nenhum item desta tarefa."

## Self-Review

**Cobertura do spec:**

| Requisito do spec | Task |
|---|---|
| Select nativo no item, opção vazia, valor atual | 2 |
| Chip somente-leitura removido, CSS junto | 2 |
| Ativo em visualização, salvando na hora | 2 |
| Em edição entra na detecção de mudanças | 2 (via `serializarCkl`, já existente) |
| `×` travado em view, select não | 2 |
| Botão por pessoa, primeiro nome, "Aviso enviado ✓" | 3 |
| Desmarcar remove o botão | 3 |
| Sem botões em tarefa nova | 3 |
| Rota com 3 validações | 1 |
| Nome da tarefa lido da planilha | 1 |
| Anti-repetição de 60 s | 1 |
| Log de quem avisou quem | 1 |
| Remoção da notificação automática e da flag | 1 |
| Validação de domínio do colega marcado | 1 |
| Assunto do e-mail e lista de itens | 1 |
| Efeito de visibilidade documentado | 4 |
| Teste real pós-deploy | 4 |

Sem lacunas.

**Placeholders:** nenhum "TBD"/"TODO"; todo passo que muda código traz o código; todo comando traz a saída esperada.

**Consistência de tipos e nomes:** `renderAvisosCkl()` (sem argumentos) é chamada na Task 2 com guarda `typeof` — porque a Task 2 pode ser revisada antes da Task 3 existir — e definida na Task 3; `avisarColega(email, btn)` é usada e definida na Task 3; `notificarMarcadoChecklist(email, nomeTarefa, itens, quemAvisou)` é definida e chamada na Task 1 com a mesma ordem de parâmetros; `avisarMarcadoChecklist` recebe `{idTarefa, email}` no front (Task 3) e leia `dados.idTarefa`/`dados.email` no backend (Task 1); `dataset.responsavel` é a fonte de verdade tanto para `serializarCkl()` (existente) quanto para `renderAvisosCkl()`.
