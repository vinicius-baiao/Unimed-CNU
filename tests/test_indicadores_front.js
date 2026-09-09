// Testa calcularIndicadores() do front: extrai o trecho entre os marcadores
// /* @indicadores:inicio */ ... /* @indicadores:fim */ de tarefas-shadcn.html e roda num vm.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'tarefas-shadcn.html'), 'utf8');
const ini = html.indexOf('/* @indicadores:inicio */'), fim = html.indexOf('/* @indicadores:fim */');
assert.ok(ini > -1 && fim > ini, 'marcadores @indicadores não encontrados em tarefas-shadcn.html');
// Roda no contexto atual (não num vm isolado): assert.deepStrictEqual compara protótipos, e um
// contexto separado teria outro Array — os arrays devolvidos pela função falhariam a comparação.
vm.runInThisContext(html.slice(ini, fim), { filename: 'indicadores.js' });
const calcular = global.calcularIndicadores;
assert.strictEqual(typeof calcular, 'function', 'calcularIndicadores deve existir no trecho marcado');

// deps iguais às do front
function parseData(v) { if (v instanceof Date) return v; const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); return new Date(v); }
function dataValida(v) { if (!v) return false; const d = parseData(v); return !isNaN(d.getTime()) && d.getFullYear() >= 2000; }
function nomeDeEmail(e) { const l = String(e || '').split('@')[0]; if (!l) return ''; return l.split(/[._-]+/).filter(p => p && p.toLowerCase() !== 'ext').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' '); }
const deps = { parseData, dataValida, nomeDeEmail };
const HOJE = new Date(2026, 8, 8); // 08/09/2026

const ANA = 'ana@x.test', BRU = 'bruno@x.test', ZECA = 'zeca.ninguem@x.test';
const usuarios = [
  { nome: 'Ana Souza',  email: ANA, perfil: 'Gestor',         unidade: 'Rede', cargo: 'Coordenadora' },
  { nome: 'Bruno Lima', email: BRU, perfil: 'Usuário Padrão', unidade: 'Onco', cargo: 'Analista' }
];
const T = (id, proj, resp, prazo, status) => ({ ID: id, Tarefa: 't' + id, Projeto: proj, 'Responsável': resp, Prazo: prazo, Status: status, Prioridade: 'Média' });
const tarefas = [
  T(1, 'P1', ANA,  '2026-09-01', 'Em andamento'), // atrasada + em andamento
  T(2, 'P1', ANA,  '2026-09-10', 'A fazer'),      // próxima (dentro de 7 dias)
  T(3, 'P1', BRU,  '2026-09-30', 'Bloqueado'),    // bloqueada; próxima só com janela 30
  T(4, 'P2', ANA,  '2026-08-01', 'Concluído'),    // concluída: nunca atrasada/próxima
  T(5, 'P2', '',   '2026-09-05', 'Backlog'),      // sem responsável, atrasada
  T(6, 'P2', ZECA, '',           'A fazer')       // sem prazo; pessoa fora da aba Usuários
];
const cklStatus = {
  '1': [{ Responsavel: BRU, 'Concluído': false }, { Responsavel: BRU, 'Concluído': true }],
  '3': [{ Responsavel: '',  'Concluído': false }],
  '4': [{ Responsavel: BRU, 'Concluído': false }] // tarefa concluída: não conta
};
const projetos = [
  { id: 1, nome: 'P1', cor: '#111111', publico: false },
  { id: 2, nome: 'P2', cor: '#222222', publico: true },
  { id: 3, nome: 'P3', cor: '#333333', publico: false } // sem tarefas: aparece com zeros
];
const dados = { tarefas, cklStatus, usuarios, projetos };
const por = (lista, nome) => lista.filter(x => x.nome === nome)[0];

// 1. contagens por pessoa, sem filtros, janela 7
{
  const r = calcular(dados, { unidade: '', projeto: '', janelaDias: 7 }, HOJE, deps);
  assert.deepStrictEqual(r.pessoas.map(p => p.nome), ['Ana Souza', 'Bruno Lima', 'Zeca Ninguem'], 'ordem: atrasadas desc, ativas desc, nome asc');
  const ana = por(r.pessoas, 'Ana Souza');
  assert.deepStrictEqual({ ativas: ana.ativas, andamento: ana.andamento, bloqueadas: ana.bloqueadas, atrasadas: ana.atrasadas, proximas: ana.proximas, itensPendentes: ana.itensPendentes, concluidas: ana.concluidas, unidade: ana.unidade, cargo: ana.cargo },
    { ativas: 2, andamento: 1, bloqueadas: 0, atrasadas: 1, proximas: 1, itensPendentes: 0, concluidas: 1, unidade: 'Rede', cargo: 'Coordenadora' });
  const bru = por(r.pessoas, 'Bruno Lima');
  assert.deepStrictEqual({ ativas: bru.ativas, bloqueadas: bru.bloqueadas, atrasadas: bru.atrasadas, proximas: bru.proximas, itensPendentes: bru.itensPendentes, concluidas: bru.concluidas },
    { ativas: 1, bloqueadas: 1, atrasadas: 0, proximas: 0, itensPendentes: 1, concluidas: 0 }, 'item feito e item de tarefa concluída não contam');
  // 6. pessoa fora da aba Usuários
  const zeca = por(r.pessoas, 'Zeca Ninguem');
  assert.deepStrictEqual({ email: zeca.email, unidade: zeca.unidade, cargo: zeca.cargo, ativas: zeca.ativas, atrasadas: zeca.atrasadas, proximas: zeca.proximas }, { email: ZECA, unidade: '', cargo: '', ativas: 1, atrasadas: 0, proximas: 0 }, 'sem prazo não é atrasada nem próxima');
  // 2. sem responsável
  assert.ok(r.semResponsavel, 'há tarefa ativa sem dono');
  assert.deepStrictEqual({ nome: r.semResponsavel.nome, ativas: r.semResponsavel.ativas, atrasadas: r.semResponsavel.atrasadas }, { nome: 'Sem responsável', ativas: 1, atrasadas: 1 });
  // 5. projetos
  assert.deepStrictEqual(r.projetos.map(p => p.nome), ['P1', 'P2', 'P3'], 'ordem: atrasadas desc, bloqueadas desc, pct asc, nome');
  const p1 = por(r.projetos, 'P1'), p2 = por(r.projetos, 'P2'), p3 = por(r.projetos, 'P3');
  assert.deepStrictEqual({ total: p1.total, concluidas: p1.concluidas, pct: p1.pct, andamento: p1.andamento, bloqueadas: p1.bloqueadas, atrasadas: p1.atrasadas, proximas: p1.proximas, cklTotal: p1.cklTotal, cklFeitos: p1.cklFeitos, cor: p1.cor, publico: p1.publico },
    { total: 3, concluidas: 0, pct: 0, andamento: 1, bloqueadas: 1, atrasadas: 1, proximas: 1, cklTotal: 3, cklFeitos: 1, cor: '#111111', publico: false });
  assert.deepStrictEqual({ total: p2.total, concluidas: p2.concluidas, pct: p2.pct, atrasadas: p2.atrasadas, cklTotal: p2.cklTotal, publico: p2.publico }, { total: 3, concluidas: 1, pct: 33, atrasadas: 1, cklTotal: 0, publico: true }, 'pct arredondado; itens de tarefa concluída não contam');
  assert.deepStrictEqual({ total: p3.total, pct: p3.pct, cor: p3.cor }, { total: 0, pct: 0, cor: '#333333' }, 'projeto sem tarefa aparece com zeros');
  // totais
  assert.deepStrictEqual(r.totais, { ativas: 5, atrasadas: 2, bloqueadas: 1, proximas: 1 });
  // 7. concluída não é atrasada nem próxima: t4 (prazo 2026-08-01, concluída) não entrou em atrasadas de Ana nem de P2 além da t5
  assert.strictEqual(ana.atrasadas, 1); assert.strictEqual(p2.atrasadas, 1);
}

// 3. filtro de unidade: só pessoas da unidade, sem "Sem responsável", projetos intactos
{
  const r = calcular(dados, { unidade: 'Rede', projeto: '', janelaDias: 7 }, HOJE, deps);
  assert.deepStrictEqual(r.pessoas.map(p => p.nome), ['Ana Souza']);
  assert.strictEqual(r.semResponsavel, null);
  assert.strictEqual(r.projetos.length, 3);
}

// 4. filtro de projeto restringe as duas seções
{
  const r = calcular(dados, { unidade: '', projeto: 'P2', janelaDias: 7 }, HOJE, deps);
  assert.deepStrictEqual(r.pessoas.map(p => p.nome), ['Zeca Ninguem', 'Ana Souza'], 'Zeca 1 ativa; Ana só concluída (0 ativas); Bruno fora (item em tarefa concluída)');
  assert.strictEqual(por(r.pessoas, 'Ana Souza').concluidas, 1);
  assert.ok(r.semResponsavel && r.semResponsavel.atrasadas === 1);
  assert.deepStrictEqual(r.projetos.map(p => p.nome), ['P2']);
  assert.deepStrictEqual(r.totais, { ativas: 2, atrasadas: 1, bloqueadas: 0, proximas: 0 });
}

// janela de 30 dias alcança a bloqueada de Bruno
{
  const r = calcular(dados, { unidade: '', projeto: '', janelaDias: 30 }, HOJE, deps);
  assert.strictEqual(por(r.pessoas, 'Bruno Lima').proximas, 1);
  assert.strictEqual(r.totais.proximas, 2);
}
