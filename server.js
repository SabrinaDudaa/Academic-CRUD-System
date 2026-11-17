const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos
app.use('/style', express.static(path.join(__dirname, 'style')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(path.join(__dirname, 'public')));

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* -------------------- UTILITÁRIOS -------------------- */

// Erro com status HTTP, para responder 400/404/409 de forma limpa.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Lê e valida o :id da rota.
function lerId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'ID inválido');
  return id;
}

const texto = (valor) => String(valor ?? '').trim();
const apenasDigitos = (valor) => texto(valor).replace(/\D/g, '');

function dataValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

// Cargos possíveis de uma pessoa: nome da tabela e da coluna de cada um.
const CARGOS = {
  adotante: { tabela: 'Adotante', coluna: 'idAdotante', rotulo: 'Adotante' },
  voluntario: { tabela: 'Voluntario', coluna: 'idVoluntario', rotulo: 'Voluntário' },
  doador: { tabela: 'Doador', coluna: 'idDoador', rotulo: 'Doador' },
};

/* -------------------- VALIDAÇÕES -------------------- */

function validarPessoa(corpo) {
  const erros = [];

  const pessoa = {
    nomePessoa: texto(corpo.nomePessoa),
    cpf: apenasDigitos(corpo.cpf),
    idade: Number(corpo.idade),
    email: texto(corpo.email),
    cep: texto(corpo.cep),
    rua: texto(corpo.rua),
    bairro: texto(corpo.bairro),
    cidade: texto(corpo.cidade),
    uf: texto(corpo.uf).toUpperCase(),
    telefone1: texto(corpo.telefone1),
    telefone2: texto(corpo.telefone2),
    tiposPessoa: Array.isArray(corpo.tiposPessoa) ? corpo.tiposPessoa : [],
  };

  if (!pessoa.nomePessoa) erros.push('Informe o nome.');
  if (pessoa.nomePessoa.length > 100) erros.push('O nome deve ter no máximo 100 caracteres.');
  if (pessoa.cpf.length !== 11) erros.push('O CPF deve ter 11 dígitos.');
  if (!Number.isInteger(pessoa.idade) || pessoa.idade < 0 || pessoa.idade > 120) {
    erros.push('A idade deve ser um número inteiro entre 0 e 120.');
  }
  if (pessoa.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pessoa.email)) {
    erros.push('E-mail inválido.');
  }
  if (!pessoa.rua) erros.push('Informe o endereço.');
  if (!pessoa.bairro) erros.push('Informe o bairro.');
  if (!pessoa.cidade) erros.push('Informe a cidade.');
  if (!/^[A-Z]{2}$/.test(pessoa.uf)) erros.push('A UF deve ter 2 letras (ex.: ES).');
  if (!pessoa.telefone1) erros.push('Informe o telefone 1.');

  const invalidos = pessoa.tiposPessoa.filter((t) => !CARGOS[t]);
  if (invalidos.length) erros.push(`Cargo(s) inválido(s): ${invalidos.join(', ')}.`);
  pessoa.tiposPessoa = [...new Set(pessoa.tiposPessoa)];

  if (erros.length) throw new HttpError(400, erros.join(' '));
  return pessoa;
}

function validarPet(corpo) {
  const erros = [];

  const pet = {
    nomePet: texto(corpo.nomePet),
    especie: texto(corpo.Especie ?? corpo.especie),
    raca: texto(corpo.Raca ?? corpo.raca),
    chegada: texto(corpo.Chegada ?? corpo.chegada),
    idade: Number(texto(corpo.Idade ?? corpo.idade) === '' ? NaN : corpo.Idade ?? corpo.idade),
  };

  if (!pet.nomePet) erros.push('Informe o nome.');
  if (!pet.especie) erros.push('Informe a espécie.');
  if (!pet.raca) erros.push('Informe a raça.');
  if (!dataValida(pet.chegada)) erros.push('Informe uma data de chegada válida.');
  if (!Number.isInteger(pet.idade) || pet.idade < 0 || pet.idade > 60) {
    erros.push('A idade deve ser um número inteiro entre 0 e 60.');
  }

  if (erros.length) throw new HttpError(400, erros.join(' '));
  return pet;
}

/* -------------------- ROTAS PESSOA -------------------- */

// Consulta usada para listar uma ou todas as pessoas, já com endereço e cargos.
const SELECT_PESSOAS = `
  SELECT
    p.*,
    e.Logradouro AS rua,
    e.Referencia AS cep,
    c.nomeCidade AS cidade,
    c.Bairro AS bairro,
    c.UF AS uf,
    EXISTS(SELECT 1 FROM Adotante a WHERE a.idAdotante = p.idPessoa) AS is_adotante,
    EXISTS(SELECT 1 FROM Voluntario v WHERE v.idVoluntario = p.idPessoa) AS is_voluntario,
    EXISTS(SELECT 1 FROM Doador d WHERE d.idDoador = p.idPessoa) AS is_doador
  FROM Pessoa p
  JOIN Endereco e ON p.idEndereco = e.idEndereco
  JOIN Cidade c ON p.idCidade = c.idCidade
`;

// Transforma os booleanos em lista de cargos (texto e chaves).
function montarPessoa(linha) {
  const tipos = Object.keys(CARGOS).filter((chave) => linha[`is_${chave}`]);
  return {
    ...linha,
    tipos,
    cargos: tipos.length ? tipos.map((t) => CARGOS[t].rotulo).join(', ') : 'Nenhum cargo',
  };
}

async function cpfJaCadastrado(client, cpf, ignorarId = null) {
  const r = await client.query(
    'SELECT 1 FROM Pessoa WHERE CPF = $1 AND ($2::int IS NULL OR idPessoa <> $2) LIMIT 1',
    [cpf, ignorarId]
  );
  return r.rowCount > 0;
}

app.post('/api/pessoas', async (req, res) => {
  const p = validarPessoa(req.body);

  const idPessoa = await db.transaction(async (client) => {
    if (await cpfJaCadastrado(client, p.cpf)) throw new HttpError(409, 'Já existe uma pessoa com esse CPF.');

    const cidade = await client.query(
      `INSERT INTO Cidade (nomeCidade, Bairro, UF) VALUES ($1, $2, $3) RETURNING idCidade`,
      [p.cidade, p.bairro, p.uf]
    );
    const idCidade = cidade.rows[0].idcidade;

    const endereco = await client.query(
      `INSERT INTO Endereco (Logradouro, Referencia, idCidade) VALUES ($1, $2, $3) RETURNING idEndereco`,
      [p.rua, p.cep || null, idCidade]
    );
    const idEndereco = endereco.rows[0].idendereco;

    const pessoa = await client.query(
      `INSERT INTO Pessoa (nomePessoa, CPF, Idade, Email, Telefone1, Telefone2, idEndereco, idCidade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING idPessoa`,
      [p.nomePessoa, p.cpf, p.idade, p.email, p.telefone1, p.telefone2 || null, idEndereco, idCidade]
    );
    const id = pessoa.rows[0].idpessoa;

    for (const tipo of p.tiposPessoa) {
      const { tabela, coluna } = CARGOS[tipo];
      await client.query(`INSERT INTO ${tabela} (${coluna}) VALUES ($1)`, [id]);
    }
    return id;
  });

  res.status(201).json({ message: 'Pessoa cadastrada com sucesso!', idPessoa });
});

app.get('/api/pessoas', async (req, res) => {
  const result = await db.query(`${SELECT_PESSOAS} ORDER BY p.idPessoa DESC`);
  res.json(result.rows.map(montarPessoa));
});

app.get('/api/pessoas/:id', async (req, res) => {
  const id = lerId(req);
  const result = await db.query(`${SELECT_PESSOAS} WHERE p.idPessoa = $1`, [id]);
  if (!result.rowCount) throw new HttpError(404, 'Pessoa não encontrada.');
  res.json(montarPessoa(result.rows[0]));
});

app.put('/api/pessoas/:id', async (req, res) => {
  const id = lerId(req);
  const p = validarPessoa(req.body);

  await db.transaction(async (client) => {
    const atual = await client.query(
      'SELECT idEndereco, idCidade FROM Pessoa WHERE idPessoa = $1 FOR UPDATE',
      [id]
    );
    if (!atual.rowCount) throw new HttpError(404, 'Pessoa não encontrada.');
    const { idendereco, idcidade } = atual.rows[0];

    if (await cpfJaCadastrado(client, p.cpf, id)) {
      throw new HttpError(409, 'Já existe outra pessoa com esse CPF.');
    }

    await client.query(
      'UPDATE Cidade SET nomeCidade = $1, Bairro = $2, UF = $3 WHERE idCidade = $4',
      [p.cidade, p.bairro, p.uf, idcidade]
    );
    await client.query(
      'UPDATE Endereco SET Logradouro = $1, Referencia = $2 WHERE idEndereco = $3',
      [p.rua, p.cep || null, idendereco]
    );
    await client.query(
      `UPDATE Pessoa
          SET nomePessoa = $1, CPF = $2, Idade = $3, Email = $4, Telefone1 = $5, Telefone2 = $6
        WHERE idPessoa = $7`,
      [p.nomePessoa, p.cpf, p.idade, p.email, p.telefone1, p.telefone2 || null, id]
    );

    // Sincroniza os cargos: remove os desmarcados e adiciona os novos.
    for (const [tipo, { tabela, coluna }] of Object.entries(CARGOS)) {
      const marcado = p.tiposPessoa.includes(tipo);
      if (marcado) {
        await client.query(
          `INSERT INTO ${tabela} (${coluna}) VALUES ($1) ON CONFLICT (${coluna}) DO NOTHING`,
          [id]
        );
        continue;
      }
      if (tipo === 'adotante') {
        const contratos = await client.query(
          'SELECT 1 FROM ContratoAdocao WHERE Adotante_idAdotante = $1 LIMIT 1',
          [id]
        );
        if (contratos.rowCount) {
          throw new HttpError(
            409,
            'Não é possível remover o cargo de adotante: a pessoa possui contratos de adoção.'
          );
        }
      }
      await client.query(`DELETE FROM ${tabela} WHERE ${coluna} = $1`, [id]);
    }
  });

  res.json({ message: 'Pessoa atualizada com sucesso!' });
});

app.delete('/api/pessoas/:id', async (req, res) => {
  const id = lerId(req);

  await db.transaction(async (client) => {
    const atual = await client.query(
      'SELECT idEndereco, idCidade FROM Pessoa WHERE idPessoa = $1 FOR UPDATE',
      [id]
    );
    if (!atual.rowCount) throw new HttpError(404, 'Pessoa não encontrada.');
    const { idendereco, idcidade } = atual.rows[0];

    const contratos = await client.query(
      'SELECT 1 FROM ContratoAdocao WHERE Adotante_idAdotante = $1 LIMIT 1',
      [id]
    );
    if (contratos.rowCount) {
      throw new HttpError(409, 'Não é possível excluir: a pessoa possui contratos de adoção.');
    }

    for (const { tabela, coluna } of Object.values(CARGOS)) {
      await client.query(`DELETE FROM ${tabela} WHERE ${coluna} = $1`, [id]);
    }
    await client.query('DELETE FROM Pessoa WHERE idPessoa = $1', [id]);

    // Endereço e cidade são criados junto com a pessoa; só apagamos se ninguém mais usa.
    await client.query(
      `DELETE FROM Endereco e WHERE e.idEndereco = $1
         AND NOT EXISTS (SELECT 1 FROM Pessoa WHERE idEndereco = e.idEndereco)`,
      [idendereco]
    );
    await client.query(
      `DELETE FROM Cidade c WHERE c.idCidade = $1
         AND NOT EXISTS (SELECT 1 FROM Pessoa WHERE idCidade = c.idCidade)
         AND NOT EXISTS (SELECT 1 FROM Endereco WHERE idCidade = c.idCidade)`,
      [idcidade]
    );
  });

  res.json({ message: 'Pessoa excluída com sucesso!' });
});

// Rota para verificar CPF (ignorarId serve para a edição, para não acusar o próprio cadastro)
app.get('/api/verificar-cpf', async (req, res) => {
  const cpf = texto(req.query.cpf);
  if (cpf.length !== 11 || !/^\d+$/.test(cpf)) throw new HttpError(400, 'CPF inválido');

  const ignorarId = req.query.ignorarId ? Number(req.query.ignorarId) : null;
  const existe = await cpfJaCadastrado(db, cpf, Number.isInteger(ignorarId) ? ignorarId : null);
  res.json({ existe });
});

/* -------------------- ROTAS PET -------------------- */

app.post('/api/pet', async (req, res) => {
  const pet = validarPet(req.body);
  const result = await db.query(
    `INSERT INTO Pet (Especie, nomePet, Raca, Chegada, Idade)
     VALUES ($1, $2, $3, $4, $5) RETURNING idPet`,
    [pet.especie, pet.nomePet, pet.raca, pet.chegada, pet.idade]
  );
  res.status(201).json({ message: 'Pet cadastrado com sucesso!', idPet: result.rows[0].idpet });
});

app.get('/api/pet', async (req, res) => {
  const result = await db.query('SELECT * FROM Pet ORDER BY idPet DESC');
  res.json(result.rows);
});

app.get('/api/pet/:id', async (req, res) => {
  const id = lerId(req);
  const result = await db.query('SELECT * FROM Pet WHERE idPet = $1', [id]);
  if (!result.rowCount) throw new HttpError(404, 'Pet não encontrado.');
  res.json(result.rows[0]);
});

app.put('/api/pet/:id', async (req, res) => {
  const id = lerId(req);
  const pet = validarPet(req.body);
  const result = await db.query(
    `UPDATE Pet SET Especie = $1, nomePet = $2, Raca = $3, Chegada = $4, Idade = $5
      WHERE idPet = $6`,
    [pet.especie, pet.nomePet, pet.raca, pet.chegada, pet.idade, id]
  );
  if (!result.rowCount) throw new HttpError(404, 'Pet não encontrado.');
  res.json({ message: 'Pet atualizado com sucesso!' });
});

app.delete('/api/pet/:id', async (req, res) => {
  const id = lerId(req);

  await db.transaction(async (client) => {
    const existe = await client.query('SELECT 1 FROM Pet WHERE idPet = $1 FOR UPDATE', [id]);
    if (!existe.rowCount) throw new HttpError(404, 'Pet não encontrado.');

    const contratos = await client.query(
      'SELECT 1 FROM ContratoAdocao WHERE Pet_idPet = $1 LIMIT 1',
      [id]
    );
    if (contratos.rowCount) {
      throw new HttpError(409, 'Não é possível excluir: o pet possui contratos de adoção.');
    }
    await client.query('DELETE FROM Pet WHERE idPet = $1', [id]);
  });

  res.json({ message: 'Pet excluído com sucesso!' });
});

app.get('/api/pets-adotados-ativos', async (req, res) => {
  const result = await db.query(`
    SELECT p.*, ca.idContratoAdocao AS idcontrato,
           to_char(ca.Data, 'YYYY-MM-DD') AS dataadocao,
           pe.nomePessoa AS adotante
    FROM Pet p
    JOIN ContratoAdocao ca ON p.idPet = ca.Pet_idPet
    JOIN Pessoa pe ON pe.idPessoa = ca.Adotante_idAdotante
    WHERE ca.Situacao = 'Ativo'
    ORDER BY p.nomePet
  `);
  res.json(result.rows);
});

app.get('/api/pets-disponiveis', async (req, res) => {
  const result = await db.query(`
    SELECT *
    FROM Pet p
    WHERE p.idPet NOT IN (
      SELECT Pet_idPet FROM ContratoAdocao WHERE Situacao = 'Ativo'
    )
    ORDER BY p.nomePet
  `);
  res.json(result.rows);
});

/* -------------------- DASHBOARD -------------------- */

// Totais para os cartões do painel.
app.get('/api/resumo', async (req, res) => {
  const result = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM Pessoa)::int AS pessoas,
      (SELECT COUNT(*) FROM Pet)::int AS pets,
      (SELECT COUNT(DISTINCT Pet_idPet) FROM ContratoAdocao WHERE Situacao = 'Ativo')::int AS adotados,
      (SELECT COUNT(*) FROM Pet
        WHERE idPet NOT IN (SELECT Pet_idPet FROM ContratoAdocao WHERE Situacao = 'Ativo'))::int AS disponiveis
  `);
  res.json(result.rows[0]);
});

// Rota para contar combinações de cargos das pessoas
app.get('/api/tipos-pessoas', async (req, res) => {
  const tem = (tabela, coluna, valor) =>
    `${valor ? '' : 'NOT '}EXISTS (SELECT 1 FROM ${tabela} x WHERE x.${coluna} = p.idPessoa)`;
  const combinacao = (v, a, d) =>
    `COUNT(*) FILTER (WHERE ${tem('Voluntario', 'idVoluntario', v)}
      AND ${tem('Adotante', 'idAdotante', a)}
      AND ${tem('Doador', 'idDoador', d)})`;

  const result = await db.query(`
    SELECT
      ${combinacao(false, false, false)}::int AS nenhum,
      ${combinacao(true, false, false)}::int AS voluntario,
      ${combinacao(false, true, false)}::int AS adotante,
      ${combinacao(false, false, true)}::int AS doador,
      ${combinacao(true, true, false)}::int AS voluntario_adotante,
      ${combinacao(true, false, true)}::int AS voluntario_doador,
      ${combinacao(false, true, true)}::int AS doador_adotante,
      ${combinacao(true, true, true)}::int AS voluntario_adotante_doador
    FROM Pessoa p
  `);
  res.json(result.rows[0]);
});

// Rota para contar pets por espécie
app.get('/api/pets-por-tipo', async (req, res) => {
  const result = await db.query(`
    SELECT Especie, COUNT(*)::int AS quantidade
    FROM Pet
    GROUP BY Especie
    ORDER BY Especie
  `);
  res.json(result.rows);
});

/* -------------------- ROTAS ADOTANTE -------------------- */
app.get('/api/adotantes', async (req, res) => {
  const result = await db.query(`
    SELECT p.idPessoa, p.nomePessoa, p.cpf
    FROM Adotante a
    JOIN Pessoa p ON a.idAdotante = p.idPessoa
    ORDER BY p.nomePessoa
  `);
  res.json(result.rows);
});

/* -------------------- ROTAS CONTRATO DE ADOÇÃO -------------------- */

const SITUACOES = ['Ativo', 'Inativo'];

app.get('/api/adocoes', async (req, res) => {
  const result = await db.query(`
    SELECT ca.idContratoAdocao AS idcontrato,
           ca.Situacao AS situacao,
           to_char(ca.Data, 'YYYY-MM-DD') AS data,
           pt.idPet AS idpet, pt.nomePet AS nomepet, pt.Especie AS especie,
           pe.idPessoa AS idadotante, pe.nomePessoa AS nomeadotante
    FROM ContratoAdocao ca
    JOIN Pet pt ON pt.idPet = ca.Pet_idPet
    JOIN Pessoa pe ON pe.idPessoa = ca.Adotante_idAdotante
    ORDER BY ca.Data DESC, ca.idContratoAdocao DESC
  `);
  res.json(result.rows);
});

app.post('/api/adocao', async (req, res) => {
  const idAdotante = Number(req.body.idAdotante);
  const idPet = Number(req.body.idPet);
  const dataAdocao = texto(req.body.dataAdocao);

  if (!idAdotante || !idPet || !dataAdocao) {
    throw new HttpError(400, 'Campos idAdotante, idPet e dataAdocao são obrigatórios');
  }
  if (!dataValida(dataAdocao)) throw new HttpError(400, 'Data da adoção inválida.');

  await db.transaction(async (client) => {
    const pet = await client.query('SELECT 1 FROM Pet WHERE idPet = $1 FOR UPDATE', [idPet]);
    if (!pet.rowCount) throw new HttpError(404, 'Pet não encontrado.');

    const adotante = await client.query('SELECT 1 FROM Adotante WHERE idAdotante = $1', [idAdotante]);
    if (!adotante.rowCount) throw new HttpError(404, 'Adotante não encontrado.');

    const ativo = await client.query(
      `SELECT 1 FROM ContratoAdocao WHERE Pet_idPet = $1 AND Situacao = 'Ativo' LIMIT 1`,
      [idPet]
    );
    if (ativo.rowCount) throw new HttpError(409, 'Este pet já possui uma adoção ativa.');

    await client.query(
      `INSERT INTO ContratoAdocao (Situacao, Data, Pet_idPet, Adotante_idAdotante)
       VALUES ('Ativo', $1, $2, $3)`,
      [dataAdocao, idPet, idAdotante]
    );
  });

  res.status(201).json({ message: 'Adoção cadastrada com sucesso!' });
});

app.put('/api/adocao/:id', async (req, res) => {
  const id = lerId(req);
  const situacao = texto(req.body.situacao);
  const dataAdocao = texto(req.body.dataAdocao);

  if (!SITUACOES.includes(situacao)) throw new HttpError(400, 'Situação inválida.');
  if (!dataValida(dataAdocao)) throw new HttpError(400, 'Data da adoção inválida.');

  await db.transaction(async (client) => {
    const contrato = await client.query(
      'SELECT Pet_idPet FROM ContratoAdocao WHERE idContratoAdocao = $1 FOR UPDATE',
      [id]
    );
    if (!contrato.rowCount) throw new HttpError(404, 'Contrato não encontrado.');

    if (situacao === 'Ativo') {
      const outro = await client.query(
        `SELECT 1 FROM ContratoAdocao
          WHERE Pet_idPet = $1 AND Situacao = 'Ativo' AND idContratoAdocao <> $2 LIMIT 1`,
        [contrato.rows[0].pet_idpet, id]
      );
      if (outro.rowCount) throw new HttpError(409, 'Este pet já possui outra adoção ativa.');
    }

    await client.query(
      'UPDATE ContratoAdocao SET Situacao = $1, Data = $2 WHERE idContratoAdocao = $3',
      [situacao, dataAdocao, id]
    );
  });

  res.json({ message: 'Contrato atualizado com sucesso!' });
});

app.delete('/api/adocao/:id', async (req, res) => {
  const id = lerId(req);
  const result = await db.query('DELETE FROM ContratoAdocao WHERE idContratoAdocao = $1', [id]);
  if (!result.rowCount) throw new HttpError(404, 'Contrato não encontrado.');
  res.json({ message: 'Contrato excluído com sucesso!' });
});

/* -------------------- TRATAMENTO DE ERROS -------------------- */

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, next) => {
  if (erro instanceof HttpError) return res.status(erro.status).json({ error: erro.message });
  if (erro.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });

  console.error('Erro não tratado:', erro);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

/* -------------------- INICIAR SERVIDOR -------------------- */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
