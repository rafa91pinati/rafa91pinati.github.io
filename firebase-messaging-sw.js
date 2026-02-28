importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAEQeIKc1MCrV8BJr0CH_mfjwCp1YiRC8s",
  authDomain: "agenda-4efa7.firebaseapp.com",
  projectId: "agenda-4efa7",
  storageBucket: "agenda-4efa7.appspot.com",
  messagingSenderId: "299659202964",
  appId: "1:299659202964:web:e358210feb4d7784f63f81"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Notificação recebida em segundo plano: ', payload);

  // Agora ele lê do lugar exato que o Node.js envia (payload.notification)
  const notificationTitle = payload.notification?.title || 'Lembrete da Agenda';
  const notificationBody = payload.notification?.body || 'Você tem um compromisso!';

  // Agora ele lê a variável certa do Node.js (comportamento)
  const ehFixa = payload.data?.comportamento === 'fixa'; 

  const notificationOptions = {
    body: notificationBody,
    icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
    requireInteraction: ehFixa // Trava na tela se for fixa
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});