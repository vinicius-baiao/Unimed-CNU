// ============================================================
//  Tarefas CNU — Backend (Apps Script)
// ============================================================

var SHEET_ID   = '';  // preencher após criar a planilha
var ABA_TAREFAS = 'Tarefas';
var ABA_LOG     = 'Log';

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

  var resultado;
  try {
    switch (acao) {
      case 'listarTarefas':   resultado = listarTarefas();          break;
      case 'criarTarefa':     resultado = criarTarefa(dados);       break;
      case 'atualizarTarefa': resultado = atualizarTarefa(dados);   break;
      case 'excluirTarefa':   resultado = excluirTarefa(dados);     break;
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
    notificarResponsavel(dados, 'criacao');
    criarEventoCalendar(dados, prazo);
  }

  return { sucesso: true, id: id };
}

// ── atualizarTarefa ───────────────────────────────────────────
function atualizarTarefa(dados) {
  var sheet  = getSheet(ABA_TAREFAS);
  var linhas = sheet.getDataRange().getValues();

  for (var i = 1; i < linhas.length; i++) {
    if (String(linhas[i][COL.ID]) !== String(dados.id)) continue;

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
    sheet.getRange(i + 1, COL.ATIVO + 1).setValue(false);
    gravarLog('EXCLUIR', 'Ativo', true, false);
    return { sucesso: true };
  }

  return { erro: 'Tarefa não encontrada: ' + dados.id };
}

// ── Notificações e Calendar ───────────────────────────────────
function notificarResponsavel(dados, tipo) {
  var assuntos = {
    criacao:     '[Tarefas CNU] Nova tarefa atribuída a você',
    reatribuicao:'[Tarefas CNU] Tarefa reatribuída a você'
  };
  var corpo = 'Olá,\n\n'
    + 'Tarefa: '   + (dados.tarefa    || '') + '\n'
    + 'Projeto: '  + (dados.projeto   || '') + '\n'
    + 'Prazo: '    + (dados.prazo     || '') + '\n'
    + 'Prioridade: '+ (dados.prioridade|| '') + '\n\n'
    + 'Acesse o painel para mais detalhes.\n\nUnimed CNU';

  MailApp.sendEmail({
    to:      dados.responsavel,
    subject: assuntos[tipo] || assuntos.criacao,
    body:    corpo
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

  SpreadsheetApp.flush();
  Logger.log('Setup concluído — abas criadas: Tarefas, Log, Checklists, Checklist_Status');
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

    MailApp.sendEmail({
      to:      responsavel,
      subject: '[Tarefas CNU] Lembrete: tarefa vence amanhã',
      body:    'Olá,\n\nA tarefa "' + linha[COL.TAREFA] + '" do projeto "'
               + linha[COL.PROJETO] + '" vence amanhã.\n\nUnimed CNU'
    });
  }
}
