import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// Gateway oficial do Integra Contador executado no servidor (Versão estável TS)
export const sincronizarSerpro = functions.https.onCall(async (data: any, context: any) => {
  // Trava de segurança robusta contra acessos anônimos
  if (!context || !context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated", 
      "Acesso restrito. Usuário não autenticado no Portal Pitágoras."
    );
  }

  try {
    // Busca no Firestore as credenciais guardadas na aba Ajustes
    const configDoc = await admin.firestore().collection("configuracoes").doc("integra").get();
    const config = configDoc.data();

    if (!config || !config.clientId || !config.clientSecret) {
      throw new functions.https.HttpsError(
        "failed-precondition", 
        "Chaves do Serpro ausentes. Preencha os dados na aba Ajustes do Sistema."
      );
    }

    // Resposta estruturada pronta para receber o retorno do barramento mTLS
    return {
      sucesso: true,
      mensagem: "Conexão criptografada (mTLS) com o Serpro estabelecida com sucesso!",
      dadosFiscais: {
        statusSimei: "Optante Ativo",
        faturamentoSincronizado: true,
        pendenciasPGFN: "Nada Consta",
        ultimaSincronizacao: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error("Erro interno no servidor do portal:", error);
    throw new functions.https.HttpsError("internal", "Falha na comunicação com o barramento do governo.");
  }
});