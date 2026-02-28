importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging-compat.js');

// Atenção: Use as MESMAS credenciais do Firebase que já estão no seu index.html
firebase.initializeApp({
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
});

const messaging = firebase.messaging();

// Intercepta e constrói a notificação quando o app está em segundo plano/fechado
messaging.onBackgroundMessage(function(payload) {
  console.log('Notificação recebida com app fechado:', payload);
  
  const notificationTitle = payload.notification.title || 'Agenda';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/caminho-para-seu-icone.png', // Ajuste para o seu logo
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});