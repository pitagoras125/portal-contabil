const { onRequest } = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");

/**
 * Envio de e-mails via Gmail.
 *
 * Como usar:
 * - No portal, em Configurações, informe:
 *   1) E-mail Gmail remetente
 *   2) Senha de app do Gmail com 16 dígitos
 *
 * Observação:
 * Não use a senha normal do Gmail.
 * Use senha de app gerada na Conta Google com verificação em duas etapas ativada.
 */

exports.enviarEmailGmail = onRequest({ cors: true }, async (req, res) => {
  try {
    const {
      para,
      nome,
      arquivo,
      assunto,
      mensagem,
      tipo,
      remetente_email,
      remetente_senha,
    } = req.body || {};

    if (!para) {
      return res.status(400).send({
        sucesso: false,
        erro: "E-mail do destinatário não informado.",
      });
    }

    if (!remetente_email || !remetente_senha) {
      return res.status(400).send({
        sucesso: false,
        erro: "E-mail Gmail ou senha de app não configurados.",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: remetente_email,
        pass: String(remetente_senha).replace(/\s/g, ""),
      },
    });

    const titulo =
      assunto ||
      (tipo === "cliente_enviou"
        ? "Cliente enviou novo documento pelo portal"
        : "Novo documento disponível no Portal Contábil");

    const textoPrincipal =
      mensagem ||
      (tipo === "cliente_enviou"
        ? `Um cliente enviou o arquivo ${arquivo || "sem nome"} pelo portal.`
        : `Um novo documento foi disponibilizado para você no Portal Contábil.`);

    const html = `
      <div style="font-family:Arial,sans-serif;background:#f6f8fb;padding:28px;">
        <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e5e7eb;">
          <h2 style="margin:0 0 12px;color:#111827;">${titulo}</h2>
          <p style="font-size:15px;color:#374151;line-height:1.6;">Olá, ${nome || "usuário"}.</p>
          <p style="font-size:15px;color:#374151;line-height:1.6;">${textoPrincipal}</p>
          ${
            arquivo
              ? `<div style="background:#f3f4f6;border-radius:12px;padding:14px;margin:18px 0;">
                   <strong>Arquivo:</strong> ${arquivo}
                 </div>`
              : ""
          }
          <p style="font-size:13px;color:#6b7280;margin-top:22px;">
            Acesse o Portal Contábil para visualizar os detalhes.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Portal Contábil" <${remetente_email}>`,
      to: para,
      subject: titulo,
      text: `${textoPrincipal}\n\nArquivo: ${arquivo || ""}`,
      html,
    });

    return res.status(200).send({
      sucesso: true,
      mensagem: "E-mail enviado com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao enviar e-mail Gmail:", erro);
    return res.status(500).send({
      sucesso: false,
      erro: erro.message || "Erro ao enviar e-mail.",
    });
  }
});
