// Node test adapter for Next's server-only bundler sentinel. Production keeps the sentinel.
import { registerHooks, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const empty = pathToFileURL(require.resolve('next/dist/compiled/server-only/empty.js')).href;
registerHooks({resolve(specifier, context, nextResolve) {
  return specifier === 'server-only' ? {url:empty,shortCircuit:true} : nextResolve(specifier,context);
}});
