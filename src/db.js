const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'gastos.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL DEFAULT '#6b7280',
  tipo TEXT NOT NULL DEFAULT 'despesa' CHECK (tipo IN ('despesa','ganho'))
);

CREATE TABLE IF NOT EXISTS contas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('fixa','variavel')),
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  dia_vencimento INTEGER,
  valor_padrao REAL,
  ativa INTEGER NOT NULL DEFAULT 1,
  eh_cartao INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lancamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  valor REAL,
  pago INTEGER NOT NULL DEFAULT 0,
  data_pagamento TEXT,
  UNIQUE(conta_id, ano, mes)
);

CREATE TABLE IF NOT EXISTS fontes_renda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'fixa' CHECK (tipo IN ('fixa','variavel')),
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  dia_recebimento INTEGER,
  valor_padrao REAL,
  ativa INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ganhos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  observacao TEXT,
  fonte_id INTEGER REFERENCES fontes_renda(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS gastos_avulsos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  pago INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS regras_categorizacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  padrao TEXT NOT NULL UNIQUE,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transacoes_importadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id INTEGER REFERENCES contas(id) ON DELETE SET NULL,
  data TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  hash TEXT NOT NULL,
  fatura_ano INTEGER,
  fatura_mes INTEGER
);

CREATE TABLE IF NOT EXISTS investimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Outros',
  valor_investido REAL NOT NULL DEFAULT 0,
  valor_atual REAL NOT NULL DEFAULT 0,
  data_inicio TEXT,
  observacao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1
);
`);

// migração: bancos criados antes da tabela fontes_renda não têm a coluna fonte_id em ganhos
const colunasGanhos = db.prepare("PRAGMA table_info(ganhos)").all().map((c) => c.name);
if (!colunasGanhos.includes('fonte_id')) {
  db.exec('ALTER TABLE ganhos ADD COLUMN fonte_id INTEGER REFERENCES fontes_renda(id) ON DELETE SET NULL');
}

// migração: bancos criados antes do campo eh_cartao em contas
const colunasContas = db.prepare("PRAGMA table_info(contas)").all().map((c) => c.name);
if (!colunasContas.includes('eh_cartao')) {
  db.exec('ALTER TABLE contas ADD COLUMN eh_cartao INTEGER NOT NULL DEFAULT 0');
}

// migração: separa "data da compra original" de "em qual fatura ela cai" (parcela de
// compra antiga entra na fatura do mês atual, não no mês da compra), e tira qualquer
// UNIQUE de hash — importar uma fatura agora sempre SUBSTITUI o que já existia pra
// aquele mês/conta, em vez de tentar adivinhar duplicata (isso já causou dado sumido
// e categorização perdida por causa de coincidência de data/valor/descrição).
const sqlTransacoes = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transacoes_importadas'").get();
const precisaRebuild = sqlTransacoes && /UNIQUE/i.test(sqlTransacoes.sql);
if (precisaRebuild) {
  const colunasAtuais = db.prepare("PRAGMA table_info(transacoes_importadas)").all().map((c) => c.name);
  const temFatura = colunasAtuais.includes('fatura_ano');
  db.exec(`
    CREATE TABLE transacoes_importadas_novo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conta_id INTEGER REFERENCES contas(id) ON DELETE SET NULL,
      data TEXT NOT NULL,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      hash TEXT NOT NULL,
      fatura_ano INTEGER,
      fatura_mes INTEGER
    );
    INSERT INTO transacoes_importadas_novo (id, conta_id, data, descricao, valor, categoria_id, hash${temFatura ? ', fatura_ano, fatura_mes' : ''})
      SELECT id, conta_id, data, descricao, valor, categoria_id, hash${temFatura ? ', fatura_ano, fatura_mes' : ''} FROM transacoes_importadas;
    DROP TABLE transacoes_importadas;
    ALTER TABLE transacoes_importadas_novo RENAME TO transacoes_importadas;
  `);
} else {
  const colunasTransacoes = db.prepare("PRAGMA table_info(transacoes_importadas)").all().map((c) => c.name);
  if (!colunasTransacoes.includes('fatura_ano')) {
    db.exec('ALTER TABLE transacoes_importadas ADD COLUMN fatura_ano INTEGER');
    db.exec('ALTER TABLE transacoes_importadas ADD COLUMN fatura_mes INTEGER');
  }
}

const categoriaCount = db.prepare('SELECT COUNT(*) AS n FROM categorias').get().n;
if (categoriaCount === 0) {
  const insert = db.prepare('INSERT INTO categorias (nome, cor, tipo) VALUES (?, ?, ?)');
  const defaults = [
    ['Moradia', '#8b5cf6', 'despesa'],
    ['Alimentação', '#f59e0b', 'despesa'],
    ['Mercado', '#84cc16', 'despesa'],
    ['Transporte', '#3b82f6', 'despesa'],
    ['Saúde', '#ef4444', 'despesa'],
    ['Lazer', '#ec4899', 'despesa'],
    ['Assinaturas', '#06b6d4', 'despesa'],
    ['Educação', '#14b8a6', 'despesa'],
    ['Cuidados pessoais', '#f97316', 'despesa'],
    ['Outros', '#6b7280', 'despesa'],
    ['Salário', '#22c55e', 'ganho'],
    ['Renda extra', '#10b981', 'ganho'],
  ];
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(...row);
  });
  insertMany(defaults);
}

module.exports = db;
