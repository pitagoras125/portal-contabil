const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

// Definimos a função usando a v2 e injetamos o segredo
exports.criarBoletoAsaas = onRequest({ secrets: ["ASAAS_API_KEY"], cors: true }, async (req, res) => {
  try {
    const { nome, email, cpfCnpj, valor, vencimento, descricao } = req.body;
    
    // Na v2, o segredo fica disponível diretamente em process.env
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

    if (!ASAAS_API_KEY) {
      return res.status(500).send({ sucesso: false, mensagem: "Chave API não configurada." });
    }

    // 1. Criar cliente no Asaas
    const clienteResponse = await axios.post(
      "https://sandbox.asaas.com/api/v3/customers",
      { name: nome, email, cpfCnpj },
      { headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json" } }
    );

    // 2. Gerar o boleto
    const boletoResponse = await axios.post(
      "https://sandbox.asaas.com/api/v3/payments",
      {
        customer: clienteResponse.data.id,
        billingType: "BOLETO",
        value: Number(valor),
        dueDate: vencimento,
        description: descricao,
      },
      { headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json" } }
    );

    res.status(200).send({
      sucesso: true,
      id: boletoResponse.data.id,
      boleto: boletoResponse.data.bankSlipUrl,
      invoiceUrl: boletoResponse.data.invoiceUrl,
    });

  } catch (erro) {
    console.error("Erro detalhado:", erro.response?.data || erro.message);
    res.status(500).send({
      sucesso: false,
      erro: erro.response?.data || erro.message,
    });
  }
});
// ======================================================
// CRIAR CLIENTE COM SENHA
// ======================================================

exports.criarClienteComSenha = onRequest({ cors: true }, async (req, res) => {
  try {
    const { nomeEmpresa, email, senha, cnpj } = req.body;

    if (!nomeEmpresa || !email || !senha) {
      return res.status(400).send({
        sucesso: false,
        erro: "Informe nome da empresa, e-mail e senha.",
      });
    }

    if (String(senha).length < 6) {
      return res.status(400).send({
        sucesso: false,
        erro: "A senha precisa ter no mínimo 6 caracteres.",
      });
    }

    let usuario;

    try {
      usuario = await admin.auth().createUser({
        email,
        password: senha,
        displayName: nomeEmpresa,
        disabled: false,
      });
    } catch (erroAuth) {
      if (erroAuth.code === "auth/email-already-exists") {
        usuario = await admin.auth().getUserByEmail(email);
      } else {
        throw erroAuth;
      }
    }

    await admin.firestore().collection("clientes").doc(usuario.uid).set(
      {
        uid: usuario.uid,
        nomeEmpresa,
        email,
        cnpj: cnpj || "",
        criadoEm: new Date(),
        ativo: true,
        tipoUsuario: "cliente",
      },
      { merge: true }
    );

    return res.status(200).send({
      sucesso: true,
      uid: usuario.uid,
      mensagem: "Cliente criado com login e senha.",
    });
  } catch (erro) {
    console.error("Erro ao criar cliente:", erro);

    return res.status(500).send({
      sucesso: false,
      erro: erro.message || "Erro ao criar cliente.",
    });
  }
});