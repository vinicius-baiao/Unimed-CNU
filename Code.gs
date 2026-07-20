// ============================================================
//  Tarefas CNU — Backend (Apps Script)
// ============================================================

var SHEET_ID        = '1veZ4jj9zrs6TeQxPl_NrMUxelqITRSlAmwFH_B_wt_w';
var ABA_TAREFAS      = 'Tarefas';
var ABA_LOG          = 'Log';
var ABA_CHECKLISTS   = 'Checklists';
var ABA_CKL_STATUS   = 'Checklist_Status';
var ABA_INTERACOES   = 'Interações';
var ABA_USUARIOS     = 'Usuários';
var ABA_ARQUIVO      = 'Arquivo';
var ABA_PROJETOS     = 'Projetos';
var EMAIL_REPORTE    = 'aurelio.pereira.ext@unimedcnu.coop.br';

// Remetente das notificações. Precisa estar configurado como "Enviar e-mail como"
// (Gmail → Config. → Contas → Enviar e-mail como) na conta que executa o script.
// Se não for um alias válido, o envio cai no remetente padrão (mantendo o nome).
var EMAIL_REMETENTE  = 'taskcenter@unimedcnu.coop.br';
var EMAIL_NOME       = 'Tarefas CNU';

// Arquivo HTML servido pelo doGet (sem a extensão .html).
// Trocar para 'tarefas' para voltar ao layout clássico.
var HTML_FILE        = 'tarefas-shadcn';

// Resumo diário por e-mail (relatorioDiario). Desativado no MVP.
// Além deste flag, remova/desative o gatilho no Apps Script → Gatilhos.
var RESUMO_DIARIO_ATIVO = false;

// Marcação de colegas em itens de checklist (e o e-mail de notificação).
// Desativado por ora — o front não oferece mais a UI; marcações antigas
// são preservadas nos dados e seguem valendo para visibilidade.
var CHECKLIST_MARCACAO_ATIVA = false;

// Piloto: restringe o acesso aos e-mails abaixo. Desligar com PILOTO_ATIVO = false.
var PILOTO_ATIVO  = true;
var EMAILS_PILOTO = [
  'aurelio.pereira.ext@unimedcnu.coop.br',
  'jacqueline.wahrhaftig.ext@unimedcnu.coop.br',
  'guilherme.silva.ext@unimedcnu.coop.br',
  'thiago.viana.ext@unimedcnu.coop.br'
];
function acessoPermitido(email) {
  if (!PILOTO_ATIVO) return true;
  if (!email) return true; // fail-open se o e-mail não resolver (evita lockout acidental)
  return EMAILS_PILOTO.indexOf(String(email).toLowerCase()) !== -1;
}

// Índices das colunas (base 0) na aba Tarefas
var COL = {
  ID:          0,
  TAREFA:      1,
  PROJETO:     2,
  RESPONSAVEL: 3,
  PRAZO:       4,
  STATUS:      5,
  PRIORIDADE:  6,
  CRIADO_POR:  7,
  DATA_CRIACAO:8,
  OBSERVACOES: 9,
  ATIVO:       10,
  EVENT_ID:    11
};

// ── Roteador principal ────────────────────────────────────────
function doGet(e) {
  var acao     = e.parameter.acao     || '';
  var callback = /^[a-zA-Z_]\w{0,80}$/.test(e.parameter.callback || '') ? e.parameter.callback : '';

  // Sem ação → serve o frontend HTML (permite embed no Google Sites)
  if (!acao) {
    if (!acessoPermitido(Session.getActiveUser().getEmail())) {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:system-ui,Arial,sans-serif;max-width:460px;margin:64px auto;text-align:center;color:#15211f">'
        + '<h2 style="color:#004e4c;margin:0 0 8px">Acesso restrito</h2>'
        + '<p style="color:#5b6b68">Este piloto está liberado apenas para usuários autorizados. '
        + 'Fale com o Aurélio para solicitar acesso.</p></div>')
        .setTitle('Acesso restrito — Gestão de Tarefas CNU');
    }
    return HtmlService.createHtmlOutputFromFile(HTML_FILE)
      .setTitle('Gestão de Tarefas — Rede Ambulatorial CNU')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var resultado;
  try {
    var dados = e.parameter.dados ? JSON.parse(e.parameter.dados) : {};
    if (!acessoPermitido(Session.getActiveUser().getEmail())) {
      resultado = { erro: 'Acesso restrito ao piloto.' };
    } else {
    switch (acao) {
      case 'listarTarefas':          resultado = listarTarefas();               break;
      case 'criarTarefa':            resultado = criarTarefa(dados);            break;
      case 'atualizarTarefa':        resultado = atualizarTarefa(dados);        break;
      case 'excluirTarefa':          resultado = excluirTarefa(dados);          break;
      case 'listarTemplates':        resultado = listarTemplates();             break;
      case 'listarChecklist_Status': resultado = listarChecklist_Status();      break;
      case 'salvarChecklist':        resultado = salvarChecklist(dados);        break;
      case 'listarInteracoes':      resultado = listarInteracoes(dados);       break;
      case 'adicionarInteracao':    resultado = adicionarInteracao(dados);     break;
      case 'listarUsuarios':        resultado = listarUsuarios();              break;
      case 'listarProjetos':        resultado = listarProjetos();              break;
      case 'criarProjeto':          resultado = criarProjeto(dados);           break;
      case 'atualizarProjeto':      resultado = atualizarProjeto(dados);       break;
      case 'arquivarProjeto':       resultado = arquivarProjeto(dados);        break;
      case 'getUsuario': {
        var _u = Session.getActiveUser().getEmail();
        var _p = getPerfil(_u);
        resultado = { email: _u, perfil: _p, admin: _p === 'Admin', podeExcluir: _p === 'Admin' || _p === 'Gestor' };
        break;
      }
      default:
        resultado = { erro: 'Ação desconhecida: ' + acao };
    }
    }
  } catch (err) {
    resultado = { erro: err.message };
  }

  var json = JSON.stringify(resultado);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Projetos ──────────────────────────────────────────────────
var COL_PROJ = { ID: 0, NOME: 1, DESCRICAO: 2, COR: 3, ATIVO: 4 };

function getOrCreateProjetosSheet() {
  var ss    = _ss || (_ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet());
  var sheet = ss.getSheetByName(ABA_PROJETOS);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_PROJETOS);
    var hProj = ['ID','Nome','Descrição','Cor','Ativo'];
    sheet.getRange(1, 1, 1, hProj.length).setValues([hProj]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, hProj.length, 100);
  }
  return sheet;
}

function proximoIdProjeto() {
  var sheet  = getOrCreateProjetosSheet();
  var ultima = sheet.getLastRow();
  if (ultima <= 1) return 1;
  var lastId = parseInt(sheet.getRange(ultima, 1).getValue(), 10);
  return (isNaN(lastId) ? ultima - 1 : lastId) + 1;
}

function listarProjetos() {
  var sheet = getOrCreateProjetosSheet();
  var rows  = sheet.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][COL_PROJ.NOME]) continue;
    if (rows[i][COL_PROJ.ATIVO] === false || rows[i][COL_PROJ.ATIVO] === 'false') continue;
    lista.push({
      id:       rows[i][COL_PROJ.ID],
      nome:     String(rows[i][COL_PROJ.NOME]),
      descricao: String(rows[i][COL_PROJ.DESCRICAO] || ''),
      cor:      String(rows[i][COL_PROJ.COR] || '#64748b')
    });
  }
  return { projetos: lista };
}

// Cor vai direto para atributos style no frontend — restringe a hex.
function corSegura(cor) {
  return /^#[0-9a-fA-F]{6}$/.test(String(cor || '')) ? cor : '#64748b';
}

function criarProjeto(dados) {
  var editor = Session.getActiveUser().getEmail();
  if (!podeExcluir(editor)) return { erro: 'Apenas Admin ou Gestor pode criar projetos.' };
  if (!dados.nome || !String(dados.nome).trim()) return { erro: 'Nome do projeto é obrigatório.' };
  if (String(dados.nome).length > 120) return { erro: 'Nome do projeto excede 120 caracteres.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  var sheet = getOrCreateProjetosSheet();
  var id    = proximoIdProjeto();
  sheet.appendRow([id, String(dados.nome).trim(), dados.descricao || '', corSegura(dados.cor), true]);
  gravarLog('CRIAR_PROJETO', 'Nome', '', dados.nome);
  lock.releaseLock();
  return { sucesso: true, id: id };
}

function atualizarProjeto(dados) {
  if (!dados.id) return { erro: 'ID do projeto é obrigatório.' };
  var editor = Session.getActiveUser().getEmail();
  if (!podeExcluir(editor)) return { erro: 'Sem permissão.' };

  var sheet = getOrCreateProjetosSheet();
  var rows  = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL_PROJ.ID]) !== String(dados.id)) continue;
    var row = rows[i].slice();
    if (dados.nome      !== undefined) row[COL_PROJ.NOME]     = dados.nome;
    if (dados.descricao !== undefined) row[COL_PROJ.DESCRICAO] = dados.descricao;
    if (dados.cor       !== undefined) row[COL_PROJ.COR]      = corSegura(dados.cor);
    sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
    gravarLog('ATUALIZAR_PROJETO', 'ID', dados.id, dados.nome || '');
    return { sucesso: true };
  }
  return { erro: 'Projeto não encontrado.' };
}

function arquivarProjeto(dados) {
  if (!dados.id) return { erro: 'ID do projeto é obrigatório.' };
  var editor = Session.getActiveUser().getEmail();
  if (!podeExcluir(editor)) return { erro: 'Sem permissão.' };

  var sheet = getOrCreateProjetosSheet();
  var rows  = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL_PROJ.ID]) !== String(dados.id)) continue;
    sheet.getRange(i + 1, COL_PROJ.ATIVO + 1).setValue(false);
    gravarLog('ARQUIVAR_PROJETO', 'ID', dados.id, 'inativo');
    return { sucesso: true };
  }
  return { erro: 'Projeto não encontrado.' };
}

// ── Usuários / Admin ──────────────────────────────────────────
// Mapa email→perfil com cache de 5 min (CacheService). Evita varrer a aba
// Usuários a cada requisição — com todos os acessos executando como o
// deployer, a quota de execução é COMPARTILHADA entre os usuários.
// Efeito colateral aceito: mudança de perfil demora até 5 min para valer.
var CACHE_PERFIS_KEY = 'perfis_v1';
var CACHE_PERFIS_SEG = 300;

function mapaPerfis() {
  var cache = CacheService.getScriptCache();
  try {
    var raw = cache.get(CACHE_PERFIS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* cache indisponível: cai para a planilha */ }

  var mapa = {};
  var sheet = getSheet(ABA_USUARIOS);
  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][1]) mapa[String(rows[i][1]).trim().toLowerCase()] = String(rows[i][2] || '');
    }
  }
  try { cache.put(CACHE_PERFIS_KEY, JSON.stringify(mapa), CACHE_PERFIS_SEG); } catch (e) {}
  return mapa;
}

function getPerfil(email) {
  if (!email) return '';
  return mapaPerfis()[String(email).trim().toLowerCase()] || '';
}

function isAdmin(email) {
  return getPerfil(email) === 'Admin';
}

function podeExcluir(email) {
  var p = getPerfil(email);
  return p === 'Admin' || p === 'Gestor';
}

function listarUsuarios() {
  var sheet = getSheet(ABA_USUARIOS);
  if (!sheet) return { usuarios: [] };
  var rows = sheet.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0] && !rows[i][1]) continue;
    lista.push({ nome: String(rows[i][0]), email: String(rows[i][1]), perfil: String(rows[i][2]), unidade: String(rows[i][3] || ''), cargo: String(rows[i][4] || '') });
  }
  return { usuarios: lista };
}

// ── Helpers de planilha ───────────────────────────────────────
var _ss = null; // cache da instância — evita openById() repetido por request

function getSheet(nome) {
  if (!_ss) {
    _ss = SHEET_ID
      ? SpreadsheetApp.openById(SHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
  }
  return _ss.getSheetByName(nome);
}

function proximoId() {
  var sheet  = getSheet(ABA_TAREFAS);
  var ultima = sheet.getLastRow();
  if (ultima <= 1) return 1;
  var lastId = parseInt(sheet.getRange(ultima, COL.ID + 1).getValue(), 10);
  return (isNaN(lastId) ? ultima - 1 : lastId) + 1;
}

function gravarLog(acao, campo, anterior, novo) {
  gravarLogs([[acao, campo, anterior, novo]]);
}

function gravarLogs(entradas) {
  if (!entradas || !entradas.length) return;
  var log    = getSheet(ABA_LOG);
  var editor = Session.getActiveUser().getEmail();
  var agora  = new Date();
  // appendRow é atômico: execuções simultâneas não sobrescrevem linhas
  // umas das outras (o setValues em posição calculada sobrescrevia).
  // O ID pode duplicar sob concorrência — cosmético, sem perda de dados.
  entradas.forEach(function(e) {
    log.appendRow([log.getLastRow(), agora, editor, e[0], e[1], e[2], e[3]]);
  });
}

// ── Visibilidade por perfil ───────────────────────────────────
// Admin/Gestor veem tudo (retorna null = sem restrição).
// Usuário Padrão vê apenas tarefas onde: é o responsável, é o criador,
// ou está marcado como responsável em algum item de checklist.
function idsTarefasVisiveis(email, rowsTarefas) {
  if (!email || podeExcluir(email)) return null;
  var alvo = String(email).trim().toLowerCase();

  // Tarefas onde o usuário está marcado em item de checklist (col. 7 = Responsavel)
  var marcado = {};
  var shC = getSheet(ABA_CKL_STATUS);
  if (shC) {
    var rowsC = shC.getDataRange().getValues();
    for (var i = 1; i < rowsC.length; i++) {
      if (String(rowsC[i][7] || '').trim().toLowerCase() === alvo) {
        marcado[String(rowsC[i][1])] = true;
      }
    }
  }

  var visiveis = {};
  var rowsT = rowsTarefas || getSheet(ABA_TAREFAS).getDataRange().getValues();
  for (var j = 1; j < rowsT.length; j++) {
    var id      = String(rowsT[j][COL.ID]);
    var resp    = String(rowsT[j][COL.RESPONSAVEL] || '').trim().toLowerCase();
    var criador = String(rowsT[j][COL.CRIADO_POR]  || '').trim().toLowerCase();
    if (resp === alvo || criador === alvo || marcado[id]) visiveis[id] = true;
  }
  return visiveis;
}

// Datas "YYYY-MM-DD" vindas do <input type=date> devem ser interpretadas no
// fuso do script (America/Sao_Paulo). new Date('YYYY-MM-DD') trata como UTC
// e grava 21:00 do dia anterior — quebrando exibição, lembrete D-1 e Calendar.
function parsePrazoLocal(val) {
  var m = String(val || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return new Date(val);
}

// ── listarTarefas ─────────────────────────────────────────────
function listarTarefas() {
  var sheet  = getSheet(ABA_TAREFAS);
  var dados  = sheet.getDataRange().getValues();
  var header = dados[0];
  var lista  = [];
  var visiveis = idsTarefasVisiveis(Session.getActiveUser().getEmail(), dados);

  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    if (linha[COL.ATIVO] === false || linha[COL.ATIVO] === 'false') continue;
    if (visiveis && !visiveis[String(linha[COL.ID])]) continue;
    var obj = {};
    header.forEach(function(col, idx) { obj[col] = linha[idx]; });
    lista.push(obj);
  }
  return { tarefas: lista };
}

// ── Validação de entrada ──────────────────────────────────────
var STATUS_VALIDOS    = ['Backlog', 'A fazer', 'Em andamento', 'Bloqueado', 'Concluído'];
var PRIORIDADE_VALIDA = ['Crítica', 'Alta', 'Média', 'Baixa'];
var DOMINIOS_PERMITIDOS = ['@unimedcnu.coop.br', '@unimednacional.coop.br'];

function validarTarefa(dados, criando) {
  if (criando && (!dados.tarefa || !String(dados.tarefa).trim())) return 'Campo "tarefa" é obrigatório.';
  if (dados.tarefa !== undefined && String(dados.tarefa).length > 500) return 'Campo "tarefa" excede 500 caracteres.';
  if (dados.status !== undefined && STATUS_VALIDOS.indexOf(dados.status) === -1) return 'Status inválido: ' + dados.status;
  if (dados.prioridade !== undefined && PRIORIDADE_VALIDA.indexOf(dados.prioridade) === -1) return 'Prioridade inválida: ' + dados.prioridade;
  if (dados.responsavel) {
    var email = String(dados.responsavel).trim().toLowerCase();
    // sufixo real, não indexOf — "x@gmail.com?y=@unimedcnu.coop.br" não passa
    var dominioOk = DOMINIOS_PERMITIDOS.some(function(d) { return email.slice(-d.length) === d; });
    if (!dominioOk) return 'Responsável deve ter e-mail @unimedcnu.coop.br ou @unimednacional.coop.br';
  }
  if (dados.observacoes && String(dados.observacoes).length > 2000) return 'Campo "observações" excede 2000 caracteres.';
  return null;
}

// ── criarTarefa ───────────────────────────────────────────────
function criarTarefa(dados) {
  var erroValidacao = validarTarefa(dados, true);
  if (erroValidacao) return { erro: erroValidacao };

  // Lock garante que criações simultâneas não gerem IDs duplicados
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  var sheet = getSheet(ABA_TAREFAS);
  var id    = proximoId();
  var agora = new Date();
  var criador = dados.criado_por || Session.getActiveUser().getEmail();

  var prazo = dados.prazo ? parsePrazoLocal(dados.prazo) : '';

  var eventId = '';
  if (dados.responsavel) {
    try { notificarResponsavel(dados, 'criacao'); }              catch(e) { Logger.log('Email erro: ' + e.message); }
    try { eventId = criarEventoCalendar(dados, prazo) || ''; }  catch(e) { Logger.log('Calendar erro: ' + e.message); }
  }

  sheet.appendRow([
    id,
    dados.tarefa      || '',
    dados.projeto     || '',
    dados.responsavel || '',
    prazo,
    dados.status      || 'A fazer',
    dados.prioridade  || 'Média',
    criador,
    agora,
    dados.observacoes || '',
    true,
    eventId
  ]);

  gravarLog('CRIAR', 'Tarefa', '', dados.tarefa);
  lock.releaseLock();

  return { sucesso: true, id: id };
}

// ── atualizarTarefa ───────────────────────────────────────────
function atualizarTarefa(dados) {
  if (!dados.id) return { erro: 'ID da tarefa é obrigatório.' };
  var erroValidacao = validarTarefa(dados);
  if (erroValidacao) return { erro: erroValidacao };

  var sheet  = getSheet(ABA_TAREFAS);
  var linhas = sheet.getDataRange().getValues();

  // Usuário Padrão só pode alterar tarefas que enxerga (IDs são sequenciais
  // e adivinháveis; sem esta checagem a visibilidade seria contornável).
  var editorEmail = Session.getActiveUser().getEmail();
  var visiveis = idsTarefasVisiveis(editorEmail, linhas);
  if (visiveis && !visiveis[String(dados.id)]) {
    return { erro: 'Tarefa não encontrada: ' + dados.id };
  }

  for (var i = 1; i < linhas.length; i++) {
    if (String(linhas[i][COL.ID]) !== String(dados.id)) continue;

    // ── Verificação de permissão ──────────────────────────────
    var editor  = String(editorEmail).trim().toLowerCase();
    var criador = String(linhas[i][COL.CRIADO_POR] || '').trim().toLowerCase();
    var eCriador = editor === criador;
    var admin    = podeExcluir(editorEmail); // Admin + Gestor
    // Todos podem editar; apenas o prazo é restrito ao criador ou Admin/Gestor.
    var prazoAtualStr = linhas[i][COL.PRAZO] ? new Date(linhas[i][COL.PRAZO]).toISOString().slice(0,10) : '';
    if (!admin && !eCriador && dados.prazo !== undefined && dados.prazo !== '' && dados.prazo !== prazoAtualStr) {
      return { erro: 'Apenas o criador ou um Admin/Gestor pode alterar o prazo.' };
    }

    var statusAnterior  = String(linhas[i][COL.STATUS] || '');
    var camposEditaveis = ['tarefa','projeto','responsavel','prazo','status','prioridade','observacoes'];
    var colMap = {
      tarefa:      COL.TAREFA,
      projeto:     COL.PROJETO,
      responsavel: COL.RESPONSAVEL,
      prazo:       COL.PRAZO,
      status:      COL.STATUS,
      prioridade:  COL.PRIORIDADE,
      observacoes: COL.OBSERVACOES
    };

    var responsavelAnterior = linhas[i][COL.RESPONSAVEL];

    // Escreve APENAS as células dos campos enviados. Regravar a linha inteira
    // clobberia edições simultâneas de outros usuários com valores velhos
    // lidos no início desta execução (last-write-wins na linha toda).
    var logEntradas = [];
    camposEditaveis.forEach(function(campo) {
      if (dados[campo] === undefined) return;
      var anterior = linhas[i][colMap[campo]];
      var novo     = campo === 'prazo' ? (dados[campo] ? parsePrazoLocal(dados[campo]) : '') : dados[campo];
      // Grava só o que de fato mudou: menos writes, menos linhas de Log
      // (o front envia os 7 campos mesmo quando 1 mudou).
      var aCmp = anterior instanceof Date ? anterior.getTime() : String(anterior == null ? '' : anterior);
      var nCmp = novo     instanceof Date ? novo.getTime()     : String(novo     == null ? '' : novo);
      if (aCmp === nCmp) return;
      sheet.getRange(i + 1, colMap[campo] + 1).setValue(novo);
      logEntradas.push(['ATUALIZAR', campo, anterior, novo]);
    });
    gravarLogs(logEntradas);

    if (dados.responsavel && dados.responsavel !== responsavelAnterior) {
      // Falha de e-mail não pode derrubar a resposta (a atualização já foi gravada)
      try { notificarResponsavel(dados, 'reatribuicao'); } catch (e) { Logger.log('Email erro: ' + e.message); }
    }

    // Registrar mudança de status como interação automática
    if (dados.status !== undefined && dados.status !== statusAnterior) {
      var shtI = getSheet(ABA_INTERACOES);
      if (shtI) {
        var maxI = shtI.getLastRow(); // O(1) — não escaneia tudo
        shtI.appendRow([maxI + 1, dados.id, new Date(), editor,
          'Atualização de status', '"' + statusAnterior + '" → "' + dados.status + '"']);
      }
    }

    return { sucesso: true };
  }

  return { erro: 'Tarefa não encontrada: ' + dados.id };
}

// ── excluirTarefa (soft delete) ───────────────────────────────
function excluirTarefa(dados) {
  var sheet    = getSheet(ABA_TAREFAS);
  var linhas   = sheet.getDataRange().getValues();
  var editor   = Session.getActiveUser().getEmail();
  var encontrou = false;
  var calendarFeito = false;

  for (var i = 1; i < linhas.length; i++) {
    if (String(linhas[i][COL.ID]) !== String(dados.id)) continue;
    if (linhas[i][COL.ATIVO] === false) continue; // já inativo, pula

    var criador = String(linhas[i][COL.CRIADO_POR] || '').trim().toLowerCase();
    if (String(editor).trim().toLowerCase() !== criador && !podeExcluir(editor)) {
      return { erro: 'Sem permissão para excluir esta tarefa.' };
    }

    // Remove evento do Calendar apenas uma vez (primeira ocorrência)
    if (!calendarFeito) {
      var eventId = String(linhas[i][COL.EVENT_ID] || '');
      if (eventId) {
        try {
          var ev = CalendarApp.getEventById(eventId);
          if (ev) ev.deleteEvent();
        } catch(e) { Logger.log('Calendar delete erro: ' + e.message); }
      }
      calendarFeito = true;
    }

    sheet.getRange(i + 1, COL.ATIVO + 1).setValue(false);
    encontrou = true;
  }

  if (!encontrou) return { erro: 'Tarefa não encontrada: ' + dados.id };
  gravarLog('EXCLUIR', 'ID', dados.id, 'inativo');
  return { sucesso: true };
}

// ── listarTemplates ───────────────────────────────────────────
function listarTemplates() {
  var sheet = getSheet(ABA_CHECKLISTS);
  if (!sheet) return { templates: [] };
  var dados = sheet.getDataRange().getValues();
  var mapa  = {};

  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var idTpl = String(linha[0]);
    var nome  = linha[1];
    var item  = linha[2];
    var ordem = linha[3];
    if (!idTpl || !nome || !item) continue;
    if (!mapa[idTpl]) mapa[idTpl] = { id: idTpl, nome: nome, itens: [] };
    mapa[idTpl].itens.push({ item: item, ordem: ordem });
  }

  var lista = Object.keys(mapa).map(function(k) { return mapa[k]; });
  lista.forEach(function(t) {
    t.itens.sort(function(a, b) { return (a.ordem || 0) - (b.ordem || 0); });
  });
  return { templates: lista };
}

// ── listarChecklist_Status ────────────────────────────────────
function listarChecklist_Status() {
  var sheetC = getSheet(ABA_CKL_STATUS);
  if (!sheetC) return { itens: [] };

  // Montar conjunto de IDs de tarefas ativas para filtrar órfãos
  var sheetT = getSheet(ABA_TAREFAS);
  var idsAtivos = {};
  if (sheetT) {
    var rowsT = sheetT.getDataRange().getValues();
    for (var t = 1; t < rowsT.length; t++) {
      if (rowsT[t][COL.ATIVO] !== false && rowsT[t][COL.ATIVO] !== 'false') {
        idsAtivos[String(rowsT[t][COL.ID])] = true;
      }
    }
  }

  var dados  = sheetC.getDataRange().getValues();
  var header = dados[0];
  var lista  = [];
  var visiveis = idsTarefasVisiveis(Session.getActiveUser().getEmail());

  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    if (!linha[0] && !linha[1]) continue;
    if (!idsAtivos[String(linha[1])]) continue; // ignora itens de tarefas excluídas/arquivadas
    if (visiveis && !visiveis[String(linha[1])]) continue; // restrição de visibilidade por perfil
    var obj = {};
    header.forEach(function(col, idx) { obj[col] = linha[idx]; });
    lista.push(obj);
  }
  return { itens: lista };
}

// ── salvarChecklist ───────────────────────────────────────────
// Substitui completamente os itens de uma tarefa: remove os antigos e grava os novos.
function salvarChecklist(dados) {
  var sheet    = getSheet(ABA_CKL_STATUS);
  var idTarefa = String(dados.idTarefa);

  // Visibilidade: usuário padrão só altera checklist de tarefa que enxerga
  var visiveis = idsTarefasVisiveis(Session.getActiveUser().getEmail());
  if (visiveis && !visiveis[idTarefa]) {
    return { erro: 'Sem permissão para alterar esta checklist.' };
  }

  // Limites defensivos (a aba inteira é reescrita — entrada gigante = DoS)
  var itensIn = dados.itens || [];
  if (itensIn.length > 100) return { erro: 'Checklist excede 100 itens.' };
  for (var v = 0; v < itensIn.length; v++) {
    if (String(itensIn[v].item || '').length > 300) return { erro: 'Item de checklist excede 300 caracteres.' };
  }

  // Lock: a gravação reescreve a aba inteira — dois salvamentos simultâneos
  // sem lock perdem os dados de um deles (read-clear-write concorrente).
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {

  var todas    = sheet.getDataRange().getValues();
  var header   = todas[0];

  // Separar linhas de outras tarefas (manter) e calcular max ID
  var manter = [];
  var idMax  = 0;
  for (var i = 1; i < todas.length; i++) {
    if (!todas[i][0] && !todas[i][1]) continue;
    if (String(todas[i][1]) !== idTarefa) manter.push(todas[i]);
    var n = parseInt(todas[i][0], 10);
    if (!isNaN(n) && n > idMax) idMax = n;
  }

  // Montar novas linhas para esta tarefa
  var itens = dados.itens || [];
  var agora = new Date();
  var novas = itens.map(function(it) {
    var concluido = it.concluido === true || it.concluido === 'true';
    idMax++;
    return [idMax, idTarefa, dados.template || '', it.item, it.ordem || 0, concluido, concluido ? agora : '', it.responsavel || ''];
  });

  // Reescrever aba inteira: 3 API calls em vez de N deleteRow + N appendRow
  // Detecta nº de colunas necessário e extende header se a aba tiver schema antigo (7 colunas)
  var numCols = (novas.length > 0) ? novas[0].length : header.length;
  while (header.length < numCols) header.push(header.length === 7 ? 'Responsavel' : '');
  var mantPad = manter.map(function(r) {
    var row = r.slice();
    while (row.length < numCols) row.push('');
    return row;
  });
  var resultado = [header].concat(mantPad).concat(novas);
  sheet.clearContents();
  if (resultado.length > 0) {
    sheet.getRange(1, 1, resultado.length, numCols).setValues(resultado);
  }

  } finally {
    lock.releaseLock(); // solta antes das notificações (e-mail é lento)
  }

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
  return { sucesso: true };
}

function notificarMarcadoChecklist(email, nomeTarefa, idTarefa) {
  var url  = ScriptApp.getService().getUrl();
  var html = '<div style="font-family:Arial,sans-serif;max-width:600px;color:#212529">'
    + '<div style="background:#004e4c;padding:16px 24px;border-radius:8px 8px 0 0">'
    + '<h2 style="color:#fff;margin:0;font-size:16px">[Tarefas CNU] Você foi marcado em uma checklist</h2>'
    + '<p style="color:#a8d5d4;margin:4px 0 0;font-size:12px">Unimed CNU · Rede Ambulatorial</p>'
    + '</div>'
    + '<div style="background:#fff;padding:20px 24px;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px">'
    + '<p style="font-size:14px;margin-top:0">Você foi designado como responsável por um item de checklist na tarefa:</p>'
    + '<p style="font-size:15px;font-weight:600;color:#004e4c">' + escHtml(nomeTarefa) + '</p>'
    + '<a href="' + url + '" style="display:inline-block;background:#004e4c;color:#fff;'
    +   'padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">'
    + 'Abrir Gestão de Tarefas →</a>'
    + '<p style="font-size:11px;color:#adb5bd;margin-top:18px;padding-top:12px;border-top:1px solid #f1f1f1">'
    + 'Unimed CNU · Sistema de Gestão de Tarefas — Rede Ambulatorial</p>'
    + '</div></div>';
  enviarEmail(email, '[Tarefas CNU] Você foi marcado em uma checklist', html);
}

// ── Helpers de segurança ──────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Diagnóstico: selecione esta função no editor, clique em Executar e veja
// o resultado em "Registro de execução". Mostra quais endereços a conta pode
// usar como remetente e se o taskcenter já está autorizado.
function verificarAliases() {
  var aliases = GmailApp.getAliases();
  Logger.log('Conta que executa o script: ' + Session.getEffectiveUser().getEmail());
  Logger.log('Remetentes disponíveis ("Enviar e-mail como"): ' + JSON.stringify(aliases));
  Logger.log('EMAIL_REMETENTE = ' + EMAIL_REMETENTE);
  Logger.log('taskcenter já pode ser usado como remetente? ' + (aliases.indexOf(EMAIL_REMETENTE) !== -1));
}

// Envio centralizado. Usa EMAIL_REMETENTE como remetente quando ele for um
// alias válido ("Send mail as"); caso contrário, usa o remetente padrão da conta.
function enviarEmail(to, subject, htmlBody) {
  try {
    var opts = { htmlBody: htmlBody, name: EMAIL_NOME };
    if (EMAIL_REMETENTE && GmailApp.getAliases().indexOf(EMAIL_REMETENTE) !== -1) {
      opts.from = EMAIL_REMETENTE;
    }
    GmailApp.sendEmail(to, subject, '', opts);
  } catch (e) {
    Logger.log('enviarEmail fallback (' + to + '): ' + e.message);
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: htmlBody, name: EMAIL_NOME });
  }
}

// ── Notificações e Calendar ───────────────────────────────────
function notificarResponsavel(dados, tipo) {
  var assuntos = {
    criacao:      '[Tarefas CNU] Nova tarefa atribuída a você',
    reatribuicao: '[Tarefas CNU] Tarefa reatribuída a você'
  };
  var url = ScriptApp.getService().getUrl();

  var prazoFmt = dados.prazo
    ? new Date(dados.prazo).toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'})
    : '—';

  var html = '<div style="font-family:Arial,sans-serif;max-width:600px;color:#212529">'
    + '<div style="background:#004e4c;padding:16px 24px;border-radius:8px 8px 0 0">'
    + '<h2 style="color:#fff;margin:0;font-size:16px">' + (assuntos[tipo] || assuntos.criacao) + '</h2>'
    + '<p style="color:#a8d5d4;margin:4px 0 0;font-size:12px">Unimed CNU · Rede Ambulatorial</p>'
    + '</div>'
    + '<div style="background:#fff;padding:20px 24px;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px">'
    + '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">'
    + '<tr><td style="padding:7px 0;color:#6c757d;width:110px">Tarefa</td>'
    +     '<td style="padding:7px 0;font-weight:600">' + escHtml(dados.tarefa) + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#6c757d;border-top:1px solid #f1f1f1">Projeto</td>'
    +     '<td style="padding:7px 0;border-top:1px solid #f1f1f1">' + escHtml(dados.projeto || '—') + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#6c757d;border-top:1px solid #f1f1f1">Prazo</td>'
    +     '<td style="padding:7px 0;border-top:1px solid #f1f1f1">' + escHtml(prazoFmt) + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#6c757d;border-top:1px solid #f1f1f1">Prioridade</td>'
    +     '<td style="padding:7px 0;border-top:1px solid #f1f1f1">' + escHtml(dados.prioridade || '—') + '</td></tr>'
    + '</table>'
    + '<a href="' + url + '" style="display:inline-block;background:#004e4c;color:#fff;'
    +   'padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">'
    + 'Abrir Gestão de Tarefas →</a>'
    + '<p style="font-size:11px;color:#adb5bd;margin-top:18px;padding-top:12px;border-top:1px solid #f1f1f1">'
    + 'Unimed CNU · Sistema de Gestão de Tarefas — Rede Ambulatorial</p>'
    + '</div></div>';

  enviarEmail(dados.responsavel, assuntos[tipo] || assuntos.criacao, html);
}

function criarEventoCalendar(dados, prazo) {
  if (!prazo) return null;
  var titulo = '[' + (dados.tarefa || 'Tarefa') + '] — [' + (dados.projeto || '') + ']';
  var evento = CalendarApp.getDefaultCalendar().createAllDayEvent(titulo, prazo);
  if (dados.responsavel) {
    evento.addGuest(dados.responsavel);
  }
  return evento.getId();
}

// ── Setup inicial da planilha ─────────────────────────────────
// Rodar UMA VEZ após criar o Google Sheets.
// Cria abas, cabeçalhos, validações de dados e formatação.
function setup() {
  var ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  // ── Aba Tarefas ──────────────────────────────────────────────
  var tarefas = ss.getSheetByName(ABA_TAREFAS) || ss.insertSheet(ABA_TAREFAS);

  var hTarefas = ['ID','Tarefa','Projeto','Responsável','Prazo','Status',
                  'Prioridade','Criado por','Data criação','Observações','Ativo','Event ID'];
  tarefas.getRange(1, 1, 1, hTarefas.length).setValues([hTarefas])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  tarefas.setFrozenRows(1);

  var larguras = [50, 260, 160, 210, 100, 120, 100, 210, 140, 260, 55, 220];
  larguras.forEach(function(w, i) { tarefas.setColumnWidth(i + 1, w); });

  tarefas.getRange(2, 6, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['A fazer','Em andamento','Bloqueado','Concluído'], true).build());
  tarefas.getRange(2, 7, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Crítica','Alta','Média','Baixa'], true).build());
  tarefas.getRange(2, 11, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE','FALSE'], true).build());

  // ── Aba Log ──────────────────────────────────────────────────
  var log = ss.getSheetByName(ABA_LOG) || ss.insertSheet(ABA_LOG);

  var hLog = ['ID','Data/Hora','Editor','Ação','Campo','Valor Anterior','Valor Novo'];
  log.getRange(1, 1, 1, hLog.length).setValues([hLog])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  log.setFrozenRows(1);

  var largLog = [50, 150, 210, 100, 130, 220, 220];
  largLog.forEach(function(w, i) { log.setColumnWidth(i + 1, w); });

  // ── Aba Checklists (templates) ───────────────────────────────
  var ckl = ss.getSheetByName('Checklists') || ss.insertSheet('Checklists');

  var hCkl = ['ID_Template','Nome_Template','Item','Ordem'];
  ckl.getRange(1, 1, 1, hCkl.length).setValues([hCkl])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  ckl.setFrozenRows(1);
  [80, 200, 300, 60].forEach(function(w, i) { ckl.setColumnWidth(i + 1, w); });

  // ── Aba Checklist_Status (estado por tarefa) ─────────────────
  var cks = ss.getSheetByName('Checklist_Status') || ss.insertSheet('Checklist_Status');

  var hCks = ['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão','Responsavel'];
  cks.getRange(1, 1, 1, hCks.length).setValues([hCks])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  cks.setFrozenRows(1);
  cks.getRange(2, 6, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE','FALSE'], true).build());
  [50, 80, 80, 300, 60, 80, 140, 220].forEach(function(w, i) { cks.setColumnWidth(i + 1, w); });

  // ── Aba Interações ───────────────────────────────────────────
  var inter  = ss.getSheetByName(ABA_INTERACOES) || ss.insertSheet(ABA_INTERACOES);
  var hInter = ['ID','ID_Tarefa','Data/Hora','Editor','Tipo','Conteúdo'];
  inter.getRange(1, 1, 1, hInter.length).setValues([hInter])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  inter.setFrozenRows(1);
  [50, 80, 150, 210, 160, 350].forEach(function(w, i) { inter.setColumnWidth(i + 1, w); });

  // ── Aba Usuários ─────────────────────────────────────────────
  var usu = ss.getSheetByName(ABA_USUARIOS) || ss.insertSheet(ABA_USUARIOS);
  var hUsu = ['Nome', 'Email', 'Perfil', 'Unidade', 'Cargo'];
  usu.getRange(1, 1, 1, hUsu.length).setValues([hUsu])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  usu.setFrozenRows(1);
  usu.getRange(2, 3, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Admin','Gestor','Usuário Padrão'], true).build());
  [220, 280, 140, 260, 240].forEach(function(w, i) { usu.setColumnWidth(i + 1, w); });

  // ── Aba Arquivo ──────────────────────────────────────────────
  var arq = ss.getSheetByName(ABA_ARQUIVO) || ss.insertSheet(ABA_ARQUIVO);
  if (arq.getLastRow() === 0) {
    arq.getRange(1, 1, 1, hTarefas.length).setValues([hTarefas])
      .setBackground('#5f6368').setFontColor('#ffffff').setFontWeight('bold');
    arq.setFrozenRows(1);
    larguras.forEach(function(w, i) { arq.setColumnWidth(i + 1, w); });
  }

  // ── Aba Projetos ─────────────────────────────────────────────
  var proj = ss.getSheetByName(ABA_PROJETOS) || ss.insertSheet(ABA_PROJETOS);
  var hProj = ['ID', 'Nome', 'Descrição', 'Cor', 'Ativo'];
  proj.getRange(1, 1, 1, hProj.length).setValues([hProj])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  proj.setFrozenRows(1);
  proj.getRange(2, 5, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE','FALSE'], true).build());
  [60, 220, 300, 90, 60].forEach(function(w, i) { proj.setColumnWidth(i + 1, w); });

  SpreadsheetApp.flush();
  Logger.log('Setup concluído — abas: Tarefas, Log, Checklists, Checklist_Status, Interações, Usuários, Arquivo, Projetos');
}

// ── repararValidacaoUsuarios ── corrige header e validação da aba Usuários ──
// Rodar quando a coluna Perfil mostrar dropdown TRUE/FALSE em vez de Admin/Gestor/Usuário Padrão
function repararValidacaoUsuarios() {
  var ss  = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var usu = ss.getSheetByName(ABA_USUARIOS);
  if (!usu) { Logger.log('Aba Usuários não encontrada.'); return; }

  // Corrige cabeçalhos (linha 1)
  usu.getRange(1, 1, 1, 5).setValues([['Nome','Email','Perfil','Unidade','Cargo']])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');

  // Corrige validação da coluna Perfil (era TRUE/FALSE, passa a ser lista de perfis)
  usu.getRange(2, 3, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Admin','Gestor','Usuário Padrão'], true).build());
  // Remove validação da coluna Unidade (usuários podem ter múltiplos times — texto livre)
  usu.getRange(2, 4, 999).clearDataValidations();

  SpreadsheetApp.flush();
  Logger.log('Validação da aba Usuários corrigida. Verifique os valores na coluna Perfil.');
}

// ── popularUsuarios ── rodar 1x após setup() ──────────────────
function popularUsuarios() {
  var ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  var usu = ss.getSheetByName(ABA_USUARIOS);
  if (!usu) { Logger.log('Aba Usuários não existe. Rode setup() primeiro.'); return; }

  // Limpa dados existentes (mantém cabeçalho)
  var ultima = usu.getLastRow();
  if (ultima > 1) usu.getRange(2, 1, ultima - 1, 5).clearContent();

  // [Nome, Email, Perfil, Unidade (pode ser múltipla, sep. por vírgula), Cargo]
  var usuarios = [
    ['Vinicius Baião',              'vinicius.baiao@unimedcnu.coop.br',              'Admin',          'Rede Ambulatorial',                        'Especialista'],
    ['Aurélio Corujeira',           'aurelio.pereira.ext@unimedcnu.coop.br',         'Admin',          'Rede Ambulatorial, Atenção à Saúde',       'Designer'],
    ['Carlos Christian Simões',     'carlos.simoes@unimedcnu.coop.br',               'Gestor',         'Negociação de Rede - NNE',                 'Gerente de Rede'],
    ['Carolina Hashimoto',          'carolina.lopes@unimedcnu.coop.br',              'Gestor',         'Negociação de Rede - SSA',                 'Coordenadora de Rede'],
    ['Eduardo Caporicci',           'eduardo.caporicci@unimedcnu.coop.br',           'Gestor',         'Operações de Rede',                        'Gerente'],
    ['Anastacia Semaan',            'tacia@unimedcnu.coop.br',                       'Gestor',         'Qualificação, Regulamentação, NSP',        'Coordenadora de Rede'],
    ['Andressa Souza',              'andressa.souza.ext@unimedcnu.coop.br',          'Usuário Padrão', 'Negociação de Rede - SSA',                 'Consultora'],
    ['Lorena Paiva',                'redesalvador@unimedcnu.coop.br',                'Usuário Padrão', 'Negociação de Rede - SSA',                 'Consultora'],
    ['Debora Cardoso',              'deborasilva@unimednacional.coop.br',            'Usuário Padrão', 'Negociação de Rede - SSA',                 'Executivo de Relacionamento SR'],
    ['Flavia Coelho',               'flavia.coelho@unimedcnu.coop.br',               'Usuário Padrão', 'Negociação de Rede - SSA',                 'Executivo de Relacionamento PL'],
    ['Tainara Bramont',             'tainara.conceicao@unimedcnu.coop.br',           'Usuário Padrão', 'Negociação de Rede - SSA',                 'Executivo de Relacionamento JR'],
    ['Gabriel Boaventura',          'gabriel.boaventura@unimedcnu.coop.br',          'Usuário Padrão', 'Negociação de Rede - SSA',                 'Executivo de Relacionamento JR'],
    ['Thais Conceição',             'thais.conceicao@unimedcnu.coop.br',             'Usuário Padrão', 'Negociação de Rede - SSA',                 'Analista Administrativo'],
    ['Priscila Amazonas',           'priscila.amazonas@unimedcnu.coop.br',           'Usuário Padrão', 'Negociação de Rede - SSA',                 'Analista Administrativo'],
    ['Mateus Cruz',                 'mateus.silva@unimedcnu.coop.br',                'Usuário Padrão', 'Negociação de Rede - SSA',                 'Assistente Administrativo'],
    ['Maiara Atagiba',              'maiara.cardoso@unimedcnu.coop.br',              'Usuário Padrão', 'Negociação de Rede - SSA',                 'Assistente Administrativo'],
    ['Ana Tarsis',                  'anatarsis.santos@unimedcnu.coop.br',            'Usuário Padrão', 'Negociação de Rede - SSA',                 'Assistente Administrativo'],
    ['Marcos Paulo Pereira',        'marcos.pereira@unimedcnu.coop.br',              'Usuário Padrão', 'Operações de Rede',                        'Analista de NPS Pleno'],
    ['Andressa Lima',               'andressa.lima@unimedcnu.coop.br',               'Usuário Padrão', '',                                         'Coordenador de Operações de Rede'],
    ['Andrea Fonseca Cano',         'andrea.cano@unimednacional.coop.br',            'Usuário Padrão', '',                                         ''],
    ['Beatriz Kaori Fujimoto',      'beatriz.fujimoto@unimedcnu.coop.br',            'Usuário Padrão', '',                                         ''],
    ['Bruna Tupi Dos Santos',       'bruna.tupi@unimedcnu.coop.br',                  'Usuário Padrão', '',                                         ''],
    ['Cintia Maria Fernandes Rosa', 'cintia.rosa@unimedcnu.coop.br',                'Usuário Padrão', '',                                         ''],
    ['Cleice Aparecida Dias Silva', 'cleice.dias@unimedcnu.coop.br',                'Usuário Padrão', '',                                         ''],
    ['Cleice Aparecida Dias Silva', 'cleice.silva@unimedcnu.coop.br',               'Usuário Padrão', '',                                         ''],
    ['Cristiane Costa Ferreira',    'cristiane.costa@unimedcnu.coop.br',             'Usuário Padrão', '',                                         ''],
    ['Erika Pereira Da Silva',      'erika.pereira@unimedcnu.coop.br',              'Usuário Padrão', '',                                         ''],
    ['Florence Borges De Paiva',    'florence.paiva@unimedcnu.coop.br',             'Usuário Padrão', '',                                         ''],
    ['Geovanna De Oliveira',        'geovanna.ferreira@unimedcnu.coop.br',          'Usuário Padrão', '',                                         ''],
    ['Gustavo Ferreira Machado',    'gustavo.machado@unimedcnu.coop.br',            'Usuário Padrão', '',                                         ''],
    ['Jacqueline Mendes Pereira',   'jacqueline.pereira@unimednacional.coop.br',    'Usuário Padrão', '',                                         ''],
    ['Joyce Araujo Viana',          'joyce.viana@unimednacional.coop.br',           'Usuário Padrão', '',                                         ''],
    ['Natalia Fonseca',             'natalia.fonseca@unimedcnu.coop.br',            'Usuário Padrão', '',                                         ''],
    ['Priscila Alves Ferrari',      'priscila.ferrari@unimednacional.coop.br',      'Usuário Padrão', '',                                         ''],
    ['Raquel Fuentes De Stefano',   'raquel.stefano@unimednacional.coop.br',        'Usuário Padrão', '',                                         ''],
    ['Thais Carvalho Freitas',      'thais.freitas@unimedcnu.coop.br',              'Usuário Padrão', '',                                         ''],
    ['Vinicius Silva De Oliveira',  'viniciuss.oliveira@unimedcnu.coop.br',         'Usuário Padrão', '',                                         ''],
    ['Jacqueline Wahrhaftig',       'jacqueline.wahrhaftig.ext@unimedcnu.coop.br',   'Usuário Padrão', '',                                         ''],
    ['Guilherme Borges Gomes Da Silva', 'guilherme.silva.ext@unimedcnu.coop.br',     'Usuário Padrão', '',                                         ''],
    ['Thiago Viana Santos',         'thiago.viana.ext@unimedcnu.coop.br',            'Usuário Padrão', '',                                         '']
  ];

  usu.getRange(2, 1, usuarios.length, 5).setValues(usuarios);
  SpreadsheetApp.flush();
  Logger.log('popularUsuarios: ' + usuarios.length + ' usuários inseridos.');
}

// ── adicionarUsuariosPiloto ── adiciona os 4 usuários do piloto sem apagar os demais ──
// Idempotente: pula quem já existe (por e-mail). Rodar 1x manualmente no editor.
function adicionarUsuariosPiloto() {
  var sheet = getSheet(ABA_USUARIOS);
  if (!sheet) { Logger.log('Aba Usuários não existe. Rode setup() primeiro.'); return; }

  var pilotos = [
    ['Jacqueline Wahrhaftig',           'jacqueline.wahrhaftig.ext@unimedcnu.coop.br', 'Usuário Padrão', '', ''],
    ['Guilherme Borges Gomes Da Silva', 'guilherme.silva.ext@unimedcnu.coop.br',       'Usuário Padrão', '', ''],
    ['Thiago Viana Santos',             'thiago.viana.ext@unimedcnu.coop.br',          'Usuário Padrão', '', '']
  ];

  var rows = sheet.getDataRange().getValues();
  var existentes = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1]) existentes[String(rows[i][1]).toLowerCase()] = true;
  }

  var novos = pilotos.filter(function(u) { return !existentes[u[1].toLowerCase()]; });
  if (!novos.length) { Logger.log('adicionarUsuariosPiloto: todos já cadastrados.'); return; }

  sheet.getRange(sheet.getLastRow() + 1, 1, novos.length, 5).setValues(novos);
  SpreadsheetApp.flush();
  Logger.log('adicionarUsuariosPiloto: ' + novos.length + ' usuário(s) adicionado(s).');
}

// ── popularProjetos ── rodar 1x após setup() ──────────────────
function popularProjetos() {
  var sheet = getSheet(ABA_PROJETOS);
  if (!sheet) { Logger.log('Aba Projetos não existe. Rode setup() primeiro.'); return; }

  var ultima = sheet.getLastRow();
  if (ultima > 1) sheet.getRange(2, 1, ultima - 1, 5).clearContent();

  var lista = [
    [1, 'Gestão de Demandas',                               '', '#004e4c', true],
    [2, 'Rede Higiene',                                     '', '#0052cc', true],
    [3, 'Cuidado Transicional',                             '', '#c9a84c', true],
    [4, 'Alto Custo',                                       '', '#e8384f', true],
    [5, 'Demandas Linhas de Cuidados - Oportunidades',      '', '#7c3aed', true],
    [6, 'Negociação de Rede - SSA',                         '', '#16a34a', true],
    [7, 'Atenção à Saúde',                                  '', '#f59f00', true]
  ];

  sheet.getRange(2, 1, lista.length, 5).setValues(lista);
  SpreadsheetApp.flush();
  Logger.log('popularProjetos: ' + lista.length + ' projetos inseridos.');
}

// ── listarInteracoes ──────────────────────────────────────────
function listarInteracoes(dados) {
  var sheet = getSheet(ABA_INTERACOES);
  if (!sheet) return { interacoes: [] };
  // Restrição de visibilidade: usuário padrão só consulta tarefas que pode ver
  var visiveis = idsTarefasVisiveis(Session.getActiveUser().getEmail());
  if (visiveis && dados.idTarefa && !visiveis[String(dados.idTarefa)]) return { interacoes: [] };
  var rows   = sheet.getDataRange().getValues();
  var header = rows[0];
  var lista  = [];
  var filtroId = dados.idTarefa ? String(dados.idTarefa) : '';

  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    if (filtroId && String(rows[i][1]) !== filtroId) continue;
    if (visiveis && !visiveis[String(rows[i][1])]) continue;
    var obj = {};
    header.forEach(function(col, idx) { obj[col] = rows[i][idx]; });
    lista.push(obj);
  }
  lista.sort(function(a, b) { return new Date(b['Data/Hora']) - new Date(a['Data/Hora']); });
  return { interacoes: lista };
}

// ── adicionarInteracao ────────────────────────────────────────
function adicionarInteracao(dados) {
  if (!dados.idTarefa) return { erro: 'ID da tarefa é obrigatório.' };
  if (String(dados.conteudo || '').length > 2000) return { erro: 'Conteúdo excede 2000 caracteres.' };
  var sheet  = getSheet(ABA_INTERACOES);
  var editor = Session.getActiveUser().getEmail();
  // Usuário padrão só registra interação em tarefa que enxerga
  var visiveis = idsTarefasVisiveis(editor);
  if (visiveis && !visiveis[String(dados.idTarefa)]) {
    return { erro: 'Sem permissão para esta tarefa.' };
  }
  var idMax  = sheet.getLastRow(); // O(1) — IDs são sequenciais e só appendamos
  sheet.appendRow([
    idMax + 1,
    dados.idTarefa,
    new Date(),
    editor,
    dados.tipo     || 'Comentário',
    dados.conteudo || ''
  ]);
  gravarLog('INTERACAO', 'ID_Tarefa', '', dados.idTarefa);
  return { sucesso: true, id: idMax + 1 };
}

// ── relatorioDiario ───────────────────────────────────────────
// Configurar via Apps Script → Triggers → relatorioDiario → Horário (17h).
function relatorioDiario() {
  if (!RESUMO_DIARIO_ATIVO) return; // desativado no MVP
  if (!EMAIL_REPORTE) return;

  var hoje  = new Date(); hoje.setHours(0, 0, 0, 0);
  var aman  = new Date(hoje); aman.setDate(hoje.getDate() + 1);
  var lista = listarTarefas().tarefas;

  var ps = { 'A fazer': 0, 'Em andamento': 0, 'Bloqueado': 0, 'Concluído': 0 };
  var vencidas = [], vHoje = [], vAmanha = [];

  lista.forEach(function(t) {
    ps[t.Status] = (ps[t.Status] || 0) + 1;
    if (!t.Prazo || t.Status === 'Concluído') return;
    var d = new Date(t.Prazo); d.setHours(0, 0, 0, 0);
    if (d < hoje) vencidas.push(t);
    else if (d.getTime() === hoje.getTime()) vHoje.push(t);
    else if (d.getTime() === aman.getTime()) vAmanha.push(t);
  });

  var dtStr = hoje.toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'});
  var linhaT = function(t) {
    return '<li style="font-size:13px;margin-bottom:5px"><b>' + escHtml(t.Tarefa) + '</b>'
      + (t.Projeto ? ' · <span style="color:#6c757d">' + escHtml(t.Projeto) + '</span>' : '')
      + (t['Responsável'] ? ' <span style="color:#adb5bd">(' + escHtml(t['Responsável'].split('@')[0]) + ')</span>' : '')
      + '</li>';
  };
  var secao = function(titulo, cor, items) {
    if (!items.length) return '';
    return '<h3 style="font-size:14px;color:' + cor + ';margin:18px 0 8px">' + titulo + ' (' + items.length + ')</h3>'
      + '<ul style="margin:0 0 4px;padding-left:18px">' + items.map(linhaT).join('') + '</ul>';
  };

  var html = '<div style="font-family:Arial,sans-serif;max-width:620px;color:#212529">'
    + '<div style="background:#004e4c;padding:18px 24px;border-radius:8px 8px 0 0">'
    + '<h2 style="color:#fff;margin:0;font-size:17px">Relatório Diário — Gestão de Tarefas</h2>'
    + '<p style="color:#a8d5d4;margin:3px 0 0;font-size:12px">Unimed CNU · ' + dtStr + '</p>'
    + '</div>'
    + '<div style="background:#fff;padding:22px 24px;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px">'
    + '<h3 style="font-size:14px;color:#004e4c;margin:0 0 10px">Resumo por status</h3>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:4px">'
    + '<tr><td style="padding:7px 10px;background:#f8f9fa;font-size:13px">A fazer</td><td style="padding:7px 10px;font-weight:700;font-size:13px">' + ps['A fazer'] + '</td>'
    + '<td style="padding:7px 10px;font-size:13px">Em andamento</td><td style="padding:7px 10px;font-weight:700;font-size:13px">' + ps['Em andamento'] + '</td></tr>'
    + '<tr><td style="padding:7px 10px;background:#f8f9fa;font-size:13px">Bloqueado</td><td style="padding:7px 10px;font-weight:700;font-size:13px">' + ps['Bloqueado'] + '</td>'
    + '<td style="padding:7px 10px;font-size:13px">Concluído</td><td style="padding:7px 10px;font-weight:700;font-size:13px">' + ps['Concluído'] + '</td></tr>'
    + '</table>'
    + secao('Vencidas', '#c0392b', vencidas)
    + secao('Vencem hoje', '#856404', vHoje)
    + secao('Vencem amanha', '#0c4a9f', vAmanha)
    + '<p style="font-size:11px;color:#adb5bd;margin-top:18px;padding-top:12px;border-top:1px solid #dee2e6">'
    + 'Gerado automaticamente pelo sistema de Gestão de Tarefas CNU</p>'
    + '</div></div>';

  enviarEmail(EMAIL_REPORTE, '[Tarefas CNU] Resumo do dia — ' + hoje.toLocaleDateString('pt-BR'), html);
}

// ── Trigger diário: lembretes D-1 ────────────────────────────
function lembretesDiarios() {
  var sheet  = getSheet(ABA_TAREFAS);
  var linhas = sheet.getDataRange().getValues();
  var amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);

  for (var i = 1; i < linhas.length; i++) {
    var linha = linhas[i];
    if (linha[COL.ATIVO] === false) continue;
    if (linha[COL.STATUS] === 'Concluído') continue;

    var prazo = new Date(linha[COL.PRAZO]);
    prazo.setHours(0, 0, 0, 0);
    if (prazo.getTime() !== amanha.getTime()) continue;

    var responsavel = linha[COL.RESPONSAVEL];
    if (!responsavel) continue;

    var url = ScriptApp.getService().getUrl();
    var htmlLem = '<div style="font-family:Arial,sans-serif;max-width:600px;color:#212529">'
      + '<div style="background:#004e4c;padding:16px 24px;border-radius:8px 8px 0 0">'
      + '<h2 style="color:#fff;margin:0;font-size:16px">[Tarefas CNU] Lembrete: tarefa vence amanhã</h2>'
      + '<p style="color:#a8d5d4;margin:4px 0 0;font-size:12px">Unimed CNU · Rede Ambulatorial</p>'
      + '</div>'
      + '<div style="background:#fff;padding:20px 24px;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px">'
      + '<p style="font-size:14px;margin:0 0 12px">A tarefa abaixo vence <strong>amanhã</strong>:</p>'
      + '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">'
      + '<tr><td style="padding:7px 0;color:#6c757d;width:80px">Tarefa</td>'
      +     '<td style="padding:7px 0;font-weight:600">' + escHtml(linha[COL.TAREFA]) + '</td></tr>'
      + '<tr><td style="padding:7px 0;color:#6c757d;border-top:1px solid #f1f1f1">Projeto</td>'
      +     '<td style="padding:7px 0;border-top:1px solid #f1f1f1">' + escHtml(linha[COL.PROJETO] || '—') + '</td></tr>'
      + '</table>'
      + '<a href="' + url + '" style="display:inline-block;background:#004e4c;color:#fff;'
      +   'padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">'
      + 'Abrir Gestão de Tarefas →</a>'
      + '<p style="font-size:11px;color:#adb5bd;margin-top:18px;padding-top:12px;border-top:1px solid #f1f1f1">'
      + 'Unimed CNU · Sistema de Gestão de Tarefas — Rede Ambulatorial</p>'
      + '</div></div>';
    enviarEmail(responsavel, '[Tarefas CNU] Lembrete: tarefa vence amanhã', htmlLem);
  }
}

// ── arquivarTarefasAntigas ────────────────────────────────────
// Configurar trigger mensal: Apps Script → Gatilhos → arquivarTarefasAntigas → Mês.
// Move tarefas Concluídas com mais de 30 dias para a aba Arquivo,
// mantendo a aba Tarefas enxuta indefinidamente.
function arquivarTarefasAntigas() {
  var ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  var sheetT   = ss.getSheetByName(ABA_TAREFAS);
  var sheetArq = ss.getSheetByName(ABA_ARQUIVO) || ss.insertSheet(ABA_ARQUIVO);

  // Garantir cabeçalho na aba Arquivo
  if (sheetArq.getLastRow() === 0) {
    var header = sheetT.getRange(1, 1, 1, sheetT.getLastColumn()).getValues();
    sheetArq.getRange(1, 1, 1, header[0].length).setValues(header);
  }

  var limite = new Date();
  limite.setDate(limite.getDate() - 30);

  var linhas = sheetT.getDataRange().getValues();
  var paraArquivar  = [];
  var indicesToDel  = []; // índices de linha (1-based), em ordem decrescente

  for (var i = linhas.length - 1; i >= 1; i--) {
    var linha = linhas[i];
    if (linha[COL.STATUS] !== 'Concluído') continue;
    if (linha[COL.ATIVO] === false || linha[COL.ATIVO] === 'false') continue;
    var criado = new Date(linha[COL.DATA_CRIACAO]);
    if (isNaN(criado) || criado >= limite) continue;
    paraArquivar.unshift(linha);    // mantém ordem cronológica
    indicesToDel.push(i + 1);      // já em ordem decrescente (loop reverso)
  }

  if (!paraArquivar.length) {
    Logger.log('arquivarTarefasAntigas: nenhuma tarefa para arquivar.');
    return;
  }

  // Copiar para Arquivo em batch
  var ultimaArq = sheetArq.getLastRow();
  sheetArq.getRange(ultimaArq + 1, 1, paraArquivar.length, paraArquivar[0].length)
    .setValues(paraArquivar);

  // Deletar da aba Tarefas (índices decrescentes preservam posição correta)
  indicesToDel.forEach(function(row) { sheetT.deleteRow(row); });

  SpreadsheetApp.flush();
  Logger.log('arquivarTarefasAntigas: ' + paraArquivar.length + ' tarefas movidas para Arquivo.');
}

// ── doPost — endpoint para integrações externas (Gem Gemini) ──
// Aceita POST com JSON: { token, acao, dados }
// Requer token secreto; não depende de sessão autenticada.
// ⚠️ SEGURANÇA: o token deve viver em Script Properties (Configurações do
// projeto → Propriedades do script → TOKEN_GEMINI). O valor hardcoded abaixo
// é só fallback legado e DEVE ser rotacionado: este repositório é público no
// GitHub, então o valor antigo está exposto.
var TOKEN_GEMINI_FALLBACK = 'CNU_TAREFAS_SECRET_2026';

function tokenGemini() {
  try {
    var p = PropertiesService.getScriptProperties().getProperty('TOKEN_GEMINI');
    if (p) return p;
  } catch (e) {}
  return TOKEN_GEMINI_FALLBACK;
}

function doPost(e) {
  var json;
  try {
    json = JSON.parse(e.postData.contents);
  } catch(err) {
    return jsonResponse({ erro: 'Payload inválido: ' + err.message });
  }

  if (!json.token || json.token !== tokenGemini()) {
    return jsonResponse({ erro: 'Token inválido.' });
  }

  var acao = json.acao || '';

  if (acao === 'criarTarefa') {
    var dados = json.dados;
    if (Array.isArray(dados)) {
      if (dados.length > 30) {
        return jsonResponse({ erro: 'Lote excede 30 tarefas.' });
      }
      // Criação em lote (ex: extraídas de uma ata pelo Gem)
      var resultados = [];
      var erros = 0;
      for (var i = 0; i < dados.length; i++) {
        var r = criarTarefa(dados[i]);
        if (r.erro) erros++;
        resultados.push(r);
      }
      return jsonResponse({
        sucesso: erros === 0,
        quantidade: dados.length,
        erros: erros,
        detalhes: resultados
      });
    } else {
      return jsonResponse(criarTarefa(dados));
    }
  }

  return jsonResponse({ erro: 'Ação não suportada: ' + acao });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
