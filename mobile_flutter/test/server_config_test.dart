import 'package:flutter_test/flutter_test.dart';
import 'package:bytepets_mobile/main.dart';
void main(){
 test('production endpoint uses HTTPS', () {
  expect(validateServerAddress('https://pets.school.example/')?.scheme,'https');
 });
 test('emulator gateway is only allowed for explicitly enabled development', () {
  expect(validateServerAddress('http://10.0.2.2:4173'),isNull);
  expect(validateServerAddress('http://10.0.2.2:4173',allowHttp:true)?.host,'10.0.2.2');
 });
}
