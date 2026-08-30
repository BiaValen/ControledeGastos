const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const api = require('./src/api');
const { parseOfx } = require('./src/ofx');
const { parseCsv } = require('./src/csv');

// alguns drivers de vídeo no Windows não repintam a janela corretamente depois de
// atualizações de conteúdo via IPC, deixando a tela "presa" nos valores antigos
app.disableHardwareAcceleration();

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

// pega o ano/mês que aparece mais vezes nas transações, pra sugerir automaticamente
// qual fatura/mês isso deve virar, em vez de depender do usuário lembrar e escolher certo
function mesPredominante(transacoes) {
  const contagem = {};
  for (const t of transacoes) {
    if (!t.data) continue;
    const chave = t.data.slice(0, 7); // "AAAA-MM"
    contagem[chave] = (contagem[chave] || 0) + 1;
  }
  let melhor = null;
  for (const [chave, qtd] of Object.entries(contagem)) {
    if (!melhor || qtd > melhor.qtd) melhor = { chave, qtd };
  }
  if (!melhor) return null;
  const [ano, mes] = melhor.chave.split('-').map(Number);
  return { ano, mes };
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
    'extrato:detectarMes': (_e, contaId, caminhoArquivo) => {
      const conteudo = lerArquivoTexto(caminhoArquivo);
      const ehCsv = caminhoArquivo.toLowerCase().endsWith('.csv');
      const conta = api.getConta(contaId);
      const transacoes = ehCsv ? parseCsv(conteudo, !!(conta && conta.eh_cartao)) : parseOfx(conteudo);
      return mesPredominante(transacoes);
    },
    'extrato:importar': (_e, contaId, caminhoArquivo, faturaAno, faturaMes) => {
      const conteudo = lerArquivoTexto(caminhoArquivo);
      const ehCsv = caminhoArquivo.toLowerCase().endsWith('.csv');
      const conta = api.getConta(contaId);
      const transacoes = ehCsv ? parseCsv(conteudo, !!(conta && conta.eh_cartao)) : parseOfx(conteudo);
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

// evita abrir duas instâncias ao mesmo tempo (ex: clique duplo no atalho): a segunda
// tentativa só foca a janela já aberta, em vez de criar uma segunda conexão com o banco
const temLock = app.requestSingleInstanceLock();
if (!temLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const janelas = BrowserWindow.getAllWindows();
    if (janelas.length > 0) {
      const win = janelas[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

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
}
