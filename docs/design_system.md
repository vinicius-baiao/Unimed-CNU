# Design System — Unimed CNU

## Paleta de cores

| Token           | Valor     | Uso                          |
|-----------------|-----------|------------------------------|
| `--verde`       | `#004e4c` | Primária, headers, botões    |
| `--verde-claro` | `#006d6a` | Hover, links                 |
| `--verde-bg`    | `#e6f2f1` | Fundos secundários           |
| `--dourado`     | `#c9a84c` | CTAs de destaque, acentos    |
| `--dourado-bg`  | `#fdf6e3` | Fundos de cards dourados     |

### Badges semânticos de prioridade

| Prioridade | Background     | Cor do texto   |
|------------|----------------|----------------|
| Crítica    | `--erro-bg`    | `--erro-cor`   |
| Alta       | `--aviso-bg`   | `--aviso-cor`  |
| Média      | `--info-bg`    | `--info-cor`   |
| Baixa      | `--cinza-100`  | `--cinza-700`  |

## Tipografia

- **UI / corpo:** DM Sans (400, 500, 600)
- **Títulos / display:** DM Serif Display (400)

## Logo Unimed

Usar sempre o SVG oficial (cruz verde sobre fundo verde-escuro).  
Nunca usar ícones genéricos (ex: pinheiro, cruz vermelha).

SVG mínimo do símbolo:
```svg
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="2" width="8" height="28" rx="2" fill="#fff"/>
  <rect x="2" y="12" width="28" height="8" rx="2" fill="#fff"/>
</svg>
```

## Componentes

### Botões
- `.btn-primary` → fundo `--verde`, texto branco
- `.btn-dourado` → fundo `--dourado`, texto branco
- `border-radius: 8px`, `padding: 8px 16px`

### Cards Kanban
- Fundo branco, `box-shadow: 0 2px 8px rgba(0,0,0,.10)`
- Borda esquerda colorida por prioridade
- Hover: `box-shadow` mais forte + `translateY(-1px)`

### Toasts
- Posição: `bottom: 24px; right: 24px`
- Sucesso: fundo `--verde` | Erro: fundo `--erro-cor`
- Animação: fade + translateY, duração 3 s

### Modal
- Max-width 520 px, centrado na tela
- Form com grid 2 colunas (`form-grid`); `.full` ocupa a linha inteira
- Overlay escurece o fundo com `rgba(0,0,0,.4)`

## Tokens de layout

```css
--radius: 8px;
--shadow: 0 2px 8px rgba(0,0,0,.10);
--shadow-hover: 0 4px 16px rgba(0,0,0,.16);
```
