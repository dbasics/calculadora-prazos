/**
 * Gerencia histórico de cálculos no localStorage.
 */
const Storage = {
  KEY: 'calculadora_prazos_historico',

  getHistorico() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch {
      return [];
    }
  },

  salvar(resultado) {
    const historico = this.getHistorico();
    historico.unshift({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...resultado,
    });
    // Manter no máximo 200 registros
    if (historico.length > 200) historico.length = 200;
    localStorage.setItem(this.KEY, JSON.stringify(historico));
  },

  remover(id) {
    const historico = this.getHistorico().filter(h => h.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(historico));
  },

  limpar() {
    localStorage.removeItem(this.KEY);
  },
};
