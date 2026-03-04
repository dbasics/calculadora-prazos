/**
 * Algoritmo Computus (Gauss) para calcular a data da Páscoa.
 * Retorna a Páscoa e todos os feriados móveis derivados para um dado ano.
 */

function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function somarDias(data, dias) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

function feriadosMoveis(ano) {
  const pascoa = calcularPascoa(ano);
  return [
    { data: somarDias(pascoa, -48), nome: 'Carnaval (segunda-feira)', tipo: 'movel' },
    { data: somarDias(pascoa, -47), nome: 'Carnaval (terça-feira)', tipo: 'movel' },
    { data: somarDias(pascoa, -46), nome: 'Quarta-feira de Cinzas', tipo: 'movel' },
    { data: somarDias(pascoa, -2), nome: 'Sexta-Feira Santa (Paixão de Cristo)', tipo: 'movel' },
    { data: somarDias(pascoa, 60), nome: 'Corpus Christi', tipo: 'movel' },
  ];
}

function formatarData(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
