/**
 * Lógica da interface - DOM, eventos, navegação.
 */

let ultimoResultado = null;

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
  await HolidayManager.init();

  // Data padrão = hoje
  document.getElementById('data-entrada').value = formatarData(new Date());

  initTabs();
  initFormEvents();
  initConfigEvents();
  initHistoricoEvents();
});

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
  // Help text dinâmico
  document.getElementById('tipo-data').addEventListener('change', (e) => {
    const help = document.getElementById('tipo-data-help');
    const textos = {
      disponibilizacao_djen: 'A data sera ajustada conforme as regras do DJEN (2 saltos de dia util)',
      publicacao_djen: 'O prazo inicia no 1o dia util apos a publicacao (1 salto)',
      prazo_direto: 'O prazo inicia no 1o dia util apos o evento (exclusao do dia inicial)',
    };
    help.textContent = textos[e.target.value];
  });

  // Calcular
  document.getElementById('btn-calcular').addEventListener('click', calcular);

  // Salvar
  document.getElementById('btn-salvar').addEventListener('click', () => {
    if (!ultimoResultado) return;
    Storage.salvar(ultimoResultado);
    document.getElementById('btn-salvar').textContent = 'Salvo!';
    setTimeout(() => {
      document.getElementById('btn-salvar').textContent = 'Salvar no historico';
    }, 1500);
  });
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

  if (!params.dataEntrada) {
    alert('Selecione uma data.');
    return;
  }

  if (!params.diasPrazo || params.diasPrazo < 1) {
    alert('Informe um prazo valido.');
    return;
  }

  ultimoResultado = calcularPrazo(params);
  renderResultado(ultimoResultado);
}

function renderResultado(r) {
  const container = document.getElementById('resultado');
  container.classList.add('visible');

  // Data destaque
  const dataFormatada = formatarDataBR(r.dataVencimento);
  document.getElementById('res-data').textContent = dataFormatada;
  document.getElementById('res-dia-semana').textContent = r.diaSemana;
  document.getElementById('res-dias-contados').textContent =
    typeof r.diasContados === 'number'
      ? r.diasContados + ' dias ' + (r.parametros.tipoContagem === 'dias_uteis' ? 'uteis' : 'corridos')
      : r.diasContados;

  // Etapas
  const etapasHTML = r.etapas.map(e =>
    '<div class="etapa"><span class="etapa-nome">' + e.etapa + '</span><span class="etapa-data">' + formatarDataBR(e.data) + ' (' + diaSemanaAbrev(e.data) + ')</span></div>'
  ).join('');
  document.getElementById('res-etapas').innerHTML = '<h3>Marcos do prazo</h3>' + etapasHTML;

  // Parâmetros
  const tipoDataNomes = {
    disponibilizacao_djen: 'Disponibilizacao no DJEN',
    publicacao_djen: 'Publicacao no DJEN',
    prazo_direto: 'Data do evento (prazo direto)',
  };
  const tipoContagemNomes = {
    dias_uteis: 'Dias uteis',
    dias_corridos: 'Dias corridos',
    meses: 'Meses',
  };

  const paramsHTML = [
    ['Tipo de data', tipoDataNomes[r.parametros.tipoData]],
    ['Data informada', formatarDataBR(r.parametros.dataEntrada)],
    ['Prazo', r.parametros.diasPrazo + ' ' + tipoContagemNomes[r.parametros.tipoContagem].toLowerCase()],
    ['Multiplicador', r.parametros.multiplicador + 'x'],
    ['Tribunal', r.parametros.tribunal.toUpperCase()],
    ['Municipio', r.parametros.municipio],
  ].map(([k, v]) =>
    '<div class="param-row"><span class="param-key">' + k + '</span><span class="param-value">' + v + '</span></div>'
  ).join('');
  document.getElementById('res-parametros').innerHTML = '<h3>Parametros do calculo</h3>' + paramsHTML;

  // Calendário
  const calHTML = r.calendario.map(d => {
    const contagem = d.contagem !== null ? (typeof d.contagem === 'number' ? 'Dia ' + d.contagem : d.contagem) : '-';
    const statusLabel = d.status === 'contado' ? contagem : (d.status === 'prorrogado' ? 'Prorrog.' : '-');
    return '<div class="cal-dia">' +
      '<span class="cal-data">' + formatarDataBR(d.data) + ' ' + diaSemanaAbrev(d.data) + '</span>' +
      '<span class="cal-status ' + d.status + '">' + statusLabel + '</span>' +
      '<span class="cal-motivo">' + d.motivo + '</span>' +
      '</div>';
  }).join('');
  document.getElementById('res-calendario').innerHTML = '<h3>Calendario detalhado</h3>' + calHTML;

  // Scroll para resultado
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// === CONFIGURAÇÃO ===
function initConfigEvents() {
  document.getElementById('config-ano').addEventListener('change', renderFeriados);

  document.getElementById('btn-add-suspensao').addEventListener('click', () => {
    const inicio = document.getElementById('susp-inicio').value;
    const fim = document.getElementById('susp-fim').value;
    const descricao = document.getElementById('susp-descricao').value;
    const fundamentacao = document.getElementById('susp-fundamentacao').value;

    if (!inicio || !fim || !descricao) {
      alert('Preencha todos os campos obrigatorios.');
      return;
    }

    HolidayManager.salvarSuspensaoCustom({ inicio, fim, descricao, fundamentacao, ativo: true });
    document.getElementById('susp-inicio').value = '';
    document.getElementById('susp-fim').value = '';
    document.getElementById('susp-descricao').value = '';
    document.getElementById('susp-fundamentacao').value = '';
    renderSuspensoes();
  });

  document.getElementById('btn-exportar').addEventListener('click', () => {
    const ano = parseInt(document.getElementById('config-ano').value);
    const dados = {
      feriados: HolidayManager.listarFeriados(ano),
      suspensoes: HolidayManager.getSuspensoesCustom(),
    };
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
        if (dados.suspensoes) {
          dados.suspensoes.forEach(s => HolidayManager.salvarSuspensaoCustom(s));
        }
        renderFeriados();
        renderSuspensoes();
        alert('Importacao concluida.');
      } catch {
        alert('Arquivo JSON invalido.');
      }
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
    '<span class="feriado-tipo">' + f.tipo + '</span>' +
    '</div>'
  ).join('');

  renderSuspensoes();
}

function renderSuspensoes() {
  const suspensoes = HolidayManager.getSuspensoesCustom();
  const lista = document.getElementById('suspensoes-lista');

  if (suspensoes.length === 0) {
    lista.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">Nenhuma suspensao cadastrada.</p>';
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
    if (confirm('Limpar todo o historico?')) {
      Storage.limpar();
      renderHistorico();
    }
  });
}

function renderHistorico() {
  const filtro = document.getElementById('hist-filtro').value.toLowerCase();
  const historico = Storage.getHistorico().filter(h => {
    if (!filtro) return true;
    const texto = (h.parametros.descricao + ' ' + h.dataVencimento + ' ' + h.parametros.dataEntrada).toLowerCase();
    return texto.includes(filtro);
  });

  const lista = document.getElementById('historico-lista');

  if (historico.length === 0) {
    lista.innerHTML = '<div class="historico-vazio">Nenhum calculo salvo.</div>';
    return;
  }

  lista.innerHTML = historico.map(h =>
    '<div class="historico-item" onclick="carregarHistorico(' + h.id + ')">' +
    '<div class="historico-info">' +
    '<div class="data">Vencimento: ' + formatarDataBR(h.dataVencimento) + ' (' + h.diaSemana + ')</div>' +
    '<div class="desc">' + (h.parametros.descricao || 'Sem descricao') + '</div>' +
    '<div class="timestamp">Calculado em: ' + new Date(h.timestamp).toLocaleString('pt-BR') + '</div>' +
    '</div>' +
    '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); removerHistorico(' + h.id + ')">Remover</button>' +
    '</div>'
  ).join('');
}

function carregarHistorico(id) {
  const historico = Storage.getHistorico();
  const item = historico.find(h => h.id === id);
  if (!item) return;

  // Preencher form
  document.getElementById('tipo-data').value = item.parametros.tipoData;
  document.getElementById('data-entrada').value = item.parametros.dataEntrada;
  document.getElementById('dias-prazo').value = item.parametros.diasPrazo;
  document.getElementById('tipo-contagem').value = item.parametros.tipoContagem;
  document.getElementById('multiplicador').value = item.parametros.multiplicador;
  document.getElementById('descricao').value = item.parametros.descricao || '';

  // Ir para aba de cálculo e recalcular
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
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][d.getDay()];
}
