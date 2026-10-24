# BytePets 1.1 | Docker local, VPS e Traefik

## 1. Componentes e estado real

A v1.1 integra **um único servidor** que atende tanto web quanto Flutter WebView. No Docker, o banco central é **PostgreSQL 17** e os arquivos de imagens escolares ficam num volume persistente. O cliente Android não possui outro banco de dados de progresso; acessa a mesma API e as mesmas contas. A sincronização é **online**, não existe modo offline com fila de alterações.

O backend ainda é **Node.js HTTP** com camada SQL de compatibilidade, **não NestJS/Prisma**. A migração desses frameworks e dos minigames para Flutter Flame é uma etapa posterior. A camada atual de compatibilidade PostgreSQL usa um único worker/conexão por instância e não foi concebida para dezenas de milhares de sessões simultâneas; mantenha **uma réplica da API** até migrar para acesso assíncrono/ORM e testar concorrência.

## 2. Execução local usando Docker

Pré-requisitos: Docker Desktop (Windows + Linux containers) ou Docker Engine + Compose v2 (Linux), porta 4173 livre.

```powershell
cd D:\BytePets\BytePets_Deploy_v1.1.0
Copy-Item .env.example .env
notepad .env
```

Defina `POSTGRES_PASSWORD` como uma senha longa e aleatória. É um segredo de banco, não inclua `.env` no Git. Inicie:

```powershell
docker compose -f compose.yaml -f compose.local.yaml up -d --build
docker compose -f compose.yaml -f compose.local.yaml ps
docker compose -f compose.yaml -f compose.local.yaml logs -f bytepets
```

Teste `http://localhost:4173/api/health` e `http://localhost:4173`. A resposta de health deve conter `"database":"postgres"`; **se disser `sqlite`, não é a implantação Docker descrita aqui**. A primeira inicialização permite configurar uso normal ou escola.

**Emulador Android:** com build de desenvolvimento e porta publicada em localhost, o mobile tenta automaticamente `http://10.0.2.2:4173`.

**Celular físico em Wi-Fi:** altere `BIND_ADDRESS=0.0.0.0` no `.env`, reinicie a composição e libere a porta 4173 apenas para a rede local no firewall. Descubra o IPv4 do computador com `ipconfig`. Compile o app com `--dart-define=BYTEPETS_URL=http://<IP-LOCAL>:4173 --dart-define=BYTEPETS_ALLOW_HTTP=true` no modo debug. Não use HTTP para servidores públicos.

Parar: `docker compose -f compose.yaml -f compose.local.yaml down`. **Nunca use `down -v` se quiser preservar PostgreSQL e imagens.**

## 3. VPS Linux, Traefik e HTTPS

Pré-requisitos: domínio próprio com DNS A/AAAA para o IP público da VPS, portas 80 e 443 permitidas no firewall, Docker Engine + Docker Compose v2 instalados, e certificados Let's Encrypt com e-mail válido. Não reutilize a senha do ambiente local.

Configure `.env`:

```dotenv
POSTGRES_DB=bytepets
POSTGRES_USER=bytepets
POSTGRES_PASSWORD=SUBSTITUA_POR_SENHA_ALEATORIA
APP_DOMAIN=bytepets.seudominio.com.br
ACME_EMAIL=admin@seudominio.com.br
```

Suba **sem** o `compose.local.yaml` (que expõe a porta de desenvolvimento):

```bash
docker compose -f compose.yaml -f compose.vps.yaml up -d --build
docker compose -f compose.yaml -f compose.vps.yaml ps
docker compose -f compose.yaml -f compose.vps.yaml logs -f bytepets traefik
curl -fsS https://bytepets.seudominio.com.br/api/health
```

O Traefik usa Docker provider com roteamento por domínio, redirecionamento de HTTP para HTTPS, certificado ACME (TLS challenge) e sem dashboard público. Apenas 80/443 estão publicados na VPS; a porta 5432 do banco permanece **não publicada**.

Para publicações atrás de Traefik existente, em vez de subir outro Traefik, conecte a aplicação à rede do proxy existente e ajuste a label `traefik.docker.network`, mantendo apenas um proxy em 80/443.

## 4. Android com endereço do servidor automaticamente conhecido

A URL pública do app precisa ser definida **durante a compilação**, pois o telefone não tem como adivinhar o domínio da sua VPS:

```powershell
cd mobile_flutter
flutter create --platforms=android,ios --project-name bytepets_mobile --org br.com.bytepets .
flutter pub get
flutter build apk --release --dart-define=BYTEPETS_URL=https://bytepets.seudominio.com.br
```

O app consulta o endpoint `/api/health` no início. Se não houver endpoint pré-configurado, ele tenta o último servidor salvo; no Android debug, tenta automaticamente o gateway `10.0.2.2:4173` do emulador. No celular físico sem configuração prévia, exibe o formulário manual. O Android release **não permite HTTP**, mesmo que um argumento de desenvolvimento seja fornecido.

Se o projeto Android já foi criado com `flutter create`, **não é necessário executá-lo novamente**. Após mudanças de endereço, gere um novo APK para fixar a URL correta. O aplicativo depende de conexão para transações e avaliação das missões.

## 5. Migração dos dados antigos (SQLite -> PostgreSQL)

1. Pare o servidor BytePets antigo. Salve o diretório `data` completo em um local seguro, fora do Git.
2. Crie snapshot consistente com `node scripts/snapshot-sqlite.mjs caminho/antigo/bytepets.sqlite backup/bytepets.sqlite` (no Node.js 22+). Copie também `data/media/` da versão antiga, se existir.
3. Suba os containers PostgreSQL + aplicação **sem criar contas novas ainda**.
4. Copie o snapshot para o container:

```powershell
docker compose -f compose.yaml -f compose.local.yaml cp backup/bytepets.sqlite bytepets:/app/data/legacy.sqlite
```

5. Prévia da importação:

```powershell
docker compose -f compose.yaml -f compose.local.yaml exec bytepets node scripts/migrate-sqlite-to-postgres.mjs --source /app/data/legacy.sqlite
```

6. Se os totais estiverem corretos, execute com `--apply`:

```powershell
docker compose -f compose.yaml -f compose.local.yaml exec bytepets node scripts/migrate-sqlite-to-postgres.mjs --source /app/data/legacy.sqlite --apply
```

O importador recusa o destino se já tiver contas; preserva IDs e progressos e mantém o arquivo SQLite intocado. Ele não transfere automaticamente as imagens; para copiá-las, use `docker compose ... cp backup/media/. bytepets:/app/data/media` e ajuste a propriedade do volume para o usuário `node` se necessário.

**Validação obrigatória:** confira login de responsável, professor e aluno, número de escolas/turmas, inventário, resultados e medalhas antes de desativar a instalação original.

## 6. Backup, rollback e manutenção

Backup PostgreSQL na VPS (Linux):

```bash
mkdir -p backups
docker compose -f compose.yaml -f compose.vps.yaml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > backups/bytepets-$(date +%F).sql
```

Faça backup também do volume `media_data` e do volume Traefik `acme_data`; idealmente em destino externo criptografado, com política de retenção e teste de restauração. O SQLite anterior deve permanecer guardado até validar a migração. Para alterar o servidor Docker, use `docker compose ... up -d --build`; nunca apague volumes para atualizar.

## 7. Segurança e limitações antes de uso público infantil

- Implementar/revisar gestão de consentimento dos responsáveis, termos, auditoria, retenção e exclusão de dados segundo LGPD.
- Testar operações concorrentes, recuperação após falhas de rede e importação do banco **em PostgreSQL real** antes de liberar instituições.
- Testar infraestrutura (build Docker, Traefik/ACME, backup e restore) na VPS escolhida; não foram executados neste ambiente de geração por ausência do Docker e acesso ao registro npm.
- O worker SQL é uma camada de compatibilidade para preservar a funcionalidade da v0.8; a versão futura com NestJS/Prisma usará SQL assíncrono e pool de conexões.
- Evite lançar mais de uma réplica da API até testar travamentos concorrentes nos fluxos de XP, PixelCoins, pedidos e avaliações.

### Referências

- https://docs.docker.com/reference/compose-file/services/
- https://doc.traefik.io/traefik/v3.4/user-guides/docker-compose/acme-tls/
- https://docs.flutter.dev/deployment/android
