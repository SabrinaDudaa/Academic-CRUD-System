document.addEventListener('DOMContentLoaded', async () => {
  const { api, aviso } = App;

  const form = document.getElementById('formPet');
  const botaoSalvar = document.getElementById('salvar');

  // Com ?id=123 a página vira "Editar animal".
  const id = new URLSearchParams(window.location.search).get('id');
  const editando = Boolean(id);

  function mostrarErro(campo, mensagem) {
    const span = form.querySelector(`[data-erro="${campo}"]`);
    const input = form.elements[campo];
    if (span) span.textContent = mensagem || '';
    if (input) {
      if (mensagem) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function validar() {
    form.querySelectorAll('[data-erro]').forEach((s) => mostrarErro(s.dataset.erro, ''));
    const erros = {};
    const v = (n) => form.elements[n].value.trim();

    if (!v('nomePet')) erros.nomePet = 'Informe o nome.';
    if (!v('especiePet')) erros.especiePet = 'Informe a espécie.';
    if (!v('racaPet')) erros.racaPet = 'Informe a raça.';
    if (!v('dataChegada')) erros.dataChegada = 'Informe a data de chegada.';
    const idade = Number(v('idadePet'));
    if (v('idadePet') === '' || !Number.isInteger(idade) || idade < 0 || idade > 60) {
      erros.idadePet = 'Informe uma idade entre 0 e 60.';
    }

    Object.entries(erros).forEach(([campo, msg]) => mostrarErro(campo, msg));
    const primeiro = Object.keys(erros)[0];
    if (primeiro) form.elements[primeiro].focus();
    return !primeiro;
  }

  /* ---------- Edição: carrega os dados atuais ---------- */
  if (editando) {
    document.title = 'Editar animal · PetAdoption';
    document.getElementById('titulo').textContent = 'Editar animal';
    document.getElementById('subtitulo').textContent = 'Altere os dados e salve.';

    try {
      const pet = await api(`/api/pet/${encodeURIComponent(id)}`);
      form.nomePet.value = pet.nomepet;
      form.idadePet.value = pet.idade;
      form.especiePet.value = pet.especie;
      form.racaPet.value = pet.raca;
      // O campo de data só aceita AAAA-MM-DD; datas antigas em outro formato precisam ser digitadas de novo.
      form.dataChegada.value = /^\d{4}-\d{2}-\d{2}$/.test(pet.chegada) ? pet.chegada : '';
    } catch (erro) {
      aviso(erro.message, 'error');
      form.querySelectorAll('input, button').forEach((el) => (el.disabled = true));
      return;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validar()) return;

    const dados = {
      nomePet: form.nomePet.value,
      Especie: form.especiePet.value,
      Raca: form.racaPet.value,
      Chegada: form.dataChegada.value,
      Idade: form.idadePet.value,
    };

    botaoSalvar.disabled = true;
    try {
      await api(editando ? `/api/pet/${encodeURIComponent(id)}` : '/api/pet', {
        method: editando ? 'PUT' : 'POST',
        body: dados,
      });
      aviso(editando ? 'Animal atualizado com sucesso!' : 'Animal cadastrado com sucesso!');
      setTimeout(() => (window.location.href = 'Pets.html'), 700);
    } catch (erro) {
      aviso(erro.message, 'error');
      botaoSalvar.disabled = false;
    }
  });
});
