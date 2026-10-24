# BytePets Android/iOS — Flutter v1.1

O aplicativo Flutter exibe a UI responsiva do BytePets na WebView, conectada à **mesma API PostgreSQL** usada pelo portal. A UI web, os sprites, jogos e dados não são duplicados em um banco local do celular.

## Primeira preparação (sem scripts .bat)

```powershell
cd mobile_flutter
flutter create --platforms=android,ios --project-name bytepets_mobile --org br.com.bytepets .
flutter pub get
```

Para desenvolver em HTTP com o emulador, copie `platform/android_debug/AndroidManifest.xml` para `android/app/src/debug/AndroidManifest.xml` (somente debug). Se já possui os arquivos Android e a permissão INTERNET/cleartext debug, não rode `flutter create` novamente.

## Testar no emulador Android

Execute o Docker web+API com `compose.yaml` + `compose.local.yaml`. Depois:

```powershell
flutter devices
flutter run --dart-define=BYTEPETS_ALLOW_HTTP=true
```

O app verifica `http://10.0.2.2:4173/api/health` automaticamente. No navegador do emulador, essa mesma URL deve retornar JSON `status: ok` e `database: postgres`. Para usar um computador remoto na rede, configure explicitamente `--dart-define=BYTEPETS_URL=http://IP_DA_REDE:4173` no build debug.

## APK para VPS/produção HTTPS

```powershell
flutter build apk --release --dart-define=BYTEPETS_URL=https://bytepets.seudominio.com.br
```

O domínio deve corresponder ao configurado em `APP_DOMAIN` no Docker da VPS. O app verifica a API na inicialização; se não houver conexão, permite tentar novamente ou alterar o endereço manualmente. HTTP é bloqueado na compilação release.

## Estado

Ainda é uma WebView Flutter, não um motor Flame nativo. Não há modo offline com sincronização diferida. Não declare que o app funciona offline ou pode ser publicado para menores sem análise de privacidade e testes reais. Flutter SDK, Android SDK e Gradle são instalados na máquina de desenvolvimento, não dentro do container da API.
