import test from 'node:test';
import assert from 'node:assert/strict';
import {posix, win32} from 'node:path';
import {isPathInside} from '../server/path-security.mjs';

test('Windows: arquivos legítimos do BytePets não são bloqueados', () => {
  const root = 'C:\\BytePets\\web';
  assert.equal(isPathInside(root, 'C:\\BytePets\\web\\index.html', win32), true);
  assert.equal(isPathInside(root, 'C:\\BytePets\\web\\src\\app.js', win32), true);
  assert.equal(isPathInside(root, 'C:\\BytePets\\web\\styles.css', win32), true);
  assert.equal(isPathInside(root, 'C:\\BytePets\\web\\assets\\pets\\idle.png', win32), true);
  assert.equal(isPathInside(root, 'C:\\BytePets\\web\\..\\server\\db.mjs', win32), false);
  assert.equal(isPathInside(root, 'C:\\BytePets\\web-backup\\index.html', win32), false);
  assert.equal(isPathInside(root, 'D:\\BytePets\\web\\src\\app.js', win32), false);
});

test('POSIX: arquivos legítimos são liberados e fuga do diretório é bloqueada', () => {
  const root = '/tmp/bytepets/web';
  assert.equal(isPathInside(root, '/tmp/bytepets/web/index.html', posix), true);
  assert.equal(isPathInside(root, '/tmp/bytepets/web/src/app.js', posix), true);
  assert.equal(isPathInside(root, '/tmp/bytepets/web/../server/index.mjs', posix), false);
  assert.equal(isPathInside(root, '/tmp/bytepets/web2/styles.css', posix), false);
});
