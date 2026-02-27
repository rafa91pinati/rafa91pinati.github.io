const admin = require('firebase-admin');
// Você precisará baixar sua chave privada no Console do Firebase > Configurações do Projeto > Contas de Serviço
const serviceAccount = require("./caminho-da-sua-chave.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const fcm = admin.messaging();

async function verificarETocarAlarme() {
  const agora = new Date();
  const hoje = agora.toISOString().split('T')[0];
  const horaAtual = agora.getHours().toString().padStart(2, '0') + ":" + agora.getMinutes().toString().padStart(2, '0');

  console.log(`Verificando tarefas para ${hoje} às ${horaAtual}...`);

  // 1. Busca tarefas de hoje que ainda não dispararam
  const tarefasRef = db.collection('tarefas');
  const snapshot = await tarefasRef.where('dataString', '==', hoje).where('alertaDisparado', '==', false).get();

  if (snapshot.empty) return;

  // 2. Busca os tokens salvos para envio
  const tokensSnap = await db.collection('assinaturas').get();
  const tokens = tokensSnap.docs.map(d => d.data().token);

  snapshot.forEach(async (doc) => {
    const t = doc.data();
    if (t.hora === horaAtual && tokens.length > 0) {
      
      const message = {
        notification: {
          title: '⏰ HORA DA TAREFA!',
          body: t.descricao
        },
        tokens: tokens,
      };

      // 3. ENVIA O PUSH QUE ACORDA O CELULAR
      const response = await fcm.sendMulticast(message);
      console.log('Alarme enviado com sucesso:', response.successCount);

      // Marca como disparado no banco
      await doc.ref.update({ alertaDisparado: true });
    }
  });
}

// Roda a cada 30 segundos para precisão total
setInterval(verificarETocarAlarme, 30000);