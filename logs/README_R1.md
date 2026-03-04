# README_R1: Checklist de Prevenção e Lições Aprendidas

Este documento consolida as falhas técnicas identificadas durante a Rev 1.0 e as soluções aplicadas para garantir a estabilidade em projetos futuros.

## 🏁 Checklist de Inicialização (Pré-Voo)
Antes de codificar o próximo aplicativo, verifique:
1. **Root SW**: O `firebase-messaging-sw.js` está na raiz do servidor?
2. **Auth First**: O `signInAnonymously` é executado antes de qualquer tentativa de gerar Token?
3. **Installations API**: A lógica de 'Identidade Forçada' está presente para evitar Erro 401?

## 🛠️ Soluções para Erros Comuns

### 1. Falha de Notificação (App Fechado)
* **Causa**: Suspensão de abas pelo sistema mobile.
* **Solução**: Migrar lógica de 'monitor local' para 'Cloud Functions' (Rev 2.0).

### 2. Erros de Autorização (Token Vazio)
* **Causa**: Falta de contexto de autenticação no Firebase.
* **Solução**: Utilizar `getInstallations` e `getId` para validar o dispositivo no Google Cloud.

### 3. Loop de Alarme
* **Causa**: Falta de flag de controle no banco de dados.
* **Solução**: Campo `alertaDisparado` obrigatório em todos os documentos de tarefa.

### 4. Estouro de Memória no Firestore
* **Causa**: Upload de fotos brutas em base64.
* **Solução**: Pipeline de compressão via Canvas (Max 400px, 50% qualidade) no front-end.

## 📈 Roadmap Técnico para Novos Apps
1. **Base**: Firebase v12.4.0 (Modular).
2. **Push**: Configuração VAPID Key no início do projeto.
3. **Admin**: Uso de Cloud Functions para processos críticos de tempo.

---
Gerado para a pasta: Aplicativo agenda
Status: Revisão de Prevenção Validada
