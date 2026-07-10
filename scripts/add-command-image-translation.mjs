import { readFileSync, writeFileSync } from 'node:fs'

const builtinPath = new URL('../src/engine/builtin.js', import.meta.url)
let builtin = readFileSync(builtinPath, 'utf8')

if (!builtin.includes('export function resolveCommandTranslator')) {
  const marker = '// ── Key 随机负载均衡'
  const index = builtin.indexOf(marker)
  if (index < 0) throw new Error('Could not locate builtin insertion point')
  const helper = `export function resolveCommandTranslator() {
 const p = _P.co
 return {
 providerId: 'co',
 baseUrl: _d(p.u),
 keys: p.k.map(_d),
 apiModel: 'command-a-03-2025',
 chatPath: '/v1/chat/completions',
 type: 'chat',
 }
}

`
  builtin = builtin.slice(0, index) + helper + builtin.slice(index)
  writeFileSync(builtinPath, builtin)
}

const runnerPath = new URL('../src/engine/runner.js', import.meta.url)
let runner = readFileSync(runnerPath, 'utf8')

runner = runner.replace(
  "import { getBuiltinConfig, resolveModel, randomKeyIndex, isQuotaError, DEFAULT_MODEL } from './builtin.js'",
  "import { getBuiltinConfig, resolveModel, resolveCommandTranslator, randomKeyIndex, isQuotaError, DEFAULT_MODEL } from './builtin.js'",
)

if (!runner.includes('async function translateImagePromptWithCommand')) {
  const marker = 'export async function generateImage'
  const index = runner.indexOf(marker)
  if (index < 0) throw new Error('Could not locate generateImage')
  const helper = `async function translateImagePromptWithCommand(prompt, signal) {
 const source = String(prompt || '').trim()
 if (!source || !/[\\u3400-\\u9fff]/.test(source)) return source

 const translator = resolveCommandTranslator()
 if (!translator.keys.length) return source
 const body = {
 model: translator.apiModel,
 temperature: 0.1,
 messages: [
 { role: 'system', content: 'Translate the user image-generation prompt into natural, precise English. Preserve every subject, attribute, style, composition, camera, lighting, text, and constraint. Do not add, remove, censor, explain, or answer. Return only the translated prompt.' },
 { role: 'user', content: source },
 ],
 }

 const start = randomKeyIndex(translator.keys.length)
 let lastError
 for (let i = 0; i < translator.keys.length; i++) {
 const key = translator.keys[(start + i) % translator.keys.length]
 try {
 const json = await apiPost(joinUrl(translator.baseUrl, translator.chatPath), key, body, signal)
 const translated = json?.choices?.[0]?.message?.content?.trim()
 if (translated) return translated
 } catch (error) {
 if (error?.name === 'AbortError' || /aborted/i.test(error?.message || '')) throw error
 lastError = error
 }
 }
 console.warn('Command prompt translation failed, using original prompt', lastError)
 return source
}

`
  runner = runner.slice(0, index) + helper + runner.slice(index)
}

if (!runner.includes('await translateImagePromptWithCommand(prompt, signal)')) {
  runner = runner.replace(
    ' const finalPrompt = prompt',
    ' const finalPrompt = await translateImagePromptWithCommand(prompt, signal)',
  )
}

if (!runner.includes('await translateImagePromptWithCommand(prompt, signal)')) {
  throw new Error('Command image translation was not applied')
}

writeFileSync(runnerPath, runner)
console.log('Command image prompt translation enabled')
