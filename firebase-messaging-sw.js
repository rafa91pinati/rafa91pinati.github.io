// Importa os scripts necessários para o Service Worker [cite: 2026-02-27]
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

// Sua configuração oficial
const firebaseConfig = {
    apiKey: "AIzaSyAEQeIKc1MCrV8BJr0CH_mfjwCp1YiRC8s",
    authDomain: "agenda-4efa7.firebaseapp.com",
    projectId: "agenda-4efa7",
    storageBucket: "agenda-4efa7.appspot.com",
    messagingSenderId: "299659202964",
    appId: "1:299659202964:web:e358210feb4d7784f63f81"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Esta é a mágica: Ela acorda o Service Worker quando a nuvem manda um sinal [cite: 2026-02-27]
messaging.onBackgroundMessage((payload) => {
  console.log('Mensagem recebida em segundo plano:', payload);

  const notificationTitle = payload.notification.title || 'Aviso da Agenda';
  const notificationOptions = {
    body: payload.notification.body || 'Você tem uma nova tarefa.',
    icon: '/icone-agenda.png' // Certifique-se de ter um ícone na pasta se quiser usar
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});