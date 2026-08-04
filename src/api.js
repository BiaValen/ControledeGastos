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
    'INSERT INTO contas (nome, tipo, categoria_id, dia_vencimento, valor_padrao, ativa, eh_cartao) VALUES (?, ?, ?, ?, ?, 1, ?)'
  ).run(c.nome, c.tipo, c.categoria_id || null, c.dia_vencimento || null, c.valor_padrao || null, c.eh_cartao ? 1 : 0);
  return info.lastInsertRowid;
}
function atualizarConta(id, c) {
  db.prepare(
    'UPDATE contas SET nome = ?, tipo = ?, categoria_id = ?, dia_vencimento = ?, valor_padrao = ?, ativa = ?, eh_cartao = ? WHERE id = ?'
  ).run(c.nome, c.tipo, c.categoria_id || null, c.dia_vencimento || null, c.valor_padrao || null, c.ativa ? 1 : 0, c.eh_cartao ? 1 : 0, id);
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
function listLancamentosExistentesDoMes(ano, mes) {
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
function listLancamentosDoMes(ano, mes) {
  garantirLancamentosDoMes(ano, mes);
  return listLancamentosExistentesDoMes(ano, mes);
}
function atualizarLancamento(id, dados) {
  const atual = db.prepare('SELECT * FROM lancamentos WHERE id = ?').get(id);
  if (!atual) throw new Error('Lançamento não encontrado');
  const valor = dados.valor !== undefined ? dados.valor : atual.valor;
  const pago = dados.pago !== undefined ? (dados.pago ? 1 : 0) : atual.pago;
  const data_pagamento = dados.pago ? (dados.data_pagamento || new Date().toISOString().slice(0, 10)) : null;
  db.prepare('UPDATE lancamentos SET valor = ?, pago = ?, data_pagamento = ? WHERE id = ?').run(valor, pago, data_pagamento, id);
}

// ---------- Fontes de renda (recorrentes, ex: Salário) ----------
function listFontesRenda(somenteAtivas) {
  const sql = `SELECT fontes_renda.*, categorias.nome AS categoria_nome, categorias.cor AS categoria_cor
               FROM fontes_renda LEFT JOIN categorias ON categorias.id = fontes_renda.categoria_id
               ${somenteAtivas ? 'WHERE ativa = 1' : ''}
               ORDER BY fontes_renda.nome`;
  return db.prepare(sql).all();
}
function criarFonteRenda(f) {
  const info = db.prepare(
    'INSERT INTO fontes_renda (nome, tipo, categoria_id, dia_recebimento, valor_padrao, ativa) VALUES (?, ?, ?, ?, ?, 1)'
  ).run(f.nome, f.tipo, f.categoria_id || null, f.dia_recebimento || null, f.valor_padrao || null);
  return info.lastInsertRowid;
}
function atualizarFonteRenda(id, f) {
  db.prepare(
    'UPDATE fontes_renda SET nome = ?, tipo = ?, categoria_id = ?, dia_recebimento = ?, valor_padrao = ?, ativa = ? WHERE id = ?'
  ).run(f.nome, f.tipo, f.categoria_id || null, f.dia_recebimento || null, f.valor_padrao || null, f.ativa ? 1 : 0, id);
}
function removerFonteRenda(id) {
  const temGanhos = db.prepare('SELECT COUNT(*) AS n FROM ganhos WHERE fonte_id = ?').get(id).n;
  if (temGanhos > 0) {
    db.prepare('UPDATE fontes_renda SET ativa = 0 WHERE id = ?').run(id);
    return { desativada: true };
  }
  db.prepare('DELETE FROM fontes_renda WHERE id = ?').run(id);
  return { removida: true };
}
// garante que cada fonte ativa já tenha um ganho gerado pro mês pedido (usa o valor_padrao ATUAL da fonte)
function garantirGanhosRecorrentesDoMes(ano, mes) {
  const fontesAtivas = db.prepare('SELECT * FROM fontes_renda WHERE ativa = 1').all();
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;
  const existe = db.prepare('SELECT 1 FROM ganhos WHERE fonte_id = ? AND substr(data, 1, 7) = ?');
  const insert = db.prepare('INSERT INTO ganhos (descricao, valor, data, categoria_id, observacao, fonte_id) VALUES (?, ?, ?, ?, NULL, ?)');
  const tx = db.transaction((fontes) => {
    for (const f of fontes) {
      if (existe.get(f.id, mesStr)) continue;
      const dia = f.dia_recebimento || 1;
      const data = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      insert.run(f.nome, f.valor_padrao, data, f.categoria_id, f.id);
    }
  });
  tx(fontesAtivas);
}

// ---------- Ganhos ----------
function listGanhos() {
  const hoje = new Date();
  garantirGanhosRecorrentesDoMes(hoje.getFullYear(), hoje.getMonth() + 1);
  return db.prepare(`
    SELECT ganhos.*, categorias.nome AS categoria_nome, categorias.cor AS categoria_cor
    FROM ganhos LEFT JOIN categorias ON categorias.id = ganhos.categoria_id
    ORDER BY data DESC, ganhos.id DESC
  `).all();
}
function listGanhosExistentesDoMes(ano, mes) {
  const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
  return db.prepare(`
    SELECT ganhos.*, categorias.nome AS categoria_nome, categorias.cor AS categoria_cor
    FROM ganhos LEFT JOIN categorias ON categorias.id = ganhos.categoria_id
    WHERE data LIKE ? ORDER BY data
  `).all(`${prefix}%`);
}
function listGanhosDoMes(ano, mes) {
  garantirGanhosRecorrentesDoMes(ano, mes);
  return listGanhosExistentesDoMes(ano, mes);
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

// ---------- Regras de categorização (offline, por palavra-chave) ----------
function listRegras() {
  return db.prepare(`
    SELECT regras_categorizacao.*, categorias.nome AS categoria_nome, categorias.cor AS categoria_cor
    FROM regras_categorizacao LEFT JOIN categorias ON categorias.id = regras_categorizacao.categoria_id
    ORDER BY LENGTH(padrao) DESC
  `).all();
}
function criarRegra(r) {
  const info = db.prepare('INSERT OR REPLACE INTO regras_categorizacao (padrao, categoria_id) VALUES (?, ?)')
    .run(r.padrao.trim().toUpperCase(), r.categoria_id);
  return info.lastInsertRowid;
}
function removerRegra(id) {
  db.prepare('DELETE FROM regras_categorizacao WHERE id = ?').run(id);
}
function categorizarPorRegra(descricao) {
  const desc = descricao.toUpperCase();
  const regras = db.prepare('SELECT * FROM regras_categorizacao ORDER BY LENGTH(padrao) DESC').all();
  const match = regras.find((r) => desc.includes(r.padrao));
  return match ? match.categoria_id : null;
}

// ---------- Extratos importados (OFX) ----------
function importarExtrato(contaId, transacoesParsed) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO transacoes_importadas (conta_id, data, descricao, valor, categoria_id, hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  let importadas = 0;
  let duplicadas = 0;
  const tx = db.transaction((transacoes) => {
    for (const t of transacoes) {
      const categoriaId = categorizarPorRegra(t.descricao);
      const info = insert.run(contaId || null, t.data, t.descricao, t.valor, categoriaId, t.hash);
      if (info.changes > 0) importadas++;
      else duplicadas++;
    }
  });
  tx(transacoesParsed);
  return { importadas, duplicadas, total: transacoesParsed.length };
}
function listTransacoes(contaId, ano, mes) {
  const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
  return db.prepare(`
    SELECT transacoes_importadas.*, categorias.nome AS categoria_nome, categorias.cor AS categoria_cor
    FROM transacoes_importadas LEFT JOIN categorias ON categorias.id = transacoes_importadas.categoria_id
    WHERE conta_id = ? AND data LIKE ?
    ORDER BY data DESC
  `).all(contaId, `${prefix}%`);
}
function atualizarCategoriaTransacao(id, categoriaId, salvarRegra) {
  const transacao = db.prepare('SELECT * FROM transacoes_importadas WHERE id = ?').get(id);
  if (!transacao) throw new Error('Transação não encontrada');
  db.prepare('UPDATE transacoes_importadas SET categoria_id = ? WHERE id = ?').run(categoriaId, id);
  if (salvarRegra && categoriaId) {
    criarRegra({ padrao: transacao.descricao, categoria_id: categoriaId });
  }
}
function removerTransacao(id) {
  db.prepare('DELETE FROM transacoes_importadas WHERE id = ?').run(id);
}
// soma só os débitos (valores negativos no extrato = gasto); pagamentos/créditos não entram
function somaTransacoesDoMes(contaId, ano, mes) {
  const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
  const row = db.prepare(`
    SELECT COALESCE(SUM(-valor), 0) AS total FROM transacoes_importadas
    WHERE conta_id = ? AND data LIKE ? AND valor < 0
  `).get(contaId, `${prefix}%`);
  return row.total;
}
function aplicarSomaAoLancamento(contaId, ano, mes) {
  const soma = somaTransacoesDoMes(contaId, ano, mes);
  garantirLancamentosDoMes(ano, mes);
  const lanc = db.prepare('SELECT * FROM lancamentos WHERE conta_id = ? AND ano = ? AND mes = ?').get(contaId, ano, mes);
  atualizarLancamento(lanc.id, { valor: soma });
  return soma;
}

// ---------- Resumo / Histórico ----------
function calcularResumo(lancs, ganhos, avulsos) {
  const totalContasPago = lancs.filter(l => l.pago).reduce((s, l) => s + (l.valor || 0), 0);
  const totalContasPendente = lancs.filter(l => !l.pago).reduce((s, l) => s + (l.valor || 0), 0);
  const totalGanhos = ganhos.reduce((s, g) => s + g.valor, 0);
  const totalAvulsos = avulsos.reduce((s, g) => s + g.valor, 0);
  const saldo = totalGanhos - totalContasPago - totalAvulsos;
  return { totalContasPago, totalContasPendente, totalGanhos, totalAvulsos, saldo };
}

// usada pela tela "Mês atual": pode gerar os lançamentos do mês se ainda não existirem
function resumoMes(ano, mes) {
  return calcularResumo(listLancamentosDoMes(ano, mes), listGanhosDoMes(ano, mes), listGastosAvulsosDoMes(ano, mes));
}

// usada pelo Histórico: só lê o que já existe, nunca cria lançamento/ganho novo pra mês antigo
function resumoMesSomenteLeitura(ano, mes) {
  return calcularResumo(listLancamentosExistentesDoMes(ano, mes), listGanhosExistentesDoMes(ano, mes), listGastosAvulsosDoMes(ano, mes));
}

function listHistoricoMeses() {
  const rows = db.prepare(`
    SELECT DISTINCT ano, mes FROM (
      SELECT ano, mes FROM lancamentos
      UNION SELECT CAST(substr(data,1,4) AS INTEGER) AS ano, CAST(substr(data,6,2) AS INTEGER) AS mes FROM ganhos
      UNION SELECT CAST(substr(data,1,4) AS INTEGER) AS ano, CAST(substr(data,6,2) AS INTEGER) AS mes FROM gastos_avulsos
    ) ORDER BY ano DESC, mes DESC
  `).all();
  return rows.map(r => ({ ano: r.ano, mes: r.mes, ...resumoMesSomenteLeitura(r.ano, r.mes) }));
}

module.exports = {
  listCategorias, criarCategoria, atualizarCategoria, removerCategoria,
  listContas, criarConta, atualizarConta, removerConta,
  listLancamentosDoMes, atualizarLancamento,
  listFontesRenda, criarFonteRenda, atualizarFonteRenda, removerFonteRenda,
  listGanhos, listGanhosDoMes, criarGanho, atualizarGanho, removerGanho,
  listGastosAvulsosDoMes, criarGastoAvulso, atualizarGastoAvulso, removerGastoAvulso,
  listRegras, criarRegra, removerRegra, categorizarPorRegra,
  importarExtrato, listTransacoes, atualizarCategoriaTransacao, removerTransacao,
  somaTransacoesDoMes, aplicarSomaAoLancamento,
  resumoMes, listHistoricoMeses,
};
