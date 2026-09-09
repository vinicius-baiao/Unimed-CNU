// Gerenciamento de acessos: super-admin, atualizarUsuario, adicionarUsuario, removerUsuario.
'use strict';
const assert = require('assert');
const { carregar } = require('./harness');
const J = v => JSON.parse(JSON.stringify(v));

const SUPER  = 'aurelio.pereira.ext@unimedcnu.coop.br';
const ADMIN2 = 'outro.admin@unimedcnu.coop.br';
const GESTOR = 'gestora@unimedcnu.coop.br';
const PADRAO = 'padrao@unimednacional.coop.br';
const cabT = ['ID','Tarefa','Projeto','Responsável','Prazo','Status','Prioridade','Criado por','Data criação','Observações','Ativo','Event ID'];
const cabC = ['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão','Responsavel'];
const cabL = ['ID','Data/Hora','Editor','Ação','Campo','Valor Anterior','Valor Novo'];
function abas() {
  return {
    Usuários: [['Nome','Email','Perfil','Unidade','Cargo'],
      ['Aurélio',     SUPER,  'Admin',          'Rede Ambulatorial', 'Analista'],
      ['Outro Admin', ADMIN2, 'Admin',          'Rede Ambulatorial', ''],
      ['Gestora',     GESTOR, 'Gestor',         'Negociação',        'Coord.'],
      ['Padrão',      PADRAO, 'Usuário Padrão', '',                  '']],
    Tarefas: [cabT], Checklist_Status: [cabC], Log: [cabL]
  };
}
// J() aqui é necessário: arrays de args que passam pelo Code.gs (carregado num
// vm.createContext do harness) pertencem a outro realm do V8, e deepStrictEqual
// as trata como não-equivalentes a literais deste arquivo mesmo com valores
// idênticos. O round-trip JSON normaliza para arrays/objetos deste realm
// (mesmo padrão já usado em test_projetos.js e test_indicadores_rota.js).
const escUsuarios = ctx => J(ctx._escritas.filter(e => e.aba === 'Usuários'));
const logsAcesso  = ctx => J(ctx._escritas.filter(e => e.aba === 'Log' && e.op === 'appendRow')).map(e => e.args.slice(3));

// 1. superAdmin no bootstrap e no getUsuario
{
  const ctx = carregar({ abas: abas(), email: SUPER });
  assert.strictEqual(J(ctx.bootstrap()).usuario.superAdmin, true);
  assert.strictEqual(ctx.ehSuperAdmin('AURELIO.PEREIRA.EXT@unimedcnu.coop.br '), true, 'case/espaço-insensitive');
  const ctx2 = carregar({ abas: abas(), email: ADMIN2 });
  const b2 = J(ctx2.bootstrap()).usuario;
  assert.strictEqual(b2.superAdmin, false);
  assert.strictEqual(b2.admin, true);
  assert.strictEqual(ctx2.ehSuperAdmin(''), false);
}

// 2. Rotas negadas a quem não é super-admin (mesmo Admin), sem escrita
{
  const ctx = carregar({ abas: abas(), email: ADMIN2 });
  assert.deepStrictEqual(J(ctx.atualizarUsuario({ email: GESTOR, perfil: 'Admin' })), { erro: 'Apenas o administrador do sistema.' });
  assert.deepStrictEqual(J(ctx.adicionarUsuario({ nome: 'X', email: 'x@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'Apenas o administrador do sistema.' });
  assert.deepStrictEqual(J(ctx.removerUsuario({ email: PADRAO })), { erro: 'Apenas o administrador do sistema.' });
  assert.strictEqual(ctx._escritas.length, 0);
}

// 3. atualizarUsuario
{
  const ctx = carregar({ abas: abas(), email: SUPER });
  ctx.getPerfil(GESTOR); ctx.listarUsuarios();           // aquece os caches
  assert.ok('perfis_v1' in ctx._cache && 'usuarios_v1' in ctx._cache);
  const r = J(ctx.atualizarUsuario({ email: GESTOR, perfil: 'Admin' }));
  assert.strictEqual(r.sucesso, true);
  assert.strictEqual(r.alterados, 1);
  assert.deepStrictEqual(r.usuario, { nome: 'Gestora', email: GESTOR, perfil: 'Admin', unidade: 'Negociação', cargo: 'Coord.' });
  assert.deepStrictEqual(escUsuarios(ctx), [{ aba: 'Usuários', op: 'setValue', args: [4, 3, 'Admin'] }]);
  assert.deepStrictEqual(logsAcesso(ctx), [['ACESSO', GESTOR, 'Gestor', 'perfil: Admin']]);
  assert.ok(!('perfis_v1' in ctx._cache) && !('usuarios_v1' in ctx._cache), 'caches limpos');
  assert.strictEqual(ctx.getPerfil(GESTOR), 'Admin', 'perfil novo já vale');

  // vários campos de uma vez; e-mail em caixa diferente localiza a linha
  const ctx2 = carregar({ abas: abas(), email: SUPER });
  const r2 = J(ctx2.atualizarUsuario({ email: 'PADRAO@unimednacional.coop.br', unidade: 'Rede', cargo: ' Exec. ' }));
  assert.strictEqual(r2.alterados, 2);
  assert.deepStrictEqual(escUsuarios(ctx2).map(e => e.args), [[5, 4, 'Rede'], [5, 5, 'Exec.']]);
  assert.deepStrictEqual(logsAcesso(ctx2), [['ACESSO', PADRAO, '', 'unidade: Rede'], ['ACESSO', PADRAO, '', 'cargo: Exec.']]);

  // nada mudou: sem escrita, sem log
  const ctx3 = carregar({ abas: abas(), email: SUPER });
  assert.deepStrictEqual(J(ctx3.atualizarUsuario({ email: GESTOR, perfil: 'Gestor', cargo: 'Coord.' })).alterados, 0);
  assert.strictEqual(ctx3._escritas.length, 0);

  // erros
  const ctx4 = carregar({ abas: abas(), email: SUPER });
  assert.deepStrictEqual(J(ctx4.atualizarUsuario({ email: GESTOR, perfil: 'Chefe' })), { erro: 'Perfil inválido.' });
  assert.deepStrictEqual(J(ctx4.atualizarUsuario({ email: SUPER, perfil: 'Gestor' })), { erro: 'O administrador do sistema permanece Admin.' });
  assert.deepStrictEqual(J(ctx4.atualizarUsuario({ email: 'ninguem@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'Usuário não encontrado.' });
  assert.deepStrictEqual(J(ctx4.atualizarUsuario({ email: GESTOR, nome: '  ' })), { erro: 'Nome é obrigatório.' });
  assert.strictEqual(ctx4._escritas.length, 0);
  // super-admin pode editar os próprios dados que não sejam o perfil
  assert.strictEqual(J(ctx4.atualizarUsuario({ email: SUPER, cargo: 'Coordenador' })).alterados, 1);
}

// 4. adicionarUsuario
{
  const ctx = carregar({ abas: abas(), email: SUPER });
  ctx.listarUsuarios();
  const r = J(ctx.adicionarUsuario({ nome: ' Nova Pessoa ', email: ' nova.pessoa@unimednacional.coop.br ', perfil: 'Usuário Padrão', unidade: 'Rede' }));
  assert.deepStrictEqual(r, { sucesso: true, usuario: { nome: 'Nova Pessoa', email: 'nova.pessoa@unimednacional.coop.br', perfil: 'Usuário Padrão', unidade: 'Rede', cargo: '' } });
  assert.deepStrictEqual(escUsuarios(ctx), [{ aba: 'Usuários', op: 'appendRow', args: ['Nova Pessoa', 'nova.pessoa@unimednacional.coop.br', 'Usuário Padrão', 'Rede', ''] }]);
  assert.deepStrictEqual(logsAcesso(ctx), [['ACESSO', 'nova.pessoa@unimednacional.coop.br', '', 'incluído: Usuário Padrão']]);
  assert.ok(!('usuarios_v1' in ctx._cache));
  assert.strictEqual(ctx.getPerfil('nova.pessoa@unimednacional.coop.br'), 'Usuário Padrão');

  const ctx2 = carregar({ abas: abas(), email: SUPER });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: '', email: 'a@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'Nome é obrigatório.' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: 'a@gmail.com', perfil: 'Gestor' })), { erro: 'E-mail deve ser @unimedcnu.coop.br ou @unimednacional.coop.br' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: 'a@gmail.com?x=@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'E-mail deve ser @unimedcnu.coop.br ou @unimednacional.coop.br' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: '@unimedcnu.coop.br', perfil: 'Gestor' })), { erro: 'E-mail deve ser @unimedcnu.coop.br ou @unimednacional.coop.br' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: 'a@unimedcnu.coop.br', perfil: 'Chefe' })), { erro: 'Perfil inválido.' });
  assert.deepStrictEqual(J(ctx2.adicionarUsuario({ nome: 'A', email: 'GESTORA@UNIMEDCNU.COOP.BR', perfil: 'Gestor' })), { erro: 'Este e-mail já está cadastrado.' });
  assert.strictEqual(ctx2._escritas.length, 0);
}

// 5. removerUsuario
{
  const ctx = carregar({ abas: abas(), email: SUPER });
  ctx.getPerfil(PADRAO);
  assert.deepStrictEqual(J(ctx.removerUsuario({ email: 'Padrao@unimednacional.coop.br' })), { sucesso: true });
  assert.deepStrictEqual(escUsuarios(ctx), [{ aba: 'Usuários', op: 'deleteRow', args: [5] }]);
  assert.deepStrictEqual(logsAcesso(ctx), [['ACESSO', PADRAO, 'Usuário Padrão', 'removido']]);
  assert.strictEqual(ctx.getPerfil(PADRAO), '', 'perde o acesso na hora');

  const ctx2 = carregar({ abas: abas(), email: SUPER });
  assert.deepStrictEqual(J(ctx2.removerUsuario({ email: SUPER })), { erro: 'O administrador do sistema não pode ser removido.' });
  assert.deepStrictEqual(J(ctx2.removerUsuario({ email: 'ninguem@unimedcnu.coop.br' })), { erro: 'Usuário não encontrado.' });
  assert.strictEqual(ctx2._escritas.length, 0);
}

console.log('test_acessos: ok');
