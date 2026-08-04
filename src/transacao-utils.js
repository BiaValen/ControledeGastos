const crypto = require('crypto');

// Gera o hash de dedup de cada transação considerando a ORDEM de repetição.
// Sem isso, duas compras iguais (mesma data/valor/descrição) no mesmo arquivo
// colidiam no mesmo hash e a segunda era descartada como se fosse duplicata,
// mesmo sendo uma transação real e distinta.
function finalizarHashes(transacoes) {
  const contagem = {};
  return transacoes.map((t) => {
    const chaveBase = t.fitid ? `fitid:${t.fitid}` : `${t.data}|${t.valor}|${t.descricao}`;
    contagem[chaveBase] = (contagem[chaveBase] || 0) + 1;
    const hash = crypto.createHash('md5').update(`${chaveBase}#${contagem[chaveBase]}`).digest('hex');
    return { ...t, hash };
  });
}

module.exports = { finalizarHashes };
