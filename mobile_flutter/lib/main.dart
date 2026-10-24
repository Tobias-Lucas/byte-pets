import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

// BytePets Mobile: UI Flutter com a experiencia compartilhada do jogo web.
// Para executar minigames nativamente no Flame, manter a mesma API e contratos.
const _brand = Color(0xFF8CF9E5);
const _bg = Color(0xFF080F25);
const _surface = Color(0xFF14284B);
const _text = Color(0xFFE3F7FF);
const _configuredUrl = String.fromEnvironment('BYTEPETS_URL', defaultValue: '');
const _localAndroidEmulator = 'http://10.0.2.2:4173';
const _allowHttpForDevelopment = bool.fromEnvironment(
  'BYTEPETS_ALLOW_HTTP', defaultValue: false,
);

bool get _canUseHttp => _allowHttpForDevelopment && !kReleaseMode;

// All accounts, pets, progress and school records live in the SAME backend.
// The Flutter WebView does not maintain a separate mutable database.
Future<bool> checkServer(Uri server) async {
  final client = HttpClient()..connectionTimeout = const Duration(seconds: 3);
  try {
    final request = await client.getUrl(server.resolve('/api/health'))
        .timeout(const Duration(seconds: 3));
    final response = await request.close().timeout(const Duration(seconds: 3));
    return response.statusCode == 200;
  } catch (_) {
    return false;
  } finally {
    client.close(force: true);
  }
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BytePetsApp());
}

/// Validacao do endereco; HTTP somente quando explicitamente habilitado para LAN.
Uri? validateServerAddress(String raw, {bool allowHttp = false}) {
  final cleaned = raw.trim();
  final uri = Uri.tryParse(cleaned);
  if (uri == null || uri.host.isEmpty || uri.userInfo.isNotEmpty) return null;
  if (uri.scheme != 'https' && !(allowHttp && uri.scheme == 'http')) return null;
  if (uri.host == '0.0.0.0') return null;
  return uri.replace(fragment: '');
}

class BytePetsApp extends StatefulWidget {
  const BytePetsApp({super.key});

  @override
  State<BytePetsApp> createState() => _BytePetsAppState();
}

class _BytePetsAppState extends State<BytePetsApp> {
  Uri? _server;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _loadServer();
  }

  Future<void> _loadServer() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('bytepets_server') ?? '';
    // Production APK: always try the URL embedded in the build first.
    // Debug emulator: 10.0.2.2 is the host PC. Physical LAN devices can
    // use an explicit URL if no configured production endpoint responds.
    final candidates = <String>[
      if (_configuredUrl.isNotEmpty) _configuredUrl,
      if (saved.isNotEmpty && saved != _configuredUrl) saved,
      if (_canUseHttp && Platform.isAndroid) _localAndroidEmulator,
    ];
    Uri? selected;
    Uri? preferred;
    for (final candidate in candidates) {
      final uri = validateServerAddress(candidate, allowHttp: _canUseHttp);
      if (uri == null) continue;
      preferred ??= uri;
      if (await checkServer(uri)) { selected = uri; break; }
    }
    if (!mounted) return;
    // If a server was configured but is temporarily offline, keep its URL:
    // the WebView then provides Retry and Change server options.
    setState(() { _server = selected ?? preferred; _checking = false; });
  }

  Future<void> _chooseServer(Uri uri) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('bytepets_server', uri.toString());
    if (mounted) setState(() => _server = uri);
  }

  void _changeServer() {
    setState(() => _server = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BytePets',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: _bg,
        colorScheme: const ColorScheme.dark(
          primary: _brand, surface: _surface, onSurface: _text,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF112340),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 15, vertical: 16,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      home: _checking
          ? const SplashScreen()
          : _server == null
              ? ServerSetupScreen(onConnect: _chooseServer)
              : BytePetsWebScreen(
                  key: ValueKey(_server.toString()),
                  url: _server!,
                  onChangeServer: _changeServer,
                ),
    );
  }
}

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator(color: _brand)),
    );
  }
}

class ServerSetupScreen extends StatefulWidget {
  const ServerSetupScreen({required this.onConnect, super.key});
  final Future<void> Function(Uri) onConnect;

  @override
  State<ServerSetupScreen> createState() => _ServerSetupScreenState();
}

class _ServerSetupScreenState extends State<ServerSetupScreen> {
  final _controller = TextEditingController(text: _configuredUrl.isNotEmpty
      ? _configuredUrl : (_canUseHttp ? _localAndroidEmulator : ''));
  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    final uri = validateServerAddress(
      _controller.text, allowHttp: _canUseHttp,
    );
    if (uri == null) {
      setState(() => _error = _canUseHttp
          ? 'Informe um endereco HTTP(S) valido. Ex.: http://192.168.1.10:4173'
          : 'Use um endereco HTTPS valido.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await widget.onConnect(uri);
    } catch (_) {
      if (mounted) setState(() => _error = 'Nao foi possivel salvar o endereco.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 18),
                const Center(child: Text('✦', style: TextStyle(
                  color: _brand, fontSize: 44,
                ))),
                const SizedBox(height: 4),
                const Text('BytePets', textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900,
                    color: _brand, letterSpacing: 1)),
                const Text('APRENDA • EXPLORE • EVOLUA',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF97B9D8), letterSpacing: 1.2)),
                const SizedBox(height: 16),
                Image.asset('assets/images/student_avatar.png', height: 152,
                  filterQuality: FilterQuality.none),
                const SizedBox(height: 26),
                const Text('Conectar ao seu mundo',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 23, fontWeight: FontWeight.bold)),
                const SizedBox(height: 9),
                const Text('Use o mesmo servidor BytePets do computador ou da escola. '
                  'Assim seu pet, moedas, mundos e desafios permanecem sincronizados.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFFADC9E2), height: 1.45)),
                const SizedBox(height: 26),
                TextField(
                  controller: _controller,
                  autocorrect: false,
                  keyboardType: TextInputType.url,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _connect(),
                  decoration: InputDecoration(
                    labelText: 'Endereco do servidor',
                    hintText: _canUseHttp
                        ? 'http://192.168.1.10:4173' : 'https://bytepets.exemplo.br',
                    prefixIcon: const Icon(Icons.dns_outlined),
                    errorText: _error,
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: _loading ? null : _connect,
                  icon: _loading ? const SizedBox(width: 17, height: 17,
                    child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.rocket_launch_outlined),
                  label: const Text('Entrar no BytePets'),
                  style: FilledButton.styleFrom(
                    foregroundColor: const Color(0xFF071927),
                    backgroundColor: _brand,
                    minimumSize: const Size.fromHeight(54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  _canUseHttp
                      ? 'Para testar no Wi-Fi: o celular e o computador precisam usar '
                        'a mesma rede. Nao use localhost no celular.'
                      : 'Por seguranca, esta versao exige HTTPS.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF93ACCA)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class BytePetsWebScreen extends StatefulWidget {
  const BytePetsWebScreen({required this.url, required this.onChangeServer, super.key});
  final Uri url;
  final VoidCallback onChangeServer;

  @override
  State<BytePetsWebScreen> createState() => _BytePetsWebScreenState();
}

class _BytePetsWebScreenState extends State<BytePetsWebScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  String? _networkError;
  int _progress = 0;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(_bg)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) {
          if (mounted) setState(() { _loading = true; _networkError = null; });
        },
        onProgress: (v) {
          if (mounted) setState(() => _progress = v);
        },
        onPageFinished: (_) {
          if (mounted) setState(() => _loading = false);
        },
        onWebResourceError: (error) {
          if (error.isForMainFrame == true && mounted) {
            setState(() {
              _loading = false;
              _networkError = 'Nao foi possivel conectar ao servidor BytePets.';
            });
          }
        },
        onNavigationRequest: (request) {
          final target = Uri.tryParse(request.url);
          if (target == null) return NavigationDecision.prevent;
          // Keep visits and teacher invitation links on the configured server.
          if (target.scheme == 'about') return NavigationDecision.navigate;
          if (target.scheme != widget.url.scheme ||
              target.host != widget.url.host ||
              target.port != widget.url.port) {
            return NavigationDecision.prevent;
          }
          return NavigationDecision.navigate;
        },
      ))
      ..loadRequest(widget.url);
  }

  Future<void> _goBack() async {
    // BytePets is a SPA: native WebView back history doesn't reflect its pages.
    try {
      await _controller.runJavaScript('window.BytePetsMobile?.goBack?.();');
    } catch (_) {
      // No active page yet; remain in the app.
    }
  }

  Future<void> _refresh() async {
    setState(() { _loading = true; _networkError = null; });
    await _controller.reload();
  }

  Future<void> _openConnectionSettings() async {
    final shouldChange = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: _surface,
        title: const Text('Conexao BytePets'),
        content: Text('Servidor atual: ${widget.url}\n\n'
          'Para trocar o servidor, escolha Configurar.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true),
            child: const Text('Configurar')),
        ],
      ),
    );
    if (shouldChange == true) widget.onChangeServer();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _goBack();
      },
      child: Scaffold(
        body: SafeArea(
          bottom: true,
          child: Stack(
            children: [
              Positioned.fill(child: WebViewWidget(controller: _controller)),
              if (_loading)
                Positioned(
                  top: 0, left: 0, right: 0,
                  child: LinearProgressIndicator(
                    value: _progress > 0 ? _progress / 100 : null,
                    minHeight: 3,
                    color: _brand,
                    backgroundColor: Colors.transparent,
                  ),
                ),
              if (_networkError != null)
                Positioned.fill(child: ColoredBox(
                  color: _bg,
                  child: Center(child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 380),
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.wifi_off_rounded, size: 64, color: _brand),
                        const SizedBox(height: 18),
                        const Text('Servidor indisponivel',
                          style: TextStyle(fontSize: 23, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        Text(_networkError!, textAlign: TextAlign.center),
                        const SizedBox(height: 20),
                        FilledButton.icon(
                          onPressed: _refresh,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Tentar novamente'),
                        ),
                        TextButton.icon(
                          onPressed: _openConnectionSettings,
                          icon: const Icon(Icons.settings_outlined),
                          label: const Text('Trocar servidor'),
                        ),
                      ]),
                    ),
                  )),
                )),
              if (_networkError == null)
                Positioned(
                  right: 0, top: 38,
                  child: GestureDetector(
                    onLongPress: _openConnectionSettings,
                    child: const SizedBox(width: 8, height: 46),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
