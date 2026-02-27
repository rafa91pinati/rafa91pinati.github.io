// Captura mensagens quando o navegador está fechado
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Alarme recebido em segundo plano:', payload);
  
  const notificationTitle = payload.notification?.title || "⏰ HORA DA TAREFA!";
  const notificationOptions = {
    body: payload.notification?.body || "Clique para ver os detalhes da atividade.",
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [500, 110, 500, 110, 500], // Vibração mais longa para alarme
    tag: 'alarme-tarefa',
    requireInteraction: true, // A notificação NÃO SOME até você clicar nela
    data: {
      url: 'https://rafa91pinati.github.io/' // Link do seu app
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Lógica para abrir o app ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});