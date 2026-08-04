const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const api = require('./src/api');

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

    'resumo:mes': (_e, ano, mes) => api.resumoMes(ano, mes),
    'historico:meses': () => api.listHistoricoMeses(),
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
