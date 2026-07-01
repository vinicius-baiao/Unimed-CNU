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
  var dados    = e.parameter.dados    ? JSON.parse(e.parameter.dados) : {};

  // Sem ação → serve o frontend HTML (permite embed no Google Sites)
  if (!acao) {
    return HtmlService.createHtmlOutputFromFile('tarefas')
      .setTitle('Gestão de Tarefas — Rede Ambulatorial CNU')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var resultado;
  try {
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

function criarProjeto(dados) {
  var editor = Session.getActiveUser().getEmail();
  if (!podeExcluir(editor)) return { erro: 'Apenas Admin ou Gestor pode criar projetos.' };
  if (!dados.nome || !String(dados.nome).trim()) return { erro: 'Nome do projeto é obrigatório.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  var sheet = getOrCreateProjetosSheet();
  var id    = proximoIdProjeto();
  sheet.appendRow([id, String(dados.nome).trim(), dados.descricao || '', dados.cor || '#64748b', true]);
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
    if (dados.cor       !== undefined) row[COL_PROJ.COR]      = dados.cor;
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
function getPerfil(email) {
  var sheet = getSheet(ABA_USUARIOS);
  if (!sheet) return '';
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase() === String(email).toLowerCase()) {
      return String(rows[i][2]);
    }
  }
  return '';
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
    lista.push({ nome: String(rows[i][0]), email: String(rows[i][1]), perfil: String(rows[i][2]), unidade: String(rows[i][3] || '') });
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
  var baseId = log.getLastRow();
  var editor = Session.getActiveUser().getEmail();
  var agora  = new Date();
  var rows   = entradas.map(function(e, i) {
    return [baseId + i + 1, agora, editor, e[0], e[1], e[2], e[3]];
  });
  log.getRange(baseId + 1, 1, rows.length, 7).setValues(rows);
}

// ── listarTarefas ─────────────────────────────────────────────
function listarTarefas() {
  var sheet  = getSheet(ABA_TAREFAS);
  var dados  = sheet.getDataRange().getValues();
  var header = dados[0];
  var lista  = [];

  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    if (linha[COL.ATIVO] === false || linha[COL.ATIVO] === 'false') continue;
    var obj = {};
    header.forEach(function(col, idx) { obj[col] = linha[idx]; });
    lista.push(obj);
  }
  return { tarefas: lista };
}

// ── Validação de entrada ──────────────────────────────────────
var STATUS_VALIDOS    = ['Backlog', 'A fazer', 'Em andamento', 'Bloqueado', 'Concluído'];
var PRIORIDADE_VALIDA = ['Crítica', 'Alta', 'Média', 'Baixa'];
var DOMINIO_PERMITIDO = '@unimedcnu.coop.br';

function validarTarefa(dados, criando) {
  if (criando && (!dados.tarefa || !String(dados.tarefa).trim())) return 'Campo "tarefa" é obrigatório.';
  if (dados.tarefa !== undefined && String(dados.tarefa).length > 500) return 'Campo "tarefa" excede 500 caracteres.';
  if (dados.status !== undefined && STATUS_VALIDOS.indexOf(dados.status) === -1) return 'Status inválido: ' + dados.status;
  if (dados.prioridade !== undefined && PRIORIDADE_VALIDA.indexOf(dados.prioridade) === -1) return 'Prioridade inválida: ' + dados.prioridade;
  if (dados.responsavel && String(dados.responsavel).indexOf(DOMINIO_PERMITIDO) === -1) return 'Responsável deve ser do domínio ' + DOMINIO_PERMITIDO;
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

  var prazo = dados.prazo ? new Date(dados.prazo) : '';

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

  for (var i = 1; i < linhas.length; i++) {
    if (String(linhas[i][COL.ID]) !== String(dados.id)) continue;

    // ── Verificação de permissão ──────────────────────────────
    var editor  = Session.getActiveUser().getEmail().trim().toLowerCase();
    var criador = String(linhas[i][COL.CRIADO_POR] || '').trim().toLowerCase();
    var eCriador = editor === criador;
    var admin    = isAdmin(editor) || podeExcluir(editor); // Admin + Gestor
    if (!admin && !eCriador && dados.status === 'Concluído' && dados.status !== linhas[i][COL.STATUS]) {
      return { erro: 'Apenas quem criou a tarefa pode marcá-la como Concluída.' };
    }
    var prazoAtualStr = linhas[i][COL.PRAZO] ? new Date(linhas[i][COL.PRAZO]).toISOString().slice(0,10) : '';
    if (!admin && !eCriador && dados.prazo !== undefined && dados.prazo !== '' && dados.prazo !== prazoAtualStr) {
      return { erro: 'Apenas quem criou a tarefa pode alterar o prazo.' };
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

    // Aplicar alterações na linha em memória e coletar logs
    var rowAtualizada = linhas[i].slice();
    var logEntradas   = [];

    camposEditaveis.forEach(function(campo) {
      if (dados[campo] === undefined) return;
      var anterior = linhas[i][colMap[campo]];
      var novo     = campo === 'prazo' ? new Date(dados[campo]) : dados[campo];
      rowAtualizada[colMap[campo]] = novo;
      logEntradas.push(['ATUALIZAR', campo, anterior, novo]);
    });

    // 1 write para todos os campos alterados; 1 write para todos os logs
    sheet.getRange(i + 1, 1, 1, rowAtualizada.length).setValues([rowAtualizada]);
    gravarLogs(logEntradas);

    if (dados.responsavel && dados.responsavel !== responsavelAnterior) {
      notificarResponsavel(dados, 'reatribuicao');
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

    var criador = String(linhas[i][COL.CRIADO_POR] || '');
    if (editor !== criador && !podeExcluir(editor)) {
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

  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    if (!linha[0] && !linha[1]) continue;
    if (!idsAtivos[String(linha[1])]) continue; // ignora itens de tarefas excluídas/arquivadas
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
  var resultado = [header].concat(manter).concat(novas);
  sheet.clearContents();
  if (resultado.length > 0) {
    sheet.getRange(1, 1, resultado.length, header.length).setValues(resultado);
  }

  // Notificar colegas marcados em itens da checklist
  var marcados = [];
  itens.forEach(function(it) {
    if (it.responsavel && marcados.indexOf(it.responsavel) === -1) marcados.push(it.responsavel);
  });
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
  MailApp.sendEmail({ to: email, subject: '[Tarefas CNU] Você foi marcado em uma checklist', htmlBody: html });
}

// ── Helpers de segurança ──────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

  MailApp.sendEmail({
    to:       dados.responsavel,
    subject:  assuntos[tipo] || assuntos.criacao,
    htmlBody: html
  });
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
  var hUsu = ['Nome', 'Email', 'Perfil', 'Unidade'];
  usu.getRange(1, 1, 1, hUsu.length).setValues([hUsu])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  usu.setFrozenRows(1);
  usu.getRange(2, 3, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Admin','Gestor','Usuário Padrão'], true).build());
  usu.getRange(2, 4, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Rede Ambulatorial','Atenção à Saúde','Negociação de Rede - SSA','Operações de Rede','Qualificação','Regulamentação','NSP'], true).build());
  [220, 280, 140, 200].forEach(function(w, i) { usu.setColumnWidth(i + 1, w); });

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
  usu.getRange(1, 1, 1, 4).setValues([['Nome','Email','Perfil','Unidade']])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');

  // Remove validações antigas e aplica as corretas
  usu.getRange(2, 3, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Admin','Gestor','Usuário Padrão'], true).build());
  usu.getRange(2, 4, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Rede Ambulatorial','Atenção à Saúde','Negociação de Rede - SSA','Operações de Rede','Qualificação','Regulamentação','NSP'], true).build());

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
  if (ultima > 1) usu.getRange(2, 1, ultima - 1, 4).clearContent();

  // [Nome, Email, Perfil, Unidade] — preencha a coluna Unidade na planilha
  var usuarios = [
    ['Vinicius Baião',              'vinicius.baiao@unimedcnu.coop.br',           'Admin',          ''],
    ['Aurélio Corujeira',           'aurelio.pereira.ext@unimedcnu.coop.br',       'Admin',          ''],
    ['Carlos Christian Simões',     'carlos.simoes@unimedcnu.coop.br',             'Gestor',         ''],
    ['Carolina Hashimoto',          'carolina.lopes@unimedcnu.coop.br',            'Gestor',         ''],
    ['Eduardo Caporicci',           'eduardo.caporicci@unimedcnu.coop.br',         'Gestor',         ''],
    ['Anastacia Semaan',            'tacia@unimedcnu.coop.br',                     'Gestor',         ''],
    ['Andressa Souza',              'andressa.souza.ext@unimedcnu.coop.br',        'Usuário Padrão', ''],
    ['Lorena Paiva',                'redesalvador@unimedcnu.coop.br',              'Usuário Padrão', ''],
    ['Flavia Coelho',               'flavia.coelho@unimedcnu.coop.br',             'Usuário Padrão', ''],
    ['Tainara Bramont',             'tainara.conceicao@unimedcnu.coop.br',         'Usuário Padrão', ''],
    ['Gabriel Boaventura',          'gabriel.boaventura@unimedcnu.coop.br',        'Usuário Padrão', ''],
    ['Thais Conceição',             'thais.conceicao@unimedcnu.coop.br',           'Usuário Padrão', ''],
    ['Priscila Amazonas',           'priscila.amazonas@unimedcnu.coop.br',         'Usuário Padrão', ''],
    ['Mateus Cruz',                 'mateus.silva@unimedcnu.coop.br',              'Usuário Padrão', ''],
    ['Maiara Atagiba',              'maiara.cardoso@unimedcnu.coop.br',            'Usuário Padrão', ''],
    ['Ana Tarsis',                  'anatarsis.santos@unimedcnu.coop.br',          'Usuário Padrão', ''],
    ['Marcos Paulo Pereira',        'marcos.pereira@unimedcnu.coop.br',            'Usuário Padrão', ''],
    ['Andressa De Jesus Lima',      'andressa.lima@unimedcnu.coop.br',             'Usuário Padrão', '']
  ];

  usu.getRange(2, 1, usuarios.length, 4).setValues(usuarios);
  SpreadsheetApp.flush();
  Logger.log('popularUsuarios: ' + usuarios.length + ' usuários inseridos.');
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
  var rows   = sheet.getDataRange().getValues();
  var header = rows[0];
  var lista  = [];
  var filtroId = dados.idTarefa ? String(dados.idTarefa) : '';

  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    if (filtroId && String(rows[i][1]) !== filtroId) continue;
    var obj = {};
    header.forEach(function(col, idx) { obj[col] = rows[i][idx]; });
    lista.push(obj);
  }
  lista.sort(function(a, b) { return new Date(b['Data/Hora']) - new Date(a['Data/Hora']); });
  return { interacoes: lista };
}

// ── adicionarInteracao ────────────────────────────────────────
function adicionarInteracao(dados) {
  var sheet  = getSheet(ABA_INTERACOES);
  var editor = Session.getActiveUser().getEmail();
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
    return '<li style="font-size:13px;margin-bottom:5px"><b>' + t.Tarefa + '</b>'
      + (t.Projeto ? ' · <span style="color:#6c757d">' + t.Projeto + '</span>' : '')
      + (t['Responsável'] ? ' <span style="color:#adb5bd">(' + t['Responsável'].split('@')[0] + ')</span>' : '')
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

  MailApp.sendEmail({
    to:       EMAIL_REPORTE,
    subject:  '[Tarefas CNU] Resumo do dia — ' + hoje.toLocaleDateString('pt-BR'),
    htmlBody: html
  });
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
      +     '<td style="padding:7px 0;font-weight:600">' + linha[COL.TAREFA] + '</td></tr>'
      + '<tr><td style="padding:7px 0;color:#6c757d;border-top:1px solid #f1f1f1">Projeto</td>'
      +     '<td style="padding:7px 0;border-top:1px solid #f1f1f1">' + (linha[COL.PROJETO] || '—') + '</td></tr>'
      + '</table>'
      + '<a href="' + url + '" style="display:inline-block;background:#004e4c;color:#fff;'
      +   'padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">'
      + 'Abrir Gestão de Tarefas →</a>'
      + '<p style="font-size:11px;color:#adb5bd;margin-top:18px;padding-top:12px;border-top:1px solid #f1f1f1">'
      + 'Unimed CNU · Sistema de Gestão de Tarefas — Rede Ambulatorial</p>'
      + '</div></div>';
    MailApp.sendEmail({
      to:       responsavel,
      subject:  '[Tarefas CNU] Lembrete: tarefa vence amanhã',
      htmlBody: htmlLem
    });
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
var TOKEN_GEMINI = 'CNU_TAREFAS_SECRET_2026';

function doPost(e) {
  var json;
  try {
    json = JSON.parse(e.postData.contents);
  } catch(err) {
    return jsonResponse({ erro: 'Payload inválido: ' + err.message });
  }

  if (json.token !== TOKEN_GEMINI) {
    return jsonResponse({ erro: 'Token inválido.' });
  }

  var acao = json.acao || '';

  if (acao === 'criarTarefa') {
    var dados = json.dados;
    if (Array.isArray(dados)) {
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

// ── Carga de teste — executar manualmente no editor do Apps Script ──
// Reproduz o lote do JSON de teste sem depender do endpoint HTTP.
function carregarDadosTeste() {
  var criado_por = 'aurelio.pereira.ext@unimedcnu.coop.br';
  var projeto    = 'Demandas Linhas de Cuidados - Oportunidades';

  var tarefas = [
    { tarefa: 'Pilotar automação do banco de dados e planilha status',       responsavel: 'aurelio.pereira.ext@unimedcnu.coop.br', prazo: '',           status: 'A fazer', prioridade: 'Alta',  observacoes: 'Realizar um projeto piloto focado no banco de dados mais complexo para testar automações e estruturar melhorias imediatas.' },
    { tarefa: 'Criar canal de comunicação com a equipe técnica',              responsavel: '',                                       prazo: '',           status: 'A fazer', prioridade: 'Média', observacoes: 'Criar um canal para alinhar dúvidas sobre o fluxo de dados entre Aurélio e a equipe administrativa.' },
    { tarefa: 'Demonstrar processo de extração de senhas',                    responsavel: '',                                       prazo: '',           status: 'A fazer', prioridade: 'Média', observacoes: 'Mostrar para o Aurélio o fluxo manual no Databricks e Tableau para posterior automação na integração com o sistema Nilo.' },
    { tarefa: 'Definir papéis e responsáveis pelo compartilhamento de dados', responsavel: '',                                       prazo: '',           status: 'A fazer', prioridade: 'Média', observacoes: 'Estruturar a governança do processo de dados junto com o Aurélio.' },
    { tarefa: 'Priorizar as 11 demandas mapeadas',                            responsavel: '',                                       prazo: '',           status: 'A fazer', prioridade: 'Alta',  observacoes: 'Definir a ordem de preferência para estruturar o cronograma técnico de automação.' },
    { tarefa: 'Agendar reunião sobre reclamações da telemedicina',            responsavel: 'aurelio.pereira.ext@unimedcnu.coop.br', prazo: '',           status: 'A fazer', prioridade: 'Média', observacoes: 'Reunião com Diego e Ana Carolina para revisar a centralização das denúncias.' },
    { tarefa: 'Demonstrar a planilha operacional de acompanhamento',          responsavel: '',                                       prazo: '',           status: 'A fazer', prioridade: 'Média', observacoes: 'Ilustrar o processo manual atual de acompanhamento para orientar a construção do novo painel dinâmico.' },
    { tarefa: 'Apresentar o sistema Assertiva',                               responsavel: '',                                       prazo: '',           status: 'A fazer', prioridade: 'Média', observacoes: 'Facilitar a análise para verificar viabilidade de cargas automáticas de busca de telefones e contatos em lote.' },
    { tarefa: 'Transcrever reunião e organizar pontos sobrepostos',           responsavel: 'aurelio.pereira.ext@unimedcnu.coop.br', prazo: '',           status: 'A fazer', prioridade: 'Baixa', observacoes: 'Identificar sobreposições nas rotinas para otimizar soluções técnicas.' },
    { tarefa: 'Agendar reunião com a Dra. Gláucia',                          responsavel: '',                                       prazo: '',           status: 'A fazer', prioridade: 'Média', observacoes: 'Definir as regras e padronizações para identificação unificada de pacientes.' },
    { tarefa: 'Definir e reportar prioridades finais de implementação',       responsavel: '',                                       prazo: '2026-06-26', status: 'A fazer', prioridade: 'Alta',  observacoes: 'Definir as prioridades de execução junto com o grupo.' }
  ];

  var erros = 0;
  tarefas.forEach(function(t) {
    t.criado_por = criado_por;
    t.projeto    = projeto;
    var r = criarTarefa(t);
    if (r.erro) { erros++; Logger.log('ERRO: ' + t.tarefa + ' → ' + r.erro); }
    else        { Logger.log('OK #' + r.id + ': ' + t.tarefa); }
  });

  Logger.log('=== Concluído: ' + (tarefas.length - erros) + '/' + tarefas.length + ' tarefas criadas. Erros: ' + erros);
}

// ── Limpeza total — executar manualmente no editor do Apps Script ──
// Apaga TODAS as linhas de dados da aba Tarefas (mantém o cabeçalho).
// Não mexe em Log, Checklists, Checklist_Status, Interações ou Usuários.
function limparTarefas() {
  var sheet    = getSheet(ABA_TAREFAS);
  var lastRow  = sheet.getLastRow();
  var lastCol  = sheet.getLastColumn();
  if (lastRow <= 1) { Logger.log('Aba Tarefas já está vazia.'); return; }

  var qtd = lastRow - 1;
  sheet.getRange(2, 1, qtd, lastCol).clearContent();
  gravarLog('LIMPAR_TUDO', 'Tarefas', qtd + ' linhas', '0 linhas');
  Logger.log('=== Concluído: ' + qtd + ' tarefa(s) removida(s) da aba Tarefas.');
}
