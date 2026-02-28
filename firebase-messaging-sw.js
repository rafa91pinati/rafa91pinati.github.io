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

  const notificationTitle = payload.data.title || 'Lembrete da Agenda';
  // Lemos o payload para saber se o usuário marcou como 'fixa' no app
  const ehFixa = payload.data.tipo === 'fixa'; 

  const notificationOptions = {
    body: payload.data.body || 'Você tem um compromisso agora!',
    icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
    requireInteraction: ehFixa // Faz a notificação travar na tela se for verdadeira
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});