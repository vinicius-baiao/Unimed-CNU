// ============================================================
//  Importação dos planos de ação dos painéis → tarefas do Cora (08/09/2026)
//  Execução MANUAL no editor do Apps Script. Nada aqui é roteado pelo doGet.
//
//    importarPlanosDeAcao(true)   → só lista no Logger o que criaria
//    importarPlanosDeAcao(false)  → grava
//
//  Fontes:
//   - Spravato: 8 ações fixas (copiadas do Codigo.gs do painel) + aba PLANO_ACAO
//     da planilha de Registros (status/prazo salvos e ações custom).
//   - Carteira PF: 12 ações fixas + aba PLANO_ACAO da planilha própria do painel,
//     localizada pelo nome no Drive (ou por IMPORT_PF_SHEET_ID, se preenchido).
//   - GT Onco: 18 macroações transcritas do Painel.html (numeradas 1–21 no painel;
//     as 3 canceladas ficam de fora, citadas na descrição do projeto);
//     desdobramentos numerados viram itens de checklist.
//
//  Idempotente: cada tarefa carrega "Origem: <painel>#<id>" na última linha de
//  Observações; quem já existe (ativa ou não) é pulada. Sem e-mail, sem Calendar.
//  Spec: docs/superpowers/specs/2026-09-08-planos-de-acao-dos-paineis-no-cora-design.md
// ============================================================

var IMPORT_SPRAVATO_SHEET_ID  = '1nZGEIK0T4lJBc9HrSEg3x8YIXkKlwlRjOUo11meoqA4';
var IMPORT_PF_SHEET_ID        = '1QD-jYJl8j8a5Ww0oJ_Hru-7zRHZ1VcIGdbgKdrQGyaQ';   // opcional: Script Properties → PA_SHEET_ID do painel PF
var IMPORT_PF_NOME_PLANILHA   = 'Raio X PF — Plano de Ação (armazenamento)';
var IMPORT_ABA_PLANO          = 'PLANO_ACAO';
var IMPORT_EMAILS_GT = {
  guilherme: 'guilherme.amorim.ext@unimedcnu.coop.br',   // Dr. Guilherme Amorim (médico consultor) — não é o Guilherme Borges
  fabiane:   'fabiane.minozzo@unimedcnu.coop.br',
  taiara:    'taiara.rodrigues@unimedcnu.coop.br'
};

var PROJETOS_PLANO = [
  { nome: 'Spravato',    cor: '#004e4c', descricao: 'Plano de ação do Raio X Spravato (saúde mental). Frentes definidas com o Dr. Guilherme em 20/08/2026.' },
  { nome: 'Carteira PF', cor: '#c9a84c', descricao: 'Plano de ação do Raio X da Carteira Pessoa Física. Alavancas que saem do raio X.' },
  { nome: 'GT Onco',     cor: '#7c3aed', descricao: 'Plano de ação do GT Terapias Oncológicas e Imunobiológicas, planejamento 2026. Macroações canceladas no ciclo e não importadas: 9 (busca ativa de excepcionalidades), 18 (compra abaixo da tabela, absorvida pela 6.3) e 19 (painel de custo por praça, duplicidade com 4 e 6).' }
];

var STATUS_PAINEL_PARA_CORA = {
  'em andamento': 'Em andamento', 'concluída': 'Concluído', 'backlog': 'Backlog',
  'a iniciar': 'A fazer', 'não iniciado': 'A fazer'
};

// ── Spravato: PLANO_ACAO_ITENS (Codigo.gs do painel, v4.73) ──────────────
var PLANO_SPRAVATO_FIXOS = [
  { id: 'painel', titulo: 'Construção de painel e análise de dados em saúde mental',
    desc: 'Mapeamento e diagnóstico dos dados de saúde mental da carteira — este painel é o produto do estudo.', statusPadrao: 'concluída' },
  { id: 'protocolo', titulo: 'Introdução do protocolo clínico',
    desc: 'Protocolo da escetamina nasal formatado no padrão CNU, com link de acesso.', statusPadrao: 'concluída' },
  { id: 'acompanhamento', titulo: 'Acompanhamento caso a caso',
    desc: 'Análise individual dos beneficiários em uso de Spravato, com registro de ação por caso.', statusPadrao: 'em andamento' },
  { id: 'judicializacao', titulo: 'Análise dos casos judicializados',
    desc: 'Revisão das liminares e do objeto de cada ação judicial, caso a caso.', statusPadrao: 'em andamento' },
  { id: 'dose', titulo: 'Revisão de dose',
    desc: 'Análise da dose por beneficiário (frascos por aplicação), identificando casos fora do padrão.', statusPadrao: 'backlog' },
  { id: 'tratamento', titulo: 'Revisão de tratamento',
    desc: 'Seguimento clínico: avaliar continuidade, troca de terapia (ex.: cetamina) ou suspensão.', statusPadrao: 'backlog' },
  { id: 'regulacao', titulo: 'Alinhamento com a regulação',
    desc: 'Definir novo fluxo de encaminhamento dos casos com a área de regulação.', statusPadrao: 'backlog' },
  { id: 'intercambio', titulo: 'Discussão com o time de intercâmbio',
    desc: 'Reuniões com as Unimeds singulares para revisar os beneficiários CNU atendidos em rede Unimed (intercâmbio recebido).', statusPadrao: 'backlog' }
];

// ── Carteira PF: PA_ITENS (Codigo.gs do painel, v8.46) ───────────────────
var PLANO_PF_FIXOS = [
  { id: 'custo-onco', titulo: '💰 Oncologia — o maior vetor',
    desc: 'Medicamento oncológico = 18% do custo; câncer = 32% do custo com CID. 9 prestadores concentram 89% do custo onco. → Gestão de alto custo: farmácia, protocolos e negociação com os maiores prestadores.', statusPadrao: 'backlog' },
  { id: 'custo-homecare', titulo: '💰 Home care — abrir e controlar',
    desc: 'R$ 55 M/ano · a ID é 19% das vidas mas 70% do custo, e sobe. O maior bloco é o ID com liminar (R$ 20,76 M) — 105 liminares têm home care como objeto. → Base por paciente (modalidade/CID) + revisão dos casos judicializados.', statusPadrao: 'backlog' },
  { id: 'custo-tea', titulo: '💰 TEA — auditoria por clínica',
    desc: 'Custo por vida varia 63× entre clínicas; três com 87–100% do custo sob liminar. → Protocolo de auditoria e negociação por clínica.', statusPadrao: 'backlog' },
  { id: 'custo-internacao', titulo: '💰 Internação — abrir e direcionar',
    desc: 'Cirúrgica 39% + clínica 36% = 71% do custo de internação; 49% ainda "não definido" no CIG. → Segunda opinião cirúrgica + abrir o bloco não classificado.', statusPadrao: 'backlog' },
  { id: 'custo-trs', titulo: '💰 TRS — preço por sessão',
    desc: 'Varia 5× entre clínicas (R$ 227 a R$ 1.170 por sessão). → Valor de referência + renegociar as clínicas fora da curva.', statusPadrao: 'backlog' },
  { id: 'custo-coluna', titulo: '💰 Coluna — artrodese',
    desc: 'Custo médio alto; a via endoscópica sai por ~41% da artrodese quando indicada. → Segunda opinião obrigatória para artrodese.', statusPadrao: 'backlog' },
  { id: 'jud-liminares', titulo: '⚖️ Liminares — primeiro contratual',
    desc: '47% das 2.773 liminares disputam a manutenção do próprio plano — não é clínica. → Tratar no jurídico/comercial.', statusPadrao: 'backlog' },
  { id: 'jud-acesso', titulo: '⚖️ Acesso e Coordenação — alinhamento com a Central',
    desc: 'Script de atendimento: atualização cadastral (captura do telefone atualizado do beneficiário) e conexão com o Núcleo de Atenção à Saúde (compartilhamento do WhatsApp e e-mail do Núcleo). → Garantir canais de comunicação efetivos para viabilizar a coordenação do cuidado.', statusPadrao: 'backlog' },
  { id: 'jud-altocusto', titulo: '⚖️ Alto custo judicial',
    desc: 'Sob liminar: onco 27% do custo, TEA 48%, home care: ID com liminar é o maior bloco (R$ 20,76 M, ~55% do custo de ID). → Revisar pertinência caso a caso (farmácia, auditoria, jurídico).', statusPadrao: 'backlog' },
  { id: 'nav-captacao', titulo: '🧭 Captação de alto risco',
    desc: '1.896 vidas de alto risco (IRA) já encaminhadas à esteira de captação da navegação. → Cruzar com o banco da navegação e confirmar o status individual.', statusPadrao: 'backlog' },
  { id: 'nav-regionalizar', titulo: '🧭 Regionalizar os programas',
    desc: '85% dos acompanhamentos estão em SP; a Bahia é 74% da carteira e tem só 130 vidas em programa. → Expandir a capacidade de acompanhamento na Bahia.', statusPadrao: 'backlog' },
  { id: 'nav-casos', titulo: '🧭 Casos complexos — 1 a 1',
    desc: 'Top 10 casos de navegação + Top 10 por custo potencial (IRA) já mapeados no painel. → Revisão individual com a médica da carteira.', statusPadrao: 'backlog' }
];

// ── GT Onco: transcrição do Painel.html v1.38, seção #plano ──────────────
// status já no vocabulário do Cora; resp é a chave em IMPORT_EMAILS_GT;
// itens = desdobramentos numerados (feito conforme ✓/"concluído" no painel);
// notas = bullets não numerados, vão para Observações.
function I(texto, feito) { return { texto: texto, feito: !!feito }; }
var PLANO_GT = [
  { n: 1, titulo: 'Comitê de eficiência para terapias de alto custo', status: 'Concluído', prazo: '2026-08-06', resp: 'guilherme',
    itens: [I('1.1 Definir critérios de elegibilidade (novo / continuidade)', true), I('1.2 Identificar pacientes elegíveis', true),
            I('1.3 Constituir equipe técnica multidisciplinar', true), I('1.4 Implantar fluxo de auditoria "ativa"', true),
            I('1.5 Definir indicadores de processo e custo evitado', true), I('1.6 Comunicar áreas pares impactadas', true)],
    notas: ['Período: jul–ago/26. Ver seção Comitê de Eficiência do painel.'] },
  { n: 7, titulo: 'Dashboard de pacientes de alto custo', status: 'Concluído', prazo: '2026-08-06', resp: 'guilherme',
    itens: [I('7.1 Identificar os beneficiários de maior custo', true), I('7.2 Identificar indicadores de monitoramento do painel', true),
            I('7.3 Higienizar as tabelas de medicamentos', true)],
    notas: ['Evidência: Painel de Eventos de Oncologia (60.5) em produção, tempo D-1, autorizações acima de R$ 100 mil.',
            'Também responsável: Fabiane Minozzo. Período: abr–dez/26.'] },
  { n: 16, titulo: 'Direcionar beneficiários de alto custo aos Recursos Próprios', status: 'Concluído', prazo: '2026-08-06', resp: 'fabiane',
    itens: [I('16.1 Identificar e navegar os beneficiários em atendimento na Oncoclínicas', true),
            I('16.2 Fluxo de encaminhamento das infusões (Pamplona, Brasília e Salvador) com a Seguros Unimed — agenda em 24h', true),
            I('16.3 Captação do Top 1.000 de crônicos e alto custo — incorporada à rotina', true)],
    notas: ['Evidência: report da navegação oncológica (panorama). Sinergia com o GT Recursos Próprios. Período: jun–dez/26.'] },
  { n: 17, titulo: 'Divulgação da infusão nos Recursos Próprios', status: 'Concluído', prazo: '2026-07-07', resp: '',
    itens: [],
    notas: ['Cuidar Mais prioritário no Guia Médico (CNU e Seguros Unimed), divulgação do PTU A400 e canal de prioridade Regulação ↔ Cuidar Mais. Ver seção Recursos Próprios do painel.'] },
  { n: 2, titulo: 'Aplicação assistida de MIB — MVP com Ymunity', status: 'Em andamento', prazo: '2026-09-30', resp: 'taiara',
    itens: [I('2.1 Monitorar a implantação no projeto piloto; resultado consolidado de 3 meses em 15/09', false)],
    notas: ['Período: jun–set/26. Ver seção Navegação Clínica do painel.'] },
  { n: 3, titulo: 'Arquitetura sistêmica — medicamentos fracionados por princípio ativo', status: 'Em andamento', prazo: '2026-06-30', resp: 'taiara',
    itens: [I('3.1 Melhoria sistêmica no SAW para autorização e faturamento por miligramagem (SOL 0341262) — em produção desde junho; a implantação no Recurso Próprio evidenciou melhorias a implementar', false),
            I('3.2 Comunicar prestador', false), I('3.4 Comunicar Contas Médicas', false)],
    notas: ['Pendências: adesão das Unimed sócias e ficha do indicador de custo evitado. Período: mar–jun/26.'] },
  { n: 4, titulo: 'Renegociar tabela por princípio ativo — curva A (SP e DF)', status: 'Em andamento', prazo: '2026-12-30', resp: 'taiara',
    itens: [I('4.1 Alinhar estratégia de negociação da tabela própria nos prestadores hospitalares da curva A em SP e DF', false)],
    notas: ['Tabela revisada e aprovada; negociações retomadas após revisão da tabela de medicamentos · prazo 30/12.',
            'Evidência: Tabela de Medicamentos Oncológicos CNU com teto mediana (v2), preço-teto por princípio ativo/mg — com Suprimentos / Negociação de Rede.',
            'Gargalo comercial, não técnico. Período: abr–dez/26.'] },
  { n: 5, titulo: 'Protocolos assistenciais em Oncologia', status: 'Em andamento', prazo: '2026-12-31', resp: 'guilherme',
    itens: [I('5.1 Protocolo de tumores sólidos (mama, pulmão e TGI) — concluído em 06/08', true),
            I('5.2 Protocolo de hematologia — em revisão · conclusão 01/09', false)],
    notas: ['Período: mar–dez/26. Ver seção Protocolos do painel.'] },
  { n: 6, titulo: 'Ampliar princípio ativo e biossimilares', status: 'Em andamento', prazo: '', resp: 'taiara',
    itens: [I('6.1 Suporte técnico às negociações conduzidas pela equipe de Rede', false),
            I('6.2 Identificar oportunidades de melhoria sem impacto em contas médicas', false),
            I('6.3 Parceria com Suprimentos — negociação direta com a indústria · mesa CMED concluída · agenda com Suprimentos realizada em 17/08', true)],
    notas: ['Ação contínua, sem prazo de término. Período: mai–dez/26. Ver seções CMED e Biossimilares do painel.'] },
  { n: 11, titulo: 'Política de cuidados de suporte precoce (cuidado transicional)', status: 'Em andamento', prazo: '2026-12-31', resp: 'guilherme',
    itens: [I('11.1 Contratualizar médico paliativista para o RP — standby (despriorizado em 07/07)', false),
            I('11.2 Elaborar protocolo de cuidados paliativos e critérios de elegibilidade de navegação — aprovado', true),
            I('11.3 Identificar população elegível no Cuidar Mais — busca ativa pela navegação oncológica · contínuo', false),
            I('11.4 Estabelecer fluxo de direcionamento — a iniciar', false),
            I('11.5 Definir indicadores de custo evitado e desfecho clínico — a iniciar', false)],
    notas: ['Período: abr–dez/26.'] },
  { n: 12, titulo: 'Padronizar os contratos de oncologia', status: 'Em andamento', prazo: '', resp: '',
    itens: [],
    notas: ['Termo de acordo de oncologia elaborado dentro dos critérios clínicos — Rede Américas e Beneficência Portuguesa.'] },
  { n: 13, titulo: 'Protocolos em Reumatologia (imunobiológicos)', status: 'Em andamento', prazo: '2026-10-30', resp: 'guilherme',
    itens: [I('13.1 Disponibilizar o protocolo para ambas as casas — standby (depende do PCDT de 30/10)', false)],
    notas: ['Validação médica concluída (3 reumatologistas do RP); alinhamento operacional com a Rede · publicação 30/10.',
            'Alta complexidade em imunobiológicos — 9 patologias entregues (70–80% das prescrições): artrite reumatoide, espondiloartrites axiais, artrite psoriásica, LES, artrite idiopática juvenil, vasculites ANCA-associadas, arterite de células gigantes, Behçet, Sjögren / esclerose sistêmica graves.',
            'Faltam: Gastroenterologia, Dermatologia e Neurologia — entrega até 20/12.',
            'Alinhado à DUT 65 da ANS · liderança Michel Dualib na Rede Ambulatorial.'] },
  { n: 14, titulo: 'Rever o contrato da Oncoclínicas', status: 'Em andamento', prazo: '', resp: '',
    itens: [],
    notas: ['Em revisão com a superintendência e a diretoria.'] },
  { n: 15, titulo: 'Assistência farmacêutica ampliada e política de delivery', status: 'Em andamento', prazo: '2026-12-31', resp: 'taiara',
    itens: [I('15.1 Revisar script de assistência farmacêutica', true),
            I('15.2 Ampliar o programa de assistência farmacêutica ao paciente oncológico', true)],
    notas: ['Período: jun–dez/26. Ver seção Assistência Farmacêutica do painel.'] },
  { n: 20, titulo: 'Modelos preditivos para terapias de alto custo', status: 'Em andamento', prazo: '2026-09-30', resp: '',
    itens: [],
    notas: ['Modelo preditivo de CAR-T elaborado; próximos passos: validação, definição de fluxo e áreas envolvidas · ago–set/26.',
            'Evidência: Torre de Controle CAR-T — régua preditiva por faixa de risco (0–2 baixo, 3–5 intermediário, 6–9 alto, ≥10 crítico).'] },
  { n: 21, titulo: 'Prevenção e detecção precoce de neoplasias', status: 'Em andamento', prazo: '', resp: 'fabiane',
    itens: [I('21.1 Fast Track da Mama (Femme, Clínica da Mama e busca ativa por códigos preditivos) — início em 15/06', false),
            I('21.2 Mobilização temática: mamografias e Papanicolau (Outubro Rosa), colonoscopias (Março Azul) e TC de tórax (Agosto Branco)', false)],
    notas: ['Ver seção Fast Track de Mama do painel.'] },
  { n: 8, titulo: 'Contador de ciclo de tratamento', status: 'A fazer', prazo: '2026-12-31', resp: 'taiara',
    itens: [I('8.1 Aguardar finalizar o contador de terapias TEA e orçar a ampliação de escopo (extensão do contador para as terapias oncológicas)', false)],
    notas: ['Em desenvolvimento na TI (SOL0309151), Squad Única, orçamento aprovado — única ação do plano sem data-alvo. Período: mai–dez/26.'] },
  { n: 10, titulo: 'Aprimorar regulação — reduzir variabilidade com protocolos', status: 'A fazer', prazo: '', resp: 'guilherme',
    itens: [I('10.1 Disponibilizar no sistema autorizador os protocolos de terapia oncológica — a iniciar (aguarda validação e parametrização dos protocolos)', false)],
    notas: [] }
];

// ── Conversões puras ──────────────────────────────────────────
function limparTituloAcao(t) {
  return String(t == null ? '' : t).replace(/^[^A-Za-z0-9À-ɏ]+/, '').trim();
}

// {titulo, desc, status (vocabulário do painel), prazo, notas[]} + marca →
// campos da tarefa do Cora. Prazo só no formato yyyy-MM-dd; senão vazio.
function converterAcaoPainel(item, marca) {
  var status = STATUS_PAINEL_PARA_CORA[String(item.status || '').toLowerCase()] || 'Backlog';
  var prazo  = /^\d{4}-\d{2}-\d{2}$/.test(String(item.prazo || '')) ? String(item.prazo) : '';
  var linhas = [];
  if (item.desc) linhas.push(String(item.desc).trim());
  (item.notas || []).forEach(function(n) { if (n) linhas.push(String(n).trim()); });
  linhas.push('Origem: ' + marca);
  return { tarefa: limparTituloAcao(item.titulo), status: status, prazo: prazo, observacoes: linhas.join('\n'), marca: marca };
}

// Aba PLANO_ACAO (matriz com cabeçalho) → {id: {status, prazo, titulo, desc}}.
function lerPlanoAbaMatriz(matriz) {
  var m = {};
  for (var i = 1; i < (matriz || []).length; i++) {
    var id = String(matriz[i][0] == null ? '' : matriz[i][0]).trim();
    if (!id) continue;
    m[id] = { status: String(matriz[i][1] || '').trim(), prazo: String(matriz[i][2] || '').trim(),
              titulo: String(matriz[i][5] || '').trim(), desc: String(matriz[i][6] || '').trim() };
  }
  return m;
}

function lerPlanoAba(ss) {
  var ab = ss.getSheetByName(IMPORT_ABA_PLANO);
  if (!ab || ab.getLastRow() < 2) return {};
  return lerPlanoAbaMatriz(ab.getDataRange().getDisplayValues());
}

// Mesma regra do montarPlanoAcao_/paMontar_ dos painéis: fixos com status e
// prazo salvos sobrepondo o padrão; linhas custom (id não fixo, com título) entram.
function mesclarPlanoPainel(fixos, salvos, prefixo) {
  var validos = { 'em andamento': 1, 'concluída': 1, 'backlog': 1 };
  var vistos = {}, lista = [];
  fixos.forEach(function(it) {
    vistos[it.id] = 1;
    var s = salvos[it.id] || {};
    lista.push({ marca: prefixo + '#' + it.id, titulo: it.titulo, desc: it.desc,
                 status: validos[s.status] ? s.status : it.statusPadrao, prazo: s.prazo || '' });
  });
  Object.keys(salvos).forEach(function(id) {
    if (vistos[id]) return;
    var s = salvos[id];
    if (!s.titulo) return;
    lista.push({ marca: prefixo + '#' + id, titulo: s.titulo, desc: s.desc || '',
                 status: validos[s.status] ? s.status : 'backlog', prazo: s.prazo || '' });
  });
  return lista;
}

function tarefasGT() {
  return PLANO_GT.map(function(m) {
    var c = converterAcaoPainel({ titulo: m.titulo, desc: '', status: '', prazo: m.prazo, notas: m.notas }, 'gt#' + m.n);
    c.status = m.status;                       // já no vocabulário do Cora
    c.responsavel = m.resp ? IMPORT_EMAILS_GT[m.resp] : '';
    c.itens = m.itens;
    return c;
  });
}

// Marcas "Origem: x" já presentes em Observações (tarefas ativas ou não).
function marcasExistentes(rowsTarefas) {
  var m = {};
  for (var i = 1; i < (rowsTarefas || []).length; i++) {
    var obs = String(rowsTarefas[i][COL.OBSERVACOES] || '');
    var re = /Origem:\s*(\S+)/g, r;
    while ((r = re.exec(obs)) !== null) m[r[1]] = true;
  }
  return m;
}

function localizarPlanilhaPF() {
  if (IMPORT_PF_SHEET_ID) return SpreadsheetApp.openById(IMPORT_PF_SHEET_ID);
  var it = DriveApp.getFilesByName(IMPORT_PF_NOME_PLANILHA), ids = [];
  while (it.hasNext()) ids.push(it.next().getId());
  if (!ids.length) throw new Error('Planilha do PF não encontrada no Drive: "' + IMPORT_PF_NOME_PLANILHA + '". Preencha IMPORT_PF_SHEET_ID.');
  if (ids.length > 1) throw new Error('Há mais de uma planilha chamada "' + IMPORT_PF_NOME_PLANILHA + '" (' + ids.join(', ') + '). Preencha IMPORT_PF_SHEET_ID.');
  return SpreadsheetApp.openById(ids[0]);
}

// ── Importação ────────────────────────────────────────────────
function importarPlanosDeAcao(apenasSimular) {
  if (apenasSimular === undefined) apenasSimular = true;
  var tag = apenasSimular ? ' [SIMULAÇÃO]' : '';

  // Fontes (falham ANTES de qualquer escrita)
  var sprSalvos = lerPlanoAba(SpreadsheetApp.openById(IMPORT_SPRAVATO_SHEET_ID));
  var pfSalvos  = lerPlanoAba(localizarPlanilhaPF());
  var spravato  = mesclarPlanoPainel(PLANO_SPRAVATO_FIXOS, sprSalvos, 'spravato').map(function(a) { var c = converterAcaoPainel(a, a.marca); c.projeto = 'Spravato'; c.responsavel = ''; c.itens = []; return c; });
  var pf        = mesclarPlanoPainel(PLANO_PF_FIXOS, pfSalvos, 'pf').map(function(a) { var c = converterAcaoPainel(a, a.marca); c.projeto = 'Carteira PF'; c.responsavel = ''; c.itens = []; return c; });
  var gt        = tarefasGT().map(function(c) { c.projeto = 'GT Onco'; return c; });
  var todas     = spravato.concat(pf, gt);

  var existentes = marcasExistentes(lerAba(ABA_TAREFAS));
  var novas = todas.filter(function(t) { return !existentes[t.marca]; });
  var puladas = todas.length - novas.length;
  var totalItens = novas.reduce(function(s, t) { return s + t.itens.length; }, 0);

  // Projetos: existentes por nome; os que faltam serão criados
  var rowsP = lerAba(ABA_PROJETOS) || [];
  var projetos = {};
  PROJETOS_PLANO.forEach(function(p) {
    projetos[p.nome] = 'novo';
    for (var i = 1; i < rowsP.length; i++) {
      if (String(rowsP[i][COL_PROJ.NOME]) === p.nome) { projetos[p.nome] = Number(rowsP[i][COL_PROJ.ID]); break; }
    }
  });

  Logger.log('importarPlanosDeAcao' + tag + ': Spravato ' + spravato.length + ' · PF ' + pf.length + ' · GT ' + gt.length +
    ' · novas ' + novas.length + ' · já importadas ' + puladas + ' · itens de checklist ' + totalItens);
  PROJETOS_PLANO.forEach(function(p) { Logger.log('  projeto ' + p.nome + ': ' + (projetos[p.nome] === 'novo' ? 'será criado' : 'id ' + projetos[p.nome])); });
  novas.forEach(function(t) { Logger.log('  + [' + t.projeto + '] ' + t.tarefa + ' · ' + t.status + (t.prazo ? ' · ' + t.prazo : '') + (t.responsavel ? ' · ' + t.responsavel : '') + (t.itens.length ? ' · ' + t.itens.length + ' itens' : '') + ' · ' + t.marca); });

  var resultado = { projetos: projetos, spravato: spravato.length, pf: pf.length, gt: gt.length, criadas: novas.length, puladas: puladas, itens: totalItens };
  if (apenasSimular) return resultado;

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var shP = getOrCreateProjetosSheet();
    var logs = [];
    PROJETOS_PLANO.forEach(function(p) {
      if (projetos[p.nome] === 'novo') {
        var idP = proximoIdProjeto();
        shP.appendRow([idP, p.nome, p.descricao, p.cor, true, true]);
        projetos[p.nome] = idP;
        logs.push(['IMPORTAR', 'Projeto', '', p.nome + ' (público)']);
      } else {
        for (var i = 1; i < rowsP.length; i++) {
          if (String(rowsP[i][COL_PROJ.NOME]) === p.nome && !ehVerdadeiro(rowsP[i][COL_PROJ.PUBLICO])) {
            shP.getRange(i + 1, COL_PROJ.PUBLICO + 1).setValue(true);
            logs.push(['IMPORTAR', 'Projeto', p.nome, 'publico=true']);
          }
        }
      }
    });
    invalidarAba(ABA_PROJETOS);

    var shT = getSheet(ABA_TAREFAS), shC = getSheet(ABA_CKL_STATUS);
    var criador = Session.getActiveUser().getEmail();
    var agora = new Date();
    var idT = proximoId();
    var idC = 0;
    var rowsC = shC.getDataRange().getValues();
    for (var k = 1; k < rowsC.length; k++) { var n = parseInt(rowsC[k][0], 10); if (!isNaN(n) && n > idC) idC = n; }

    novas.forEach(function(t) {
      shT.appendRow([idT, t.tarefa, t.projeto, t.responsavel || '', t.prazo ? parsePrazoLocal(t.prazo) : '',
                     t.status, 'Média', criador, agora, t.observacoes, true, '']);
      t.itens.forEach(function(it, ordem) {
        idC++;
        shC.appendRow([idC, idT, '', it.texto, ordem + 1, it.feito, it.feito ? agora : '', '']);
      });
      logs.push(['IMPORTAR', 'Origem', '', t.marca]);
      idT++;
    });
    gravarLogs(logs);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  invalidarAba(ABA_TAREFAS);
  invalidarAba(ABA_CKL_STATUS);
  limparCacheListas();
  PROJETOS_PLANO.forEach(function(p) { invalidarCachePlano(p.nome); });
  Logger.log('importarPlanosDeAcao: gravado. IDs dos projetos: ' + JSON.stringify(projetos));
  return resultado;
}
