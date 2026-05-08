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
  const [categoria, setCategoria] = useState("Guias e Impostos");
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

  async function enviarAvisoEmail(dados: {
    email: string;
    nome: string;
    arquivo: string;
  }) {
    try {
      await fetch(URL_EMAIL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });
    } catch (erro) {
      console.warn("Falha ao enviar e-mail de aviso:", erro);
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
          <p style={styles.loginText}>Acesse seus documentos, boletos, CNDs e informativos.</p>

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

  return (
    <div style={styles.app}>
      <header style={styles.topHeader}>
        <div style={styles.brandArea}>
          <img src={logo} style={styles.headerLogo} />
          <div>
            <h1 style={styles.title}>{isContador ? "Painel do Contador" : "Portal do Cliente"}</h1>
            <p style={styles.subtitle}>Empresa logada: <strong>{empresa}</strong></p>
          </div>
        </div>

        <button style={styles.logoutButton} onClick={sair}>Sair</button>
      </header>

      {isContador && (
        <nav style={styles.topMenu}>
          {categoriasContador.map((item) => (
            <button
              key={item}
              onClick={() => setCategoria(item)}
              style={{
                ...styles.menuButton,
                background: categoria === item ? "#0f3d75" : "#ffffff",
                color: categoria === item ? "#ffffff" : "#0f3d75",
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      )}

      <main style={styles.main}>
        {!isContador ? (
          <>
            <section style={styles.hero}>
              <h2 style={{ margin: 0 }}>Bem-vindo ao seu portal</h2>
              <p style={{ marginTop: 8 }}>
                Aqui você acompanha seus boletos, CNDs, informativos e documentos enviados pelo escritório.
              </p>
            </section>

            <section style={styles.grid}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Informativos do Escritório</h3>
                {informativos.length === 0 ? (
                  <p style={styles.empty}>Nenhum informativo disponível.</p>
                ) : (
                  informativos.map((item, i) => (
                    <div key={i} style={styles.item}>
                      <strong>{item.nome}</strong>
                    </div>
                  ))
                )}
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Boletos de Honorários</h3>
                {boletos.length === 0 ? (
                  <p style={styles.empty}>Nenhum boleto disponível.</p>
                ) : (
                  boletos.map((item, i) => (
                    <div key={i} style={styles.item}>
                      <strong>{item.nome}</strong>
                      {item.caminho && (
                        <button
                          style={styles.smallButton}
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

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>CNDs Disponíveis</h3>
                {cnds.length === 0 ? (
                  <p style={styles.empty}>Nenhuma CND disponível.</p>
                ) : (
                  cnds.map((item, i) => (
                    <div key={i} style={styles.item}>
                      <div>
                        <strong>{item.departamento}</strong>
                        <p style={styles.muted}>{item.nome}</p>
                      </div>
                      {item.caminho && (
                        <button
                          style={styles.smallButton}
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

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Documentos Recebidos</h3>
                {documentosRecebidos.length === 0 ? (
                  <p style={styles.empty}>Nenhum documento recebido.</p>
                ) : (
                  documentosRecebidos.map((item, i) => (
                    <div key={i} style={styles.item}>
                      <div>
                        <strong>{item.nome}</strong>
                        <p style={styles.muted}>{item.departamento}</p>
                      </div>
                      {item.caminho && (
                        <button
                          style={styles.smallButton}
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
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Enviar Documento ao Escritório</h3>

                <select style={styles.input} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option>Fiscal</option>
                  <option>Contábil</option>
                  <option>Pessoal</option>
                  <option>Contratos</option>
                </select>

                <input style={styles.input} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />

                <button style={styles.primaryButton} onClick={enviarDocumento}>Enviar Documento</button>
              </div>
            </section>
          </>
        ) : (
          <>
            <section style={styles.hero}>
              <h2 style={{ margin: 0 }}>{categoria}</h2>
              <p style={{ marginTop: 8 }}>
                Envie documentos, boletos, CNDs, guias e informativos para seus clientes.
              </p>
            </section>

            <section style={styles.grid}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Cadastrar Cliente</h3>

                <input style={styles.input} placeholder="Nome/Razão Social" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} />
                <input style={styles.input} placeholder="E-mail do cliente" value={emailCliente} onChange={(e) => setEmailCliente(e.target.value)} />
                <input style={styles.input} placeholder="CNPJ/CPF" value={cnpjCliente} onChange={(e) => setCnpjCliente(e.target.value)} />

                <button style={styles.primaryButton} onClick={cadastrarCliente}>Cadastrar Cliente</button>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Clientes Cadastrados</h3>

                {clientes.length === 0 ? (
                  <p style={styles.empty}>Nenhum cliente cadastrado.</p>
                ) : (
                  clientes.map((cliente, i) => (
                    <div key={i} style={styles.item}>
                      <div>
                        <strong>{cliente.nomeEmpresa}</strong>
                        <p style={styles.muted}>{cliente.email}</p>
                        <p style={styles.muted}>{cliente.cnpj}</p>
                      </div>
                      <button style={styles.smallButton} onClick={() => setClienteDestino(cliente.email)}>
                        Selecionar
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Enviar Documento ao Cliente</h3>

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
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Criar Informativo</h3>

                <select style={styles.input} value={clienteDestino} onChange={(e) => setClienteDestino(e.target.value)}>
                  <option value="">Selecione o cliente</option>
                  {clientes.map((cliente, i) => (
                    <option key={i} value={cliente.email}>
                      {cliente.nomeEmpresa}
                    </option>
                  ))}
                </select>

                <textarea
                  style={{ ...styles.input, height: 110 }}
                  placeholder="Digite o informativo para o cliente"
                  value={informe}
                  onChange={(e) => setInforme(e.target.value)}
                />

                <button style={styles.primaryButton} onClick={enviarInforme}>Enviar Informativo</button>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Documentos Organizados</h3>

                {clientes.map((cliente, i) => {
                  const docsCliente = documentosContador.filter(
                    (d) => d.emailCliente === cliente.email
                  );

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
                                    <div key={di} style={styles.item}>
                                      <div>
                                        <strong>{item.nome}</strong>
                                        <p style={styles.muted}>{item.departamento}</p>
                                      </div>

                                      {item.caminho && (
                                        <button
                                          style={styles.smallButton}
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
            </section>
          </>
        )}
      </main>
    </div>
  );
}

const styles: any = {
  loginPage: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eef5ff, #ffffff)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial",
  },
  loginCard: {
    width: 420,
    background: "#fff",
    padding: 36,
    borderRadius: 28,
    textAlign: "center",
    boxShadow: "0 25px 70px rgba(15,61,117,.18)",
  },
  loginLogo: {
    width: 260,
    marginBottom: 20,
  },
  loginTitle: {
    color: "#0f3d75",
    margin: 0,
  },
  loginText: {
    color: "#667085",
    marginBottom: 25,
  },
  app: {
    minHeight: "100vh",
    background: "#f3f7fb",
    fontFamily: "Arial",
  },
  topHeader: {
    background: "#ffffff",
    padding: "18px 34px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 8px 30px rgba(16,32,51,.08)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  brandArea: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },
  headerLogo: {
    width: 150,
    maxHeight: 70,
    objectFit: "contain",
  },
  title: {
    margin: 0,
    color: "#111827",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#667085",
  },
  logoutButton: {
    border: "none",
    borderRadius: 14,
    padding: "11px 18px",
    background: "#0f3d75",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },
  topMenu: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    padding: "18px 34px",
    background: "#eaf2fb",
  },
  menuButton: {
    border: "none",
    borderRadius: 14,
    padding: "11px 16px",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(16,32,51,.06)",
  },
  main: {
    padding: 34,
  },
  hero: {
    background: "linear-gradient(135deg, #0f3d75, #1976d2)",
    color: "#fff",
    padding: 30,
    borderRadius: 28,
    marginBottom: 24,
    boxShadow: "0 20px 50px rgba(15,61,117,.2)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(340px, 1fr))",
    gap: 22,
  },
  card: {
    background: "#fff",
    padding: 24,
    borderRadius: 24,
    boxShadow: "0 12px 35px rgba(16,32,51,.08)",
  },
  cardTitle: {
    marginTop: 0,
    color: "#111827",
  },
  input: {
    width: "100%",
    padding: "14px 15px",
    marginBottom: 14,
    borderRadius: 14,
    border: "1px solid #d9e3ef",
    fontSize: 15,
    boxSizing: "border-box",
    background: "#fff",
  },
  primaryButton: {
    width: "100%",
    padding: 14,
    border: "none",
    borderRadius: 14,
    background: "#0f3d75",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },
  smallButton: {
    border: "none",
    borderRadius: 12,
    padding: "9px 14px",
    background: "#0f3d75",
    color: "#fff",
    cursor: "pointer",
  },
  item: {
    background: "#f8fbff",
    border: "1px solid #edf2f7",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 15,
    alignItems: "center",
  },
  muted: {
    margin: 0,
    color: "#667085",
    fontSize: 13,
  },
  empty: {
    background: "#f8fbff",
    color: "#667085",
    padding: 15,
    borderRadius: 14,
  },
  clientBlock: {
    background: "#f8fbff",
    border: "1px solid #edf2f7",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  clientTitle: {
    margin: "0 0 4px",
    color: "#0f3d75",
  },
  yearBlock: {
    marginLeft: 12,
    marginTop: 12,
  },
  yearTitle: {
    color: "#1976d2",
    marginBottom: 10,
  },
  monthBlock: {
    marginLeft: 14,
    marginBottom: 14,
  },
  monthTitle: {
    textTransform: "capitalize",
    color: "#444",
    marginBottom: 10,
  },
};