# -*- coding: utf-8 -*-
"""Aplica o bloco PlanoAcaoCora em um dos painéis (cópia, padrão do DS).

    python integracoes/aplicar_painel.py spravato|pf|gt [--check]

Cada alvo: remove o storage/UI antigo do plano de ação, insere o CSS e o JS de
integracoes/PlanoAcaoCora.html, define PAC_CONFIG e sobe a versão do painel.
Idempotente por asserções: se o painel já foi migrado, o script avisa e não mexe.
--check só valida a sintaxe dos <script> do Painel.html (ignora scriptlets <?!= ?>).
"""
import io, os, re, sys, subprocess

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ_USUARIO = os.path.dirname(os.path.dirname(AQUI))          # C:\Users\Aurélio
BLOCO = io.open(os.path.join(AQUI, 'PlanoAcaoCora.html'), encoding='utf-8').read()
CSS = re.search(r'<style>\n(.*?)</style>', BLOCO, re.S).group(1)
JS = re.search(r'<script>\n(.*?)</script>', BLOCO, re.S).group(1)
CORA_URL = 'https://script.google.com/a/macros/unimedcnu.coop.br/s/AKfycbyFDVgvECw8xT70q5K-feokScLs-Z85Q6Ka4_qFyJe10cSE10K_TXEl4ws5nC3lkAF8/exec'

PAINEIS = {
    'spravato': os.path.join(RAIZ_USUARIO, 'UNIMED - Raio X Spravata'),
    'pf':       os.path.join(RAIZ_USUARIO, 'UNIMED - Análise de Requisitos'),
    'gt':       os.path.join(RAIZ_USUARIO, 'UNIMED - Painel GT'),
}

def ler(p): return io.open(p, encoding='utf-8').read()
def gravar(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

def config(nome, extra=''):
    return ("/* Plano de ação: vive no Cora (projeto \"%s\"); este painel só lê. Bloco copiado de\n"
            "   integracoes/PlanoAcaoCora.html (repo do Cora) — alterar lá e recopiar. */\n"
            "var PAC_CONFIG = {\n"
            "  url: '%s',\n"
            "  projetoId: 0,                 // ID do projeto no Cora após a importação; 0 = localizar pelo nome\n"
            "  projetoNome: '%s',\n"
            "  hostId: 'pac-host'%s\n"
            "};\n") % (nome, CORA_URL, nome, extra)

def checar_scripts(caminho):
    html = ler(caminho)
    scripts = [m.group(1) for m in re.finditer(r'<script>([\s\S]*?)</script>', html)]
    js = "const vm=require('vm');const fs=require('fs');const src=JSON.parse(fs.readFileSync(0,'utf8'));let i=0;" \
         "for(const s of src){i++;if(s.indexOf('<?')>=0)continue;try{new vm.Script(s)}catch(e){console.log('script',i,'ERRO',e.message);process.exit(1)}}" \
         "console.log(i+' blocos <script> parseiam');"
    import json
    r = subprocess.run(['node', '-e', js], input=json.dumps(scripts).encode('utf-8'), capture_output=True)
    print(r.stdout.decode('utf-8', 'replace').strip(), r.stderr.decode('utf-8', 'replace').strip())
    return r.returncode == 0

# ─────────────────────────────────────────────────────────────────────────
def spravato():
    raiz = PAINEIS['spravato']
    p = os.path.join(raiz, 'appscript', 'Codigo.gs'); s = ler(p)
    if 'Plano de Ação editável (aba PLANO_ACAO · call 20/08)' not in s:
        print('spravato: Codigo.gs já migrado');
    else:
        ini = s.index('/* ═══════════ Plano de Ação editável (aba PLANO_ACAO · call 20/08) ═══════════')
        fim = s.index('/* ═══════════ Detalhe do beneficiário (drawer da ferramenta) ═══════════ */')
        bloco = s[ini:fim]
        for f in ['ensurePlanoAcao_', 'lerPlanoAcao_', 'montarPlanoAcao_', 'salvarAcaoJSON', 'criarAcaoJSON', 'editarAcaoJSON', 'excluirAcaoJSON']:
            assert 'function ' + f in bloco, f
        s = s[:ini] + ("/* ═══════════ Plano de Ação — desde a v4.74 vive no Cora (Gestão de Tarefas) ═══════════\n"
                       "   As ações do plano são tarefas do projeto \"Spravato\" no Cora; o painel só LÊ, via\n"
                       "   JSONP (bloco PlanoAcaoCora no Painel.html). As abas PLANO_ACAO/HISTORICO desta\n"
                       "   planilha ficam como backup histórico — nada mais escreve nelas. */\n\n") + s[fim:]
        a = ("    visaoGeralSpravato: VISAO_GERAL_SPRAVATO,\n"
             "    /* Plano de Ação editável (v3.0): status/prazo por ação vêm da aba PLANO_ACAO.\n"
             "       Falha na planilha NÃO derruba o payload — cai nos defaults das ações fixas. */\n"
             "    planoAcao: (function () {\n"
             "      try { return montarPlanoAcao_(); }\n"
             "      catch (e) {\n"
             "        return PLANO_ACAO_ITENS.map(function (it) {\n"
             "          return { id: it.id, titulo: it.titulo, desc: it.desc, status: it.statusPadrao,\n"
             "                   prazo: '', atualizadoEm: '', atualizadoPor: '' };\n"
             "        });\n"
             "      }\n"
             "    })()\n"
             "  };")
        assert a in s, 'getDados planoAcao'
        s = s.replace(a, "    visaoGeralSpravato: VISAO_GERAL_SPRAVATO\n    /* planoAcao saiu na v4.74: o plano vive no Cora e o front lê direto de lá. */\n  };")
        b = ("  try {\n    var abPa = ensurePlanoAcao_();\n    var pa = montarPlanoAcao_();\n"
             "    rel.push('✓ Plano de ação: aba acessível · ' + (abPa.getLastRow() - 1) +\n"
             "      ' linha(s) salva(s) · ' + pa.length + ' ações no painel');\n"
             "  } catch (e) { rel.push('✗ Plano de ação: ' + e); }\n")
        assert b in s, 'VERIFICAR_INSTALACAO'
        s = s.replace(b, "  rel.push('· Plano de ação: gerido no Cora desde a v4.74 (nada a verificar aqui)');\n")
        assert "var VERSAO = 'v4.73';" in s
        s = s.replace("var VERSAO = 'v4.73';", "var VERSAO = 'v4.74';")
        assert 'PLANO_ACAO_' not in s, 'sobrou referência a PLANO_ACAO_'
        gravar(p, s); print('spravato: Codigo.gs ok')

    p = os.path.join(raiz, 'appscript', 'Painel.html'); s = ler(p)
    if 'PAC_CONFIG' in s:
        print('spravato: Painel.html já migrado'); return
    ini = s.index('/* ══ v3.0 Plano de Ação editável (#acoes) ══ */')
    fim = s.index('/* ══ v2.0 Ferramenta — barra de filtros global (.fbar, DS §5 tools/fsel/search) ══ */')
    assert '.pa-del[data-armed]' in s[ini:fim]
    s = s[:ini] + CSS + "\n" + s[fim:]
    a = ('<section id="acoes">\n'
         '  <div class="sec-head"><h2>Planos de ação</h2></div>\n'
         '  <p class="sec-desc"><b>Cada frente tem status e prazo editáveis, gravados na planilha com autor e\n'
         '  histórico</b> — como os registros de acompanhamento. As ações são fixas (definidas na reunião);\n'
         '  o que se ajusta é o andamento de cada uma. <span style="color:var(--muted-foreground)">Ordenado por status.</span></p>\n'
         '  <div id="acoes-lista"></div>\n'
         '</section>')
    assert a in s, 'markup #acoes'
    s = s.replace(a,
         '<section id="acoes">\n'
         '  <div class="sec-head"><h2>Planos de ação</h2><span class="tag">gerido no Cora · leitura</span></div>\n'
         '  <p class="sec-desc"><b>As frentes do plano são tarefas do projeto "Spravato" no Cora</b>, o gestor de tarefas da\n'
         '  Atenção à Saúde. Aqui você acompanha status, prazo, responsável e desdobramentos; para editar, use os links,\n'
         '  que abrem a tarefa no Cora. <span style="color:var(--muted-foreground)">Ordenado por status; atualiza em até um minuto.</span></p>\n'
         '  <div id="pac-host"></div>\n'
         '</section>')
    ini = s.index('/* ═══════════ v3.0 Plano de Ação editável (#acoes) ═══════════')
    marca = 'INIT.acoes = function(){ paRender(); };'
    fim = s.index(marca) + len(marca)
    bloco = s[ini:fim]
    for f in ['paRender', 'paCriar', 'paEditar', 'paExcluir', 'paSalvar', 'PA_AMOSTRA']:
        assert f in bloco, f
    extra = ",\n  especial: { 'spravato#protocolo': { texto: 'Acessar o protocolo →', onclick: \"mostrarAba('protocolo')\" } }"
    s = s[:ini] + config('Spravato', extra) + JS + "INIT.acoes = function(){ pacIniciar(); };" + s[fim:]
    for f in ['paRender(', 'paSalvar(', 'PA_AMOSTRA', 'acoes-lista', 'salvarAcaoJSON', 'getPlanoAcaoJSON']:
        assert f not in s, 'sobrou ' + f
    gravar(p, s); print('spravato: Painel.html ok')
    assert checar_scripts(p)

# ─────────────────────────────────────────────────────────────────────────
def pf():
    raiz = os.path.join(PAINEIS['pf'], 'cora-carteira-pf')
    p = os.path.join(raiz, 'Codigo.gs'); s = ler(p)
    if 'Plano de Ação editável — portado do Raio X Spravato' in s:
        ini = s.index('/* ═══════════ Plano de Ação editável — portado do Raio X Spravato')
        bloco = s[ini:]
        for f in ['paSpreadsheet_', 'getPlanoAcaoJSON', 'salvarAcaoJSON', 'criarAcaoJSON', 'editarAcaoJSON', 'excluirAcaoJSON']:
            assert 'function ' + f in bloco, f
        s = s[:ini] + ("/* ═══════════ Plano de Ação — desde a v8.47 vive no Cora (Gestão de Tarefas) ═══════════\n"
                       "   As ações do plano são tarefas do projeto \"Carteira PF\" no Cora; o painel só LÊ, via\n"
                       "   JSONP (bloco PlanoAcaoCora no Painel.html). A planilha \"Raio X PF — Plano de Ação\n"
                       "   (armazenamento)\" fica no Drive como backup histórico — nada mais escreve nela. */\n")
        gravar(p, s); print('pf: Codigo.gs ok')
    else:
        print('pf: Codigo.gs já migrado')

    p = os.path.join(raiz, 'Painel.html'); s = ler(p)
    if 'PAC_CONFIG' in s:
        print('pf: Painel.html já migrado'); return
    ini = s.index('/* ══ Plano de Ação editável (#acoes) — portado do Raio X Spravato v3.0 ══ */')
    fim = s.index('\n</style>', ini)
    assert '.pa-ed-form' in s[ini:fim]
    s = s[:ini] + CSS + s[fim:]
    ini = s.index('<section id="acoes">')
    fim = s.index('</section>', ini) + len('</section>')
    assert 'acoes-lista' in s[ini:fim]
    s = s[:ini] + ('<section id="acoes">\n'
         '  <div class="sec-head"><h2>Planos de Ação</h2><span class="tag">gerido no Cora · leitura</span></div>\n'
         '  <p class="sec-desc"><b>As alavancas do raio X são tarefas do projeto "Carteira PF" no Cora</b>, o gestor de tarefas da\n'
         '  Atenção à Saúde. Aqui você acompanha status, prazo, responsável e desdobramentos; para editar ou cadastrar novas ações,\n'
         '  use os links, que abrem o Cora. <span style="color:var(--muted-foreground)">Ordenado por status; atualiza em até um minuto.</span></p>\n'
         '  <div id="pac-host"></div>\n'
         '</section>') + s[fim:]
    ini = s.index('/* ═══════════ Plano de Ação editável (#acoes) — portado do Raio X Spravato v3.0 ═')
    marca = '    .getPlanoAcaoJSON();\n};'
    fim = s.index(marca, ini) + len(marca)
    bloco = s[ini:fim]
    for f in ['paRender', 'paCriar', 'paSalvar', 'PA_FIXOS', 'INIT.acoes']:
        assert f in bloco, f
    s = s[:ini] + config('Carteira PF') + JS + "INIT.acoes = function(){ pacIniciar(); };" + s[fim:]
    for f in ['paRender(', 'PA_FIXOS', 'acoes-lista', 'salvarAcaoJSON', 'getPlanoAcaoJSON']:
        assert f not in s, 'sobrou ' + f
    assert 'Unimed CNU · v8.46 · ago/2026' in s
    s = s.replace('Unimed CNU · v8.46 · ago/2026', 'Unimed CNU · v8.47 · set/2026')
    gravar(p, s); print('pf: Painel.html ok')
    assert checar_scripts(p)

# ─────────────────────────────────────────────────────────────────────────
GT_SECAO = ('<section id="plano">\n'
  '  <div class="sec-head"><h2>Planejamento 2026 — Plano de Ação</h2><span class="tag">gerido no Cora · leitura</span></div>\n'
  '  <p class="sec-desc"><b>As macroações do GT são tarefas do projeto "GT Onco" no Cora</b>, o gestor de tarefas da Atenção à Saúde;\n'
  '  os desdobramentos são os itens de checklist de cada uma. Material-base consolidado com o time da LID / Seguros Unimed (Canva).\n'
  '  Aqui você acompanha status, prazo, responsável e desdobramentos; para editar, use os links, que abrem a tarefa no Cora.\n'
  '  Macroações canceladas no ciclo (9, 18 e 19) não constam: o motivo está na descrição do projeto.</p>\n'
  '  <div id="pac-host"></div>\n'
  '  {NOTE}\n'
  '</section>')

def gt_trocar_secao(s):
    ini = s.index('<section id="plano">')
    fim = s.index('<section id="tumorboard">')
    bloco = s[ini:fim]
    assert 'details class="macro"' in bloco and 'Plano de Ação Emergencial' in bloco
    m = re.search(r'  <div class="note"><b>Nova frente proposta — Plano de Ação Emergencial:</b>.*?</div>\n', bloco, re.S)
    assert m, 'note emergencial'
    return s[:ini] + GT_SECAO.replace('{NOTE}', m.group(0).strip()) + '\n\n' + s[fim:]

def gt():
    raiz = PAINEIS['gt']
    script = '<style>\n' + CSS + '</style>\n<script>\n' + config('GT Onco') + JS + \
             "if (document.readyState !== 'loading') pacIniciar(); else document.addEventListener('DOMContentLoaded', pacIniciar);\n</script>\n"
    for rel in ['cora-painel-gt/Painel.html', 'build/body_gt.html']:
        p = os.path.join(raiz, rel); s = ler(p)
        if 'PAC_CONFIG' in s:
            print('gt: ' + rel + ' já migrado'); continue
        s = gt_trocar_secao(s)
        assert s.count('Painel v1.38') == 1, rel
        s = s.replace('Painel v1.38 · ago/2026', 'Painel v1.39 · set/2026')
        if '</body>' in s:
            s = s.replace('</body>', script + '</body>')
        else:
            s = s.rstrip('\n') + '\n' + script
        assert 'details class="macro"><summary>1. Comitê' not in s
        gravar(p, s); print('gt: ' + rel + ' ok')
    assert checar_scripts(os.path.join(raiz, 'cora-painel-gt', 'Painel.html'))

if __name__ == '__main__':
    alvo = sys.argv[1] if len(sys.argv) > 1 else ''
    if '--check' in sys.argv:
        caminho = {'spravato': os.path.join(PAINEIS['spravato'], 'appscript', 'Painel.html'),
                   'pf': os.path.join(PAINEIS['pf'], 'cora-carteira-pf', 'Painel.html'),
                   'gt': os.path.join(PAINEIS['gt'], 'cora-painel-gt', 'Painel.html')}[alvo]
        sys.exit(0 if checar_scripts(caminho) else 1)
    {'spravato': spravato, 'pf': pf, 'gt': gt}[alvo]()
