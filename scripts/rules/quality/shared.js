// Shared value guards for the per-target quality rule modules. Kept dependency-free
// so every quality/*.js can import them without pulling in another rule layer.

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export { asArray, isPlainObject };
