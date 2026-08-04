const api = window.gastosAPI;

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const hoje = new Date();
let estado = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
let categoriasCache = [];

function fmtMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// substitui window.alert/confirm — diálogo nativo do Electron trava o foco da janela
// por um tempo depois de fechar, e os <select> ficam sem abrir até o foco voltar.
function mostrarToast(mensagem) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensagem;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

function confirmarAcao(mensagem) {
  return new Promise((resolve) => {
    document.getElementById('confirm-mensagem').textContent = mensagem;
    const backdrop = document.getElementById('confirm-backdrop');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancelar');
    backdrop.classList.add('active');
    const limpar = () => {
      backdrop.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };
    const onOk = () => { limpar(); resolve(true); };
    const onCancel = () => { limpar(); resolve(false); };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

// ---------------- Tema claro/escuro ----------------
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema === 'claro' ? 'light' : 'dark');
  const icone = document.getElementById('theme-icon');
  icone.textContent = tema === 'claro' ? '☀️' : '🌙';
  document.getElementById('btn-theme-toggle').title = tema === 'claro' ? 'Mudar pra tema escuro' : 'Mudar pra tema claro';
}
let temaAtual = localStorage.getItem('tema') || 'escuro';
aplicarTema(temaAtual);
document.getElementById('btn-theme-toggle').addEventListener('click', () => {
  temaAtual = temaAtual === 'claro' ? 'escuro' : 'claro';
  localStorage.setItem('tema', temaAtual);
  aplicarTema(temaAtual);
});

// ---------------- Navegação de views ----------------
document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'mes') carregarMes();
    if (btn.dataset.view === 'dashboard') carregarDashboard();
    if (btn.dataset.view === 'ganhos') carregarGanhosPagina();
    if (btn.dataset.view === 'contas') carregarContasCadastro();
    if (btn.dataset.view === 'categorias') carregarCategorias();
    if (btn.dataset.view === 'historico') carregarHistorico();
    if (btn.dataset.view === 'extratos') carregarExtratosPagina();
    if (btn.dataset.view === 'investimentos') carregarInvestimentos();
  });
});

// ---------------- Menu de configurações (engrenagem) ----------------
document.getElementById('btn-settings').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('settings-menu').classList.toggle('aberto');
});
document.querySelectorAll('.settings-menu-item').forEach((btn) => {
  btn.addEventListener('click', () => document.getElementById('settings-menu').classList.remove('aberto'));
});
document.addEventListener('click', (e) => {
  const menu = document.getElementById('settings-menu');
  if (menu.classList.contains('aberto') && !e.target.closest('.settings-wrap')) {
    menu.classList.remove('aberto');
  }
});

// ---------------- Modal genérico ----------------
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
let modalOnSave = null;

function abrirModal(titulo, campos, valoresIniciais, onSave) {
  modalTitle.textContent = titulo;
  modalBody.innerHTML = '';
  const inputs = {};

  campos.forEach((campo) => {
    const wrap = document.createElement('div');
    wrap.className = campo.type === 'checkbox' ? 'field field-checkbox' : 'field';

    let input;
    if (campo.type === 'select') {
      input = document.createElement('select');
      (campo.options || []).forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        input.appendChild(o);
      });
    } else if (campo.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'checkbox';
    } else {
      input = document.createElement('input');
      input.type = campo.type || 'text';
      if (campo.step) input.step = campo.step;
    }
    input.id = 'campo-' + campo.key;

    const label = document.createElement('label');
    label.textContent = campo.label;
    label.setAttribute('for', input.id);

    if (campo.type === 'checkbox') {
      wrap.appendChild(input);
      wrap.appendChild(label);
    } else {
      wrap.appendChild(label);
      wrap.appendChild(input);
    }
    modalBody.appendChild(wrap);
    inputs[campo.key] = input;
  });

  campos.forEach((campo) => {
    const val = valoresIniciais ? valoresIniciais[campo.key] : undefined;
    if (campo.type === 'checkbox') inputs[campo.key].checked = !!val;
    else if (val !== undefined && val !== null) inputs[campo.key].value = val;
  });

  modalOnSave = () => {
    const resultado = {};
    campos.forEach((campo) => {
      const el = inputs[campo.key];
      if (campo.type === 'checkbox') resultado[campo.key] = el.checked;
      else if (campo.type === 'number') resultado[campo.key] = el.value === '' ? null : parseFloat(el.value);
      else resultado[campo.key] = el.value;
    });
    onSave(resultado);
    fecharModal();
  };

  modalBackdrop.classList.add('active');
}
function fecharModal() { modalBackdrop.classList.remove('active'); }
document.getElementById('modal-cancel').addEventListener('click', fecharModal);
document.getElementById('modal-save').addEventListener('click', () => modalOnSave && modalOnSave());
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) fecharModal(); });

function opcoesCategorias(tipo) {
  return categoriasCache.filter((c) => !tipo || c.tipo === tipo).map((c) => ({ value: c.id, label: c.nome, cor: c.cor }));
}

function corComOpacidade(hex, alpha) {
  const h = (hex || '#6b7280').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// deixa o <select> de categoria com a cara da categoria escolhida (fundo e borda tingidos)
function pintarSelectCategoria(select) {
  const cor = select.selectedOptions[0] ? select.selectedOptions[0].dataset.cor : null;
  if (cor) {
    select.style.background = corComOpacidade(cor, 0.18);
    select.style.borderColor = cor;
  } else {
    select.style.background = '';
    select.style.borderColor = '';
  }
}

// ---------------- VIEW: Mês atual ----------------
async function carregarMes() {
  document.getElementById('mes-titulo').textContent = `${MESES[estado.mes - 1]} de ${estado.ano}`;
  categoriasCache = await api.categorias.list();

  const [lancs, ganhos, avulsos, resumo] = await Promise.all([
    api.lancamentos.listDoMes(estado.ano, estado.mes),
    api.ganhos.listDoMes(estado.ano, estado.mes),
    api.gastosAvulsos.listDoMes(estado.ano, estado.mes),
    api.resumo.mes(estado.ano, estado.mes),
  ]);

  document.getElementById('stat-ganhos').textContent = fmtMoeda(resumo.totalGanhos);
  document.getElementById('stat-pago').textContent = fmtMoeda(resumo.totalContasPago);
  document.getElementById('stat-pendente').textContent = fmtMoeda(resumo.totalContasPendente);
  document.getElementById('stat-avulsos').textContent = fmtMoeda(resumo.totalAvulsos);
  const saldoEl = document.getElementById('stat-saldo');
  saldoEl.textContent = fmtMoeda(resumo.saldo);
  saldoEl.className = 'stat-value ' + (resumo.saldo >= 0 ? 'positivo' : 'alerta');

  const tbodyContas = document.querySelector('#tabela-contas tbody');
  tbodyContas.innerHTML = '';
  if (lancs.length === 0) {
    tbodyContas.innerHTML = '<tr><td colspan="5" class="empty-hint">Nenhuma conta cadastrada ainda. Vá em "Contas" para adicionar.</td></tr>';
  }
  lancs.forEach((l) => {
    const tr = document.createElement('tr');
    if (l.pago) tr.classList.add('pago-row');
    tr.innerHTML = `
      <td><input type="checkbox" class="checkbox" ${l.pago ? 'checked' : ''} data-id="${l.id}" data-action="toggle-pago" /></td>
      <td>${l.conta_nome}</td>
      <td>${l.categoria_nome ? `<span class="badge"><span class="badge-dot" style="background:${l.categoria_cor}"></span>${l.categoria_nome}</span>` : '—'}</td>
      <td>${l.dia_vencimento ? 'dia ' + l.dia_vencimento : '—'}</td>
      <td><input type="number" step="0.01" class="valor-input" value="${l.valor ?? ''}" data-id="${l.id}" data-action="valor" /></td>
    `;
    tbodyContas.appendChild(tr);
  });
  tbodyContas.querySelectorAll('[data-action="toggle-pago"]').forEach((el) => {
    el.addEventListener('change', async (e) => {
      await api.lancamentos.atualizar(parseInt(e.target.dataset.id), { pago: e.target.checked });
      carregarMes();
    });
  });
  tbodyContas.querySelectorAll('[data-action="valor"]').forEach((el) => {
    el.addEventListener('change', async (e) => {
      const valor = e.target.value === '' ? null : parseFloat(e.target.value);
      await api.lancamentos.atualizar(parseInt(e.target.dataset.id), { valor });
      carregarMes();
    });
  });

  const tbodyGanhos = document.querySelector('#tabela-ganhos tbody');
  tbodyGanhos.innerHTML = ganhos.length === 0
    ? '<tr><td colspan="5" class="empty-hint">Nenhum ganho lançado neste mês.</td></tr>'
    : '';
  ganhos.forEach((g) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.data.slice(8, 10)}/${g.data.slice(5, 7)}</td>
      <td>${g.descricao}</td>
      <td>${g.categoria_nome ? `<span class="badge"><span class="badge-dot" style="background:${g.categoria_cor}"></span>${g.categoria_nome}</span>` : '—'}</td>
      <td>${fmtMoeda(g.valor)}</td>
      <td>
        <button class="icon-action" data-id="${g.id}" data-action="edit-ganho">✎</button>
        <button class="icon-action" data-id="${g.id}" data-action="del-ganho">✕</button>
      </td>
    `;
    tbodyGanhos.appendChild(tr);
  });
  tbodyGanhos.querySelectorAll('[data-action="edit-ganho"]').forEach((el) => {
    el.addEventListener('click', () => abrirModalGanho(ganhos.find((g) => g.id === parseInt(el.dataset.id)), carregarMes));
  });
  tbodyGanhos.querySelectorAll('[data-action="del-ganho"]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      await api.ganhos.remover(parseInt(e.target.dataset.id));
      carregarMes();
    });
  });

  const tbodyAvulsos = document.querySelector('#tabela-avulsos tbody');
  tbodyAvulsos.innerHTML = avulsos.length === 0
    ? '<tr><td colspan="5" class="empty-hint">Nenhum gasto avulso lançado neste mês.</td></tr>'
    : '';
  avulsos.forEach((g) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.data.slice(8, 10)}/${g.data.slice(5, 7)}</td>
      <td>${g.descricao}</td>
      <td>${g.categoria_nome ? `<span class="badge"><span class="badge-dot" style="background:${g.categoria_cor}"></span>${g.categoria_nome}</span>` : '—'}</td>
      <td>${fmtMoeda(g.valor)}</td>
      <td><button class="icon-action" data-id="${g.id}" data-action="del-avulso">✕</button></td>
    `;
    tbodyAvulsos.appendChild(tr);
  });
  tbodyAvulsos.querySelectorAll('[data-action="del-avulso"]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      await api.gastosAvulsos.remover(parseInt(e.target.dataset.id));
      carregarMes();
    });
  });
}

document.getElementById('mes-prev').addEventListener('click', () => {
  estado.mes -= 1;
  if (estado.mes < 1) { estado.mes = 12; estado.ano -= 1; }
  carregarMes();
});
document.getElementById('mes-next').addEventListener('click', () => {
  estado.mes += 1;
  if (estado.mes > 12) { estado.mes = 1; estado.ano += 1; }
  carregarMes();
});

function dataDefault() {
  return new Date().toISOString().slice(0, 10);
}

function abrirModalGanho(ganho, aoSalvar) {
  abrirModal(ganho ? 'Editar ganho' : 'Novo ganho', [
    { key: 'descricao', label: 'Descrição', type: 'text' },
    { key: 'valor', label: 'Valor', type: 'number', step: '0.01' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'categoria_id', label: 'Categoria', type: 'select', options: opcoesCategorias('ganho') },
    { key: 'observacao', label: 'Observação (opcional)', type: 'text' },
  ], ganho || { data: dataDefault() }, async (dados) => {
    if (ganho) await api.ganhos.atualizar(ganho.id, dados);
    else await api.ganhos.criar(dados);
    aoSalvar();
  });
}

document.getElementById('btn-add-ganho').addEventListener('click', () => abrirModalGanho(null, carregarMes));

document.getElementById('btn-add-avulso').addEventListener('click', () => {
  abrirModal('Novo gasto avulso', [
    { key: 'descricao', label: 'Descrição', type: 'text' },
    { key: 'valor', label: 'Valor', type: 'number', step: '0.01' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'categoria_id', label: 'Categoria', type: 'select', options: opcoesCategorias('despesa') },
  ], { data: dataDefault() }, async (dados) => {
    await api.gastosAvulsos.criar(dados);
    carregarMes();
  });
});

// ---------------- Fontes de renda recorrente ----------------
async function carregarFontesRenda() {
  const fontes = await api.fontesRenda.list(false);
  const tbody = document.querySelector('#tabela-fontes-renda tbody');
  tbody.innerHTML = fontes.length === 0
    ? '<tr><td colspan="7" class="empty-hint">Nenhuma fonte cadastrada. Ex: Salário.</td></tr>'
    : '';
  fontes.forEach((f) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.nome}</td>
      <td>${f.tipo === 'fixa' ? 'Fixa' : 'Variável'}</td>
      <td>${f.categoria_nome ? `<span class="badge"><span class="badge-dot" style="background:${f.categoria_cor}"></span>${f.categoria_nome}</span>` : '—'}</td>
      <td>${f.dia_recebimento ? 'dia ' + f.dia_recebimento : '—'}</td>
      <td>${f.valor_padrao != null ? fmtMoeda(f.valor_padrao) : '—'}</td>
      <td>${f.ativa ? 'Sim' : 'Não'}</td>
      <td>
        <button class="icon-action" data-id="${f.id}" data-action="edit-fonte">✎</button>
        <button class="icon-action" data-id="${f.id}" data-action="del-fonte">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-action="edit-fonte"]').forEach((el) => {
    el.addEventListener('click', () => abrirModalFonteRenda(fontes.find((f) => f.id === parseInt(el.dataset.id))));
  });
  tbody.querySelectorAll('[data-action="del-fonte"]').forEach((el) => {
    el.addEventListener('click', async () => {
      await api.fontesRenda.remover(parseInt(el.dataset.id));
      carregarFontesRenda();
    });
  });
}

function abrirModalFonteRenda(fonte) {
  abrirModal(fonte ? 'Editar fonte de renda' : 'Nova fonte de renda', [
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'fixa', label: 'Fixa' }, { value: 'variavel', label: 'Variável' }] },
    { key: 'categoria_id', label: 'Categoria', type: 'select', options: opcoesCategorias('ganho') },
    { key: 'dia_recebimento', label: 'Dia de recebimento', type: 'number' },
    { key: 'valor_padrao', label: 'Valor padrão (se fixa)', type: 'number', step: '0.01' },
    { key: 'ativa', label: 'Ativa', type: 'checkbox' },
  ], fonte || { ativa: true, tipo: 'fixa' }, async (dados) => {
    if (fonte) await api.fontesRenda.atualizar(fonte.id, dados);
    else await api.fontesRenda.criar(dados);
    carregarFontesRenda();
  });
}
document.getElementById('btn-add-fonte-renda').addEventListener('click', () => abrirModalFonteRenda(null));

// ---------------- VIEW: Ganhos (página própria) ----------------
async function carregarGanhosPagina() {
  categoriasCache = await api.categorias.list();
  await carregarFontesRenda();
  const ganhos = await api.ganhos.list();

  const totalGeral = ganhos.reduce((s, g) => s + g.valor, 0);
  const prefixMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const totalMes = ganhos.filter((g) => g.data.startsWith(prefixMesAtual)).reduce((s, g) => s + g.valor, 0);
  document.getElementById('ganhos-total-geral').textContent = fmtMoeda(totalGeral);
  document.getElementById('ganhos-total-mes').textContent = fmtMoeda(totalMes);

  const tbody = document.querySelector('#tabela-ganhos-pagina tbody');
  tbody.innerHTML = ganhos.length === 0
    ? '<tr><td colspan="6" class="empty-hint">Nenhum ganho lançado ainda.</td></tr>'
    : '';
  ganhos.forEach((g) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.data.slice(8, 10)}/${g.data.slice(5, 7)}/${g.data.slice(0, 4)}</td>
      <td>${g.descricao}</td>
      <td>${g.categoria_nome ? `<span class="badge"><span class="badge-dot" style="background:${g.categoria_cor}"></span>${g.categoria_nome}</span>` : '—'}</td>
      <td>${g.observacao || '—'}</td>
      <td>${fmtMoeda(g.valor)}</td>
      <td>
        <button class="icon-action" data-id="${g.id}" data-action="edit-ganho-pagina">✎</button>
        <button class="icon-action" data-id="${g.id}" data-action="del-ganho-pagina">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-action="edit-ganho-pagina"]').forEach((el) => {
    el.addEventListener('click', () => abrirModalGanho(ganhos.find((g) => g.id === parseInt(el.dataset.id)), carregarGanhosPagina));
  });
  tbody.querySelectorAll('[data-action="del-ganho-pagina"]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      await api.ganhos.remover(parseInt(e.target.dataset.id));
      carregarGanhosPagina();
    });
  });
}
document.getElementById('btn-add-ganho-pagina').addEventListener('click', () => abrirModalGanho(null, carregarGanhosPagina));

// ---------------- VIEW: Contas (cadastro) ----------------
async function carregarContasCadastro() {
  categoriasCache = await api.categorias.list();
  const contas = await api.contas.list(false);
  const tbody = document.querySelector('#tabela-contas-cadastro tbody');
  tbody.innerHTML = contas.length === 0
    ? '<tr><td colspan="8" class="empty-hint">Nenhuma conta cadastrada ainda.</td></tr>'
    : '';
  contas.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.nome}</td>
      <td>${c.tipo === 'fixa' ? 'Fixa' : 'Variável'}</td>
      <td>${c.categoria_nome ? `<span class="badge"><span class="badge-dot" style="background:${c.categoria_cor}"></span>${c.categoria_nome}</span>` : '—'}</td>
      <td>${c.dia_vencimento ? 'dia ' + c.dia_vencimento : '—'}</td>
      <td>${c.valor_padrao != null ? fmtMoeda(c.valor_padrao) : '—'}</td>
      <td><input type="checkbox" class="checkbox" data-id="${c.id}" data-action="toggle-cartao" ${c.eh_cartao ? 'checked' : ''} /></td>
      <td><input type="checkbox" class="checkbox" data-id="${c.id}" data-action="toggle-ativa" ${c.ativa ? 'checked' : ''} /></td>
      <td>
        <button class="icon-action" data-id="${c.id}" data-action="edit-conta">✎</button>
        <button class="icon-action" data-id="${c.id}" data-action="del-conta">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-action="toggle-cartao"]').forEach((el) => {
    el.addEventListener('change', async (e) => {
      const conta = contas.find((c) => c.id === parseInt(e.target.dataset.id));
      await api.contas.atualizar(conta.id, { ...conta, eh_cartao: e.target.checked });
      carregarContasCadastro();
    });
  });
  tbody.querySelectorAll('[data-action="toggle-ativa"]').forEach((el) => {
    el.addEventListener('change', async (e) => {
      const conta = contas.find((c) => c.id === parseInt(e.target.dataset.id));
      await api.contas.atualizar(conta.id, { ...conta, ativa: e.target.checked });
      carregarContasCadastro();
    });
  });
  tbody.querySelectorAll('[data-action="edit-conta"]').forEach((el) => {
    el.addEventListener('click', () => abrirModalConta(contas.find((c) => c.id === parseInt(el.dataset.id))));
  });
  tbody.querySelectorAll('[data-action="del-conta"]').forEach((el) => {
    el.addEventListener('click', async () => {
      await api.contas.remover(parseInt(el.dataset.id));
      carregarContasCadastro();
    });
  });
}

function abrirModalConta(conta) {
  abrirModal(conta ? 'Editar conta' : 'Nova conta', [
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'fixa', label: 'Fixa' }, { value: 'variavel', label: 'Variável' }] },
    { key: 'categoria_id', label: 'Categoria', type: 'select', options: opcoesCategorias('despesa') },
    { key: 'dia_vencimento', label: 'Dia de vencimento', type: 'number' },
    { key: 'valor_padrao', label: 'Valor padrão (se fixa)', type: 'number', step: '0.01' },
    { key: 'eh_cartao', label: 'É cartão (aparece na importação de extrato)', type: 'checkbox' },
    { key: 'ativa', label: 'Ativa', type: 'checkbox' },
  ], conta || { ativa: true }, async (dados) => {
    if (conta) await api.contas.atualizar(conta.id, dados);
    else await api.contas.criar(dados);
    carregarContasCadastro();
  });
}
document.getElementById('btn-add-conta').addEventListener('click', () => abrirModalConta(null));

// ---------------- VIEW: Categorias ----------------
async function carregarCategorias() {
  categoriasCache = await api.categorias.list();
  const tbody = document.querySelector('#tabela-categorias tbody');
  tbody.innerHTML = '';
  categoriasCache.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-dot" style="background:${c.cor}"></span></td>
      <td>${c.nome}</td>
      <td>${c.tipo === 'ganho' ? 'Ganho' : 'Despesa'}</td>
      <td>
        <button class="icon-action" data-id="${c.id}" data-action="edit-cat">✎</button>
        <button class="icon-action" data-id="${c.id}" data-action="del-cat">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-action="edit-cat"]').forEach((el) => {
    el.addEventListener('click', () => abrirModalCategoria(categoriasCache.find((c) => c.id === parseInt(el.dataset.id))));
  });
  tbody.querySelectorAll('[data-action="del-cat"]').forEach((el) => {
    el.addEventListener('click', async () => {
      await api.categorias.remover(parseInt(el.dataset.id));
      carregarCategorias();
    });
  });
}

function abrirModalCategoria(categoria) {
  abrirModal(categoria ? 'Editar categoria' : 'Nova categoria', [
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'despesa', label: 'Despesa' }, { value: 'ganho', label: 'Ganho' }] },
    { key: 'cor', label: 'Cor', type: 'color' },
  ], categoria || { cor: '#6b7280', tipo: 'despesa' }, async (dados) => {
    if (categoria) await api.categorias.atualizar(categoria.id, dados);
    else await api.categorias.criar(dados);
    carregarCategorias();
  });
}
document.getElementById('btn-add-categoria').addEventListener('click', () => abrirModalCategoria(null));

// ---------------- VIEW: Histórico ----------------
function mesAbrev(m) {
  return `${MESES[m.mes - 1].slice(0, 3).toLowerCase()}/${String(m.ano).slice(2)}`;
}

// linha com pontos (em vez de barra) — melhor pra ver tendência de duas séries cruzando
function renderGraficoLinhaPontos(containerId, mesesAsc) {
  const el = document.getElementById(containerId);
  if (mesesAsc.length === 0) { el.innerHTML = '<p class="empty-hint">Sem dados suficientes ainda.</p>'; return; }

  const dados = mesesAsc.map((m) => ({
    label: mesAbrev(m),
    ganhos: m.totalGanhos,
    gastos: m.totalContasPago + m.totalAvulsos,
  }));
  const maxVal = Math.max(1, ...dados.flatMap((d) => [d.ganhos, d.gastos]));

  const slot = 80;
  const W = Math.max(480, dados.length * slot);
  const H = 220;
  const padBottom = 26, padTop = 16;
  const areaH = H - padBottom - padTop;
  const x = (i) => i * slot + slot / 2;
  const y = (valor) => padTop + areaH - (valor / maxVal) * areaH;

  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => {
    const gy = padTop + areaH * (1 - f);
    return `<line class="grid-line" x1="0" y1="${gy}" x2="${W}" y2="${gy}" />`;
  }).join('');

  function linha(chave, cor, rotulo) {
    const pontos = dados.map((d, i) => `${x(i)},${y(d[chave])}`).join(' ');
    const circulos = dados.map((d, i) => `<circle cx="${x(i)}" cy="${y(d[chave])}" r="4.5" fill="${cor}"><title>${rotulo} ${d.label}: ${fmtMoeda(d[chave])}</title></circle>`).join('');
    return `<polyline points="${pontos}" fill="none" stroke="${cor}" stroke-width="2" />${circulos}`;
  }

  const labels = dados.map((d, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${d.label}</text>`).join('');

  el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMinYMid meet">
    ${gridLines}
    ${linha('gastos', 'var(--red)', 'Gastos')}
    ${linha('ganhos', 'var(--green)', 'Ganhos')}
    ${labels}
  </svg>`;
}

function renderGraficoGanhosGastos(containerId, mesesAsc) {
  const el = document.getElementById(containerId);
  if (mesesAsc.length === 0) { el.innerHTML = '<p class="empty-hint">Sem dados suficientes ainda.</p>'; return; }

  const dados = mesesAsc.map((m) => ({
    label: mesAbrev(m),
    ganhos: m.totalGanhos,
    gastos: m.totalContasPago + m.totalAvulsos,
  }));
  const maxVal = Math.max(1, ...dados.flatMap((d) => [d.ganhos, d.gastos]));

  const slot = 64;
  const W = Math.max(480, dados.length * slot);
  const H = 220;
  const padBottom = 26;
  const padTop = 10;
  const areaH = H - padBottom - padTop;

  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => {
    const y = padTop + areaH * (1 - f);
    return `<line class="grid-line" x1="0" y1="${y}" x2="${W}" y2="${y}" />`;
  }).join('');

  const barras = dados.map((d, i) => {
    const cx = i * slot + slot / 2;
    const hGanho = (d.ganhos / maxVal) * areaH;
    const hGasto = (d.gastos / maxVal) * areaH;
    const yGanho = padTop + areaH - hGanho;
    const yGasto = padTop + areaH - hGasto;
    return `
      <rect class="bar-ganho" x="${cx - 20}" y="${yGanho}" width="16" height="${hGanho}" rx="2">
        <title>Ganhos ${d.label}: ${fmtMoeda(d.ganhos)}</title>
      </rect>
      <rect class="bar-gasto" x="${cx + 4}" y="${yGasto}" width="16" height="${hGasto}" rx="2">
        <title>Gastos ${d.label}: ${fmtMoeda(d.gastos)}</title>
      </rect>
      <text x="${cx}" y="${H - 8}" text-anchor="middle">${d.label}</text>
    `;
  }).join('');

  el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMinYMid meet">
    ${gridLines}
    ${barras}
  </svg>`;
}

function renderGraficoSaldo(containerId, mesesAsc) {
  const el = document.getElementById(containerId);
  if (mesesAsc.length === 0) { el.innerHTML = '<p class="empty-hint">Sem dados suficientes ainda.</p>'; return; }

  const dados = mesesAsc.map((m) => ({ label: mesAbrev(m), saldo: m.saldo }));
  const maxAbs = Math.max(1, ...dados.map((d) => Math.abs(d.saldo)));

  const slot = 64;
  const W = Math.max(480, dados.length * slot);
  const H = 220;
  const padBottom = 20;
  const padTop = 10;
  const baseline = padTop + (H - padTop - padBottom) / 2;
  const meiaArea = (H - padTop - padBottom) / 2;

  const barras = dados.map((d, i) => {
    const cx = i * slot + slot / 2;
    const h = (Math.abs(d.saldo) / maxAbs) * meiaArea;
    const positivo = d.saldo >= 0;
    const y = positivo ? baseline - h : baseline;
    return `
      <rect class="${positivo ? 'bar-saldo-pos' : 'bar-saldo-neg'}" x="${cx - 14}" y="${y}" width="28" height="${h}" rx="2">
        <title>Saldo ${d.label}: ${fmtMoeda(d.saldo)}</title>
      </rect>
      <text x="${cx}" y="${H - 4}" text-anchor="middle">${d.label}</text>
    `;
  }).join('');

  el.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMinYMid meet">
    <line class="eixo" x1="0" y1="${baseline}" x2="${W}" y2="${baseline}" />
    ${barras}
  </svg>`;
}

async function carregarHistorico() {
  const meses = await api.historico.meses();
  const mesesAsc = [...meses].reverse();
  renderGraficoGanhosGastos('chart-ganhos-gastos', mesesAsc);
  renderGraficoSaldo('chart-saldo', mesesAsc);

  const tbody = document.querySelector('#tabela-historico tbody');
  tbody.innerHTML = meses.length === 0
    ? '<tr><td colspan="6" class="empty-hint">Ainda não há histórico. Lance contas, ganhos ou gastos em algum mês.</td></tr>'
    : '';
  meses.forEach((m) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${MESES[m.mes - 1]} ${m.ano}</td>
      <td>${fmtMoeda(m.totalGanhos)}</td>
      <td>${fmtMoeda(m.totalContasPago)}</td>
      <td>${fmtMoeda(m.totalContasPendente)}</td>
      <td>${fmtMoeda(m.totalAvulsos)}</td>
      <td style="color:${m.saldo >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtMoeda(m.saldo)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------- VIEW: Dashboard ----------------
let estadoDashboard = { contaId: null, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };

function renderDonut(containerId, dados) {
  const el = document.getElementById(containerId);
  const total = dados.reduce((s, d) => s + d.total, 0);
  if (dados.length === 0 || total <= 0) {
    el.innerHTML = '<p class="empty-hint">Sem gastos categorizados nesse mês ainda.</p>';
    return;
  }
  const r = 70, cx = 100, cy = 100, largura = 26;
  const circunferencia = 2 * Math.PI * r;
  let acumulado = 0;
  const arcos = dados.map((d) => {
    const fracao = d.total / total;
    const comprimento = fracao * circunferencia;
    const arco = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.categoria_cor}" stroke-width="${largura}"
      stroke-dasharray="${comprimento} ${circunferencia - comprimento}" stroke-dashoffset="${-acumulado}"
      transform="rotate(-90 ${cx} ${cy})"><title>${d.categoria_nome}: ${fmtMoeda(d.total)} (${(fracao * 100).toFixed(0)}%)</title></circle>`;
    acumulado += comprimento;
    return arco;
  }).join('');

  const legenda = dados.map((d) => {
    const pct = ((d.total / total) * 100).toFixed(0);
    return `<div style="display:flex; align-items:center; gap:8px; font-size:12px; padding:3px 0;">
      <span class="badge-dot" style="background:${d.categoria_cor}"></span>
      <span style="flex:1">${d.categoria_nome}</span>
      <span style="color:var(--text-dim)">${pct}%</span>
      <span style="min-width:80px; text-align:right">${fmtMoeda(d.total)}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex; gap:24px; align-items:center; flex-wrap:wrap;">
      <svg viewBox="0 0 200 200" width="180" height="180">
        ${arcos}
        <text x="100" y="96" text-anchor="middle" font-size="12" fill="var(--text-dim)">Total</text>
        <text x="100" y="116" text-anchor="middle" font-size="15" font-weight="600" fill="var(--text)">${fmtMoeda(total)}</text>
      </svg>
      <div style="flex:1; min-width:180px;">${legenda}</div>
    </div>
  `;
}

// barras empilhadas: gasto por categoria mês a mês, pra ver a tendência de cada
// categoria (não só o total). Limita às 5 categorias com maior gasto no período e
// junta o resto em "Outras", senão o gráfico fica ilegível com muita cor.
function renderTendenciaGastosCategoria(containerId, meses, porMes) {
  const el = document.getElementById(containerId);
  const totalPorCategoria = new Map();
  porMes.forEach((mesDados) => {
    mesDados.forEach((c) => {
      const atual = totalPorCategoria.get(c.categoria_nome) || { total: 0, cor: c.categoria_cor };
      atual.total += c.total;
      totalPorCategoria.set(c.categoria_nome, atual);
    });
  });
  const ordenadas = [...totalPorCategoria.entries()].sort((a, b) => b[1].total - a[1].total);
  if (ordenadas.length === 0) {
    el.innerHTML = '<p class="empty-hint">Sem gastos categorizados nesse período ainda.</p>';
    return;
  }
  const principais = ordenadas.slice(0, 5).map(([nome, info]) => ({ nome, cor: info.cor }));
  const nomesOutras = new Set(ordenadas.slice(5).map(([nome]) => nome));
  const categoriasChart = nomesOutras.size > 0 ? [...principais, { nome: 'Outras', cor: '#6b7280' }] : principais;

  const dadosPorMes = meses.map((m, i) => {
    const valores = {};
    categoriasChart.forEach((c) => { valores[c.nome] = 0; });
    porMes[i].forEach((c) => {
      const chave = nomesOutras.has(c.categoria_nome) ? 'Outras' : c.categoria_nome;
      valores[chave] = (valores[chave] || 0) + c.total;
    });
    return { label: mesAbrev(m), valores };
  });

  const maxTotal = Math.max(1, ...dadosPorMes.map((d) => Object.values(d.valores).reduce((s, v) => s + v, 0)));
  const slot = 90;
  const W = Math.max(480, dadosPorMes.length * slot);
  const H = 240;
  const padBottom = 26, padTop = 10;
  const areaH = H - padBottom - padTop;

  const barras = dadosPorMes.map((d, i) => {
    const cx = i * slot + slot / 2;
    let yAtual = padTop + areaH;
    const segmentos = categoriasChart.map((c) => {
      const valor = d.valores[c.nome] || 0;
      const altura = (valor / maxTotal) * areaH;
      yAtual -= altura;
      if (valor <= 0) return '';
      return `<rect x="${cx - 20}" y="${yAtual}" width="40" height="${altura}" fill="${c.cor}" rx="2"><title>${c.nome} — ${d.label}: ${fmtMoeda(valor)}</title></rect>`;
    }).join('');
    return `${segmentos}<text x="${cx}" y="${H - 8}" text-anchor="middle">${d.label}</text>`;
  }).join('');

  const legenda = categoriasChart.map((c) => `
    <span style="display:inline-flex; align-items:center; gap:5px; margin-right:14px;">
      <span class="badge-dot" style="background:${c.cor}"></span>${c.nome}
    </span>`).join('');

  el.innerHTML = `
    <div class="chart-legend" style="flex-wrap:wrap; margin-bottom:12px;">${legenda}</div>
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMinYMid meet">${barras}</svg>
  `;
}

async function carregarTendenciaGastosCategoria() {
  const meses = [];
  let ano = estadoDashboard.ano, mes = estadoDashboard.mes;
  for (let i = 0; i < 6; i++) {
    meses.unshift({ ano, mes });
    mes -= 1;
    if (mes < 1) { mes = 12; ano -= 1; }
  }
  const contaId = estadoDashboard.contaId || undefined;
  const porMes = await Promise.all(meses.map((m) => api.dashboard.gastosPorCategoria(m.ano, m.mes, contaId)));
  renderTendenciaGastosCategoria('dash-chart-tendencia-categoria', meses, porMes);
}

async function popularSelectEscopoDashboard() {
  const cartoes = (await api.contas.list(true)).filter((c) => c.eh_cartao);
  const select = document.getElementById('dash-select-escopo');
  const valorAtual = select.value;
  select.innerHTML = '<option value="">Tudo (contas + cartões + avulsos)</option>'
    + cartoes.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('');
  select.value = valorAtual || '';
}

async function carregarDashboard() {
  document.getElementById('dash-mes-titulo').textContent = `${MESES[estadoDashboard.mes - 1]} de ${estadoDashboard.ano}`;
  await popularSelectEscopoDashboard();
  const contaId = estadoDashboard.contaId || undefined;

  const [categorias, estabelecimentos, resumo, historico] = await Promise.all([
    api.dashboard.gastosPorCategoria(estadoDashboard.ano, estadoDashboard.mes, contaId),
    api.dashboard.topEstabelecimentos(estadoDashboard.ano, estadoDashboard.mes, contaId),
    api.resumo.mes(estadoDashboard.ano, estadoDashboard.mes),
    api.historico.meses(),
  ]);

  const totalGasto = categorias.reduce((s, c) => s + c.total, 0);
  document.getElementById('dash-total-gasto').textContent = fmtMoeda(totalGasto);
  document.getElementById('dash-total-ganhos').textContent = fmtMoeda(resumo.totalGanhos);
  const saldoEl = document.getElementById('dash-saldo');
  saldoEl.textContent = fmtMoeda(resumo.saldo);
  saldoEl.className = 'stat-value ' + (resumo.saldo >= 0 ? 'positivo' : 'alerta');

  renderDonut('dash-donut', categorias);

  const tbody = document.querySelector('#dash-tabela-estabelecimentos tbody');
  tbody.innerHTML = estabelecimentos.length === 0
    ? '<tr><td colspan="3" class="empty-hint">Nenhuma transação de cartão nesse mês ainda.</td></tr>'
    : '';
  estabelecimentos.forEach((e) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.descricao}</td><td>${e.qtd}</td><td>${fmtMoeda(e.total)}</td>`;
    tbody.appendChild(tr);
  });

  const mesesAsc = [...historico].reverse().slice(-6);
  renderGraficoLinhaPontos('dash-chart-tendencia', mesesAsc);

  await carregarTendenciaGastosCategoria();
}

document.getElementById('dash-select-escopo').addEventListener('change', (e) => {
  estadoDashboard.contaId = e.target.value ? parseInt(e.target.value) : null;
  carregarDashboard();
});
document.getElementById('dash-mes-prev').addEventListener('click', () => {
  estadoDashboard.mes -= 1;
  if (estadoDashboard.mes < 1) { estadoDashboard.mes = 12; estadoDashboard.ano -= 1; }
  carregarDashboard();
});
document.getElementById('dash-mes-next').addEventListener('click', () => {
  estadoDashboard.mes += 1;
  if (estadoDashboard.mes > 12) { estadoDashboard.mes = 1; estadoDashboard.ano += 1; }
  carregarDashboard();
});

// ---------------- VIEW: Extratos ----------------
let estadoExtrato = { contaId: null, categoriaFiltro: '', ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };

async function popularSelectContasExtrato() {
  const todas = await api.contas.list(true);
  const contas = todas.filter((c) => c.eh_cartao);
  const select = document.getElementById('extrato-select-conta');
  const valorAtual = estadoExtrato.contaId;
  select.innerHTML = contas.length === 0
    ? '<option value="">Nenhum cartão cadastrado</option>'
    : contas.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('');
  if (contas.length === 0) { estadoExtrato.contaId = null; return; }
  const existeAtual = contas.some((c) => c.id === valorAtual);
  estadoExtrato.contaId = existeAtual ? valorAtual : contas[0].id;
  select.value = estadoExtrato.contaId;
}

function popularSelectCategoriaFiltro() {
  const select = document.getElementById('extrato-select-categoria-filtro');
  const opcoes = [...opcoesCategorias('despesa'), ...opcoesCategorias('ganho')];
  select.innerHTML = '<option value="">Todas</option><option value="0">Sem categoria</option>'
    + opcoes.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  select.value = estadoExtrato.categoriaFiltro || '';
}

async function carregarTransacoesExtrato() {
  document.getElementById('extrato-mes-titulo').textContent = `${MESES[estadoExtrato.mes - 1]} de ${estadoExtrato.ano}`;
  if (!estadoExtrato.contaId) {
    document.querySelector('#tabela-transacoes tbody').innerHTML = '<tr><td colspan="5" class="empty-hint">Cadastre uma conta primeiro (aba Contas).</td></tr>';
    return;
  }
  categoriasCache = await api.categorias.list();
  popularSelectCategoriaFiltro();
  const [todasTransacoes, soma] = await Promise.all([
    api.extrato.listTransacoes(estadoExtrato.contaId, estadoExtrato.ano, estadoExtrato.mes),
    api.extrato.somaDoMes(estadoExtrato.contaId, estadoExtrato.ano, estadoExtrato.mes),
  ]);

  document.getElementById('extrato-total-gasto').textContent = fmtMoeda(soma);
  document.getElementById('extrato-sem-categoria').textContent = todasTransacoes.filter((t) => t.valor < 0 && !t.categoria_id).length;

  const filtro = estadoExtrato.categoriaFiltro;
  const transacoes = !filtro ? todasTransacoes
    : filtro === '0' ? todasTransacoes.filter((t) => !t.categoria_id)
    : todasTransacoes.filter((t) => t.categoria_id === parseInt(filtro));

  const opcoesDespesa = opcoesCategorias('despesa');
  const opcoesGanho = opcoesCategorias('ganho');
  const tbody = document.querySelector('#tabela-transacoes tbody');
  tbody.innerHTML = transacoes.length === 0
    ? '<tr><td colspan="5" class="empty-hint">Nenhuma transação pra mostrar com esse filtro.</td></tr>'
    : '';
  transacoes.forEach((t) => {
    const tr = document.createElement('tr');
    const opcoes = t.valor < 0 ? opcoesDespesa : opcoesGanho;
    const selectHtml = `<select class="select-categoria" data-id="${t.id}" data-action="cat-transacao">
      <option value="">Sem categoria</option>
      ${opcoes.map((o) => `<option value="${o.value}" data-cor="${o.cor}" ${o.value === t.categoria_id ? 'selected' : ''}>${o.label}</option>`).join('')}
    </select>`;
    tr.innerHTML = `
      <td>${t.data.slice(8, 10)}/${t.data.slice(5, 7)}</td>
      <td>${t.descricao}</td>
      <td>${selectHtml}</td>
      <td style="color:${t.valor < 0 ? 'var(--red)' : 'var(--green)'}">${fmtMoeda(t.valor)}</td>
      <td>
        <button class="icon-action" data-id="${t.id}" data-action="salvar-regra-transacao" title="Aplicar essa categoria sempre que aparecer essa descrição">🔁</button>
        <button class="icon-action" data-id="${t.id}" data-action="del-transacao">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (transacoes.length > 0) {
    const totalFiltrado = transacoes.reduce((s, t) => s + t.valor, 0);
    const trTotal = document.createElement('tr');
    trTotal.innerHTML = `
      <td colspan="3" style="text-align:right; font-weight:600; color:var(--text-dim);">Total</td>
      <td style="font-weight:600; color:${totalFiltrado < 0 ? 'var(--red)' : 'var(--green)'}">${fmtMoeda(totalFiltrado)}</td>
      <td></td>
    `;
    tbody.appendChild(trTotal);
  }
  tbody.querySelectorAll('.select-categoria').forEach((el) => pintarSelectCategoria(el));
  tbody.querySelectorAll('[data-action="cat-transacao"]').forEach((el) => {
    el.addEventListener('change', async (e) => {
      pintarSelectCategoria(e.target);
      const categoriaId = e.target.value ? parseInt(e.target.value) : null;
      await api.extrato.atualizarCategoria(parseInt(e.target.dataset.id), categoriaId, false);
      carregarTransacoesExtrato();
    });
  });
  tbody.querySelectorAll('[data-action="salvar-regra-transacao"]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      const id = parseInt(e.target.dataset.id);
      const select = tbody.querySelector(`select[data-id="${id}"]`);
      const categoriaId = select.value ? parseInt(select.value) : null;
      if (!categoriaId) { mostrarToast('Escolhe uma categoria antes de salvar a regra.'); return; }
      await api.extrato.atualizarCategoria(id, categoriaId, true);
      mostrarToast('Regra salva! Próximas importações com essa descrição já vêm categorizadas.');
      carregarRegras();
    });
  });
  tbody.querySelectorAll('[data-action="del-transacao"]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      await api.extrato.removerTransacao(parseInt(e.target.dataset.id));
      carregarTransacoesExtrato();
    });
  });
}

async function carregarRegras() {
  const regras = await api.regras.list();
  document.getElementById('regras-contador').textContent = regras.length;
  const tbody = document.querySelector('#tabela-regras tbody');
  tbody.innerHTML = regras.length === 0
    ? '<tr><td colspan="3" class="empty-hint">Nenhuma regra ainda.</td></tr>'
    : '';
  regras.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.padrao}</td>
      <td>${r.categoria_nome ? `<span class="badge"><span class="badge-dot" style="background:${r.categoria_cor}"></span>${r.categoria_nome}</span>` : '—'}</td>
      <td><button class="icon-action" data-id="${r.id}" data-action="del-regra">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-action="del-regra"]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      await api.regras.remover(parseInt(e.target.dataset.id));
      carregarRegras();
    });
  });
}

document.getElementById('regras-toggle').addEventListener('click', () => {
  document.getElementById('regras-conteudo').classList.toggle('aberto');
  document.getElementById('regras-chevron').classList.toggle('aberto');
});

async function carregarExtratosPagina() {
  categoriasCache = await api.categorias.list();
  await popularSelectContasExtrato();
  await carregarTransacoesExtrato();
  await carregarRegras();
}

document.getElementById('extrato-select-conta').addEventListener('change', (e) => {
  estadoExtrato.contaId = parseInt(e.target.value);
  carregarTransacoesExtrato();
});
document.getElementById('extrato-select-categoria-filtro').addEventListener('change', (e) => {
  estadoExtrato.categoriaFiltro = e.target.value;
  carregarTransacoesExtrato();
});
document.getElementById('extrato-mes-prev').addEventListener('click', () => {
  estadoExtrato.mes -= 1;
  if (estadoExtrato.mes < 1) { estadoExtrato.mes = 12; estadoExtrato.ano -= 1; }
  carregarTransacoesExtrato();
});
document.getElementById('extrato-mes-next').addEventListener('click', () => {
  estadoExtrato.mes += 1;
  if (estadoExtrato.mes > 12) { estadoExtrato.mes = 1; estadoExtrato.ano += 1; }
  carregarTransacoesExtrato();
});

document.getElementById('btn-importar-ofx').addEventListener('click', async () => {
  if (!estadoExtrato.contaId) { mostrarToast('Cadastre uma conta primeiro (aba Contas).'); return; }
  const caminho = await api.extrato.selecionarArquivo();
  if (!caminho) return;
  const confirmado = await confirmarAcao(`Importar esse arquivo como a fatura de ${MESES[estadoExtrato.mes - 1]}/${estadoExtrato.ano}? Isso SUBSTITUI inteiro o que já tinha sido importado pra essa conta nesse mês (categoria já definida é preservada quando a mesma descrição+valor aparecer de novo).`);
  if (!confirmado) return;
  const resultado = await api.extrato.importar(estadoExtrato.contaId, caminho, estadoExtrato.ano, estadoExtrato.mes);
  mostrarToast(`${resultado.importadas} transação(ões) importada(s) pra ${MESES[estadoExtrato.mes - 1]}/${estadoExtrato.ano}.`);
  carregarTransacoesExtrato();
});

document.getElementById('btn-aplicar-fatura').addEventListener('click', async () => {
  if (!estadoExtrato.contaId) return;
  const confirmado = await confirmarAcao(`Usar o total das transações de ${MESES[estadoExtrato.mes - 1]}/${estadoExtrato.ano} como valor da fatura desse mês? Isso substitui o valor atual do lançamento.`);
  if (!confirmado) return;
  const soma = await api.extrato.aplicarSomaAoLancamento(estadoExtrato.contaId, estadoExtrato.ano, estadoExtrato.mes);
  mostrarToast(`Valor da fatura atualizado pra ${fmtMoeda(soma)}.`);
});

document.getElementById('btn-add-regra').addEventListener('click', () => {
  abrirModal('Nova regra', [
    { key: 'padrao', label: 'Padrão (parte do texto do extrato)', type: 'text' },
    { key: 'categoria_id', label: 'Categoria', type: 'select', options: opcoesCategorias('despesa') },
  ], {}, async (dados) => {
    await api.regras.criar(dados);
    carregarRegras();
  });
});

document.getElementById('btn-reaplicar-regras').addEventListener('click', async () => {
  const resultado = await api.regras.reaplicar();
  mostrarToast(`${resultado.atualizadas} transação(ões) categorizada(s) de ${resultado.verificadas} que estavam sem categoria.`);
  carregarTransacoesExtrato();
});

// ---------------- VIEW: Investimentos ----------------
const TIPOS_INVESTIMENTO = [
  { nome: 'Renda Fixa', cor: '#0ea5e9' },
  { nome: 'Tesouro Direto', cor: '#14b8a6' },
  { nome: 'Ações', cor: '#f59e0b' },
  { nome: 'Fundos', cor: '#8b5cf6' },
  { nome: 'Criptomoedas', cor: '#f97316' },
  { nome: 'Previdência', cor: '#84cc16' },
  { nome: 'Outros', cor: '#6b7280' },
];
function corDoTipoInvestimento(tipo) {
  const encontrado = TIPOS_INVESTIMENTO.find((t) => t.nome === tipo);
  return encontrado ? encontrado.cor : '#6b7280';
}

async function carregarInvestimentos() {
  const [investimentos, resumo, porTipo] = await Promise.all([
    api.investimentos.list(false),
    api.investimentos.resumo(),
    api.investimentos.porTipo(),
  ]);

  document.getElementById('inv-total-investido').textContent = fmtMoeda(resumo.totalInvestido);
  document.getElementById('inv-total-atual').textContent = fmtMoeda(resumo.totalAtual);
  const rendEl = document.getElementById('inv-rendimento');
  rendEl.textContent = fmtMoeda(resumo.rendimento);
  rendEl.className = 'stat-value ' + (resumo.rendimento >= 0 ? 'positivo' : 'alerta');
  const rendPctEl = document.getElementById('inv-rendimento-pct');
  rendPctEl.textContent = `${resumo.rendimentoPct >= 0 ? '+' : ''}${resumo.rendimentoPct.toFixed(1)}%`;
  rendPctEl.className = 'stat-value ' + (resumo.rendimentoPct >= 0 ? 'positivo' : 'alerta');

  const dadosDonut = porTipo.map((t) => ({ categoria_nome: t.tipo, categoria_cor: corDoTipoInvestimento(t.tipo), total: t.total }));
  renderDonut('inv-donut', dadosDonut);

  const tbody = document.querySelector('#tabela-investimentos tbody');
  tbody.innerHTML = investimentos.length === 0
    ? '<tr><td colspan="6" class="empty-hint">Nenhum investimento cadastrado ainda.</td></tr>'
    : '';
  investimentos.forEach((inv) => {
    const rendimento = inv.valor_atual - inv.valor_investido;
    const tr = document.createElement('tr');
    if (!inv.ativo) tr.classList.add('pago-row');
    tr.innerHTML = `
      <td>${inv.nome}</td>
      <td><span class="badge"><span class="badge-dot" style="background:${corDoTipoInvestimento(inv.tipo)}"></span>${inv.tipo}</span></td>
      <td>${fmtMoeda(inv.valor_investido)}</td>
      <td><input type="number" step="0.01" class="valor-input" value="${inv.valor_atual}" data-id="${inv.id}" data-action="valor-atual" /></td>
      <td style="color:${rendimento >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtMoeda(rendimento)}</td>
      <td>
        <button class="icon-action" data-id="${inv.id}" data-action="edit-investimento">✎</button>
        <button class="icon-action" data-id="${inv.id}" data-action="del-investimento">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-action="valor-atual"]').forEach((el) => {
    el.addEventListener('change', async (e) => {
      const inv = investimentos.find((i) => i.id === parseInt(e.target.dataset.id));
      const valor_atual = e.target.value === '' ? 0 : parseFloat(e.target.value);
      await api.investimentos.atualizar(inv.id, { ...inv, valor_atual });
      carregarInvestimentos();
    });
  });
  tbody.querySelectorAll('[data-action="edit-investimento"]').forEach((el) => {
    el.addEventListener('click', () => abrirModalInvestimento(investimentos.find((i) => i.id === parseInt(el.dataset.id))));
  });
  tbody.querySelectorAll('[data-action="del-investimento"]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      await api.investimentos.remover(parseInt(e.target.dataset.id));
      carregarInvestimentos();
    });
  });
}

function abrirModalInvestimento(investimento) {
  abrirModal(investimento ? 'Editar investimento' : 'Novo investimento', [
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'tipo', label: 'Tipo', type: 'select', options: TIPOS_INVESTIMENTO.map((t) => ({ value: t.nome, label: t.nome })) },
    { key: 'valor_investido', label: 'Valor investido', type: 'number', step: '0.01' },
    { key: 'valor_atual', label: 'Valor atual', type: 'number', step: '0.01' },
    { key: 'data_inicio', label: 'Data de início (opcional)', type: 'date' },
    { key: 'observacao', label: 'Observação (opcional)', type: 'text' },
    { key: 'ativo', label: 'Ativo', type: 'checkbox' },
  ], investimento || { tipo: 'Renda Fixa', ativo: true }, async (dados) => {
    if (investimento) await api.investimentos.atualizar(investimento.id, dados);
    else await api.investimentos.criar(dados);
    carregarInvestimentos();
  });
}
document.getElementById('btn-add-investimento').addEventListener('click', () => abrirModalInvestimento(null));

// ---------------- Boot ----------------
carregarMes();
