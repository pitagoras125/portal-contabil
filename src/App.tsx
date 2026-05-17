import { useEffect, useState } from "react";
import { auth, db, storage } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import logo from "./assets/logo-pitagoras.png";

const EMAIL_CONTADOR = "contato@pitagorascontabilidade.com.br";
const EMAIL_AVISO_CONTADOR = "wesleytenesv@gmail.com";
const URL_EMAIL = "https://enviaremail-aa5vnrgdoa-uc.a.run.app";
const URL_BOLETO_ASAAS = "https://us-central1-portal-contabil-4c418.cloudfunctions.net/criarBoletoAsaas";
const URL_CRIAR_CLIENTE = "https://us-central1-portal-contabil-4c418.cloudfunctions.net/criarClienteComSenha";

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

type SecaoCliente = "documentos" | "boletos" | "cnds" | "informativos" | "envio";
type PaginaContador = "dashboard" | "clientes" | "documentos" | "integra" | "notas" | "assinaturas" | "configuracoes";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [clientes, setClientes] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [notificacoes, setNotificacoes] = useState<any[]>([]);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  const [cnpjCliente, setCnpjCliente] = useState("");
  const [senhaCliente, setSenhaCliente] = useState("");
  const [confirmarSenhaCliente, setConfirmarSenhaCliente] = useState("");
  const [criandoCliente, setCriandoCliente] = useState(false);

  const [clienteDestino, setClienteDestino] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categoria, setCategoria] = useState("Fiscal");
  const [informe, setInforme] = useState("");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");

  const [valorBoleto, setValorBoleto] = useState("");
  const [vencimentoBoleto, setVencimentoBoleto] = useState("");
  const [descricaoBoleto, setDescricaoBoleto] = useState("Honorários contábeis");
  const [emitindoBoleto, setEmitindoBoleto] = useState(false);

  const [secaoCliente, setSecaoCliente] = useState<SecaoCliente>("documentos");
  const [paginaContador, setPaginaContador] = useState<PaginaContador>("dashboard");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuario) => {
      setUser(usuario);
      if (usuario) carregarDados(usuario);
    });

    return () => unsubscribe();
  }, []);

  function dataMillis(item: any) {
    const valor = item?.data || item?.criadoEm;
    if (!valor) return 0;
    if (typeof valor.toMillis === "function") return valor.toMillis();
    if (valor.seconds) return valor.seconds * 1000;
    const convertido = new Date(valor).getTime();
    return Number.isNaN(convertido) ? 0 : convertido;
  }

  function ordenarMaisNovos(lista: any[]) {
    return [...lista].sort((a, b) => dataMillis(b) - dataMillis(a));
  }

  async function carregarDados(usuarioAtual = user) {
    if (!usuarioAtual) return;

    const isContadorAtual = usuarioAtual.email === EMAIL_CONTADOR;

    if (isContadorAtual) {
      const clientesSnap = await getDocs(collection(db, "clientes"));
      setClientes(clientesSnap.docs.map((d) => d.data()));
    } else {
      const qClientes = query(collection(db, "clientes"), where("email", "==", usuarioAtual.email));
      const clientesSnap = await getDocs(qClientes);
      setClientes(clientesSnap.docs.map((d) => d.data()));
    }

    const qDocs = isContadorAtual
      ? collection(db, "documentos")
      : query(collection(db, "documentos"), where("emailCliente", "==", usuarioAtual.email));

    const docsSnap = await getDocs(qDocs);
    setDocs(ordenarMaisNovos(docsSnap.docs.map((d) => d.data())));

    const qNotif = isContadorAtual
      ? collection(db, "notificacoes")
      : query(collection(db, "notificacoes"), where("destino", "==", usuarioAtual.email));

    const notifSnap = await getDocs(qNotif);
    setNotificacoes(
      ordenarMaisNovos(
        notifSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      )
    );
  }

  async function login() {
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (erro) {
      console.error(erro);
      alert("Erro no login. Confira e-mail e senha.");
    }
  }

  async function sair() {
    await signOut(auth);
    setUser(null);
  }

  async function enviarAvisoEmail(dados: { email: string; nome: string; arquivo: string }) {
    try {
      await fetch(URL_EMAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
    } catch (erro) {
      console.warn("Falha ao enviar aviso por e-mail:", erro);
    }
  }

  async function criarNotificacao(destino: string, titulo: string, mensagem: string) {
    await addDoc(collection(db, "notificacoes"), {
      destino,
      titulo,
      mensagem,
      lida: false,
      data: new Date(),
    });
  }

  async function marcarNotificacaoLida(id: string) {
    try {
      await updateDoc(doc(db, "notificacoes", id), { lida: true });
      await carregarDados();
    } catch (erro) {
      console.error(erro);
      alert("Erro ao marcar notificação como lida.");
    }
  }

  async function cadastrarCliente() {
    try {
      if (!nomeEmpresa || !emailCliente || !senhaCliente) {
        alert("Informe nome da empresa, e-mail e senha.");
        return;
      }

      if (senhaCliente !== confirmarSenhaCliente) {
        alert("As senhas não conferem.");
        return;
      }

      if (senhaCliente.length < 6) {
        alert("A senha precisa ter no mínimo 6 caracteres.");
        return;
      }

      setCriandoCliente(true);

      const resposta = await fetch(URL_CRIAR_CLIENTE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomeEmpresa,
          email: emailCliente,
          cnpj: cnpjCliente,
          senha: senhaCliente,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        console.error(dados);
        alert(dados.erro || "Erro ao criar cliente.");
        setCriandoCliente(false);
        return;
      }

      alert("Cliente cadastrado com login e senha!");

      setNomeEmpresa("");
      setEmailCliente("");
      setCnpjCliente("");
      setSenhaCliente("");
      setConfirmarSenhaCliente("");
      setCriandoCliente(false);

      await carregarDados();
    } catch (erro: any) {
      console.error(erro);
      alert("Erro ao cadastrar cliente.");
      setCriandoCliente(false);
    }
  }

  async function enviarDocumento() {
    try {
      if (!file || !user) {
        alert("Selecione um arquivo.");
        return;
      }

      setEnviando(true);
      setUploadProgress(0);

      const isContador = user.email === EMAIL_CONTADOR;
      const destino = isContador ? clienteDestino : user.email;

      if (isContador && !clienteDestino) {
        alert("Selecione um cliente.");
        setEnviando(false);
        return;
      }

      const agora = new Date();
      const ano = agora.getFullYear();
      const mesNumero = String(agora.getMonth() + 1).padStart(2, "0");
      const mesNome = agora.toLocaleString("pt-BR", { month: "long" });
      const mesReferencia = `${ano}-${mesNumero}`;
      const nomeArquivo = `${Date.now()}-${file.name}`;
      const caminho = `clientes/${destino}/${categoria}/${ano}/${mesNumero}-${mesNome}/${nomeArquivo}`;

      const uploadTask = uploadBytesResumable(ref(storage, caminho), file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progresso = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progresso));
        },
        (erro) => {
          console.error(erro);
          alert("Erro ao enviar documento.");
          setEnviando(false);
        },
        async () => {
          try {
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

            await criarNotificacao(
              isContador ? destino : EMAIL_CONTADOR,
              "Novo documento enviado",
              isContador
                ? `O escritório enviou um novo documento: ${file.name}`
                : `${user.email} enviou um documento em ${categoria}: ${file.name}`
            );

            enviarAvisoEmail({
              email: isContador ? destino : EMAIL_AVISO_CONTADOR,
              nome: isContador ? destino : user.email,
              arquivo: file.name,
            });

            alert("Documento enviado com sucesso!");
          } catch (erroFinal) {
            console.error(erroFinal);
            alert("O arquivo subiu, mas houve erro ao registrar no banco.");
          } finally {
            setUploadProgress(0);
            setEnviando(false);
            setFile(null);
            await carregarDados();
          }
        }
      );
    } catch (erro) {
      console.error(erro);
      alert("Erro ao enviar documento.");
      setEnviando(false);
    }
  }

  async function enviarInforme() {
    try {
      if (!clienteDestino || !informe) {
        alert("Selecione o cliente e escreva o informe.");
        return;
      }

      const agora = new Date();
      const ano = agora.getFullYear();
      const mesNumero = String(agora.getMonth() + 1).padStart(2, "0");

      await addDoc(collection(db, "documentos"), {
        emailCliente: clienteDestino,
        nome: informe,
        departamento: "Informes",
        tipo: "informe",
        caminho: "",
        data: new Date(),
        ano,
        mes: agora.toLocaleString("pt-BR", { month: "long" }),
        mesNumero,
        mesReferencia: `${ano}-${mesNumero}`,
      });

      await criarNotificacao(
        clienteDestino,
        "Novo informativo",
        "Você recebeu um novo informativo no portal."
      );

      enviarAvisoEmail({
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

  async function emitirBoletoAsaas() {
    try {
      if (!clienteDestino) {
        alert("Selecione um cliente.");
        return;
      }

      if (!valorBoleto || !vencimentoBoleto) {
        alert("Informe o valor e o vencimento do boleto.");
        return;
      }

      const cliente = clientes.find((c) => c.email === clienteDestino);

      if (!cliente) {
        alert("Cliente não encontrado.");
        return;
      }

      if (!cliente.cnpj) {
        alert("O cliente precisa ter CNPJ/CPF cadastrado.");
        return;
      }

      setEmitindoBoleto(true);

      const resposta = await fetch(URL_BOLETO_ASAAS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: cliente.nomeEmpresa || cliente.nome || "Cliente",
          email: cliente.email,
          cpfCnpj: cliente.cnpj,
          valor: String(valorBoleto).replace(",", "."),
          vencimento: vencimentoBoleto,
          descricao: descricaoBoleto || "Honorários contábeis",
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        console.error(dados);
        alert(JSON.stringify(dados));
        setEmitindoBoleto(false);
        return;
      }

      const agora = new Date();
      const ano = agora.getFullYear();
      const mesNumero = String(agora.getMonth() + 1).padStart(2, "0");
      const mesNome = agora.toLocaleString("pt-BR", { month: "long" });

      await addDoc(collection(db, "documentos"), {
        emailCliente: cliente.email,
        nome: descricaoBoleto || "Boleto de Honorários",
        departamento: "Boletos de Honorários",
        tipo: "boleto_asaas",
        caminho: "",
        boletoUrl: dados.boleto || "",
        invoiceUrl: dados.invoiceUrl || "",
        asaasId: dados.id || "",
        status: "PENDENTE",
        valor: Number(String(valorBoleto).replace(",", ".")),
        vencimento: vencimentoBoleto,
        data: new Date(),
        ano,
        mes: mesNome,
        mesNumero,
        mesReferencia: `${ano}-${mesNumero}`,
        enviadoPor: user.email,
      });

      await criarNotificacao(
        cliente.email,
        "Novo boleto disponível",
        `Um boleto de R$ ${valorBoleto} foi gerado com vencimento em ${vencimentoBoleto}.`
      );

      alert("Boleto emitido e salvo no portal do cliente!");

      if (dados.boleto || dados.invoiceUrl) {
        window.open(dados.boleto || dados.invoiceUrl, "_blank");
      }

      setValorBoleto("");
      setVencimentoBoleto("");
      setDescricaoBoleto("Honorários contábeis");
      setEmitindoBoleto(false);
      await carregarDados();
    } catch (erro: any) {
      console.error(erro);
      alert(JSON.stringify(erro));
      setEmitindoBoleto(false);
    }
  }

  async function abrirDocumentoOuLink(item: any) {
    if (item.boletoUrl || item.invoiceUrl) {
      window.open(item.boletoUrl || item.invoiceUrl, "_blank");
      return;
    }

    if (item.caminho) {
      const url = await getDownloadURL(ref(storage, item.caminho));
      window.open(url, "_blank");
    }
  }

  if (!user) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <img src={logo} style={styles.loginLogo} />
          <h1 style={styles.loginTitle}>Portal do Cliente</h1>
          <p style={styles.loginText}>Pitágoras Contabilidade</p>

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
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const isContador = user.email === EMAIL_CONTADOR;

  const empresa = isContador
    ? "Pitágoras Contabilidade"
    : clientes.find((c) => c.email === user.email)?.nomeEmpresa || user.email;

  const documentosDoCliente = ordenarMaisNovos(docs.filter((d) => d.emailCliente === user.email));

  const informativos = ordenarMaisNovos(
    documentosDoCliente.filter((d) => d.departamento === "Informes" || d.tipo === "informe")
  );

  const boletos = ordenarMaisNovos(
    documentosDoCliente.filter((d) => d.departamento === "Boletos de Honorários")
  );

  const cnds = ordenarMaisNovos(
    documentosDoCliente.filter((d) =>
      ["CND Federal", "CND Estadual", "CND Municipal", "CND FGTS"].includes(d.departamento)
    )
  );

  const documentosRecebidos = ordenarMaisNovos(
    documentosDoCliente.filter(
      (d) =>
        d.tipo === "contador_enviou" &&
        ![
          "Informes",
          "Boletos de Honorários",
          "CND Federal",
          "CND Estadual",
          "CND Municipal",
          "CND FGTS",
        ].includes(d.departamento)
    )
  );

  const notificacoesUsuario = ordenarMaisNovos(notificacoes.filter((n) => n.destino === user.email));
  const notificacoesNaoLidas = notificacoesUsuario.filter((n) => !n.lida).length;

  const documentosContador = ordenarMaisNovos(
    docs.filter((d) => {
      const categoriaOk = d.departamento === categoria;
      const buscaOk = (d.nome || "").toLowerCase().includes(busca.toLowerCase());
      const clienteOk = filtroCliente === "" ? true : d.emailCliente === filtroCliente;
      return categoriaOk && buscaOk && clienteOk;
    })
  );

  const totalDocumentos = isContador ? docs.length : documentosDoCliente.length;
  const totalBoletos = isContador
    ? docs.filter((d) => d.departamento === "Boletos de Honorários").length
    : boletos.length;
  const totalCnds = cnds.length;
  const totalPendentes = isContador ? clientes.length : documentosRecebidos.length;

  const NotificacoesCard = () => (
    <div style={styles.bigCard}>
      <h2 style={styles.cardTitle}>Avisos</h2>

      {notificacoesUsuario.length === 0 ? (
        <p style={styles.empty}>Nenhuma notificação.</p>
      ) : (
        notificacoesUsuario.slice(0, 8).map((item, i) => (
          <div
            key={i}
            style={{
              ...styles.notificationItem,
              background: item.lida ? "#fff" : "#f3e8ff",
            }}
            onClick={() => marcarNotificacaoLida(item.id)}
          >
            <strong>{item.titulo}</strong>
            <p style={styles.notificationText}>{item.mensagem}</p>
            {!item.lida && <span style={styles.unreadText}>Não lida</span>}
          </div>
        ))
      )}
    </div>
  );

  function renderListaCliente() {
    if (secaoCliente === "envio") {
      return (
        <div style={styles.bigCard}>
          <p style={styles.clientLabel}>Envio para o escritório</p>
          <h2 style={styles.cardTitle}>Enviar Documento</h2>

          <div style={styles.clientUploadPanel}>
            <select style={styles.input} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option>Fiscal</option>
              <option>Contábil</option>
              <option>Pessoal</option>
              <option>Contratos</option>
            </select>

            <input style={styles.input} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />

            <button style={styles.primaryButton} onClick={enviarDocumento} disabled={enviando}>
              {enviando ? `Enviando ${uploadProgress}%` : "Enviar para o Escritório"}
            </button>

            {enviando && (
              <div style={styles.loadingBar}>
                <div style={{ ...styles.loadingProgress, width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>
        </div>
      );
    }

    const configuracao: any = {
      documentos: {
        titulo: "Documentos Recebidos",
        subtitulo: "Documentos enviados pelo escritório",
        vazio: "Nenhum documento recebido até o momento.",
        lista: documentosRecebidos,
      },
      boletos: {
        titulo: "Boletos de Honorários",
        subtitulo: "Boletos enviados pelo escritório",
        vazio: "Nenhum boleto disponível.",
        lista: boletos,
      },
      cnds: {
        titulo: "CNDs Disponíveis",
        subtitulo: "Certidões disponíveis para consulta",
        vazio: "Nenhuma CND disponível.",
        lista: cnds,
      },
      informativos: {
        titulo: "Informativos",
        subtitulo: "Comunicados do escritório",
        vazio: "Nenhum informativo disponível.",
        lista: informativos,
      },
    };

    const dados = configuracao[secaoCliente];

    return (
      <div style={styles.bigCard}>
        <p style={styles.clientLabel}>{dados.subtitulo}</p>
        <h2 style={styles.cardTitle}>{dados.titulo}</h2>

        {dados.lista.length === 0 ? (
          <p style={styles.empty}>{dados.vazio}</p>
        ) : (
          dados.lista.map((item: any, i: number) => (
            <div key={i} style={styles.clientDocRow}>
              <div>
                <strong>{secaoCliente === "cnds" ? item.departamento : item.nome}</strong>
                {secaoCliente !== "informativos" && (
                  <p style={styles.muted}>
                    {item.departamento}
                    {item.mes ? ` • ${item.mes}` : ""}
                    {item.ano ? `/${item.ano}` : ""}
                  </p>
                )}
                {item.valor && <p style={styles.muted}>R$ {item.valor}</p>}
                {item.vencimento && <p style={styles.muted}>Vencimento: {item.vencimento}</p>}
              </div>

              {(item.caminho || item.boletoUrl || item.invoiceUrl) && (
                <button style={styles.downloadButton} onClick={() => abrirDocumentoOuLink(item)}>
                  Abrir
                </button>
              )}
            </div>
          ))
        )}
      </div>
    );
  }


  function renderPainelContador() {
    if (paginaContador === "dashboard") {
      return (
        <>
          <section style={styles.adminHero}>
            <div>
              <p style={styles.clientLabel}>Painel administrativo web</p>
              <h2 style={styles.clientHeroTitle}>Controle do Escritório</h2>
              <p style={styles.clientHeroText}>
                Visão geral dos clientes, documentos, avisos, buscas fiscais e integrações do portal.
              </p>
            </div>

            <div style={styles.adminHeroActions}>
              <button style={styles.primaryButton} onClick={() => setPaginaContador("clientes")}>
                + Novo Cliente
              </button>
              <button style={styles.secondaryButton} onClick={() => setPaginaContador("documentos")}>
                Enviar Documento
              </button>
            </div>
          </section>

          <section style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.iconPurple}>👥</div>
              <div>
                <p style={styles.statLabel}>Clientes</p>
                <h2 style={styles.statNumber}>{clientes.length}</h2>
                <span style={styles.statPurple}>Clientes cadastrados</span>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.iconBlue}>📁</div>
              <div>
                <p style={styles.statLabel}>Documentos</p>
                <h2 style={styles.statNumber}>{totalDocumentos}</h2>
                <span style={styles.statBlue}>Arquivos no portal</span>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.iconGreen}>💳</div>
              <div>
                <p style={styles.statLabel}>Boletos</p>
                <h2 style={styles.statNumber}>{totalBoletos}</h2>
                <span style={styles.statGreen}>Honorários</span>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.iconOrange}>🔔</div>
              <div>
                <p style={styles.statLabel}>Avisos</p>
                <h2 style={styles.statNumber}>{notificacoes.length}</h2>
                <span style={styles.statOrange}>Notificações internas</span>
              </div>
            </div>
          </section>

          <section style={styles.adminGrid}>
            <div style={styles.bigCard}>
              <h2 style={styles.cardTitle}>Atalhos Operacionais</h2>

              <div style={styles.adminShortcutGrid}>
                <button style={styles.adminShortcut} onClick={() => setPaginaContador("clientes")}>
                  <span>👥</span>
                  <strong>Clientes</strong>
                  <small>Cadastro, senha e dados fiscais</small>
                </button>

                <button style={styles.adminShortcut} onClick={() => setPaginaContador("documentos")}>
                  <span>📁</span>
                  <strong>Documentos</strong>
                  <small>Fiscal, contábil, pessoal e contratos</small>
                </button>

                <button style={styles.adminShortcut} onClick={() => setPaginaContador("integra")}>
                  <span>🧾</span>
                  <strong>Integra Contador</strong>
                  <small>MEI e Simples Nacional</small>
                </button>

                <button style={styles.adminShortcut} onClick={() => setPaginaContador("notas")}>
                  <span>🔎</span>
                  <strong>Buscador de Notas</strong>
                  <small>XML, PDF, Drive e rotina automática</small>
                </button>

                <button style={styles.adminShortcut} onClick={() => setPaginaContador("assinaturas")}>
                  <span>✍️</span>
                  <strong>Assinaturas</strong>
                  <small>Certificado digital e gov.br</small>
                </button>
              </div>
            </div>

            <NotificacoesCard />
          </section>
        </>
      );
    }

    if (paginaContador === "clientes") {
      return (
        <section style={styles.adminGrid}>
          <div style={styles.bigCard}>
            <h2 style={styles.cardTitle}>Cadastrar Cliente</h2>
            <p style={styles.muted}>
              Próxima função: criar o login automaticamente no Firebase Authentication com e-mail e senha.
            </p>

            <input style={styles.input} placeholder="Nome/Razão Social" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} />
            <input style={styles.input} placeholder="CNPJ/CPF" value={cnpjCliente} onChange={(e) => setCnpjCliente(e.target.value)} />
            <input style={styles.input} placeholder="E-mail do cliente" value={emailCliente} onChange={(e) => setEmailCliente(e.target.value)} />
            <input style={styles.input} type="password" placeholder="Senha de acesso do cliente" value={senhaCliente} onChange={(e) => setSenhaCliente(e.target.value)} />
            <input style={styles.input} type="password" placeholder="Confirmar senha" value={confirmarSenhaCliente} onChange={(e) => setConfirmarSenhaCliente(e.target.value)} />

            <button style={styles.primaryButton} onClick={cadastrarCliente} disabled={criandoCliente}>
              {criandoCliente ? "Criando cliente..." : "Cadastrar Cliente"}
            </button>
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
        </section>
      );
    }

    if (paginaContador === "documentos") {
      return (
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

            <button style={styles.primaryButton} onClick={enviarDocumento} disabled={enviando}>
              {enviando ? `Enviando ${uploadProgress}%` : "Enviar Documento"}
            </button>

            {enviando && (
              <div style={styles.loadingBar}>
                <div style={{ ...styles.loadingProgress, width: `${uploadProgress}%` }} />
              </div>
            )}

            <hr style={styles.separator} />

            <h2 style={styles.cardTitle}>Documentos Organizados</h2>

            <input style={styles.input} placeholder="Pesquisar documento..." value={busca} onChange={(e) => setBusca(e.target.value)} />

            <select style={styles.input} value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
              <option value="">Todos os clientes</option>
              {clientes.map((cliente, i) => (
                <option key={i} value={cliente.email}>{cliente.nomeEmpresa}</option>
              ))}
            </select>

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
                                    {item.valor && <p style={styles.muted}>R$ {item.valor}</p>}
                                    {item.vencimento && <p style={styles.muted}>Vencimento: {item.vencimento}</p>}
                                  </div>

                                  {(item.caminho || item.boletoUrl || item.invoiceUrl) && (
                                    <button style={styles.downloadButton} onClick={() => abrirDocumentoOuLink(item)}>
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
            <NotificacoesCard />

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

              <button style={styles.primaryButton} onClick={enviarInforme}>
                Enviar Informativo
              </button>
            </div>
          </div>
        </section>
      );
    }

    if (paginaContador === "integra") {
      return (
        <section style={styles.moduleGrid}>
          <div style={styles.bigCard}>
            <p style={styles.clientLabel}>Integra Contador</p>
            <h2 style={styles.cardTitle}>MEI</h2>
            <p style={styles.muted}>Área preparada para DAS MEI, parcelamentos, situação fiscal e pendências.</p>
            <button style={styles.secondaryButton}>Configurar Token do Cliente</button>
          </div>

          <div style={styles.bigCard}>
            <p style={styles.clientLabel}>Integra Contador</p>
            <h2 style={styles.cardTitle}>Simples Nacional</h2>
            <p style={styles.muted}>Área preparada para DAS, débitos, parcelamentos, PGDAS e consultas.</p>
            <button style={styles.secondaryButton}>Abrir Módulo Simples</button>
          </div>
        </section>
      );
    }

    if (paginaContador === "notas") {
      return (
        <section style={styles.moduleGrid}>
          <div style={styles.bigCard}>
            <p style={styles.clientLabel}>Buscador automático</p>
            <h2 style={styles.cardTitle}>Notas Fiscais</h2>
            <p style={styles.muted}>
              Rotina programada para buscar NF-e, NFC-e, CT-e, NFS-e e cupons fiscais às 12:00 e 21:00.
            </p>

            <div style={styles.configLine}><strong>Horários:</strong><span>12:00 e 21:00</span></div>
            <div style={styles.configLine}><strong>Armazenamento:</strong><span>Google Drive por cliente, ano e mês</span></div>
            <div style={styles.configLine}><strong>Formatos:</strong><span>XML e PDF/DANFE</span></div>
          </div>

          <div style={styles.bigCard}>
            <h2 style={styles.cardTitle}>Google Drive</h2>
            <p style={styles.muted}>Estrutura planejada: Cliente → Ano → Mês → Modelo da Nota.</p>
            <button style={styles.secondaryButton}>Conectar Google Drive</button>
          </div>
        </section>
      );
    }

    if (paginaContador === "assinaturas") {
      return (
        <section style={styles.moduleGrid}>
          <div style={styles.bigCard}>
            <p style={styles.clientLabel}>Assinaturas digitais</p>
            <h2 style={styles.cardTitle}>Enviar documento para assinatura</h2>

            <select style={styles.input}>
              <option>Selecione o cliente</option>
              {clientes.map((cliente, i) => (
                <option key={i}>{cliente.nomeEmpresa}</option>
              ))}
            </select>

            <input style={styles.input} type="file" />
            <button style={styles.primaryButton}>Preparar assinatura</button>
          </div>

          <div style={styles.bigCard}>
            <h2 style={styles.cardTitle}>Certificado e gov.br</h2>
            <p style={styles.muted}>
              Espaço reservado para certificado A1, assinatura do contador, assinatura do cliente e integração gov.br.
            </p>
            <input style={styles.input} type="file" />
            <button style={styles.secondaryButton}>Salvar Certificado</button>
          </div>
        </section>
      );
    }

    return (
      <section style={styles.moduleGrid}>
        <div style={styles.bigCard}>
          <h2 style={styles.cardTitle}>Configurações</h2>
          <p style={styles.muted}>Ambiente para parâmetros do escritório, APIs, tokens, e-mail, Drive e automações.</p>
        </div>

        <div style={styles.bigCard}>
          <h2 style={styles.cardTitle}>Segurança Multi Cliente</h2>
          <p style={styles.muted}>Regra principal: cada cliente só visualiza os próprios documentos, boletos e assinaturas.</p>
        </div>
      </section>
    );
  }


  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoBox}>
          <img src={logo} style={styles.sideLogo} />
        </div>

        <div style={styles.menu}>
          {isContador ? (
            <>
              <button onClick={() => setPaginaContador("dashboard")} style={paginaContador === "dashboard" ? styles.menuActive : styles.menuItem}>🏠 Dashboard</button>
              <button onClick={() => setPaginaContador("clientes")} style={paginaContador === "clientes" ? styles.menuActive : styles.menuItem}>👥 Clientes</button>
              <button onClick={() => setPaginaContador("documentos")} style={paginaContador === "documentos" ? styles.menuActive : styles.menuItem}>📁 Documentos</button>
              <button onClick={() => setPaginaContador("integra")} style={paginaContador === "integra" ? styles.menuActive : styles.menuItem}>🧾 Integra Contador</button>
              <button onClick={() => setPaginaContador("notas")} style={paginaContador === "notas" ? styles.menuActive : styles.menuItem}>🔎 Buscador de Notas</button>
              <button onClick={() => setPaginaContador("assinaturas")} style={paginaContador === "assinaturas" ? styles.menuActive : styles.menuItem}>✍️ Assinaturas</button>
              <button onClick={() => setPaginaContador("configuracoes")} style={paginaContador === "configuracoes" ? styles.menuActive : styles.menuItem}>⚙️ Configurações</button>
            </>
          ) : (
            <button style={styles.menuActive}>🏠 Portal do Cliente</button>
          )}
        </div>

        <button style={styles.exitButton} onClick={sair}>
          ↪ Sair da conta
        </button>
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
                : "Escolha uma área abaixo para consultar seus documentos."}
            </p>
          </div>

          <div style={styles.profileBox}>
            <div style={styles.bell}>
              🔔
              {notificacoesNaoLidas > 0 && <div style={styles.badge}>{notificacoesNaoLidas}</div>}
            </div>

            <div style={styles.profile}>
              <strong>{empresa}</strong>
              <span>{isContador ? "Contador" : "Cliente"}</span>
            </div>
          </div>
        </header>

        {isContador ? (
          renderPainelContador()
        ) : (
          <>
            <section style={styles.clientHero}>
              <div>
                <p style={styles.clientLabel}>Portal do Cliente</p>
                <h2 style={styles.clientHeroTitle}>{empresa}</h2>
                <p style={styles.clientHeroText}>
                  Escolha uma área abaixo para consultar arquivos, boletos, certidões ou enviar documentos ao escritório.
                </p>
              </div>

              <div style={styles.clientHeroBadge}>
                <strong>{notificacoesNaoLidas}</strong>
                <span>avisos novos</span>
              </div>
            </section>

            <section style={styles.clientQuickGrid}>
              <button
                style={secaoCliente === "documentos" ? styles.clientQuickCardActive : styles.clientQuickCard}
                onClick={() => setSecaoCliente("documentos")}
              >
                <div style={styles.clientQuickIcon}>📄</div>
                <strong>Documentos</strong>
                <span>{documentosRecebidos.length} recebidos</span>
              </button>

              <button
                style={secaoCliente === "boletos" ? styles.clientQuickCardActive : styles.clientQuickCard}
                onClick={() => setSecaoCliente("boletos")}
              >
                <div style={styles.clientQuickIcon}>💳</div>
                <strong>Boletos</strong>
                <span>{boletos.length} disponíveis</span>
              </button>

              <button
                style={secaoCliente === "cnds" ? styles.clientQuickCardActive : styles.clientQuickCard}
                onClick={() => setSecaoCliente("cnds")}
              >
                <div style={styles.clientQuickIcon}>✅</div>
                <strong>CNDs</strong>
                <span>{cnds.length} certidões</span>
              </button>

              <button
                style={secaoCliente === "informativos" ? styles.clientQuickCardActive : styles.clientQuickCard}
                onClick={() => setSecaoCliente("informativos")}
              >
                <div style={styles.clientQuickIcon}>🔔</div>
                <strong>Informativos</strong>
                <span>{informativos.length} comunicados</span>
              </button>

              <button
                style={secaoCliente === "envio" ? styles.clientQuickCardActive : styles.clientQuickCard}
                onClick={() => setSecaoCliente("envio")}
              >
                <div style={styles.clientQuickIcon}>📤</div>
                <strong>Enviar</strong>
                <span>documento</span>
              </button>
            </section>

            <section style={styles.clientMainGrid}>
              <div>{renderListaCliente()}</div>
              <div style={styles.clientRightColumn}>
                <NotificacoesCard />
              </div>
            </section>
          </>
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
  loginLogo: { width: 250, marginBottom: 20 },
  loginTitle: { margin: 0, fontSize: 32, color: "#0f172a" },
  loginText: { color: "#64748b", marginBottom: 28 },
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
  logoBox: { textAlign: "center", marginBottom: 35 },
  sideLogo: { width: 190 },
  menu: { display: "flex", flexDirection: "column", gap: 10 },
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
  content: { flex: 1, padding: 32, boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  welcome: { fontSize: 34, margin: 0, fontWeight: 800 },
  subWelcome: { color: "#64748b", marginTop: 8 },
  profileBox: { display: "flex", alignItems: "center", gap: 15 },
  bell: {
    position: "relative",
    width: 54,
    height: 54,
    background: "#fff",
    borderRadius: 16,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 10px 30px rgba(15,23,42,.08)",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    background: "#ef4444",
    color: "#fff",
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 700,
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
  statLabel: { margin: 0, color: "#475569" },
  statNumber: { fontSize: 32, margin: "4px 0" },
  statPurple: { color: "#7c3aed", fontSize: 13 },
  statBlue: { color: "#2563eb", fontSize: 13 },
  statGreen: { color: "#16a34a", fontSize: 13 },
  statOrange: { color: "#f97316", fontSize: 13 },
  mainGrid: { display: "grid", gridTemplateColumns: "1.4fr .9fr", gap: 24 },
  sideCards: { display: "flex", flexDirection: "column", gap: 24 },
  bigCard: {
    background: "#fff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 35px rgba(15,23,42,.07)",
    border: "1px solid #e5e7eb",
  },
  cardTitle: { marginTop: 0, fontSize: 22, fontWeight: 800 },
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
  muted: { margin: 0, color: "#64748b", fontSize: 13 },
  empty: { background: "#f8fafc", color: "#64748b", padding: 16, borderRadius: 16 },
  separator: { border: "none", borderTop: "1px solid #e5e7eb", margin: "28px 0" },
  clientBlock: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  clientTitle: { margin: "0 0 4px", color: "#6d28d9" },
  yearBlock: { marginLeft: 12, marginTop: 12 },
  yearTitle: { color: "#2563eb", marginBottom: 10 },
  monthBlock: { marginLeft: 14, marginBottom: 14 },
  monthTitle: { textTransform: "capitalize", color: "#334155", marginBottom: 10 },
  loadingBar: {
    height: 8,
    borderRadius: 999,
    background: "#e9d5ff",
    overflow: "hidden",
    marginTop: 12,
  },
  loadingProgress: { height: "100%", background: "#7c3aed" },
  notificationItem: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    border: "1px solid #e9d5ff",
    cursor: "pointer",
  },
  notificationText: { margin: "6px 0 0", color: "#64748b", fontSize: 14 },
  unreadText: {
    display: "inline-block",
    marginTop: 8,
    fontSize: 12,
    color: "#7c3aed",
    fontWeight: 700,
  },
  clientHero: {
    background: "linear-gradient(135deg, #ffffff, #f3e8ff)",
    border: "1px solid #e9d5ff",
    borderRadius: 30,
    padding: 32,
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    boxShadow: "0 16px 45px rgba(15,23,42,.07)",
  },
  clientLabel: {
    margin: "0 0 8px",
    color: "#7c3aed",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  clientHeroTitle: { margin: 0, fontSize: 36, color: "#0f172a", fontWeight: 900 },
  clientHeroText: { margin: "10px 0 0", color: "#64748b", fontSize: 16, maxWidth: 680, lineHeight: 1.5 },
  clientHeroBadge: {
    minWidth: 120,
    background: "#7c3aed",
    color: "#fff",
    borderRadius: 24,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxShadow: "0 18px 35px rgba(124,58,237,.28)",
  },
  clientQuickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 18,
    marginBottom: 24,
  },
  clientQuickCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 12px 35px rgba(15,23,42,.06)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    cursor: "pointer",
    textAlign: "left",
  },
  clientQuickCardActive: {
    background: "#f3e8ff",
    border: "1px solid #c4b5fd",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 12px 35px rgba(124,58,237,.14)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    cursor: "pointer",
    textAlign: "left",
  },
  clientQuickIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    background: "#ede9fe",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 24,
    marginBottom: 8,
  },
  clientMainGrid: { display: "grid", gridTemplateColumns: "1.4fr .8fr", gap: 24 },
  clientRightColumn: { display: "flex", flexDirection: "column", gap: 24 },
  clientDocRow: {
    background: "#fff",
    border: "1px solid #eef2f7",
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
  },
  clientUploadPanel: {
    background: "#faf5ff",
    border: "2px dashed #c4b5fd",
    borderRadius: 22,
    padding: 22,
  },

  adminHero: {
    background: "linear-gradient(135deg, #ffffff, #eef2ff)",
    border: "1px solid #dbe4ee",
    borderRadius: 30,
    padding: 32,
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    boxShadow: "0 16px 45px rgba(15,23,42,.07)",
  },
  adminHeroActions: {
    display: "flex",
    gap: 12,
    minWidth: 280,
  },
  adminGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr .8fr",
    gap: 24,
  },
  adminShortcutGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  },
  adminShortcut: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 10px 28px rgba(15,23,42,.05)",
  },
  secondaryButton: {
    width: "100%",
    padding: 15,
    border: "1px solid #ddd6fe",
    borderRadius: 14,
    background: "#fff",
    color: "#7c3aed",
    fontWeight: 700,
    cursor: "pointer",
  },
  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: 24,
  },
  configLine: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
  },

};
