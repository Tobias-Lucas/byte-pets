# BytePets 1.1.0 — Infraestrutura local e VPS

## Alterações

- Docker Compose base com PostgreSQL 17 e volume persistente.
- Overlay `compose.local.yaml` para desenvolvimento com publicação explícita da porta.
- Overlay `compose.vps.yaml` com Traefik 3.7, TLS Let's Encrypt e redirecionamento de HTTP para HTTPS.
- API Node compatível com PostgreSQL por worker SQL serial, sem duplicar a lógica dos pets, contas, avaliações ou escolas.
- Banco SQLite legado mantido apenas para testes, snapshot e importação segura.
- Migração de SQLite para PostgreSQL com prévia e confirmação explícita `--apply`.
- Endpoint de saúde indica qual banco o processo usa.
- Flutter reconhece automaticamente a URL de produção embutida no APK; em debug pode descobrir o gateway do emulador Android.
- Bloqueio de HTTP em release e manutenção do servidor salvo para eventual configuração manual.
- Exclusão de `INICIAR_WINDOWS.bat` e `PREPARAR_ANDROID_WINDOWS.bat`.
- README novo e documentação detalhada de execução local, VPS, Android e backups.

## Limitações de homologação

- A lógica preserva o backend Node.js; **não** foi migrada para NestJS/Prisma.
- Mobile Flutter ainda usa WebView, **não** minigames Flame nativos.
- Sincronização é online por backend único, não há edição offline nem fila de reconciliação.
- PostgreSQL, Traefik, build do container e APK release requerem execução de teste em um ambiente com Docker e Flutter disponíveis.
- A ponte SQL usa um worker/conexão e deve ser substituída por acesso PG assíncrono para escalar horizontalmente.
- Antes de produção envolvendo crianças, realizar auditoria LGPD, autenticação, privacidade, acesso e proteção de dados.
