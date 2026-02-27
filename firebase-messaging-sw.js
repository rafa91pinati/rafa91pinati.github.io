importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAEQeIKc1MCrV8BJr0CH_mfjwCp1YiRC8s",
  messagingSenderId: "299659202964",
  projectId: "agenda-4efa7",
  appId: "1:299659202964:web:e358210feb4d7784f63f81"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Mensagem recebida em segundo plano: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});