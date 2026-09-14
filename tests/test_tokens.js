// Invariantes visuais do Iris: Tokens.html idêntico ao do DS, sem :root local,
// tipografia >= 12px fora de @media print, sem scale() em :hover.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync('tarefas-shadcn.html', 'utf8');
const norm = s => s.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trimEnd();

// 1. Tokens.html do Iris idêntico ao do DS (conteúdo normalizado)
const DS = 'C:/Users/Aurélio/UNIMED - Design System/starter-kit/Tokens.html';
if (fs.existsSync(DS)) {
  assert.strictEqual(norm(fs.readFileSync('Tokens.html','utf8')), norm(fs.readFileSync(DS,'utf8')),
    'Tokens.html do Iris difere do DS');
} else {
  console.log('  (aviso: DS não encontrado neste ambiente; pulei a comparação 1)');
}

// 2. tarefas-shadcn.html inclui Tokens e NÃO tem :root próprio
assert.ok(/<\?!=\s*include\('Tokens'\)\s*\?>/.test(HTML), 'falta o include de Tokens');
assert.ok(!/:root\s*\{/.test(HTML), 'tarefas-shadcn.html ainda tem um :root local');

// Isola o CSS (só os <style> do arquivo), removendo @media print
const estilos = (HTML.match(/<style>([\s\S]*?)<\/style>/g) || []).join('\n');
const semPrint = estilos.replace(/@media\s+print\s*\{[\s\S]*?\n\s*\}\s*\n/g, '');

// 3. Nenhum font-size < 12px fora de @media print
const fs12 = [];
const reFs = /font-size:\s*([\d.]+)(px|rem)/g; let m;
while ((m = reFs.exec(semPrint))) {
  const px = m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
  if (px < 12) fs12.push(m[0] + ' (' + px.toFixed(1) + 'px)');
}
assert.deepStrictEqual(fs12, [], 'font-size < 12px fora de print: ' + fs12.join(', '));

// 4. Nenhum scale() dentro de uma regra :hover
const hoverScale = [];
const reHover = /:hover[^{]*\{([^}]*)\}/g;
while ((m = reHover.exec(estilos))) { if (/scale\(/.test(m[1])) hoverScale.push(m[0].slice(0,60)); }
assert.deepStrictEqual(hoverScale, [], 'scale() em :hover: ' + hoverScale.join(' | '));

console.log('test_tokens: ok');
