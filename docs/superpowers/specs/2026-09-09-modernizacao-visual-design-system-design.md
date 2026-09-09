# Modernização visual do Design System — tokens em escala + piloto no Cora

> Data: 09/09/2026. Pedido do Aurélio: analisar o painel Spravato, rever o design system e "modernizar
> o visual" das ferramentas (Cora, painéis) — mantendo que continuam **ferramentas/sistemas** (sem hero,
> sem efeitos de apresentação nesta rodada). Abordagem escolhida: **consolidar em escalas** (opção A).
> Piloto vivo: **Cora (Gestão de Tarefas)**. Decisões tomadas na conversa; qualquer uma pode ser revista.

## Objetivo

Dois entregáveis nesta rodada:

1. **Design System** ganha um `Tokens.html` único (distribuído por cópia, como `Estilos_Fontes`/`ChartJs`/
   `GraficosDS`) com a paleta atual **mais escalas** (tipografia, raio, elevação, espaço, motion, foco). A
   doutrina (`CLAUDE.md`) e o guia visual (`guia-referencia-visual.html`) passam a descrever essas escalas.
2. **Cora** adota o `Tokens.html`, sobe toda a UI para a escala nova (fim dos tamanhos < 12 px, motion sem
   `scale`, foco visível, hex soltos viram token) e importa do Spravato os componentes que valem para uma
   ferramenta: **stat card com cor semântica + hint**, **barra de filtros fixa**, **cabeçalho de seção**,
   **receita única de tabela**, **pill com ponto**. **Sem mudança de layout, fluxo, texto ou dado.**

Fora de escopo (registrado, não feito): hero/efeitos/WebGL, tema escuro, starter-kit Raio X, redesenho de
casca do Cora (modal→drawer, densidade de card), e a troca do `:root` de PF/GT/Spravato (cada um adota o
include quando for republicado; a spec só deixa o caminho pronto).

## Diagnóstico (medido nos arquivos hoje)

- **Tokens divergem entre 5 arquivos.** DS Shell 62, Cora 76, Spravato/PF/GT 35 tokens cada; 60 de 92 nomes
  ou têm valor diferente ou faltam em algum. Não há **nenhuma** divergência de *valor* real entre os que
  coexistem — a diferença é de cobertura (Cora tem aliases legados e cores de Kanban; DS tem `--roxo`/`--teal`/
  `--surface-2`; os painéis têm `--grade`/`--lima`/`--laranja`). Ou seja: dá para unificar sem repintar nada.
- **Tipografia pequena demais.** Cora: 29% das 106 declarações de `font-size` abaixo de 12 px (menor 9 px).
  Spravato: 35% de 148 (menor 9 px). Ruim em projetor/reunião (dor recorrente do Playbook).
- **Escalas implícitas.** Cora: 10 sombras distintas, raios variados (`9px`,`3px`, `calc`…), 3 `transform:scale`
  em hover. Spravato: 14 sombras, raios `6/8/9/10/20/999`. Nada disso é nomeado.
- **35 (Cora) e 49 (Spravato) cores hex hardcoded** no CSS, boa parte repetindo tokens que já existem.

## 1. `Tokens.html` — contrato

Arquivo novo em `C:\Users\Aurélio\UNIMED - Design System\starter-kit\Tokens.html`: um único bloco
`<style>` contendo **somente** `:root{…}` (sem seletores de componente). Incluído no head logo após
`Estilos_Fontes`, antes de `ChartJs`. Estrutura em quatro camadas comentadas:

### 1a. Paleta (valores atuais, sem alteração)
União dos tokens de cor já em uso — superfícies, marca, semânticos de estado, acentos (`--verde`, `--lima`,
`--laranja`, `--roxo`, `--teal`), sidebar, `--grade`. Os valores são exatamente os de hoje (ver diagnóstico:
não há conflito de valor a resolver).

### 1b. Escalas novas (o que "modernizar" adiciona)
```
/* Tipografia — 12px é o mínimo absoluto (fim dos 9–11px) */
--fs-eyebrow: 12px;   /* labels caixa-alta, eyebrows, meta */
--fs-sm:      13px;   /* texto de apoio, células densas */
--fs-base:    14px;   /* corpo */
--fs-lg:      16px;   /* subtítulo, número de card pequeno */
--fs-title:   20px;   /* título de view/seção */
--fs-display: 28px;   /* número de stat */
--fw-normal:400; --fw-medium:500; --fw-semibold:600; --fw-bold:700;
--lh-tight:1.2; --lh-base:1.5;
/* Raio */
--radius-sm:6px; --radius:10px; --radius-lg:14px; --radius-pill:999px;
/* Elevação — só três níveis */
--elev-rest:  0 1px 2px 0 rgba(0,0,0,.05);        /* = --shadow-sm de hoje */
--elev-hover: 0 6px 18px rgba(0,40,38,.07);        /* = --shadow-hover de hoje */
--elev-modal: 0 24px 70px rgba(0,30,28,.28);       /* = --shadow-modal de hoje */
/* Espaço — múltiplos de 4 */
--sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-8:32px;
/* Motion — uma curva, dois tempos; hover nunca com scale */
--motion-fast:150ms; --motion-med:250ms; --ease:cubic-bezier(.4,0,.2,1);
/* Foco — anel verde sobre halo do fundo */
--focus-ring: 0 0 0 2px var(--background), 0 0 0 4px var(--ring);
```

### 1c. Acento dourado unificado
`--accent-ink:#7A5F16` (o tom do DS) passa a ser o **único** texto dourado sobre fundo claro. Hoje Cora usa
`#8A6D1F`/`#8A6D1A` em três lugares e Spravato usa `#7A5F16`; todos convergem para `--accent-ink`.

### 1d. Compat (descontinuado)
Aliases legados que o markup de hoje ainda referencia (`--bg-app`, `--ink`, `--hair`, `--gold`, `--cinza-*`,
`--erro-*`, `--aviso-*`, `--info-*`, `--text-primary/secondary/muted`, `--col-*` do Kanban do Cora) ficam
numa seção `/* compat — não usar em código novo */`, apontando para os canônicos. Não remover nesta rodada
(quebraria markup vivo); só marcar.

### 1e. `prefers-reduced-motion`
Bloco no fim do `Tokens.html` zera `--motion-fast`/`--motion-med` para `0ms` sob
`@media (prefers-reduced-motion:reduce)`, para que qualquer transição tokenizada respeite a preferência sem
regra local.

**Fonte da verdade:** o `Tokens.html` nasce no repo do DS. Cada portal recebe uma **cópia byte-idêntica** no
próprio repo (mesmo modelo do `Estilos_Fontes`). Um teste garante a igualdade (ver §5).

## 2. Doutrina e guia visual (repo do Design System)

- `CLAUDE.md` §1: acrescenta a subseção "Escalas" descrevendo 1b; troca a regra de tipografia de "labels
  11–12px" para **"mínimo 12px; use os tokens `--fs-*`"**; nota de que cor/raio/sombra/motion vêm de token,
  não de valor solto. Registra `Tokens.html` na lista de includes e no §7 (arquitetura).
- `starter-kit/LEIA-ME.md` e `README.md`: `Tokens.html` entra na tabela de arquivos e no "como criar portal"
  (é o 1º include depois das fontes).
- `guia-referencia-visual.html`: nova seção "Escalas" (amostras de tipo/raio/elevação/espaço/foco) e ajuste
  do texto de tipografia. O guia é offline (fallback de fonte); segue sem include.
- Regras de componente que sobem à doutrina (§5), já provadas no Spravato e agora no Cora:
  - **Stat card**: barra de 4px **colorida por significado** (semântico do estado que o card representa),
    nunca por posição (`nth-child`); número `--fs-display`; label `--fs-eyebrow`; hint `--fs-eyebrow` muted.
  - **Pill/badge**: fundo pastel + texto do par semântico, **sem borda hex avulsa**; ponto de 6px opcional.
  - **Cabeçalho de seção**: título `--fs-title` + descrição `--fs-sm` muted.
  - **Tabela (receita única)**: `th` `--fs-eyebrow` caixa-alta muted; `td` `--fs-sm`/`--fs-base`; hover creme
    (`--muted-bg`); em rolagem própria, `th` fixo. Vale para lista de tarefas, indicadores e acessos.
  - **Barra de filtros fixa**: `position:sticky` translúcida com blur, chips do filtro ativo, botão limpar.

## 3. Cora — piloto (repo Gestão de Projetos)

### 3.1 Wiring do include
- Copiar `Tokens.html` do DS para o repo do Cora (raiz, junto de `Estilos_Fontes.html`).
- `tarefas-shadcn.html`: incluir `<?!= include('Tokens') ?>` logo após `Estilos_Fontes` (linha 7) e **remover**
  o bloco `:root{…}` inteiro do `<style>` (linhas ~14–95). Nada mais no markup muda de nome — os aliases de
  compat cobrem o que o CSS referencia.
- `.claspignore` já cobre o que precisa; o push do Cora passa a listar **8 arquivos** (os 7 de hoje +
  `Tokens.html`). O gate de pré-push muda de 7 para 8.
- `Code.gs`: `include()` já existe e serve qualquer arquivo `.html`; nada a mudar no backend.

### 3.2 Passagem de escala no CSS do Cora (mecânico, sem mexer em layout)
- **Tipografia**: toda declaração `font-size` abaixo de 12px sobe para `--fs-eyebrow` (12px) ou o token mais
  próximo acima; os demais tamanhos mapeiam para `--fs-*`. Preserva a hierarquia relativa (o que era menor
  continua menor), só elimina o sub-12px e nomeia a escala. Impressão (`@media print`) fica de fora — pode
  manter tamanhos próprios.
- **Raio/elevação**: `9px`/`3px`/`calc(--radius±2)` e as 10 sombras convergem para `--radius-*`/`--elev-*`.
- **Motion**: os 3 `transform:scale` em hover (`.kpi`, e afins) saem; hover fica em cor/borda/sombra/1px de
  translate. Transições passam a `var(--motion-fast) var(--ease)`.
- **Foco**: `:focus-visible` com `--focus-ring` em rail (`.side .nav a`), botões (já tem, alinhar ao token),
  cards clicáveis, linhas de tabela clicáveis, selects/inputs de Acessos e Indicadores.
- **Hex soltos**: os 35 hex do CSS que duplicam token viram `var(--…)`. Hex que não têm token (ex.: bordas
  pastel `#F0CBC3`/`#F5D9B8`/`#EDDDB0` das badges) podem virar tokens `--…-border` no `Tokens.html` **ou**
  ficar como estão com comentário; decisão por caso na implementação (default: manter e comentar, para não
  inchar o token set nesta rodada).

### 3.3 Componentes do Spravato importados (só onde a ferramenta ganha)
- **Stat cards** da Home (`.home-stat-card`) e dos Indicadores (`.ind-totais`): barra de 4px passa a ser por
  **significado** (a-fazer/andamento/bloqueado/atrasado já têm cor semântica no Cora — usar essa, não
  `nth-child`) e ganham `hint` em `--fs-eyebrow` onde fizer sentido. O Cora já tem `.home-stat-card.alert/.warn`;
  esta rodada só troca a regra de posição por significado e alinha tamanhos.
- **Barra de filtros fixa** nos Indicadores (`#indFiltros`): vira `sticky` translúcida (hoje é estática),
  igual à `.fbar` do Spravato, reaproveitando os selects atuais. Chips do filtro ativo entram se for barato;
  senão, ficam para depois (não bloqueia).
- **Cabeçalho de seção**: Home, Indicadores e Acessos usam o par título `--fs-title` + descrição `--fs-sm`
  (o Cora já tem `.home-section-title`/`.home-subline` e `.ind-head`; alinhar à receita).
- **Tabela única**: `.tarefas-table`, `.ind-tabela` e `.ac-tabela` convergem para a mesma receita de `th`/`td`/
  hover/sticky. Como `.ac-tabela` já herda de `.ind-tabela`, o trabalho é aproximar `.tarefas-table` das duas.

### 3.4 Invariantes (o que NÃO muda)
Layout, grid, fluxo de navegação, textos, dados, mock embutido, comportamento de impressão, nomes de função,
markup (classes/ids). Um usuário dos 40 abre e reconhece a tela na hora; muda a "pele", não o mapa.

## 4. Fora desta rodada (registrado)
Hero/efeitos/WebGL; tema escuro (claro/escuro/projetor via token); starter-kit da página Raio X; modal→drawer
e densidade de cards no Cora; adoção do `Tokens.html` por PF/GT/Spravato (cada um troca o `:root` pelo include
no próximo deploy — a spec deixa o `Tokens.html` pronto no DS para copiar).

## 5. Testes e verificação
- **Novo teste no Cora** (`tests/test_tokens.js`, harness Node ou check standalone):
  1. `Tokens.html` do repo do Cora é **idêntico** ao do DS após normalizar quebra de linha (CRLF/LF) e
     espaço em branco de fim de linha — os dois repos têm `autocrlf`/`.gitattributes` próprios, então a
     comparação é sobre conteúdo normalizado, não bytes crus.
  2. No `<style>` de `tarefas-shadcn.html` **não há** bloco `:root` próprio (só o include traz tokens).
  3. Nenhuma declaração `font-size` < 12px fora de `@media print` (regex sobre o CSS).
  4. Nenhum `transform:...scale(` dentro de regra `:hover`.
- `npm test` verde (passa a 10 arquivos).
- **Preview local** das 5 telas (Home, Kanban, Lista, Indicadores, Acessos) + modal: sem erro de console,
  tipografia legível, foco visível ao tabular, hover sem "pulo" de escala.
- Publicação: `clasp push` (gate **8 arquivos**) → `clasp deploy -i AKfycbyFDVg…` (@71) → hard reload →
  conferir em produção via JSONP + screenshot. HANDOFF + `CLAUDE.md` do Cora atualizados; commit no repo do DS.

## 6. Decisões tomadas sem consulta (revisáveis)
- **Mínimo de tipo = 12px** (era 11 na doutrina).
- **Só três elevações** (`rest`/`hover`/`modal`) — as 10–14 sombras de hoje colapsam nelas.
- **Badges sem borda hex avulsa** (fundo+texto do par semântico bastam); se a borda pastel fizer falta,
  vira token `--…-border`.
- `--accent-ink` (`#7A5F16`) como único dourado-sobre-claro, aposentando `#8A6D1F`/`#8A6D1A`.
