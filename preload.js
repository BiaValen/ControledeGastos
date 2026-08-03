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
  ganhos: {
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
  resumo: {
    mes: (ano, mes) => ipcRenderer.invoke('resumo:mes', ano, mes),
  },
  historico: {
    meses: () => ipcRenderer.invoke('historico:meses'),
  },
});
