// Parser de CSV de fatura de cartão. Detecta o delimitador e as colunas pelo
// cabeçalho (em vez de depender da ordem exata), pra funcionar em bancos diferentes.
const { finalizarHashes } = require('./transacao-utils');

function semAcento(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function detectarDelimitador(linhaHeader) {
  const semAspas = linhaHeader.replace(/"[^"]*"/g, '');
  const virgulas = (semAspas.match(/,/g) || []).length;
  const pontoVirgulas = (semAspas.match(/;/g) || []).length;
  return pontoVirgulas > virgulas ? ';' : ',';
}

function parseLinhaCsv(linha, delimitador) {
  const campos = [];
  let atual = '';
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (dentroAspas && linha[i + 1] === '"') { atual += '"'; i++; }
      else dentroAspas = !dentroAspas;
    } else if (ch === delimitador && !dentroAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += ch;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

function acharColuna(headers, candidatos) {
  const normalizados = headers.map(semAcento);
  for (const candidato of candidatos) {
    const idx = normalizados.findIndex((h) => h.includes(candidato));
    if (idx !== -1) return idx;
  }
  return -1;
}

function dataParaISO(raw) {
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function valorParaNumero(raw) {
  const limpo = raw.replace(/R\$\s*/i, '').trim();
  // formato brasileiro: ponto de milhar, vírgula decimal (ex: "1.488,82")
  const semMilhar = limpo.replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(semMilhar);
  return isNaN(valor) ? null : valor;
}

function parseCsv(conteudo) {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];

  const delimitador = detectarDelimitador(linhas[0]);
  const headers = parseLinhaCsv(linhas[0], delimitador).map((h) => h.replace(/^"|"$/g, ''));

  const idxData = acharColuna(headers, ['data']);
  const idxDescricao = acharColuna(headers, ['lancamento', 'historico', 'descricao', 'estabelecimento']);
  const idxValor = acharColuna(headers, ['valor']);
  const idxTipo = acharColuna(headers, ['tipo', 'parcela']);
  if (idxData === -1 || idxDescricao === -1 || idxValor === -1) return [];

  const transacoes = linhas.slice(1).map((linha) => {
    const campos = parseLinhaCsv(linha, delimitador).map((c) => c.replace(/^"|"$/g, ''));
    const dataISO = dataParaISO(campos[idxData] || '');
    const valorCampo = campos[idxValor] || '';
    const valorLido = valorParaNumero(valorCampo);
    const descricaoBase = (campos[idxDescricao] || '').replace(/\s+/g, ' ').trim();
    // duas parcelas de compras diferentes podem ter o mesmo nome de estabelecimento,
    // mesma data de cobrança e até o mesmo valor — sem isso, uma delas seria
    // descartada como se fosse duplicata da outra. A coluna "Tipo" (ex: "Parcela 2/6")
    // é o que realmente distingue elas, então entra como parte da descrição.
    const tipoRaw = idxTipo !== -1 ? (campos[idxTipo] || '').trim() : '';
    const ehParcela = /parcela/i.test(tipoRaw);
    const descricao = ehParcela ? `${descricaoBase} (${tipoRaw})` : descricaoBase;
    if (!dataISO || valorLido === null || !descricao) return null;
    // algumas faturas já vêm com sinal explícito: positivo = cobrança, negativo = crédito/estorno/pagamento.
    // nesse caso só inverte (nosso padrão é negativo = gasto, positivo = crédito).
    // quando não vem sinal nenhum, tudo é cobrança, exceto o pagamento da fatura (reconhecido pelo texto).
    let valor;
    if (/-/.test(valorCampo)) {
      valor = -valorLido;
    } else {
      const ehCredito = /PAGAMENTO\s+DE\s+FATURA/i.test(descricao);
      valor = ehCredito ? valorLido : -valorLido;
    }
    return { data: dataISO, valor, descricao, fitid: null };
  }).filter(Boolean);

  return finalizarHashes(transacoes);
}

module.exports = { parseCsv };
