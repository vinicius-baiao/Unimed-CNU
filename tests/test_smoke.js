'use strict';
const assert = require('assert');
const { carregar } = require('./harness');

const ctx = carregar({ abas: { Tarefas: [['ID', 'Tarefa']] } });
assert.strictEqual(typeof ctx.doGet, 'function');
assert.strictEqual(ctx.COL.ATIVO, 10);
assert.strictEqual(ctx.COL.EVENT_ID, 11);
assert.strictEqual(ctx.getSheet('Tarefas').getLastRow(), 1);
