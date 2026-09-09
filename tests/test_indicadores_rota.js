// Rota indicadoresMovimento (última movimentação por tarefa) e ID da tarefa no Log ao editar.
'use strict';
const assert = require('assert');
const { carregar } = require('./harness');
const J = v => JSON.parse(JSON.stringify(v));

const ADMIN = 'aurelio.pereira.ext@unimedcnu.coop.br', PADRAO = 'padrao@unimedcnu.coop.br';
const cabT = ['ID','Tarefa','Projeto','Responsável','Prazo','Status','Prioridade','Criado por','Data criação','Observações','Ativo','Event ID'];
const cabI = ['ID','ID_Tarefa','Data/Hora','Editor','Tipo','Conteúdo'];
const cabL = ['ID','Data/Hora','Editor','Ação','Campo','Valor Anterior','Valor Novo'];
const cabC = ['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão','Responsavel'];
const D = (y, m, d, h) => new Date(y, m - 1, d, h || 0, 0, 0);
function abas() {
  return {
    Usuários: [['Nome','Email','Perfil','Unidade','Cargo'], ['Aurélio', ADMIN, 'Admin', '', ''], ['Padrão', PADRAO, 'Usuário Padrão', '', '']],
    Tarefas: [cabT,
      [1, 'Com tudo',        'P1', ADMIN, '', 'Em andamento', 'Média', ADMIN, D(2026, 9, 1, 9),  '', true,  ''],
      [2, 'Só criação',      'P1', ADMIN, '', 'A fazer',      'Média', ADMIN, D(2026, 9, 2, 8),  '', true,  ''],
      [3, 'Inativa',         'P1', ADMIN, '', 'A fazer',      'Média', ADMIN, D(2026, 9, 3, 8),  '', false, ''],
      [4, 'Só item feito',   'P1', ADMIN, '', 'A fazer',      'Média', ADMIN, D(2026, 9, 1, 8),  '', true,  '']],
    Interações: [cabI,
      [1, 1, D(2026, 9, 3, 10), ADMIN, 'Comentário', 'a'],
      [2, 1, D(2026, 9, 5, 10), ADMIN, 'Atualização de status', 'b'],
      [3, 3, D(2026, 9, 9, 10), ADMIN, 'Comentário', 'inativa: ignorar']],
    Log: [cabL,
      [1, D(2026, 9, 6, 10), ADMIN, 'CHECKLIST', 'ID_Tarefa', '', 1],           // conta (Valor Novo = id)
      [2, D(2026, 9, 7, 10), ADMIN, 'AVISO_CHECKLIST', 'ID_Tarefa', 1, 'x@y'],  // conta (Valor Anterior = id)
      [3, D(2026, 9, 8, 10), ADMIN, 'ATUALIZAR', 'prazo', '2026-09-01', '2026-09-10'], // sem ID: ignorar
      [4, D(2026, 9, 9, 10), ADMIN, 'CHECKLIST', 'ID_Tarefa', '', 99]],          // tarefa inexistente: ignorar
    Checklist_Status: [cabC,
      [1, 1, '', 'i1', 1, true,  D(2026, 9, 4, 12), ''],
      [2, 4, '', 'i2', 1, true,  D(2026, 9, 6, 15), ''],
      [3, 4, '', 'i3', 2, false, '',                 '']]
  };
}

// Gestor/Admin: maior data entre criação, interação, log ID_Tarefa e item concluído
{
  const ctx = carregar({ abas: abas(), email: ADMIN });
  const r = J(ctx.indicadoresMovimento());
  assert.ok(!r.erro, 'admin não recebe erro');
  assert.strictEqual(r.movimento['1'], '2026-09-07T10:00:00', 'tarefa 1: aviso de checklist (log com id em Valor Anterior) é o mais recente');
  assert.strictEqual(r.movimento['2'], '2026-09-02T08:00:00', 'tarefa 2: só a criação');
  assert.strictEqual(r.movimento['4'], '2026-09-06T15:00:00', 'tarefa 4: data de conclusão do item');
  assert.strictEqual(r.movimento['3'], undefined, 'inativa não entra');
  assert.strictEqual(r.movimento['99'], undefined, 'log de tarefa inexistente ignorado');
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(r.geradoEm));
}

// Usuário Padrão: recusado
{
  const ctx = carregar({ abas: abas(), email: PADRAO });
  assert.deepStrictEqual(J(ctx.indicadoresMovimento()), { erro: 'Apenas Admin ou Gestor.' });
}

// cache: segunda chamada devolve o mesmo resultado sem reler (usa CacheService do harness)
{
  const ctx = carregar({ abas: abas(), email: ADMIN });
  const a = J(ctx.indicadoresMovimento());
  ctx._planilhas && 0; // no-op: mantém a referência do harness
  const b = J(ctx.indicadoresMovimento());
  assert.deepStrictEqual(a, b);
  assert.ok(Object.keys(ctx._cache).some(k => /indMovimento_v1/.test(k)), 'gravou no cache com a chave indMovimento_v1');
}

// atualizarTarefa grava a linha ['ATUALIZAR','ID_Tarefa','',id] quando algo mudou, e nada quando nada mudou
{
  const ctx = carregar({ abas: abas(), email: ADMIN });
  const r = J(ctx.atualizarTarefa({ id: 2, prioridade: 'Alta' }));
  assert.ok(r.sucesso, JSON.stringify(r));
  const logs = ctx._escritas.filter(e => e.aba === 'Log' && e.op === 'appendRow').map(e => J(e.args));
  assert.ok(logs.some(l => l[3] === 'ATUALIZAR' && l[4] === 'prioridade'), 'log do campo');
  const comId = logs.filter(l => l[3] === 'ATUALIZAR' && l[4] === 'ID_Tarefa');
  assert.strictEqual(comId.length, 1, 'exatamente uma linha com o ID');
  assert.strictEqual(String(comId[0][6]), '2');
}
{
  const ctx = carregar({ abas: abas(), email: ADMIN });
  const r = J(ctx.atualizarTarefa({ id: 2, prioridade: 'Média' })); // já era Média
  assert.ok(r.sucesso, JSON.stringify(r));
  assert.strictEqual(ctx._escritas.filter(e => e.aba === 'Log').length, 0, 'nada mudou, nada logado');
}
