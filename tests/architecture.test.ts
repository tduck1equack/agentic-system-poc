import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import ts from 'typescript';
function files(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []); }
test('domain and application layers only import inward-facing, framework-free modules', () => {
  for (const file of files('backend').filter(f => /\/(domain|application)\//.test(f))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const imports: string[] = [];
    function visit(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const specifier of imports) {
      assert.ok(specifier.startsWith('.'), `${file}: external dependency ${specifier}`);
      const target = relative(resolve('backend'), resolve(file, '..', specifier));
      assert.ok(!target.startsWith('..'), `${file}: import escapes backend`);
      assert.ok(!/\/(infrastructure|http)\//.test(target) && !target.endsWith('.module'), `${file}: outward dependency ${specifier}`);
      if (file.includes('/domain/')) assert.ok(target.includes('/domain/'), `${file}: domain depends on ${specifier}`);
    }
    assert.ok(!/\bprocess\.env\b/.test(source.text), `${file}: environment access belongs in infrastructure`);
  }
});
test('HTTP adapters cannot access persistence or provider SDKs', () => {
  for (const file of files('backend').filter(f => f.includes('/http/'))) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/from\s+['"][^'"]*(?:infrastructure|@prisma|openai|@modelcontextprotocol)/.test(text), file);
  }
});
