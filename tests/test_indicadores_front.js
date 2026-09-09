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

// ───────────── Bloco 2: ações, matriz e alertas (monitoramento) ─────────────
{
  const txt = a => a.partes.map(p => p.texto).join('');
  const tarefas2 = tarefas.map(t => Object.assign({}, t));
  tarefas2[0].Prioridade = 'Crítica';                 // t1: atrasada + crítica
  const movimento = { '1': '2026-08-25T10:00:00', '2': '2026-09-07T09:00:00', '5': '2026-08-30T08:00:00', '6': '2026-09-08T08:00:00' }; // t3 sem movimento
  const dados2 = { tarefas: tarefas2, cklStatus, usuarios, projetos, movimento };
  const F = { unidade: '', projeto: '', janelaDias: 7, paradaDias: 7 };

  const r = calcular(dados2, F, HOJE, deps);
  assert.deepStrictEqual(r.acoes.map(a => a.id), [1, 5, 3, 2, 6], 'ordem: sev asc, diasAtraso desc');
  const a1 = r.acoes[0], a5 = r.acoes[1], a3 = r.acoes[2], a2 = r.acoes[3], a6 = r.acoes[4];
  assert.deepStrictEqual({ sev: a1.severidade, atraso: a1.diasAtraso, parada: a1.diasParada, flags: a1.flags, nome: a1.responsavelNome, cor: a1.cor, ckl: [a1.cklFeitos, a1.cklTotal] },
    { sev: 1, atraso: 7, parada: 14, flags: { atrasadaCritica: true, atrasada: true, bloqueada: false, parada: true, vence: false, semResponsavel: false, semPrazo: false }, nome: 'Ana Souza', cor: '#111111', ckl: [1, 2] });
  assert.deepStrictEqual({ sev: a5.severidade, atraso: a5.diasAtraso, parada: a5.diasParada, semResp: a5.flags.semResponsavel, nome: a5.responsavelNome }, { sev: 2, atraso: 3, parada: 9, semResp: true, nome: '' });
  assert.deepStrictEqual({ sev: a3.severidade, parada: a3.diasParada, mov: a3.ultimaMov, paraPrazo: a3.diasParaPrazo }, { sev: 3, parada: null, mov: null, paraPrazo: 22 }, 'sem movimento conhecido → diasParada null');
  assert.deepStrictEqual({ sev: a2.severidade, vence: a2.flags.vence, paraPrazo: a2.diasParaPrazo, parada: a2.diasParada }, { sev: 5, vence: true, paraPrazo: 2, parada: 1 });
  assert.deepStrictEqual({ sev: a6.severidade, semPrazo: a6.flags.semPrazo, paraPrazo: a6.diasParaPrazo, nome: a6.responsavelNome, atraso: a6.diasAtraso }, { sev: 7, semPrazo: true, paraPrazo: null, nome: 'Zeca Ninguem', atraso: 0 });
  assert.ok(!r.acoes.some(a => a.id === 4), 'concluída não entra em acoes');

  // matriz
  assert.deepStrictEqual(r.matriz.linhas, ['Crítica', 'Alta', 'Média', 'Baixa']);
  assert.deepStrictEqual(r.matriz.colunas, ['Atrasada', 'Bloqueada', 'Em andamento', 'A fazer']);
  assert.deepStrictEqual(r.matriz.celulas['Crítica'], { 'Atrasada': 1, 'Bloqueada': 0, 'Em andamento': 0, 'A fazer': 0 });
  assert.deepStrictEqual(r.matriz.celulas['Média'],   { 'Atrasada': 1, 'Bloqueada': 1, 'Em andamento': 0, 'A fazer': 2 }, 'atrasada tem precedência sobre status; Backlog conta como A fazer');
  assert.strictEqual(r.matriz.total, 5);
  assert.deepStrictEqual([a1.matrizLinha, a1.matrizColuna, a3.matrizColuna, a6.matrizColuna], ['Crítica', 'Atrasada', 'Bloqueada', 'A fazer']);

  // alertas (regra 4 não dispara: Ana tem 1 atrasada)
  assert.deepStrictEqual(r.alertas.map(txt), [
    '1 ação crítica/alta atrasada em P1',
    '2 ações sem movimento há 7 dias ou mais',
    '1 ação sem responsável',
    '1 ação vence nos próximos 7 dias'
  ]);
  assert.deepStrictEqual(r.alertas[0].filtro, { flag: 'atrasadaCritica', projeto: 'P1' });
  assert.deepStrictEqual([r.alertas[1].filtro, r.alertas[2].filtro, r.alertas[3].filtro], [{ flag: 'parada' }, { flag: 'semResponsavel' }, { flag: 'vence' }]);
  assert.ok(r.alertas.every(a => a.aba === 'acoes'));
  assert.deepStrictEqual(r.alertas[0].partes.map(p => p.forte), [true, false, true], 'número e projeto em destaque');

  // sem mapa de movimento: nenhuma parada, diasParada null, alerta de estagnação ausente
  const r0 = calcular({ tarefas: tarefas2, cklStatus, usuarios, projetos, movimento: null }, F, HOJE, deps);
  assert.ok(r0.acoes.every(a => a.diasParada === null && !a.flags.parada));
  assert.deepStrictEqual(r0.alertas.map(txt), ['1 ação crítica/alta atrasada em P1', '1 ação sem responsável', '1 ação vence nos próximos 7 dias']);

  // paradaDias maior: só t1 (14 d) fica parada
  const r30 = calcular(dados2, Object.assign({}, F, { paradaDias: 10 }), HOJE, deps);
  assert.deepStrictEqual(r30.acoes.filter(a => a.flags.parada).map(a => a.id), [1]);
  assert.strictEqual(txt(r30.alertas[1]), '1 ação sem movimento há 10 dias ou mais');

  // filtro de projeto restringe acoes/matriz/alertas; filtro de unidade não afeta acoes
  const rp = calcular(dados2, Object.assign({}, F, { projeto: 'P1' }), HOJE, deps);
  assert.deepStrictEqual(rp.acoes.map(a => a.id), [1, 3, 2]);
  assert.strictEqual(rp.matriz.total, 3);
  assert.deepStrictEqual(rp.alertas.map(txt), ['1 ação crítica/alta atrasada em P1', '1 ação sem movimento há 7 dias ou mais', '1 ação vence nos próximos 7 dias']);
  const ru = calcular(dados2, Object.assign({}, F, { unidade: 'Onco' }), HOJE, deps);
  assert.strictEqual(ru.acoes.length, 5);

  // regra 4: pessoa que concentra ≥ 2 atrasadas (sobre pessoas já filtradas por unidade)
  const tarefas3 = tarefas2.concat([T(7, 'P1', ANA, '2026-09-02', 'A fazer')]);
  const r4 = calcular({ tarefas: tarefas3, cklStatus, usuarios, projetos, movimento }, F, HOJE, deps);
  const a4 = r4.alertas.filter(a => a.aba === 'pessoas')[0];
  assert.ok(a4, 'alerta de pessoa presente');
  assert.strictEqual(txt(a4), 'Ana Souza concentra 2 ações atrasadas');
  assert.deepStrictEqual(a4.filtro, { pessoa: ANA });
  const r4u = calcular({ tarefas: tarefas3, cklStatus, usuarios, projetos, movimento }, Object.assign({}, F, { unidade: 'Onco' }), HOJE, deps);
  assert.ok(!r4u.alertas.some(a => a.aba === 'pessoas'), 'Ana é de Rede: com filtro Onco a regra 4 não dispara');

  // limite: no máximo 5 alertas e no máximo 3 da regra 1
  const muitos = tarefas2.concat([T(8, 'P2', ANA, '2026-09-01', 'A fazer'), T(9, 'P3', ANA, '2026-09-01', 'A fazer'), T(10, 'P4', ANA, '2026-09-01', 'A fazer')].map(t => Object.assign(t, { Prioridade: 'Alta' })));
  const rm = calcular({ tarefas: muitos, cklStatus, usuarios, projetos, movimento }, F, HOJE, deps);
  assert.strictEqual(rm.alertas.length, 5);
  assert.strictEqual(rm.alertas.filter(a => a.filtro && a.filtro.flag === 'atrasadaCritica').length, 3);

  // sem nada a apontar: lista vazia
  const calmo = [T(11, 'P1', ANA, '2026-12-01', 'Em andamento')];
  const rc = calcular({ tarefas: calmo, cklStatus: {}, usuarios, projetos, movimento: { '11': '2026-09-08T08:00:00' } }, F, HOJE, deps);
  assert.deepStrictEqual(rc.alertas, []);
  assert.strictEqual(rc.acoes[0].severidade, 9);
}
