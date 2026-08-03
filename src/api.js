const db = require('./db');

// ---------- Categorias ----------
function listCategorias(tipo) {
  if (tipo) return db.prepare('SELECT * FROM categorias WHERE tipo = ? ORDER BY nome').all(tipo);
  return db.prepare('SELECT * FROM categorias ORDER BY tipo, nome').all();
}
function criarCategoria(c) {
  const info = db.prepare('INSERT INTO categorias (nome, cor, tipo) VALUES (?, ?, ?)').run(c.nome, c.cor || '#6b7280', c.tipo || 'despesa');
  return info.lastInsertRowid;
}
function atualizarCategoria(id, c) {
  db.prepare('UPDATE categorias SET nome = ?, cor = ?, tipo = ? WHERE id = ?').run(c.nome, c.cor, c.tipo, id);
}
function removerCategoria(id) {
  db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
}

// ---------- Contas (fixas/variáveis) ----------
function listContas(somenteAtivas) {
  const sql = `SELECT contas.*, categorias.nome AS categoria_nome, categorias.cor AS categoria_cor
               FROM contas LEFT JOIN categorias ON categorias.id = contas.categoria_id
               ${somenteAtivas ? 'WHERE ativa = 1' : ''}
               ORDER BY dia_vencimento IS NULL, dia_vencimento, contas.nome`;
  return db.prepare(sql).all();
}
function criarConta(c) {
  const info = db.prepare(
    'INSERT INTO contas (nome, tipo, categoria_id, dia_vencimento, valor_padrao, ativa) VALUES (?, ?, ?, ?, ?, 1)'
  ).run(c.nome, c.tipo, c.categoria_id || null, c.dia_vencimento || null, c.valor_padrao || null);
  return info.lastInsertRowid;
}
function atualizarConta(id, c) {
  db.prepare(
    'UPDATE contas SET nome = ?, tipo = ?, categoria_id = ?, dia_vencimento = ?, valor_padrao = ?, ativa = ? WHERE id = ?'
  ).run(c.nome, c.tipo, c.categoria_id || null, c.dia_vencimento || null, c.valor_padrao || null, c.ativa ? 1 : 0, id);
}
function removerConta(id) {
  const temLancamentos = db.prepare('SELECT COUNT(*) AS n FROM lancamentos WHERE conta_id = ?').get(id).n;
  if (temLancamentos > 0) {
    // preserva histórico: só desativa em vez de apagar
    db.prepare('UPDATE contas SET ativa = 0 WHERE id = ?').run(id);
    return { desativada: true };
  }
  db.prepare('DELETE FROM contas WHERE id = ?').run(id);
  return { removida: true };
}

// ---------- Lançamentos (instância mensal de uma conta) ----------
function garantirLancamentosDoMes(ano, mes) {
  const contasAtivas = db.prepare('SELECT * FROM contas WHERE ativa = 1').all();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO lancamentos (conta_id, ano, mes, valor, pago) VALUES (?, ?, ?, ?, 0)'
  );
  const tx = db.transaction((contas) => {
    for (const conta of contas) {
      insert.run(conta.id, ano, mes, conta.valor_padrao);
    }
  });
  tx(contasAtivas);
}
function listLancamentosDoMes(ano, mes) {
  garantirLancamentosDoMes(ano, mes);
  return db.prepare(`
    SELECT lancamentos.*, contas.nome AS conta_nome, contas.tipo AS conta_tipo,
           contas.dia_vencimento, categorias.nome AS categoria_nome, categorias.cor AS categoria_cor
    FROM lancamentos
    JOIN contas ON contas.id = lancamentos.conta_id
    LEFT JOIN categorias ON categorias.id = contas.categoria_id
    WHERE lancamentos.ano = ? AND lancamentos.mes = ? AND contas.ativa = 1
    ORDER BY contas.dia_vencimento IS NULL, contas.dia_vencimento, contas.nome
  `).all(ano, mes);
}
function atualizarLancamento(id, dados) {
  const atual = db.prepare('SELECT * FROM lancamentos WHERE id = ?').get(id);
  if (!atual) throw new Error('Lançamento não encontrado');
  const valor = dados.valor !== undefined ? dados.valor : atual.valor;
  const pago = dados.pago !== undefined ? (dados.pago ? 1 : 0) : atual.pago;
  const data_pagamento = dados.pago ? (dados.data_pagamento || new Date().toISOString().slice(0, 10)) : null;
  db.prepare('UPDATE lancamentos SET valor = ?, pago = ?, data_pagamento = ? WHERE id = ?').run(valor, pago, data_pagamento, id);
}

// ---------- Ganhos ----------
function listGanhosDoMes(ano, mes) {
  const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
  return db.prepare(`
    SELECT ganhos.*, categorias.nome AS categoria_nome, categorias.cor AS categoria_cor
    FROM ganhos LEFT JOIN categorias ON categorias.id = ganhos.categoria_id
    WHERE data LIKE ? ORDER BY data
  `).all(`${prefix}%`);
}
function criarGanho(g) {
  const info = db.prepare('INSERT INTO ganhos (descricao, valor, data, categoria_id, observacao) VALUES (?, ?, ?, ?, ?)')
    .run(g.descricao, g.valor, g.data, g.categoria_id || null, g.observacao || null);
  return info.lastInsertRowid;
}
function atualizarGanho(id, g) {
  db.prepare('UPDATE ganhos SET descricao = ?, valor = ?, data = ?, categoria_id = ?, observacao = ? WHERE id = ?')
    .run(g.descricao, g.valor, g.data, g.categoria_id || null, g.observacao || null, id);
}
function removerGanho(id) {
  db.prepare('DELETE FROM ganhos WHERE id = ?').run(id);
}

// ---------- Gastos avulsos ----------
function listGastosAvulsosDoMes(ano, mes) {
  const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
  return db.prepare(`
    SELECT gastos_avulsos.*, categorias.nome AS categoria_nome, categorias.cor AS categoria_cor
    FROM gastos_avulsos LEFT JOIN categorias ON categorias.id = gastos_avulsos.categoria_id
    WHERE data LIKE ? ORDER BY data
  `).all(`${prefix}%`);
}
function criarGastoAvulso(g) {
  const info = db.prepare('INSERT INTO gastos_avulsos (descricao, valor, data, categoria_id, pago) VALUES (?, ?, ?, ?, ?)')
    .run(g.descricao, g.valor, g.data, g.categoria_id || null, g.pago === false ? 0 : 1);
  return info.lastInsertRowid;
}
function atualizarGastoAvulso(id, g) {
  db.prepare('UPDATE gastos_avulsos SET descricao = ?, valor = ?, data = ?, categoria_id = ?, pago = ? WHERE id = ?')
    .run(g.descricao, g.valor, g.data, g.categoria_id || null, g.pago ? 1 : 0, id);
}
function removerGastoAvulso(id) {
  db.prepare('DELETE FROM gastos_avulsos WHERE id = ?').run(id);
}

// ---------- Resumo / Histórico ----------
function resumoMes(ano, mes) {
  const lancs = listLancamentosDoMes(ano, mes);
  const ganhos = listGanhosDoMes(ano, mes);
  const avulsos = listGastosAvulsosDoMes(ano, mes);

  const totalContasPago = lancs.filter(l => l.pago).reduce((s, l) => s + (l.valor || 0), 0);
  const totalContasPendente = lancs.filter(l => !l.pago).reduce((s, l) => s + (l.valor || 0), 0);
  const totalGanhos = ganhos.reduce((s, g) => s + g.valor, 0);
  const totalAvulsos = avulsos.reduce((s, g) => s + g.valor, 0);
  const saldo = totalGanhos - totalContasPago - totalAvulsos;

  return { totalContasPago, totalContasPendente, totalGanhos, totalAvulsos, saldo };
}

function listHistoricoMeses() {
  const rows = db.prepare(`
    SELECT DISTINCT ano, mes FROM (
      SELECT ano, mes FROM lancamentos
      UNION SELECT CAST(substr(data,1,4) AS INTEGER) AS ano, CAST(substr(data,6,2) AS INTEGER) AS mes FROM ganhos
      UNION SELECT CAST(substr(data,1,4) AS INTEGER) AS ano, CAST(substr(data,6,2) AS INTEGER) AS mes FROM gastos_avulsos
    ) ORDER BY ano DESC, mes DESC
  `).all();
  return rows.map(r => ({ ano: r.ano, mes: r.mes, ...resumoMes(r.ano, r.mes) }));
}

module.exports = {
  listCategorias, criarCategoria, atualizarCategoria, removerCategoria,
  listContas, criarConta, atualizarConta, removerConta,
  listLancamentosDoMes, atualizarLancamento,
  listGanhosDoMes, criarGanho, atualizarGanho, removerGanho,
  listGastosAvulsosDoMes, criarGastoAvulso, atualizarGastoAvulso, removerGastoAvulso,
  resumoMes, listHistoricoMeses,
};
