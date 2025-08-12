//Utility Crypto functions
let crypto;
try {
  crypto = require('node:crypto');
} catch (err) {
  console.error('crypto support is disabled!');
}

const stringifyOrdered = require('json-stable-stringify');
const conf = require('./config');

//CryptoIV
let cryptoAlg;
let cryptoKey;

const INPUT_ENCODING = 'utf8';
const OUTPUT_ENCODING = 'hex';
const CRYPT_SEP = ':';

exports.encryptMD5 = value => {
  var hash = crypto.createHash('md5').update(value).digest('hex');
  return hash;
};

/**
 * Check if a string has been encrypted by checking for errors
 * @param {string} value string to check
 */
exports.isEncrypted = value => {
  try {
    this.decrypt(value);
  } catch(error) {
    return false;
  }
  return true;
};

/**
 * Handle circular dependency between Utilcrypto.js and config.js
 * Crypto parameters are only set when needed
 */
const paramCheck = () => {
  if (!cryptoAlg || ! cryptoKey) {
    cryptoAlg = conf.getConfig().crypto.symmetric.algorithm;
    cryptoKey = conf.getConfig().crypto.symmetric.secret || 'b2df428b9929d3ace7c598bbf4e496b2';
  }
};

/**
 * Encrypt using an initialisation vector
 * @param {string} value to encrypt
 */
exports.encrypt = value => {
  paramCheck();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(cryptoAlg, cryptoKey, iv);
  let crypted = cipher.update(value, INPUT_ENCODING, OUTPUT_ENCODING);
  crypted += cipher.final(OUTPUT_ENCODING);
  return `${iv.toString(OUTPUT_ENCODING)}${CRYPT_SEP}${crypted.toString()}`;
};

/**
 * Decrypt using an initialisation vector
 * @param {string} value value to decrypt
 */
exports.decrypt = value => {
  paramCheck();
  const textParts = value.split(CRYPT_SEP);

  //extract the IV from the first half of the value
  const IV = Buffer.from(textParts.shift(), OUTPUT_ENCODING);

  //extract the encrypted text without the IV
  const encryptedText = Buffer.from(textParts.join(CRYPT_SEP), OUTPUT_ENCODING);

  //decipher the string
  const decipher = crypto.createDecipheriv(cryptoAlg, cryptoKey, IV);
  let decrypted = decipher.update(encryptedText, OUTPUT_ENCODING, INPUT_ENCODING);
  decrypted += decipher.final(INPUT_ENCODING);
  return decrypted.toString();
};

/**
 * Obfuscate part of a string with '*'
 * @param string String to be objuscated
 * @param numClear Number of character to leave in plain text from the start of the string
 * @returns {string} String with the first 'numClear' chars in plain text and with the rest obfuscated
 */
exports.obfuscate = (string, numClear = 4) => {
  const before = string.slice(0, numClear);
  return before.padEnd(string.length, '*')
};

// Decrypt values of an object, up to depth 1
exports.decryptObject = (obj, skipKeys = []) => {
  let newObj = JSON.parse(JSON.stringify(obj));
  const keys = Object.keys(newObj);

  for (let key of keys) {
    if (skipKeys.indexOf(key) !== -1) {
      continue;
    }
    if (this.isEncrypted(newObj[key])) {
      // Checking for encryption + decrypting performs the same step twice, but who cares...
      newObj[key] = this.decrypt(newObj[key]);
    }
  }
  return newObj
};

// Encrypt values of an object, up to depth 1
exports.encryptObj = (obj, skipKeys = []) => {
  let newObj = JSON.parse(JSON.stringify(obj));
  const keys = Object.keys(newObj);

  for (let key of keys) {
    // Only crypt it if it is not encrypted yet
    if (skipKeys.indexOf(key) !== -1) {
      continue;
    }
    if (!this.isEncrypted(newObj[key])) {
      newObj[key] = this.encrypt(newObj[key]);
    }
  }
  return newObj;
};

/**
 * Get an object and digest it to a MD5 hash consistently (sort invariant)
 * @param obj object to digest
 * @param deleteFields array of fields to delete from object
 * @returns {string} consistend MD5 hash of the original object after removing *deleteFields*
 */
exports.digest = (obj, deleteFields = []) => {
  const newObj = JSON.parse(JSON.stringify(obj));
  for (let field of deleteFields) {
    if (newObj.hasOwnProperty(field)) {
      delete newObj[field];
    }
  }
  return this.encryptMD5(stringifyOrdered(newObj));
};
