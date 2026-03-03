const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

exports.verificarAlarmes = onSchedule("every 1 minutes", async (event) => {
    const opcoesData = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
    const opcoesHora = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false };
    
    const agoraBR = new Date();
    const formatterData = new Intl.DateTimeFormat('pt-BR', opcoesData);
    const formatterHora = new Intl.DateTimeFormat('pt-BR', opcoesHora);

    const partesData = formatterData.formatToParts(agoraBR);
    const dataHoje = `${partesData.find(p => p.type === 'year').value}-${partesData.find(p => p.type === 'month').value}-${partesData.find(p => p.type === 'day').value}`;

    let horaAtual = formatterHora.format(agoraBR);
    if (horaAtual.startsWith('24:')) horaAtual = horaAtual.replace('24:', '00:');

    // Busca todos os usuários/dispositivos registrados
    const tokensSnap = await db.collection("tokens_dispositivos").get();
    if (tokensSnap.empty) return console.log("Nenhum dispositivo registrado na nuvem.");

    const tarefasSnap = await db.collection("tarefas")
        .where("dataString", "==", dataHoje)
        .where("alarmeAtivo", "==", true)
        .where("alertaDisparado", "==", false)
        .get();

    const promessas = [];

    tarefasSnap.forEach((docTarefa) => {
        const tarefa = docTarefa.data();
        if (!tarefa.hora) return;

        let notificacaoEnviada = false;

        // Varre as configurações de cada usuário
        tokensSnap.forEach((docUsuario) => {
            const dadosConfig = docUsuario.data();
            
            // Pega a lista de tokens (PC, Celular, etc)
            const listaTokens = dadosConfig.tokens || [];
            if (listaTokens.length === 0) return; 
            
            const antecedencia = parseInt(dadosConfig.minutosAntecedencia) || 0;
            const tipoNotificacao = dadosConfig.tipoNotificacao || 'normal';
            const somSelecionado = dadosConfig.somSelecionado || 'alarme.mp3';

            // Matemática do Tempo
            const [h, m] = tarefa.hora.split(':').map(Number);
            let totalMinutos = (h * 60) + m - antecedencia;
            if (totalMinutos < 0) totalMinutos += 24 * 60;
            
            const hDisparo = Math.floor(totalMinutos / 60).toString().padStart(2, '0');
            const mDisparo = (totalMinutos % 60).toString().padStart(2, '0');
            const horaCalculada = `${hDisparo}:${mDisparo}`;

            // Se for a hora exata, dispara para todos os tokens daquele usuário
            if (horaCalculada === horaAtual) {
                listaTokens.forEach((tokenDoAparelho) => {
                    const mensagem = {
                        notification: {
                            title: `🔔 Agenda: ${tarefa.categoria || 'Lembrete'}`,
                            body: tarefa.descricao,
                        },
                        data: {
                            url: "/",
                            comportamento: tipoNotificacao,
                            som: somSelecionado
                        },
                        token: tokenDoAparelho,
                    };
                    promessas.push(admin.messaging().send(mensagem).catch(e => console.error("Erro no token:", e)));
                });
                notificacaoEnviada = true;
                console.log(`=> Push enviado para os aparelhos da nuvem!`);
            }
        });

        if (notificacaoEnviada) {
            promessas.push(docTarefa.ref.update({ alertaDisparado: true }));
        }
    });

    await Promise.all(promessas);
    return null;
});