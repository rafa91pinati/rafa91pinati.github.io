// Usando a versão Compat para garantir máxima compatibilidade no Service Worker
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAEQeIKc1MCrV8BJr0CH_mfjwCp1YiRC8s",
  messagingSenderId: "299659202964",
  projectId: "agenda-4efa7",
  appId: "1:299659202964:web:e358210feb4d7784f63f81"
});

const messaging = firebase.messaging();

// Lógica para quando o app está fechado
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Alarme recebido:', payload);
  
  const title = payload.notification?.title || "⏰ HORA DA TAREFA!";
  const options = {
    body: payload.notification?.body || "Confira sua agenda agora.",
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [500, 110, 500, 110, 500],
    tag: 'alarme-agenda',
    requireInteraction: true // Mantém o alerta na tela
  };

  return self.registration.showNotification(title, options);
});