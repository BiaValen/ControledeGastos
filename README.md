# Controle de Gastos

App desktop pessoal (Electron + SQLite local) pra controlar contas fixas/variáveis, ganhos, gastos avulsos e histórico retroativo. Roda 100% offline, sem servidor, sem nuvem.

## Rodar

```bash
npm install
npm start
```

## Onde ficam os dados

O banco fica em `data/gastos.db`, na raiz do projeto. Esse arquivo **não sobe pro git** (veja `.gitignore`) — é só seu, local. Se quiser fazer backup, basta copiar essa pasta `data/`.

## Estrutura

- `main.js` — processo principal do Electron, registra os handlers de IPC
- `preload.js` — ponte segura entre o processo principal e a tela (contextBridge)
- `src/db.js` — schema do SQLite e seed das categorias padrão
- `src/api.js` — todas as operações de CRUD (contas, categorias, lançamentos, ganhos, gastos avulsos, histórico)
- `src/index.html`, `src/styles.css`, `src/renderer.js` — interface

## Telas

- **Mês atual** — contas do mês (pago/não pago), ganhos, gastos avulsos, totais
- **Contas** — cadastro de contas fixas/variáveis
- **Categorias** — cadastro de categorias
- **Histórico** — retroativo mês a mês, com gráficos de ganhos x gastos e saldo

## Planejado (ainda não construído)

- Gerenciamento de caronas por pessoa (quem pagou/não pagou)
- Importação de extrato OFX (Inter, Itaú) com categorização automática
- Caixinhas/emergência
- Carteiras VA/VR
