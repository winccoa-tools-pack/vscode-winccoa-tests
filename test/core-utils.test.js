const { log, validateConfig, getExtensions } = require('../dist/index');

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('Running core-utils tests...');

assert(typeof log === 'function', 'log should be a function');
assert(validateConfig({}) === true, 'validateConfig should accept object');
assert(validateConfig(null) === false, 'validateConfig should reject null');

getExtensions().then(exts => {
  assert(Array.isArray(exts), 'getExtensions should return an array');
  console.log('All tests passed.');
}).catch(err => {
  console.error('Tests failed:', err);
  process.exit(2);
});
