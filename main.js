const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const api = require('./src/api');
const { parseOfx } = require('./src/ofx');
const { parseCsv } = require('./src/csv');

// detecta o encoding real do arquivo em vez de assumir um fixo:
// CSV de banco costuma vir em UTF-8 (às vezes com BOM), OFX antigo costuma vir em latin1/cp1252
function lerArquivoTexto(caminho) {
  const buffer = fs.readFileSync(caminho);
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }
  const comoUtf8 = buffer.toString('utf8');
  if (!comoUtf8.includes('�')) return comoUtf8;
  return buffer.toString('latin1');
}

function registerHandlers() {
  const handlers = {
    'categorias:list': (_e, tipo) => api.listCategorias(tipo),
    'categorias:criar': (_e, c) => api.criarCategoria(c),
    'categorias:atualizar': (_e, id, c) => api.atualizarCategoria(id, c),
    'categorias:remover': (_e, id) => api.removerCategoria(id),

    'contas:list': (_e, somenteAtivas) => api.listContas(somenteAtivas),
    'contas:criar': (_e, c) => api.criarConta(c),
    'contas:atualizar': (_e, id, c) => api.atualizarConta(id, c),
    'contas:remover': (_e, id) => api.removerConta(id),

    'lancamentos:listDoMes': (_e, ano, mes) => api.listLancamentosDoMes(ano, mes),
    'lancamentos:atualizar': (_e, id, dados) => api.atualizarLancamento(id, dados),

    'fontesRenda:list': (_e, somenteAtivas) => api.listFontesRenda(somenteAtivas),
    'fontesRenda:criar': (_e, f) => api.criarFonteRenda(f),
    'fontesRenda:atualizar': (_e, id, f) => api.atualizarFonteRenda(id, f),
    'fontesRenda:remover': (_e, id) => api.removerFonteRenda(id),

    'ganhos:list': () => api.listGanhos(),
    'ganhos:listDoMes': (_e, ano, mes) => api.listGanhosDoMes(ano, mes),
    'ganhos:criar': (_e, g) => api.criarGanho(g),
    'ganhos:atualizar': (_e, id, g) => api.atualizarGanho(id, g),
    'ganhos:remover': (_e, id) => api.removerGanho(id),

    'gastosAvulsos:listDoMes': (_e, ano, mes) => api.listGastosAvulsosDoMes(ano, mes),
    'gastosAvulsos:criar': (_e, g) => api.criarGastoAvulso(g),
    'gastosAvulsos:atualizar': (_e, id, g) => api.atualizarGastoAvulso(id, g),
    'gastosAvulsos:remover': (_e, id) => api.removerGastoAvulso(id),

    'regras:list': () => api.listRegras(),
    'regras:criar': (_e, r) => api.criarRegra(r),
    'regras:remover': (_e, id) => api.removerRegra(id),
    'regras:reaplicar': () => api.reaplicarRegras(),

    'extrato:selecionarArquivo': async (e) => {
      const win = BrowserWindow.fromWebContents(e.sender);
      const resultado = await dialog.showOpenDialog(win, {
        title: 'Selecionar extrato (OFX ou CSV)',
        filters: [
          { name: 'Extrato (OFX ou CSV)', extensions: ['ofx', 'csv'] },
          { name: 'OFX', extensions: ['ofx'] },
          { name: 'CSV', extensions: ['csv'] },
        ],
        properties: ['openFile'],
      });
      if (resultado.canceled || resultado.filePaths.length === 0) return null;
      return resultado.filePaths[0];
    },
    'extrato:importar': (_e, contaId, caminhoArquivo, faturaAno, faturaMes) => {
      const conteudo = lerArquivoTexto(caminhoArquivo);
      const ehCsv = caminhoArquivo.toLowerCase().endsWith('.csv');
      const transacoes = ehCsv ? parseCsv(conteudo) : parseOfx(conteudo);
      return api.importarExtrato(contaId, transacoes, faturaAno, faturaMes);
    },
    'extrato:listTransacoes': (_e, contaId, ano, mes) => api.listTransacoes(contaId, ano, mes),
    'extrato:atualizarCategoria': (_e, id, categoriaId, salvarRegra) => api.atualizarCategoriaTransacao(id, categoriaId, salvarRegra),
    'extrato:removerTransacao': (_e, id) => api.removerTransacao(id),
    'extrato:somaDoMes': (_e, contaId, ano, mes) => api.somaTransacoesDoMes(contaId, ano, mes),
    'extrato:aplicarSomaAoLancamento': (_e, contaId, ano, mes) => api.aplicarSomaAoLancamento(contaId, ano, mes),

    'resumo:mes': (_e, ano, mes) => api.resumoMes(ano, mes),
    'historico:meses': () => api.listHistoricoMeses(),

    'dashboard:gastosPorCategoria': (_e, ano, mes, contaId) => api.gastosPorCategoria(ano, mes, contaId),
    'dashboard:topEstabelecimentos': (_e, ano, mes, contaId) => api.topEstabelecimentos(ano, mes, contaId),

    'investimentos:list': (_e, somenteAtivos) => api.listInvestimentos(somenteAtivos),
    'investimentos:criar': (_e, inv) => api.criarInvestimento(inv),
    'investimentos:atualizar': (_e, id, inv) => api.atualizarInvestimento(id, inv),
    'investimentos:remover': (_e, id) => api.removerInvestimento(id),
    'investimentos:resumo': () => api.resumoInvestimentos(),
    'investimentos:porTipo': () => api.investimentosPorTipo(),
  };
  for (const [canal, fn] of Object.entries(handlers)) {
    ipcMain.handle(canal, fn);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  registerHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
