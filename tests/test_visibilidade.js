'use strict';
const assert = require('assert');
const { carregar } = require('./harness');
const J = v => JSON.parse(JSON.stringify(v));

const PADRAO = 'x@unimedcnu.coop.br', OUTRO = 'y@unimedcnu.coop.br', ADMIN = 'aurelio.pereira.ext@unimedcnu.coop.br';
const cabT = ['ID','Tarefa','Projeto','Responsável','Prazo','Status','Prioridade','Criado por','Data criação','Observações','Ativo','Event ID'];
const abas = {
  Usuários: [['Nome','Email','Perfil','Unidade','Cargo'], ['A', ADMIN, 'Admin', '', ''], ['X', PADRAO, 'Usuário Padrão', '', '']],
  Projetos: [['ID','Nome','Descrição','Cor','Ativo','Publico'], [1,'Pub','','#000',true,true], [2,'Priv','','#000',true,false], [3,'PubArq','','#000',false,true]],
  Tarefas: [cabT,
    [1,'t1','Pub',   OUTRO,'','A fazer','Média',OUTRO,'','',true,''],
    [2,'t2','Priv',  OUTRO,'','A fazer','Média',OUTRO,'','',true,''],
    [3,'t3','Priv',  PADRAO,'','A fazer','Média',OUTRO,'','',true,''],
    [4,'t4','PubArq',OUTRO,'','A fazer','Média',OUTRO,'','',true,''],
  ],
  Checklist_Status: [['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão','Responsavel']]
};

// Usuário Padrão: vê a própria (3) e a de projeto público (1); não vê 2 nem 4
{
  const ctx = carregar({ abas, email: PADRAO });
  assert.deepStrictEqual(J(ctx.idsTarefasVisiveis(PADRAO)), { '1': true, '3': true });
  const ids = ctx.listarTarefas().tarefas.map(t => t.ID);
  assert.deepStrictEqual(J(ids), [1, 3]);
}

// Admin: sem restrição
{
  const ctx = carregar({ abas, email: ADMIN });
  assert.strictEqual(ctx.idsTarefasVisiveis(ADMIN), null);
}

// allowlist pela aba Usuários
{
  const ctx = carregar({ abas, email: PADRAO });
  assert.strictEqual(ctx.PILOTO_ATIVO, true);
  assert.strictEqual(ctx.acessoPermitido(PADRAO), true);
  assert.strictEqual(ctx.acessoPermitido('X@UNIMEDCNU.COOP.BR'), true, 'case-insensitive');
  assert.strictEqual(ctx.acessoPermitido(OUTRO), false);
  assert.strictEqual(ctx.acessoPermitido(''), false);
  assert.strictEqual(typeof ctx.EMAILS_PILOTO, 'undefined', 'lista fixa saiu');
}
