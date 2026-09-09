# Roteiro de conclusão — planos de ação dos painéis no Cora

> Para seguir no Claude Code. Estado em 08/09/2026: **código publicado nos quatro apps**
> (Cora @65, Spravato v4.74, Carteira PF v8.47, GT Onco v1.39). O que falta depende do
> editor do Apps Script (o `clasp run` não está habilitado) e de uma conferência no navegador.
> Cada etapa abaixo diz **o que você faz**, **o que anotar** e **o que colar no Claude Code**.
>
> Contexto completo: `docs/HANDOFF.md` (bloco de 08/09), spec em
> `docs/superpowers/specs/2026-09-08-planos-de-acao-dos-paineis-no-cora-design.md`.

Abra o projeto Apps Script do Cora (script `1z0an94Jvpt8sYf9kfWO5tMhIQ9ubLmhcL1i6B9o5YxcIdV2392xy64yG`)
com a conta `aurelio.pereira.ext@`. As funções ficam nos arquivos `Code.gs`,
`ImportacaoUsuarios.gs` e `ImportacaoPlanos.gs`. Para passar argumentos, use uma função
temporária ou o painel de execução: selecione a função no menu e clique **Executar**;
o resultado aparece em **Registro de execução** (Logger).

---

## Resultado da execução — 08/09/2026, 13:28–14:32 (Claude Code via Chrome + clasp)

- **Etapa 1** OK (coluna `Publico`, 4 legados FALSE). **Etapa 2** OK (3 células; Guilherme = `guilherme.silva@`).
- **Etapa 3** gravada às 14:51 após autorização (38 adicionados, 2 atualizados; 79 na aba Usuários; Guilherme, Taiara, Carina e Fabiane = Gestor).
- **Etapa 4** OK: `Spravato 10 (N=2) · PF 17 (M=5) · GT 18 · novas 45 · itens 34`. **IDs: Spravato 5 · Carteira PF 6 · GT Onco 7.**
  Precisou preencher `IMPORT_PF_SHEET_ID` (nome com travessão não casava no Drive).
- **Etapa 6 (1)** feita: `projetoId` 5/6/7 nos painéis; Spravato @253 (v4.75), PF @78 (v8.48), GT @65 (v1.40).
- **Etapa 5** pendente nos itens que exigem navegador/pessoas; **Etapa 6 (2)** registrada no `HANDOFF.md`.


## Etapa 1 — Coluna `Publico` na aba Projetos

**Você faz:** executar `migrarProjetosPublico`.

**Esperado no Logger:** `migrarProjetosPublico: coluna criada, N linha(s) com FALSE.`
(ou `coluna já existe`, se rodar de novo). Na planilha, a aba Projetos ganha `Publico` em F1.

**Se pedir autorização:** aceite. É a primeira execução após a versão @65 e o escopo de
Drive entrou por causa da importação do PF.

---

## Etapa 2 — Conta nova do Guilherme Borges

**Você faz:** no editor, crie uma função temporária e execute:

```js
function _remapGui() {
  remapearEmailUsuario('guilherme.silva.ext@unimedcnu.coop.br', 'guilherme.silva@unimedcnu.coop.br', true);
}
```

**Esperado no Logger:** `remapearEmailUsuario [SIMULAÇÃO]: ... · N célula(s).` seguido da
lista `Usuários linha X col 2`, `Tarefas linha Y col 4/8`, `Checklist_Status linha Z col 8`.

Se a lista fizer sentido, troque `true` por `false` e execute de novo. Esperado:
`remapearEmailUsuario: gravado.` Depois pode apagar a função temporária.

**Anotar:** quantas células mudaram.

---

## Etapa 3 — Equipe de Atenção à Saúde

**Você faz:** executar `importarUsuariosEquipe` (sem argumento = simulação).

**Esperado no Logger:** `importarUsuariosEquipe [SIMULAÇÃO]: 38 a adicionar, 2 a atualizar.`
Os 2 atualizados são Glaucia (só unidade e cargo) e Guilherme Borges (vira Gestor).

⚠️ **A partir da gravação, as 40 pessoas passam a entrar no Cora** (a allowlist é a aba
Usuários). Se quiser liberar por etapas, pare aqui e peça ao Claude Code um filtro por equipe.

Para gravar, crie `function _impUsuarios() { importarUsuariosEquipe(false); }` e execute.
Esperado: `importarUsuariosEquipe: gravado.`

**Anotar:** se as contagens bateram.

---

## Etapa 4 — Planos de ação dos três painéis

**Você faz:** executar `importarPlanosDeAcao` (sem argumento = simulação).

**Esperado no Logger:**

```
importarPlanosDeAcao [SIMULAÇÃO]: Spravato 8+N · PF 12+M · GT 18 · novas 38+N+M · já importadas 0 · itens de checklist 34
  projeto Spravato: será criado
  projeto Carteira PF: será criado
  projeto GT Onco: será criado
  + [Spravato] Construção de painel e análise de dados em saúde mental · Concluído · ...
```

`N` e `M` são as ações custom que o time cadastrou nos painéis; confira contra a aba
`PLANO_ACAO` de cada planilha. Se aparecer `Planilha do PF não encontrada no Drive` ou
`Há mais de uma planilha chamada ...`, copie o ID em Propriedades do script do PF
(`PA_SHEET_ID`) para `IMPORT_PF_SHEET_ID` no `ImportacaoPlanos.gs` e rode de novo.

Para gravar, crie `function _impPlanos() { importarPlanosDeAcao(false); }` e execute.
Esperado ao final: `importarPlanosDeAcao: gravado. IDs dos projetos: {"Spravato":8,"Carteira PF":9,"GT Onco":10}`
(os números serão os seus).

**Anotar:** os três IDs. Rodar de novo em simulação deve dar `novas 0 · já importadas 38+N+M`.

---

## Etapa 5 — Conferência rápida no navegador

Abra cada um e anote o que viu:

1. **Cora** (`…/exec`): a aba Projetos do modal "Gerenciar Projetos" mostra os três com o chip
   `público`. O board abre filtrado nas suas tarefas; "Limpar filtros" mostra as importadas.
2. **Cora** `…/exec?projeto=<ID do GT Onco>`: abre Tarefas filtradas no projeto.
3. **Cora** `…/exec?tarefa=<ID de uma tarefa importada>`: abre o modal em visualização.
4. **Painel GT Onco**, seção Plano de Ação: KPIs, cards, botão "Abrir no Cora". Antes da
   Etapa 4 aparece "Projeto não disponível"; depois, em até 60 s, as 18 macroações.
5. **Painel Spravato** e **Carteira PF**: mesma seção, com as ações de cada um.
6. Peça a alguém **fora da aba Usuários** (ou use uma conta que não esteja nela) para abrir
   um painel: o plano deve aparecer mesmo assim. Abrir o Cora com essa conta deve dar
   "Acesso restrito".
7. **Taiara** ou **Carina** abre o Cora: entra como Gestor e vê todas as tarefas.

Nada disso envia e-mail. Se alguém do GT receber e-mail do `taskcenter@`, anote: é bug.

---

## Etapa 6 — Voltar ao Claude Code

Cole isto, preenchendo os colchetes:

```
Rodei o roteiro docs/ROTEIRO_CONCLUSAO_PLANOS_DE_ACAO.md.
Etapa 1: [ok / mensagem]. Etapa 2: [N células]. Etapa 3: [contagens].
Etapa 4: IDs dos projetos: Spravato=[ ], Carteira PF=[ ], GT Onco=[ ]; custom: Spravato N=[ ], PF M=[ ].
Etapa 5: [o que funcionou / o que não].
Faça: (1) preencher CORA_PROJETO_ID nos três painéis com esses IDs e republicar com clasp deploy -i;
(2) registrar no HANDOFF os 17 passos de verificação da spec com o resultado; (3) o que mais achar pendente.
```

Se algo falhou, cole a mensagem do Logger ou do navegador junto. Para o Claude Code fazer a
troca dos IDs, o script é `python integracoes/aplicar_painel.py`, mas a substituição de
`projetoId: 0` é uma edição direta em cada `Painel.html` (Spravato `appscript/`, PF
`cora-carteira-pf/`, GT `cora-painel-gt/` e `build/body_gt.html`), seguida de `clasp push -f`
e `clasp deploy -i <id>` com os IDs de implantação que estão em
`docs/superpowers/plans/2026-09-08-planos-de-acao-dos-paineis-no-cora.md`.

---

## Decisões que ainda são suas

- **Hook de design** aponta `side-tab` em `integracoes/PlanoAcaoCora.html` (borda esquerda
  dos KPIs e do aviso). É o padrão do Design System, igual aos `.kpi` e `.note` dos painéis.
  Para silenciar: `/impeccable hooks ignore-value side-tab "*" --file "integracoes/PlanoAcaoCora.html"`.
- **Comunicar a equipe** que o Cora está aberto para os 40 (fica com você).
- **Unidade da Fabiane** está vazia no cadastro; preencher na aba Usuários se quiser.
- **Repo da organização** (`Unimed-CNU/cora-gestao-de-tarefas`) continua pendente de criação
  para o `git push cnu`.
