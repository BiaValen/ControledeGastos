const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gastosAPI', {
  categorias: {
    list: (tipo) => ipcRenderer.invoke('categorias:list', tipo),
    criar: (c) => ipcRenderer.invoke('categorias:criar', c),
    atualizar: (id, c) => ipcRenderer.invoke('categorias:atualizar', id, c),
    remover: (id) => ipcRenderer.invoke('categorias:remover', id),
  },
  contas: {
    list: (somenteAtivas) => ipcRenderer.invoke('contas:list', somenteAtivas),
    criar: (c) => ipcRenderer.invoke('contas:criar', c),
    atualizar: (id, c) => ipcRenderer.invoke('contas:atualizar', id, c),
    remover: (id) => ipcRenderer.invoke('contas:remover', id),
  },
  lancamentos: {
    listDoMes: (ano, mes) => ipcRenderer.invoke('lancamentos:listDoMes', ano, mes),
    atualizar: (id, dados) => ipcRenderer.invoke('lancamentos:atualizar', id, dados),
  },
  fontesRenda: {
    list: (somenteAtivas) => ipcRenderer.invoke('fontesRenda:list', somenteAtivas),
    criar: (f) => ipcRenderer.invoke('fontesRenda:criar', f),
    atualizar: (id, f) => ipcRenderer.invoke('fontesRenda:atualizar', id, f),
    remover: (id) => ipcRenderer.invoke('fontesRenda:remover', id),
  },
  ganhos: {
    list: () => ipcRenderer.invoke('ganhos:list'),
    listDoMes: (ano, mes) => ipcRenderer.invoke('ganhos:listDoMes', ano, mes),
    criar: (g) => ipcRenderer.invoke('ganhos:criar', g),
    atualizar: (id, g) => ipcRenderer.invoke('ganhos:atualizar', id, g),
    remover: (id) => ipcRenderer.invoke('ganhos:remover', id),
  },
  gastosAvulsos: {
    listDoMes: (ano, mes) => ipcRenderer.invoke('gastosAvulsos:listDoMes', ano, mes),
    criar: (g) => ipcRenderer.invoke('gastosAvulsos:criar', g),
    atualizar: (id, g) => ipcRenderer.invoke('gastosAvulsos:atualizar', id, g),
    remover: (id) => ipcRenderer.invoke('gastosAvulsos:remover', id),
  },
  regras: {
    list: () => ipcRenderer.invoke('regras:list'),
    criar: (r) => ipcRenderer.invoke('regras:criar', r),
    remover: (id) => ipcRenderer.invoke('regras:remover', id),
  },
  extrato: {
    selecionarArquivo: () => ipcRenderer.invoke('extrato:selecionarArquivo'),
    importar: (contaId, caminho) => ipcRenderer.invoke('extrato:importar', contaId, caminho),
    listTransacoes: (contaId, ano, mes) => ipcRenderer.invoke('extrato:listTransacoes', contaId, ano, mes),
    atualizarCategoria: (id, categoriaId, salvarRegra) => ipcRenderer.invoke('extrato:atualizarCategoria', id, categoriaId, salvarRegra),
    removerTransacao: (id) => ipcRenderer.invoke('extrato:removerTransacao', id),
    somaDoMes: (contaId, ano, mes) => ipcRenderer.invoke('extrato:somaDoMes', contaId, ano, mes),
    aplicarSomaAoLancamento: (contaId, ano, mes) => ipcRenderer.invoke('extrato:aplicarSomaAoLancamento', contaId, ano, mes),
  },
  resumo: {
    mes: (ano, mes) => ipcRenderer.invoke('resumo:mes', ano, mes),
  },
  historico: {
    meses: () => ipcRenderer.invoke('historico:meses'),
  },
});
