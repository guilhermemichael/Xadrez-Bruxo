import js from '@eslint/js';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/assets/stockfish/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', navigator: 'readonly', AudioContext: 'readonly', SpeechSynthesisUtterance: 'readonly', speechSynthesis: 'readonly', SpeechRecognition: 'readonly', webkitSpeechRecognition: 'readonly', THREE: 'readonly', requestAnimationFrame: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', queueMicrotask: 'readonly', console: 'readonly', alert: 'readonly', confirm: 'readonly', prompt: 'readonly', Blob: 'readonly', URL: 'readonly' } },
    rules: { 'no-unused-vars': 'off', 'no-undef': 'error', 'no-empty': ['error', { allowEmptyCatch: true }] }
  }
  ,{ files: ['scripts/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { console: 'readonly' } }, rules: { 'no-unused-vars': 'off', 'no-undef': 'error' } }
];
