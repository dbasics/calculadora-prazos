/**
 * Motor de cálculo de prazos processuais.
 * Módulo puro JS, sem dependência de DOM.
 * Depende de: easter.js (formatarData), holidays.js (HolidayManager)
 */

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function avancarUmDia(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return formatarData(d);
}

/**
 * Determina o marco inicial (dia 1 da contagem) conforme o tipo de data de entrada.
 *
 * - Disponibilização DJEN: publicação = 1º dia útil após disponibilização;
 *   dia 1 = 1º dia útil após publicação (2 saltos de dia útil)
 * - Publicação DJEN: dia 1 = 1º dia útil após publicação (1 salto)
 * - Prazo direto: dia 1 = 1º dia útil após o evento (1 salto)
 */
function determinarMarcoInicial(tipoData, dataEntradaStr, tribunalId, municipioId) {
  const etapas = [];

  if (tipoData === 'disponibilizacao_djen') {
    // Salto 1: disponibilização → publicação (1º dia útil seguinte)
    const diaAposDisp = avancarUmDia(dataEntradaStr);
    const publicacao = HolidayManager.proximoDiaUtil(diaAposDisp, tribunalId, municipioId);
    etapas.push({ etapa: 'Disponibilização', data: dataEntradaStr });
    etapas.push({ etapa: 'Publicação (1º dia útil após disponibilização)', data: publicacao });

    // Salto 2: publicação → início da contagem (1º dia útil seguinte)
    const diaAposPub = avancarUmDia(publicacao);
    const marcoInicial = HolidayManager.proximoDiaUtil(diaAposPub, tribunalId, municipioId);
    etapas.push({ etapa: 'Início da contagem (dia 1)', data: marcoInicial });

    return { marcoInicial, etapas };
  }

  if (tipoData === 'publicacao_djen') {
    etapas.push({ etapa: 'Publicação no DJEN', data: dataEntradaStr });

    // 1 salto: publicação → início da contagem
    const diaApos = avancarUmDia(dataEntradaStr);
    const marcoInicial = HolidayManager.proximoDiaUtil(diaApos, tribunalId, municipioId);
    etapas.push({ etapa: 'Início da contagem (dia 1)', data: marcoInicial });

    return { marcoInicial, etapas };
  }

  // prazo_direto: exclui o dia do evento, dia 1 = próximo dia útil
  etapas.push({ etapa: 'Data do evento', data: dataEntradaStr });
  const diaApos = avancarUmDia(dataEntradaStr);
  const marcoInicial = HolidayManager.proximoDiaUtil(diaApos, tribunalId, municipioId);
  etapas.push({ etapa: 'Início da contagem (dia 1)', data: marcoInicial });

  return { marcoInicial, etapas };
}

/**
 * Calcula prazo em dias úteis.
 */
function calcularDiasUteis(marcoInicial, diasPrazo, multiplicador, tribunalId, municipioId) {
  const totalDias = diasPrazo * multiplicador;
  const calendario = [];
  let contador = 0;
  let dataAtual = marcoInicial;

  // O marco inicial já é o dia 1, mas verificamos se é útil
  const verificacaoInicial = HolidayManager.verificarDia(dataAtual, tribunalId, municipioId);
  if (verificacaoInicial.util) {
    contador = 1;
    calendario.push({ data: dataAtual, contagem: 1, status: 'contado', motivo: 'Dia útil' });
  } else {
    calendario.push({ data: dataAtual, contagem: null, status: 'nao_contado', motivo: verificacaoInicial.motivo });
  }

  let limite = 0;
  while (contador < totalDias && limite < 1000) {
    dataAtual = avancarUmDia(dataAtual);
    const verificacao = HolidayManager.verificarDia(dataAtual, tribunalId, municipioId);

    if (verificacao.util) {
      contador++;
      calendario.push({ data: dataAtual, contagem: contador, status: 'contado', motivo: 'Dia útil' });
    } else {
      calendario.push({ data: dataAtual, contagem: null, status: 'nao_contado', motivo: verificacao.motivo });
    }
    limite++;
  }

  // Passo 6: Se o último dia não for útil (não deveria acontecer, mas por segurança)
  let vencimento = dataAtual;
  const verificacaoFinal = HolidayManager.verificarDia(vencimento, tribunalId, municipioId);
  if (!verificacaoFinal.util) {
    vencimento = HolidayManager.proximoDiaUtil(avancarUmDia(vencimento), tribunalId, municipioId);
    calendario.push({ data: vencimento, contagem: totalDias, status: 'prorrogado', motivo: 'Prorrogação - art. 224, §1º, CPC' });
  }

  return { vencimento, calendario, diasContados: totalDias };
}

/**
 * Calcula prazo em dias corridos.
 * Todos os dias são contados, mas se o vencimento cair em dia não útil,
 * prorroga para o próximo dia útil (art. 224, §1º, CPC).
 */
function calcularDiasCorridos(marcoInicial, diasPrazo, multiplicador, tribunalId, municipioId) {
  const totalDias = diasPrazo * multiplicador;
  const calendario = [];
  let dataAtual = marcoInicial;

  // Dia 1 é o marco inicial
  const verificacao1 = HolidayManager.verificarDia(dataAtual, tribunalId, municipioId);
  calendario.push({
    data: dataAtual,
    contagem: 1,
    status: 'contado',
    motivo: verificacao1.util ? 'Dia útil' : verificacao1.motivo + ' (contado - dias corridos)',
  });

  for (let i = 2; i <= totalDias; i++) {
    dataAtual = avancarUmDia(dataAtual);
    const verificacao = HolidayManager.verificarDia(dataAtual, tribunalId, municipioId);
    calendario.push({
      data: dataAtual,
      contagem: i,
      status: 'contado',
      motivo: verificacao.util ? 'Dia útil' : verificacao.motivo + ' (contado - dias corridos)',
    });
  }

  // Passo 6: prorrogação se vencimento em dia não útil
  let vencimento = dataAtual;
  const verificacaoFinal = HolidayManager.verificarDia(vencimento, tribunalId, municipioId);
  if (!verificacaoFinal.util) {
    const vencimentoOriginal = vencimento;
    vencimento = HolidayManager.proximoDiaUtil(avancarUmDia(vencimento), tribunalId, municipioId);
    // Adicionar dias de prorrogação ao calendário
    let prorogData = avancarUmDia(vencimentoOriginal);
    while (prorogData <= vencimento) {
      const verif = HolidayManager.verificarDia(prorogData, tribunalId, municipioId);
      if (prorogData === vencimento) {
        calendario.push({ data: prorogData, contagem: totalDias, status: 'prorrogado', motivo: 'Prorrogação - art. 224, §1º, CPC' });
      } else {
        calendario.push({ data: prorogData, contagem: null, status: 'nao_contado', motivo: verif.motivo + ' (prorrogação)' });
      }
      prorogData = avancarUmDia(prorogData);
    }
  }

  return { vencimento, calendario, diasContados: totalDias };
}

/**
 * Calcula prazo em meses.
 * Soma N meses ao marco inicial pelo calendário civil (art. 132, CC).
 * Se o dia resultante não existir, usa o último dia do mês.
 * Prorroga se cair em dia não útil.
 */
function calcularMeses(marcoInicial, meses, multiplicador, tribunalId, municipioId) {
  const totalMeses = meses * multiplicador;
  const dataBase = new Date(marcoInicial + 'T12:00:00');
  const diaOriginal = dataBase.getDate();

  // Soma meses
  dataBase.setMonth(dataBase.getMonth() + totalMeses);

  // Se o dia mudou (ex: 31/jan + 1 mês → 3/mar em vez de 28/fev), ajustar
  if (dataBase.getDate() !== diaOriginal) {
    dataBase.setDate(0); // Vai para o último dia do mês anterior
  }

  let vencimentoStr = formatarData(dataBase);
  const calendario = [{ data: marcoInicial, contagem: 'Início', status: 'contado', motivo: 'Marco inicial' }];

  // Prorrogação se não útil
  const verificacao = HolidayManager.verificarDia(vencimentoStr, tribunalId, municipioId);
  if (!verificacao.util) {
    const original = vencimentoStr;
    vencimentoStr = HolidayManager.proximoDiaUtil(avancarUmDia(vencimentoStr), tribunalId, municipioId);
    calendario.push({ data: original, contagem: null, status: 'nao_contado', motivo: verificacao.motivo + ' (vencimento original)' });
    calendario.push({ data: vencimentoStr, contagem: totalMeses + ' meses', status: 'prorrogado', motivo: 'Prorrogação - art. 224, §1º, CPC' });
  } else {
    calendario.push({ data: vencimentoStr, contagem: totalMeses + ' meses', status: 'contado', motivo: 'Vencimento' });
  }

  return { vencimento: vencimentoStr, calendario, diasContados: totalMeses + ' meses' };
}

/**
 * Função principal - calcula o prazo processual.
 */
function calcularPrazo({ tipoData, dataEntrada, diasPrazo, tipoContagem, tribunal = 'tjes', municipio = 'vitoria-es', multiplicador = 1, descricao = '' }) {
  const dataEntradaStr = typeof dataEntrada === 'string' ? dataEntrada : formatarData(dataEntrada);

  // Passo 1: determinar marco inicial
  const { marcoInicial, etapas } = determinarMarcoInicial(tipoData, dataEntradaStr, tribunal, municipio);

  // Passos 2-7: calcular conforme tipo de contagem
  let resultado;
  if (tipoContagem === 'meses') {
    resultado = calcularMeses(marcoInicial, diasPrazo, multiplicador, tribunal, municipio);
  } else if (tipoContagem === 'dias_corridos') {
    resultado = calcularDiasCorridos(marcoInicial, diasPrazo, multiplicador, tribunal, municipio);
  } else {
    resultado = calcularDiasUteis(marcoInicial, diasPrazo, multiplicador, tribunal, municipio);
  }

  const dataVenc = new Date(resultado.vencimento + 'T12:00:00');

  return {
    marcoInicial,
    etapas,
    dataVencimento: resultado.vencimento,
    diaSemana: DIAS_SEMANA[dataVenc.getDay()],
    calendario: resultado.calendario,
    diasContados: resultado.diasContados,
    parametros: {
      tipoData,
      dataEntrada: dataEntradaStr,
      diasPrazo,
      tipoContagem,
      tribunal,
      municipio,
      multiplicador,
      descricao,
    },
  };
}
