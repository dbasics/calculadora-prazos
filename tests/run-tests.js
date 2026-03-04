const fs = require('fs');

// Carregar módulos
eval(fs.readFileSync('js/easter.js', 'utf8'));

// Simular HolidayManager
const nacionais = JSON.parse(fs.readFileSync('data/feriados-nacionais.json', 'utf8'));
const tjes = JSON.parse(fs.readFileSync('data/tjes-2026.json', 'utf8'));
const vitoria = JSON.parse(fs.readFileSync('data/vitoria-es.json', 'utf8'));

const HolidayManager = {
  _feriadosNacionais: nacionais.feriados,
  _tribunais: { tjes },
  _municipios: { 'vitoria-es': vitoria },
  _suspensoesCustom: [],

  _feriadosNacionaisFixos(ano) {
    return this._feriadosNacionais.map(f => ({
      data: formatarData(new Date(ano, f.mes - 1, f.dia)),
      nome: f.nome, tipo: 'nacional', fundamentacao: f.fundamentacao,
    }));
  },

  _feriadosMoveis(ano) {
    return feriadosMoveis(ano).map(f => ({
      data: formatarData(f.data), nome: f.nome, tipo: 'movel',
    }));
  },

  _feriadosEstaduais(tribunalId, ano) {
    const tribunal = this._tribunais[tribunalId];
    if (!tribunal) return [];
    return tribunal.feriados_estaduais
      .filter(f => f.data.startsWith(String(ano)))
      .map(f => ({ data: f.data, nome: f.nome, tipo: 'estadual', fundamentacao: f.fundamentacao }));
  },

  _feriadosMunicipais(municipioId, ano) {
    const municipio = this._municipios[municipioId];
    if (!municipio) return [];
    return municipio.feriados.map(f => ({
      data: formatarData(new Date(ano, f.mes - 1, f.dia)),
      nome: f.nome, tipo: 'municipal', fundamentacao: f.fundamentacao,
    }));
  },

  _recessosCPC(dataStr) {
    const data = new Date(dataStr + 'T12:00:00');
    const mes = data.getMonth();
    const dia = data.getDate();
    const ano = data.getFullYear();
    if (mes === 0 && dia <= 20) return { emRecesso: true, motivo: 'Recesso forense (20/12-20/01) - art. 220, CPC' };
    if (mes === 11 && dia >= 20) return { emRecesso: true, motivo: 'Recesso forense (20/12-20/01) - art. 220, CPC' };
    return { emRecesso: false };
  },

  _recessosTribunal(tribunalId, dataStr) {
    const tribunal = this._tribunais[tribunalId];
    if (!tribunal || !tribunal.recessos) return null;
    for (const r of tribunal.recessos) {
      if (dataStr >= r.inicio && dataStr <= r.fim) return { nome: r.nome, fundamentacao: r.fundamentacao };
    }
    return null;
  },

  _suspensaoCustom() { return null; },

  verificarDia(dataStr, tribunalId = 'tjes', municipioId = 'vitoria-es') {
    const data = new Date(dataStr + 'T12:00:00');
    const diaSemana = data.getDay();
    const ano = data.getFullYear();

    if (diaSemana === 0) return { util: false, motivo: 'Domingo' };
    if (diaSemana === 6) return { util: false, motivo: 'Sábado' };

    const recesso = this._recessosCPC(dataStr);
    if (recesso.emRecesso) return { util: false, motivo: recesso.motivo };

    const recessoTrib = this._recessosTribunal(tribunalId, dataStr);
    if (recessoTrib) return { util: false, motivo: recessoTrib.nome };

    const susp = this._suspensaoCustom(dataStr);
    if (susp) return { util: false, motivo: 'Suspensão' };

    const todos = [
      ...this._feriadosNacionaisFixos(ano),
      ...this._feriadosMoveis(ano),
      ...this._feriadosEstaduais(tribunalId, ano),
      ...this._feriadosMunicipais(municipioId, ano),
    ];
    const feriado = todos.find(f => f.data === dataStr);
    if (feriado) return { util: false, motivo: feriado.nome };

    return { util: true, motivo: 'Dia útil' };
  },

  proximoDiaUtil(dataStr, tribunalId = 'tjes', municipioId = 'vitoria-es') {
    let data = new Date(dataStr + 'T12:00:00');
    let str = dataStr;
    for (let i = 0; i < 365; i++) {
      const r = this.verificarDia(str, tribunalId, municipioId);
      if (r.util) return str;
      data.setDate(data.getDate() + 1);
      str = formatarData(data);
    }
    return str;
  },
};

// Carregar engine
eval(fs.readFileSync('js/engine.js', 'utf8'));

// === TESTES ===
let passed = 0, failed = 0;
function assert(name, expected, actual) {
  if (expected === actual) {
    passed++;
    console.log('\x1b[32mOK\x1b[0m  ' + name);
  } else {
    failed++;
    console.log('\x1b[31mFALHOU\x1b[0m  ' + name + ' | Esperado: ' + expected + ' | Obtido: ' + actual);
  }
}

// Caso 1: Prazo direto (validado Legalcloud)
const c1 = calcularPrazo({ tipoData: 'prazo_direto', dataEntrada: '2026-03-03', diasPrazo: 15, tipoContagem: 'dias_uteis' });
assert('Caso 1: Prazo direto 03/03, 15d úteis -> 24/03', '2026-03-24', c1.dataVencimento);

// Caso 2: DJEN (validado spec)
const c2 = calcularPrazo({ tipoData: 'disponibilizacao_djen', dataEntrada: '2026-03-03', diasPrazo: 15, tipoContagem: 'dias_uteis' });
assert('Caso 2: DJEN 03/03, 15d úteis -> 25/03', '2026-03-25', c2.dataVencimento);

// Caso 3: Recesso fim de ano
const c3 = calcularPrazo({ tipoData: 'prazo_direto', dataEntrada: '2026-12-18', diasPrazo: 5, tipoContagem: 'dias_uteis' });
// 18/12=sex(evento), 19/12=sáb, 20/12+=recesso, 21/01=qui(d1), 22/01=sex(d2), 25/01=seg(d3), 26/01=ter(d4), 27/01=qua(d5)
assert('Caso 3: Recesso - 18/12, 5d -> 27/01/2027', '2027-01-27', c3.dataVencimento);

// Caso 4: Carnaval 2026
const c4 = calcularPrazo({ tipoData: 'prazo_direto', dataEntrada: '2026-02-13', diasPrazo: 5, tipoContagem: 'dias_uteis' });
assert('Caso 4: Carnaval - 13/02, 5d -> 25/02', '2026-02-25', c4.dataVencimento);

// Caso 5: Semana Santa TJES
const c5 = calcularPrazo({ tipoData: 'prazo_direto', dataEntrada: '2026-04-01', diasPrazo: 3, tipoContagem: 'dias_uteis' });
assert('Caso 5: Semana Santa - 01/04, 3d -> 08/04', '2026-04-08', c5.dataVencimento);

// Caso 6: Corpus Christi
const c6 = calcularPrazo({ tipoData: 'prazo_direto', dataEntrada: '2026-06-03', diasPrazo: 3, tipoContagem: 'dias_uteis' });
assert('Caso 6: Corpus Christi - 03/06, 3d -> 10/06', '2026-06-10', c6.dataVencimento);

// Caso 7: Quarta de Cinzas (dia inteiro TJES)
assert('Caso 7: Quarta de Cinzas nao util', false, HolidayManager.verificarDia('2026-02-18').util);

// Caso 8: Quinta-Feira Santa TJES
assert('Caso 8: Quinta-Feira Santa nao util', false, HolidayManager.verificarDia('2026-04-02').util);

// Caso 9: N.S. Penha (estadual ES)
assert('Caso 9: N.S. Penha nao util', false, HolidayManager.verificarDia('2026-04-13').util);

// Caso 10: N.S. Vitória (municipal)
assert('Caso 10: N.S. Vitoria nao util', false, HolidayManager.verificarDia('2026-09-08').util);

// Caso 11: Dia do Advogado (estadual)
assert('Caso 11: Dia do Advogado nao util', false, HolidayManager.verificarDia('2026-08-11').util);

// Caso 12: Pontos facultativos
assert('Caso 12a: Corpus Christi PF 04/06', false, HolidayManager.verificarDia('2026-06-04').util);
assert('Caso 12b: PF 05/06', false, HolidayManager.verificarDia('2026-06-05').util);

// Caso 13: Dia útil normal
assert('Caso 13: 04/03 e dia util', true, HolidayManager.verificarDia('2026-03-04').util);

// Caso 14: Multiplicador 2x
const c14 = calcularPrazo({ tipoData: 'prazo_direto', dataEntrada: '2026-03-03', diasPrazo: 15, tipoContagem: 'dias_uteis', multiplicador: 2 });
assert('Caso 14: Multiplicador 2x > 01/04', true, c14.dataVencimento > '2026-04-01');

// Caso 15: Páscoa 2026
assert('Caso 15: Pascoa 2026 = 05/04', '2026-04-05', formatarData(calcularPascoa(2026)));

// Caso 16: Dias corridos com prorrogação
const c16 = calcularPrazo({ tipoData: 'prazo_direto', dataEntrada: '2026-03-04', diasPrazo: 10, tipoContagem: 'dias_corridos' });
// Evento 04/03. Marco = 05/03. +10 dias corridos = dia 10 = 14/03 (sábado). Prorroga → 16/03 (segunda).
assert('Caso 16: Dias corridos com prorrogacao', '2026-03-16', c16.dataVencimento);

// Caso 17: Recesso CPC - 01/01 não é útil
assert('Caso 17: 01/01 em recesso CPC', false, HolidayManager.verificarDia('2027-01-01').util);

console.log('\n=== ' + passed + '/' + (passed + failed) + ' testes passaram ===');

if (failed > 0) process.exit(1);
