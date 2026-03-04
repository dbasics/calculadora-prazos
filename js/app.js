/**
 * Lógica da interface - DOM, eventos, navegação.
 */

let ultimoResultado = null;

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
  await HolidayManager.init();
  document.getElementById('data-entrada').value = formatarData(new Date());

  initThemeToggle();
  initTabs();
  initFormEvents();
  initConfigEvents();
  initHistoricoEvents();
});

// === THEME TOGGLE ===
function initThemeToggle() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    setTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });

  document.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.themeBtn, true);
    });
  });
}

function setTheme(theme, manual) {
  document.documentElement.setAttribute('data-theme', theme);
  if (manual) localStorage.setItem('theme', theme);
  document.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeBtn === theme);
  });
}

// === TABS ===
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('view-' + tab.dataset.view).classList.add('active');

      if (tab.dataset.view === 'config') renderFeriados();
      if (tab.dataset.view === 'historico') renderHistorico();
    });
  });
}

// === FORM ===
function initFormEvents() {
  document.getElementById('tipo-data').addEventListener('change', (e) => {
    const help = document.getElementById('tipo-data-help');
    const textos = {
      disponibilizacao_djen: 'A data será ajustada conforme as regras do DJEN (2 saltos de dia útil)',
      publicacao_djen: 'O prazo inicia no 1º dia útil após a publicação (1 salto)',
      prazo_direto: 'O prazo inicia no 1º dia útil após o evento (exclusão do dia inicial)',
    };
    help.textContent = textos[e.target.value];
  });

  document.getElementById('btn-calcular').addEventListener('click', calcular);

  document.getElementById('btn-salvar').addEventListener('click', () => {
    if (!ultimoResultado) return;
    Storage.salvar(ultimoResultado);
    const btn = document.getElementById('btn-salvar');
    btn.textContent = 'Salvo!';
    setTimeout(() => { btn.textContent = 'Salvar no histórico'; }, 1500);
  });

  document.getElementById('btn-copiar-fundamentacao').addEventListener('click', () => {
    if (!ultimoResultado) return;
    const texto = gerarFundamentacao(ultimoResultado);
    navigator.clipboard.writeText(texto).then(() => {
      const btn = document.getElementById('btn-copiar-fundamentacao');
      btn.textContent = 'Copiado!';
      setTimeout(() => { btn.textContent = 'Copiar fundamentação'; }, 1500);
    });
  });
}

function gerarFundamentacao(r) {
  const tipoDataNomes = {
    disponibilizacao_djen: 'Disponibilização no DJEN',
    publicacao_djen: 'Publicação no DJEN',
    prazo_direto: 'Data do evento',
  };
  const tipoContagemNomes = {
    dias_uteis: 'dias úteis',
    dias_corridos: 'dias corridos',
    meses: 'meses',
  };

  const p = r.parametros;
  const tipoContagem = tipoContagemNomes[p.tipoContagem];
  const prazoTotal = p.multiplicador > 1
    ? p.diasPrazo + ' ' + tipoContagem + ' x ' + p.multiplicador + ' (prazo em dobro) = ' + r.diasContados + ' ' + tipoContagem
    : r.diasContados + ' ' + tipoContagem;

  // Feriados e suspensões no período
  const naoContados = r.calendario.filter(d => d.status === 'nao_contado');
  const feriados = naoContados.filter(d => !d.motivo.includes('Fim de semana') && !d.motivo.includes('Recesso'));
  const recesso = naoContados.some(d => d.motivo.includes('Recesso'));

  let texto = 'Prazo de ' + prazoTotal + ' (CPC, art. 219). ';
  texto += tipoDataNomes[p.tipoData] + ' em ' + formatarDataBR(p.dataEntrada) + '. ';
  texto += 'Marco inicial (dia 1): ' + formatarDataBR(r.marcoInicial) + ' (' + diaSemanaAbrev(r.marcoInicial) + '). ';
  texto += 'Vencimento: ' + formatarDataBR(r.dataVencimento) + ' (' + r.diaSemana + '). ';

  if (recesso) {
    texto += 'Incidiu recesso forense (art. 220, CPC) no período. ';
  }

  if (feriados.length > 0) {
    const feriadosUnicos = [...new Set(feriados.map(f => f.motivo))];
    texto += 'Feriados no período: ' + feriadosUnicos.join('; ') + '. ';
  }

  if (feriados.length === 0 && !recesso) {
    texto += 'Não houve suspensões ou feriados relevantes no período.';
  }

  return texto.trim();
}

function calcular() {
  const params = {
    tipoData: document.getElementById('tipo-data').value,
    dataEntrada: document.getElementById('data-entrada').value,
    diasPrazo: parseInt(document.getElementById('dias-prazo').value),
    tipoContagem: document.getElementById('tipo-contagem').value,
    tribunal: document.getElementById('tribunal').value,
    municipio: document.getElementById('municipio').value,
    multiplicador: parseInt(document.getElementById('multiplicador').value),
    descricao: document.getElementById('descricao').value,
  };

  if (!params.dataEntrada) { alert('Selecione uma data.'); return; }
  if (!params.diasPrazo || params.diasPrazo < 1) { alert('Informe um prazo válido.'); return; }

  ultimoResultado = calcularPrazo(params);
  renderResultado(ultimoResultado);
}

function renderResultado(r) {
  // Stat cards
  const cards = document.getElementById('stat-cards');
  cards.classList.add('visible');
  document.getElementById('stat-vencimento').textContent = formatarDataBR(r.dataVencimento);
  document.getElementById('stat-dia-semana').textContent = r.diaSemana;
  document.getElementById('stat-marco').textContent = formatarDataBR(r.marcoInicial);
  document.getElementById('stat-marco-sub').textContent = 'Dia 1 da contagem (' + diaSemanaAbrev(r.marcoInicial) + ')';

  const diasLabel = typeof r.diasContados === 'number'
    ? r.diasContados
    : r.diasContados;
  document.getElementById('stat-dias').textContent = diasLabel;
  const tipoLabel = r.parametros.tipoContagem === 'dias_uteis' ? 'dias úteis' : (r.parametros.tipoContagem === 'dias_corridos' ? 'dias corridos' : '');
  document.getElementById('stat-dias-sub').textContent = r.parametros.multiplicador > 1
    ? r.parametros.diasPrazo + ' x ' + r.parametros.multiplicador + ' = ' + diasLabel + ' ' + tipoLabel
    : tipoLabel;

  // Resultado container
  const container = document.getElementById('resultado');
  container.classList.add('visible');

  // Etapas
  const etapasHTML = r.etapas.map(e =>
    '<div class="etapa"><span class="etapa-nome">' + e.etapa + '</span><span class="etapa-data">' + formatarDataBR(e.data) + ' (' + diaSemanaAbrev(e.data) + ')</span></div>'
  ).join('');
  document.getElementById('res-etapas').innerHTML = '<h3>Marcos do prazo</h3>' + etapasHTML;

  // Parâmetros
  const tipoDataNomes = {
    disponibilizacao_djen: 'Disponibilização no DJEN',
    publicacao_djen: 'Publicação no DJEN',
    prazo_direto: 'Data do evento (prazo direto)',
  };
  const tipoContagemNomes = { dias_uteis: 'Dias úteis', dias_corridos: 'Dias corridos', meses: 'Meses' };

  const paramsHTML = [
    ['Tipo de data', tipoDataNomes[r.parametros.tipoData]],
    ['Data informada', formatarDataBR(r.parametros.dataEntrada)],
    ['Prazo', r.parametros.diasPrazo + ' ' + tipoContagemNomes[r.parametros.tipoContagem].toLowerCase()],
    ['Multiplicador', r.parametros.multiplicador + 'x'],
    ['Tribunal', r.parametros.tribunal.toUpperCase()],
    ['Município', r.parametros.municipio],
  ].map(([k, v]) =>
    '<div class="param-row"><span class="param-key">' + k + '</span><span class="param-value">' + v + '</span></div>'
  ).join('');
  document.getElementById('res-parametros').innerHTML = '<h3>Parâmetros utilizados</h3>' + paramsHTML;

  // Calendário como table
  const rows = r.calendario.map(d => {
    const contagem = d.contagem !== null ? (typeof d.contagem === 'number' ? 'Dia ' + d.contagem : d.contagem) : '-';
    const statusLabel = d.status === 'contado' ? contagem : (d.status === 'prorrogado' ? 'Prorrog.' : '-');
    const badgeClass = 'badge badge-' + d.status;
    return '<tr>' +
      '<td class="col-data">' + formatarDataBR(d.data) + '</td>' +
      '<td class="col-dia">' + diaSemanaAbrev(d.data) + '</td>' +
      '<td class="col-status"><span class="' + badgeClass + '">' + statusLabel + '</span></td>' +
      '<td class="col-motivo">' + d.motivo + '</td>' +
      '</tr>';
  }).join('');

  document.getElementById('res-calendario').innerHTML =
    '<h3>Calendário detalhado</h3>' +
    '<table class="calendario-table">' +
    '<thead><tr><th>Data</th><th>Dia</th><th>Status</th><th>Motivo</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>';

  // Scroll
  cards.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// === CONFIGURAÇÃO ===
function initConfigEvents() {
  document.getElementById('config-ano').addEventListener('change', renderFeriados);

  document.getElementById('btn-add-suspensao').addEventListener('click', () => {
    const inicio = document.getElementById('susp-inicio').value;
    const fim = document.getElementById('susp-fim').value;
    const descricao = document.getElementById('susp-descricao').value;
    const fundamentacao = document.getElementById('susp-fundamentacao').value;

    if (!inicio || !fim || !descricao) { alert('Preencha todos os campos obrigatórios.'); return; }

    HolidayManager.salvarSuspensaoCustom({ inicio, fim, descricao, fundamentacao, ativo: true });
    document.getElementById('susp-inicio').value = '';
    document.getElementById('susp-fim').value = '';
    document.getElementById('susp-descricao').value = '';
    document.getElementById('susp-fundamentacao').value = '';
    renderSuspensoes();
  });

  document.getElementById('btn-exportar').addEventListener('click', () => {
    const ano = parseInt(document.getElementById('config-ano').value);
    const dados = { feriados: HolidayManager.listarFeriados(ano), suspensoes: HolidayManager.getSuspensoesCustom() };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feriados-' + ano + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-importar').addEventListener('click', () => {
    document.getElementById('importar-file').click();
  });

  document.getElementById('importar-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        if (dados.suspensoes) dados.suspensoes.forEach(s => HolidayManager.salvarSuspensaoCustom(s));
        renderFeriados();
        renderSuspensoes();
        alert('Importação concluída.');
      } catch { alert('Arquivo JSON inválido.'); }
    };
    reader.readAsText(file);
  });
}

function renderFeriados() {
  const ano = parseInt(document.getElementById('config-ano').value) || 2026;
  const feriados = HolidayManager.listarFeriados(ano);
  const lista = document.getElementById('feriado-lista');

  if (feriados.length === 0) {
    lista.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">Nenhum feriado carregado para ' + ano + '.</p>';
    return;
  }

  lista.innerHTML = feriados.map(f =>
    '<div class="feriado-item">' +
    '<span class="feriado-data">' + formatarDataBR(f.data) + '</span>' +
    '<span>' + f.nome + '</span>' +
    '<span class="feriado-tipo badge badge-' + badgeTipo(f.tipo) + '">' + f.tipo + '</span>' +
    '</div>'
  ).join('');

  renderSuspensoes();
}

function badgeTipo(tipo) {
  const map = { nacional: 'contado', movel: 'prorrogado', estadual: 'contado', municipal: 'nao_contado' };
  return map[tipo] || 'nao_contado';
}

function renderSuspensoes() {
  const suspensoes = HolidayManager.getSuspensoesCustom();
  const lista = document.getElementById('suspensoes-lista');

  if (suspensoes.length === 0) {
    lista.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">Nenhuma suspensão cadastrada.</p>';
    return;
  }

  lista.innerHTML = suspensoes.map((s, i) =>
    '<div class="feriado-item">' +
    '<span class="feriado-data">' + formatarDataBR(s.inicio) + ' a ' + formatarDataBR(s.fim) + '</span>' +
    '<span>' + s.descricao + '</span>' +
    '<button class="btn btn-danger btn-sm" onclick="removerSuspensao(' + i + ')">Remover</button>' +
    '</div>'
  ).join('');
}

function removerSuspensao(index) {
  HolidayManager.removerSuspensaoCustom(index);
  renderSuspensoes();
}

// === HISTÓRICO ===
function initHistoricoEvents() {
  document.getElementById('hist-filtro').addEventListener('input', renderHistorico);
  document.getElementById('btn-limpar-historico').addEventListener('click', () => {
    if (confirm('Limpar todo o histórico?')) {
      Storage.limpar();
      renderHistorico();
    }
  });
}

function renderHistorico() {
  const filtro = document.getElementById('hist-filtro').value.toLowerCase();
  const historico = Storage.getHistorico().filter(h => {
    if (!filtro) return true;
    return (h.parametros.descricao + ' ' + h.dataVencimento + ' ' + h.parametros.dataEntrada).toLowerCase().includes(filtro);
  });

  const lista = document.getElementById('historico-lista');

  if (historico.length === 0) {
    lista.innerHTML = '<div class="historico-vazio">Nenhum cálculo salvo.</div>';
    return;
  }

  lista.innerHTML = historico.map(h =>
    '<div class="historico-item" onclick="carregarHistorico(' + h.id + ')">' +
    '<div class="historico-info">' +
    '<div class="data">' + formatarDataBR(h.dataVencimento) + ' &middot; ' + h.diaSemana + '</div>' +
    '<div class="desc">' + (h.parametros.descricao || 'Sem descrição') + '</div>' +
    '<div class="timestamp">' + new Date(h.timestamp).toLocaleString('pt-BR') + '</div>' +
    '</div>' +
    '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); removerHistorico(' + h.id + ')">Remover</button>' +
    '</div>'
  ).join('');
}

function carregarHistorico(id) {
  const item = Storage.getHistorico().find(h => h.id === id);
  if (!item) return;

  document.getElementById('tipo-data').value = item.parametros.tipoData;
  document.getElementById('data-entrada').value = item.parametros.dataEntrada;
  document.getElementById('dias-prazo').value = item.parametros.diasPrazo;
  document.getElementById('tipo-contagem').value = item.parametros.tipoContagem;
  document.getElementById('multiplicador').value = item.parametros.multiplicador;
  document.getElementById('descricao').value = item.parametros.descricao || '';

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector('[data-view="calculo"]').classList.add('active');
  document.getElementById('view-calculo').classList.add('active');
  calcular();
}

function removerHistorico(id) {
  Storage.remover(id);
  renderHistorico();
}

// === HELPERS ===
function formatarDataBR(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return dia + '/' + mes + '/' + ano;
}

function diaSemanaAbrev(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()];
}
