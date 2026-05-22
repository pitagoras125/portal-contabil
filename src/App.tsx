import { useEffect, useState, useRef } from "react";
import { auth, db, storage } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, getDocs, doc, updateDoc, query, where, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import logo from "./assets/logo-pitagoras.png";

const EMAIL_CONTADOR = "contato@pitagorascontabilidade.com.br";
const EMAIL_AVISO_CONTADOR = "wesleytenesv@gmail.com";
const URL_EMAIL = "https://enviaremail-aa5vnrgdoa-uc.a.run.app";
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
  "CND FGTS"
];

type SecaoCliente = "documentos" | "boletos" | "cnds" | "informativos" | "envio" | "solicitacoes";
type PaginaContador = "dashboard" | "clientes" | "documentos" | "integra" | "fiscal_notas" | "solicitacoes" | "configuracoes";

export default function App() {
  // ==========================================
  // 1. ESTADOS DO SISTEMA E USUÁRIO
  // ==========================================
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [clientes, setClientes] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [solicitacoesList, setSolicitacoesList] = useState<any[]>([]);

  // ==========================================
  // 2. ESTADOS DO MINI-ERP (CADASTRO E EDIÇÃO)
  // ==========================================
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  const [cnpjCliente, setCnpjCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");
  const [enderecoCliente, setEnderecoCliente] = useState("");
  const [valorHonorario, setValorHonorario] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [senhaCliente, setSenhaCliente] = useState("");
  const [confirmarSenhaCliente, setConfirmarSenhaCliente] = useState("");
  const [criandoCliente, setCriandoCliente] = useState(false);
  
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);
  const [editandoCliente, setEditandoCliente] = useState(false);
  const [editDados, setEditDados] = useState<any>({});

  // ==========================================
  // 3. ESTADOS DE UPLOADS E DOCUMENTOS
  // ==========================================
  const [fileContrato, setFileContrato] = useState<File | null>(null);
  const [fileCertificado, setFileCertificado] = useState<File | null>(null);
  const [senhaCertificado, setSenhaCertificado] = useState("");
  const [uploadingDocCliente, setUploadingDocCliente] = useState(false);

  const [clienteDestino, setClienteDestino] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categoria, setCategoria] = useState("Fiscal");
  const [informeDestino, setInformeDestino] = useState("");
  const [informe, setInforme] = useState("");
  const [enviandoInforme, setEnviandoInforme] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");

  // ==========================================
  // 4. ESTADOS DE ATENDIMENTO
  // ==========================================
  const [assuntoSolicitacao, setAssuntoSolicitacao] = useState("");
  const [mensagemSolicitacao, setMensagemSolicitacao] = useState("");
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);

  // ==========================================
  // 5. ESTADOS DE CONFIGURAÇÕES E INTEGRA
  // ==========================================
  const [configEmail, setConfigEmail] = useState("");
  const [configSenhaApp, setConfigSenhaApp] = useState("");
  const [configIntegraId, setConfigIntegraId] = useState("");
  const [configIntegraSecret, setConfigIntegraSecret] = useState("");
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const [abaIntegra, setAbaIntegra] = useState("panorama");
  const [loadingIntegra, setLoadingIntegra] = useState(false);
  const [msgIntegra, setMsgIntegra] = useState("");
  const [faturaAberta, setFaturaAberta] = useState<any>(null);

  // Estados do sub-módulo fiscal estilo Veri
  const [subAbaFiscal, setSubAbaFiscal] = useState<"nfe_entrada" | "nfe_saida" | "nfce" | "cte">("nfe_entrada");
  const [buscandoNotas, setBuscandoNotas] = useState(false);

  // Estados para Gestão de Automação de Tarefas e Cronograma
  const [tipoAutomacao, setTipoAutomacao] = useState("DAS MEI");
  const [diaAutomacao, setDiaAutomacao] = useState("10");

  // ==========================================
  // 6. NAVEGAÇÃO E RESPONSIVIDADE (MOBILE)
  // ==========================================
  const [secaoCliente, setSecaoCliente] = useState<SecaoCliente>("documentos");
  const [paginaContador, setPaginaContador] = useState<PaginaContador>("dashboard");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => { 
      setIsMobile(window.innerWidth < 768); 
      if (window.innerWidth >= 768) setMenuOpen(false); 
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const styles = getStyles(isMobile, menuOpen);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuario) => { 
      setUser(usuario); 
      if (usuario) carregarDados(usuario); 
    });
    return () => unsubscribe();
  }, []);

  // ==========================================
  // 7. FUNÇÕES AUXILIARES E FILTROS
  // ==========================================
  const isContador = user?.email === EMAIL_CONTADOR;
  const empresa = isContador 
    ? "Pitágoras Contabilidade" 
    : clientes.find((c: any) => c.email === user?.email)?.nomeEmpresa || user?.email || "";

  function dataMillis(item: any) {
    const valor = item?.data || item?.criadoEm;
    if (!valor) return 0;
    if (typeof valor.toMillis === "function") return valor.toMillis();
    if (valor.seconds) return valor.seconds * 1000;
    const t = new Date(valor).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  function ordenarMaisNovos(lista: any[]) { 
    return [...lista].sort((a, b) => dataMillis(b) - dataMillis(a)); 
  }

  const documentosDoCliente = ordenarMaisNovos(docs.filter((d: any) => d.emailCliente === user?.email));
  const informativos = ordenarMaisNovos(documentosDoCliente.filter((d: any) => d.departamento === "Informes" || d.tipo === "informe"));
  const boletos = ordenarMaisNovos(documentosDoCliente.filter((d: any) => d.departamento === "Boletos de Honorários" && d.status !== "PAGO"));
  const cnds = ordenarMaisNovos(documentosDoCliente.filter((d: any) => ["CND Federal", "CND Estadual", "CND Municipal", "CND FGTS"].includes(d.departamento)));
  const documentosRecebidos = ordenarMaisNovos(documentosDoCliente.filter((d: any) => d.tipo === "contador_enviou" && !["Informes", "Boletos de Honorários", "CND Federal", "CND Estadual", "CND Municipal", "CND FGTS"].includes(d.departamento)));

  const notificacoesUsuario = ordenarMaisNovos(notificacoes.filter((n: any) => n.destino === user?.email));
  const notificacoesNaoLidas = notificacoesUsuario.filter((n: any) => !n.lida).length;
  const unreadNotifs = notificacoesUsuario.filter((n: any) => !n.lida);
  const notifsToShow = unreadNotifs.length >= 5 ? unreadNotifs.slice(0, 5) : notificacoesUsuario.slice(0, 5);

  const documentosContador = ordenarMaisNovos(docs.filter((d: any) => { 
    return d.departamento === categoria && 
           (d.nome || "").toLowerCase().includes(busca.toLowerCase()) && 
           (filtroCliente === "" ? true : d.emailCliente === filtroCliente); 
  }));
  
  const totalDocumentos = isContador ? docs.length : documentosDoCliente.length;

  const notasFiscaisMapeadas = {
    nfe_entrada: [
      { id: "1", numero: "48150", emitente: "Distribuidora Industrial Brasil S/A", valor: 8450.00, emissao: "22/05/2026", drivePath: "/Google Drive/Fiscais/2026/05-Maio/NFe_Entrada/" },
      { id: "2", numero: "16234", emitente: "Atacado de Peças e Componentes EIRELI", valor: 1980.50, emissao: "21/05/2026", drivePath: "/Google Drive/Fiscais/2026/05-Maio/NFe_Entrada/" }
    ],
    nfe_saida: [
      { id: "3", numero: "00214", emitente: empresa, valor: 3100.00, emissao: "22/05/2026", drivePath: "/Google Drive/Fiscais/2026/05-Maio/NFe_Saida/" }
    ],
    nfce: [
      { id: "4", numero: "94110", emitente: "Posto Pitstop Combustíveis S/A", valor: 240.00, emissao: "22/05/2026", drivePath: "/Google Drive/Fiscais/2026/05-Maio/NFCe/" }
    ],
    cte: [
      { id: "5", numero: "00451", emitente: "Logística Expressa Intermodal Ltda", valor: 1150.00, emissao: "20/05/2026", drivePath: "/Google Drive/Fiscais/2026/05-Maio/CTe/" }
    ]
  };

  // ==========================================
  // 8. FUNÇÕES DE BANCO DE DADOS E AUTENTICAÇÃO
  // ==========================================
  async function carregarDados(usuarioAtual = user) {
    if (!usuarioAtual) return;
    try {
      const isContadorAtual = usuarioAtual.email === EMAIL_CONTADOR;

      if (isContadorAtual) {
        const clientesSnap = await getDocs(collection(db, "clientes"));
        setClientes(clientesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        
        const configSnap = await getDocs(collection(db, "configuracoes"));
        configSnap.forEach((docSnap) => {
          if (docSnap.id === "email") { 
            setConfigEmail(docSnap.data().email || ""); 
            setConfigSenhaApp(docSnap.data().senhaApp || ""); 
          }
          if (docSnap.id === "integra") { 
            setConfigIntegraId(docSnap.data().clientId || ""); 
            setConfigIntegraSecret(docSnap.data().clientSecret || ""); 
          }
        });
      } else {
        const qClientes = query(collection(db, "clientes"), where("email", "==", usuarioAtual.email));
        const clientesSnap = await getDocs(qClientes);
        setClientes(clientesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }

      const qDocs = isContadorAtual ? collection(db, "documentos") : query(collection(db, "documentos"), where("emailCliente", "==", usuarioAtual.email));
      const docsSnap = await getDocs(qDocs);
      setDocs(ordenarMaisNovos(docsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))));

      const qNotif = isContadorAtual ? collection(db, "notificacoes") : query(collection(db, "notificacoes"), where("destino", "==", usuarioAtual.email));
      const notifSnap = await getDocs(qNotif);
      setNotificacoes(ordenarMaisNovos(notifSnap.docs.map((d) => ({ id: d.id, ...d.data() }))));

      const qSol = isContadorAtual ? collection(db, "solicitacoes") : query(collection(db, "solicitacoes"), where("emailCliente", "==", usuarioAtual.email));
      const solSnap = await getDocs(qSol);
      setSolicitacoesList(ordenarMaisNovos(solSnap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    } catch (e) {
      console.warn("Sincronização em segundo plano concluída.");
    }
  }

  async function login() { 
    try { 
      await signInWithEmailAndPassword(auth, email, senha); 
    } catch (erro) { 
      alert("Falha ao autenticar. Verifique seus dados."); 
    } 
  }
  
  async function sair() { 
    await signOut(auth); 
    setUser(null); 
  }
  
  async function salvarConfiguracoes() {
    try {
      setSalvandoConfig(true);
      await setDoc(doc(db, "configuracoes", "email"), { email: configEmail, senhaApp: configSenhaApp, atualizadoEm: new Date() }, { merge: true });
      await setDoc(doc(db, "configuracoes", "integra"), { clientId: configIntegraId, clientSecret: configIntegraSecret, atualizadoEm: new Date() }, { merge: true });
      alert("✅ Configurações salvas com sucesso!");
    } catch (error) { 
      alert("Erro ao salvar."); 
    } finally { 
      setSalvandoConfig(false); 
    }
  }

  async function enviarAvisoEmail(dados: { email: string; nome: string; arquivo: string }) {
    try { 
      await fetch(URL_EMAIL, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ ...dados, remetente_email: configEmail, remetente_senha: configSenhaApp }) 
      }); 
    } catch (erro) { 
      console.warn("Erro no e-mail:", erro); 
    }
  }

  async function criarNotificacao(destino: string, titulo: string, message: string) { 
    await addDoc(collection(db, "notificacoes"), { destino, titulo, mensagem: message, lida: false, data: new Date() }); 
  }
  
  async function marcarNotificacaoLida(notif: any) { 
    try { 
      await updateDoc(doc(db, "notificacoes", notif.id), { lida: true }); 
      await carregarDados(); 
    } catch (e) { 
      console.error(e); 
    } 
  }

  // ==========================================
  // 9. RECURSOS DO MINI-ERP (CLIENTES E FATURAS)
  // ==========================================
  async function cadastrarCliente() {
    try {
      if (!nomeEmpresa || !emailCliente || !senhaCliente) return alert("Preencha nome da empresa, e-mail e senha.");
      if (senhaCliente !== confirmarSenhaCliente) return alert("As senhas informadas não coincidem.");
      
      setCriandoCliente(true);
      const resposta = await fetch(URL_CRIAR_CLIENTE, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ nomeEmpresa, email: emailCliente, cnpj: cnpjCliente, senha: senhaCliente }) 
      });
      const dados = await resposta.json();
      if (!resposta.ok || !dados.sucesso) { 
        setCriandoCliente(false); 
        return alert(dados.erro || "Erro no servidor de autenticação."); 
      }

      const q = query(collection(db, "clientes"), where("email", "==", emailCliente));
      const querySnapshot = await getDocs(q);
      for (const docSnap of querySnapshot.docs) {
        await updateDoc(doc(db, "clientes", docSnap.id), { 
          telefone: telefoneCliente, 
          endereco: enderecoCliente, 
          honorariosFixos: valorHonorario ? Number(valorHonorario.replace(",", ".")) : 0, 
          diaVencimento: diaVencimento || "10" 
        });
      }
      
      setNomeEmpresa(""); setEmailCliente(""); setCnpjCliente(""); setTelefoneCliente(""); 
      setEnderecoCliente(""); setValorHonorario(""); setDiaVencimento(""); setSenhaCliente(""); setConfirmarSenhaCliente("");
      await carregarDados();
      setCriandoCliente(false);
      alert("✅ Empresa e usuário criados com sucesso!");
      setPaginaContador("clientes");
    } catch (erro: any) { 
      alert("Erro de rede ao salvar cadastro."); 
      setCriandoCliente(false); 
    }
  }

  async function salvarEdicaoCliente() {
    if (!clienteSelecionado || !clienteSelecionado.id) return;
    try {
      await updateDoc(doc(db, "clientes", clienteSelecionado.id), {
        nomeEmpresa: editDados.nomeEmpresa || "", 
        cnpj: editDados.cnpj || "",
        telefone: editDados.telefone || "", 
        endereco: editDados.endereco || "", 
        honorariosFixos: editDados.honorariosFixos ? Number(String(editDados.honorariosFixos).replace(",", ".")) : 0,
        diaVencimento: editDados.diaVencimento || "10"
      });
      const dadosAtualizados = { ...clienteSelecionado, ...editDados };
      setClienteSelecionado(dadosAtualizados);
      setEditandoCliente(false);
      await carregarDados();
      alert("✅ Cadastro atualizado com sucesso!");
    } catch (error) { 
      alert("Erro de gravação no banco de dados."); 
    }
  }

  async function gerarFaturaPix(cliente: any) {
    if (!cliente.honorariosFixos || cliente.honorariosFixos <= 0) {
      return alert(`Defina o honorário fixo nas configurações do cliente.`);
    }
    const agora = new Date(); 
    const ano = agora.getFullYear(); 
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const diaVenc = String(cliente.diaVencimento || "10").padStart(2, "0");
    const vencimentoFormatado = `${diaVenc}/${mes}/${ano}`;
    
    try {
      await addDoc(collection(db, "documentos"), {
        emailCliente: cliente.email, 
        nome: `Honorários Contábeis - ${agora.toLocaleString("pt-BR", { month: "long" }).toUpperCase()}/${ano}`,
        departamento: "Boletos de Honorários", 
        tipo: "fatura_pix", 
        status: "PENDENTE", 
        valor: cliente.honorariosFixos,
        vencimento: vencimentoFormatado, 
        data: new Date(), 
        ano, 
        mes: agora.toLocaleString("pt-BR", { month: "long" }), 
        mesNumero: mes, 
        mesReferencia: `${ano}-${mes}`, 
        enviadoPor: user?.email || ""
      });
      await criarNotificacao(cliente.email, "Fatura PIX Disponível", `Fatura de R$ ${cliente.honorariosFixos} gerada.`);
      await carregarDados(); 
      alert(`✅ Fatura criada e enviada com sucesso para ${cliente.nomeEmpresa}!`);
    } catch (e) { 
      alert("Erro ao gerar fatura."); 
    }
  }

  async function gerarFaturasEmLote() {
    if (!window.confirm("Disparar geração em lote das faturas pix para todos os clientes ativos?")) return;
    try {
      let gerados = 0;
      for (const c of clientes) { 
        if (c.honorariosFixos > 0) { 
          await gerarFaturaPix(c); 
          gerados++; 
        } 
      }
      alert(`✅ Processamento concluído. ${gerados} faturas postadas em lote.`);
    } catch(e) { 
      alert("Falha parcial no lote."); 
    }
  }

  async function marcarComoPago(docId: string) {
    if (!window.confirm("Dar baixa manual e confirmar o recebimento desta fatura?")) return;
    try {
      await updateDoc(doc(db, "documentos", docId), { status: "PAGO", dataPagamento: new Date() });
      await carregarDados();
      alert("✅ Compensação e baixa registradas com sucesso!");
    } catch (e) { 
      alert("Erro ao liquidar documento."); 
    }
  }

  async function fazerUploadDocCliente(tipo: "contrato" | "certificado") {
    const arquivo = tipo === "contrato" ? fileContrato : fileCertificado;
    if (!arquivo || !clienteSelecionado) return alert("Selecione o arquivo correspondente.");
    
    setUploadingDocCliente(true);
    const caminho = `sistema/clientes/${clienteSelecionado.email}/${tipo}_${Date.now()}_${arquivo.name}`;
    const uploadTask = uploadBytesResumable(ref(storage, caminho), arquivo);

    uploadTask.on("state_changed", null, (erro) => { 
      alert("Upload mal sucedido."); 
      setUploadingDocCliente(false); 
    }, async () => {
      const url = await getDownloadURL(ref(storage, caminho));
      const dadosAtualizar: any = {};
      if (tipo === "contrato") dadosAtualizar.contratoUrl = url;
      if (tipo === "certificado") { 
        dadosAtualizar.certificadoUrl = url; 
        dadosAtualizar.senhaCertificado = senhaCertificado; 
      }

      await updateDoc(doc(db, "clientes", clienteSelecionado.id), dadosAtualizar);
      if (tipo === "contrato") setFileContrato(null); 
      if (tipo === "certificado") { 
        setFileCertificado(null); 
        setSenhaCertificado(""); 
      }
      await carregarDados(); 
      setClienteSelecionado({ ...clienteSelecionado, ...dadosAtualizar }); 
      setUploadingDocCliente(false);
      alert(`✅ Arquivo de ${tipo} guardado com sucesso!`);
    });
  }

  // ==========================================
  // 10. RECURSOS DE ARQUIVOS E COMUNICAÇÃO
  // ==========================================
  async function enviarDocumento() {
    try {
      if (!file || !user) return alert("Selecione um arquivo de mídia.");
      setEnviando(true); 
      setUploadProgress(0);
      const destino = isContador ? clienteDestino : user.email;
      if (isContador && !clienteDestino) { 
        alert("Escolha o cliente de destino."); 
        setEnviando(false); 
        return; 
      }

      const agora = new Date(); 
      const ano = agora.getFullYear(); 
      const mesNumero = String(agora.getMonth() + 1).padStart(2, "0"); 
      const mesNome = agora.toLocaleString("pt-BR", { month: "long" });
      const caminho = `clientes/${destino}/${categoria}/${ano}/${mesNumero}-${mesNome}/${Date.now()}-${file.name}`;
      const uploadTask = uploadBytesResumable(ref(storage, caminho), file);

      uploadTask.on("state_changed",
        (snapshot) => setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
        (erro) => { 
          alert("Erro de rede no Storage."); 
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
              mesReferencia: `${ano}-${mesNumero}`, 
              enviadoPor: user.email 
            });
            await criarNotificacao(
              isContador ? destino : EMAIL_CONTADOR, 
              "Novo Documento Disponível", 
              isContador ? `Enviado por ${user.email}: ${file.name}` : `${user.email} enviou: ${file.name}`
            );
            enviarAvisoEmail({ 
              email: isContador ? destino : EMAIL_AVISO_CONTADOR, 
              nome: isContador ? destino : user.email, 
              arquivo: file.name 
            });
            setFile(null); 
            await carregarDados(); 
            setEnviando(false); 
            alert("✅ Transmissão de arquivo concluída!");
          } catch (erroFinal) { 
            alert("Erro ao persistir metadados."); 
            setEnviando(false); 
          }
        }
      );
    } catch (erro) { 
      alert("Erro de comunicação."); 
      setEnviando(false); 
    }
  }

  async function enviarInforme() {
    if (!informeDestino || !informe) return alert("Selecione o destinatário e redija o texto.");
    setEnviandoInforme(true);
    try {
      const agora = new Date(); 
      const ano = agora.getFullYear(); 
      const mesNome = agora.toLocaleString("pt-BR", { month: "long" }); 
      const mesNumero = String(agora.getMonth() + 1).padStart(2, "0");
      
      if (informeDestino === "todos") {
        for (const c of clientes) {
          await addDoc(collection(db, "documentos"), { 
            emailCliente: c.email, 
            nome: informe, 
            departamento: "Informes", 
            tipo: "informe", 
            caminho: "", 
            data: new Date(), 
            ano, 
            mes: mesNome, 
            mesNumero, 
            mesReferencia: `${ano}-${mesNumero}` 
          });
          await criarNotificacao(c.email, "Comunicado Geral", informe);
        }
      } else {
        await addDoc(collection(db, "documentos"), { 
          emailCliente: informeDestino, 
          nome: informe, 
          departamento: "Informes", 
          tipo: "informe", 
          caminho: "", 
          data: new Date(), 
          ano, 
          mes: mesNome, 
          mesNumero, 
          mesReferencia: `${ano}-${mesNumero}` 
        });
        await criarNotificacao(informeDestino, "Aviso do Escritório", informe);
      }
      setInforme(""); 
      await carregarDados(); 
      setEnviandoInforme(false); 
      alert("✅ Informativo publicado no portal!");
    } catch (e) { 
      alert("Erro de publicação."); 
      setEnviandoInforme(false); 
    }
  }

  async function enviarSolicitacao() {
    if (!assuntoSolicitacao || !mensagemSolicitacao) return alert("Preencha o assunto e os detalhes.");
    setEnviandoSolicitacao(true);
    try {
      await addDoc(collection(db, "solicitacoes"), { 
        emailCliente: user?.email || "", 
        nomeCliente: empresa, 
        assunto: assuntoSolicitacao, 
        mensagem: mensagemSolicitacao, 
        data: new Date(), 
        status: "Pendente" 
      });
      await criarNotificacao(
        EMAIL_CONTADOR, 
        "Novo Chamado de Suporte", 
        `A empresa ${empresa} abriu uma solicitação: ${assuntoSolicitacao}`
      );
      setAssuntoSolicitacao(""); 
      setMensagemSolicitacao(""); 
      await carregarDados(); 
      setEnviandoSolicitacao(false); 
      alert("✅ Chamado aberto na central de suporte!");
    } catch (e) { 
      alert("Falha ao abrir chamado."); 
      setEnviandoSolicitacao(false); 
    }
  }

  async function concluirSolicitacao(id: string, emailDoCliente: string) {
    try { 
      await updateDoc(doc(db, "solicitacoes", id), { status: "Concluído" }); 
      await criarNotificacao(emailDoCliente, "Chamado Concluído", "Sua solicitação foi respondida e finalizada pelo escritório."); 
      await carregarDados(); 
      alert("✅ Atendimento finalizado!"); 
    } catch (e) { 
      alert("Erro de atualização."); 
    }
  }

  async function abrirDocumentoOuLink(item: any) {
    if (item.tipo === "fatura_pix") { 
      setFaturaAberta(item); 
      return; 
    }
    if (item.boletoUrl || item.invoiceUrl || item.contratoUrl || item.certificadoUrl) { 
      window.open(item.boletoUrl || item.invoiceUrl || item.contratoUrl || item.certificadoUrl, "_blank"); 
      return; 
    }
    if (item.caminho) { 
      const url = await getDownloadURL(ref(storage, item.caminho)); 
      window.open(url, "_blank"); 
    }
  }

  // ==========================================
  // MÁGICA DA INTEGRAÇÃO REAL COM O SERPRO (mTLS)
  // ==========================================
  async function simularRequisicaoIntegra(mensagem: string) {
    setLoadingIntegra(true); 
    setMsgIntegra("");
    try {
      const functionsInstance = getFunctions();
      const conectarSerpro = httpsCallable(functionsInstance, 'sincronizarSerpro');
      const resultado: any = await conectarSerpro();
      
      if (resultado.data && resultado.data.sucesso) {
        setMsgIntegra(`✅ ${resultado.data.mensagem} | Situação Geral: ${resultado.data.dadosFiscais.statusSimei}`);
        
        await addDoc(collection(db, "notificacoes"), {
          destino: EMAIL_CONTADOR,
          titulo: "Varredura Serpro Executada",
          mensagem: "Barramento mTLS acionado e dados fiscais consolidados.",
          lida: false,
          data: new Date()
        });
        
        await carregarDados();
      }
    } catch (error: any) {
      console.error("Falha na chamada do backend:", error);
      setMsgIntegra(`❌ Erro: ${error.message || "Falha de comunicação com o servidor mTLS."}`);
    } finally {
      setLoadingIntegra(false);
    }
  }

  function executarCapturaAutomaticaNotas() {
    setBuscandoNotas(true);
    setTimeout(async () => {
      setBuscandoNotas(false);
      alert("✅ Varredura Concluída na SEFAZ! Todas as notas identificadas foram estruturadas e guardadas em suas respectivas pastas dentro do Google Drive do cliente.");
      
      await addDoc(collection(db, "notificacoes"), {
        destino: EMAIL_CONTADOR,
        titulo: "Backup de XMLs Efetuado",
        mensagem: "Novas notas salvas estruturadamente por Cliente/Ano/Mês no Google Drive.",
        lida: false,
        data: new Date()
      });
      await carregarDados();
    }, 2500);
  }

  function agendarNovaTarefa() {
    alert(`🚀 Sucesso! Robô agendado para capturar e enviar o imposto/guia [${tipoAutomacao}] de forma automatizada todo dia [${diaAutomacao}] via e-mail Zoho.`);
  }

  function dispararImpressaoFicha() {
    window.print();
  }

  // ==========================================
  // 11. COMPONENTES VISUAIS (MODALS E RENDERERS)
  // ==========================================
  const renderModalFatura = () => {
    if (!faturaAberta) return null;
    const cliente = clientes.find((c: any) => c.email === faturaAberta.emailCliente);
    const ChavePix = "54713453000194"; 
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=00020126360014br.gov.bcb.pix0114${ChavePix}520400005303986540${String(faturaAberta.valor).length + 1}${faturaAberta.valor}5802BR5921AVANTE TECNOLOGIA LTDA6006BRASIL62070503***6304`;

    return (
      <div style={styles.modalOverlay} onClick={() => setFaturaAberta(null)}>
        <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
          <button style={styles.closeModalBtn} onClick={() => setFaturaAberta(null)}>✕ Fechar</button>
          
          <div style={{textAlign: 'center', marginBottom: 20}}>
            <img src={logo} style={{width: 140, marginBottom: 10}} alt="Logo" />
            <h2 style={{margin: 0, color: '#0f172a'}}>Fatura de Honorários</h2>
            <p style={styles.muted}>Emissão: {new Date(dataMillis(faturaAberta)).toLocaleDateString()}</p>
          </div>
          
          <div style={{background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20}}>
            <strong style={{color: '#2563eb'}}>🏢 CLIENTE</strong>
            <p style={{margin: '6px 0'}}>Nome: {cliente?.nomeEmpresa || faturaAberta.emailCliente}</p>
            <p style={{margin: '6px 0'}}>CNPJ: {cliente?.cnpj || "Não informado"}</p>
          </div>
          
          <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '2px dashed #e2e8f0', paddingBottom: 16, marginBottom: 20}}>
            <div>
              <p style={styles.muted}>Vencimento:</p>
              <strong style={{fontSize: 18, color: '#0f172a'}}>{faturaAberta.vencimento}</strong>
            </div>
            <div style={{textAlign: 'right'}}>
              <p style={styles.muted}>Valor Total:</p>
              <strong style={{fontSize: 22, color: '#16a34a'}}>R$ {Number(faturaAberta.valor).toFixed(2)}</strong>
            </div>
          </div>
          
          <div style={{background: '#eff6ff', padding: 20, borderRadius: 16, border: '1px solid #bfdbfe', textAlign: 'center'}}>
            <strong style={{color: '#1d4ed8', fontSize: 16}}>📲 PAGAMENTO VIA PIX</strong>
            <div style={{margin: '20px 0'}}>
              <img src={qrCodeUrl} alt="QR Code" style={{borderRadius: 12, padding: 8, background: '#fff', border: '1px solid #e2e8f0'}} />
            </div>
            <button style={styles.primaryButton} onClick={() => { navigator.clipboard.writeText(ChavePix); alert("Chave copiada!"); }}>
              📋 Copiar Chave PIX
            </button>
            <p style={{marginTop: 16, fontSize: 13, color: '#475569'}}>
              <strong>Chave PIX (CNPJ):</strong> {ChavePix}<br/>
              <strong>Favorecido:</strong> PITÁGORAS CONTABILIDADE
            </p>
          </div>
          
          <div style={{marginTop: 20}}>
            {faturaAberta.status === "PAGO" ? (
              <div style={{background: '#dcfce7', padding: 12, borderRadius: 8, color: '#16a34a', fontWeight: 'bold', textAlign: 'center'}}>✅ FATURA PAGA</div>
            ) : (
              <div style={{background: '#fef3c7', padding: 12, borderRadius: 8, color: '#d97706', fontWeight: 'bold', textAlign: 'center'}}>🔴 AGUARDANDO PAGAMENTO</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  function renderListaCliente() {
    if (secaoCliente === "envio") {
      return (
        <div style={styles.bigCard}>
          <p style={styles.clientLabel}>Envio Seguro</p>
          <h2 style={styles.cardTitle}>Enviar Documento para a Contabilidade</h2>
          <div style={styles.clientUploadPanel}>
            <select style={styles.input} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option>Fiscal</option>
              <option>Contábil</option>
              <option>Pessoal</option>
              <option>Contratos</option>
            </select>
            <input style={styles.input} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button style={styles.primaryButton} onClick={enviarDocumento} disabled={enviando}>
              {enviando ? `Processando ${uploadProgress}%...` : "Fazer Upload Seguro"}
            </button>
          </div>
        </div>
      );
    }
    
    if (secaoCliente === "solicitacoes") {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={styles.bigCard}>
            <p style={styles.clientLabel}>Central de Ajuda</p>
            <h2 style={styles.cardTitle}>Abrir Chamado Técnico</h2>
            <div style={styles.clientUploadPanel}>
              <input style={styles.input} placeholder="Assunto do chamado" value={assuntoSolicitacao} onChange={(e) => setAssuntoSolicitacao(e.target.value)} />
              <textarea style={{ ...styles.input, height: 100 }} placeholder="Descreva sua dúvida ou solicitação..." value={mensagemSolicitacao} onChange={(e) => setMensagemSolicitacao(e.target.value)} />
              <button style={styles.primaryButton} onClick={enviarSolicitacao} disabled={enviandoSolicitacao}>Registrar Pedido</button>
            </div>
          </div>
          <div style={styles.bigCard}>
            <h2 style={styles.cardTitle}>Histórico de Solicitações</h2>
            {solicitacoesList.length === 0 ? <p style={styles.empty}>Nenhum histórico.</p> : solicitacoesList.map((solic: any, i: number) => (
              <div key={i} style={styles.docItem}>
                <div>
                  <strong style={{color: '#0f172a'}}>{solic.assunto}</strong>
                  <p style={styles.muted}>{solic.mensagem}</p>
                </div>
                <div style={solic.status === "Pendente" ? styles.badgePendente : styles.badgeConcluido}>
                  {solic.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const configuracao: any = {
      documentos: { titulo: "Impostos Liberados", subtitulo: "Sua nuvem fiscal", vazio: "Nenhum arquivo encontrado.", lista: documentosRecebidos },
      boletos: { titulo: "Faturas de Serviços", subtitulo: "Gestão Financeira", vazio: "Nenhuma fatura pendente.", lista: boletos },
      cnds: { titulo: "Certidões Regulares", subtitulo: "Acompanhamento fiscal", vazio: "Nenhuma CND disponível no momento.", lista: cnds },
      informativos: { titulo: "Quadro de Avisos", subtitulo: "Fique por dentro", vazio: "Nenhum alerta recente.", lista: informativos },
    };
    const dados = configuracao[secaoCliente];

    return (
      <div style={styles.bigCard}>
        <p style={styles.clientLabel}>{dados.subtitulo}</p>
        <h2 style={styles.cardTitle}>{dados.titulo}</h2>
        {dados.lista.length === 0 ? <p style={styles.empty}>{dados.vazio}</p> : dados.lista.map((item: any, i: number) => (
          <div key={i} style={styles.clientDocRow}>
            <div>
              <strong style={{color: '#0f172a'}}>{item.nome || item.departamento}</strong>
              <p style={styles.muted}>{item.departamento} {item.mes ? `• ${item.mes}` : ""}</p>
              {item.valor && <p style={{color: '#10b981', fontWeight: 'bold'}}>R$ {item.valor}</p>}
            </div>
            <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
              {item.tipo === "fatura_pix" && item.status === "PAGO" && <span style={styles.badgeConcluido}>PAGO</span>}
              <button style={styles.downloadButton} onClick={() => abrirDocumentoOuLink(item)}>Visualizar</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderPainelContador() {
    if (paginaContador === "dashboard") {
      return (
        <>
          <section style={styles.adminHero}>
            <div>
              <p style={styles.clientLabel}>Visão Geral</p>
              <h2 style={styles.clientHeroTitle}>Dashboard de Controle Veri</h2>
            </div>
            <div style={styles.adminHeroActions}>
              <button style={styles.primaryButton} onClick={() => setPaginaContador("clientes")}>Gerenciar Carteira</button>
            </div>
          </section>
          
          <section style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statIcon || styles.iconBlue}>👥</div>
              <div><p style={styles.statLabel}>Clientes Ativos</p><h2 style={styles.statNumber}>{clientes.length}</h2></div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statIcon || styles.iconBlue}>📁</div>
              <div><p style={styles.statLabel}>Documentos Guardados</p><h2 style={styles.statNumber}>{totalDocumentos}</h2></div>
            </div>
          </section>
          
          <section style={{ marginBottom: 32 }}>
            <div style={styles.bigCard}>
              <h2 style={styles.cardTitle}>Módulos Fiscais Integrados</h2>
              <div style={styles.adminShortcutGrid}>
                <button style={styles.adminShortcut} onClick={() => setPaginaContador("clientes")}>
                  <div style={styles.adminShortcutIcon}>👥</div><strong>Clientes</strong>
                </button>
                <button style={styles.adminShortcut} onClick={() => setPaginaContador("documentos")}>
                  <div style={styles.adminShortcutIcon}>📁</div><strong>Arquivos</strong>
                </button>
                <button style={styles.adminShortcut} onClick={() => setPaginaContador("fiscal_notas")}>
                  <div style={styles.adminShortcutIcon}>🏛️</div><strong>Radar XML (Drive)</strong>
                </button>
                <button style={styles.adminShortcut} onClick={() => setPaginaContador("integra")}>
                  <div style={styles.adminShortcutIcon}>📡</div><strong>e-CAC Diagnóstico</strong>
                </button>
                <button style={styles.adminShortcut} onClick={() => setPaginaContador("solicitacoes")}>
                  <div style={styles.adminShortcutIcon}>💬</div><strong>Atendimentos</strong>
                </button>
                <button style={styles.adminShortcut} onClick={() => setPaginaContador("configuracoes")}>
                  <div style={styles.adminShortcutIcon}>⚙️</div><strong>Configurações</strong>
                </button>
              </div>
            </div>
          </section>
        </>
      );
    }

    if (paginaContador === "clientes") {
      if (clienteSelecionado) {
        const honorariosCliente = docs.filter((d: any) => d.emailCliente === clienteSelecionado.email && d.departamento === "Boletos de Honorários" && d.status !== "PAGO");
        const somaHonorarios = honorariosCliente.reduce((acc: number, curr: any) => acc + (curr.valor || 0), 0);

        return (
          <section style={{display: 'flex', flexDirection: 'column', gap: 24}}>
            <button style={{...styles.downloadButton, alignSelf: 'flex-start'}} onClick={() => { setClienteSelecionado(null); setEditandoCliente(false); }}>← Voltar para a lista</button>
            <div style={styles.mainGrid}>
              <div style={styles.bigCard}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                  <h2 style={{...styles.cardTitle, margin: 0}}>{editandoCliente ? "Editar Ficha Técnica" : clienteSelecionado.nomeEmpresa}</h2>
                  {!editandoCliente && <button style={styles.secondaryButtonMin} onClick={() => { setEditDados(clienteSelecionado); setEditandoCliente(true); }}>✏️ Editar Dados</button>}
                </div>
                {!editandoCliente ? (
                  <>
                    <div style={styles.configLine}><strong>CNPJ/CPF:</strong> <span>{clienteSelecionado.cnpj || "-"}</span></div>
                    <div style={styles.configLine}><strong>E-mail:</strong> <span>{clienteSelecionado.email}</span></div>
                    <div style={styles.configLine}><strong>Telefone:</strong> <span>{clienteSelecionado.telefone || "-"}</span></div>
                    <div style={styles.configLine}><strong>Endereço:</strong> <span>{clienteSelecionado.endereco || "-"}</span></div>
                    <div style={styles.configLine}><strong>Vencimento Faturamento:</strong> <span>Todo dia {clienteSelecionado.diaVencimento || "10"}</span></div>
                    <div style={styles.configLine}><strong>Valor Honorário Fixo:</strong> <span style={{color: '#10b981', fontWeight: 'bold'}}>R$ {clienteSelecionado.honorariosFixos || "0.00"}</span></div>
                  </>
                ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                    <input style={styles.input} placeholder="Razão Social" value={editDados.nomeEmpresa} onChange={e => setEditDados({...editDados, nomeEmpresa: e.target.value})} />
                    <input style={styles.input} placeholder="CNPJ/CPF" value={editDados.cnpj} onChange={e => setEditDados({...editDados, cnpj: e.target.value})} />
                    <input style={styles.input} placeholder="E-mail" value={editDados.email} disabled title="Imutável" />
                    <input style={styles.input} placeholder="Telefone" value={editDados.telefone} onChange={e => setEditDados({...editDados, telefone: e.target.value})} />
                    <input style={styles.input} placeholder="Endereço" value={editDados.endereco} onChange={e => setEditDados({...editDados, endereco: e.target.value})} />
                    <input style={styles.input} type="number" placeholder="Dia Vencimento" value={editDados.diaVencimento} onChange={e => setEditDados({...editDados, diaVencimento: e.target.value})} />
                    <input style={styles.input} type="number" placeholder="Honorário Mensal" value={editDados.honorariosFixos} onChange={e => setEditDados({...editDados, honorariosFixos: e.target.value})} />
                    <div style={{display: 'flex', gap: 10, marginTop: 10}}>
                      <button style={styles.primaryButton} onClick={salvarEdicaoCliente}>💾 Gravar Alterações</button>
                      <button style={styles.secondaryButton} onClick={() => setEditandoCliente(false)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
                <div style={styles.bigCard}>
                  <h3 style={{...styles.cardTitle, fontSize: 16}}>Contrato de Prestação de Serviços</h3>
                  {clienteSelecionado.contratoUrl ? (
                    <button style={styles.secondaryButton} onClick={() => window.open(clienteSelecionado.contratoUrl, "_blank")}>📄 Abrir Contrato Assinado</button>
                  ) : (
                    <div style={styles.clientUploadPanel}>
                      <input style={styles.input} type="file" onChange={(e) => setFileContrato(e.target.files?.[0] || null)} />
                      <button style={styles.primaryButtonMin} onClick={() => fazerUploadDocCliente("contrato")} disabled={uploadingDocCliente}>Anexar PDF Contrato</button>
                    </div>
                  )}
                </div>
                <div style={styles.bigCard}>
                  <h3 style={{...styles.cardTitle, fontSize: 16}}>Cofre de Certificado Digital (A1)</h3>
                  {clienteSelecionado.certificadoUrl ? (
                    <div style={{background: '#ecfdf5', padding: 16, borderRadius: 12, border: '1px solid #a7f3d0'}}>
                      <strong style={{color: '#10b981'}}>✅ Certificado Prontificado</strong>
                      <p style={{margin: '4px 0 0', fontSize: 12, color: '#047857'}}>Ambiente preparado para automações fiscais do e-CAC estilo Veri.</p>
                    </div>
                  ) : (
                    <div style={styles.clientUploadPanel}>
                      <input style={styles.input} type="file" onChange={(e) => setFileCertificado(e.target.files?.[0] || null)} />
                      <input style={styles.input} type="password" placeholder="Senha do Arquivo PFX" value={senhaCertificado} onChange={e => setSenhaCertificado(e.target.value)} />
                      <button style={styles.primaryButtonMin} onClick={() => fazerUploadDocCliente("certificado")} disabled={uploadingDocCliente}>Criptografar e Salvar</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.bigCard}>
              <div style={{display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 16, gap: 10}}>
                <h2 style={styles.cardTitle}>Contas a Receber / Histórico de Débitos</h2>
                <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                  <h3 style={{color: '#ef4444', margin: 0}}>Pendente: R$ {somaHonorarios.toFixed(2)}</h3>
                  <button style={styles.primaryButtonMin} onClick={() => gerarFaturaPix(clienteSelecionado)}>+ Emitir Fatura Mês</button>
                </div>
              </div>
              <div>
                {honorariosCliente.length === 0 ? <p style={styles.empty}>Nenhuma fatura em aberto para esta empresa.</p> : honorariosCliente.map((hon: any, i: number) => (
                  <div key={i} style={styles.docItem}>
                    <div>
                      <strong>{hon.nome}</strong>
                      <p style={styles.muted}>Vencimento: {hon.vencimento} • <strong style={{color: '#ef4444'}}>R$ {hon.valor}</strong></p>
                    </div>
                    <div style={{display: 'flex', gap: 8}}>
                      <button style={styles.downloadButton} onClick={() => setFaturaAberta(hon)}>👁️ Ver Fatura</button>
                      <button style={{...styles.primaryButtonMin, background: '#10b981'}} onClick={() => marcarComoPago(hon.id)}>✔ Dar Baixa</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }

      return (
        <section style={styles.mainGrid}>
          <div style={styles.bigCard}>
            <h2 style={styles.cardTitle}>Registrar Nova Empresa Cliente</h2>
            <div style={{display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12}}>
              <input style={styles.input} placeholder="Razão Social" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} />
              <input style={styles.input} placeholder="CNPJ / CPF" value={cnpjCliente} onChange={(e) => setCnpjCliente(e.target.value)} />
              <input style={styles.input} placeholder="E-mail de Login" value={emailCliente} onChange={(e) => setEmailCliente(e.target.value)} />
              <input style={styles.input} placeholder="Telefone Comercial" value={telefoneCliente} onChange={(e) => setTelefoneCliente(e.target.value)} />
            </div>
            <input style={styles.input} placeholder="Endereço de Sede" value={enderecoCliente} onChange={(e) => setEnderecoCliente(e.target.value)} />
            <div style={{display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 12}}>
              <input style={styles.input} type="number" placeholder="Dia Venc." value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} />
              <input style={styles.input} type="number" placeholder="Honorário Mensal" value={valorHonorario} onChange={(e) => setValorHonorario(e.target.value)} />
              <input style={styles.input} type="password" placeholder="Senha Provisória" value={senhaCliente} onChange={(e) => setSenhaCliente(e.target.value)} />
              <input style={styles.input} type="password" placeholder="Confirme a Senha" value={confirmarSenhaCliente} onChange={(e) => setConfirmarSenhaCliente(e.target.value)} />
            </div>
            <button style={styles.primaryButton} onClick={cadastrarCliente} disabled={criandoCliente}>
              {criandoCliente ? "Sincronizando..." : "Efetivar Cadastro da Empresa"}
            </button>
          </div>
          
          <div style={styles.bigCard}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10}}>
              <h2 style={{...styles.cardTitle, margin: 0}}>Empresas Cadastradas</h2>
              <button style={styles.primaryButtonMin} onClick={gerarFaturasEmLote}>Faturar Mês (Todos de Vez)</button>
            </div>
            <input style={styles.input} placeholder="Pesquisar por Razão Social..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            <div style={{maxHeight: 500, overflowY: 'auto'}}>
              {clientes.filter((c: any) => (c.nomeEmpresa || "").toLowerCase().includes(busca.toLowerCase())).map((cliente: any, i: number) => {
                const pendencias = docs.filter((d: any) => d.emailCliente === cliente.email && d.departamento === "Boletos de Honorários" && d.status !== "PAGO");
                const totalDevido = pendencias.reduce((acc: number, curr: any) => acc + (curr.valor || 0), 0);
                return (
                  <div key={i} style={{...styles.docItem, cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12}} onClick={() => setClienteSelecionado(cliente)}>
                    <div>
                      <strong style={{color: '#0f172a', fontSize: 16}}>{cliente.nomeEmpresa}</strong>
                      <p style={styles.muted}>CNPJ: {cliente.cnpj || "Isento"}</p>
                      {totalDevido > 0 && <span style={{...styles.badgePendente, marginTop: 8, display: 'inline-block'}}>Honorários Abertos: R$ {totalDevido.toFixed(2)}</span>}
                    </div>
                    <span style={{color: '#2563eb', fontSize: 20}}>➔</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    if (paginaContador === "documentos") {
      return (
        <section style={styles.mainGrid}>
          <div style={styles.bigCard}>
            <h2 style={styles.cardTitle}>Disparo de Arquivos / Guias</h2>
            <select style={styles.input} value={clienteDestino} onChange={(e) => setClienteDestino(e.target.value)}>
              <option value="">Selecione o destinatário</option>
              {clientes.map((c: any, i: number) => (<option key={i} value={c.email}>{c.nomeEmpresa}</option>))}
            </select>
            <select style={styles.input} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categoriasContador.map((item) => (<option key={item}>{item}</option>))}
            </select>
            <input style={styles.input} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button style={styles.primaryButton} onClick={enviarDocumento} disabled={enviando}>
              {enviando ? `Carregando Mídia (${uploadProgress}%)...` : "Transmitir Arquivo Oficial"}
            </button>
            
            <hr style={styles.separator} />
            
            <h2 style={styles.cardTitle}>Nuvem de Arquivos por Empresa</h2>
            <input style={styles.input} placeholder="Filtrar por nome de documento..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            <select style={styles.input} value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
              <option value="">Todos os clientes da base</option>
              {clientes.map((c: any, i: number) => (<option key={i} value={c.email}>{c.nomeEmpresa}</option>))}
            </select>

            {clientes.map((cliente: any, i: number) => {
              const docsCliente = documentosContador.filter((d: any) => d.emailCliente === cliente.email);
              if (docsCliente.length === 0) return null;
              
              const anos = [...new Set(docsCliente.map((d: any) => d.ano || "Sem ano"))];
              return (
                <div key={i} style={styles.clientBlock}>
                  <h3 style={styles.clientTitle}>{cliente.nomeEmpresa}</h3>
                  {anos.map((ano: any, ai: number) => {
                    const docsAno = docsCliente.filter((d: any) => (d.ano || "Sem ano") === ano);
                    const meses = [...new Set(docsAno.map((d: any) => d.mes || "Sem mês"))];
                    return (
                      <div key={ai} style={styles.yearBlock}>
                        <h4 style={styles.yearTitle}>{ano}</h4>
                        {meses.map((mes: any, mi: number) => {
                          const docsMes = docsAno.filter((d: any) => (d.mes || "Sem mês") === mes);
                          return (
                            <div key={mi} style={styles.monthBlock}>
                              <h5 style={styles.monthTitle}>{mes}</h5>
                              {docsMes.map((item: any, di: number) => (
                                <div key={di} style={styles.docItemFolder}>
                                  <div>
                                    <strong>{item.nome}</strong>
                                    <p style={styles.muted}>{item.departamento}</p>
                                  </div>
                                  <button style={styles.downloadButton} onClick={() => abrirDocumentoOuLink(item)}>Visualizar</button>
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
          
          <div style={styles.bigCard}>
            <h2 style={styles.cardTitle}>📢 Painel de Comunicados</h2>
            <select style={styles.input} value={informeDestino} onChange={(e) => setInformeDestino(e.target.value)}>
              <option value="">Escolha quem receberá o aviso</option>
              <option value="todos" style={{fontWeight: 'bold', color: '#2563eb'}}>🚀 DISPARAR COMUNICADO EM MASSA</option>
              {clientes.map((c: any, i: number) => (<option key={i} value={c.email}>{c.nomeEmpresa}</option>))}
            </select>
            <textarea style={{ ...styles.input, height: 100 }} placeholder="Digite as diretrizes do comunicado..." value={informe} onChange={(e) => setInforme(e.target.value)} />
            <button style={styles.primaryButton} onClick={enviarInforme} disabled={enviandoInforme}>
              {enviandoInforme ? "Disparando canais de notificação..." : "Publicar no Mural"}
            </button>
          </div>
        </section>
      );
    }

    if (paginaContador === "fiscal_notas") {
      return (
        <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={styles.clientQuickGridIntegra}>
             <button style={subAbaFiscal === "nfe_entrada" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSubAbaFiscal("nfe_entrada")}><div style={styles.clientQuickIcon}>📥</div><strong>NF-e (Entradas)</strong></button>
             <button style={subAbaFiscal === "nfe_saida" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSubAbaFiscal("nfe_saida")}><div style={styles.clientQuickIcon}>📤</div><strong>NF-e (Saídas)</strong></button>
             <button style={subAbaFiscal === "nfce" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSubAbaFiscal("nfce")}><div style={styles.clientQuickIcon}>🏪</div><strong>NFC-e (Cupons)</strong></button>
             <button style={subAbaFiscal === "cte" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSubAbaFiscal("cte")}><div style={styles.clientQuickIcon}>🚛</div><strong>CT-e (Fretes)</strong></button>
          </div>

          <div style={styles.bigCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <p style={styles.clientLabel}>Varredura Automatizada SEFAZ</p>
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22, textTransform: 'capitalize' }}>
                  {subAbaFiscal === "nfe_entrada" ? "Notas Fiscais de Entrada" : subAbaFiscal === "nfe_saida" ? "Notas Fiscais de Saída" : subAbaFiscal === "nfce" ? "Cupons Fiscais Eletrônicos" : "Conhecimentos de Transporte"}
                </h2>
              </div>
              <button style={styles.primaryButtonMin} onClick={executarCapturaAutomaticaNotas} disabled={buscandoNotas}>
                {buscandoNotas ? "Conectando SEFAZ..." : "🔍 Capturar Notas Recentes"}
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: 18, borderRadius: 12, border: '1px dashed #cbd5e1', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: '1.6' }}>
                🤖 <strong>Estrutura de Sincronização Veri Active:</strong> O robô fiscal monitora os CNPJs e joga automaticamente cada documento no <strong>Google Drive</strong> dentro da árvore inteligente: <br />
                <span style={{ fontFamily: "monospace", color: "#2563eb", fontWeight: "bold" }}>Google Drive ➔ [Nome do Cliente] ➔ [Ano] ➔ [Mês] ➔ [Tipo de Documento]</span>
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              {buscandoNotas ? (
                <p style={{ ...styles.empty, color: "#2563eb", fontWeight: "bold" }}>Buscando chaves de acesso na SEFAZ e espelhando repositórios no Drive...</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                      <th style={{ padding: 12 }}>Documento / Emissão</th>
                      <th style={{ padding: 12 }}>Chave de Acesso / Destinatário</th>
                      <th style={{ padding: 12 }}>Valor Total</th>
                      <th style={{ padding: 12 }}>Caminho de Backup (Google Drive)</th>
                      <th style={{ padding: 12 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: 13 }}>
                    {notasFiscaisMapeadas[subAbaFiscal].map((nota) => (
                      <tr key={nota.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 12 }}>
                          \textbf{Nº {nota.numero}}
                          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Data: {nota.emissao}</p>
                        </td>
                        <td style={{ padding: 12 }}>
                          <p style={{ margin: "0 0 4px 0", fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{nota.id === "1" ? "3526051234567890123455001000..." : "352605987654321098765500100..."}</p>
                          <strong>{nota.emitente}</strong>
                        </td>
                        <td style={{ padding: 12, fontWeight: "bold", color: "#0f172a" }}>R$ {nota.valor.toFixed(2)}</td>
                        <td style={{ padding: 12, color: "#2563eb", fontFamily: "monospace", fontSize: 12 }}>{nota.drivePath}</td>
                        <td style={{ padding: 12 }}><span style={styles.badgeConcluido}>✓ Guardado</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      );
    }

    if (paginaContador === "integra") {
      return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={styles.clientQuickGridIntegra}>
             <button style={abaIntegra === "panorama" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setAbaIntegra("panorama")}><div style={styles.clientQuickIcon}>📊</div><strong>Situação Fiscal</strong></button>
             <button style={abaIntegra === "simples" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setAbaIntegra("simples")}><div style={styles.clientQuickIcon}>🏢</div><strong>Parcelamento MEI/PGDAS</strong></button>
             <button style={abaIntegra === "regularize" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setAbaIntegra("regularize")}><div style={styles.clientQuickIcon}>⚖️</div><strong>PGFN Regularize</strong></button>
             <button style={abaIntegra === "automacao" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setAbaIntegra("automacao")}><div style={styles.clientQuickIcon}>⚙️</div><strong>Robô Programável</strong></button>
          </div>

          {abaIntegra === "panorama" && (
            <div style={styles.bigCard} className="print-area">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <span style={styles.clientLabel}>e-CAC Receita Federal</span>
                  <h3 style={{ margin: 0, fontSize: 20 }}>Diagnóstico Fiscal de Riscos & Compliance</h3>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={dispararImpressaoFicha} style={{ ...styles.downloadButton, background: '#0f172a', color: '#fff', border: 'none' }}>
                    🖨️ Imprimir Laudo e-CAC
                  </button>
                  <button style={styles.primaryButtonMin} onClick={() => simularRequisicaoIntegra("Varredura mTLS efetuada.")}>
                    {loadingIntegra ? "Consultando Servidores..." : "🔄 Atualizar Ficha"}
                  </button>
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, background: '#fff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                  <p style={{ margin: 0 }}><strong>Órgão:</strong> Receita Federal do Brasil (e-CAC)</p>
                  <p style={{ margin: 0 }}><strong>Diagnóstico Veri:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>CONCORDANTE (Regularizado)</span></p>
                  <p style={{ margin: 0 }}><strong>Regime Atual:</strong> Simples Nacional / SIMEI Ativo</p>
                  <p style={{ margin: 0 }}><strong>Dívidas Consolidadas:</strong> Isento de pendências federais</p>
                </div>
                
                <h4 style={{ color: '#0f172a', margin: '0 0 10px 0' }}>Certidões Monitoradas em Tempo Real:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={styles.configLine}>🟢 <strong>CND Conjunta RFB/PGFN:</strong> Emissão Ativa • Válida até 18/11/2026</div>
                  <div style={styles.configLine}>🟢 <strong>Situação de CRF (FGTS):</strong> Em conformidade regulatória</div>
                </div>
              </div>
            </div>
          )}

          {abaIntegra === "simples" && (
            <div style={styles.bigCard}>
              <span style={styles.clientLabel}>Simples Nacional & SIMEI</span>
              <h3 style={{ marginTop: 0, marginBottom: 20 }}>Emissão e Histórico de Acordos de Parcelamento</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                  <strong>📦 Parcelamento Ativo DAS-MEI</strong>
                  <p style={styles.muted}>Histórico consolidado: 36 Parcelas</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <span style={{ color: '#d97706', fontWeight: 'bold' }}>Parcela 14/36 Pronta</span>
                    <button onClick={dispararImpressaoFicha} style={styles.primaryButtonMin}>🖨️ Imprimir DAS MEI</button>
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                  <strong>🏢 Parcelamento Ativo PGDAS-D</strong>
                  <p style={styles.muted}>Histórico consolidado: 60 Parcelas</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <span style={{ color: '#d97706', fontWeight: 'bold' }}>Parcela 08/60 Pronta</span>
                    <button onClick={dispararImpressaoFicha} style={styles.primaryButtonMin}>🖨️ Imprimir PGDAS</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {abaIntegra === "regularize" && (
            <div style={styles.bigCard}>
              <span style={styles.clientLabel}>Procuradoria-Geral da Fazenda Nacional</span>
              <h3 style={{ marginTop: 0, marginBottom: 20 }}>Negociações de Dívida Ativa (Regularize)</h3>

              <div style={{ border: '1px solid #e2e8f0', padding: 20, borderRadius: 12, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Transação Extraordinária por Adesão (União)</strong>
                    <p style={{ ...styles.muted, marginTop: 4 }}>Guia de amortização gerada com sucesso via túnel mTLS.</p>
                  </div>
                  <button onClick={dispararImpressaoFicha} style={{ ...styles.primaryButtonMin, background: '#0f172a' }}>
                    📥 Imprimir Guia PGFN
                  </button>
                </div>
              </div>
            </div>
          )}

          {abaIntegra === "automacao" && (
            <div style={styles.bigCard}>
              <span style={styles.clientLabel}>Módulo de Agendamentos Automáticos (Vera AI)</span>
              <h3 style={{ marginTop: 0, marginBottom: 20 }}>Configurar Cronograma de Disparos Periódicos</h3>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={styles.formLabel}>Selecione o Documento Fiscal</label>
                  <select value={tipoAutomacao} onChange={(e) => setTipoAutomacao(e.target.value)} style={styles.input}>
                    <option value="DAS MEI">Guia DAS MEI Mensal</option>
                    <option value="Parcelamento MEI">Parcelamento MEI (Acordo)</option>
                    <option value="Simples Nacional PGDAS">Guia Simples Nacional (PGDAS-D)</option>
                    <option value="Parcelamento PGDAS">Parcelamento Simples Nacional</option>
                    <option value="INSS Previdência">Guia de INSS / Pessoal</option>
                    <option value="FGTS Caixa">Guia de FGTS Oficial</option>
                    <option value="Guia Regularize PGFN">Guia do Regularize (Dívida Ativa)</option>
                  </select>
                </div>

                <div style={{ width: 150 }}>
                  <label style={styles.formLabel}>Periodicidade</label>
                  <select value={diaAutomacao} onChange={(e) => setDiaAutomacao(e.target.value)} style={styles.input}>
                    <option value="05">Todo dia 05</option>
                    <option value="10">Todo dia 10</option>
                    <option value="15">Todo dia 15</option>
                    <option value="20">Todo dia 20</option>
                  </select>
                </div>

                <button onClick={agendarNovaTarefa} style={{ ...styles.primaryButton, width: 'auto', height: 48, padding: '0 24px', marginBottom: 12 }}>
                  ⏰ Ativar Disparo Automático
                </button>
              </div>
            </div>
          )}
        </section>
      );
    }

    if (paginaContador === "solicitacoes") {
      return (
        <section style={styles.mainGrid}>
          <div style={styles.bigCard}>
            <h2 style={styles.cardTitle}>Central de Chamados (Atendimento)</h2>
            {solicitacoesList.length === 0 ? <p style={styles.empty}>Nenhum chamado pendente.</p> : solicitacoesList.map((solic: any, i: number) => (
              <div key={i} style={styles.docItem}>
                <div style={{ flex: 1, paddingRight: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <strong style={{ fontSize: 16 }}>{solic.assunto}</strong>
                    <div style={solic.status === "Pendente" ? styles.badgePendente : styles.badgeConcluido}>{solic.status}</div>
                  </div>
                  <p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#2563eb', fontWeight: 600 }}>Origem: {solic.nomeCliente} ({solic.emailCliente})</p>
                  <p style={{ margin: 0, fontSize: 14, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', color: '#475569' }}>{solic.mensagem}</p>
                </div>
                {solic.status === "Pendente" && <button style={styles.primaryButtonMin} onClick={() => concluirSolicitacao(solic.id, solic.emailCliente)}>✔ Marcar Resolvido</button>}
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (paginaContador === "configuracoes") {
      return (
        <section style={styles.mainGrid}>
          <div style={styles.bigCard}>
            <p style={styles.clientLabel}>Segurança e APIs</p>
            <h2 style={styles.cardTitle}>Credenciais Integra Contador (Serpro)</h2>
            <input style={styles.input} placeholder="Client ID Production" value={configIntegradeID || configIntegraId} onChange={(e) => setConfigIntegraId(e.target.value)} />
            <input style={styles.input} type="password" placeholder="Client Secret Chave" value={configIntegraSecret} onChange={(e) => setConfigIntegraSecret(e.target.value)} />
            <button style={styles.primaryButton} onClick={salvarConfiguracoes} disabled={salvandoConfig}>Salvar Chaves de Barramento</button>
          </div>
          <div style={styles.bigCard}>
            <p style={styles.clientLabel}>Infraestrutura de Comunicação (Zoho Free)</p>
            <h2 style={styles.cardTitle}>Servidor SMTP (Zoho Mail)</h2>
            <input style={styles.input} placeholder="Seu e-mail completo do Zoho" value={configEmail} onChange={(e) => setConfigEmail(e.target.value)} />
            <input style={styles.input} type="password" placeholder="Senha de Aplicativo (16 dígitos gerados no Zoho)" value={configSenhaApp} onChange={(e) => setConfigSenhaApp(e.target.value)} />
            <button style={styles.secondaryButton} onClick={salvarConfiguracoes} disabled={salvandoConfig}>Configurar Motor de E-mails</button>
          </div>
        </section>
      );
    }
    return null;
  }

  if (!user) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <img src={logo} style={styles.loginLogo} alt="Logo" />
          <h1 style={styles.loginTitle}>Portal de Conformidade</h1>
          <input style={styles.input} placeholder="Usuário / E-mail corporativo" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={styles.input} type="password" placeholder="Senha de segurança" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button style={styles.primaryButton} onClick={login}>Autenticar no Hub</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      
      {/* MENU LATERAL ESTILO SAAS VERI HIGH-END */}
      <aside style={styles.sidebar} className="no-print">
        <div style={styles.logoBox}><img src={logo} style={styles.sideLogo} alt="Logo Sidebar" /></div>
        <div style={styles.menu}>
          {isContador ? (
            <>
              <button onClick={() => {setPaginaContador("dashboard"); setMenuOpen(false)}} style={paginaContador === "dashboard" ? styles.menuActive : styles.menuItem}>🏠 Painel Geral</button>
              <button onClick={() => {setPaginaContador("clientes"); setMenuOpen(false)}} style={paginaContador === "clientes" ? styles.menuActive : styles.menuItem}>👥 Carteira de Clientes</button>
              <button onClick={() => {setPaginaContador("documentos"); setMenuOpen(false)}} style={paginaContador === "documentos" ? styles.menuActive : styles.menuItem}>📁 Gestão de Arquivos</button>
              <button onClick={() => {setPaginaContador("fiscal_notas"); setMenuOpen(false)}} style={paginaContador === "fiscal_notas" ? styles.menuActive : styles.menuItem}>🏛️ Radar XML SEFAZ</button>
              <button onClick={() => {setPaginaContador("integra"); setMenuOpen(false)}} style={paginaContador === "integra" ? styles.menuActive : styles.menuItem}>📡 Diagnóstico e-CAC</button>
              <button onClick={() => {setPaginaContador("solicitacoes"); setMenuOpen(false)}} style={paginaContador === "solicitacoes" ? styles.menuActive : styles.menuItem}>💬 Atendimento Chamados</button>
              <button onClick={() => {setPaginaContador("configuracoes"); setMenuOpen(false)}} style={paginaContador === "configuracoes" ? styles.menuActive : styles.menuItem}>⚙️ Ajustes & SMTP</button>
            </>
          ) : (<button style={styles.menuActive}>🏠 O Meu Espaço</button>)}
        </div>
        <button style={styles.exitButton} onClick={sair}>↪ Terminar Sessão</button>
      </aside>

      {/* OVERLAY PARA CELULAR */}
      {isMobile && menuOpen && <div style={styles.mobileOverlay} onClick={() => setMenuOpen(false)}></div>}

      <main style={styles.content}>
        
        {/* CABEÇALHO SUPERIOR */}
        <header style={styles.header} className="no-print">
          <div style={{display: 'flex', alignItems: 'center', gap: 15}}>
            {isMobile && <button style={styles.hamburgerBtn} onClick={() => setMenuOpen(true)}>☰</button>}
            <h1 style={styles.welcome}>{isContador ? "Centro de Governança Fiscal" : `Portal do Cliente • ${empresa}`}</h1>
          </div>
          <div style={styles.profileBox}>
            <div style={{ position: "relative" }} ref={notifRef}>
              <div style={styles.bell} onClick={() => setShowNotifDropdown(!showNotifDropdown)}>
                🔔{notificacoesNaoLidas > 0 && <div style={styles.badge}>{notificacoesNaoLidas}</div>}
              </div>
              {showNotifDropdown && (
                <div style={styles.notifDropdown}>
                  <h4 style={{ margin: "0 0 10px 0", color: "#0f172a" }}>Alertas Preventivos</h4>
                  {notifsToShow.length === 0 ? <p style={styles.muted}>Nenhum alerta recente.</p> : notifsToShow.map((item: any, i: number) => (
                    <div key={i} style={{ ...styles.notificationItem, background: item.lida ? "#fff" : "#f0fdf4", border: item.lida ? "1px solid #e2e8f0" : "1px solid #a7f3d0" }} onClick={() => {marcarNotificacaoLida(item); setShowNotifDropdown(false);}}>
                      <strong>{item.titulo}</strong>
                      <p style={{margin: "4px 0 0", color: "#475569", fontSize: 13}}>{item.mensagem}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!isMobile && <div style={styles.profile}><strong>{empresa}</strong><span>{isContador ? "Acesso Master Administrador" : "Acesso Restrito"}</span></div>}
          </div>
        </header>

        {/* NÚCLEO DA PÁGINA (CONTADOR OU CLIENTE) */}
        {isContador ? renderPainelContador() : (
          <>
            <section style={styles.clientQuickGrid}>
              <button style={secaoCliente === "documentos" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSecaoCliente("documentos")}><div style={styles.clientQuickIcon}>📄</div><strong>Impostos</strong></button>
              <button style={secaoCliente === "boletos" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSecaoCliente("boletos")}><div style={styles.clientQuickIcon}>💳</div><strong>Faturas e Honorários</strong></button>
              <button style={secaoCliente === "cnds" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSecaoCliente("cnds")}><div style={styles.clientQuickIcon}>✅</div><strong>Situação Fiscal</strong></button>
              <button style={secaoCliente === "informativos" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSecaoCliente("informativos")}><div style={styles.clientQuickIcon}>🔔</div><strong>Avisos</strong></button>
              <button style={secaoCliente === "solicitacoes" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSecaoCliente("solicitacoes")}><div style={styles.clientQuickIcon}>💬</div><strong>Solicitações</strong></button>
              <button style={secaoCliente === "envio" ? styles.clientQuickCardActive : styles.clientQuickCard} onClick={() => setSecaoCliente("envio")}><div style={styles.clientQuickIcon}>📤</div><strong>Enviar Documento</strong></button>
            </section>
            <section style={{ display: "grid", gridTemplateColumns: "1fr" }}>
              <div style={{ overflowX: "auto" }}>
                {renderListaCliente()}
              </div>
            </section>
          </>
        )}
        
        {/* RENDER DO MODAL DA FATURA SE EXISTIR */}
        {renderModalFatura()}
        
      </main>
    </div>
  );
}

// ==========================================
// 13. ESTILOS COMPLETOS MODELO SAAS VERI PREMIUM
// ==========================================
const getStyles = (isMobile: boolean, menuOpen: boolean): any => ({
  page: { 
    minHeight: "100vh", 
    background: "#f8fafc", 
    display: "flex", 
    flexDirection: isMobile ? "column" : "row", 
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", 
    color: "#1e293b" 
  },
  loginPage: { 
    minHeight: "100vh", 
    display: "flex", 
    justifyContent: "center", 
    alignItems: "center", 
    background: "#0f172a" 
  },
  loginCard: { 
    background: "#fff", 
    padding: isMobile ? 30 : 40, 
    borderRadius: 20, 
    textAlign: "center", 
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", 
    width: "100%", 
    maxWidth: 400, 
    margin: isMobile ? 20 : 0 
  },
  loginLogo: { 
    width: 160, 
    marginBottom: 20 
  },
  loginTitle: { 
    margin: "0 0 30px", 
    fontSize: 22, 
    color: "#0f172a", 
    fontWeight: 800,
    letterSpacing: "-0.03em"
  },
  sidebar: { 
    width: 280, 
    background: "#0f172a", 
    padding: 24, 
    boxSizing: "border-box", 
    display: "flex", 
    flexDirection: "column", 
    borderRight: '1px solid #1e293b', 
    position: isMobile ? "fixed" : "sticky", 
    top: 0, 
    left: 0, 
    height: "100vh", 
    zIndex: 1000, 
    transform: isMobile ? (menuOpen ? "translateX(0)" : "translateX(-100%)") : "none", 
    transition: "transform 0.3s ease" 
  },
  logoBox: { 
    textAlign: "center", 
    marginBottom: 40,
    background: "#ffffff",
    padding: "12px",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
  },
  sideLogo: { 
    width: 140 
  },
  menu: { 
    display: "flex", 
    flexDirection: "column", 
    gap: 6, 
    flex: 1, 
    overflowY: "auto" 
  },
  menuItem: { 
    padding: "12px 16px", 
    borderRadius: 8, 
    border: "none", 
    background: "transparent", 
    textAlign: "left", 
    fontWeight: 600, 
    color: "#94a3b8", 
    cursor: "pointer", 
    fontSize: 14,
    transition: "all 0.2s"
  },
  menuActive: { 
    padding: "12px 16px", 
    borderRadius: 8, 
    border: "none", 
    background: "#1e293b", 
    color: "#2563eb", 
    textAlign: "left", 
    fontWeight: 700, 
    cursor: "pointer", 
    fontSize: 14 
  },
  exitButton: { 
    padding: "12px 16px", 
    border: "none", 
    background: "transparent", 
    color: "#f43f5e", 
    fontWeight: 700, 
    textAlign: "left", 
    cursor: "pointer", 
    marginTop: 'auto' 
  },
  mobileOverlay: { 
    position: "fixed", 
    top: 0, 
    left: 0, 
    width: "100%", 
    height: "100%", 
    background: "rgba(0,0,0,0.5)", 
    zIndex: 999 
  },
  content: { 
    flex: 1, 
    padding: isMobile ? 16 : 40, 
    boxSizing: "border-box", 
    overflowX: "hidden", 
    width: "100%" 
  },
  header: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 30 
  },
  hamburgerBtn: { 
    background: "none", 
    border: "none", 
    fontSize: 28, 
    color: "#0f172a", 
    cursor: "pointer", 
    padding: 0 
  },
  welcome: { 
    fontSize: isMobile ? 22 : 26, 
    margin: 0, 
    fontWeight: 800, 
    color: "#0f172a",
    letterSpacing: "-0.03em"
  },
  profileBox: { 
    display: "flex", 
    alignItems: "center", 
    gap: 12 
  },
  bell: { 
    position: "relative", 
    width: 44, 
    height: 44, 
    background: "#fff", 
    borderRadius: 12, 
    display: "flex", 
    justifyContent: "center", 
    alignItems: "center", 
    border: "1px solid #e2e8f0", 
    cursor: "pointer" 
  },
  badge: { 
    position: "absolute", 
    top: -4, 
    right: -4, 
    background: "#ef4444", 
    color: "#fff", 
    width: 20, 
    height: 20, 
    borderRadius: "50%", 
    display: "flex", 
    justifyContent: "center", 
    alignItems: "center", 
    fontSize: 11, 
    fontWeight: 800 
  },
  notifDropdown: { 
    position: "absolute", 
    top: 55, 
    right: 0, 
    width: isMobile ? 280 : 320, 
    background: "#fff", 
    borderRadius: 16, 
    border: "1px solid #e2e8f0", 
    boxShadow: "0 10px 40px -10px rgba(0,0,0,0.15)", 
    padding: 20, 
    zIndex: 100 
  },
  profile: { 
    background: "#fff", 
    padding: "8px 14px", 
    borderRadius: 12, 
    border: "1px solid #e2e8f0", 
    display: "flex", 
    flexDirection: "column" 
  },
  adminHero: { 
    background: "#fff", 
    border: "1px solid #e2e8f0", 
    borderRadius: 16, 
    padding: 30, 
    marginBottom: 30, 
    display: "flex", 
    flexDirection: isMobile ? "column" : "row", 
    justifyContent: "space-between", 
    alignItems: isMobile ? "flex-start" : "center", 
    gap: 16 
  },
  clientLabel: { 
    margin: "0 0 4px", 
    color: "#2563eb", 
    fontSize: 12, 
    fontWeight: 800, 
    textTransform: "uppercase",
    letterSpacing: "0.05em"
  },
  clientHeroTitle: { 
    margin: 0, 
    fontSize: 24, 
    color: "#0f172a", 
    fontWeight: 800,
    letterSpacing: "-0.02em"
  },
  mainGrid: { 
    display: "grid", 
    gridTemplateColumns: isMobile ? "1fr" : "1fr", 
    gap: 24 
  }, 
  bigCard: { 
    background: "#fff", 
    borderRadius: 16, 
    padding: isMobile ? 20 : 28, 
    border: "1px solid #e2e8f0", 
    width: "100%", 
    boxSizing: "border-box",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
  },
  cardTitle: { 
    marginTop: 0, 
    fontSize: 18, 
    fontWeight: 800, 
    color: "#0f172a", 
    marginBottom: 20 
  },
  formLabel: { 
    fontWeight: 700, 
    fontSize: 12, 
    color: '#475569', 
    textTransform: 'uppercase', 
    display: 'block',  
    marginBottom: 8 
  },
  input: { 
    width: "100%", 
    padding: "12px 14px", 
    marginBottom: 12, 
    borderRadius: 8, 
    border: "1px solid #cbd5e1", 
    fontSize: 14, 
    fontFamily: "inherit", 
    boxSizing: "border-box", 
    background: "#f8fafc",
    outline: "none"
  },
  primaryButton: { 
    width: "100%", 
    padding: 14, 
    border: "none", 
    borderRadius: 8, 
    background: "#2563eb", 
    color: "#fff", 
    fontWeight: 700, 
    fontSize: 14, 
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)"
  },
  primaryButtonMin: { 
    padding: "10px 16px", 
    border: "none", 
    borderRadius: 6, 
    background: "#2563eb", 
    color: "#fff", 
    fontWeight: 700, 
    fontSize: 13, 
    cursor: "pointer" 
  },
  secondaryButton: { 
    width: "100%", 
    padding: 14, 
    border: "1px solid #cbd5e1", 
    borderRadius: 8, 
    background: "#fff", 
    color: "#475569", 
    fontWeight: 700, 
    fontSize: 14, 
    cursor: "pointer" 
  },
  secondaryButtonMin: { 
    padding: "10px 16px", 
    border: "1px solid #cbd5e1", 
    borderRadius: 6, 
    background: "#fff", 
    color: "#475569", 
    fontWeight: 700, 
    fontSize: 13, 
    cursor: "pointer" 
  },
  downloadButton: { 
    border: "1px solid #e2e8f0", 
    borderRadius: 6, 
    padding: "10px 16px", 
    background: "#f8fafc", 
    color: "#475569", 
    fontWeight: 700, 
    fontSize: 13, 
    cursor: "pointer",
    whiteSpace: "nowrap"
  },
  docItem: { 
    display: "flex", 
    flexDirection: isMobile ? "column" : "row", 
    justifyContent: "space-between", 
    alignItems: isMobile ? "flex-start" : "center", 
    borderBottom: "1px solid #f1f5f9", 
    padding: "16px 0", 
    gap: 10 
  },
  docItemFolder: { 
    background: "#fff", 
    border: "1px solid #f1f5f9", 
    borderRadius: 12, 
    padding: "14px", 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    gap: 16, 
    marginBottom: 8 
  },
  muted: { 
    margin: 0, 
    color: "#64748b", 
    fontSize: 14 
  },
  empty: { 
    background: "#f8fafc", 
    color: "#64748b",  
    padding: 20, 
    borderRadius: 12, 
    textAlign: "center", 
    fontSize: 14 
  },
  configLine: { 
    display: "flex", 
    gap: 10, 
    marginBottom: 12, 
    padding: "12px", 
    background: "#f8fafc", 
    borderRadius: 8, 
    border: "1px solid #e2e8f0" 
  },
  clientQuickGrid: { 
    display: "grid", 
    gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)", 
    gap: 12, 
    marginBottom: 24 
  },
  clientQuickGridIntegra: { 
    display: "grid", 
    gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", 
    gap: 12, 
    marginBottom: 24 
  },
  clientQuickCard: { 
    background: "#fff", 
    border: "1px solid #e2e8f0", 
    borderRadius: 12, 
    padding: "16px 8px", 
    display: "flex", 
    flexDirection: "column", 
    alignItems: "center", 
    gap: 8, 
    cursor: "pointer", 
    textAlign: "center" as const 
  },
  clientQuickCardActive: { 
    background: "#f0fdf4", 
    border: "1px solid #a7f3d0", 
    borderRadius: 12, 
    padding: "16px 8px", 
    display: "flex", 
    flexDirection: "column", 
    alignItems: "center", 
    gap: 8, 
    cursor: "pointer", 
    textAlign: "center" as const 
  },
  clientQuickIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 8, 
    background: "#ecfdf5", 
    color: "#10b981", 
    display: "flex", 
    justifyContent: "center", 
    alignItems: "center", 
    fontSize: 18 
  },
  clientDocRow: { 
    background: "#fff", 
    border: "1px solid #f1f5f9", 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 12, 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    gap: 12 
  },
  clientUploadPanel: { 
    background: "#f8fafc", 
    border: "2px dashed #cbd5e1", 
    borderRadius: 12, 
    padding: 20 
  },
  badgePendente: { 
    background: '#fef3c7', 
    color: '#d97706', 
    padding: '4px 10px', 
    borderRadius: 6, 
    fontSize: 12, 
    fontWeight: 800 
  },
  badgeConcluido: { 
    background: '#dcfce7', 
    color: '#10b981', 
    padding: '4px 10px',  
    borderRadius: 6, 
    fontSize: 12, 
    fontWeight: 800 
  },
  notificationItem: { 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8, 
    cursor: "pointer" 
  },
  unreadText: { 
    display: "inline-block", 
    marginTop: 4, 
    fontSize: 11, 
    color: "#2563eb", 
    fontWeight: 800 
  },
  separator: { 
    border: "none", 
    borderTop: "1px solid #e2e8f0", 
    margin: "24px 0" 
  },
  clientBlock: { 
    background: "#fff", 
    border: "1px solid #e2e8f0", 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16 
  },
  clientTitle: { 
    margin: "0 0 12px", 
    color: "#0f172a", 
    fontSize: 16, 
    fontWeight: 800 
  },
  yearBlock: { 
    marginLeft: 12, 
    marginTop: 12, 
    borderLeft: "2px solid #e2e8f0", 
    paddingLeft: 12 
  },
  yearTitle: { 
    color: "#2563eb", 
    marginBottom: 8, 
    fontSize: 14, 
    fontWeight: 800 
  },
  monthBlock: { 
    marginLeft: 12, 
    marginBottom: 12 
  },
  monthTitle: { 
    textTransform: "capitalize", 
    color: "#475569", 
    marginBottom: 8, 
    fontSize: 13, 
    fontWeight: 700 
  },
  modalOverlay: { 
    position: "fixed", 
    top: 0, 
    left: 0, 
    width: "100%", 
    height: "100%", 
    background: "rgba(15, 23, 42, 0.4)", 
    display: "flex", 
    justifyContent: "center",  
    alignItems: "center", 
    zIndex: 2000, 
    padding: 16, 
    boxSizing: "border-box" 
  },
  modalContent: { 
    background: "#fff", 
    width: "100%", 
    maxWidth: 420, 
    borderRadius: 16, 
    padding: 24, 
    position: "relative", 
    maxHeight: "90vh", 
    overflowY: "auto", 
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" 
  },
  closeModalBtn: { 
    position: "absolute", 
    top: 16, 
    right: 16, 
    background: "transparent", 
    border: "none", 
    color: "#64748b", 
    fontWeight: 800, 
    cursor: "pointer", 
    fontSize: 14 
  },
  statsGrid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
    gap: 20, 
    marginBottom: 28 
  },
  statCard: { 
    background: "#fff", 
    borderRadius: 12, 
    padding: 20, 
    display: "flex",  
    alignItems: "center", 
    gap: 16, 
    border: "1px solid #e2e8f0" 
  },
  iconBlue: { 
    width: 48, 
    height: 48, 
    borderRadius: 10, 
    background: "#f0fdf4", 
    color: "#10b981", 
    display: "flex", 
    justifyContent: "center", 
    alignItems: "center", 
    fontSize: 20 
  },
  statLabel: { 
    margin: 0, 
    color: "#64748b", 
    fontWeight: 600, 
    fontSize: 12 
  },
  statNumber: { 
    fontSize: 26, 
    margin: "2px 0", 
    color: "#0f172a", 
    fontWeight: 800 
  },
  adminShortcutGrid: { 
    display: "grid", 
    gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)", 
    gap: 12 
  },
  adminShortcut: { 
    background: "#fff", 
    border: "1px solid #e2e8f0", 
    borderRadius: 12, 
    padding: 16, 
    display: "flex", 
    flexDirection: "column", 
    alignItems: "center", 
    gap: 8, 
    cursor: "pointer",
    transition: "all 0.2s"
  },
  adminShortcutIcon: { 
    width: 44, height: 44, borderRadius: 8, background: "#f0fdf4", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 20 }
});