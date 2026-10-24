# BytePets — arquitetura mobile e evolução para Flame

## Implementado (mobile-first, 1.1)

- `Flutter WebViewWidget` atua como host nativo Android/iOS.
- A aplicação compartilhada `web/` seleciona a versão visual responsiva por `@media`.
- O menu inferior de cinco áreas muda por papel (aluno ou equipe institucional).
- As interações são as mesmas no navegador e na WebView, com cookies de sessão HttpOnly do backend.
- Sistema de mundos, pets, cuidados, skins, alimentação, jogos, desafios, testes, bronze/prata/ouro, escola, professores, turmas, amigos e visitas continua no backend da v0.8.
- O servidor e o PostgreSQL são centralizados no Docker. A WebView não mantém banco de progresso separado; os dispositivos acessam a mesma API. SQLite permanece apenas para migração legada e testes.
- A navegação interna SPA foi ligada ao botão nativo voltar via `window.BytePetsMobile.goBack()`.
- O Android inicia pela URL HTTPS embutida no APK (produção), pelo último servidor configurado ou por `10.0.2.2:4173` quando roda no emulador debug. Servidor LAN físico pode ser informado no desenvolvimento.
- O frontend inclui manifesto PWA; **o modo offline de jogos não foi implementado**.

## Separação proposta para uma engine Flutter + Flame futura

1. Extrair contratos dos minigames em JSON (`pattern`, `bridges`, `snake`) e validar servidor.
2. Criar `GameWidget` com Flame e manter o POST `/api/games/start` + `/api/games/finish`.
3. Migrar o renderer do pet para SpriteComponent e preservar slots/anchors por mundo.
4. Criar telas Flutter para home, loja, mundo, medalhas e quiz, preservando autenticação.
5. Migrar portal administrativo para React e backend para NestJS/Prisma com acesso PostgreSQL assíncrono. O PostgreSQL do Docker já é a base central, mas os frameworks e o DB adapter de produção avançada ainda serão substituídos.
6. Offline: cache local por usuário, tentativas identificadas por UUID, fila de sincronização e reconciliação idempotente. Isso requer mudanças de backend.

## Regras que não podem divergir

- XP, PixelCoins, notas e medalhas calculadas apenas pelo servidor.
- Uma conta por matrícula autorizada; professores aprovados e vinculados a turmas.
- Medalha de ouro ao 100% bloqueia nova tentativa, mas permite revisão de explicações.
- Limites diários consultados e concedidos pela API; novo jogo inicia nova rodada de mesmo tipo.
- Visitas exigem permissão, não expõem matrícula nem dados sensíveis.
- Uma única conta/pet por aluno, independentemente da escola.

## Responsividade

Em tela de celular o menu inferior é fixo, os mundos e jogos usam um card por vez, o habitat tem proporção 16:9 e o pet fica em camada separada da cena. Os controles da cobrinha mantêm suporte a setas/WASD e toques. Conteúdos pedagógicos e formulários priorizam legibilidade; usam rolagem vertical **dentro do painel principal** quando não cabem sem corte (não é adequado ocultar alternativas de um teste para evitar scroll a qualquer custo).
