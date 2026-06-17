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
var EMAIL_REPORTE    = '';  // e-mail(s) para o relatório diário, separados por vírgula

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
  ATIVO:       10
};

// ── Roteador principal ────────────────────────────────────────
function doGet(e) {
  var acao     = e.parameter.acao     || '';
  var callback = e.parameter.callback || '';
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
      case 'listarUsuarios':        resultado = listarUsuarios();                              break;
      case 'getUsuario': {
        var _u = Session.getActiveUser().getEmail();
        resultado = { email: _u, admin: isAdmin(_u) };
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

// ── Usuários / Admin ──────────────────────────────────────────
function isAdmin(email) {
  var sheet = getSheet(ABA_USUARIOS);
  if (!sheet) return false;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase() === String(email).toLowerCase()
        && rows[i][2] === true) return true;
  }
  return false;
}

function listarUsuarios() {
  var sheet = getSheet(ABA_USUARIOS);
  if (!sheet) return { usuarios: [] };
  var rows = sheet.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0] && !rows[i][1]) continue;
    lista.push({ nome: String(rows[i][0]), email: String(rows[i][1]), admin: rows[i][2] === true });
  }
  return { usuarios: lista };
}

// ── Helpers de planilha ───────────────────────────────────────
function getSheet(nome) {
  var ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(nome);
}

function proximoId() {
  var dados = getSheet(ABA_TAREFAS).getDataRange().getValues();
  var max   = 0;
  for (var i = 1; i < dados.length; i++) {
    var id = parseInt(dados[i][COL.ID], 10);
    if (!isNaN(id) && id > max) max = id;
  }
  return max + 1;
}

function gravarLog(acao, campo, anterior, novo) {
  var log   = getSheet(ABA_LOG);
  var editor = Session.getActiveUser().getEmail();
  var idLog  = (log.getLastRow()) + 1;
  log.appendRow([idLog, new Date(), editor, acao, campo, anterior, novo]);
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

// ── criarTarefa ───────────────────────────────────────────────
function criarTarefa(dados) {
  var sheet = getSheet(ABA_TAREFAS);
  var id    = proximoId();
  var agora = new Date();
  var criador = Session.getActiveUser().getEmail();

  var prazo = dados.prazo ? new Date(dados.prazo) : '';

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
    true
  ]);

  gravarLog('CRIAR', 'Tarefa', '', dados.tarefa);

  if (dados.responsavel) {
    try { notificarResponsavel(dados, 'criacao'); } catch(e) { Logger.log('Email erro: ' + e.message); }
    try { criarEventoCalendar(dados, prazo); }      catch(e) { Logger.log('Calendar erro: ' + e.message); }
  }

  return { sucesso: true, id: id };
}

// ── atualizarTarefa ───────────────────────────────────────────
function atualizarTarefa(dados) {
  var sheet  = getSheet(ABA_TAREFAS);
  var linhas = sheet.getDataRange().getValues();

  for (var i = 1; i < linhas.length; i++) {
    if (String(linhas[i][COL.ID]) !== String(dados.id)) continue;

    // ── Verificação de permissão ──────────────────────────────
    var editor  = Session.getActiveUser().getEmail();
    var criador = String(linhas[i][COL.CRIADO_POR] || '');
    var admin   = isAdmin(editor);
    if (!admin && dados.status === 'Concluído' && dados.status !== linhas[i][COL.STATUS] && editor !== criador) {
      return { erro: 'Apenas quem criou a tarefa pode marcá-la como Concluída.' };
    }
    var prazoAtualStr = linhas[i][COL.PRAZO] ? new Date(linhas[i][COL.PRAZO]).toISOString().slice(0,10) : '';
    if (!admin && dados.prazo !== undefined && dados.prazo !== '' && dados.prazo !== prazoAtualStr && editor !== criador) {
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

    camposEditaveis.forEach(function(campo) {
      if (dados[campo] === undefined) return;
      var anterior = linhas[i][colMap[campo]];
      var novo     = campo === 'prazo' ? new Date(dados[campo]) : dados[campo];
      sheet.getRange(i + 1, colMap[campo] + 1).setValue(novo);
      gravarLog('ATUALIZAR', campo, anterior, novo);
    });

    if (dados.responsavel && dados.responsavel !== responsavelAnterior) {
      notificarResponsavel(dados, 'reatribuicao');
    }

    // Registrar mudança de status como interação automática
    if (dados.status !== undefined && dados.status !== statusAnterior) {
      var shtI = getSheet(ABA_INTERACOES);
      if (shtI) {
        var rowsI = shtI.getDataRange().getValues();
        var maxI  = 0;
        for (var k = 1; k < rowsI.length; k++) {
          var nk = parseInt(rowsI[k][0], 10);
          if (!isNaN(nk) && nk > maxI) maxI = nk;
        }
        shtI.appendRow([maxI + 1, dados.id, new Date(), Session.getActiveUser().getEmail(),
          'Atualização de status', '"' + statusAnterior + '" → "' + dados.status + '"']);
      }
    }

    return { sucesso: true };
  }

  return { erro: 'Tarefa não encontrada: ' + dados.id };
}

// ── excluirTarefa (soft delete) ───────────────────────────────
function excluirTarefa(dados) {
  var sheet  = getSheet(ABA_TAREFAS);
  var linhas = sheet.getDataRange().getValues();

  for (var i = 1; i < linhas.length; i++) {
    if (String(linhas[i][COL.ID]) !== String(dados.id)) continue;
    var editor  = Session.getActiveUser().getEmail();
    var criador = String(linhas[i][COL.CRIADO_POR] || '');
    if (editor !== criador && !isAdmin(editor)) {
      return { erro: 'Apenas o criador da tarefa pode excluí-la.' };
    }
    sheet.getRange(i + 1, COL.ATIVO + 1).setValue(false);
    gravarLog('EXCLUIR', 'Ativo', true, false);
    return { sucesso: true };
  }

  return { erro: 'Tarefa não encontrada: ' + dados.id };
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
  var sheet = getSheet(ABA_CKL_STATUS);
  if (!sheet) return { itens: [] };
  var dados  = sheet.getDataRange().getValues();
  var header = dados[0];
  var lista  = [];

  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    if (!linha[0] && !linha[1]) continue;
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

  // Remover linhas existentes para esta tarefa (em ordem reversa)
  var linhas = sheet.getDataRange().getValues();
  for (var i = linhas.length - 1; i >= 1; i--) {
    if (String(linhas[i][1]) === idTarefa) sheet.deleteRow(i + 1);
  }

  var itens = dados.itens || [];
  if (!itens.length) return { sucesso: true };

  // Calcular próximo ID
  var linhasApos = sheet.getDataRange().getValues();
  var idMax = 0;
  for (var j = 1; j < linhasApos.length; j++) {
    var n = parseInt(linhasApos[j][0], 10);
    if (!isNaN(n) && n > idMax) idMax = n;
  }

  var agora = new Date();
  itens.forEach(function(it) {
    var concluido = it.concluido === true || it.concluido === 'true';
    idMax++;
    sheet.appendRow([
      idMax,
      idTarefa,
      dados.template || '',
      it.item,
      it.ordem || 0,
      concluido,
      concluido ? agora : ''
    ]);
  });

  gravarLog('CHECKLIST', 'ID_Tarefa', '', idTarefa);
  return { sucesso: true };
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
    +     '<td style="padding:7px 0;font-weight:600">' + (dados.tarefa || '') + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#6c757d;border-top:1px solid #f1f1f1">Projeto</td>'
    +     '<td style="padding:7px 0;border-top:1px solid #f1f1f1">' + (dados.projeto || '—') + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#6c757d;border-top:1px solid #f1f1f1">Prazo</td>'
    +     '<td style="padding:7px 0;border-top:1px solid #f1f1f1">' + prazoFmt + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#6c757d;border-top:1px solid #f1f1f1">Prioridade</td>'
    +     '<td style="padding:7px 0;border-top:1px solid #f1f1f1">' + (dados.prioridade || '—') + '</td></tr>'
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
  if (!prazo) return;
  var titulo = '[' + (dados.tarefa || 'Tarefa') + '] — [' + (dados.projeto || '') + ']';
  var evento = CalendarApp.getDefaultCalendar().createAllDayEvent(titulo, prazo);
  if (dados.responsavel) {
    evento.addGuest(dados.responsavel);
  }
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
                  'Prioridade','Criado por','Data criação','Observações','Ativo'];
  tarefas.getRange(1, 1, 1, hTarefas.length).setValues([hTarefas])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  tarefas.setFrozenRows(1);

  var larguras = [50, 260, 160, 210, 100, 120, 100, 210, 140, 260, 55];
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

  var hCks = ['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão'];
  cks.getRange(1, 1, 1, hCks.length).setValues([hCks])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  cks.setFrozenRows(1);
  cks.getRange(2, 6, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE','FALSE'], true).build());
  [50, 80, 80, 300, 60, 80, 140].forEach(function(w, i) { cks.setColumnWidth(i + 1, w); });

  // ── Aba Interações ───────────────────────────────────────────
  var inter  = ss.getSheetByName(ABA_INTERACOES) || ss.insertSheet(ABA_INTERACOES);
  var hInter = ['ID','ID_Tarefa','Data/Hora','Editor','Tipo','Conteúdo'];
  inter.getRange(1, 1, 1, hInter.length).setValues([hInter])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  inter.setFrozenRows(1);
  [50, 80, 150, 210, 160, 350].forEach(function(w, i) { inter.setColumnWidth(i + 1, w); });

  // ── Aba Usuários ─────────────────────────────────────────────
  var usu = ss.getSheetByName(ABA_USUARIOS) || ss.insertSheet(ABA_USUARIOS);
  var hUsu = ['Nome', 'Email', 'Admin'];
  usu.getRange(1, 1, 1, hUsu.length).setValues([hUsu])
    .setBackground('#004e4c').setFontColor('#ffffff').setFontWeight('bold');
  usu.setFrozenRows(1);
  usu.getRange(2, 3, 999).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE','FALSE'], true).build());
  [220, 280, 80].forEach(function(w, i) { usu.setColumnWidth(i + 1, w); });

  SpreadsheetApp.flush();
  Logger.log('Setup concluído — abas criadas: Tarefas, Log, Checklists, Checklist_Status, Interações, Usuários');
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
  if (ultima > 1) usu.getRange(2, 1, ultima - 1, 3).clearContent();

  // [Nome, Email, Admin]
  var usuarios = [
    ['Vinicius Baião',              'vinicius.baiao@unimedcnu.coop.br',           true],
    ['Aurélio Corujeira',           'aurelio.pereira.ext@unimedcnu.coop.br',       true],
    ['Carlos Christian Simões',     'carlos.simoes@unimedcnu.coop.br',             false],
    ['Carolina Hashimoto',          'carolina.lopes@unimedcnu.coop.br',            false],
    ['Eduardo Caporicci',           'eduardo.caporicci@unimedcnu.coop.br',         false],
    ['Anastacia Semaan',            'tacia@unimedcnu.coop.br',                     false],
    ['Andressa Souza',              'andressa.souza.ext@unimedcnu.coop.br',        false],
    ['Lorena Paiva',                'redesalvador@unimedcnu.coop.br',              false],
    ['Flavia Coelho',               'flavia.coelho@unimedcnu.coop.br',             false],
    ['Tainara Bramont',             'tainara.conceicao@unimedcnu.coop.br',         false],
    ['Gabriel Boaventura',          'gabriel.boaventura@unimedcnu.coop.br',        false],
    ['Thais Conceição',             'thais.conceicao@unimedcnu.coop.br',           false],
    ['Priscila Amazonas',           'priscila.amazonas@unimedcnu.coop.br',         false],
    ['Mateus Cruz',                 'mateus.silva@unimedcnu.coop.br',              false],
    ['Maiara Atagiba',              'maiara.cardoso@unimedcnu.coop.br',            false],
    ['Ana Tarsis',                  'anatarsis.santos@unimedcnu.coop.br',          false],
    ['Marcos Paulo Pereira',        'marcos.pereira@unimedcnu.coop.br',            false],
    ['Andressa De Jesus Lima',      'andressa.lima@unimedcnu.coop.br',             false]
  ];

  usu.getRange(2, 1, usuarios.length, 3).setValues(usuarios);
  SpreadsheetApp.flush();
  Logger.log('popularUsuarios: ' + usuarios.length + ' usuários inseridos.');
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
  var linhas = sheet.getDataRange().getValues();
  var idMax  = 0;
  for (var i = 1; i < linhas.length; i++) {
    var n = parseInt(linhas[i][0], 10);
    if (!isNaN(n) && n > idMax) idMax = n;
  }
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
