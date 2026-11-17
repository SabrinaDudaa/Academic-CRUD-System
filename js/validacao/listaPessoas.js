document.addEventListener('DOMContentLoaded', () => {
  const { api, esc, formatarCpf, normalizar, confirmar, aviso, vazio, carregando } = App;

  const lista = document.getElementById('listaPessoas');
  const campoBusca = document.getElementById('busca');
  const filtroCargo = document.getElementById('filtroCargo');
  const resumo = document.getElementById('resumoLista');

  let pessoas = [];

  async function carregar() {
    lista.innerHTML = carregando('Carregando pessoas…');
    try {
      pessoas = await api('/api/pessoas');
      desenhar();
    } catch (erro) {
      lista.innerHTML = vazio('error_outline', 'Não foi possível carregar a lista', erro.message);
    }
  }

  function filtradas() {
    const termo = normalizar(campoBusca.value.trim());
    const cargo = filtroCargo.value;

    return pessoas.filter((p) => {
      if (cargo === 'nenhum' && p.tipos.length) return false;
      if (cargo && cargo !== 'nenhum' && !p.tipos.includes(cargo)) return false;
      if (!termo) return true;
      return normalizar([p.nomepessoa, p.cpf, p.email, p.cidade].join(' ')).includes(termo);
    });
  }

  function desenhar() {
    const itens = filtradas();
    resumo.textContent = `${pessoas.length} ${pessoas.length === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'}`
      + (itens.length !== pessoas.length ? ` · ${itens.length} no filtro` : '');

    if (!pessoas.length) {
      lista.innerHTML = vazio('people', 'Nenhuma pessoa cadastrada', 'Clique em "Nova pessoa" para começar.');
      return;
    }
    if (!itens.length) {
      lista.innerHTML = vazio('search_off', 'Nada encontrado', 'Tente outro termo ou limpe o filtro.');
      return;
    }

    lista.innerHTML = `
      <table class="table-stack">
        <thead>
          <tr><th>Nome</th><th>CPF</th><th>Idade</th><th>Contato</th><th>Cidade</th><th>Cargos</th><th></th></tr>
        </thead>
        <tbody>
          ${itens
            .map(
              (p) => `
            <tr>
              <td data-label="Nome"><strong>${esc(p.nomepessoa)}</strong></td>
              <td data-label="CPF">${esc(formatarCpf(p.cpf))}</td>
              <td data-label="Idade">${esc(p.idade)}</td>
              <td data-label="Contato">${esc(p.telefone1)}<span class="sub">${esc(p.email || '—')}</span></td>
              <td data-label="Cidade">${esc(p.cidade)}/${esc(p.uf)}<span class="sub">${esc(p.bairro)}</span></td>
              <td data-label="Cargos">${
                p.tipos.length
                  ? p.cargos.split(', ').map((c) => `<span class="badge">${esc(c)}</span>`).join('')
                  : '<span class="badge gray">Sem cargo</span>'
              }</td>
              <td class="col-actions">
                <a class="icon-btn" href="CadPessoa.html?id=${p.idpessoa}" title="Editar ${esc(p.nomepessoa)}" aria-label="Editar ${esc(p.nomepessoa)}">
                  <span class="material-icons" aria-hidden="true">edit</span>
                </a>
                <button class="icon-btn danger" data-excluir="${p.idpessoa}" title="Excluir ${esc(p.nomepessoa)}" aria-label="Excluir ${esc(p.nomepessoa)}">
                  <span class="material-icons" aria-hidden="true">delete</span>
                </button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  lista.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-excluir]');
    if (!botao) return;

    const pessoa = pessoas.find((p) => String(p.idpessoa) === botao.dataset.excluir);
    const ok = await confirmar({
      titulo: 'Excluir pessoa?',
      mensagem: `${pessoa.nomepessoa} será removida do sistema. Essa ação não pode ser desfeita.`,
      confirmarTexto: 'Excluir',
      perigo: true,
    });
    if (!ok) return;

    try {
      await api(`/api/pessoas/${pessoa.idpessoa}`, { method: 'DELETE' });
      aviso('Pessoa excluída com sucesso!');
      await carregar();
    } catch (erro) {
      aviso(erro.message, 'error');
    }
  });

  campoBusca.addEventListener('input', desenhar);
  filtroCargo.addEventListener('change', desenhar);

  carregar();
});
