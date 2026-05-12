import { useEffect, useState } from "react";
import { auth, db, storage } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import logo from "./assets/logo-pitagoras.png";

const EMAIL_CONTADOR = "contato@pitagorascontabilidade.com.br";
const EMAIL_AVISO_CONTADOR = "wesleytenesv@gmail.com";
const URL_EMAIL = "https://enviaremail-aa5vnrgdoa-uc.a.run.app";

const categoriasContador = [
  "Guias e Impostos",
  "Boletos de Honorários",
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
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [clientes, setClientes] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  const [cnpjCliente, setCnpjCliente] = useState("");

  const [clienteDestino, setClienteDestino] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categoria, setCategoria] = useState("Fiscal");
  const [informe, setInforme] = useState("");

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) carregarDados();
    });
  }, []);

  async function carregarDados() {
    const clientesSnap = await getDocs(collection(db, "clientes"));
    setClientes(clientesSnap.docs.map((d) => d.data()));

    const docsSnap = await getDocs(collection(db, "documentos"));
    setDocs(docsSnap.docs.map((d) => d.data()));
  }

  async function enviarAvisoEmail(dados: { email: string; nome: string; arquivo: string }) {
    try {
      await fetch(URL_EMAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
    } catch (erro) {
      console.warn("Falha ao enviar aviso:", erro);
    }
  }

  async function login() {
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch {
      alert("Erro no login. Confira e-mail e senha.");
    }
  }

  async function sair() {
    await signOut(auth);
  }

  async function cadastrarCliente() {
    if (!nomeEmpresa || !emailCliente) {
      alert("Informe nome da empresa e e-mail.");
      return;
    }

    await addDoc(collection(db, "clientes"), {
      nomeEmpresa,
      email: emailCliente,
      cnpj: cnpjCliente,
      criadoEm: new Date(),
    });

    alert("Cliente cadastrado!");
    setNomeEmpresa("");
    setEmailCliente("");
    setCnpjCliente("");
    await carregarDados();
  }

  async function enviarDocumento() {
    try {
      if (!file || !user) {
        alert("Selecione um arquivo.");
        return;
      }

      const isContador = user.email === EMAIL_CONTADOR;
      const destino = isContador ? clienteDestino : user.email;

      if (isContador && !clienteDestino) {
        alert("Selecione um cliente.");
        return;
      }

      const agora = new Date();
      const ano = agora.getFullYear();
      const mesNumero = String(agora.getMonth() + 1).padStart(2, "0");
      const mesNome = agora.toLocaleString("pt-BR", { month: "long" });
      const mesReferencia = `${ano}-${mesNumero}`;
      const nomeArquivo = `${Date.now()}-${file.name}`;

      const caminho = `clientes/${destino}/${categoria}/${ano}/${mesNumero}-${mesNome}/${nomeArquivo}`;

      await uploadBytes(ref(storage, caminho), file);

      await addDoc(collection(db, "documentos"), {
        emailCliente: destino,
        nome: file.name,
        departamento: categoria,
        caminho,
        tipo: isContador ? "contador_enviou" : "cliente_enviou",
        data: new Date(),
        ano,
        mes: mesNome,
        mesNumero,
        mesReferencia,
        enviadoPor: user.email,
      });

      await enviarAvisoEmail({
        email: isContador ? destino : EMAIL_AVISO_CONTADOR,
        nome: isContador ? destino : user.email,
        arquivo: file.name,
      });

      alert("Documento enviado!");
      setFile(null);
      await carregarDados();
    } catch (erro) {
      console.error(erro);
      alert("Erro ao enviar documento.");
    }
  }

  async function enviarInforme() {
    try {
      if (!clienteDestino || !informe) {
        alert("Selecione o cliente e escreva o informe.");
        return;
      }

      const agora = new Date();

      await addDoc(collection(db, "documentos"), {
        emailCliente: clienteDestino,
        nome: informe,
        departamento: "Informes",
        tipo: "informe",
        caminho: "",
        data: new Date(),
        ano: agora.getFullYear(),
        mes: agora.toLocaleString("pt-BR", { month: "long" }),
        mesNumero: String(agora.getMonth() + 1).padStart(2, "0"),
      });

      await enviarAvisoEmail({
        email: clienteDestino,
        nome: clienteDestino,
        arquivo: "Novo informativo disponível no portal",
      });

      alert("Informe enviado!");
      setInforme("");
      await carregarDados();
    } catch (erro) {
      console.error(erro);
      alert("Erro ao enviar informativo.");
    }
  }

  if (!user) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <img src={logo} style={styles.loginLogo} />
          <h1 style={styles.loginTitle}>Portal do Cliente</h1>
          <p style={styles.loginText}>Pitágoras Contabilidade</p>

          <input style={styles.input} placeholder="E-mail" onChange={(e) => setEmail(e.target.value)} />
          <input style={styles.input} type="password" placeholder="Senha" onChange={(e) => setSenha(e.target.value)} />

          <button style={styles.primaryButton} onClick={login}>Entrar</button>
        </div>
      </div>
    );
  }

  const isContador = user.email === EMAIL_CONTADOR;

  const empresa = isContador
    ? "Pitágoras Contabilidade"
    : clientes.find((c) => c.email === user.email)?.nomeEmpresa || user.email;

  const documentosDoCliente = docs.filter((d) => d.emailCliente === user.email);

  const informativos = documentosDoCliente.filter((d) => d.departamento === "Informes" || d.tipo === "informe");
  const boletos = documentosDoCliente.filter((d) => d.departamento === "Boletos de Honorários");

  const cnds = documentosDoCliente.filter((d) =>
    ["CND Federal", "CND Estadual", "CND Municipal", "CND FGTS"].includes(d.departamento)
  );

  const documentosRecebidos = documentosDoCliente.filter(
    (d) =>
      d.tipo === "contador_enviou" &&
      !["Informes", "Boletos de Honorários", "CND Federal", "CND Estadual", "CND Municipal", "CND FGTS"].includes(d.departamento)
  );

  const documentosContador = docs.filter((d) => d.departamento === categoria);

  const totalDocumentos = isContador ? docs.length : documentosDoCliente.length;
  const totalBoletos = boletos.length;
  const totalCnds = cnds.length;
  const totalPendentes = isContador ? clientes.length : documentosRecebidos.length;

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoBox}>
          <img src={logo} style={styles.sideLogo} />
        </div>

        <div style={styles.menu}>
          <button style={styles.menuActive}>🏠 Dashboard</button>

          {isContador ? (
            categoriasContador.map((item) => (
              <button
                key={item}
                onClick={() => setCategoria(item)}
                style={categoria === item ? styles.menuActive : styles.menuItem}
              >
                📁 {item}
              </button>
            ))
          ) : (
            <>
              <button style={styles.menuItem}>📄 Documentos</button>
              <button style={styles.menuItem}>💳 Boletos</button>
              <button style={styles.menuItem}>✅ CNDs</button>
              <button style={styles.menuItem}>🔔 Informativos</button>
            </>
          )}
        </div>

        <button style={styles.exitButton} onClick={sair}>↪ Sair da conta</button>
      </aside>

      <main style={styles.content}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.welcome}>
              {isContador ? "Painel do Contador" : `Olá, ${empresa}`}
            </h1>
            <p style={styles.subWelcome}>
              {isContador
                ? "Gerencie clientes, documentos, boletos, CNDs e informativos."
                : "Bem-vindo ao Portal do Cliente Pitágoras Contabilidade."}
            </p>
          </div>

          <div style={styles.profileBox}>
            <div style={styles.bell}>🔔</div>
            <div style={styles.profile}>
              <strong>{empresa}</strong>
              <span>{isContador ? "Contador" : "Cliente"}</span>
            </div>
          </div>
        </header>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.iconPurple}>📁</div>
            <div>
              <p style={styles.statLabel}>Documentos</p>
              <h2 style={styles.statNumber}>{totalDocumentos}</h2>
              <span style={styles.statPurple}>Total de documentos</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.iconBlue}>💳</div>
            <div>
              <p style={styles.statLabel}>Boletos</p>
              <h2 style={styles.statNumber}>{totalBoletos}</h2>
              <span style={styles.statBlue}>Honorários</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.iconGreen}>✅</div>
            <div>
              <p style={styles.statLabel}>CNDs</p>
              <h2 style={styles.statNumber}>{totalCnds}</h2>
              <span style={styles.statGreen}>Certidões disponíveis</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.iconOrange}>⏱</div>
            <div>
              <p style={styles.statLabel}>Pendentes</p>
              <h2 style={styles.statNumber}>{totalPendentes}</h2>
              <span style={styles.statOrange}>Aguardando ação</span>
            </div>
          </div>
        </section>

        {!isContador ? (
          <section style={styles.mainGrid}>
            <div style={styles.bigCard}>
              <h2 style={styles.cardTitle}>Documentos Recebidos</h2>

              {documentosRecebidos.length === 0 ? (
                <p style={styles.empty}>Nenhum documento recebido.</p>
              ) : (
                documentosRecebidos.map((item, i) => (
                  <div key={i} style={styles.docItem}>
                    <div>
                      <strong>{item.nome}</strong>
                      <p style={styles.muted}>{item.departamento}</p>
                    </div>

                    {item.caminho && (
                      <button
                        style={styles.downloadButton}
                        onClick={async () => {
                          const url = await getDownloadURL(ref(storage, item.caminho));
                          window.open(url, "_blank");
                        }}
                      >
                        Baixar
                      </button>
                    )}
                  </div>
                ))
              )}

              <div style={styles.uploadBox}>
                <h3>Enviar Documento ao Escritório</h3>

                <select style={styles.input} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option>Fiscal</option>
                  <option>Contábil</option>
                  <option>Pessoal</option>
                  <option>Contratos</option>
                </select>

                <input style={styles.input} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button style={styles.primaryButton} onClick={enviarDocumento}>Enviar Documento</button>
              </div>
            </div>

            <div style={styles.sideCards}>
              <div style={styles.bigCard}>
                <h2 style={styles.cardTitle}>Informativos</h2>
                {informativos.length === 0 ? (
                  <p style={styles.empty}>Nenhum informativo disponível.</p>
                ) : (
                  informativos.map((item, i) => (
                    <div key={i} style={styles.infoItem}>{item.nome}</div>
                  ))
                )}
              </div>

              <div style={styles.bigCard}>
                <h2 style={styles.cardTitle}>Boletos de Honorários</h2>
                {boletos.length === 0 ? (
                  <p style={styles.empty}>Nenhum boleto disponível.</p>
                ) : (
                  boletos.map((item, i) => (
                    <div key={i} style={styles.docItem}>
                      <strong>{item.nome}</strong>
                      {item.caminho && (
                        <button
                          style={styles.downloadButton}
                          onClick={async () => {
                            const url = await getDownloadURL(ref(storage, item.caminho));
                            window.open(url, "_blank");
                          }}
                        >
                          Visualizar
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div style={styles.bigCard}>
                <h2 style={styles.cardTitle}>CNDs Disponíveis</h2>
                {cnds.length === 0 ? (
                  <p style={styles.empty}>Nenhuma CND disponível.</p>
                ) : (
                  cnds.map((item, i) => (
                    <div key={i} style={styles.docItem}>
                      <div>
                        <strong>{item.departamento}</strong>
                        <p style={styles.muted}>{item.nome}</p>
                      </div>
                      {item.caminho && (
                        <button
                          style={styles.downloadButton}
                          onClick={async () => {
                            const url = await getDownloadURL(ref(storage, item.caminho));
                            window.open(url, "_blank");
                          }}
                        >
                          Abrir
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : (
          <section style={styles.mainGrid}>
            <div style={styles.bigCard}>
              <h2 style={styles.cardTitle}>Enviar Documento ao Cliente</h2>

              <select style={styles.input} value={clienteDestino} onChange={(e) => setClienteDestino(e.target.value)}>
                <option value="">Selecione o cliente</option>
                {clientes.map((cliente, i) => (
                  <option key={i} value={cliente.email}>
                    {cliente.nomeEmpresa} - {cliente.email}
                  </option>
                ))}
              </select>

              <select style={styles.input} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {categoriasContador.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <input style={styles.input} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button style={styles.primaryButton} onClick={enviarDocumento}>Enviar Documento</button>

              <hr style={styles.separator} />

              <h2 style={styles.cardTitle}>Documentos Organizados</h2>

              {clientes.map((cliente, i) => {
                const docsCliente = documentosContador.filter((d) => d.emailCliente === cliente.email);
                if (docsCliente.length === 0) return null;

                const anos = [...new Set(docsCliente.map((d) => d.ano || "Sem ano"))];

                return (
                  <div key={i} style={styles.clientBlock}>
                    <h3 style={styles.clientTitle}>{cliente.nomeEmpresa}</h3>
                    <p style={styles.muted}>{cliente.email}</p>

                    {anos.map((ano: any, ai: number) => {
                      const docsAno = docsCliente.filter((d) => (d.ano || "Sem ano") === ano);
                      const meses = [...new Set(docsAno.map((d) => d.mes || "Sem mês"))];

                      return (
                        <div key={ai} style={styles.yearBlock}>
                          <h4 style={styles.yearTitle}>{ano}</h4>

                          {meses.map((mes: any, mi: number) => {
                            const docsMes = docsAno.filter((d) => (d.mes || "Sem mês") === mes);

                            return (
                              <div key={mi} style={styles.monthBlock}>
                                <h5 style={styles.monthTitle}>{mes}</h5>

                                {docsMes.map((item: any, di: number) => (
                                  <div key={di} style={styles.docItem}>
                                    <div>
                                      <strong>{item.nome}</strong>
                                      <p style={styles.muted}>{item.departamento}</p>
                                    </div>

                                    {item.caminho && (
                                      <button
                                        style={styles.downloadButton}
                                        onClick={async () => {
                                          const url = await getDownloadURL(ref(storage, item.caminho));
                                          window.open(url, "_blank");
                                        }}
                                      >
                                        Abrir
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div style={styles.sideCards}>
              <div style={styles.bigCard}>
                <h2 style={styles.cardTitle}>Cadastrar Cliente</h2>

                <input style={styles.input} placeholder="Nome/Razão Social" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} />
                <input style={styles.input} placeholder="E-mail do cliente" value={emailCliente} onChange={(e) => setEmailCliente(e.target.value)} />
                <input style={styles.input} placeholder="CNPJ/CPF" value={cnpjCliente} onChange={(e) => setCnpjCliente(e.target.value)} />

                <button style={styles.primaryButton} onClick={cadastrarCliente}>Cadastrar Cliente</button>
              </div>

              <div style={styles.bigCard}>
                <h2 style={styles.cardTitle}>Clientes Cadastrados</h2>

                {clientes.length === 0 ? (
                  <p style={styles.empty}>Nenhum cliente cadastrado.</p>
                ) : (
                  clientes.map((cliente, i) => (
                    <div key={i} style={styles.docItem}>
                      <div>
                        <strong>{cliente.nomeEmpresa}</strong>
                        <p style={styles.muted}>{cliente.email}</p>
                        <p style={styles.muted}>{cliente.cnpj}</p>
                      </div>
                      <button style={styles.downloadButton} onClick={() => setClienteDestino(cliente.email)}>
                        Selecionar
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div style={styles.bigCard}>
                <h2 style={styles.cardTitle}>Criar Informativo</h2>

                <select style={styles.input} value={clienteDestino} onChange={(e) => setClienteDestino(e.target.value)}>
                  <option value="">Selecione o cliente</option>
                  {clientes.map((cliente, i) => (
                    <option key={i} value={cliente.email}>{cliente.nomeEmpresa}</option>
                  ))}
                </select>

                <textarea
                  style={{ ...styles.input, height: 120 }}
                  placeholder="Digite o informativo"
                  value={informe}
                  onChange={(e) => setInforme(e.target.value)}
                />

                <button style={styles.primaryButton} onClick={enviarInforme}>Enviar Informativo</button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const styles: any = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    display: "flex",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#0f172a",
  },

  loginPage: {
    minHeight: "100vh",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Inter, Arial",
  },

  loginCard: {
    width: 430,
    background: "#fff",
    padding: 40,
    borderRadius: 28,
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(15,23,42,.10)",
    border: "1px solid #e5e7eb",
  },

  loginLogo: {
    width: 250,
    marginBottom: 20,
  },

  loginTitle: {
    margin: 0,
    fontSize: 32,
    color: "#0f172a",
  },

  loginText: {
    color: "#64748b",
    marginBottom: 28,
  },

  sidebar: {
    width: 290,
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    minHeight: "100vh",
    padding: 24,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
  },

  logoBox: {
    textAlign: "center",
    marginBottom: 35,
  },

  sideLogo: {
    width: 190,
  },

  menu: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  menuItem: {
    border: "none",
    background: "transparent",
    padding: "14px 16px",
    borderRadius: 14,
    textAlign: "left",
    fontWeight: 600,
    color: "#334155",
    cursor: "pointer",
    fontSize: 15,
  },

  menuActive: {
    border: "none",
    background: "linear-gradient(135deg,#ede9fe,#f3e8ff)",
    padding: "14px 16px",
    borderRadius: 14,
    textAlign: "left",
    fontWeight: 700,
    color: "#6d28d9",
    cursor: "pointer",
    fontSize: 15,
  },

  exitButton: {
    marginTop: "auto",
    border: "none",
    background: "transparent",
    color: "#ef4444",
    fontWeight: 700,
    textAlign: "left",
    cursor: "pointer",
    fontSize: 15,
  },

  content: {
    flex: 1,
    padding: 32,
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },

  welcome: {
    fontSize: 34,
    margin: 0,
    fontWeight: 800,
  },

  subWelcome: {
    color: "#64748b",
    marginTop: 8,
  },

  profileBox: {
    display: "flex",
    alignItems: "center",
    gap: 15,
  },

  bell: {
    width: 54,
    height: 54,
    background: "#fff",
    borderRadius: 16,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 10px 30px rgba(15,23,42,.08)",
  },

  profile: {
    background: "#fff",
    padding: "12px 18px",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(15,23,42,.08)",
    display: "flex",
    flexDirection: "column",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 20,
    marginBottom: 25,
  },

  statCard: {
    background: "#fff",
    borderRadius: 24,
    padding: 24,
    display: "flex",
    alignItems: "center",
    gap: 20,
    boxShadow: "0 12px 35px rgba(15,23,42,.07)",
    border: "1px solid #e5e7eb",
  },

  iconPurple: {
    width: 62,
    height: 62,
    borderRadius: 22,
    background: "#ede9fe",
    color: "#7c3aed",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 28,
  },

  iconBlue: {
    width: 62,
    height: 62,
    borderRadius: 22,
    background: "#dbeafe",
    color: "#2563eb",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 28,
  },

  iconGreen: {
    width: 62,
    height: 62,
    borderRadius: 22,
    background: "#dcfce7",
    color: "#16a34a",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 28,
  },

  iconOrange: {
    width: 62,
    height: 62,
    borderRadius: 22,
    background: "#ffedd5",
    color: "#f97316",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 28,
  },

  statLabel: {
    margin: 0,
    color: "#475569",
  },

  statNumber: {
    fontSize: 32,
    margin: "4px 0",
  },

  statPurple: { color: "#7c3aed", fontSize: 13 },
  statBlue: { color: "#2563eb", fontSize: 13 },
  statGreen: { color: "#16a34a", fontSize: 13 },
  statOrange: { color: "#f97316", fontSize: 13 },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr .9fr",
    gap: 24,
  },

  sideCards: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },

  bigCard: {
    background: "#fff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 35px rgba(15,23,42,.07)",
    border: "1px solid #e5e7eb",
  },

  cardTitle: {
    marginTop: 0,
    fontSize: 22,
    fontWeight: 800,
  },

  input: {
    width: "100%",
    padding: "14px 15px",
    marginBottom: 14,
    borderRadius: 14,
    border: "1px solid #dbe4ee",
    fontSize: 15,
    boxSizing: "border-box",
    outline: "none",
    background: "#fff",
  },

  primaryButton: {
    width: "100%",
    padding: 15,
    border: "none",
    borderRadius: 14,
    background: "#7c3aed",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },

  downloadButton: {
    border: "1px solid #ddd6fe",
    borderRadius: 12,
    padding: "9px 14px",
    background: "#fff",
    color: "#7c3aed",
    fontWeight: 700,
    cursor: "pointer",
  },

  docItem: {
    background: "#fff",
    borderBottom: "1px solid #eef2f7",
    padding: "15px 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
  },

  uploadBox: {
    marginTop: 25,
    padding: 22,
    borderRadius: 20,
    border: "2px dashed #c4b5fd",
    background: "#faf5ff",
  },

  infoItem: {
    background: "#faf5ff",
    color: "#4c1d95",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    fontWeight: 600,
  },

  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
  },

  empty: {
    background: "#f8fafc",
    color: "#64748b",
    padding: 16,
    borderRadius: 16,
  },

  separator: {
    border: "none",
    borderTop: "1px solid #e5e7eb",
    margin: "28px 0",
  },

  clientBlock: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },

  clientTitle: {
    margin: "0 0 4px",
    color: "#6d28d9",
  },

  yearBlock: {
    marginLeft: 12,
    marginTop: 12,
  },

  yearTitle: {
    color: "#2563eb",
    marginBottom: 10,
  },

  monthBlock: {
    marginLeft: 14,
    marginBottom: 14,
  },

  monthTitle: {
    textTransform: "capitalize",
    color: "#334155",
    marginBottom: 10,
  },
};