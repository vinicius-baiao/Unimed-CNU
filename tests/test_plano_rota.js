'use strict';
const assert = require('assert');
const { carregar } = require('./harness');
const J = v => JSON.parse(JSON.stringify(v));

const ADMIN = 'aurelio.pereira.ext@unimedcnu.coop.br';
const FORA  = 'visitante@unimedcnu.coop.br';           // não está na aba Usuários
const GUI   = 'guilherme.amorim.ext@unimedcnu.coop.br';
const cabT = ['ID','Tarefa','Projeto','Responsável','Prazo','Status','Prioridade','Criado por','Data criação','Observações','Ativo','Event ID'];
const abas = {
  Usuários: [['Nome','Email','Perfil','Unidade','Cargo'], ['A', ADMIN, 'Admin', '', '']],
  Projetos: [['ID','Nome','Descrição','Cor','Ativo','Publico'],
    [12,'GT Onco','Plano do GT','#7c3aed',true,true],
    [13,'Priv','','#000',true,false],
    [14,'Arq','','#000',false,true]],
  Tarefas: [cabT,
    [41,'Protocolos assistenciais','GT Onco',GUI,new Date(2026,11,31),'Em andamento','Média',ADMIN,new Date(2026,8,8),'desc\nOrigem: gt#5',true,''],
    [42,'Contador de ciclo','GT Onco','', '', 'A fazer','Média',ADMIN,new Date(2026,8,8),'Origem: gt#8',true,''],
    [43,'Excluída','GT Onco','', '', 'Backlog','Média',ADMIN,new Date(2026,8,8),'',false,''],
    [44,'Outra','Priv','', '', 'Backlog','Média',ADMIN,new Date(2026,8,8),'',true,'']],
  Checklist_Status: [['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão','Responsavel'],
    [1,41,'','5.1 Tumores sólidos',1,true,'',''],
    [2,41,'','5.2 Hematologia',2,false,'',GUI],
    [3,44,'','x',1,false,'','']],
  Interações: [['ID','ID_Tarefa','Data/Hora','Editor','Tipo','Conteúdo'],
    [1,41,new Date(2026,8,1,10,0,0),ADMIN,'Comentário','a'],
    [2,41,new Date(2026,8,2,10,15,0),ADMIN,'Atualização de status','b'],
    [3,44,new Date(2026,8,3,10,0,0),ADMIN,'Comentário','c']]
};

// resposta completa, chamada por conta fora da aba Usuários
{
  const ctx = carregar({ abas, email: FORA });
  const r = J(ctx.planoAcaoProjeto({ projetoId: 12 }));
  assert.strictEqual(r.erro, undefined, JSON.stringify(r));
  assert.deepStrictEqual(r.projeto, { id: 12, nome: 'GT Onco', cor: '#7c3aed', descricao: 'Plano do GT' });
  assert.ok(/\/exec$/.test(r.urlCora));
  assert.strictEqual(r.tarefas.length, 2);
  const t41 = r.tarefas.find(t => t.id === 41);
  assert.strictEqual(t41.tarefa, 'Protocolos assistenciais');
  assert.strictEqual(t41.status, 'Em andamento');
  assert.strictEqual(t41.prazo, '2026-12-31');
  assert.strictEqual(t41.responsavel, GUI);
  assert.strictEqual(t41.observacoes, 'desc\nOrigem: gt#5');
  assert.strictEqual(t41.ultimaAtualizacao, '2026-09-02T10:15:00');
  assert.deepStrictEqual(t41.checklist, { total: 2, feitos: 1, itens: [
    { item: '5.1 Tumores sólidos', feito: true, responsavel: '' },
    { item: '5.2 Hematologia', feito: false, responsavel: GUI } ] });
  const t42 = r.tarefas.find(t => t.id === 42);
  assert.strictEqual(t42.prazo, '');
  assert.strictEqual(t42.ultimaAtualizacao, '');
  assert.deepStrictEqual(t42.checklist, { total: 0, feitos: 0, itens: [] });
  // cache: segunda chamada vem do CacheService
  assert.ok(ctx._cache['planoAcao_12'], 'gravou no cache');
  const r2 = J(ctx.planoAcaoProjeto({ projetoId: 12 }));
  assert.strictEqual(r2.tarefas.length, 2);
}

// por nome (fallback), recusas
{
  const ctx = carregar({ abas, email: FORA });
  assert.strictEqual(J(ctx.planoAcaoProjeto({ projetoNome: 'GT Onco' })).projeto.id, 12);
  assert.strictEqual(ctx.planoAcaoProjeto({ projetoId: 13 }).erro, 'Projeto não disponível.', 'não público');
  assert.strictEqual(ctx.planoAcaoProjeto({ projetoId: 14 }).erro, 'Projeto não disponível.', 'arquivado');
  assert.strictEqual(ctx.planoAcaoProjeto({ projetoId: 999 }).erro, 'Projeto não disponível.', 'inexistente');
  assert.strictEqual(ctx.planoAcaoProjeto({ projetoId: 'abc' }).erro, 'Projeto não disponível.', 'id inválido');
  assert.strictEqual(ctx.planoAcaoProjeto({}).erro, 'Projeto não disponível.', 'sem parâmetro');
}

// doGet: a rota passa por fora da allowlist do piloto
{
  const ctx = carregar({ abas, email: FORA });
  const out = ctx.doGet({ parameter: { acao: 'planoAcaoProjeto', dados: JSON.stringify({ projetoId: 12 }), callback: 'cb1' } });
  const txt = out.getContent();
  assert.ok(/^cb1\(/.test(txt));
  assert.ok(txt.indexOf('"tarefas"') > 0, 'devolveu tarefas: ' + txt.slice(0, 80));
  const out2 = ctx.doGet({ parameter: { acao: 'listarTarefas', callback: 'cb2' } });
  assert.ok(out2.getContent().indexOf('Acesso restrito ao piloto') > 0, 'demais rotas continuam restritas');
  // sem e-mail identificado: recusa
  const ctx2 = carregar({ abas, email: '' });
  const out3 = ctx2.doGet({ parameter: { acao: 'planoAcaoProjeto', dados: JSON.stringify({ projetoId: 12 }) } });
  assert.ok(out3.getContent().indexOf('Conta Google não identificada') > 0);
}

// invalidação do cache ao escrever
{
  const ctx = carregar({ abas, email: ADMIN });
  ctx.planoAcaoProjeto({ projetoId: 12 });
  assert.ok(ctx._cache['planoAcao_12']);
  ctx.invalidarCachePlano('GT Onco');
  assert.strictEqual(ctx._cache['planoAcao_12'], undefined);
  ctx.planoAcaoProjeto({ projetoId: 12 });
  ctx.atualizarTarefa({ id: 42, status: 'Em andamento' });
  assert.strictEqual(ctx._cache['planoAcao_12'], undefined, 'atualizarTarefa invalida');
  ctx.planoAcaoProjeto({ projetoId: 12 });
  ctx.excluirTarefa({ id: 42 });
  assert.strictEqual(ctx._cache['planoAcao_12'], undefined, 'excluirTarefa invalida');
  ctx.invalidarCachePlano('Projeto inexistente');   // não lança
}

// deep link: saneamento
{
  const ctx = carregar({ abas, email: ADMIN });
  assert.strictEqual(ctx.deepLinkJson({ projeto: '12', tarefa: 'x' }), '{"projeto":"12","tarefa":""}');
  assert.strictEqual(ctx.deepLinkJson({}), '{"projeto":"","tarefa":""}');
  assert.strictEqual(ctx.deepLinkJson({ projeto: '1234567890' }), '{"projeto":"","tarefa":""}', 'mais de 9 dígitos');
  assert.strictEqual(ctx.deepLinkJson({ tarefa: '7' }), '{"projeto":"","tarefa":"7"}');
}
