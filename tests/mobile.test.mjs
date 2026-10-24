import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const load=(path)=>readFileSync(resolve(root,path),'utf8');

test('mobile-first dock preserves school and student navigation separately',()=>{
 const js=load('web/src/app.js');
 assert.match(js,/function renderMobileDock\(\)/);
 assert.match(js,/staffRole\(\)/);
 assert.match(js,/school-\$\{key\}/);
 assert.match(js,/window\.BytePetsMobile=/);
 assert.match(js,/mobile-more/);
});

test('phone layout provides touch dock and readable in-screen content',()=>{
 const css=load('web/mobile.css');
 assert.match(css,/\.mobile-dock\{/);
 assert.match(css,/\.home-stage \.hero-stage\{/);
 assert.match(css,/aspect-ratio:16\/9!important/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/safe-area-inset-bottom/);
});

test('Flutter package and web asset catalog are present',()=>{
 for(const f of ['mobile_flutter/pubspec.yaml','mobile_flutter/lib/main.dart',
  'mobile_flutter/platform/android_debug/AndroidManifest.xml','web/icon-192.png',
  'web/mobile.css','web/manifest.webmanifest','web/assets/pets/idle.png',
  'web/assets/games/pattern.webp']) assert.ok(existsSync(resolve(root,f)),f);
 const flutter=load('mobile_flutter/lib/main.dart');
 assert.match(flutter,/WebViewWidget/);
 assert.match(flutter,/validateServerAddress/);
 assert.match(flutter,/BytePetsMobile\?\.goBack/);
});
