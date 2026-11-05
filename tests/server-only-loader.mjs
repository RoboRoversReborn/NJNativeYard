// Node test adapter for Next's server-only bundler sentinel. Production keeps the sentinel.
import * as mod from 'node:module';
import { pathToFileURL } from 'node:url';

const require = mod.createRequire(import.meta.url);
const emptyPath = require.resolve('next/dist/compiled/server-only/empty.js');
const empty = pathToFileURL(emptyPath).href;

const Module = mod.Module || require('node:module');
if (Module && Module._resolveFilename) {
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, parent, isMain, options) {
    if (request === 'server-only') {
      return emptyPath;
    }
    return origResolve.call(this, request, parent, isMain, options);
  };
}

export function resolve(specifier, context, nextResolve) {
  return specifier === 'server-only' ? { url: empty, shortCircuit: true } : nextResolve(specifier, context);
}

if (typeof mod.registerHooks === 'function') {
  mod.registerHooks({ resolve });
} else if (typeof mod.register === 'function') {
  mod.register(import.meta.url);
}
