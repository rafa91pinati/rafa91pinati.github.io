importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAEQeIKc1MCrV8BJr0CH_mfjwCp1YiRC8s",
  messagingSenderId: "299659202964",
  projectId: "agenda-4efa7",
  appId: "1:299659202964:web:e358210feb4d7784f63f81"
});

const messaging = firebase.messaging();

// Captura mensagens quando o navegador está fechado
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensagem recebida:', payload);
  const notificationTitle = payload.notification?.title || "Lembrete da Agenda";
  const notificationOptions = {
    body: payload.notification?.body || "Você tem uma atividade marcada agora!",
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: 'alarme-tarefa'
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});