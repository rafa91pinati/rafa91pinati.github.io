// Importa os scripts necessários para o Service Worker
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

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

// Lógica para exibir a notificação em segundo plano
messaging.onBackgroundMessage((payload) => {
    console.log('Mensagem recebida em segundo plano:', payload);

    const notificationTitle = payload.notification.title || 'Aviso da Agenda';
    
    // O segredo está aqui: decidimos se a notificação "gruda" ou não
    // Se você enviar no campo 'data' do Firebase o valor sticky: "true", ela fixa.
    // Caso contrário, usamos como padrão o que você preferir (aqui deixei true para alarmes)
    const notificationOptions = {
        body: payload.notification.body || 'Você tem uma nova tarefa.',
        icon: '/icone-agenda.png', 
        badge: '/icone-agenda.png', // Ícone pequeno na barra de status
        vibrate: [200, 100, 200],
        tag: 'alarme-agenda', // Impede que as notificações fiquem empilhando (substitui a anterior)
        renotify: true,
        
        // --- A LÓGICA DE FIXAR ---
        // Se requireInteraction for true, a notificação não some sozinha no Android/PC
        requireInteraction: true, 
        
        data: {
            url: '/' // Abre o app ao clicar
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Abre o app quando clicar na notificação
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});