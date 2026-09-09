// ============================================================
//  Importação de usuários — equipe de Atenção à Saúde (08/09/2026)
//  Execução MANUAL no editor do Apps Script. Nada aqui é roteado pelo doGet.
//
//  Ordem recomendada:
//    1. remapearEmailUsuario('guilherme.silva.ext@unimedcnu.coop.br',
//                            'guilherme.silva@unimedcnu.coop.br', true)  → confere
//       ... e depois com false                                          → grava
//    2. importarUsuariosEquipe(true)  → confere contagens no Logger
//       importarUsuariosEquipe(false) → grava
//
//  Fonte: planilha "Equipe Atenção a saúde.xlsx" (não versionada — dado
//  pessoal), aba Planilha2, 39 pessoas, mais a Fabiane (informada à parte).
//  A allowlist do piloto é a aba Usuários, então importar = liberar acesso.
// ============================================================

var UNIDADE_ONCO   = 'Núcleo de Oncologia e Alto Custo';
var UNIDADE_LINHAS = 'Linhas de Cuidado';
var PERFIL_GESTOR  = 'Gestor';
var PERFIL_PADRAO  = 'Usuário Padrão';

// [Nome, Email, Perfil, Unidade, Cargo] — mesma ordem da aba Usuários.
var EQUIPE_ATENCAO_SAUDE = [
  ['Adriana Ramos Johas',               'adriana.johas@unimedcnu.coop.br',          PERFIL_PADRAO, UNIDADE_ONCO,   'Enfermeiro de Núcleo do Cuidado'],
  ['Ariana Cristina Correia',           'ariana.correia@unimedcnu.coop.br',         PERFIL_PADRAO, UNIDADE_ONCO,   'Assistente Administrativo'],
  ['Cristiane Oltemann',                'cristiane.oltemann@unimednacional.coop.br', PERFIL_PADRAO, UNIDADE_ONCO,  'Assistente Social'],
  ['Cynthia Alves Gonzalez',            'cynthia.gonzalez@unimedcnu.coop.br',       PERFIL_PADRAO, UNIDADE_ONCO,   'Enfermeiro de Núcleo do Cuidado'],
  ['Gisele Sakamoto Sekino',            'gisele.sekino.ext@unimedcnu.coop.br',      PERFIL_PADRAO, UNIDADE_ONCO,   'Consultor'],
  ['Guilherme Souza Amorim',            'guilherme.amorim.ext@unimedcnu.coop.br',   PERFIL_PADRAO, UNIDADE_ONCO,   'Médico Consultor'],
  ['Lais Da Silva Teotonio',            'lais.teotonio@unimedcnu.coop.br',          PERFIL_PADRAO, UNIDADE_ONCO,   'Assistente Administrativo'],
  ['Lamia Fares',                       'lamia.fares@unimedcnu.coop.br',            PERFIL_PADRAO, UNIDADE_ONCO,   'Farmacêutico I'],
  ['Neusa Maria Da Rocha Cunha',        'neusa.cunha@unimedcnu.coop.br',            PERFIL_PADRAO, UNIDADE_ONCO,   'Farmacêutico I'],
  ['Patrick Luiz Da Silva',             'patrick.silva@unimedcnu.coop.br',          PERFIL_PADRAO, UNIDADE_ONCO,   'Auditor do Cuidado em Saúde I'],
  ['Renata C Spaggiari C N Sousa',      'renata.neves@unimedcnu.coop.br',           PERFIL_PADRAO, UNIDADE_ONCO,   'Enfermeiro de Núcleo do Cuidado'],
  ['Simone Rigler De Araujo',           'simone.araujo@unimedcnu.coop.br',          PERFIL_PADRAO, UNIDADE_ONCO,   'Analista de Atenção Integral à Saúde Pl'],
  ['Ananda Beatriz Gomes De Sousa',     'ananda.sousa@unimedcnu.coop.br',           PERFIL_PADRAO, UNIDADE_ONCO,   'Analista de Atenção Integral à Saúde Jr'],
  ['Taiara Rodrigues',                  'taiara.rodrigues@unimedcnu.coop.br',       PERFIL_GESTOR, UNIDADE_ONCO,   'Coordenador'],
  ['Aderlene Gurian',                   'aderlene.gurian@unimedcnu.coop.br',        PERFIL_PADRAO, UNIDADE_LINHAS, 'Analista de Atenção Integral à Saúde Jr'],
  ['Amanda Larissa Lima Flores',        'amanda.flores@unimedcnu.coop.br',          PERFIL_PADRAO, UNIDADE_LINHAS, 'Auditor do Cuidado em Saúde I'],
  ['Ana Carolina M L De Oliveira',      'ana.lemos@unimedcnu.coop.br',              PERFIL_PADRAO, UNIDADE_LINHAS, 'Auditor do Cuidado em Saúde I'],
  ['Bruna Aparecida De A Sousa',        'bruna.sousa@unimedcnu.coop.br',            PERFIL_PADRAO, UNIDADE_LINHAS, 'Analista de Atenção Integral à Saúde Jr'],
  ['Bruna De Oliveira Veiga',           'bruna.veiga@unimedcnu.coop.br',            PERFIL_PADRAO, UNIDADE_LINHAS, 'Analista de Atenção Integral à Saúde Sr'],
  ['Drielly Ap De Araujo Moreira',      'drielly.moreira@unimedcnu.coop.br',        PERFIL_PADRAO, UNIDADE_LINHAS, 'Técnico de Enfermagem'],
  ['Gabriel Gorios Martins',            'gabriel.martins@unimedcnu.coop.br',        PERFIL_PADRAO, UNIDADE_LINHAS, 'Técnico de Enfermagem'],
  ['Jessica Lorraine De Lemos',         'jessica.lemos@unimedcnu.coop.br',          PERFIL_PADRAO, UNIDADE_LINHAS, 'Analista de Atenção Integral à Saúde Jr'],
  ['Kelly Prosofsky Valerio',           'kelly.valerio@unimedcnu.coop.br',          PERFIL_PADRAO, UNIDADE_LINHAS, 'Auditor do Cuidado em Saúde I'],
  ['Ketlyn M De A Campos Silveira',     'ketlyn.silveira@unimedcnu.coop.br',        PERFIL_PADRAO, UNIDADE_LINHAS, 'Auditor do Cuidado em Saúde I'],
  ['Lucas Finzetto Lincon',             'lucas.lincon@unimedcnu.coop.br',           PERFIL_PADRAO, UNIDADE_LINHAS, 'Psicólogo'],
  ['Luciana Yoshie Konishi',            'luciana.konishi@unimedcnu.coop.br',        PERFIL_PADRAO, UNIDADE_LINHAS, 'Nutricionista'],
  ['Maria Juciclecia S B Da Silva',     'mariajucicleia.silva@unimedcnu.coop.br',   PERFIL_PADRAO, UNIDADE_LINHAS, 'Técnico de Enfermagem'],
  ['Valtemir Rodrigo O Santos',         'valtemir.santos@unimedcnu.coop.br',        PERFIL_PADRAO, UNIDADE_LINHAS, 'Técnico de Enfermagem'],
  ['Vitoria Fontes P D Bostigo',        'vitoria.bostigo@unimedcnu.coop.br',        PERFIL_PADRAO, UNIDADE_LINHAS, 'Analista de Atenção Integral à Saúde Jr'],
  ['Yasmin Ferreira Fiorotti',          'yasmin.fiorotti@unimedcnu.coop.br',        PERFIL_PADRAO, UNIDADE_LINHAS, 'Analista de Atenção Integral à Saúde Jr'],
  ['Diego Costa Araujo',                'diego.costa@unimedcnu.coop.br',            PERFIL_PADRAO, UNIDADE_LINHAS, 'Assistente Administrativo'],
  ['Pamela Cristina S De Paula',        'pamela.paula@unimedcnu.coop.br',           PERFIL_PADRAO, UNIDADE_LINHAS, 'Assistente Administrativo'],
  ['Sthefany Santana Da Silva',         'sthefany.silva@unimedcnu.coop.br',         PERFIL_PADRAO, UNIDADE_LINHAS, 'Analista Administrativo Jr'],
  ['Glaucia Berreta Ruggeri',           'glaucia.ruggeri@unimedcnu.coop.br',        PERFIL_GESTOR, UNIDADE_LINHAS, 'Consultor Médico de Atenção Integral à Saúde'],
  ['Higor Santos Silva Barradas',       'higor.barradas.ext@unimedcnu.coop.br',     PERFIL_PADRAO, UNIDADE_LINHAS, 'Auxiliar Administrativo'],
  ['Cristiane Vieira Da Silva Nobrega', 'cristiane.nobrega.ext@unimedcnu.coop.br',  PERFIL_PADRAO, UNIDADE_LINHAS, 'Médico'],
  ['Francisco De Assis Da Silva',       'francisco.silva@unimedcnu.coop.br',        PERFIL_PADRAO, UNIDADE_LINHAS, 'Supervisor'],
  ['Carina Milanez Guardia',            'carina.guardia@unimedcnu.coop.br',         PERFIL_GESTOR, UNIDADE_LINHAS, 'Supervisor'],
  ['Guilherme Borges G Da Silva',       'guilherme.silva@unimedcnu.coop.br',        PERFIL_GESTOR, UNIDADE_LINHAS, 'Coordenador'],
  // Não está na planilha da equipe; e-mail e cargo informados pelo Aurélio em 08/09/2026.
  // Responde pelas duas equipes, por isso sem Unidade.
  ['Fabiane Minozzo',                   'fabiane.minozzo@unimedcnu.coop.br',        PERFIL_GESTOR, '',             'Gerente']
];

function emailChave(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

// Puro: dado o conteúdo atual da aba Usuários (com cabeçalho) e a lista da
// equipe, devolve o que adicionar e o que atualizar. Regras: quem não existe
// entra; quem existe recebe Unidade e Cargo (quando não vazios) e sobe para
// Gestor se a lista disser Gestor — nunca rebaixa (Admin continua Admin) e
// o nome já cadastrado é preservado.
function planoImportacaoUsuarios(rowsAtuais, equipe) {
  var porEmail = {};
  for (var i = 1; i < rowsAtuais.length; i++) {
    var k = emailChave(rowsAtuais[i][1]);
    if (k) porEmail[k] = { linha: i + 1, row: rowsAtuais[i].slice() };
  }
  var adicionar = [], atualizar = [];
  equipe.forEach(function(u) {
    var k = emailChave(u[1]);
    var atual = porEmail[k];
    if (!atual) { adicionar.push(u.slice()); return; }
    var row = atual.row.slice();
    while (row.length < 5) row.push('');
    row[1] = u[1];
    if (u[2] === PERFIL_GESTOR && row[2] !== 'Admin') row[2] = PERFIL_GESTOR;
    if (!row[2]) row[2] = u[2];
    if (u[3]) row[3] = u[3];
    if (u[4]) row[4] = u[4];
    atualizar.push({ linha: atual.linha, row: row });
  });
  return { adicionar: adicionar, atualizar: atualizar };
}

function importarUsuariosEquipe(apenasSimular) {
  if (apenasSimular === undefined) apenasSimular = true;
  var sheet = getSheet(ABA_USUARIOS);
  if (!sheet) throw new Error('Aba Usuários não existe. Rode setup() primeiro.');
  var atuais = sheet.getDataRange().getValues();
  var plano  = planoImportacaoUsuarios(atuais, EQUIPE_ATENCAO_SAUDE);

  Logger.log('importarUsuariosEquipe' + (apenasSimular ? ' [SIMULAÇÃO]' : '') + ': ' +
    plano.adicionar.length + ' a adicionar, ' + plano.atualizar.length + ' a atualizar.');
  plano.adicionar.forEach(function(u) { Logger.log('  + ' + u[0] + ' <' + u[1] + '> ' + u[2]); });
  plano.atualizar.forEach(function(a) { Logger.log('  ~ linha ' + a.linha + ': ' + a.row[0] + ' <' + a.row[1] + '> ' + a.row[2] + ' · ' + a.row[3] + ' · ' + a.row[4]); });
  if (apenasSimular) return plano;

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var logs = [];
    plano.atualizar.forEach(function(a) {
      sheet.getRange(a.linha, 1, 1, 5).setValues([a.row.slice(0, 5)]);
      logs.push(['IMPORTAR_USUARIO', 'Atualizar', '', a.row[1] + ' → ' + a.row[2]]);
    });
    if (plano.adicionar.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, plano.adicionar.length, 5).setValues(plano.adicionar);
      plano.adicionar.forEach(function(u) { logs.push(['IMPORTAR_USUARIO', 'Email', '', u[1] + ' (' + u[2] + ')']); });
    }
    gravarLogs(logs);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  invalidarAba(ABA_USUARIOS);
  limparCachePerfis();
  limparCacheListas();
  Logger.log('importarUsuariosEquipe: gravado.');
  return plano;
}

// ── Troca de e-mail de um usuário ─────────────────────────────
// Caso concreto: Guilherme Borges virou CLT e a conta .ext foi abandonada.
// Troca nas abas Usuários (Email), Tarefas (Responsável e Criado por) e
// Checklist_Status (Responsavel). Log e Interações são histórico: ficam.
var REMAP_ALVOS = [
  { aba: 'Usuários',         colunas: [1] },
  { aba: 'Tarefas',          colunas: [3, 7] },   // COL.RESPONSAVEL, COL.CRIADO_POR
  { aba: 'Checklist_Status', colunas: [7] }
];

// Puro: {aba: rows} → lista de células {aba, linha, col} (1-based) a trocar.
function planoRemap(abasRows, de, para) {
  var alvo = emailChave(de), lista = [];
  REMAP_ALVOS.forEach(function(a) {
    var rows = abasRows[a.aba] || [];
    for (var i = 1; i < rows.length; i++) {
      a.colunas.forEach(function(c) {
        if (emailChave(rows[i][c]) === alvo) lista.push({ aba: a.aba, linha: i + 1, col: c + 1, de: rows[i][c], para: para });
      });
    }
  });
  return lista;
}

function remapearEmailUsuario(de, para, apenasSimular) {
  if (apenasSimular === undefined) apenasSimular = true;
  de = emailChave(de); para = emailChave(para);
  if (!de || !para) throw new Error('Informe os dois e-mails.');
  var dominioOk = DOMINIOS_PERMITIDOS.some(function(d) { return para.slice(-d.length) === d; });
  if (!dominioOk) throw new Error('E-mail novo precisa ser ' + DOMINIOS_PERMITIDOS.join(' ou '));

  var abasRows = {};
  REMAP_ALVOS.forEach(function(a) { var sh = getSheet(a.aba); abasRows[a.aba] = sh ? sh.getDataRange().getValues() : []; });
  var plano = planoRemap(abasRows, de, para);
  Logger.log('remapearEmailUsuario' + (apenasSimular ? ' [SIMULAÇÃO]' : '') + ': ' + de + ' → ' + para + ' · ' + plano.length + ' célula(s).');
  plano.forEach(function(c) { Logger.log('  ' + c.aba + ' linha ' + c.linha + ' col ' + c.col); });
  if (apenasSimular || !plano.length) return plano;

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var logs = [];
    plano.forEach(function(c) {
      getSheet(c.aba).getRange(c.linha, c.col).setValue(para);
      logs.push(['REMAPEAR_EMAIL', c.aba + '!L' + c.linha + 'C' + c.col, c.de, para]);
    });
    gravarLogs(logs);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  REMAP_ALVOS.forEach(function(a) { invalidarAba(a.aba); });
  limparCachePerfis();
  limparCacheListas();
  Logger.log('remapearEmailUsuario: gravado.');
  return plano;
}
