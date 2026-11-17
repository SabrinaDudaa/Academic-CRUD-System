document.addEventListener('DOMContentLoaded', async () => {
  const { api, esc, formatarData, vazio } = App;

  const CORES = ['#3b6fd4', '#2bb3a9', '#f2a93b', '#d64545', '#8b6fd4', '#6b7280', '#4cae6b', '#d46fa8'];

  // ---------- Cartões com os totais ----------
  try {
    const resumo = await api('/api/resumo');
    document.querySelectorAll('[data-stat]').forEach((el) => {
      el.textContent = resumo[el.dataset.stat] ?? '–';
    });
  } catch (erro) {
    App.aviso(`Erro ao carregar os totais: ${erro.message}`, 'error');
  }

  function rosca(canvasId, rotulos, valores) {
    // Não mostra fatias zeradas (e deixa a legenda mais limpa).
    const itens = rotulos.map((r, i) => ({ r, v: valores[i] })).filter((i) => i.v > 0);
    const canvas = document.getElementById(canvasId);

    if (!itens.length) {
      canvas.parentElement.innerHTML = vazio('pie_chart', 'Sem dados', 'Cadastre registros para ver o gráfico.');
      return;
    }

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: itens.map((i) => i.r),
        datasets: [{ data: itens.map((i) => i.v), backgroundColor: CORES, borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
      },
    });
  }

  // ---------- Pessoas por cargo ----------
  try {
    const t = await api('/api/tipos-pessoas');
    rosca(
      'graficoPessoas',
      ['Nenhum cargo', 'Voluntário', 'Adotante', 'Doador', 'Voluntário + Adotante', 'Voluntário + Doador', 'Doador + Adotante', 'Voluntário + Adotante + Doador'],
      [t.nenhum, t.voluntario, t.adotante, t.doador, t.voluntario_adotante, t.voluntario_doador, t.doador_adotante, t.voluntario_adotante_doador]
    );
  } catch (erro) {
    App.aviso(`Erro ao carregar o gráfico de pessoas: ${erro.message}`, 'error');
  }

  // ---------- Animais por espécie ----------
  try {
    const pets = await api('/api/pets-por-tipo');
    rosca('graficoPets', pets.map((p) => p.especie), pets.map((p) => Number(p.quantidade)));
  } catch (erro) {
    App.aviso(`Erro ao carregar o gráfico de animais: ${erro.message}`, 'error');
  }

  // ---------- Últimas adoções ----------
  const tabela = document.getElementById('ultimasAdocoes');
  try {
    const adocoes = (await api('/api/adocoes')).slice(0, 5);
    if (!adocoes.length) {
      tabela.innerHTML = vazio('volunteer_activism', 'Nenhuma adoção ainda', 'Os contratos de adoção aparecem aqui.');
      return;
    }
    tabela.innerHTML = `
      <table>
        <thead><tr><th>Animal</th><th>Adotante</th><th>Data</th><th>Situação</th></tr></thead>
        <tbody>
          ${adocoes
            .map(
              (a) => `
            <tr>
              <td><strong>${esc(a.nomepet)}</strong><span class="sub">${esc(a.especie)}</span></td>
              <td>${esc(a.nomeadotante)}</td>
              <td>${formatarData(a.data)}</td>
              <td><span class="badge ${a.situacao === 'Ativo' ? 'green' : 'gray'}">${esc(a.situacao)}</span></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  } catch (erro) {
    tabela.innerHTML = vazio('error_outline', 'Não foi possível carregar', erro.message);
  }
});
