document.addEventListener('DOMContentLoaded', () => {
  const { api, esc, formatarData, normalizar, confirmar, aviso, vazio, carregando } = App;

  const campoBusca = document.getElementById('busca');
  const filtroEspecie = document.getElementById('filtroEspecie');

  let disponiveis = [];
  let adotados = [];

  async function carregar() {
    document.getElementById('listaPetsDisponiveis').innerHTML = carregando('Carregando animais…');
    document.getElementById('listaPetsAdotados').innerHTML = '';
    try {
      [disponiveis, adotados] = await Promise.all([
        api('/api/pets-disponiveis'),
        api('/api/pets-adotados-ativos'),
      ]);
      montarFiltroEspecie();
      desenhar();
    } catch (erro) {
      document.getElementById('listaPetsDisponiveis').innerHTML =
        vazio('error_outline', 'Não foi possível carregar os animais', erro.message);
    }
  }

  // Preenche o filtro com as espécies que existem, mantendo a escolha atual.
  function montarFiltroEspecie() {
    const atual = filtroEspecie.value;
    const especies = [...new Set([...disponiveis, ...adotados].map((p) => p.especie))].sort();
    filtroEspecie.innerHTML =
      '<option value="">Todas as espécies</option>' +
      especies.map((e) => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
    filtroEspecie.value = especies.includes(atual) ? atual : '';
  }

  function filtrar(pets) {
    const termo = normalizar(campoBusca.value.trim());
    const especie = filtroEspecie.value;
    return pets.filter(
      (p) =>
        (!especie || p.especie === especie) &&
        (!termo || normalizar(`${p.nomepet} ${p.raca}`).includes(termo))
    );
  }

  function cartao(pet, adotado) {
    const anos = pet.idade === 1 ? '1 ano' : `${pet.idade} anos`;
    return `
      <article class="pet-card">
        <div class="pet-top">
          <span class="avatar ${adotado ? 'adopted' : ''}"><span class="material-icons" aria-hidden="true">pets</span></span>
          <div>
            <div class="pet-name">${esc(pet.nomepet)}</div>
            <div class="pet-species">${esc(pet.especie)}</div>
          </div>
        </div>
        <dl class="pet-facts">
          <div><dt>Raça</dt><dd>${esc(pet.raca)}</dd></div>
          <div><dt>Idade</dt><dd>${esc(anos)}</dd></div>
          <div><dt>Chegada</dt><dd>${formatarData(pet.chegada)}</dd></div>
          ${adotado ? `<div><dt>Adotado em</dt><dd>${formatarData(pet.dataadocao)}</dd></div>` : ''}
        </dl>
        <div class="pet-foot">
          ${adotado ? `<span class="pet-owner">Adotado por ${esc(pet.adotante)}</span>` : '<span class="badge green">Disponível</span>'}
          <span class="pet-actions">
            <a class="icon-btn" href="CadPet.html?id=${pet.idpet}" title="Editar ${esc(pet.nomepet)}" aria-label="Editar ${esc(pet.nomepet)}">
              <span class="material-icons" aria-hidden="true">edit</span>
            </a>
            <button class="icon-btn danger" data-excluir="${pet.idpet}" title="Excluir ${esc(pet.nomepet)}" aria-label="Excluir ${esc(pet.nomepet)}">
              <span class="material-icons" aria-hidden="true">delete</span>
            </button>
          </span>
        </div>
      </article>`;
  }

  function preencher(containerId, pets, adotado, vazioMsg) {
    const container = document.getElementById(containerId);
    container.innerHTML = pets.length
      ? pets.map((p) => cartao(p, adotado)).join('')
      : `<div style="grid-column: 1 / -1">${vazioMsg}</div>`;
  }

  function desenhar() {
    const d = filtrar(disponiveis);
    const a = filtrar(adotados);
    const filtrando = campoBusca.value.trim() || filtroEspecie.value;

    document.getElementById('contaDisponiveis').textContent = d.length;
    document.getElementById('contaAdotados').textContent = a.length;

    preencher(
      'listaPetsDisponiveis', d, false,
      filtrando
        ? vazio('search_off', 'Nada encontrado', 'Tente outro termo ou limpe o filtro.')
        : vazio('pets', 'Nenhum animal disponível', 'Clique em "Novo animal" para cadastrar.')
    );
    preencher(
      'listaPetsAdotados', a, true,
      vazio('favorite_border', 'Nenhum animal adotado', 'As adoções ativas aparecem aqui.')
    );
  }

  document.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-excluir]');
    if (!botao) return;

    const pet = [...disponiveis, ...adotados].find((p) => String(p.idpet) === botao.dataset.excluir);
    const ok = await confirmar({
      titulo: 'Excluir animal?',
      mensagem: `${pet.nomepet} será removido do sistema. Essa ação não pode ser desfeita.`,
      confirmarTexto: 'Excluir',
      perigo: true,
    });
    if (!ok) return;

    try {
      await api(`/api/pet/${pet.idpet}`, { method: 'DELETE' });
      aviso('Animal excluído com sucesso!');
      await carregar();
    } catch (erro) {
      aviso(erro.message, 'error');
    }
  });

  campoBusca.addEventListener('input', desenhar);
  filtroEspecie.addEventListener('change', desenhar);

  carregar();
});
