// Importa os scripts do Firebase específicos para Service Workers (segundo plano)
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging-compat.js');

// ⚠️ ATENÇÃO: Cole aqui as MESMAS credenciais que você colocou no index.html!
firebase.initializeApp({
  apiKey: "AIzaSyAEQeIKc1MCrV8BJr0CH_mfjwCp1YiRC8s",
        authDomain: "agenda-4efa7.firebaseapp.com",
        projectId: "agenda-4efa7",
        storageBucket: "agenda-4efa7.appspot.com",
        messagingSenderId: "299659202964",
        appId: "1:299659202964:web:e358210feb4d7784f63f81"
   });

const messaging = firebase.messaging();

// Esta função é o que "acorda" o navegador para mostrar a notificação
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Notificação recebida com o app fechado: ', payload);

  // Monta a estrutura da notificação
  const notificationTitle = payload.notification.title || 'Agenda';
  const notificationOptions = {
    body: payload.notification.body,
    // Se você tiver um ícone do app, coloque o nome do arquivo aqui (ex: 'icone.png')
    icon: '/caminho-para-seu-icone.png', 
    badge: '/caminho-para-seu-icone.png', 
    // Mantém a notificação na tela até o usuário interagir
    requireInteraction: true 
  };

  // Exibe a notificação na tela do celular/computador
  return self.registration.showNotification(notificationTitle, notificationOptions);
});