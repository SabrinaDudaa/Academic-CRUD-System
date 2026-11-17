/* ==========================================================================
   PetAdoption — utilitários compartilhados (menu, API, avisos, janelas, máscaras)
   Carregado por todas as páginas, antes do script específico de cada uma.
   ========================================================================== */

const App = (() => {
  /* ---------- Menu ---------- */
  const LINKS = [
    { href: 'index.html', icon: 'dashboard', label: 'Painel', alias: [''] },
    { href: 'Pessoas.html', icon: 'people', label: 'Pessoas', alias: ['CadPessoa.html'] },
    { href: 'Pets.html', icon: 'pets', label: 'Animais', alias: ['CadPet.html'] },
    { href: 'Adocao.html', icon: 'volunteer_activism', label: 'Adoção', alias: [] },
    { href: 'Doacoes.html', icon: 'redeem', label: 'Doações', alias: [] },
  ];

  function montarMenu() {
    const atual = window.location.pathname.split('/').pop();
    const ativo = (l) => l.href === atual || l.alias.includes(atual);

    const nav = document.createElement('header');
    nav.className = 'nav';
    nav.innerHTML = `
      <div class="nav-inner">
        <a class="brand" href="index.html">
          <span class="brand-icon"><span class="material-icons" aria-hidden="true">pets</span></span>
          PetAdoption
        </a>
        <button class="nav-toggle" type="button" aria-label="Abrir menu" aria-expanded="false">
          <span class="material-icons" aria-hidden="true">menu</span>
        </button>
        <ul class="nav-links">
          ${LINKS.map(
            (l) => `
            <li>
              <a href="${l.href}" class="${ativo(l) ? 'active' : ''}" ${ativo(l) ? 'aria-current="page"' : ''}>
                <span class="material-icons" aria-hidden="true">${l.icon}</span>${l.label}
              </a>
            </li>`
          ).join('')}
        </ul>
      </div>`;

    const botao = nav.querySelector('.nav-toggle');
    const lista = nav.querySelector('.nav-links');
    botao.addEventListener('click', () => {
      const aberto = lista.classList.toggle('open');
      botao.setAttribute('aria-expanded', String(aberto));
    });

    document.body.prepend(nav);
  }

  /* ---------- Texto e formatação ---------- */
  const esc = (valor) =>
    String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const digitos = (valor) => String(valor ?? '').replace(/\D/g, '');

  function formatarCpf(valor) {
    const d = digitos(valor);
    return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : String(valor ?? '');
  }

  // 'AAAA-MM-DD' -> 'DD/MM/AAAA' (sem usar Date, para não deslocar o dia por fuso horário)
  function formatarData(valor) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor || '—');
  }

  const normalizar = (valor) =>
    String(valor ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

  /* ---------- Máscaras de campo ---------- */
  const MASCARAS = {
    cpf: (v) =>
      digitos(v)
        .slice(0, 11)
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1-$2'),
    cep: (v) => digitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'),
    telefone: (v) => {
      const d = digitos(v).slice(0, 11);
      if (d.length <= 2) return d ? `(${d}` : '';
      if (d.length <= 6) return d.replace(/^(\d{2})(\d+)/, '($1) $2');
      if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
      return d.replace(/^(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
    },
    uf: (v) => String(v).replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase(),
  };

  function aplicarMascara(input, tipo) {
    const aplicar = () => {
      input.value = MASCARAS[tipo](input.value);
    };
    input.addEventListener('input', aplicar);
    aplicar();
  }

  /* ---------- API ---------- */
  async function api(url, { method = 'GET', body } = {}) {
    let resposta;
    try {
      resposta = await fetch(url, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Não foi possível conectar ao servidor.');
    }

    let dados = null;
    try {
      dados = await resposta.json();
    } catch {
      /* resposta sem corpo JSON */
    }

    if (!resposta.ok) {
      const erro = new Error(dados?.error || `Erro ${resposta.status}`);
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  }

  /* ---------- Avisos (toasts) ---------- */
  function aviso(mensagem, tipo = 'success') {
    let area = document.querySelector('.toasts');
    if (!area) {
      area = document.createElement('div');
      area.className = 'toasts';
      area.setAttribute('aria-live', 'polite');
      document.body.appendChild(area);
    }

    const el = document.createElement('div');
    el.className = `toast ${tipo}`;
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span class="material-icons" aria-hidden="true">${
      tipo === 'error' ? 'error_outline' : 'check_circle'
    }</span><span>${esc(mensagem)}</span>`;
    area.appendChild(el);
    setTimeout(() => el.remove(), tipo === 'error' ? 6000 : 3500);
  }

  /* ---------- Janelas ---------- */
  function criarDialog(html) {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = html;
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
    return dialog;
  }

  // Janela de confirmação. Resolve true/false.
  function confirmar({ titulo, mensagem, confirmarTexto = 'Confirmar', perigo = false }) {
    return new Promise((resolve) => {
      const dialog = criarDialog(`
        <form method="dialog">
          <div class="dialog-body">
            <h2>${esc(titulo)}</h2>
            <p>${esc(mensagem)}</p>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" value="cancelar">Cancelar</button>
            <button class="btn ${perigo ? 'btn-danger' : 'btn-primary'}" value="ok" autofocus>${esc(confirmarTexto)}</button>
          </div>
        </form>`);
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'));
    });
  }

  // Janela com formulário. `onSubmit(form)` pode lançar erro para mostrá-lo dentro da janela.
  function formulario({ titulo, camposHtml, confirmarTexto = 'Salvar', onSubmit }) {
    const dialog = criarDialog(`
      <form>
        <div class="dialog-body">
          <h2>${esc(titulo)}</h2>
          <div class="form-grid">${camposHtml}</div>
          <p class="dialog-error" role="alert" hidden></p>
        </div>
        <div class="dialog-actions">
          <button type="button" class="btn btn-secondary" data-cancelar>Cancelar</button>
          <button type="submit" class="btn btn-primary">${esc(confirmarTexto)}</button>
        </div>
      </form>`);

    const form = dialog.querySelector('form');
    const erro = dialog.querySelector('.dialog-error');
    dialog.querySelector('[data-cancelar]').addEventListener('click', () => dialog.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const enviar = form.querySelector('[type=submit]');
      enviar.disabled = true;
      erro.hidden = true;
      try {
        await onSubmit(form);
        dialog.close();
      } catch (err) {
        erro.textContent = err.message;
        erro.hidden = false;
        enviar.disabled = false;
      }
    });
    return dialog;
  }

  /* ---------- Blocos de interface ---------- */
  const vazio = (icone, titulo, texto) => `
    <div class="empty">
      <span class="material-icons" aria-hidden="true">${icone}</span>
      <strong>${esc(titulo)}</strong>${esc(texto)}
    </div>`;

  const carregando = (texto = 'Carregando…') => `<div class="loading">${esc(texto)}</div>`;

  document.addEventListener('DOMContentLoaded', montarMenu);

  return {
    esc, digitos, formatarCpf, formatarData, normalizar,
    aplicarMascara, api, aviso, confirmar, formulario, vazio, carregando,
  };
})();
