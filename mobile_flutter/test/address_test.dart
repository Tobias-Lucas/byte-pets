import 'package:flutter_test/flutter_test.dart';
import 'package:bytepets_mobile/main.dart';

void main() {
  test('accepts HTTPS backend', () {
    expect(validateServerAddress('https://bytepets.example.br')?.host,
        'bytepets.example.br');
  });

  test('does not accept insecure HTTP by default', () {
    expect(validateServerAddress('http://192.168.1.10:4173'), isNull);
  });

  test('allows LAN HTTP only for explicitly enabled dev builds', () {
    final result = validateServerAddress('http://192.168.1.10:4173',
        allowHttp: true);
    expect(result?.port, 4173);
  });

  test('rejects invalid hosts and embedded credentials', () {
    expect(validateServerAddress('http://0.0.0.0:4173', allowHttp: true), isNull);
    expect(validateServerAddress('https://a:b@bytepets.test'), isNull);
  });
}
