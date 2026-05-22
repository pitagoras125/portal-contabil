import { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../firebase";

const EMAIL_CONTADOR = "contato@pitagorascontabilidade.com.br";

type Props = {
  user: any;
  clientes: any[];
  isContador: boolean;
  styles: any;
};

export default function ChatSolicitacoes({ user, clientes, isContador, styles }: Props) {
  const [conversas, setConversas] = useState<any[]>([]);
  const [conversaAtual, setConversaAtual] = useState<any>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [enviando, setEnviando] = useState(false);
  const mensagensRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = isContador
      ? query(collection(db, "chatsSolicitacoes"), orderBy("ultimaAtualizacao", "desc"))
      : query(collection(db, "chatsSolicitacoes"), where("emailCliente", "==", user.email), orderBy("ultimaAtualizacao", "desc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      const lista: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setConversas(lista);
      if (!conversaAtual && lista.length > 0) setConversaAtual(lista[0]);
    });

    return () => unsubscribe();
  }, [user, isContador, conversaAtual]);

  useEffect(() => {
    if (!conversaAtual?.id || !user?.email) return;

    const q = query(collection(db, "chatsSolicitacoes", conversaAtual.id, "mensagens"), orderBy("criadoEm", "asc"));

    const unsubscribe = onSnapshot(q, async (snap) => {
      const lista: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMensagens(lista);

      setTimeout(() => {
        mensagensRef.current?.scrollTo({
          top: mensagensRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);

      for (const msg of lista) {
        if (msg.para === user.email && !msg.lida) {
          await updateDoc(doc(db, "chatsSolicitacoes", conversaAtual.id, "mensagens", msg.id), {
            lida: true,
            lidaEm: new Date(),
          });
        }
      }
    });

    return () => unsubscribe();
  }, [conversaAtual?.id, user?.email]);

  async function criarConversaCliente() {
    const cliente = clientes.find((c) => c.email === user.email) || { email: user.email, nomeEmpresa: user.email };

    const existentes = await getDocs(query(collection(db, "chatsSolicitacoes"), where("emailCliente", "==", user.email)));

    if (!existentes.empty) {
      setConversaAtual({ id: existentes.docs[0].id, ...existentes.docs[0].data() });
      return;
    }

    const nova = await addDoc(collection(db, "chatsSolicitacoes"), {
      emailCliente: user.email,
      nomeCliente: cliente.nomeEmpresa || user.email,
      participantes: [user.email, EMAIL_CONTADOR],
      criadoEm: new Date(),
      ultimaAtualizacao: new Date(),
      ultimaMensagem: "",
      status: "ABERTO",
    });

    setConversaAtual({
      id: nova.id,
      emailCliente: user.email,
      nomeCliente: cliente.nomeEmpresa || user.email,
      status: "ABERTO",
    });
  }

  async function criarConversaContador() {
    if (!clienteSelecionado) {
      alert("Selecione um cliente.");
      return;
    }

    const cliente = clientes.find((c) => c.email === clienteSelecionado);

    if (!cliente) {
      alert("Cliente não encontrado.");
      return;
    }

    const existentes = await getDocs(query(collection(db, "chatsSolicitacoes"), where("emailCliente", "==", cliente.email)));

    if (!existentes.empty) {
      setConversaAtual({ id: existentes.docs[0].id, ...existentes.docs[0].data() });
      return;
    }

    const nova = await addDoc(collection(db, "chatsSolicitacoes"), {
      emailCliente: cliente.email,
      nomeCliente: cliente.nomeEmpresa || cliente.email,
      participantes: [cliente.email, EMAIL_CONTADOR],
      criadoEm: new Date(),
      ultimaAtualizacao: new Date(),
      ultimaMensagem: "",
      status: "ABERTO",
    });

    setConversaAtual({
      id: nova.id,
      emailCliente: cliente.email,
      nomeCliente: cliente.nomeEmpresa || cliente.email,
      status: "ABERTO",
    });
  }

  async function enviarMensagem() {
    try {
      if (!texto.trim() && !arquivo) {
        alert("Digite uma mensagem ou selecione um arquivo.");
        return;
      }

      if (!conversaAtual?.id) {
        if (isContador) await criarConversaContador();
        else await criarConversaCliente();
        return;
      }

      setEnviando(true);

      let arquivoUrl = "";
      let arquivoNome = "";
      let arquivoCaminho = "";

      if (arquivo) {
        arquivoNome = arquivo.name;
        arquivoCaminho = `chatsSolicitacoes/${conversaAtual.id}/${Date.now()}-${arquivo.name}`;
        const uploadTask = await uploadBytesResumable(ref(storage, arquivoCaminho), arquivo);
        arquivoUrl = await getDownloadURL(uploadTask.ref);
      }

      const de = user.email;
      const para = isContador ? conversaAtual.emailCliente : EMAIL_CONTADOR;
      const mensagemTexto = texto.trim();

      await addDoc(collection(db, "chatsSolicitacoes", conversaAtual.id, "mensagens"), {
        texto: mensagemTexto,
        arquivoUrl,
        arquivoNome,
        arquivoCaminho,
        de,
        para,
        criadoEm: new Date(),
        lida: false,
        tipo: arquivo ? "arquivo" : "texto",
      });

      await updateDoc(doc(db, "chatsSolicitacoes", conversaAtual.id), {
        ultimaMensagem: mensagemTexto || arquivoNome,
        ultimaAtualizacao: new Date(),
        ultimaMensagemDe: de,
        ultimaMensagemPara: para,
      });

      await addDoc(collection(db, "notificacoes"), {
        destino: para,
        titulo: isContador ? "Resposta do escritório" : "Nova solicitação de cliente",
        mensagem: isContador
          ? `O escritório respondeu: ${mensagemTexto || arquivoNome}`
          : `${conversaAtual.nomeCliente || de} enviou: ${mensagemTexto || arquivoNome}`,
        lida: false,
        data: new Date(),
        chatId: conversaAtual.id,
        tipo: "chat_solicitacao",
      });

      setTexto("");
      setArquivo(null);
      setEnviando(false);
    } catch (erro) {
      console.error(erro);
      alert("Erro ao enviar mensagem.");
      setEnviando(false);
    }
  }

  return (
    <section style={chatStyles.container}>
      <div style={chatStyles.sidebar}>
        <h2 style={chatStyles.title}>Solicitações</h2>

        {isContador ? (
          <div style={chatStyles.newChatBox}>
            <select style={styles.input} value={clienteSelecionado} onChange={(e) => setClienteSelecionado(e.target.value)}>
              <option value="">Selecionar cliente</option>
              {clientes.map((c, i) => (
                <option key={i} value={c.email}>{c.nomeEmpresa || c.email}</option>
              ))}
            </select>

            <button style={styles.primaryButton} onClick={criarConversaContador}>
              Abrir conversa
            </button>
          </div>
        ) : (
          <button style={styles.primaryButton} onClick={criarConversaCliente}>
            Nova solicitação
          </button>
        )}

        <div style={chatStyles.chatList}>
          {conversas.length === 0 ? (
            <p style={styles.empty}>Nenhuma conversa.</p>
          ) : (
            conversas.map((c) => (
              <button
                key={c.id}
                style={conversaAtual?.id === c.id ? chatStyles.chatItemActive : chatStyles.chatItem}
                onClick={() => setConversaAtual(c)}
              >
                <strong>{c.nomeCliente || c.emailCliente}</strong>
                <span>{c.ultimaMensagem || "Sem mensagens"}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div style={chatStyles.chatArea}>
        {!conversaAtual ? (
          <div style={chatStyles.emptyChat}>
            <h2>Selecione ou crie uma solicitação</h2>
            <p>As mensagens e documentos aparecerão aqui.</p>
          </div>
        ) : (
          <>
            <div style={chatStyles.chatHeader}>
              <div>
                <h2 style={chatStyles.title}>{conversaAtual.nomeCliente}</h2>
                <p style={styles.muted}>{conversaAtual.emailCliente}</p>
              </div>
              <span style={chatStyles.status}>{conversaAtual.status || "ABERTO"}</span>
            </div>

            <div style={chatStyles.messages} ref={mensagensRef}>
              {mensagens.map((m) => {
                const minha = m.de === user.email;

                return (
                  <div
                    key={m.id}
                    style={{
                      ...chatStyles.message,
                      alignSelf: minha ? "flex-end" : "flex-start",
                      background: minha ? "#7c3aed" : "#f1f5f9",
                      color: minha ? "#fff" : "#0f172a",
                    }}
                  >
                    {m.texto && <p style={{ margin: 0 }}>{m.texto}</p>}

                    {m.arquivoUrl && (
                      <a
                        href={m.arquivoUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: minha ? "#fff" : "#7c3aed", fontWeight: 700 }}
                      >
                        📎 {m.arquivoNome || "Abrir arquivo"}
                      </a>
                    )}

                    <small style={{ opacity: 0.75 }}>{m.lida ? "Lida" : "Enviada"}</small>
                  </div>
                );
              })}
            </div>

            <div style={chatStyles.inputArea}>
              <textarea
                style={chatStyles.textarea}
                placeholder="Digite sua mensagem..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />

              <input style={styles.input} type="file" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />

              <button style={styles.primaryButton} onClick={enviarMensagem} disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const chatStyles: any = {
  container: { display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, minHeight: 620 },
  sidebar: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 20, boxShadow: "0 12px 35px rgba(15,23,42,.06)" },
  title: { margin: 0, color: "#0f172a" },
  newChatBox: { marginTop: 18, marginBottom: 18 },
  chatList: { display: "flex", flexDirection: "column", gap: 10, marginTop: 18 },
  chatItem: { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", textAlign: "left", cursor: "pointer", gap: 5 },
  chatItemActive: { border: "1px solid #c4b5fd", background: "#f3e8ff", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", textAlign: "left", cursor: "pointer", gap: 5 },
  chatArea: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, boxShadow: "0 12px 35px rgba(15,23,42,.06)", display: "flex", flexDirection: "column", overflow: "hidden" },
  emptyChat: { height: "100%", minHeight: 500, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#64748b" },
  chatHeader: { padding: 20, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" },
  status: { background: "#dcfce7", color: "#166534", borderRadius: 999, padding: "6px 12px", fontWeight: 800, fontSize: 12 },
  messages: { padding: 20, flex: 1, minHeight: 360, maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, background: "#f8fafc" },
  message: { maxWidth: "72%", padding: 14, borderRadius: 18, display: "flex", flexDirection: "column", gap: 8 },
  inputArea: { padding: 16, borderTop: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "1fr 240px 140px", gap: 12, alignItems: "start" },
  textarea: { width: "100%", minHeight: 52, padding: 14, borderRadius: 14, border: "1px solid #dbe4ee", resize: "vertical", boxSizing: "border-box", fontFamily: "Arial" },
};
