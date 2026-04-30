import { useEffect, useState } from "react";
import { auth, db, storage } from "./firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

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
  const [departamento, setDepartamento] = useState("Guias e Impostos");
  const [aba, setAba] = useState("Guias e Impostos");
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

  async function login() {
    await signInWithEmailAndPassword(auth, email, senha);
  }

  async function sair() {
    await signOut(auth);
  }

  async function cadastrarCliente() {
    await addDoc(collection(db, "clientes"), {
      nomeEmpresa,
      email: emailCliente,
      cnpj: cnpjCliente,
    });

    alert("Cliente cadastrado!");
    setNomeEmpresa("");
    setEmailCliente("");
    setCnpjCliente("");

    carregarDados();
  }

  async function enviarDocumento() {
    if (!file || !user) return;

    const destino = isContador ? clienteDestino : user.email;

    const caminho = `clientes/${destino}/${departamento}/${file.name}`;

    await uploadBytes(ref(storage, caminho), file);

    await addDoc(collection(db, "documentos"), {
      emailCliente: destino,
      nome: file.name,
      departamento,
      caminho,
    });

    alert("Documento enviado!");
    carregarDados();
  }

  async function enviarInforme() {
    await addDoc(collection(db, "documentos"), {
      emailCliente: clienteDestino,
      nome: informe,
      departamento: "Informes",
      tipo: "texto",
    });

    alert("Informe enviado!");
    setInforme("");
    carregarDados();
  }

  if (!user) {
    return (
      <div style={styles.login}>
        <img src={logo} style={{ width: 200 }} />
        <h2>Portal do Cliente</h2>

        <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="Senha"
          type="password"
          onChange={(e) => setSenha(e.target.value)}
        />

        <button onClick={login}>Entrar</button>
      </div>
    );
  }

  const isContador = user.email === EMAIL_CONTADOR;

  const empresa = isContador
    ? "Pitágoras Contabilidade"
    : clientes.find((c) => c.email === user.email)?.nomeEmpresa ||
      user.email;

  const documentos = docs.filter(
    (d) =>
      (isContador || d.emailCliente === user.email) &&
      d.departamento === aba
  );

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <img src={logo} style={{ width: "100%", marginBottom: 20 }} />

        {pastas.map((p) => (
          <div key={p} onClick={() => setAba(p)} style={styles.menu}>
            📁 {p}
          </div>
        ))}

        <button onClick={sair}>Sair</button>
      </aside>

      <main style={styles.main}>
        <h1>{isContador ? "Painel do Contador" : "Portal do Cliente"}</h1>
        <h3>Empresa: {empresa}</h3>

        <div style={styles.cards}>
          {isContador && (
            <div style={styles.card}>
              <h3>Cadastrar Cliente</h3>

              <input
                placeholder="Nome"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
              />

              <input
                placeholder="Email"
                value={emailCliente}
                onChange={(e) => setEmailCliente(e.target.value)}
              />

              <input
                placeholder="CNPJ"
                value={cnpjCliente}
                onChange={(e) => setCnpjCliente(e.target.value)}
              />

              <button onClick={cadastrarCliente}>Cadastrar</button>
            </div>
          )}

          <div style={styles.card}>
            <h3>Documentos</h3>

            {documentos.map((d, i) => (
              <div key={i}>
                {d.nome}
                {d.caminho && (
                  <button
                    onClick={async () => {
                      const url = await getDownloadURL(
                        ref(storage, d.caminho)
                      );
                      window.open(url);
                    }}
                  >
                    Baixar
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <h3>Enviar Documento</h3>

            {isContador && (
              <select onChange={(e) => setClienteDestino(e.target.value)}>
                <option>Selecione</option>
                {clientes.map((c, i) => (
                  <option key={i} value={c.email}>
                    {c.nomeEmpresa}
                  </option>
                ))}
              </select>
            )}

            <select onChange={(e) => setDepartamento(e.target.value)}>
              {pastas.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>

            <input type="file" onChange={(e) => setFile(e.target.files![0])} />

            <button onClick={enviarDocumento}>Enviar</button>
          </div>

          {isContador && (
            <div style={styles.card}>
              <h3>Enviar Informe</h3>

              <select onChange={(e) => setClienteDestino(e.target.value)}>
                {clientes.map((c, i) => (
                  <option key={i} value={c.email}>
                    {c.nomeEmpresa}
                  </option>
                ))}
              </select>

              <textarea
                placeholder="Digite o informe"
                onChange={(e) => setInforme(e.target.value)}
              />

              <button onClick={enviarInforme}>Enviar</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: any = {
  login: {
    textAlign: "center",
    marginTop: 100,
  },
  container: {
    display: "flex",
  },
  sidebar: {
    width: 250,
    background: "#0f3d75",
    color: "#fff",
    padding: 20,
  },
  menu: {
    padding: 10,
    cursor: "pointer",
  },
  main: {
    flex: 1,
    padding: 20,
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 20,
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 10,
  },
};