const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const { Resend } = require("resend");

setGlobalOptions({ maxInstances: 10 });

const resend = new Resend("re_FKwHjZyR_CRVVWwcDgYpFGwdCvFviyH9i");

exports.enviarEmail = onRequest(async (req, res) => {
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "wesleytenesv@gmail.com",
      subject: "Teste do sistema",
      html: "<h1>Email funcionando 🚀</h1>",
    });

    res.send("Email enviado com sucesso!");
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao enviar email");
  }
