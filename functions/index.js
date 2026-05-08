const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const { Resend } = require("resend");

const resend = new Resend("re_FKwHjZyR_CRVVWwcDgYpFGwdCvFviyH9iI");

exports.enviarEmail = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { email, nome, arquivo } = req.body || {};

      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: email || "wesleytenesv@gmail.com",
        subject: "Novo documento recebido",
        html: `
          <h2>Novo documento recebido</h2>
          <p><b>Cliente:</b> ${nome || "Não informado"}</p>
          <p><b>Arquivo:</b> ${arquivo || "Não informado"}</p>
        `,
      });

      res.status(200).send("Email enviado com sucesso!");
    } catch (error) {
      console.error(error);
      res.status(500).send("Erro ao enviar email");
    }
  });
});