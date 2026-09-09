'use strict';
const assert = require('assert');
const { carregar } = require('./harness');
const J = v => JSON.parse(JSON.stringify(v));

const ADMIN = 'aurelio.pereira.ext@unimedcnu.coop.br';
const SPR_ID = '1nZGEIK0T4lJBc9HrSEg3x8YIXkNlwlRjOUo11meoqA4'.replace('N', 'X'); // qualquer id; o teste injeta
const PF_NOME = 'Raio X PF — Plano de Ação (armazenamento)';
const cabPA = ['ID', 'Status', 'Prazo', 'Atualizado em', 'Atualizado por', 'Título', 'Descrição'];
const cabT = ['ID','Tarefa','Projeto','Responsável','Prazo','Status','Prioridade','Criado por','Data criação','Observações','Ativo','Event ID'];
const cabC = ['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão','Responsavel'];
const cabP = ['ID','Nome','Descrição','Cor','Ativo','Publico'];

function base() {
  return {
    Usuários: [['Nome','Email','Perfil','Unidade','Cargo'], ['A', ADMIN, 'Admin', '', '']],
    Projetos: [cabP, [1,'Gestão de Demandas','','#004e4c',true,false], [7,'Atenção à Saúde','','#f59f00',true,false]],
    Tarefas: [cabT, [1,'existente','Gestão de Demandas',ADMIN,'','A fazer','Média',ADMIN,new Date(),'',true,'']],
    Checklist_Status: [cabC, [5,1,'','x',1,false,'','']],
    Log: [['ID','Data/Hora','Editor','Ação','Campo','Valor Anterior','Valor Novo']]
  };
}

// constantes e conversões puras
{
  const ctx = carregar({ abas: base() });
  const gt = J(ctx.PLANO_GT);
  assert.strictEqual(gt.length, 18);   // 1..21 menos as canceladas 9, 18 e 19
  assert.strictEqual(gt.reduce((s, m) => s + m.itens.length, 0), 34);
  assert.ok(gt.every(m => [9, 18, 19].indexOf(m.n) < 0), 'canceladas fora');
  assert.ok(gt.every(m => ['Concluído', 'Em andamento', 'A fazer'].indexOf(m.status) >= 0));
  assert.ok(gt.every(m => ['', 'guilherme', 'fabiane', 'taiara'].indexOf(m.resp) >= 0));
  assert.ok(gt.every(m => m.prazo === '' || /^\d{4}-\d{2}-\d{2}$/.test(m.prazo)));
  assert.strictEqual(gt.find(m => m.n === 3).prazo, '2026-06-30', 'ação 3 fica atrasada de propósito');
  assert.strictEqual(gt.find(m => m.n === 1).itens.filter(i => i.feito).length, 6);
  assert.strictEqual(gt.find(m => m.n === 5).itens.filter(i => i.feito).length, 1);
  assert.strictEqual(J(ctx.PLANO_SPRAVATO_FIXOS).length, 8);
  assert.strictEqual(J(ctx.PLANO_PF_FIXOS).length, 12);
  assert.deepStrictEqual(J(ctx.PROJETOS_PLANO).map(p => p.nome), ['Spravato', 'Carteira PF', 'GT Onco']);

  const c = J(ctx.converterAcaoPainel({ titulo: '💰 Oncologia — o maior vetor', desc: 'd', status: 'concluída', prazo: '2026-01-05' }, 'pf#custo-onco'));
  assert.deepStrictEqual(c, { tarefa: 'Oncologia — o maior vetor', status: 'Concluído', prazo: '2026-01-05', observacoes: 'd\nOrigem: pf#custo-onco', marca: 'pf#custo-onco' });
  assert.strictEqual(ctx.converterAcaoPainel({ titulo: 'X', status: 'backlog', prazo: '05/01/2026' }, 'a#b').prazo, '', 'prazo fora do formato cai');
  assert.strictEqual(ctx.converterAcaoPainel({ titulo: 'X', status: 'qualquer' }, 'a#b').status, 'Backlog');
  assert.strictEqual(ctx.converterAcaoPainel({ titulo: '⚖️ Liminares', status: 'em andamento' }, 'a#b').tarefa, 'Liminares');

  const fixos = [{ id: 'p', titulo: 'P', desc: 'dp', statusPadrao: 'concluída' }, { id: 'q', titulo: 'Q', desc: 'dq', statusPadrao: 'backlog' }];
  const aba = [cabPA, ['q', 'em andamento', '2026-10-01', '', '', '', ''], ['nova-1', 'backlog', '', '', '', 'Custom', 'dc'], ['nova-2', 'x', '', '', '', '', '']];
  const m = J(ctx.mesclarPlanoPainel(fixos, ctx.lerPlanoAbaMatriz(aba), 'spravato'));
  assert.deepStrictEqual(m.map(x => [x.marca, x.status, x.prazo, x.titulo]), [
    ['spravato#p', 'concluída', '', 'P'], ['spravato#q', 'em andamento', '2026-10-01', 'Q'], ['spravato#nova-1', 'backlog', '', 'Custom']]);
  assert.deepStrictEqual(J(ctx.marcasExistentes([cabT, [1,'','','','','','','','','a\nOrigem: gt#1',true,''], [2,'','','','','','','','','Origem: pf#x ',false,'']])), { 'gt#1': true, 'pf#x': true });
}

// simulação: nada escrito, contagens certas, pula marca existente
{
  const abas = base();
  abas.Tarefas.push([2,'já importada','GT Onco','','', 'Concluído','Média',ADMIN,new Date(),'x\nOrigem: gt#1',true,'']);
  const ctx = carregar({ abas, email: ADMIN,
    planilhas: { [ctx_sprId()]: { PLANO_ACAO: [cabPA, ['protocolo','concluída','2026-08-01','','','',''], ['nova-abc','em andamento','2026-09-15','','','Ação custom','desc c']] },
                 PFID: { PLANO_ACAO: [cabPA, ['custo-tea','em andamento','','','','','']] } },
    drive: { [PF_NOME]: ['PFID'] } });
  const r = J(ctx.importarPlanosDeAcao(true));
  assert.strictEqual(ctx._escritas.length, 0, 'simulação não escreve');
  assert.strictEqual(r.spravato, 9);
  assert.strictEqual(r.pf, 12);
  assert.strictEqual(r.gt, 18);
  assert.strictEqual(r.puladas, 1);
  assert.strictEqual(r.criadas, 9 + 12 + 17);
  assert.strictEqual(r.itens, 34 - 6, 'itens da macroação 1 não entram porque ela já existe');
  assert.deepStrictEqual(r.projetos, { 'Spravato': 'novo', 'Carteira PF': 'novo', 'GT Onco': 'novo' });
}

// real: cria projetos públicos, tarefas, itens e log; segunda rodada não duplica
{
  const abas = base();
  const ctx = carregar({ abas, email: ADMIN,
    planilhas: { [ctx_sprId()]: { PLANO_ACAO: [cabPA, ['protocolo','concluída','2026-08-01','','','','']] }, PFID: { PLANO_ACAO: [cabPA] } },
    drive: { [PF_NOME]: ['PFID'] } });
  const r = J(ctx.importarPlanosDeAcao(false));
  assert.deepStrictEqual(r.projetos, { 'Spravato': 8, 'Carteira PF': 9, 'GT Onco': 10 });
  const projRows = ctx._escritas.filter(e => e.aba === 'Projetos' && e.op === 'appendRow').map(e => J(e.args));
  assert.strictEqual(projRows.length, 3);
  assert.deepStrictEqual(projRows[0].slice(0, 2).concat(projRows[0].slice(4)), [8, 'Spravato', true, true]);
  assert.ok(/9 \(busca ativa/.test(projRows[2][2]), 'descrição do GT Onco cita as canceladas');
  const tRows = ctx._escritas.filter(e => e.aba === 'Tarefas' && e.op === 'appendRow').map(e => J(e.args));
  assert.strictEqual(tRows.length, 8 + 12 + 18);
  assert.strictEqual(r.criadas, 38);
  assert.strictEqual(tRows[0][0], 2, 'IDs continuam a sequência');
  assert.ok(tRows.every(t => t.length === 12 && t[6] === 'Média' && t[10] === true && t[11] === ''));
  const spr = tRows.find(t => /Origem: spravato#protocolo/.test(t[9]));
  assert.strictEqual(spr[5], 'Concluído'); assert.strictEqual(spr[2], 'Spravato'); assert.strictEqual(spr[3], '');
  const sprBruto = ctx._escritas.filter(e => e.aba === 'Tarefas' && e.op === 'appendRow').find(e => /spravato#protocolo/.test(e.args[9])).args;
  assert.strictEqual(Object.prototype.toString.call(sprBruto[4]), '[object Date]', 'prazo é Date');
  assert.strictEqual(Object.prototype.toString.call(sprBruto[8]), '[object Date]', 'data de criação é Date');
  const gt5 = tRows.find(t => /Origem: gt#5$/.test(t[9]));
  assert.strictEqual(gt5[3], 'guilherme.amorim.ext@unimedcnu.coop.br');
  assert.strictEqual(gt5[1], 'Protocolos assistenciais em Oncologia');
  const gt16 = tRows.find(t => /Origem: gt#16$/.test(t[9]));
  assert.strictEqual(gt16[3], 'fabiane.minozzo@unimedcnu.coop.br');
  const gt7 = tRows.find(t => /Origem: gt#7$/.test(t[9]));
  assert.ok(/Fabiane Minozzo/.test(gt7[9]), 'segundo responsável nas notas');
  const gt6 = tRows.find(t => /Origem: gt#6$/.test(t[9]));
  assert.strictEqual(gt6[4], '', 'ação contínua sem prazo');
  const pfRow = tRows.find(t => /Origem: pf#custo-onco/.test(t[9]));
  assert.strictEqual(pfRow[1], 'Oncologia — o maior vetor', 'emoji removido');
  const cRows = ctx._escritas.filter(e => e.aba === 'Checklist_Status' && e.op === 'appendRow').map(e => J(e.args));
  assert.strictEqual(cRows.length, 34);
  assert.strictEqual(cRows[0][0], 6, 'ID do checklist continua a sequência');
  assert.strictEqual(cRows[0][1], tRows.find(t => /gt#1$/.test(t[9]))[0], 'itens apontam para a tarefa certa');
  assert.ok(cRows.every(c => c.length === 8 && c[2] === '' && c[7] === ''));
  assert.strictEqual(cRows.filter(c => c[5] === true).length, 6 + 3 + 3 + 1 + 1 + 1 + 2, 'feitos: 1(6) 7(3) 16(3) 5.1 6.3 11.2 15(2)');
  assert.strictEqual(ctx._escritas.filter(e => e.aba === 'Log' && e.op === 'appendRow' && e.args[3] === 'IMPORTAR' && e.args[4] === 'Origem').length, 38);
  assert.strictEqual(ctx._emails.length, 0, 'nenhum e-mail');
  // idempotência
  const r2 = J(ctx.importarPlanosDeAcao(true));
  assert.strictEqual(r2.criadas, 0);
  assert.strictEqual(r2.puladas, 38);
  assert.deepStrictEqual(r2.projetos, { 'Spravato': 8, 'Carteira PF': 9, 'GT Onco': 10 });
}

// projeto já existente e não público vira público; planilha do PF ambígua ou ausente falha antes de escrever
{
  const abas = base();
  abas.Projetos.push([8, 'GT Onco', '', '#7c3aed', true, false]);
  const ctx = carregar({ abas, email: ADMIN,
    planilhas: { [ctx_sprId()]: { PLANO_ACAO: [cabPA] }, PFID: { PLANO_ACAO: [cabPA] } }, drive: { [PF_NOME]: ['PFID'] } });
  const r = J(ctx.importarPlanosDeAcao(false));
  assert.strictEqual(r.projetos['GT Onco'], 8);
  assert.ok(ctx._escritas.some(e => e.aba === 'Projetos' && e.op === 'setValue' && e.args[1] === 6 && e.args[2] === true), 'marcou público');

  const ctx2 = carregar({ abas: base(), email: ADMIN, planilhas: { [ctx_sprId()]: { PLANO_ACAO: [cabPA] } }, drive: { [PF_NOME]: ['A', 'B'] } });
  ctx2.IMPORT_PF_SHEET_ID = ''; // força a busca no Drive (o default agora é o ID fixo do PF)
  assert.throws(() => ctx2.importarPlanosDeAcao(true), /mais de uma/);
  const ctx3 = carregar({ abas: base(), email: ADMIN, planilhas: { [ctx_sprId()]: { PLANO_ACAO: [cabPA] } }, drive: {} });
  ctx3.IMPORT_PF_SHEET_ID = '';
  assert.throws(() => ctx3.importarPlanosDeAcao(true), /não encontrada/);
  assert.strictEqual(ctx3._escritas.length, 0);

  // com IMPORT_PF_SHEET_ID preenchido (default atual), abre a planilha do PF por ID e não consulta o Drive
  const ctx4 = carregar({ abas: base(), email: ADMIN,
    planilhas: { [ctx_sprId()]: { PLANO_ACAO: [cabPA] }, [ctx_pfId()]: { PLANO_ACAO: [cabPA] } }, drive: {} });
  assert.ok(ctx4.IMPORT_PF_SHEET_ID, 'IMPORT_PF_SHEET_ID preenchido');
  assert.doesNotThrow(() => ctx4.importarPlanosDeAcao(true), 'com ID fixo a importação não depende do Drive');
}

function ctx_sprId() { return carregar({ abas: {} }).IMPORT_SPRAVATO_SHEET_ID; }

function ctx_pfId() { return carregar({ abas: {} }).IMPORT_PF_SHEET_ID; }
