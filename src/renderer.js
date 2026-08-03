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
  document.getElementById('theme-icon').textContent = tema === 'claro' ? '☀️' : '🌙';
  document.getElementById('theme-label').textContent = tema === 'claro' ? 'Tema claro' : 'Tema escuro';
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
    if (btn.dataset.view === 'contas') carregarContasCadastro();
    if (btn.dataset.view === 'categorias') carregarCategorias();
    if (btn.dataset.view === 'historico') carregarHistorico();
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
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = campo.label;
    wrap.appendChild(label);

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
    } else {
      input = document.createElement('input');
      input.type = campo.type || 'text';
      if (campo.step) input.step = campo.step;
    }
    input.id = 'campo-' + campo.key;
    wrap.appendChild(input);
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
      <td><button class="icon-action" data-id="${g.id}" data-action="del-ganho">✕</button></td>
    `;
    tbodyGanhos.appendChild(tr);
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

document.getElementById('btn-add-ganho').addEventListener('click', () => {
  abrirModal('Novo ganho', [
    { key: 'descricao', label: 'Descrição', type: 'text' },
    { key: 'valor', label: 'Valor', type: 'number', step: '0.01' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'categoria_id', label: 'Categoria', type: 'select', options: opcoesCategorias('ganho') },
  ], { data: dataDefault() }, async (dados) => {
    await api.ganhos.criar(dados);
    carregarMes();
  });
});

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

// ---------------- VIEW: Contas (cadastro) ----------------
async function carregarContasCadastro() {
  categoriasCache = await api.categorias.list();
  const contas = await api.contas.list(false);
  const tbody = document.querySelector('#tabela-contas-cadastro tbody');
  tbody.innerHTML = contas.length === 0
    ? '<tr><td colspan="7" class="empty-hint">Nenhuma conta cadastrada ainda.</td></tr>'
    : '';
  contas.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.nome}</td>
      <td>${c.tipo === 'fixa' ? 'Fixa' : 'Variável'}</td>
      <td>${c.categoria_nome ? `<span class="badge"><span class="badge-dot" style="background:${c.categoria_cor}"></span>${c.categoria_nome}</span>` : '—'}</td>
      <td>${c.dia_vencimento ? 'dia ' + c.dia_vencimento : '—'}</td>
      <td>${c.valor_padrao != null ? fmtMoeda(c.valor_padrao) : '—'}</td>
      <td>${c.ativa ? 'Sim' : 'Não'}</td>
      <td>
        <button class="icon-action" data-id="${c.id}" data-action="edit-conta">✎</button>
        <button class="icon-action" data-id="${c.id}" data-action="del-conta">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
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

// ---------------- Boot ----------------
carregarMes();
