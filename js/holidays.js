/**
 * Gerenciador de feriados e dias úteis.
 * Carrega feriados nacionais, estaduais, municipais e móveis.
 * Verifica recesso automático do CPC (20/12-20/01).
 */

const HolidayManager = {
  _feriadosNacionais: [],
  _tribunais: {},
  _municipios: {},
  _suspensoesCustom: [],

  async init() {
    const [nacionais, tjes, vitoria] = await Promise.all([
      fetch('data/feriados-nacionais.json').then(r => r.json()),
      fetch('data/tjes-2026.json').then(r => r.json()),
      fetch('data/vitoria-es.json').then(r => r.json()),
    ]);
    this._feriadosNacionais = nacionais.feriados;
    this._tribunais['tjes'] = tjes;
    this._municipios['vitoria-es'] = vitoria;
    this._carregarSuspensoesCustom();
  },

  _carregarSuspensoesCustom() {
    try {
      const raw = localStorage.getItem('suspensoes_custom');
      this._suspensoesCustom = raw ? JSON.parse(raw) : [];
    } catch {
      this._suspensoesCustom = [];
    }
  },

  salvarSuspensaoCustom(suspensao) {
    this._suspensoesCustom.push(suspensao);
    localStorage.setItem('suspensoes_custom', JSON.stringify(this._suspensoesCustom));
  },

  removerSuspensaoCustom(index) {
    this._suspensoesCustom.splice(index, 1);
    localStorage.setItem('suspensoes_custom', JSON.stringify(this._suspensoesCustom));
  },

  getSuspensoesCustom() {
    return this._suspensoesCustom;
  },

  _feriadosNacionaisFixos(ano) {
    return this._feriadosNacionais.map(f => ({
      data: formatarData(new Date(ano, f.mes - 1, f.dia)),
      nome: f.nome,
      tipo: 'nacional',
      fundamentacao: f.fundamentacao,
    }));
  },

  _feriadosMoveis(ano) {
    return feriadosMoveis(ano).map(f => ({
      data: formatarData(f.data),
      nome: f.nome,
      tipo: 'movel',
      fundamentacao: 'Calculado a partir da Páscoa',
    }));
  },

  _feriadosEstaduais(tribunalId, ano) {
    const tribunal = this._tribunais[tribunalId];
    if (!tribunal) return [];

    const feriados = tribunal.feriados_estaduais
      .filter(f => f.data.startsWith(String(ano)))
      .map(f => ({
        data: f.data,
        nome: f.nome,
        tipo: 'estadual',
        fundamentacao: f.fundamentacao,
      }));

    return feriados;
  },

  _feriadosMunicipais(municipioId, ano) {
    const municipio = this._municipios[municipioId];
    if (!municipio) return [];

    return municipio.feriados.map(f => ({
      data: formatarData(new Date(ano, f.mes - 1, f.dia)),
      nome: f.nome,
      tipo: 'municipal',
      fundamentacao: f.fundamentacao,
    }));
  },

  _recessosCPC(dataStr) {
    const data = new Date(dataStr + 'T12:00:00');
    const ano = data.getFullYear();
    const mes = data.getMonth();
    const dia = data.getDate();

    // Recesso 20/12 a 20/01 (inclusive) - art. 220 CPC
    // Verificar recesso de fim do ano anterior (20/12/anterior - 20/01/atual)
    if (mes === 0 && dia <= 20) {
      return { emRecesso: true, motivo: `Recesso forense (20/12/${ano - 1} a 20/01/${ano}) - art. 220, CPC` };
    }
    // Verificar recesso de fim do ano atual (20/12/atual - 31/12/atual)
    if (mes === 11 && dia >= 20) {
      return { emRecesso: true, motivo: `Recesso forense (20/12/${ano} a 20/01/${ano + 1}) - art. 220, CPC` };
    }

    return { emRecesso: false };
  },

  _recessosTribunal(tribunalId, dataStr) {
    const tribunal = this._tribunais[tribunalId];
    if (!tribunal || !tribunal.recessos) return null;

    for (const recesso of tribunal.recessos) {
      if (dataStr >= recesso.inicio && dataStr <= recesso.fim) {
        return { nome: recesso.nome, fundamentacao: recesso.fundamentacao };
      }
    }
    return null;
  },

  _suspensaoCustom(dataStr) {
    for (const susp of this._suspensoesCustom) {
      if (susp.ativo !== false && dataStr >= susp.inicio && dataStr <= susp.fim) {
        return { nome: susp.descricao, fundamentacao: susp.fundamentacao };
      }
    }
    return null;
  },

  /**
   * Verifica se uma data é dia útil processual.
   * Retorna { util: boolean, motivo: string }
   */
  verificarDia(dataStr, tribunalId = 'tjes', municipioId = 'vitoria-es') {
    const data = new Date(dataStr + 'T12:00:00');
    const diaSemana = data.getDay();
    const ano = data.getFullYear();

    // 1. Fim de semana
    if (diaSemana === 0) return { util: false, motivo: 'Domingo' };
    if (diaSemana === 6) return { util: false, motivo: 'Sábado' };

    // 2. Recesso CPC (20/12-20/01) - prevalece sobre recesso estadual
    const recesso = this._recessosCPC(dataStr);
    if (recesso.emRecesso) return { util: false, motivo: recesso.motivo };

    // 3. Recesso do tribunal (fora do CPC)
    const recessoTrib = this._recessosTribunal(tribunalId, dataStr);
    if (recessoTrib) return { util: false, motivo: `${recessoTrib.nome} - ${recessoTrib.fundamentacao}` };

    // 4. Suspensão customizada
    const suspensao = this._suspensaoCustom(dataStr);
    if (suspensao) return { util: false, motivo: `Suspensão: ${suspensao.nome} - ${suspensao.fundamentacao}` };

    // 5. Feriados (buscar em todas as fontes)
    const todosFeriados = [
      ...this._feriadosNacionaisFixos(ano),
      ...this._feriadosMoveis(ano),
      ...this._feriadosEstaduais(tribunalId, ano),
      ...this._feriadosMunicipais(municipioId, ano),
    ];

    const feriado = todosFeriados.find(f => f.data === dataStr);
    if (feriado) {
      return { util: false, motivo: `${feriado.nome} (${feriado.tipo}) - ${feriado.fundamentacao}` };
    }

    return { util: true, motivo: 'Dia útil' };
  },

  /**
   * Retorna o próximo dia útil a partir de uma data (inclusive).
   */
  proximoDiaUtil(dataStr, tribunalId = 'tjes', municipioId = 'vitoria-es') {
    let data = new Date(dataStr + 'T12:00:00');
    let str = dataStr;
    for (let i = 0; i < 365; i++) {
      const resultado = this.verificarDia(str, tribunalId, municipioId);
      if (resultado.util) return str;
      data.setDate(data.getDate() + 1);
      str = formatarData(data);
    }
    return str;
  },

  /**
   * Retorna todos os feriados carregados para um ano/tribunal/município.
   */
  listarFeriados(ano, tribunalId = 'tjes', municipioId = 'vitoria-es') {
    return [
      ...this._feriadosNacionaisFixos(ano),
      ...this._feriadosMoveis(ano),
      ...this._feriadosEstaduais(tribunalId, ano),
      ...this._feriadosMunicipais(municipioId, ano),
    ].sort((a, b) => a.data.localeCompare(b.data));
  },

  getTribunais() {
    return Object.entries(this._tribunais).map(([id, t]) => ({ id, nome: t.nome }));
  },

  getMunicipios() {
    return Object.entries(this._municipios).map(([id, m]) => ({ id, nome: m.nome }));
  },
};
