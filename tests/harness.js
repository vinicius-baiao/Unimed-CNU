// Harness de testes para os .gs do Cora (Node, sem dependências).
// Carrega Code.gs + ImportacaoPlanos.gs + ImportacaoUsuarios.gs num contexto
// `vm` com stubs mínimos dos serviços do Apps Script.
//
//   var ctx = carregar({ abas: { Tarefas: [[...]], ... }, email: 'x@unimedcnu.coop.br' });
//   ctx.listarTarefas()  ...
//
// Registros úteis no contexto:
//   ctx._escritas  → [{aba, op, args}] de appendRow/setValue/setValues/deleteRow
//   ctx._cache     → mapa em memória do CacheService
//   ctx._logs      → linhas do Logger.log
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = ['Code.gs', 'ImportacaoPlanos.gs', 'ImportacaoUsuarios.gs'];

function pad(n) { return n < 10 ? '0' + n : String(n); }

function fmtDate(d, fmt) {
  d = d instanceof Date ? d : new Date(d);
  return fmt
    .replace('yyyy', d.getFullYear())
    .replace('MM', pad(d.getMonth() + 1))
    .replace('dd', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()))
    .replace("'T'", 'T');
}

function novaAba(nome, matriz, escritas) {
  const dados = matriz.map(l => l.slice());
  function garantir(r, c) {
    while (dados.length < r) dados.push([]);
    for (let i = 0; i < dados.length; i++) while (dados[i].length < c) dados[i].push('');
  }
  const aba = {
    _nome: nome,
    _dados: dados,
    getName() { return nome; },
    getDataRange() { return { getValues: () => dados.map(l => l.slice()), getDisplayValues: () => dados.map(l => l.map(v => v == null ? '' : String(v))) }; },
    getLastRow() { return dados.length; },
    getLastColumn() { return dados.reduce((m, l) => Math.max(m, l.length), 0); },
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      return {
        getValue() { return (dados[r - 1] || [])[c - 1]; },
        getDisplayValue() { const v = (dados[r - 1] || [])[c - 1]; return v == null ? '' : String(v); },
        getValues() { const out = []; for (let i = 0; i < nr; i++) out.push(((dados[r - 1 + i]) || []).slice(c - 1, c - 1 + nc)); return out; },
        getDisplayValues() { return this.getValues().map(l => l.map(v => v == null ? '' : String(v))); },
        setValue(v) { garantir(r, c); dados[r - 1][c - 1] = v; escritas.push({ aba: nome, op: 'setValue', args: [r, c, v] }); return this; },
        setValues(m) { garantir(r + m.length - 1, c + (m[0] || []).length - 1); m.forEach((l, i) => l.forEach((v, j) => { dados[r - 1 + i][c - 1 + j] = v; })); escritas.push({ aba: nome, op: 'setValues', args: [r, c, m] }); return this; },
        setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; },
        setDataValidation() { return this; }, setNumberFormat() { return this; }, clearContent() { return this; }
      };
    },
    appendRow(l) { dados.push(l.slice()); escritas.push({ aba: nome, op: 'appendRow', args: l.slice() }); return aba; },
    deleteRow(r) { dados.splice(r - 1, 1); escritas.push({ aba: nome, op: 'deleteRow', args: [r] }); return aba; },
    setFrozenRows() { return aba; }, setColumnWidth() { return aba; }, setColumnWidths() { return aba; }
  };
  return aba;
}

function novaPlanilha(id, abasIn, escritas) {
  const abas = {};
  Object.keys(abasIn || {}).forEach(n => { abas[n] = novaAba(n, abasIn[n], escritas); });
  return {
    getId() { return id; },
    getName() { return 'Planilha ' + id; },
    getSheetByName(n) { return abas[n] || null; },
    getSheets() { return Object.keys(abas).map(n => abas[n]); },
    insertSheet(n) { abas[n] = novaAba(n, [], escritas); return abas[n]; }
  };
}

function carregar(stubs) {
  stubs = stubs || {};
  const escritas = [], cache = {}, logs = [], emails = [];
  const planilhas = {};                       // id → planilha fake
  const principal = novaPlanilha('PRINCIPAL', stubs.abas || {}, escritas);
  Object.keys(stubs.planilhas || {}).forEach(id => { planilhas[id] = novaPlanilha(id, stubs.planilhas[id], escritas); });
  const props = Object.assign({}, stubs.props || {});

  const sandbox = {
    console,
    _escritas: escritas, _cache: cache, _logs: logs, _emails: emails, _planilhas: planilhas, _principal: principal,
    SpreadsheetApp: {
      openById(id) { if (planilhas[id]) return planilhas[id]; return principal; },
      getActiveSpreadsheet() { return principal; },
      create(nome) { const p = novaPlanilha('NOVA_' + Object.keys(planilhas).length, {}, escritas); planilhas[p.getId()] = p; return p; },
      flush() {},
      newDataValidation() { const b = { requireValueInList() { return b; }, requireDate() { return b; }, build() { return {}; } }; return b; }
    },
    Session: {
      getActiveUser() { return { getEmail: () => stubs.email === undefined ? 'aurelio.pereira.ext@unimedcnu.coop.br' : stubs.email }; },
      getEffectiveUser() { return { getEmail: () => 'aurelio.pereira.ext@unimedcnu.coop.br' }; },
      getScriptTimeZone() { return 'America/Sao_Paulo'; }
    },
    CacheService: {
      getScriptCache() {
        return {
          get: k => (k in cache ? cache[k] : null),
          put: (k, v) => { cache[k] = v; },
          remove: k => { delete cache[k]; },
          removeAll: ks => { ks.forEach(k => delete cache[k]); }
        };
      }
    },
    LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {}, tryLock() { return true; } }; } },
    PropertiesService: { getScriptProperties() { return { getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }; } },
    Utilities: { formatDate: fmtDate, sleep() {}, base64Encode: s => Buffer.from(s).toString('base64') },
    Logger: { log(m) { logs.push(String(m)); } },
    ScriptApp: { getService() { return { getUrl: () => 'https://script.google.com/a/macros/unimedcnu.coop.br/s/FAKE/exec' }; } },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutput() { const o = { setTitle() { return o; }, setXFrameOptionsMode() { return o; } }; return o; },
      createHtmlOutputFromFile() { return { getContent: () => '' }; },
      createTemplateFromFile() { const t = { evaluate() { const o = { setTitle() { return o; }, setXFrameOptionsMode() { return o; }, addMetaTag() { return o; } }; return o; } }; return t; }
    },
    ContentService: {
      MimeType: { JAVASCRIPT: 'js', JSON: 'json' },
      createTextOutput(t) { const o = { _texto: t, setMimeType() { return o; }, getContent: () => t }; return o; }
    },
    MailApp: { sendEmail(o) { emails.push(o); } },
    GmailApp: { getAliases() { return []; }, sendEmail(a, s, b, o) { emails.push({ to: a, subject: s, body: b, opts: o }); } },
    CalendarApp: { getDefaultCalendar() { return { createAllDayEvent() { return { getId: () => 'EV' }; } }; }, getEventById() { return null; } },
    DriveApp: {
      getFilesByName(nome) {
        const lista = (stubs.drive && stubs.drive[nome]) || [];
        let i = 0;
        return { hasNext: () => i < lista.length, next: () => ({ getId: () => lista[i++] }) };
      }
    }
  };
  const ctx = vm.createContext(sandbox);
  ARQUIVOS.forEach(f => {
    const p = path.join(RAIZ, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  });
  return ctx;
}

module.exports = { carregar };
