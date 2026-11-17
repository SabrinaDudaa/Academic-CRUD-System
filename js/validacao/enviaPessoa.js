document.addEventListener('DOMContentLoaded', async () => {
  const { api, aviso, aplicarMascara, digitos } = App;

  const form = document.getElementById('formPessoa');
  const botaoSalvar = document.getElementById('salvar');

  // Com ?id=123 a página vira "Editar pessoa".
  const id = new URLSearchParams(window.location.search).get('id');
  const editando = Boolean(id);

  aplicarMascara(form.cpf, 'cpf');
  aplicarMascara(form.cep, 'cep');
  aplicarMascara(form.telefone1, 'telefone');
  aplicarMascara(form.telefone2, 'telefone');
  aplicarMascara(form.uf, 'uf');

  /* ---------- Erros por campo ---------- */
  function mostrarErro(campo, mensagem) {
    const span = form.querySelector(`[data-erro="${campo}"]`);
    const input = form.elements[campo];
    if (span) span.textContent = mensagem || '';
    if (input) {
      if (mensagem) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function limparErros() {
    form.querySelectorAll('[data-erro]').forEach((s) => mostrarErro(s.dataset.erro, ''));
  }

  function validar() {
    limparErros();
    const erros = {};
    const v = (n) => form.elements[n].value.trim();

    if (!v('nomePessoa')) erros.nomePessoa = 'Informe o nome.';
    if (digitos(v('cpf')).length !== 11) erros.cpf = 'O CPF deve ter 11 dígitos.';
    const idade = Number(v('idade'));
    if (v('idade') === '' || !Number.isInteger(idade) || idade < 0 || idade > 120) {
      erros.idade = 'Informe uma idade entre 0 e 120.';
    }
    if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) erros.email = 'E-mail inválido.';
    if (!v('telefone1')) erros.telefone1 = 'Informe o telefone.';
    if (!v('rua')) erros.rua = 'Informe o endereço.';
    if (!v('bairro')) erros.bairro = 'Informe o bairro.';
    if (!v('cidade')) erros.cidade = 'Informe a cidade.';
    if (v('uf').length !== 2) erros.uf = 'Use 2 letras.';

    Object.entries(erros).forEach(([campo, msg]) => mostrarErro(campo, msg));
    const primeiro = Object.keys(erros)[0];
    if (primeiro) form.elements[primeiro].focus();
    return !primeiro;
  }

  /* ---------- Edição: carrega os dados atuais ---------- */
  if (editando) {
    document.title = 'Editar pessoa · PetAdoption';
    document.getElementById('titulo').textContent = 'Editar pessoa';
    document.getElementById('subtitulo').textContent = 'Altere os dados e salve.';

    try {
      const p = await api(`/api/pessoas/${encodeURIComponent(id)}`);
      form.nomePessoa.value = p.nomepessoa;
      form.cpf.value = p.cpf;
      form.idade.value = p.idade;
      form.email.value = p.email || '';
      form.telefone1.value = p.telefone1 || '';
      form.telefone2.value = p.telefone2 || '';
      form.cep.value = p.cep || '';
      form.rua.value = p.rua;
      form.bairro.value = p.bairro;
      form.cidade.value = p.cidade;
      form.uf.value = p.uf;
      ['cpf', 'cep', 'telefone1', 'telefone2', 'uf'].forEach((c) => form[c].dispatchEvent(new Event('input')));
      form.querySelectorAll('input[name="tipoPessoa[]"]').forEach((c) => {
        c.checked = p.tipos.includes(c.value);
      });
    } catch (erro) {
      aviso(erro.message, 'error');
      form.querySelectorAll('input, button').forEach((el) => (el.disabled = true));
      return;
    }
  }

  /* ---------- Envio ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validar()) return;

    const dados = {
      nomePessoa: form.nomePessoa.value,
      cpf: form.cpf.value,
      idade: form.idade.value,
      email: form.email.value,
      cep: form.cep.value,
      rua: form.rua.value,
      bairro: form.bairro.value,
      cidade: form.cidade.value,
      uf: form.uf.value,
      telefone1: form.telefone1.value,
      telefone2: form.telefone2.value,
      tiposPessoa: Array.from(form.querySelectorAll('input[name="tipoPessoa[]"]:checked')).map((c) => c.value),
    };

    botaoSalvar.disabled = true;
    try {
      await api(editando ? `/api/pessoas/${encodeURIComponent(id)}` : '/api/pessoas', {
        method: editando ? 'PUT' : 'POST',
        body: dados,
      });
      aviso(editando ? 'Pessoa atualizada com sucesso!' : 'Pessoa cadastrada com sucesso!');
      setTimeout(() => (window.location.href = 'Pessoas.html'), 700);
    } catch (erro) {
      // O servidor avisa CPF repetido com 409: mostramos junto ao campo.
      if (erro.status === 409 && /CPF/i.test(erro.message)) mostrarErro('cpf', erro.message);
      aviso(erro.message, 'error');
      botaoSalvar.disabled = false;
    }
  });
});
