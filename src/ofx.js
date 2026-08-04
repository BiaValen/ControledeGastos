// Parser tolerante pra OFX de banco brasileiro (formato SGML antigo, tags sem fechamento).
// Não usa XML parser de verdade porque a maioria dos extratos de banco vem malformado.
const crypto = require('crypto');

function pegarCampo(bloco, tag) {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
  return m ? m[1].trim() : null;
}

function dataParaISO(raw) {
  if (!raw || raw.length < 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function hashTransacao(t) {
  if (t.fitid) return crypto.createHash('md5').update(`fitid:${t.fitid}`).digest('hex');
  return crypto.createHash('md5').update(`${t.data}|${t.valor}|${t.descricao}`).digest('hex');
}

function parseOfx(conteudo) {
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  return blocos
    .map((bloco) => {
      const dataISO = dataParaISO(pegarCampo(bloco, 'DTPOSTED'));
      const valorRaw = pegarCampo(bloco, 'TRNAMT');
      const valor = valorRaw ? parseFloat(valorRaw.replace(',', '.')) : null;
      const descricao = (pegarCampo(bloco, 'MEMO') || pegarCampo(bloco, 'NAME') || '').replace(/\s+/g, ' ').trim();
      const fitid = pegarCampo(bloco, 'FITID');
      if (!dataISO || valor === null || !descricao) return null;
      const t = { data: dataISO, valor, descricao, fitid };
      t.hash = hashTransacao(t);
      return t;
    })
    .filter(Boolean);
}

module.exports = { parseOfx };
