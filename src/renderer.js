const api = window.gastosAPI;

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const hoje = new Date();
let estado = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
let categoriasCache = [];

function fmtMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    if (btn.dataset.view === 'ganhos') carregarGanhosPagina();
    if (btn.dataset.view === 'contas') carregarContasCadastro();
    if (btn.dataset.view === 'categorias') carregarCategorias();
    if (btn.dataset.view === 'historico') carregarHistorico();
    if (btn.dataset.view === 'extratos') carregarExtratosPagina();
  });
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
  return categoriasCache.filter((c) => !tipo || c.tipo === tipo).map((c) => ({ value: c.id, label: c.nome }));
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
    { key: 'cor', label: 'Cor', type: 'text' },
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

// ---------------- VIEW: Extratos ----------------
let estadoExtrato = { contaId: null, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };

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

async function carregarTransacoesExtrato() {
  document.getElementById('extrato-mes-titulo').textContent = `${MESES[estadoExtrato.mes - 1]} de ${estadoExtrato.ano}`;
  if (!estadoExtrato.contaId) {
    document.querySelector('#tabela-transacoes tbody').innerHTML = '<tr><td colspan="5" class="empty-hint">Cadastre uma conta primeiro (aba Contas).</td></tr>';
    return;
  }
  categoriasCache = await api.categorias.list();
  const [transacoes, soma] = await Promise.all([
    api.extrato.listTransacoes(estadoExtrato.contaId, estadoExtrato.ano, estadoExtrato.mes),
    api.extrato.somaDoMes(estadoExtrato.contaId, estadoExtrato.ano, estadoExtrato.mes),
  ]);

  document.getElementById('extrato-total-gasto').textContent = fmtMoeda(soma);
  document.getElementById('extrato-sem-categoria').textContent = transacoes.filter((t) => t.valor < 0 && !t.categoria_id).length;

  const opcoesDespesa = opcoesCategorias('despesa');
  const tbody = document.querySelector('#tabela-transacoes tbody');
  tbody.innerHTML = transacoes.length === 0
    ? '<tr><td colspan="5" class="empty-hint">Nenhuma transação importada pra esse mês ainda.</td></tr>'
    : '';
  transacoes.forEach((t) => {
    const tr = document.createElement('tr');
    const selectHtml = `<select data-id="${t.id}" data-action="cat-transacao">
      <option value="">Sem categoria</option>
      ${opcoesDespesa.map((o) => `<option value="${o.value}" ${o.value === t.categoria_id ? 'selected' : ''}>${o.label}</option>`).join('')}
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
  tbody.querySelectorAll('[data-action="cat-transacao"]').forEach((el) => {
    el.addEventListener('change', async (e) => {
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
      if (!categoriaId) { alert('Escolhe uma categoria antes de salvar a regra.'); return; }
      await api.extrato.atualizarCategoria(id, categoriaId, true);
      alert('Regra salva! Próximas importações com essa descrição já vêm categorizadas.');
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
  if (!estadoExtrato.contaId) { alert('Cadastre uma conta primeiro (aba Contas).'); return; }
  const caminho = await api.extrato.selecionarArquivo();
  if (!caminho) return;
  const resultado = await api.extrato.importar(estadoExtrato.contaId, caminho);
  alert(`${resultado.importadas} transação(ões) nova(s) importada(s). ${resultado.duplicadas} já existiam e foram ignoradas.`);
  carregarTransacoesExtrato();
});

document.getElementById('btn-aplicar-fatura').addEventListener('click', async () => {
  if (!estadoExtrato.contaId) return;
  const confirmado = confirm(`Usar o total das transações de ${MESES[estadoExtrato.mes - 1]}/${estadoExtrato.ano} como valor da fatura desse mês? Isso substitui o valor atual do lançamento.`);
  if (!confirmado) return;
  const soma = await api.extrato.aplicarSomaAoLancamento(estadoExtrato.contaId, estadoExtrato.ano, estadoExtrato.mes);
  alert(`Valor da fatura atualizado pra ${fmtMoeda(soma)}.`);
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

// ---------------- Boot ----------------
carregarMes();
