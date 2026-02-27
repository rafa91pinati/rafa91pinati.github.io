// ... (mantenha a inicialização do admin e db igual)

async function verificarETocarAlarme() {
  const agora = new Date();
  const hoje = agora.toISOString().split('T')[0];
  const horaAtual = agora.getHours().toString().padStart(2, '0') + ":" + agora.getMinutes().toString().padStart(2, '0');

  console.log(`[REV 2.0] Monitorando: ${hoje} - ${horaAtual}`);

  const tarefasRef = db.collection('tarefas');
  const snapshot = await tarefasRef
    .where('dataString', '==', hoje)
    .where('alertaDisparado', '==', false)
    .get();

  if (snapshot.empty) return;

  const tokensSnap = await db.collection('assinaturas').get();
  const tokens = tokensSnap.docs.map(d => d.data().token);

  if (tokens.length === 0) {
      console.log("Nenhum token encontrado no banco.");
      return;
  }

  snapshot.forEach(async (doc) => {
    const t = doc.data();
    
    // Verifica se a hora bate
    if (t.hora === horaAtual) {
      
      const message = {
        notification: {
          title: '⏰ ALARME: ' + t.descricao,
          body: `Início programado para às ${t.hora}`
        },
        // CONFIGURAÇÕES VITAIS PARA O APP FECHADO:
        webpush: {
          headers: {
            Urgency: 'high' // Força entrega imediata
          },
          notification: {
            icon: '/favicon.ico',
            requireInteraction: true, // Mantém a notificação na tela até você clicar
            vibrate: [200, 100, 200, 100, 200], // Padrão de vibração de alarme
            tag: 'alarme-agenda' // Evita notificações duplicadas
          }
        },
        tokens: tokens,
      };

      try {
        const response = await fcm.sendMulticast(message);
        console.log(`Alarme enviado para ${response.successCount} dispositivos.`);
        
        // Marca como disparado no banco para não repetir
        await doc.ref.update({ alertaDisparado: true });
      } catch (error) {
        console.error("Erro ao enviar push:", error);
      }
    }
  });
}

setInterval(verificarETocarAlarme, 30000);