# README_R0: Minha Agenda Inteligente

Este documento detalha a fundação técnica e as funcionalidades implementadas na versão estável inicial do projeto de agenda com notificações inteligentes (Fevereiro de 2026).

## 📝 Descrição do Projeto
O **APP agenda** é uma ferramenta de produtividade focada em interação ativa com o usuário. O objetivo principal é garantir que o celular dispare alertas sonoros e visuais (push notifications) para compromissos agendados, mesmo em segundo plano.

## 🛠️ Pilares Tecnológicos
* **Firebase Web SDK v12.4.0**: Versão estável utilizada para garantir suporte às APIs de mensageria.
* **Firestore**: Banco de dados NoSQL para persistência de tarefas, categorias e tokens.
* **Firebase Cloud Messaging (FCM)**: Motor responsável pelo envio e recepção de sinais de alerta.
* **Firebase Auth (Anônimo)**: Implementado para garantir segurança no registro de tokens.

## 🚀 Funcionalidades da Revisão Zero (R0)
* **Monitor de Alarme Local**: Sistema que verifica o banco de dados a cada 60 segundos.
* **Integração Push**: Conexão validada com o navegador, gerando tokens ativos.
* **Upload Inteligente de Fotos**: Processamento de imagens via canvas (base64) para economia de armazenamento.
* **Filtros de Timeline**: Navegação entre "Semanal", "Hoje" e "Amanhã".
* **Categorias Dinâmicas**: Interface para criação e personalização de pastas de tarefas.

## 🔧 Correções Críticas (Milestones)
* **Solução do Erro 401**: Implementação da 'Identidade Forçada' via Firebase Installations.
* **Persistência de Alarme**: Inclusão do campo 'alertaDisparado' para evitar repetições.
* **Reset de Cache**: Botão dedicado para limpeza de Service Worker e cache do navegador.

## 📋 Como Executar
1. Configure suas credenciais no objeto `firebaseConfig` no `index.html`.
2. Certifique-se de que o arquivo `firebase-messaging-sw.js` está na raiz do servidor.
3. Realize o login anônimo para sincronizar as categorias.

## 🔮 Próximos Passos (Rev 2.0)
* Transição para o **Plano Blaze** do Firebase.
* Implementação de **Cloud Functions (onSchedule)** para monitoramento 24h no servidor.

---
Gerado em: 27/02/2026
Pasta do Projeto: Aplicativo agenda
