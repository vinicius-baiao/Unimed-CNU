'use strict';
const assert = require('assert');
const { carregar } = require('./harness');
const J = v => JSON.parse(JSON.stringify(v));

const ADMIN = 'aurelio.pereira.ext@unimedcnu.coop.br';
const GUI_EXT = 'guilherme.silva.ext@unimedcnu.coop.br', GUI_NOVO = 'guilherme.silva@unimedcnu.coop.br';
const cabU = ['Nome', 'Email', 'Perfil', 'Unidade', 'Cargo'];
const cabT = ['ID','Tarefa','Projeto','Responsável','Prazo','Status','Prioridade','Criado por','Data criação','Observações','Ativo','Event ID'];

// constante da equipe
{
  const ctx = carregar({ abas: {} });
  const eq = J(ctx.EQUIPE_ATENCAO_SAUDE);
  assert.strictEqual(eq.length, 40, '39 da planilha + Fabiane');
  const gestores = eq.filter(u => u[2] === 'Gestor').map(u => u[1]).sort();
  assert.deepStrictEqual(gestores, [
    'carina.guardia@unimedcnu.coop.br', 'fabiane.minozzo@unimedcnu.coop.br', 'glaucia.ruggeri@unimedcnu.coop.br',
    'guilherme.silva@unimedcnu.coop.br', 'taiara.rodrigues@unimedcnu.coop.br']);
  assert.ok(eq.every(u => u[2] === 'Gestor' || u[2] === 'Usuário Padrão'));
  const emails = eq.map(u => u[1]);
  assert.strictEqual(new Set(emails).size, 40, 'sem e-mail repetido');
  assert.ok(emails.every(e => /^[a-z0-9.]+@(unimedcnu|unimednacional)\.coop\.br$/.test(e)), 'e-mails minúsculos e do domínio');
  assert.ok(eq.every(u => u[0].trim() === u[0] && !/\s\s/.test(u[0])), 'nomes sem espaços sobrando');
  const fab = eq.find(u => u[1] === 'fabiane.minozzo@unimedcnu.coop.br');
  assert.deepStrictEqual(fab, ['Fabiane Minozzo', 'fabiane.minozzo@unimedcnu.coop.br', 'Gestor', '', 'Gerente']);
  const amorim = eq.find(u => u[1] === 'guilherme.amorim.ext@unimedcnu.coop.br');
  assert.strictEqual(amorim[2], 'Usuário Padrão');
  assert.strictEqual(amorim[3], 'Núcleo de Oncologia e Alto Custo');
  assert.strictEqual(eq.filter(u => u[3] === 'Linhas de Cuidado').length, 25);
  assert.strictEqual(eq.filter(u => u[3] === 'Núcleo de Oncologia e Alto Custo').length, 14);
}

// plano de importação: adiciona quem não existe, atualiza sem rebaixar
{
  const ctx = carregar({ abas: {} });
  const atuais = [cabU,
    ['Aurélio', ADMIN, 'Admin', '', ''],
    ['Dra. Glaucia Ruggeri', 'glaucia.ruggeri@unimedcnu.coop.br', 'Gestor', '', 'Médica'],
    ['Guilherme Borges Gomes Da Silva', GUI_NOVO, 'Usuário Padrão', '', '']];
  const plano = J(ctx.planoImportacaoUsuarios(atuais, J(ctx.EQUIPE_ATENCAO_SAUDE)));
  assert.strictEqual(plano.adicionar.length, 38);
  assert.strictEqual(plano.atualizar.length, 2);
  const gui = plano.atualizar.find(a => a.row[1] === GUI_NOVO);
  assert.strictEqual(gui.linha, 4, 'linha 1-based na aba');
  assert.strictEqual(gui.row[2], 'Gestor', 'sobe para Gestor');
  assert.strictEqual(gui.row[3], 'Linhas de Cuidado');
  const gla = plano.atualizar.find(a => a.row[1] === 'glaucia.ruggeri@unimedcnu.coop.br');
  assert.strictEqual(gla.row[2], 'Gestor');
  assert.strictEqual(gla.row[0], 'Dra. Glaucia Ruggeri', 'nome existente é preservado');
  assert.strictEqual(gla.row[4], 'Consultor Médico de Atenção Integral à Saúde', 'cargo atualizado');
  // não rebaixa: Admin que estivesse na equipe como Usuário Padrão continua Admin
  const plano2 = J(ctx.planoImportacaoUsuarios([cabU, ['T', 'taiara.rodrigues@unimedcnu.coop.br', 'Admin', '', '']], J(ctx.EQUIPE_ATENCAO_SAUDE)));
  assert.strictEqual(plano2.atualizar[0].row[2], 'Admin');
  // e-mail com maiúsculas na aba casa mesmo assim
  const plano3 = J(ctx.planoImportacaoUsuarios([cabU, ['T', 'Taiara.Rodrigues@unimedcnu.coop.br ', 'Usuário Padrão', '', '']], J(ctx.EQUIPE_ATENCAO_SAUDE)));
  assert.strictEqual(plano3.adicionar.length, 39);
}

// importarUsuariosEquipe: simulação não escreve; real escreve e limpa caches
{
  const abas = { Usuários: [cabU, ['Aurélio', ADMIN, 'Admin', '', '']], Log: [['ID','Data/Hora','Editor','Ação','Campo','Valor Anterior','Valor Novo']] };
  const ctx = carregar({ abas, email: ADMIN });
  ctx.importarUsuariosEquipe(true);
  assert.strictEqual(ctx._escritas.filter(e => e.aba === 'Usuários').length, 0, 'simulação não escreve');
  assert.ok(ctx._logs.some(l => /40 a adicionar/.test(l)), ctx._logs.join('\n'));
  ctx._cache['perfis_v1'] = '{}';
  ctx.importarUsuariosEquipe(false);
  const sh = ctx.getSheet('Usuários');
  assert.strictEqual(sh.getLastRow(), 42, '1 cabeçalho + Aurélio + 40');
  assert.strictEqual(ctx._cache['perfis_v1'], undefined, 'cache de perfis limpo');
  assert.ok(ctx._escritas.some(e => e.aba === 'Log'), 'logou');
}

// remapeamento de e-mail: Usuários, Tarefas (resp + criador) e Checklist; Log e Interações intactos
{
  const abas = {
    Usuários: [cabU, ['Guilherme', GUI_EXT, 'Usuário Padrão', '', ''], ['Outro', 'outro@unimedcnu.coop.br', 'Gestor', '', '']],
    Tarefas: [cabT,
      [1,'t1','P',GUI_EXT,'','A fazer','Média',GUI_EXT,'','',true,''],
      [2,'t2','P','outro@unimedcnu.coop.br','','A fazer','Média',' Guilherme.Silva.EXT@unimedcnu.coop.br','','',true,'']],
    Checklist_Status: [['ID','ID_Tarefa','ID_Template','Item','Ordem','Concluído','Data conclusão','Responsavel'], [1,1,'','i',1,false,'',GUI_EXT], [2,1,'','j',2,false,'','']],
    Interações: [['ID','ID_Tarefa','Data/Hora','Editor','Tipo','Conteúdo'], [1,1,new Date(),GUI_EXT,'Comentário','x']],
    Log: [['ID','Data/Hora','Editor','Ação','Campo','Valor Anterior','Valor Novo'], [1,new Date(),GUI_EXT,'CRIAR','Tarefa','','t1']]
  };
  const ctx = carregar({ abas, email: ADMIN });
  const plano = J(ctx.planoRemap({ Usuários: abas.Usuários, Tarefas: abas.Tarefas, Checklist_Status: abas.Checklist_Status }, GUI_EXT, GUI_NOVO));
  assert.strictEqual(plano.length, 5, JSON.stringify(plano));
  ctx.remapearEmailUsuario(GUI_EXT, GUI_NOVO, true);
  assert.strictEqual(ctx._escritas.length, 0);
  ctx.remapearEmailUsuario(GUI_EXT, GUI_NOVO, false);
  assert.strictEqual(ctx.getSheet('Usuários').getRange(2, 2).getValue(), GUI_NOVO);
  assert.strictEqual(ctx.getSheet('Tarefas').getRange(2, 4).getValue(), GUI_NOVO);
  assert.strictEqual(ctx.getSheet('Tarefas').getRange(2, 8).getValue(), GUI_NOVO);
  assert.strictEqual(ctx.getSheet('Tarefas').getRange(3, 8).getValue(), GUI_NOVO, 'compara sem caixa e sem espaços');
  assert.strictEqual(ctx.getSheet('Tarefas').getRange(3, 4).getValue(), 'outro@unimedcnu.coop.br');
  assert.strictEqual(ctx.getSheet('Checklist_Status').getRange(2, 8).getValue(), GUI_NOVO);
  assert.strictEqual(ctx.getSheet('Interações').getRange(2, 4).getValue(), GUI_EXT, 'histórico intacto');
  assert.strictEqual(ctx.getSheet('Log').getRange(2, 3).getValue(), GUI_EXT, 'histórico intacto');
  assert.strictEqual(ctx._escritas.filter(e => e.aba === 'Log' && e.op === 'appendRow' && e.args[3] === 'REMAPEAR_EMAIL').length, 5);
  // validações
  assert.throws(() => ctx.remapearEmailUsuario('', GUI_NOVO, true));
  assert.throws(() => ctx.remapearEmailUsuario(GUI_EXT, 'x@gmail.com', true));
}
