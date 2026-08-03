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
  ativa INTEGER NOT NULL DEFAULT 1
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

CREATE TABLE IF NOT EXISTS ganhos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  observacao TEXT
);

CREATE TABLE IF NOT EXISTS gastos_avulsos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  pago INTEGER NOT NULL DEFAULT 1
);
`);

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
