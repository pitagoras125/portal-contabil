import { useEffect, useState } from "react";
import { auth, db, storage } from "./firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, getDocs } from "firebase/firestore";
import logo from "./assets/logo-pitagoras.png";

const EMAIL_CONTADOR = "contato@pitagorascontabilidade.com.br";

const pastas = [
  "Guias e Impostos",
  "Boletos de Honorários",
  "Informes",
  "Fiscal",
  "Contábil",
  "Pessoal",
  "Contratos",
  "CND Federal",
  "CND Estadual",
  "CND Municipal",
  "CND FGTS",
];

export default function App() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [logado, setLogado] = useState(false);

  const [clientes, setClientes] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  const [cnpjCliente, setCnpjCliente] = useState("");

  const [clienteDestino, setClienteDestino] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [departamento, setDepartamento] = useState("Guias e Impostos");
  const [aba, setAba] = useState("Guias e Impostos");
  const [informe, setInforme] = useState("");

  const emailLogado = auth.currentUser?.email || "";
  const isContador = emailLogado === EMAIL_CONTADOR;

  async function carregarDados() {
    const clientesSnap = await getDocs(collection(db, "clientes"));
    setClientes(clientesSnap.docs.map((d) => d.data()));

    const docsSnap = await getDocs(collection(db, "documentos"));
    setDocs(docsSnap.docs.map((d) => d.data()));
  }

  useEffect(() => {
    if (logado) carregarDados();
  }, [logado]);

  async function login() {
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      setLogado(true);
    } catch {
      alert("Erro no login. Confira e-mail e senha.");
    }
  }

  async function sair() {
    await signOut(auth);
    setLogado(false);
    setEmail("");
    setSenha("");
  }

  async function cadastrarCliente() {
    if (!nomeEmpresa || !emailCliente) {
      alert("Informe pelo menos nome da empresa e e-mail.");
      return;
    }

    await addDoc(collection(db, "clientes"), {
      nomeEmpresa,
      email: emailCliente,
      cnpj: cnpjCliente,
      criadoEm: new Date(),
    });

    alert("Cliente cadastrado com sucesso!");

    setNomeEmpresa("");
    setEmailCliente("");
    setCnpjCliente("");

    await carregarDados();
  }

  async function enviarDocumento() {
    if (!file) return alert("Selecione um arquivo.");

    const destino = isContador ? clienteDestino : emailLogado;

    if (isContador && !clienteDestino) {
      return alert("Selecione ou informe o e-mail do cliente.");
    }

    const caminho = `clientes/${destino}/${departamento}/${Date.now()}-${file.name}`;

    await uploadBytes(ref(storage, caminho), file);

    await addDoc(collection(db, "documentos"), {
      emailCliente: destino,
      nome: file.name,
      departamento,
      caminho,
      tipo: isContador ? "contador_enviou" : "cliente_enviou",
      data: new Date(),
    });

    alert("Documento enviado com sucesso!");
    setFile(null);
    await carregarDados();
  }

  async function enviarInforme() {
    if (!clienteDestino) return alert("Selecione ou informe o e-mail do cliente.");
    if (!informe.trim()) return alert("Digite o informe.");

    await addDoc(collection(db, "documentos"), {
      emailCliente: clienteDestino,
      nome: informe,
      departamento: "Informes",
      caminho: "",
      tipo: "informe",
      data: new Date(),
    });

    alert("Informe enviado com sucesso!");
    setInforme("");
    await carregarDados();
  }

  const clienteLogado = clientes.find((c) => c.email === emailLogado);

  const empresaLogada = isContador
    ? "Pitágoras Contabilidade"
    : clienteLogado?.nomeEmpresa || emailLogado;

  const documentosCliente = docs.filter(
    (d) => d.emailCliente === emailLogado && d.departamento === aba
  );

  const documentosContador = docs.filter((d) => d.departamento === aba);

  const documentosVisiveis = isContador ? documentosContador : documentosCliente;

  if (!logado) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginBox}>
          <img src={logo} alt="Pitágoras Contabilidade" style={styles.logoLogin} />

          <h1 style={styles.loginTitle}>Portal do Cliente</h1>

          <p style={styles.loginSubtitle}>
            Área segura para documentos, guias, boletos e informes.
          </p>

          <input
            style={styles.input}
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          <button style={styles.primaryButton} onClick={login}>
            Entrar no portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <img src={logo} alt="Pitágoras Contabilidade" style={styles.logoSidebar} />
        </div>

        <nav style={styles.nav}>
          {pastas.map((pasta) => (
            <button
              key={pasta}
              onClick={() => {
                setAba(pasta);
                setDepartamento(pasta);
              }}
              style={{
                ...styles.navItem,
                background: aba === pasta ? "#ffffff" : "transparent",
                color: aba === pasta ? "#0f3d75" : "#eaf3ff",
              }}
            >
              📁 {pasta}
            </button>
          ))}
        </nav>

        <button style={styles.logoutButton} onClick={sair}>
          Sair
        </button>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={{ margin: 0 }}>
              {isContador ? "Painel do Contador" : "Portal do Cliente"}
            </h1>

            <p style={{ margin: "6px 0", color: "#667085" }}>
              Empresa logada: <strong>{empresaLogada}</strong>
            </p>
          </div>

          <div style={styles.badge}>{isContador ? "Contador" : "Cliente"}</div>
        </header>

        <section style={styles.hero}>
          <h2 style={{ margin: 0 }}>{aba}</h2>
          <p style={{ marginTop: 8 }}>
            Acompanhe documentos, guias, boletos, informes e solicitações.
          </p>
        </section>

        <section style={styles.cards}>
          {isContador && (
            <div style={styles.card}>
              <h3>👤 Cadastrar Cliente</h3>

              <input
                style={styles.input}
                placeholder="Nome/Razão Social"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="E-mail do cliente"
                value={emailCliente}
                onChange={(e) => setEmailCliente(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="CNPJ/CPF"
                value={cnpjCliente}
                onChange={(e) => setCnpjCliente(e.target.value)}
              />

              <button style={styles.primaryButton} onClick={cadastrarCliente}>
                Cadastrar Cliente
              </button>

              <p style={{ color: "#667085", fontSize: 13 }}>
                Depois de cadastrar aqui, crie o mesmo e-mail em Firebase &gt;
                Authentication &gt; Usuários.
              </p>
            </div>
          )}

          {isContador && (
            <div style={styles.card}>
              <h3>📋 Clientes Cadastrados</h3>

              {clientes.length === 0 ? (
                <p style={styles.empty}>Nenhum cliente cadastrado.</p>
              ) : (
                clientes.map((cliente, index) => (
                  <div key={index} style={styles.documentItem}>
                    <div>
                      <strong>{cliente.nomeEmpresa}</strong>
                      <p style={{ margin: 0, color: "#667085" }}>
                        {cliente.email}
                      </p>
                      <p style={{ margin: 0, color: "#667085" }}>
                        {cliente.cnpj}
                      </p>
                    </div>

                    <button
                      style={styles.smallButton}
                      onClick={() => setClienteDestino(cliente.email)}
                    >
                      Selecionar
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={styles.card}>
            <h3>📄 Documentos nesta pasta</h3>

            {documentosVisiveis.length === 0 ? (
              <p style={styles.empty}>Nenhum documento encontrado.</p>
            ) : (
              documentosVisiveis.map((doc, index) => (
                <div key={index} style={styles.documentItem}>
                  <div>
                    <strong>{doc.nome}</strong>
                    <p style={{ margin: 0, color: "#667085" }}>
                      {doc.emailCliente}
                    </p>
                    <p style={{ margin: 0, color: "#667085" }}>
                      {doc.tipo}
                    </p>
                  </div>

                  {doc.caminho && (
                    <button
                      style={styles.smallButton}
                      onClick={async () => {
                        const url = await getDownloadURL(ref(storage, doc.caminho));
                        window.open(url, "_blank");
                      }}
                    >
                      Baixar
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div style={styles.card}>
            <h3>{isContador ? "📤 Enviar ao cliente" : "📤 Enviar ao escritório"}</h3>

            {isContador && (
              <>
                <select
                  style={styles.input}
                  value={clienteDestino}
                  onChange={(e) => setClienteDestino(e.target.value)}
                >
                  <option value="">Selecione o cliente</option>
                  {clientes.map((cliente, index) => (
                    <option key={index} value={cliente.email}>
                      {cliente.nomeEmpresa} - {cliente.email}
                    </option>
                  ))}
                </select>

                <input
                  style={styles.input}
                  placeholder="Ou digite o e-mail do cliente"
                  value={clienteDestino}
                  onChange={(e) => setClienteDestino(e.target.value)}
                />
              </>
            )}

            <select
              style={styles.input}
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
            >
              {pastas.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>

            <input
              style={styles.input}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <button style={styles.primaryButton} onClick={enviarDocumento}>
              Enviar documento
            </button>
          </div>

          {isContador && (
            <div style={styles.card}>
              <h3>🔔 Criar Informe/Aviso</h3>

              <select
                style={styles.input}
                value={clienteDestino}
                onChange={(e) => setClienteDestino(e.target.value)}
              >
                <option value="">Selecione o cliente</option>
                {clientes.map((cliente, index) => (
                  <option key={index} value={cliente.email}>
                    {cliente.nomeEmpresa} - {cliente.email}
                  </option>
                ))}
              </select>

              <textarea
                style={{ ...styles.input, height: 120 }}
                placeholder="Digite o informe para o cliente"
                value={informe}
                onChange={(e) => setInforme(e.target.value)}
              />

              <button style={styles.primaryButton} onClick={enviarInforme}>
                Enviar informe
              </button>
            </div>
          )}

          <div style={styles.card}>
            <h3>📊 Resumo</h3>

            <div style={styles.stats}>
              <div>
                <strong>{docs.length}</strong>
                <span>Total de documentos</span>
              </div>

              <div>
                <strong>{documentosVisiveis.length}</strong>
                <span>Nesta pasta</span>
              </div>

              {isContador && (
                <div>
                  <strong>{clientes.length}</strong>
                  <span>Clientes</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles: any = {
  loginPage: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eef5ff, #ffffff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial",
  },
  loginBox: {
    width: 420,
    background: "#fff",
    padding: 35,
    borderRadius: 28,
    boxShadow: "0 25px 70px rgba(15,61,117,.15)",
    textAlign: "center",
  },
  logoLogin: {
    width: 260,
    maxWidth: "100%",
    objectFit: "contain",
    marginBottom: 20,
  },
  logoSidebar: {
    width: "100%",
    maxHeight: 95,
    objectFit: "contain",
    background: "#fff",
    borderRadius: 18,
    padding: 12,
  },
  loginTitle: {
    margin: 0,
    color: "#0f3d75",
  },
  loginSubtitle: {
    color: "#667085",
    marginBottom: 25,
  },
  input: {
    width: "100%",
    padding: 13,
    marginBottom: 14,
    borderRadius: 14,
    border: "1px solid #dce5f2",
    fontSize: 15,
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    padding: 13,
    border: "none",
    borderRadius: 14,
    background: "#0f3d75",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },
  app: {
    display: "flex",
    minHeight: "100vh",
    background: "#f4f7fb",
    fontFamily: "Arial",
  },
  sidebar: {
    width: 280,
    background: "#0f3d75",
    color: "#fff",
    padding: 24,
    display: "flex",
    flexDirection: "column",
  },
  brand: {
    marginBottom: 28,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flex: 1,
  },
  navItem: {
    border: "none",
    textAlign: "left",
    padding: 13,
    borderRadius: 14,
    cursor: "pointer",
    fontWeight: "bold",
  },
  logoutButton: {
    padding: 12,
    border: "none",
    borderRadius: 14,
    background: "#ffffff",
    color: "#0f3d75",
    fontWeight: "bold",
    cursor: "pointer",
  },
  main: {
    flex: 1,
    padding: 30,
    overflow: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  badge: {
    background: "#e8f1ff",
    color: "#0f3d75",
    padding: "10px 18px",
    borderRadius: 20,
    fontWeight: "bold",
  },
  hero: {
    background: "linear-gradient(135deg, #0f3d75, #1d67b7)",
    color: "#fff",
    padding: 28,
    borderRadius: 28,
    marginBottom: 22,
    boxShadow: "0 20px 50px rgba(15,61,117,.18)",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 20,
  },
  card: {
    background: "#fff",
    padding: 24,
    borderRadius: 24,
    boxShadow: "0 14px 40px rgba(16,32,51,.07)",
  },
  empty: {
    color: "#667085",
    background: "#f7f9fc",
    padding: 15,
    borderRadius: 14,
  },
  documentItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#f7f9fc",
    border: "1px solid #edf2f7",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  smallButton: {
    padding: "9px 14px",
    border: "none",
    borderRadius: 12,
    background: "#0f3d75",
    color: "#fff",
    cursor: "pointer",
  },
  stats: {
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
  },
};