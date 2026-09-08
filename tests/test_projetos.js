'use strict';
const assert = require('assert');
const { carregar } = require('./harness');
const J = v => JSON.parse(JSON.stringify(v));   // arrays do vm têm outro protótipo

const ADMIN = 'aurelio.pereira.ext@unimedcnu.coop.br';
const cabProj = ['ID', 'Nome', 'Descrição', 'Cor', 'Ativo', 'Publico'];
const abas = {
  Usuários: [['Nome', 'Email', 'Perfil', 'Unidade', 'Cargo'], ['Aurélio', ADMIN, 'Admin', '', '']],
  Projetos: [cabProj,
    [1, 'A', '', '#004e4c', true, true],
    [2, 'B', '', '#004e4c', true, false],
    [3, 'C', '', '#004e4c', false, true],     // arquivado: não é público para efeito de visibilidade
    [4, 'D', '', '#004e4c', true, 'TRUE']     // string vinda de validação de célula
  ],
  Log: [['ID', 'Data/Hora', 'Editor', 'Ação', 'Campo', 'Valor Anterior', 'Valor Novo']]
};

// listar devolve o flag normalizado
{
  const ctx = carregar({ abas, email: ADMIN });
  assert.strictEqual(ctx.COL_PROJ.PUBLICO, 5);
  const lista = ctx.listarProjetosDaPlanilha().projetos;
  assert.deepStrictEqual(J(lista.map(p => [p.nome, p.publico])), [['A', true], ['B', false], ['D', true]]);
  assert.deepStrictEqual(J(ctx.projetosPublicos()), { A: true, D: true });
}

// criar grava 6 colunas com o flag
{
  const ctx = carregar({ abas, email: ADMIN });
  const r = ctx.criarProjeto({ nome: 'Novo', descricao: 'd', cor: '#7c3aed', publico: true });
  assert.strictEqual(r.sucesso, true);
  const ap = ctx._escritas.find(e => e.aba === 'Projetos' && e.op === 'appendRow');
  assert.deepStrictEqual(J(ap.args), [5, 'Novo', 'd', '#7c3aed', true, true]);
  const r2 = ctx.criarProjeto({ nome: 'Privado' });
  const ap2 = ctx._escritas.filter(e => e.aba === 'Projetos' && e.op === 'appendRow')[1];
  assert.strictEqual(ap2.args[5], false, 'sem publico → false');
  assert.strictEqual(r2.sucesso, true);
}

// atualizar aceita publico e completa a linha antiga de 5 colunas
{
  const abas5 = Object.assign({}, abas, { Projetos: [cabProj.slice(0, 5), [1, 'A', '', '#004e4c', true]] });
  const ctx = carregar({ abas: abas5, email: ADMIN });
  const r = ctx.atualizarProjeto({ id: 1, publico: true });
  assert.strictEqual(r.sucesso, true);
  const sv = ctx._escritas.find(e => e.aba === 'Projetos' && e.op === 'setValues');
  assert.deepStrictEqual(J(sv.args[2][0]), [1, 'A', '', '#004e4c', true, true]);
}

// migração escreve cabeçalho e FALSE nas linhas existentes; idempotente
{
  const abas5 = Object.assign({}, abas, { Projetos: [cabProj.slice(0, 5), [1, 'A', '', '#004e4c', true], [2, 'B', '', '#004e4c', true]] });
  const ctx = carregar({ abas: abas5, email: ADMIN });
  ctx.migrarProjetosPublico();
  const sh = ctx.getSheet('Projetos');
  assert.strictEqual(sh.getRange(1, 6).getValue(), 'Publico');
  assert.strictEqual(sh.getRange(2, 6).getValue(), false);
  assert.strictEqual(sh.getRange(3, 6).getValue(), false);
  const antes = ctx._escritas.length;
  ctx.migrarProjetosPublico();
  assert.strictEqual(ctx._escritas.length, antes, 'segunda execução não escreve');
}
