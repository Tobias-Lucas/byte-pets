# BytePets — Web + Android / Docker + PostgreSQL (v1.1)

Jogo educacional e gestão escolar no mesmo backend. Funcionalidades: pet, XP, PixelCoins, mundos, jogos, desafios, relatórios, escolas, turmas, professores, alunos, medalhas e visitas. O Android usa Flutter + WebView com a mesma interface e API web; minigames ainda não foram convertidos para Flame.

## Rodar com Docker localmente

1. Instale Docker Desktop/Engine com Compose v2.
2. Copie `.env.example` para `.env` e defina `POSTGRES_PASSWORD` (obrigatória).
3. Execute:

```bash
docker compose -f compose.yaml -f compose.local.yaml up -d --build
```

Acesse `http://localhost:4173` e teste `http://localhost:4173/api/health` (`database: postgres`). O servidor e o banco sobem juntos. O `.env` não deve ser enviado ao GitHub.

## VPS + HTTPS / Traefik

Defina `APP_DOMAIN`, `ACME_EMAIL` e `POSTGRES_PASSWORD` no `.env`, aponte o DNS do domínio para sua VPS e libere as portas 80/443:

```bash
docker compose -f compose.yaml -f compose.vps.yaml up -d --build
```

Leia **[docs/DEPLOY_LOCAL_VPS.md](docs/DEPLOY_LOCAL_VPS.md)** antes de colocar alunos online. O Compose VPS não publica o PostgreSQL. O certificado HTTPS exige domínio real, DNS correto e portas acessíveis.

## Android / Flutter

O projeto Flutter está em `mobile_flutter/`. Uma única URL do servidor central mantém dados web e mobile sincronizados **online**. Não existe segundo banco de dados local no app.

Com o projeto Android já gerado:

```bash
cd mobile_flutter
flutter pub get
flutter run --dart-define=BYTEPETS_ALLOW_HTTP=true
```

No emulador Android, o BytePets tenta `http://10.0.2.2:4173` automaticamente. Para uma VPS, crie APK com endereço HTTPS incorporado:

```bash
flutter build apk --release --dart-define=BYTEPETS_URL=https://bytepets.seudominio.com.br
```

Se for o primeiro uso numa máquina nova, rode uma vez `flutter create --platforms=android,ios --project-name bytepets_mobile --org br.com.bytepets .` na pasta `mobile_flutter` para gerar as pastas de plataforma. Para permitir HTTP em debug, copie `platform/android_debug/AndroidManifest.xml` para `android/app/src/debug/AndroidManifest.xml`.

## Ambiente existente / importação do SQLite

Não copie somente arquivos `sqlite` para o volume PostgreSQL. Leia o procedimento de snapshot e importação em **[docs/DEPLOY_LOCAL_VPS.md](docs/DEPLOY_LOCAL_VPS.md)**. Salve backup antes de migrar; a instalação antiga deve permanecer intacta até validar as contas e notas.

## Testes e verificações

```bash
npm test
npm run check
```

O Node.js local usa SQLite por padrão **apenas para testes/compatibilidade**. O Docker impõe `DB_ENGINE=postgres` e não volta para SQLite silenciosamente se o banco falhar. `node server/index.mjs` isolado NÃO é equivalente ao ambiente VPS.

**Situação tecnológica:** backend Node.js; PostgreSQL no Docker; Android Flutter/WebView. Não é ainda NestJS/Prisma nem Flutter/Flame nativo. Esta é uma base de homologação: a configuração do Docker/Traefik/PG depende de testes na infraestrutura real e de revisão de segurança específica para dados infantis antes de produção pública.

## Integração contínua (GitHub)

O workflow `.github/workflows/ci.yml` executa os testes Node e sobe PostgreSQL + aplicação em Docker, validando se `/api/health` informa `postgres`. O resultado dessa etapa no GitHub é importante porque o build Docker não pôde ser executado no ambiente onde este pacote foi gerado.
