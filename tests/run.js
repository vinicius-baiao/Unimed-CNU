// Roda todos os tests/test_*.js em sequência. Sai com 1 se algum falhar.
'use strict';
const fs = require('fs'), path = require('path');
const arquivos = fs.readdirSync(__dirname).filter(f => /^test_.*\.js$/.test(f)).sort();
let falhas = 0;
arquivos.forEach(f => {
  try { require(path.join(__dirname, f)); console.log('ok   ' + f); }
  catch (e) { falhas++; console.log('FAIL ' + f + '\n  ' + (e && e.stack || e)); }
});
console.log(falhas ? falhas + ' arquivo(s) com falha' : arquivos.length + ' arquivo(s) verdes');
process.exit(falhas ? 1 : 0);
