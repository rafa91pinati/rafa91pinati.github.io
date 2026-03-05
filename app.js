import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEQeIKc1MCrV8BJr0CH_mfjwCp1YiRC8s",
    authDomain: "agenda-4efa7.firebaseapp.com",
    projectId: "agenda-4efa7",
    storageBucket: "agenda-4efa7.firebasestorage.app",
    appId: "1:299659202964:web:e358210feb4d7784f63f81",
    messagingSenderId: "299659202964" 
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);
const storage = getStorage(app);

// VARIÁVEIS GLOBAIS
window.coresCategorias = { "Geral": "#94a3b8" }; 
window.logosCategorias = {}; 
window.todasAsCategorias = []; // NOVA: Para o modal de Outras... acessar
let categoriasAtivas = JSON.parse(localStorage.getItem('categoriasAgendaAtivas')) || ["Geral"];
let idEmEdicao = null;
let fotosTemporarias = []; 
let fotosNovasArray = [];  
let tipoFiltroTempo = 'dia'; 
let tagFiltroAtiva = ""; 
let timeFiltroAtivo = "";

window.usuarioLogado = null;
window.tarefasMonitoramento = [];
window.timesDasCategorias = {}; 

window.selecionarTag = (valor) => {
    tagFiltroAtiva = valor;
    carregarTarefas(); 
    carregarArquivosFixos(); 
};

window.selecionarTime = (valor) => {
    timeFiltroAtivo = valor;
    carregarTarefas(); 
    carregarArquivosFixos(); 
};

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('firebase-messaging-sw.js').catch(err => console.log('Erro SW:', err));
}

// --- LOGIN E AUTH ---
onAuthStateChanged(auth, async (user) => {
    const tela = document.getElementById('telaLogin');

    if (user) {
        // Usuário logado: Salva os dados e esconde a tela de bloqueio
        window.usuarioLogado = user;
        if(tela) tela.style.display = 'none';
        
        // Carrega as informações do Firebase
        await atualizarSeletorTimes();
        await carregarCategorias();
        
        // Desenha as categorias "gordinhas" e atualiza a interface
        renderizarCategoriasNoFiltro();
        
        // Define a visualização inicial (Hoje)
        setarData('hoje', document.getElementById('btnHoje'));
        carregarPreferenciasNuvem();
        
        // Aguarda um pouco para carregar os marcadores/tags
        setTimeout(() => { 
            atualizarSeletorMarcadores();
        }, 800);

    } else {
        // Usuário deslogado: Limpa os dados e mostra o bloqueio
        window.usuarioLogado = null;
        if(tela) {
            tela.style.display = 'flex';
            tela.classList.remove('escondido');
        }
    }
});

window.fazerLogin = () => {
    const e = document.getElementById('emailLogin').value;
    const s = document.getElementById('senhaLogin').value;
    if(!e || !s) return alert("Preencha tudo!");
    signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro ao entrar: " + err.code));
};

window.criarConta = () => {
    const e = document.getElementById('emailLogin').value;
    const s = document.getElementById('senhaLogin').value;
    if(s.length < 6) return alert("A senha deve ter 6 números/letras!");
    createUserWithEmailAndPassword(auth, e, s).then(() => alert("Conta criada e logada!")).catch(err => alert("Erro ao criar: " + err.code));
};

window.fazerLogout = () => { if(confirm("Deseja sair da agenda?")) signOut(auth); };

// --- ALARMES ---
window.carregarPreferenciasNuvem = async () => {
    if(!window.usuarioLogado) return;
    const docSnap = await getDoc(doc(db, "tokens_dispositivos", window.usuarioLogado.uid));
    if (docSnap.exists()) {
        const data = docSnap.data();
        if(data.minutosAntecedencia !== undefined) document.getElementById('tempoAntecedencia').value = String(data.minutosAntecedencia);
        if(data.tipoNotificacao) document.getElementById('tipoNotificacao').value = data.tipoNotificacao;
        if(data.somSelecionado) document.getElementById('somAlarmeSelecionado').value = data.somSelecionado;
        
        const btn = document.getElementById('btnConectarNuvem');
        btn.innerHTML = "✅ Conectado à Nuvem";
        btn.style.background = "#28a745";
    }
};

window.atualizarPreferenciasNuvem = async () => {
    const btn = document.getElementById('btnConectarNuvem');
    if (btn.innerText.includes("Conectado") && window.usuarioLogado) {
        await setDoc(doc(db, "tokens_dispositivos", window.usuarioLogado.uid), {
            minutosAntecedencia: document.getElementById('tempoAntecedencia').value,
            tipoNotificacao: document.getElementById('tipoNotificacao').value,
            somSelecionado: document.getElementById('somAlarmeSelecionado').value
        }, { merge: true });
    }
};

window.solicitarPermissaoNotificacao = () => {
    Notification.requestPermission().then((permission) => {
        if (permission == 'granted' && window.usuarioLogado) {
            const btn = document.getElementById('btnConectarNuvem');
            const textoOriginal = btn.innerHTML;
            btn.innerHTML = "⏳ Conectando..."; 
            
            navigator.serviceWorker.ready.then((registration) => {
                getToken(messaging, { 
                    vapidKey: 'BDyyehg3466Bi3B_awzlWOcaXxwhRu1kC8O8KStXQrP6BWuAI2h_iZ8zkvI89-nO01NqriRqlxPKvevxktY5SI8',
                    serviceWorkerRegistration: registration 
                }).then(async (currentToken) => {
                    if (currentToken) {
                        await setDoc(doc(db, "tokens_dispositivos", window.usuarioLogado.uid), {
                            tokens: arrayUnion(currentToken),
                            minutosAntecedencia: document.getElementById('tempoAntecedencia').value,
                            tipoNotificacao: document.getElementById('tipoNotificacao').value,
                            somSelecionado: document.getElementById('somAlarmeSelecionado').value
                        }, { merge: true });
                        btn.innerHTML = "✅ Conectado à Nuvem";
                        btn.style.background = "#28a745";
                        alert("Aparelho sincronizado na Nuvem!");
                    }
                }).catch(err => { alert("Erro de conexão."); btn.innerHTML = textoOriginal; });
            });
        } else alert("Você precisa logar e permitir notificações.");
    });
};

window.testarAlarme = () => {
    const somUrl = document.getElementById('somAlarmeSelecionado').value;
    new Audio(somUrl).play().catch(e => alert("Erro no som."));
    if(Notification.permission == 'granted') new Notification("Teste de Alarme", { body: "Notificação funcionando!" });
};

setInterval(() => {
    if (Notification.permission !== "granted") return; 
    const agora = new Date();
    const dataHojeStr = agora.toLocaleDateString('en-CA');
    const horaAtualMinutos = agora.getHours() * 60 + agora.getMinutes();
    const antecedencia = parseInt(document.getElementById('tempoAntecedencia').value) || 0;
    const somUrl = document.getElementById('somAlarmeSelecionado').value;

    window.tarefasMonitoramento.forEach(t => {
        if (t.dataString == dataHojeStr && t.hora && !t.alertaDisparado) {
            const [h, m] = t.hora.split(':').map(Number);
            if (((h * 60) + m) - antecedencia == horaAtualMinutos) {
                new Notification("Lembrete da Agenda", { body: `Sua tarefa "${t.descricao}" começa às ${t.hora}!`, requireInteraction: true });
                new Audio(somUrl).play().catch(console.error);
            }
        }
    });
}, 60000);

// --- UI GERAL ---
window.abrirConfig = () => { 
    document.getElementById('modalConfiguracoes').style.display = 'flex'; 
    carregarCategoriasModal(); 
    carregarMarcadoresModal(); 
    carregarTimes(); 
};

window.abrirAba = (evt, nomeAba) => {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";
    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) tablinks[i].classList.remove("active");
    document.getElementById(nomeAba).style.display = "block";
    evt.currentTarget.classList.add("active");
};

window.toggleSecao = (idC, idS) => { document.getElementById(idC).classList.toggle('escondido'); if(idS) document.getElementById(idS).classList.toggle('seta-expandida'); };
window.abrirFoto = (src) => { document.getElementById('imgGrande').src = src; document.getElementById('modalFotoExpandida').classList.remove('escondido'); };
window.fecharFoto = () => document.getElementById('modalFotoExpandida').classList.add('escondido');

// --- CATEGORIAS ---
window.fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

window.carregarCategorias = async () => {
    const c = document.getElementById('listaCategorias');
    if (!window.usuarioLogado) return;

    try {
        const meuEmail = window.usuarioLogado.email ? window.usuarioLogado.email.toLowerCase() : "";
        let meusTimesIds = [];

        if (meuEmail) {
            const qTimes = query(collection(db, "times"), where("membrosEmails", "array-contains", meuEmail));
            const snapTimes = await getDocs(qTimes);
            snapTimes.forEach(d => meusTimesIds.push(d.id));
        }

        const qCatPessoal = query(collection(db, "categorias"), where("uid", "==", window.usuarioLogado.uid));
        const snapCatPessoal = await getDocs(qCatPessoal);

        let categoriasUnicas = new Map();
        snapCatPessoal.forEach(d => { categoriasUnicas.set(d.id, d.data()); });

        if (meusTimesIds.length > 0) {
            const lotes = [];
            for (let i = 0; i < meusTimesIds.length; i += 10) lotes.push(meusTimesIds.slice(i, i + 10));
            for (let lote of lotes) {
                const qCatTime = query(collection(db, "categorias"), where("timeId", "in", lote));
                const snapCatTime = await getDocs(qCatTime);
                snapCatTime.forEach(d => { categoriasUnicas.set(d.id, d.data()); });
            }
        }

        // --- LÓGICA DE ORDENAÇÃO POR CLIQUE ---
        let ordemCliques = JSON.parse(localStorage.getItem('ordemCliquesCategorias')) || [];
        let arrayCategorias = Array.from(categoriasUnicas.values());

        arrayCategorias.sort((a, b) => {
            let idxA = ordemCliques.indexOf(a.nome);
            let idxB = ordemCliques.indexOf(b.nome);
            if (idxA === -1) idxA = 999;
            if (idxB === -1) idxB = 999;
            return idxA - idxB;
        });

        // SALVA GLOBALMENTE PARA O NOVO RENDERIZADOR USAR
        window.todasAsCategorias = arrayCategorias;

        arrayCategorias.forEach((cat) => {
            window.coresCategorias[cat.nome] = cat.cor;
            if (cat.logoUrl) window.logosCategorias[cat.nome] = cat.logoUrl;
            if (cat.timeId) window.timesDasCategorias[cat.nome] = cat.timeId;
        });

        // CHAMA A NOVA FUNÇÃO DE DESENHAR O LAYOUT EM PÍLULA
        window.renderizarCategoriasNoFiltro();
        
        await carregarTarefas();
        carregarArquivosFixos();
        carregarFinanceiro();

    } catch (e) {
        console.error("Erro nas categorias:", e);
        if(c) c.innerHTML = "<span style='color: #ef4444; padding: 10px; font-size: 0.85rem; font-weight: bold;'>Erro ao carregar categorias.</span>";
    }
};

// ==========================================

// FUNÇÕES DE RENDERIZAÇÃO DO FILTRO (EM LINHA ÚNICA)

// ==========================================

window.renderizarCategoriasNoFiltro = () => {

    const container = document.getElementById('listaCategorias');

    if (!container) return;

    

    container.innerHTML = ''; 

    

    // Pega as categorias da memória global

    let todas = window.todasAsCategorias || [];

    let semGeral = todas.filter(c => c.nome !== "Geral");

    

    // Mostra a Geral + as 3 últimas usadas

    let recents = semGeral.slice(0, 3); 

    let categoriasParaMostrar = [{nome: "Geral", cor: "#54627b"}, ...recents];



    categoriasParaMostrar.forEach((cat, index) => {

        const btn = document.createElement('button');

        // Verifica se a categoria está selecionada

        const isActive = categoriasAtivas.includes(cat.nome); 

        const iconeTime = (window.timesDasCategorias && window.timesDasCategorias[cat.nome]) ? 

            `<span style="margin-right: 4px;">👥</span>` : "";



        // ESTILO: Fonte 0.8rem e Padding maior conforme você pediu

        btn.style.cssText = "display: inline-flex; align-items: center; justify-content: center; border: none; font-weight: 800; font-size: 0.9rem; cursor: pointer; white-space: nowrap; transition: all 0.2s; border-radius: 16px; flex-shrink: 0;";

if (isActive) {
    btn.style.background = cat.cor || "#54627b";
    btn.style.color = "white";
    btn.style.padding = "10px 18px"; // Botão mais gordinho
    // ... restante do código
} else {
    btn.style.background = "rgba(255,255,255,0.5)";
    btn.style.color = "#64748b";
    btn.style.padding = "10px 14px"; // Botão mais gordinho
    // ... restante do código
}${cat.nome}`;

        }



        btn.onclick = () => window.selecionarCat(cat.nome, cat.cor); 

        container.appendChild(btn);

    });



    // Adiciona o botão "mais" (•••) gordinho no final

    const btnOutras = document.createElement('button');

    btnOutras.innerHTML = "•••";

    btnOutras.style.cssText = "background: #e2e8f0; color: #64748b; border: none; font-weight: 900; font-size: 0.8rem; padding: 8px 14px; cursor: pointer; border-radius: 16px; flex-shrink: 0;";

    btnOutras.onclick = () => window.abrirOutrasCategorias();

    container.appendChild(btnOutras);

};

window.abrirOutrasCategorias = function() {

    const containerModal = document.getElementById('listaTodasCategoriasModal');

    if (!containerModal) return;

    

    containerModal.innerHTML = ''; 



    // BLINDAGEM 1: Recupera as categorias ativas com segurança direto da memória

    let ativas = [];

    try {

        ativas = JSON.parse(localStorage.getItem('categoriasAgendaAtivas')) || ["Geral"];

    } catch(e) {

        ativas = ["Geral"];

    }



    // BLINDAGEM 2: Remove a "Geral" da lista puxada da nuvem para não duplicar

    let outras = (window.todasAsCategorias || []).filter(c => c.nome !== "Geral");

    

    // Junta a "Geral" fixa com as outras categorias

    const listaCompleta = [{nome: "Geral", cor: "#94a3b8"}, ...outras];



    listaCompleta.forEach(cat => {

        const btn = document.createElement('button');

        btn.innerText = cat.nome;

        

        const isActive = ativas.includes(cat.nome);

        

        btn.style.cssText = `background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-left: 5px solid ${cat.cor || '#cbd5e1'}; padding: 12px 15px; border-radius: 12px; font-weight: 800; font-size: 0.9rem; text-align: left; cursor: pointer; transition: all 0.2s; margin-bottom: 5px;`;

        

        if (isActive) {

            btn.style.background = "#54627b";

            btn.style.color = "white";

            btn.style.borderColor = "#54627b";

            btn.style.borderLeft = `5px solid ${cat.cor || 'white'}`;

        }



        btn.onclick = () => {

            window.selecionarCat(cat.nome, cat.cor); 

            window.fecharModal('modalOutrasCategorias'); 

        };

        

        containerModal.appendChild(btn);

    });



    // Abre o modal só depois de ter desenhado tudo com sucesso

    window.abrirModal('modalOutrasCategorias'); 

};
// ==========================================


window.selecionarCat = (nome, cor) => {
    // Registra o clique para a ordenação (Geral não entra na lista pois é fixa no início)
    if (nome !== "Geral") {
        let ordem = JSON.parse(localStorage.getItem('ordemCliquesCategorias')) || [];
        ordem = ordem.filter(n => n !== nome);
        ordem.unshift(nome);
        localStorage.setItem('ordemCliquesCategorias', JSON.stringify(ordem.slice(0, 50))); 
    }

    if (nome == "Geral") {
        categoriasAtivas = ["Geral"]; 
    } else {
        categoriasAtivas = categoriasAtivas.filter(c => c !== "Geral"); 
        if (categoriasAtivas.includes(nome)) {
            categoriasAtivas = categoriasAtivas.filter(c => c !== nome); 
            if (categoriasAtivas.length == 0) categoriasAtivas = ["Geral"]; 
        } else {
            categoriasAtivas.push(nome); 
        }
    }

    localStorage.setItem('categoriasAgendaAtivas', JSON.stringify(categoriasAtivas));

    // Re-renderiza chamando a função principal
    carregarCategorias();
};

window.adicionarCategoria = async () => {
    const nome = document.getElementById('novaCategoria').value;
    const cor = document.getElementById('corNovaCategoria').value;
    const logoInput = document.getElementById('logoCatInput');
    const logoFile = logoInput ? logoInput.files[0] : null;
    const timeSelecionado = document.getElementById('timeNovaCategoria').value;

    if(!nome) return alert("Digite o nome da categoria!");

    const btn = document.querySelector("button[onclick='adicionarCategoria()']");
    btn.disabled = true; 
    btn.innerHTML = "⏳";
    
    let logoBase64 = "";

    try {
        if (logoFile) logoBase64 = await window.fileToBase64(logoFile);
        
        await addDoc(collection(db, "categorias"), { 
            nome: nome, 
            cor: cor, 
            logoUrl: logoBase64, 
            uid: window.usuarioLogado.uid, 
            timeId: timeSelecionado || null,
            criadoEm: new Date() 
        });
        
        document.getElementById('novaCategoria').value = "";
        if (logoInput) logoInput.value = "";
        
        carregarCategoriasModal();
        carregarCategorias(); 
        alert("Categoria criada com sucesso!");
    } catch (e) { 
        alert("Erro ao salvar a categoria no banco de dados."); 
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = "+"; 
    }
};

window.carregarCategoriasModal = async () => {
    const lista = document.getElementById('listaCategoriasModal');
    if (!lista || !window.usuarioLogado) return;
    lista.innerHTML = "<p style='text-align:center; color:#cbd5e1;'>Carregando...</p>";

    try {
        const meuEmail = window.usuarioLogado.email ? window.usuarioLogado.email.toLowerCase() : "";
        let meusTimesIds = [];

        if (meuEmail) {
            const qTimes = query(collection(db, "times"), where("membrosEmails", "array-contains", meuEmail));
            const snapTimes = await getDocs(qTimes);
            snapTimes.forEach(d => meusTimesIds.push(d.id));
        }

        const qCatPessoal = query(collection(db, "categorias"), where("uid", "==", window.usuarioLogado.uid));
        const snapCatPessoal = await getDocs(qCatPessoal);

        let categoriasUnicas = new Map();
        snapCatPessoal.forEach(d => categoriasUnicas.set(d.id, d.data()));

        if (meusTimesIds.length > 0) {
            const lotes = [];
            for (let i = 0; i < meusTimesIds.length; i += 10) lotes.push(meusTimesIds.slice(i, i + 10));
            for (let lote of lotes) {
                const qCatTime = query(collection(db, "categorias"), where("timeId", "in", lote));
                const snapCatTime = await getDocs(qCatTime);
                snapCatTime.forEach(d => categoriasUnicas.set(d.id, d.data()));
            }
        }

        lista.innerHTML = "";

        categoriasUnicas.forEach((c, id) => {
            const logoPreview = c.logoUrl ? `<img src="${c.logoUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">` : `<span style="font-size:12px;">🖼️</span>`;
            const badgeTime = c.timeId ? `<span style="font-size: 0.65rem; background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px; font-weight: bold;">TIME</span>` : ``;
            
            lista.innerHTML += `
                <li style="display:flex; align-items:center; gap:8px; margin-bottom:10px; background: rgba(0,0,0,0.2); padding:10px; border-radius:8px; border: 1px solid rgba(255,255,255,0.1);">
                    <input type="color" value="${c.cor || '#007bff'}" onchange="atualizarCorCategoria('${id}', this.value)" style="width:35px; height:35px; border:none; padding:0; border-radius:4px; cursor:pointer; background:none;">
                    <div style="width: 35px; height: 35px; background: rgba(255,255,255,0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden;" onclick="document.getElementById('logo-edit-${id}').click()" title="Alterar Logo">
                        ${logoPreview}
                        <input type="file" id="logo-edit-${id}" accept="image/*" style="display: none;" onchange="atualizarLogoCategoria('${id}', this.files[0])">
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column; justify-content: center;">
                        <input type="text" value="${c.nome}" style="background:transparent; border:none; color:white; font-size:0.9rem; margin:0; padding:0;" onchange="atualizarNomeCategoria('${id}', this.value)">
                        <div style="margin-top: 4px;">${badgeTime}</div>
                    </div>
                    <button onclick="excluirCategoria('${id}')" style="background:rgba(239, 68, 68, 0.2); border:none; color:#ff8080; padding:8px; border-radius:6px; cursor:pointer;">🗑️</button>
                </li>`;
        });

        if(categoriasUnicas.size == 0) lista.innerHTML = "<p style='text-align:center; color:#94a3b8;'>Nenhuma encontrada.</p>";
    } catch (e) { 
        lista.innerHTML = "<p style='text-align:center; color:#ff4d4d;'>Erro ao carregar.</p>"; 
    }
};

window.atualizarCorCategoria = async (id, novaCor) => { await updateDoc(doc(db, "categorias", id), { cor: novaCor }); carregarCategorias(); };
window.atualizarNomeCategoria = async (id, novoNome) => { if(novoNome.trim()) { await updateDoc(doc(db, "categorias", id), { nome: novoNome }); carregarCategorias(); } };
window.excluirCategoria = async (id) => { if(confirm("Apagar categoria?")) { await deleteDoc(doc(db, "categorias", id)); carregarCategoriasModal(); carregarCategorias(); } };

window.atualizarLogoCategoria = async (id, file) => {
    if (!file) return;
    try {
        const logoBase64 = await window.fileToBase64(file);
        await updateDoc(doc(db, "categorias", id), { logoUrl: logoBase64 });
        carregarCategoriasModal(); carregarCategorias(); alert("Logo atualizada!");
    } catch (e) { alert("Erro ao atualizar."); }
};

// --- MARCADORES ---
window.adicionarMarcador = async () => {
    const nome = document.getElementById('nomeNovoMarcador').value;
    if(!nome) return alert("Digite o nome da etapa!");
    try {
        await addDoc(collection(db, "marcadores"), { nome: nome, uid: window.usuarioLogado.uid, criadoEm: new Date() });
        document.getElementById('nomeNovoMarcador').value = "";
        carregarMarcadoresModal(); atualizarSeletorMarcadores(); 
    } catch (e) { console.error(e); }
};

window.carregarMarcadoresModal = async () => {
    const lista = document.getElementById('listaMarcadoresModal');
    if(!lista || !window.usuarioLogado) return;
    lista.innerHTML = "<p style='text-align:center; color:#cbd5e1;'>Carregando...</p>";
    try {
        const q = query(collection(db, "marcadores"), where("uid", "==", window.usuarioLogado.uid));
        const snap = await getDocs(q);
        lista.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            lista.innerHTML += `
                <li style="display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.08); padding:12px; border-radius:12px; margin-bottom:8px; border: 1px solid rgba(255,255,255,0.1);">
                    <b style="color:#ffffff; font-size:0.95rem;">${m.nome}</b>
                    <button onclick="excluirMarcador('${d.id}')" style="background:rgba(239, 68, 68, 0.3); border:none; color:#ff8080; cursor:pointer; border-radius:8px; padding:8px 12px; font-weight:bold;">🗑️</button>
                </li>`;
        });
        if(snap.empty) lista.innerHTML = "<p style='text-align:center; color:#94a3b8;'>Nenhum marcador criado.</p>";
    } catch (e) { console.error(e); }
};

window.atualizarSeletorMarcadores = async () => {
    const seletor = document.getElementById('filtroTagGlobal');
    if (!seletor || !window.usuarioLogado) return;
    try {
        const q = query(collection(db, "marcadores"), where("uid", "==", window.usuarioLogado.uid));
        const snap = await getDocs(q);
        seletor.innerHTML = '<option value="">Todas as Etapas</option>';
        snap.forEach(d => {
            const m = d.data();
            const opcao = document.createElement('option');
            opcao.value = m.nome; opcao.textContent = m.nome;
            seletor.appendChild(opcao);
        });
    } catch (e) { console.error(e); }
};

window.excluirMarcador = async (id) => { if(confirm("Apagar etapa?")) { await deleteDoc(doc(db, "marcadores", id)); carregarMarcadoresModal(); atualizarSeletorMarcadores(); } };

// --- GERENCIAMENTO DE TIMES ---
window.criarTime = async () => {
    const nome = document.getElementById('nomeNovoTime').value;
    if(!nome) return alert("Digite o nome do time!");
    if(!window.usuarioLogado) return alert("Você precisa estar logado!");

    const btn = document.querySelector("button[onclick='criarTime()']");
    btn.innerHTML = "⏳"; btn.disabled = true;

    try {
        const novoTime = {
            nome: nome,
            criadorUid: window.usuarioLogado.uid,
            criadoEm: new Date(),
            membrosEmails: [window.usuarioLogado.email], 
            membros: [{ email: window.usuarioLogado.email, uid: window.usuarioLogado.uid, nivel: 'A' }]
        };

        await addDoc(collection(db, "times"), novoTime);
        document.getElementById('nomeNovoTime').value = "";
        carregarTimes();
        alert("Time criado com sucesso!");
    } catch (e) {
        alert("Erro ao criar o time.");
    } finally {
        btn.innerHTML = "Criar"; btn.disabled = false;
    }
};

window.carregarTimes = async () => {
    const listaGerencio = document.getElementById('listaTimesModal');
    const listaPertenco = document.getElementById('listaTimesPertencoModal');
    if(!listaGerencio || !listaPertenco || !window.usuarioLogado) return;
    
    listaGerencio.innerHTML = "<p style='text-align:center; color:#cbd5e1;'>Carregando...</p>";
    listaPertenco.innerHTML = "<p style='text-align:center; color:#cbd5e1;'>Carregando...</p>";

    try {
        const qGerencio = query(collection(db, "times"), where("criadorUid", "==", window.usuarioLogado.uid));
        const snapGerencio = await getDocs(qGerencio);
        listaGerencio.innerHTML = "";

        snapGerencio.forEach(d => {
            const t = d.data();
            let htmlMembros = t.membros.map(m => `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding-top:6px; border-top: 1px solid rgba(255,255,255,0.05);">
                    <span style="font-size: 0.85rem; word-break: break-all;">${m.email} ${m.email == window.usuarioLogado.email ? '<b style="color:#10b981;">(Você)</b>' : ''}</span> 
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-weight:bold; color:#f59e0b; font-size: 0.8rem;">Nível ${m.nivel}</span>
                        ${m.email !== window.usuarioLogado.email ? `<button onclick="removerMembro('${d.id}', '${m.email}')" style="background:rgba(239, 68, 68, 0.2); border:none; color:#ff8080; cursor:pointer; font-size:0.9rem; padding: 4px 8px; border-radius: 6px;" title="Remover membro">✕</button>` : ''}
                    </div>
                </div>
            `).join('');

            listaGerencio.innerHTML += `
                <li style="background: rgba(255,255,255,0.08); padding:15px; border-radius:12px; margin-bottom:12px; border: 1px solid rgba(37, 99, 235, 0.3); border-left: 4px solid #3b82f6;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                        <b style="color:#ffffff; font-size:1.1rem;">👑 ${t.nome}</b>
                        <button onclick="excluirTime('${d.id}')" style="background:rgba(239, 68, 68, 0.3); border:none; color:#ff8080; cursor:pointer; border-radius:8px; padding:6px 10px; font-weight:bold;">🗑️ Excluir</button>
                    </div>
                    
                    <div style="display: flex; gap: 8px; margin-bottom: 15px;">
                        <input type="email" id="email-membro-${d.id}" placeholder="E-mail do parceiro" style="flex:1; padding: 8px; border-radius: 8px; border: none; font-size: 0.85rem; margin:0; outline: none;">
                        <select id="nivel-membro-${d.id}" style="padding: 8px; border-radius: 8px; border: none; font-size: 0.85rem; margin:0; outline: none; cursor: pointer;">
                            <option value="B">Nível B (Editor)</option>
                            <option value="C">Nível C (Visual)</option>
                        </select>
                        <button onclick="adicionarMembro(event, '${d.id}')" style="background: linear-gradient(135deg, #3b82f6, #2563eb); color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold;">+ Add</button>
                    </div>

                    <div style="font-size: 0.8rem; color: #cbd5e1; background: rgba(0,0,0,0.25); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-weight: bold; margin-bottom: 5px; color: #94a3b8; text-transform: uppercase; font-size: 0.7rem;">Membros da Equipe:</div>
                        ${htmlMembros}
                    </div>
                </li>`;
        });
        if(snapGerencio.empty) listaGerencio.innerHTML = "<p style='text-align:center; color:#94a3b8; font-size: 0.85rem;'>Você não gerencia nenhum time.</p>";

        const meuEmailFormatado = window.usuarioLogado.email.trim().toLowerCase();
        const qPertenco = query(collection(db, "times"), where("membrosEmails", "array-contains", meuEmailFormatado));
        const snapPertenco = await getDocs(qPertenco);
        
        listaPertenco.innerHTML = "";
        let contPertenco = 0;

        snapPertenco.forEach(d => {
            const t = d.data();
            if (t.criadorUid !== window.usuarioLogado.uid) {
                contPertenco++;
                const meuPerfil = t.membros.find(m => m.email == meuEmailFormatado);
                const meuNivel = meuPerfil ? meuPerfil.nivel : "?";

                listaPertenco.innerHTML += `
                    <li style="background: rgba(255,255,255,0.08); padding:15px; border-radius:12px; margin-bottom:12px; border: 1px solid rgba(16, 185, 129, 0.3); border-left: 4px solid #10b981;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                            <b style="color:#ffffff; font-size:1.1rem;">🤝 ${t.nome}</b>
                            <span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.8rem;">Meu Nível: ${meuNivel}</span>
                        </div>
                        <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 5px;">
                            Administrador: ${t.membros.find(m => m.nivel == 'A')?.email || 'Desconhecido'}
                        </div>
                    </li>`;
            }
        });
        if(contPertenco == 0) listaPertenco.innerHTML = "<p style='text-align:center; color:#94a3b8; font-size: 0.85rem;'>Você não foi convidado para outros times.</p>";
        
    } catch (e) {
        listaGerencio.innerHTML = "<p style='color:#ef4444; text-align:center;'>Erro ao carregar.</p>";
    }
};

window.excluirTime = async (id) => {
    if(confirm("Tem certeza que deseja apagar este time? Isso afetará todos os membros.")) { 
        await deleteDoc(doc(db, "times", id)); 
        carregarTimes(); 
    } 
};

window.adicionarMembro = async (evento, timeId) => {
    const emailInput = document.getElementById(`email-membro-${timeId}`);
    const nivelSelect = document.getElementById(`nivel-membro-${timeId}`);
    const emailNovo = emailInput.value.trim().toLowerCase();
    const nivelNovo = nivelSelect.value;

    if (!emailNovo) return alert("Digite o e-mail do membro!");
    if (emailNovo == window.usuarioLogado.email) return alert("Você já é o dono do time!");

    const btn = evento.currentTarget;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = "⏳..."; btn.disabled = true;

    try {
        const timeRef = doc(db, "times", timeId);
        const timeSnap = await getDoc(timeRef);

        if (timeSnap.exists()) {
            let timeData = timeSnap.data();
            let membrosAtuais = timeData.membros || [];
            let membrosEmailsAtuais = timeData.membrosEmails || [window.usuarioLogado.email];

            if (membrosEmailsAtuais.includes(emailNovo)) {
                alert("Este e-mail já está no time!");
                btn.innerHTML = textoOriginal; btn.disabled = false;
                return;
            }

            membrosAtuais.push({ email: emailNovo, nivel: nivelNovo });
            membrosEmailsAtuais.push(emailNovo); 
            
            await updateDoc(timeRef, { membros: membrosAtuais, membrosEmails: membrosEmailsAtuais });
            emailInput.value = "";
            carregarTimes(); 
        }
    } catch (e) {
        alert("Erro ao adicionar membro.");
    } finally {
        btn.innerHTML = textoOriginal; btn.disabled = false;
    }
};

window.removerMembro = async (timeId, emailRemover) => {
    if (!confirm(`Remover ${emailRemover} da equipe?`)) return;
    try {
        const timeRef = doc(db, "times", timeId);
        const timeSnap = await getDoc(timeRef);

        if (timeSnap.exists()) {
            let timeData = timeSnap.data();
            let membrosAtuais = timeData.membros || [];
            let membrosEmailsAtuais = timeData.membrosEmails || [];
            
            let novosMembros = membrosAtuais.filter(m => m.email !== emailRemover);
            let novosEmails = membrosEmailsAtuais.filter(e => e !== emailRemover);
            
            await updateDoc(timeRef, { membros: novosMembros, membrosEmails: novosEmails });
            carregarTimes();
        }
    } catch (e) { alert("Erro ao remover membro."); }
};

window.atualizarSeletorTimes = async () => {
    const seletorGlobal = document.getElementById('filtroTimeGlobal');
    const seletorNovaCat = document.getElementById('timeNovaCategoria');
    if (!seletorGlobal || !window.usuarioLogado) return;

    try {
        const q1 = query(collection(db, "times"), where("criadorUid", "==", window.usuarioLogado.uid));
        const q2 = query(collection(db, "times"), where("membrosEmails", "array-contains", window.usuarioLogado.email));
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        
        let htmlOpcoes = '<option value="">Todos os Times</option>';
        let htmlOpcoesCat = '<option value="" style="color: black;">👤 Pessoal (Sem Time)</option>';

        let timesMap = new Map();
        snap1.forEach(d => timesMap.set(d.id, d.data().nome));
        snap2.forEach(d => timesMap.set(d.id, d.data().nome));

        timesMap.forEach((nome, id) => {
            htmlOpcoes += `<option value="${id}">${nome}</option>`;
            htmlOpcoesCat += `<option value="${id}" style="color: black;">${nome}</option>`;
        });

        seletorGlobal.innerHTML = htmlOpcoes;
        if(seletorNovaCat) seletorNovaCat.innerHTML = htmlOpcoesCat;
        
    } catch (e) {}
};

// --- TAREFAS ---
window.setarData = (tipo, el) => {

    const inputIni = document.getElementById('dataSeletor');
    const inputFim = document.getElementById('dataFimFiltro');
    const hoje = new Date();
    
    // Atualiza a variável global de controle
    tipoFiltroTempo = tipo;

    // Reset visual dos botões
    document.querySelectorAll('.btn-date').forEach(b => b.classList.remove('ativo'));
    if (el && el.tagName === 'BUTTON') el.classList.add('ativo');

    // Limpa o filtro de data final se não for um período manual ou mês
    if (['hoje', 'amanha', 'semana', 'tudo', 'custom'].includes(tipo)) {
        inputFim.value = "";
    }

    if (tipo === 'hoje') {
        inputIni.value = hoje.toLocaleDateString('en-CA');
    } else if (tipo === 'amanha') {
        const am = new Date();
        am.setDate(hoje.getDate() + 1);
        inputIni.value = am.toLocaleDateString('en-CA');
    } else if (tipo === 'semana') {
        const p = new Date(hoje);
        p.setDate(hoje.getDate() - hoje.getDay());
        window.arrayDiasSemana = [];
        for(let i = 0; i < 7; i++) {
            const d = new Date(p); d.setDate(p.getDate() + i);
            window.arrayDiasSemana.push(d.toLocaleDateString('en-CA'));
        }
        inputIni.value = window.arrayDiasSemana[0];
    } else if (tipo === 'mes') {
        // Define o intervalo do mês atual
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        inputIni.value = primeiroDia.toLocaleDateString('en-CA');
        inputFim.value = ultimoDia.toLocaleDateString('en-CA');
        tipoFiltroTempo = 'periodo'; 
    } else if (tipo === 'tudo') {
        inputIni.value = "";
        inputFim.value = "";
    }

    carregarTarefas();
};

window.carregarTarefas = async () => {

    if (!window.usuarioLogado) return; 
    const lista = document.getElementById('listaTarefas');
    const dataIni = document.getElementById('dataSeletor').value;
    const dataFim = document.getElementById('dataFimFiltro').value;

    try {
        const meuEmail = window.usuarioLogado.email.toLowerCase();
        const qTimes = query(collection(db, "times"), where("membrosEmails", "array-contains", meuEmail));
        const snapTimes = await getDocs(qTimes);
        let meusTimesIds = [];
        snapTimes.forEach(d => meusTimesIds.push(d.id));

        let tarefasBrutas = [];
        const qPessoal = query(collection(db, "tarefas"), where("uid", "==", window.usuarioLogado.uid));
        const snapPessoal = await getDocs(qPessoal);
        snapPessoal.forEach(d => tarefasBrutas.push({ id: d.id, ...d.data() }));

        if (meusTimesIds.length > 0) {
            const lotes = [];
            for (let i = 0; i < meusTimesIds.length; i += 10) lotes.push(meusTimesIds.slice(i, i + 10));
            for (let lote of lotes) {
                const qTime = query(collection(db, "tarefas"), where("timeId", "in", lote));
                const snapTime = await getDocs(qTime);
                snapTime.forEach(d => { if (!tarefasBrutas.some(t => t.id === d.id)) tarefasBrutas.push({ id: d.id, ...d.data() }); });
            }
        }

        // --- FILTRAGEM DE DATAS ---
        let tarefas = tarefasBrutas.filter(t => {
            if (tipoFiltroTempo === 'tudo') return true;
            if (tipoFiltroTempo === 'semana') return (window.arrayDiasSemana || []).includes(t.dataString);
            if (dataIni && dataFim) return t.dataString >= dataIni && t.dataString <= dataFim;
            if (dataIni && !dataFim) return t.dataString === dataIni;
            return true;
        });

        tarefas.sort((a, b) => a.dataString.localeCompare(b.dataString) || (a.hora || "00:00").localeCompare(b.hora || "00:00"));

        if (categoriasAtivas.includes("Geral")) {
            tarefas = tarefas.filter(t => t.categoria !== "Pessoal");
        } else {
            tarefas = tarefas.filter(t => categoriasAtivas.includes(t.categoria));
        }
        if (tagFiltroAtiva) tarefas = tarefas.filter(t => t.marcador === tagFiltroAtiva);

        lista.innerHTML = "";
        tarefas.forEach(t => {
            const dataObj = new Date(t.dataString + 'T00:00:00');
            const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
            const corBorda = window.coresCategorias[t.categoria] || "#94a3b8";
            const fotosStringSegura = JSON.stringify(t.fotos || []).split('"').join('&quot;');
            
            lista.innerHTML += `
            <div class="tarefa-item" style="border-left: 6px solid ${corBorda}; margin-bottom: 12px; border-radius: 16px;">
                <div class="tarefa-content" onclick="ativarEdicao('${t.id}', ${fotosStringSegura})" style="display: flex; align-items: center; gap: 15px;">
                    <div class="dia-badge" style="min-width: 50px; text-align: center;">
                        <span style="font-size: 1.8rem; font-weight: 900; display: block;">${dataObj.getDate()}</span>
                        <span style="font-size: 0.65rem; text-transform: uppercase; font-weight: 800;">${diasSemana[dataObj.getDay()]}</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 0.65rem; font-weight: bold; margin-bottom: 4px;">🏷️ ${t.marcador || 'Geral'}</div>
                        <div style="font-weight: 700;">${t.hora ? '<span style="color: #3b82f6;">'+t.hora+'</span> ' : ''}${t.descricao}</div>
                    </div>
                </div>
            </div>`;
        });
        if(tarefas.length === 0) lista.innerHTML = "<p style='text-align:center; margin-top:20px; color:#94a3b8;'>Nenhuma atividade encontrada.</p>";

    } catch (e) { console.error(e); }
}; 

window.ativarEdicao = (id, fotos) => { idEmEdicao = (idEmEdicao == id) ? null : id; fotosTemporarias = [...fotos]; carregarTarefas(); };
window.removerFotoTemporaria = (idx) => { fotosTemporarias.splice(idx, 1); renderizarFotosEdicao(); };
window.renderizarFotosEdicao = () => {
    const container = document.getElementById(`container-fotos-edit-${idEmEdicao}`);
    if(!container) return;
    container.innerHTML = fotosTemporarias.map((img, idx) => `<div class="foto-wrapper"><img src="${img}" class="img-tarefa"><button class="btn-remover-foto" onclick="event.stopPropagation(); removerFotoTemporaria(${idx});">×</button></div>`).join('');
};
window.adicionarFotosEdicao = (input) => { Array.from(input.files).forEach(file => { if (fotosTemporarias.length >= 4) return; const r = new FileReader(); r.onloadend = () => { fotosTemporarias.push(r.result); renderizarFotosEdicao(); }; r.readAsDataURL(file); }); input.value = ""; };

window.salvarAlteracoes = async (id) => { 
    const btnSalvar = document.querySelector('.btn-salvar-azul');
    if (btnSalvar) { btnSalvar.innerHTML = "⏳ SALVANDO..."; btnSalvar.disabled = true; }
    try {
        let linksFinais = [];
        for (let foto of fotosTemporarias) {
            if (foto.startsWith('data:image')) {
                const response = await fetch(foto);
                const blob = await response.blob();
                const sRef = ref(storage, `tarefas/${window.usuarioLogado.uid}/edit-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
                const snap = await uploadBytes(sRef, blob);
                const url = await getDownloadURL(snap.ref);
                linksFinais.push(url); 
            } else {
                linksFinais.push(foto);
            }
        }
        await updateDoc(doc(db, "tarefas", id), { 
            descricao: document.getElementById(`edit-desc-${id}`).value, 
            hora: document.getElementById(`edit-hora-${id}`).value, 
            fotos: linksFinais 
        }); 
        idEmEdicao = null; 
        carregarTarefas(); 
    } catch (error) {
        alert("Erro ao salvar as alterações da tarefa.");
        if (btnSalvar) { btnSalvar.innerHTML = "SALVAR"; btnSalvar.disabled = false; }
    }
};

window.excluirTask = async (id) => { if(confirm("Apagar?")) { await deleteDoc(doc(db, "tarefas", id)); carregarTarefas(); } };

window.cancelarNovaTarefa = () => {
    document.getElementById('descTask').value = ""; document.getElementById('horaTask').value = "";
    document.getElementById('fotoTask').value = ""; document.getElementById('previewFotosNovas').innerHTML = "";
    document.getElementById('tipoRecorrencia').value = "nenhuma"; document.getElementById('dataFimRecorrencia').value = "";
    fotosNovasArray = []; 
    document.getElementById('secaoAdd')?.classList.add('escondido');
    document.getElementById('setaAdd')?.classList.remove('seta-expandida');
};



// Funções de Controle dos Pop-ups
// Funções Globais de Modal
window.abrirModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('escondido');
        // Se for o de tarefa, foca no texto para você já sair digitando
        if (id === 'modalTarefa') {
            setTimeout(() => document.getElementById('descTask').focus(), 150);
        }
    }
};

window.fecharModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('escondido');
};

// Otimização: Fecha o modal automaticamente após salvar
const originalSalvar = window.salvarNovaTarefa;


// Otimização: Fecha o modal automaticamente após salvar

window.salvarNovaTarefa = async () => {

    const btn = document.getElementById('btnSalvar');
    const textoOriginal = btn.innerHTML;
    
    try {
        const desc = document.getElementById('descTask').value;
        const hora = document.getElementById('horaTask').value;
        const dataInicioTexto = document.getElementById('dataSeletor').value;
        const tipoRec = document.getElementById('tipoRecorrencia').value;
        const dataFimInput = document.getElementById('dataFimRecorrencia').value;

        if (!desc || !dataInicioTexto || !window.usuarioLogado) {
            return alert("Preencha a descrição e a data de início!");
        }

        if (tipoRec !== 'nenhuma' && !dataFimInput) {
            return alert("Para recorrência, selecione uma data final!");
        }

        btn.innerHTML = "⌛ Salvando...";
        btn.disabled = true;

        // --- LÓGICA DE GERAR O ARRAY DE DATAS ---
        let datasParaSalvar = [];
        let dataAtual = new Date(dataInicioTexto + 'T00:00:00');
        datasParaSalvar.push(dataAtual.toISOString().split('T')[0]);

        if (tipoRec !== 'nenhuma' && dataFimInput) {
            const dataFim = new Date(dataFimInput + 'T23:59:59');
            while (true) {
                if (tipoRec === 'diario') dataAtual.setDate(dataAtual.getDate() + 1);
                else if (tipoRec === '2dias') dataAtual.setDate(dataAtual.getDate() + 2);
                else if (tipoRec === 'semanal') dataAtual.setDate(dataAtual.getDate() + 7);
                else if (tipoRec === 'mensal') dataAtual.setMonth(dataAtual.getMonth() + 1);
                
                if (dataAtual > dataFim) break;
                datasParaSalvar.push(dataAtual.toISOString().split('T')[0]);
            }
        }

        // --- SALVAMENTO NO FIREBASE ---
        const categoriaPrincipal = categoriasAtivas.includes("Geral") ? "Geral" : categoriasAtivas[0];
        const idDoTimeDaCategoria = window.timesDasCategorias[categoriaPrincipal] || null;

        const promessas = datasParaSalvar.map(dataStr => {
            return addDoc(collection(db, "tarefas"), { 
                uid: window.usuarioLogado.uid, 
                timeId: idDoTimeDaCategoria,
                categoria: categoriaPrincipal,
                descricao: desc, 
                marcador: tagFiltroAtiva || null, 
                hora: hora, 
                dataString: dataStr,
                fotos: window.linksFotosUpload || [],
                criadoEm: new Date(),
                alarmeAtivo: true,
                alertaDisparado: false
            });
        });

        await Promise.all(promessas);

        // --- FINALIZAÇÃO ---
        fecharModal('modalTarefa'); 
        if (typeof cancelarNovaTarefa === 'function') cancelarNovaTarefa();
        await carregarTarefas();
        
        alert(datasParaSalvar.length > 1 ? `${datasParaSalvar.length} tarefas agendadas!` : "Tarefa salva!");

    } catch (e) { 
        console.error("Erro completo:", e);
        alert("Erro ao salvar. Verifique o console."); 
    } finally { 
        btn.innerHTML = textoOriginal; 
        btn.disabled = false; 
    }
};

window.prepararFotosNovas = (input) => { Array.from(input.files).forEach(f => { if (fotosNovasArray.length < 4) fotosNovasArray.push(f); renderizarPreviewFotosNovas(); }); input.value = ""; };
const renderizarPreviewFotosNovas = () => { document.getElementById('previewFotosNovas').innerHTML = fotosNovasArray.map((file, idx) => `<div class="foto-wrapper"><img src="${URL.createObjectURL(file)}" class="img-tarefa"><button class="btn-remover-foto" onclick="removerFotoNova(${idx})">×</button></div>`).join(''); };
window.removerFotoNova = (idx) => { fotosNovasArray.splice(idx, 1); renderizarPreviewFotosNovas(); };

// --- ARQUIVOS FIXOS ---
window.subirArquivoFixo = async () => {
    const file = document.getElementById('inputArquivoFixo').files[0];
    const nome = document.getElementById('nomeArquivoFixo').value;
    if(!file || !nome || !window.usuarioLogado) return alert("Preencha o nome e selecione o arquivo!");
    
    const btn = document.getElementById('btnSubirFixo');
    btn.innerHTML = "⏳ Enviando..."; btn.disabled = true;
    
    let categoriaPrincipal = categoriasAtivas.includes("Geral") ? "Geral" : categoriasAtivas[categoriasAtivas.length - 1];

    try {
        const sRef = ref(storage, `arquivos_fixos/${window.usuarioLogado.uid}/${file.name}`);
        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);
        const idDoTimeDaCategoria = window.timesDasCategorias[categoriaPrincipal] || null;
        
        const q = query(collection(db, "arquivos_fixos"), where("uid", "==", window.usuarioLogado.uid), where("Nomearquivo", "==", nome), where("categoria", "==", categoriaPrincipal));
        const busca = await getDocs(q);

        if (!busca.empty) {
            await updateDoc(doc(db, "arquivos_fixos", busca.docs[0].id), { link: url, dataUpload: new Date() });
            alert("Arquivo Fixo atualizado!"); 
        } else {
            await addDoc(collection(db, "arquivos_fixos"), { 
                uid: window.usuarioLogado.uid, 
                Nomearquivo: nome, 
                categoria: categoriaPrincipal, 
                link: url, 
                timeId: idDoTimeDaCategoria, 
                dataUpload: new Date() 
            });
            alert("Novo Arquivo Fixo salvo!"); 
        }

        carregarArquivosFixos();
        document.getElementById('nomeArquivoFixo').value = ""; document.getElementById('inputArquivoFixo').value = ""; document.getElementById('file-label').innerText = '📁 Escolher Arquivo';
    } catch (e) { alert("Erro no upload."); } finally { btn.innerHTML = "📤 Subir"; btn.disabled = false; }
};

window.carregarArquivosFixos = async () => {
    if (!window.usuarioLogado) return;
    const lista = document.getElementById('listaArquivosFixos'); 
    lista.innerHTML = "<p style='text-align:center; color:#cbd5e1; font-size: 0.85rem;'>Carregando arquivos...</p>";
    
    try {
        let arquivos = [];
        const qPessoal = query(collection(db, "arquivos_fixos"), where("uid", "==", window.usuarioLogado.uid));
        const snapPessoal = await getDocs(qPessoal);
        snapPessoal.forEach(d => arquivos.push({ id: d.id, ...d.data() }));

        let timesIdsBuscados = [];
        categoriasAtivas.forEach(cat => {
            if (cat !== "Geral" && window.timesDasCategorias[cat]) timesIdsBuscados.push(window.timesDasCategorias[cat]);
        });
        timesIdsBuscados = [...new Set(timesIdsBuscados)];

        if (timesIdsBuscados.length > 0) {
            for (let idTime of timesIdsBuscados) {
                const qTime = query(collection(db, "arquivos_fixos"), where("timeId", "==", idTime));
                const snapTime = await getDocs(qTime);
                snapTime.forEach(d => {
                    if (!arquivos.some(a => a.id == d.id)) arquivos.push({ id: d.id, ...d.data() });
                });
            }
        }

        if (categoriasAtivas.includes("Geral")) {
            arquivos = arquivos.filter(a => a.categoria !== "Pessoal");
        } else {
            arquivos = arquivos.filter(a => categoriasAtivas.includes(a.categoria));
        }

        if (tagFiltroAtiva !== "") arquivos = arquivos.filter(a => a.marcador == tagFiltroAtiva);

        lista.innerHTML = "";
        arquivos.forEach(a => {
            lista.innerHTML += `
            <div style="background:#f8f9fa; padding:10px; border-radius:8px; margin-bottom:5px; display:flex; justify-content:space-between; align-items: center; gap: 8px;">
                <span style="font-size:0.9rem; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><b>[${a.categoria}]</b> ${a.Nomearquivo}</span>
                <div style="display: flex; gap: 5px;">
                    <a href="${a.link}" target="_blank" style="color:white; background:#007bff; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight:bold; font-size: 0.75rem;">ABRIR</a>
                    <button onclick="excluirArquivoFixo('${a.id}')" style="color:white; background:#ef4444; border:none; padding: 6px 12px; border-radius: 6px; font-weight:bold; font-size: 0.75rem; cursor:pointer;">EXCLUIR</button>
                </div>
            </div>`;
        });
        if(arquivos.length == 0) lista.innerHTML = "<p style='text-align:center; font-size:0.8rem; color:#888;'>Nenhum arquivo nestas categorias.</p>";
    } catch(e) { lista.innerHTML = "<p style='text-align:center; color:#ef4444; font-size: 0.85rem;'>Erro ao carregar.</p>"; }
};
window.excluirArquivoFixo = async (id) => { if(confirm("Apagar arquivo?")) { await deleteDoc(doc(db, "arquivos_fixos", id)); carregarArquivosFixos(); } };

// --- FINANCEIRO ---
window.adicionarTransacao = async () => {
    const descEl = document.getElementById('descFinanceiro');
    const valorEl = document.getElementById('valorFinanceiro');
    const tipoEl = document.getElementById('tipoFinanceiro');
    const arquivoInput = document.getElementById('arquivoFinanceiro');

    if (!descEl || !valorEl || !tipoEl) {
        alert("Erro estrutural: Campos não encontrados!");
        return;
    }

    const desc = descEl.value;
    const valor = parseFloat(valorEl.value);
    const tipo = tipoEl.value;
    const arquivoFile = arquivoInput ? arquivoInput.files[0] : null;

    const hoje = new Date();
    const dataHojeStr = hoje.toLocaleDateString('en-CA'); 

    if (!desc || isNaN(valor)) return alert("Preencha a descrição e o valor!");
    if (!window.usuarioLogado) return alert("Faça login primeiro!");

    const btn = document.getElementById('btnSalvarFinanceiro');
    const textoOriginal = btn ? btn.innerHTML : "Adicionar";
    if (btn) { btn.innerHTML = "⏳ Salvando..."; btn.disabled = true; }

    const categoriaPrincipal = categoriasAtivas.includes("Geral") ? "Geral" : categoriasAtivas[categoriasAtivas.length - 1];
    const idDoTimeDaCategoria = window.timesDasCategorias[categoriaPrincipal] || null;

    try {
        let linkComprovante = "";

        if (arquivoFile) {
            const sRef = ref(storage, `financeiro/${window.usuarioLogado.uid}/${Date.now()}-${arquivoFile.name}`);
            const snap = await uploadBytes(sRef, arquivoFile);
            linkComprovante = await getDownloadURL(snap.ref);
        }

        await addDoc(collection(db, "financeiro"), {
            uid: window.usuarioLogado.uid,
            timeId: idDoTimeDaCategoria,
            categoria: categoriaPrincipal,
            descricao: desc,
            valor: valor,
            tipo: tipo,
            dataStr: dataHojeStr, 
            comprovanteUrl: linkComprovante, 
            criadoEm: new Date()
        });

        descEl.value = "";
        valorEl.value = "";
        if (arquivoInput) arquivoInput.value = ""; 
        const btnArquivo = document.getElementById('btnArquivoFinanceiro');
        if (btnArquivo) btnArquivo.innerText = "📎 Anexar Recibo"; 
        
        carregarFinanceiro();
    } catch (e) {
        console.error("Erro no Firebase:", e);
        alert("Erro ao salvar financeiro.");
    } finally {
        if (btn) { btn.innerHTML = textoOriginal; btn.disabled = false; }
    }
};

window.carregarFinanceiro = async () => {
    if (!window.usuarioLogado) return;
    const lista = document.getElementById('listaFinanceiro');
    if (!lista) return;

    lista.innerHTML = "<p style='text-align:center; color:#cbd5e1;'>Carregando caixa...</p>";

    try {
        let transacoes = [];
        const qPessoal = query(collection(db, "financeiro"), where("uid", "==", window.usuarioLogado.uid));
        const snapPessoal = await getDocs(qPessoal);
        snapPessoal.forEach(d => transacoes.push({ id: d.id, ...d.data() }));

        let timesIdsBuscados = [];
        categoriasAtivas.forEach(cat => {
            if (cat !== "Geral" && window.timesDasCategorias[cat]) timesIdsBuscados.push(window.timesDasCategorias[cat]);
        });
        timesIdsBuscados = [...new Set(timesIdsBuscados)];

        if (timesIdsBuscados.length > 0) {
            for (let idTime of timesIdsBuscados) {
                const qTime = query(collection(db, "financeiro"), where("timeId", "==", idTime));
                const snapTime = await getDocs(qTime);
                snapTime.forEach(d => {
                    if (!transacoes.some(t => t.id == d.id)) transacoes.push({ id: d.id, ...d.data() });
                });
            }
        }

        if (categoriasAtivas.includes("Geral")) {
            transacoes = transacoes.filter(t => t.categoria !== "Pessoal");
        } else {
            transacoes = transacoes.filter(t => categoriasAtivas.includes(t.categoria));
        }

        if (tagFiltroAtiva !== "") {
            transacoes = transacoes.filter(t => t.marcador == tagFiltroAtiva);
        }

        transacoes.sort((a, b) => b.dataStr.localeCompare(a.dataStr));

        let somaReceitas = 0;
        let somaDespesas = 0;

        lista.innerHTML = "";
        transacoes.forEach(t => {
            if (t.tipo == 'receita') somaReceitas += t.valor;
            else somaDespesas += t.valor;

            const corValor = t.tipo == 'receita' ? '#10b981' : '#ef4444';
            const dataFormatada = t.dataStr.split('-').reverse().join('/');
            
            const btnComprovante = t.comprovanteUrl ? `<a href="${t.comprovanteUrl}" target="_blank" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 4px 8px; border-radius: 6px; text-decoration: none; font-size: 0.65rem; font-weight: bold; margin-left: 5px;">📄 RECIBO</a>` : '';

            lista.innerHTML += `
            <div style="background:rgba(255,255,255,0.8); padding:10px; border-radius:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items: center; border-left: 4px solid ${corValor};">
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 0.85rem; color: #1e293b; display: flex; align-items: center;">${t.descricao} ${btnComprovante}</div>
                    <div style="font-size: 0.7rem; color: #64748b;">${dataFormatada} • [${t.categoria}]</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 900; color: ${corValor};">R$ ${t.valor.toFixed(2)}</span>
                    <button onclick="excluirTransacao('${t.id}')" style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size: 1.1rem;" title="Excluir">✕</button>
                </div>
            </div>`;
        });

        if (transacoes.length == 0) {
            lista.innerHTML = "<p style='text-align:center; font-size:0.8rem; color:#888;'>Nenhuma movimentação nesta categoria.</p>";
        }

        const saldo = somaReceitas - somaDespesas;
        const totalRecEl = document.getElementById('totalReceitas');
        const totalDespEl = document.getElementById('totalDespesas');
        const saldoTotalEl = document.getElementById('saldoTotal');

        if(totalRecEl) totalRecEl.innerText = `R$ ${somaReceitas.toFixed(2)}`;
        if(totalDespEl) totalDespEl.innerText = `R$ ${somaDespesas.toFixed(2)}`;
        if(saldoTotalEl) {
            saldoTotalEl.innerText = `R$ ${saldo.toFixed(2)}`;
            saldoTotalEl.style.color = saldo >= 0 ? '#3b82f6' : '#ef4444';
        }

    } catch (e) {
        console.error(e);
        lista.innerHTML = "<p style='text-align:center; color:#ef4444;'>Erro ao carregar finanças.</p>";
    }
};

window.excluirTransacao = async (id) => {
    if (confirm("Apagar transação?")) {
        await deleteDoc(doc(db, "financeiro", id));
        carregarFinanceiro();
    }
};

// --- GRÁFICO GANTT E PDF ---
window.abrirCronogramaVisual = async (evento) => {
    evento.stopPropagation();
    if (!window.usuarioLogado) return alert("Faça login primeiro!");
    
    if (categoriasAtivas.length > 1) {
        return alert("📊 Por favor, deixe apenas UMA categoria selecionada para gerar o Gráfico.");
    }
    if (categoriasAtivas.includes("Geral")) {
        return alert("📊 Por favor, selecione uma categoria específica (desmarque a Geral) para gerar o Gráfico.");
    }

    const modal = document.getElementById('modalCronograma');
    const container = document.getElementById('cronoContainer');
    const badge = document.getElementById('cronoBadge');
    
    modal.style.display = 'flex';
    container.innerHTML = "<p style='text-align:center; color:#cbd5e1;'>⏳ Desenhando linha do tempo...</p>";

    const categoriaDoGrafico = categoriasAtivas[0];
    badge.innerText = categoriaDoGrafico;

    try {
        let tarefas = window.tarefasMonitoramento.filter(t => t.categoria == categoriaDoGrafico);
        
        if (!tarefas || tarefas.length == 0) { 
            container.innerHTML = "<p style='text-align:center; color:#94a3b8;'>Nenhuma atividade na tela para gerar o gráfico.</p>"; 
            return; 
        }

        let tagsMap = {};
        let minGlobal = null; let maxGlobal = null;

        tarefas.forEach(t => {
            const tag = t.marcador || "Geral ";
            const dStr = t.dataString;
            if (!tagsMap[tag]) tagsMap[tag] = { min: dStr, max: dStr };
            else {
                if (dStr < tagsMap[tag].min) tagsMap[tag].min = dStr;
                if (dStr > tagsMap[tag].max) tagsMap[tag].max = dStr;
            }
            if (!minGlobal || dStr < minGlobal) minGlobal = dStr;
            if (!maxGlobal || dStr > maxGlobal) maxGlobal = dStr;
        });

        if (!minGlobal || !maxGlobal) {
            container.innerHTML = "<p style='text-align:center; color:#94a3b8;'>Atividades sem data válida.</p>";
            return;
        }

        const dateMinGlobal = new Date(minGlobal + 'T12:00:00');
        const dateMaxGlobal = new Date(maxGlobal + 'T12:00:00');
        const totalDiasGlobais = Math.round((dateMaxGlobal - dateMinGlobal) / (1000 * 60 * 60 * 24)) + 1;

        let htmlCrono = `<div style="display:flex; flex-direction:column; gap:20px;">`;

        Object.keys(tagsMap).sort().forEach(tag => {
            const dMin = new Date(tagsMap[tag].min + 'T12:00:00');
            const dMax = new Date(tagsMap[tag].max + 'T12:00:00');
            
            const diasDeslocamento = Math.round((dMin - dateMinGlobal) / (1000 * 60 * 60 * 24));
            const duracaoDias = Math.round((dMax - dMin) / (1000 * 60 * 60 * 24)) + 1;

            const percLeft = totalDiasGlobais == 1 ? 0 : (diasDeslocamento / totalDiasGlobais) * 100;
            const percWidth = totalDiasGlobais == 1 ? 100 : (duracaoDias / totalDiasGlobais) * 100;

            const fMin = `${String(dMin.getDate()).padStart(2,'0')}/${String(dMin.getMonth()+1).padStart(2,'0')}`;
            const fMax = `${String(dMax.getDate()).padStart(2,'0')}/${String(dMax.getMonth()+1).padStart(2,'0')}`;
            let textoBarra = duracaoDias > 1 ? `${duracaoDias} dias (${fMin} a ${fMax})` : `1 dia (${fMin})`;

            htmlCrono += `
                <div>
                    <div style="font-size: 0.8rem; font-weight: bold; color: #f8fafc; margin-bottom: 6px; display: flex; justify-content: space-between;"><span>🏷️ ${tag}</span></div>
                    <div style="background: rgba(0,0,0,0.3); width: 100%; height: 32px; border-radius: 8px; position: relative; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="position: absolute; left: ${percLeft}%; width: ${percWidth}%; height: 100%; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; min-width: fit-content; padding: 0 8px; z-index: 2;">
                            <span style="color: white; font-size: 0.7rem; font-weight: bold; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${textoBarra}</span>
                        </div>
                    </div>
                </div>`;
        });

        const fMinGlob = `${String(dateMinGlobal.getDate()).padStart(2,'0')}/${String(dateMinGlobal.getMonth()+1).padStart(2,'0')}/${dateMinGlobal.getFullYear()}`;
        const fMaxGlob = `${String(dateMaxGlobal.getDate()).padStart(2,'0')}/${String(dateMaxGlobal.getMonth()+1).padStart(2,'0')}/${dateMaxGlobal.getFullYear()}`;
        
        htmlCrono += `</div><div style="display: flex; justify-content: space-between; margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; font-size: 0.75rem; color: #94a3b8; font-weight: bold;">
            <span>🏁 Início: ${fMinGlob}</span><span style="color: #f59e0b;">⏳ Total: ${totalDiasGlobais} dias</span><span>🎯 Fim: ${fMaxGlob}</span>
        </div>`;
        container.innerHTML = htmlCrono;
    } catch (e) { 
        container.innerHTML = "<p style='color:#ef4444; text-align:center;'>Erro ao montar o gráfico.</p>"; 
    }
};

window.gerarRelatorioPDF = async (evento) => {
    evento.stopPropagation();
    
    if (categoriasAtivas.length > 1) return alert("📄 Por favor, deixe apenas UMA categoria selecionada para gerar o Relatório PDF.");
    if (categoriasAtivas.includes("Geral")) return alert("📄 Por favor, selecione uma categoria de projeto específica (desmarque a Geral) para gerar o PDF.");
    if (!window.tarefasMonitoramento || window.tarefasMonitoramento.length == 0) return alert("Não há atividades na tela para gerar o PDF.");

    const categoriaDoPDF = categoriasAtivas[0];
    let tarefasDoPDF = window.tarefasMonitoramento.filter(t => t.categoria == categoriaDoPDF);
    
    if (tarefasDoPDF.length == 0) return alert("Não há atividades nesta categoria.");

    const btn = evento.currentTarget;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = "⏳ Gerando..."; btn.disabled = true;

    let dataFiltroTexto = "";
    if (tipoFiltroTempo == 'semana' && window.arrayDiasSemana) {
        const inicio = window.arrayDiasSemana[0].split('-').reverse().join('/');
        const fim = window.arrayDiasSemana[6].split('-').reverse().join('/');
        dataFiltroTexto = `${inicio} a ${fim}`;
    } else { 
        dataFiltroTexto = document.getElementById('dataSeletor').value.split('-').reverse().join('/'); 
    }

    const tarefasPorTag = {};
    tarefasDoPDF.forEach(t => {
        const tag = t.marcador ? t.marcador : "Geral ";
        if (!tarefasPorTag[tag]) tarefasPorTag[tag] = {};
        if (!tarefasPorTag[tag][t.dataString]) tarefasPorTag[tag][t.dataString] = [];
        tarefasPorTag[tag][t.dataString].push(t);
    });

    const tagsOrdenadas = Object.keys(tarefasPorTag).sort();
    const diasSemanaNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    const relatorioTemp = document.createElement('div');
    relatorioTemp.style.fontFamily = 'Helvetica, Arial, sans-serif';
    relatorioTemp.style.color = '#1e293b';

    let logoPequenaHtml = ""; let logoResumoHtml = "";
    
    if (window.logosCategorias && window.logosCategorias[categoriaDoPDF]) {
        let logoData = window.logosCategorias[categoriaDoPDF];
        logoPequenaHtml = `<img src="${logoData}" style="height: 28px; max-width: 120px; object-fit: contain; border-radius: 4px;">`;
        logoResumoHtml = `<img src="${logoData}" style="height: 70px; max-width: 180px; object-fit: contain; border-radius: 8px;">`;
    }

    let htmlPdf = `
        <div style="padding: 20px 30px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-top: 10px;">
                <div style="text-align: left;">
                    <h1 style="margin: 0 0 10px 0; font-size: 32px; color: #1e293b; text-transform: uppercase;">Resumo</h1>
                    <h2 style="margin: 0 0 5px 0; font-size: 20px; color: #3b82f6;">Categoria: ${categoriaDoPDF}</h2>
                    <h3 style="margin: 0; font-size: 16px; color: #64748b; font-weight: normal;">Período: ${dataFiltroTexto}</h3>
                </div>
                <div style="text-align: right; margin-top: -25px;">${logoResumoHtml}</div>
            </div>`;

    tagsOrdenadas.forEach(tag => {
        htmlPdf += `<h2 style="color: #3b82f6; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-top: 25px; font-size: 20px;">Etapa: ${tag}</h2><ul style="list-style-type: none; padding-left: 10px;">`;
        const diasOrdenados = Object.keys(tarefasPorTag[tag]).sort();
        diasOrdenados.forEach(dia => {
            const dataObj = new Date(dia + 'T00:00:00');
            const nomeDia = diasSemanaNomes[dataObj.getDay()];
            const dataFormatada = dia.split('-').reverse().join('/');
            htmlPdf += `<li style="margin-bottom: 15px;"><h3 style="margin: 0 0 8px 0; font-size: 15px; color: #1e293b;">${nomeDia} (${dataFormatada})</h3>`;
            tarefasPorTag[tag][dia].forEach(t => { htmlPdf += `<div style="padding-left: 12px; border-left: 3px solid ${window.coresCategorias[t.categoria] || '#94a3b8'}; margin-bottom: 6px; font-size: 14px; color: #475569;">${t.descricao}</div>`; });
            htmlPdf += `</li>`;
        });
        htmlPdf += `</ul>`;
    });

    const ALTURA_MAXIMA = 270; 
    tagsOrdenadas.forEach(tag => {
        const diasOrdenados = Object.keys(tarefasPorTag[tag]).sort();
        diasOrdenados.forEach(dia => {
            const dataObj = new Date(dia + 'T00:00:00');
            const nomeDia = diasSemanaNomes[dataObj.getDay()];
            const partesDia = dia.split('-');
            const dataFormatadaCurta = `${partesDia[2]}/${partesDia[1]}`;
            
            htmlPdf += `</div><div class="html2pdf__page-break"></div>
            <div style="padding: 15px 30px 0 30px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 20px;">
                    <span style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase;">Relatório Técnico | Etapa: ${tag}</span>${logoPequenaHtml}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px;">
                    <h2 style="font-size: 22px; color: #1e293b; margin: 0;">${nomeDia} (${dataFormatadaCurta})</h2>
                </div>`;
            
            let alturaAtual = 65; 

            tarefasPorTag[tag][dia].forEach(t => {
                let temFoto = t.fotos && t.fotos.length > 0;
                let alturaTarefa = temFoto ? 100 : 25; 

                if (alturaAtual + alturaTarefa > ALTURA_MAXIMA) {
                    htmlPdf += `</div><div class="html2pdf__page-break"></div>
                    <div style="padding: 15px 30px 0 30px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 20px;">
                            <span style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase;">Relatório Técnico | Etapa: ${tag}</span>${logoPequenaHtml}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 15px;">
                            <h2 style="font-size: 22px; color: #1e293b; margin: 0;">${nomeDia} (${dataFormatadaCurta})</h2>
                        </div>`;
                    alturaAtual = 65; 
                }

                let fotosHtml = '';
                if (temFoto) {
                    const qtd = Math.min(t.fotos.length, 4); 
                    let gridStyles = 'display: grid; gap: 10px; width: 100%; height: 280px; margin-top: 15px;';
                    if (qtd == 1) gridStyles += 'grid-template-columns: 1fr; grid-template-rows: 1fr;';
                    else if (qtd == 2) gridStyles += 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr;';
                    else gridStyles += 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;'; 

                    fotosHtml += `<div style="${gridStyles}">`;
                    for(let i=0; i < qtd; i++) { fotosHtml += `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1;"><img src="${t.fotos[i]}" style="max-width: 100%; max-height: 100%; object-fit: contain;"></div>`; }
                    fotosHtml += `</div>`;
                }
                htmlPdf += `<div style="margin-bottom: 25px; padding: 15px; border-left: 5px solid ${window.coresCategorias[t.categoria] || '#3b82f6'}; background: #f8fafc; border-radius: 0 8px 8px 0; page-break-inside: avoid;"><div style="font-size: 18px; font-weight: bold; margin-bottom: 6px; color: #0f172a;">${t.descricao}</div>${fotosHtml}</div>`;
                alturaAtual += alturaTarefa;
            });
        });
    });
    htmlPdf += `</div>`; 

    relatorioTemp.innerHTML = htmlPdf;
    const opcoes = { margin: [10, 0, 15, 0], image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } };
    const periodoSeguro = dataFiltroTexto.split('/').join('-').split(' ').join('_');
    const nomeRelatorio = `Relatorio_${categoriaDoPDF}_${periodoSeguro}`;

    html2pdf().set(opcoes).from(relatorioTemp).toPdf().get('pdf').then(function (pdf) {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i); pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.5); pdf.line(15, 282, 195, 282);
            pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 116, 139); pdf.setFontSize(10); pdf.text(`Página ${i} de ${totalPages}`, 195, 287, { align: 'right' }); 
        }
        return pdf.output('blob');
    }).then(async (pdfBlob) => {
        btn.innerHTML = "☁️ Salvando...";
        try {
            const sRef = ref(storage, `arquivos_fixos/${window.usuarioLogado.uid}/${nomeRelatorio}.pdf`); 
            await uploadBytes(sRef, pdfBlob);
            const urlArquivo = await getDownloadURL(sRef);
            const q = query(collection(db, "arquivos_fixos"), where("uid", "==", window.usuarioLogado.uid), where("Nomearquivo", "==", nomeRelatorio));
            const busca = await getDocs(q);
            if (!busca.empty) await updateDoc(doc(db, "arquivos_fixos", busca.docs[0].id), { link: urlArquivo, dataUpload: new Date() });
            else await addDoc(collection(db, "arquivos_fixos"), { uid: window.usuarioLogado.uid, Nomearquivo: nomeRelatorio, categoria: categoriaDoPDF, link: urlArquivo, dataUpload: new Date() });
            alert(`Relatório salvo nos Arquivos Fixos!`); carregarArquivosFixos(); 
        } catch (error) { alert("Erro ao salvar."); } finally { btn.innerHTML = textoOriginal; btn.disabled = false; }
    });
};

window.gerarPDFCronograma = async (evento) => {
    evento.stopPropagation();
    const btn = document.getElementById('btnPdfCrono');
    const originalText = btn.innerHTML;
    
    const containerGantt = document.getElementById('cronoContainer').innerHTML;
    
    if (containerGantt.includes('Nenhuma atividade') || containerGantt.includes('Desenhando')) {
        return alert("Não há dados desenhados para gerar o PDF.");
    }

    btn.innerHTML = "⏳..."; 
    btn.disabled = true;

    const relatorioTemp = document.createElement('div');
    relatorioTemp.style.fontFamily = 'Helvetica, Arial, sans-serif';
    relatorioTemp.style.color = '#1e293b';
    relatorioTemp.style.width = '1000px'; 
    relatorioTemp.style.padding = '20px 30px';
    relatorioTemp.style.background = '#ffffff';

    let logoHtml = "";
    const categoriaPrincipal = categoriasAtivas[0];
    if (window.logosCategorias && window.logosCategorias[categoriaPrincipal]) {
        logoHtml = `<img src="${window.logosCategorias[categoriaPrincipal]}" crossorigin="anonymous" style="height: 45px; max-width: 150px; object-fit: contain; border-radius: 6px;">`;
    }

    let conteudoAdaptado = containerGantt
        .replace(/color: #f8fafc;/g, 'color: #1e293b;') 
        .replace(/color: #94a3b8;/g, 'color: #475569;') 
        .replace(/border: 1px solid rgba\(255,255,255,0.1\);/g, 'border: 1px solid #cbd5e1;') 
        .replace(/background: rgba\(0,0,0,0.3\);/g, 'background: #f1f5f9;') 
        .replace(/border-top: 1px solid rgba\(255,255,255,0.2\);/g, 'border-top: 2px solid #e2e8f0;');

    relatorioTemp.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 30px;">
            <div>
                <h1 style="margin: 0 0 5px 0; font-size: 24px; color: #1e293b; text-transform: uppercase;">Cronograma Executivo</h1>
                <h2 style="margin: 0; font-size: 16px; color: #64748b; font-weight: bold;">Categoria: ${categoriaPrincipal}</h2>
            </div>
            ${logoHtml}
        </div>
        ${conteudoAdaptado}
    `;

    const opcoes = { 
        margin: [15, 15, 15, 15], 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, logging: false }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } 
    };

    const nomeRelatorio = `Cronograma_Visual_${categoriaPrincipal}`;

    html2pdf().set(opcoes).from(relatorioTemp).toPdf().get('pdf').then(function(pdf) {
        return pdf.output('blob');
    }).then(async (pdfBlob) => {
        btn.innerHTML = "☁️...";
        try {
            const sRef = ref(storage, `arquivos_fixos/${window.usuarioLogado.uid}/${nomeRelatorio}.pdf`); 
            await uploadBytes(sRef, pdfBlob);
            const urlArquivo = await getDownloadURL(sRef);
            
            const q = query(collection(db, "arquivos_fixos"), 
                where("uid", "==", window.usuarioLogado.uid),
                where("Nomearquivo", "==", nomeRelatorio)
            );
            const busca = await getDocs(q);

            if (!busca.empty) {
                const idDocExistente = busca.docs[0].id;
                await updateDoc(doc(db, "arquivos_fixos", idDocExistente), { link: urlArquivo, dataUpload: new Date() });
            } else {
                await addDoc(collection(db, "arquivos_fixos"), { 
                    uid: window.usuarioLogado.uid, 
                    Nomearquivo: nomeRelatorio, 
                    categoria: categoriaPrincipal, 
                    link: urlArquivo, 
                    dataUpload: new Date() 
                });
            }
            alert("Cronograma salvo e atualizado com sucesso!"); 
            carregarArquivosFixos();
        } catch (error) { 
            alert("Erro ao salvar o cronograma na nuvem."); 
        } finally { 
            btn.innerHTML = originalText; 
            btn.disabled = false; 
        }
    });
};