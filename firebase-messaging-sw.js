importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

// Inicializando Firebase com a chave do Firebase Web
firebase.initializeApp({
  apiKey: "I_waKJL3y7utz-8A8U3rxj863fQqUKf6MsiROfKbesw", // Use a chave do Firebase Web
  authDomain: "agenda-4efa7.firebaseapp.com",
  projectId: "agenda-4efa7",
  storageBucket: "agenda-4efa7.appspot.com",
  messagingSenderId: "299659202964",
  appId: "1:299659202964:web:e358210feb4d7784f63f81"
});

// Configurando o Firebase Messaging
const messaging = firebase.messaging();

// Instalando o Service Worker
self.addEventListener('install', () => {
  console.log("Service Worker instalado");
  self.skipWaiting();  // Garante que o novo SW seja instalado imediatamente
});

// Ativando o Service Worker
self.addEventListener('activate', () => {
  console.log("Service Worker ativado");
  self.clients.claim();  // O SW vai controlar a página imediatamente
});

// Recebendo notificações em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log("Mensagem recebida em segundo plano:", payload);
  
  // Mostra a notificação quando uma mensagem for recebida
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/311022.png'  // Use o ícone correto na raiz
  });
});