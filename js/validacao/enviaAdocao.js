document.addEventListener('DOMContentLoaded', () => {
  const { api, esc, formatarCpf, formatarData, normalizar, confirmar, formulario, aviso, vazio } = App;

  const form = document.getElementById('formAdocao');
  const resumo = document.getElementById('resumoSelecao');
  const botaoRegistrar = document.getElementById('registrar');

  let adotantes = [];
  let pets = [];
  let contratos = [];
  let selecionadoAdotante = null;
  let selecionadoPet = null;

  const hoje = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  form.dataAdocao.value = hoje();

  /* ---------- Carregamento ---------- */
  async function carregarTudo() {
    try {
      [adotantes, pets, contratos] = await Promise.all([
        api('/api/adotantes'),
        api('/api/pets-disponiveis'),
        api('/api/adocoes'),
      ]);
    } catch (erro) {
      aviso(erro.message, 'error');
      return;
    }

    // Se o item selecionado sumiu (ex.: pet acabou de ser adotado), limpa a escolha.
    if (!adotantes.some((a) => String(a.idpessoa) === selecionadoAdotante)) selecionadoAdotante = null;
    if (!pets.some((p) => String(p.idpet) === selecionadoPet)) selecionadoPet = null;

    desenharAdotantes();
    desenharPets();
    desenharContratos();
    atualizarResumo();
  }

  /* ---------- Tabelas de seleção ---------- */
  function desenharAdotantes() {
    const tbody = document.querySelector('#tableAdotantes tbody');
    tbody.innerHTML = adotantes.length
      ? adotantes
          .map(
            (a) => `
        <tr data-id="${a.idpessoa}" class="${String(a.idpessoa) === selecionadoAdotante ? 'selected' : ''}"
            tabindex="0" aria-selected="${String(a.idpessoa) === selecionadoAdotante}">
          <td>${esc(a.nomepessoa)}</td><td>${esc(formatarCpf(a.cpf))}</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="2" class="loading">Nenhum adotante cadastrado.</td></tr>';
    filtrar('tableAdotantes', document.getElementById('searchAdotante').value);
  }

  function desenharPets() {
    const tbody = document.querySelector('#tablePets tbody');
    tbody.innerHTML = pets.length
      ? pets
          .map(
            (p) => `
        <tr data-id="${p.idpet}" class="${String(p.idpet) === selecionadoPet ? 'selected' : ''}"
            tabindex="0" aria-selected="${String(p.idpet) === selecionadoPet}">
          <td>${esc(p.nomepet)}</td><td>${esc(p.especie)}</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="2" class="loading">Nenhum animal disponível.</td></tr>';
    filtrar('tablePets', document.getElementById('searchPet').value);
  }

  function filtrar(idTabela, texto) {
    const termo = normalizar(texto);
    document.querySelectorAll(`#${idTabela} tbody tr[data-id]`).forEach((tr) => {
      tr.hidden = !normalizar(tr.cells[0].textContent).includes(termo);
    });
  }

  function selecionar(tipo, id) {
    if (tipo === 'adotante') selecionadoAdotante = id;
    else selecionadoPet = id;
    desenharAdotantes();
    desenharPets();
    atualizarResumo();
  }

  function atualizarResumo() {
    const a = adotantes.find((x) => String(x.idpessoa) === selecionadoAdotante);
    const p = pets.find((x) => String(x.idpet) === selecionadoPet);

    if (a && p) {
      resumo.innerHTML = `<strong>${esc(p.nomepet)}</strong> será adotado(a) por <strong>${esc(a.nomepessoa)}</strong>.`;
    } else if (a) {
      resumo.innerHTML = `Adotante: <strong>${esc(a.nomepessoa)}</strong>. Agora escolha o animal.`;
    } else if (p) {
      resumo.innerHTML = `Animal: <strong>${esc(p.nomepet)}</strong>. Agora escolha o adotante.`;
    } else {
      resumo.textContent = 'Selecione um adotante e um animal.';
    }
  }

  for (const [idTabela, tipo] of [['tableAdotantes', 'adotante'], ['tablePets', 'pet']]) {
    const tabela = document.getElementById(idTabela);
    tabela.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) selecionar(tipo, tr.dataset.id);
    });
    tabela.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        selecionar(tipo, tr.dataset.id);
      }
    });
  }

  document.getElementById('searchAdotante').addEventListener('input', (e) => filtrar('tableAdotantes', e.target.value));
  document.getElementById('searchPet').addEventListener('input', (e) => filtrar('tablePets', e.target.value));

  /* ---------- Registrar nova adoção ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selecionadoAdotante) return aviso('Selecione um adotante.', 'error');
    if (!selecionadoPet) return aviso('Selecione um animal.', 'error');
    if (!form.dataAdocao.value) return aviso('Informe a data da adoção.', 'error');

    botaoRegistrar.disabled = true;
    try {
      await api('/api/adocao', {
        method: 'POST',
        body: { idAdotante: selecionadoAdotante, idPet: selecionadoPet, dataAdocao: form.dataAdocao.value },
      });
      aviso('Adoção registrada com sucesso!');
      selecionadoAdotante = null;
      selecionadoPet = null;
      form.dataAdocao.value = hoje();
      await carregarTudo();
    } catch (erro) {
      aviso(erro.message, 'error');
    } finally {
      botaoRegistrar.disabled = false;
    }
  });

  /* ---------- Lista de contratos (editar e excluir) ---------- */
  function desenharContratos() {
    document.getElementById('contaContratos').textContent = contratos.length;
    const lista = document.getElementById('listaContratos');

    if (!contratos.length) {
      lista.innerHTML = vazio('volunteer_activism', 'Nenhum contrato ainda', 'Registre uma adoção acima.');
      return;
    }

    lista.innerHTML = `
      <table class="table-stack">
        <thead><tr><th>Animal</th><th>Adotante</th><th>Data</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          ${contratos
            .map(
              (c) => `
            <tr>
              <td data-label="Animal"><strong>${esc(c.nomepet)}</strong><span class="sub">${esc(c.especie)}</span></td>
              <td data-label="Adotante">${esc(c.nomeadotante)}</td>
              <td data-label="Data">${formatarData(c.data)}</td>
              <td data-label="Situação"><span class="badge ${c.situacao === 'Ativo' ? 'green' : 'gray'}">${esc(c.situacao)}</span></td>
              <td class="col-actions">
                <button class="icon-btn" data-editar="${c.idcontrato}" title="Editar contrato de ${esc(c.nomepet)}" aria-label="Editar contrato de ${esc(c.nomepet)}">
                  <span class="material-icons" aria-hidden="true">edit</span>
                </button>
                <button class="icon-btn danger" data-excluir="${c.idcontrato}" title="Excluir contrato de ${esc(c.nomepet)}" aria-label="Excluir contrato de ${esc(c.nomepet)}">
                  <span class="material-icons" aria-hidden="true">delete</span>
                </button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  document.getElementById('listaContratos').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar]');
    const excluir = e.target.closest('[data-excluir]');

    if (editar) {
      const c = contratos.find((x) => String(x.idcontrato) === editar.dataset.editar);
      formulario({
        titulo: `Contrato de ${c.nomepet}`,
        camposHtml: `
          <div class="field">
            <label for="dlgSituacao">Situação</label>
            <select id="dlgSituacao" name="situacao">
              <option value="Ativo" ${c.situacao === 'Ativo' ? 'selected' : ''}>Ativo</option>
              <option value="Inativo" ${c.situacao === 'Inativo' ? 'selected' : ''}>Inativo (adoção encerrada)</option>
            </select>
          </div>
          <div class="field">
            <label for="dlgData">Data da adoção</label>
            <input type="date" id="dlgData" name="dataAdocao" value="${esc(c.data)}" required>
          </div>`,
        onSubmit: async (f) => {
          await api(`/api/adocao/${c.idcontrato}`, {
            method: 'PUT',
            body: { situacao: f.situacao.value, dataAdocao: f.dataAdocao.value },
          });
          aviso('Contrato atualizado com sucesso!');
          await carregarTudo();
        },
      });
    }

    if (excluir) {
      const c = contratos.find((x) => String(x.idcontrato) === excluir.dataset.excluir);
      const ok = await confirmar({
        titulo: 'Excluir contrato?',
        mensagem: `O contrato de adoção de ${c.nomepet} (${c.nomeadotante}) será removido. Essa ação não pode ser desfeita.`,
        confirmarTexto: 'Excluir',
        perigo: true,
      });
      if (!ok) return;
      try {
        await api(`/api/adocao/${c.idcontrato}`, { method: 'DELETE' });
        aviso('Contrato excluído com sucesso!');
        await carregarTudo();
      } catch (erro) {
        aviso(erro.message, 'error');
      }
    }
  });

  carregarTudo();
});
