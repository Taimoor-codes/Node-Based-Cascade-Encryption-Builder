const LETTER_A_UPPER = 65;
const LETTER_Z_UPPER = 90;
const LETTER_A_LOWER = 97;
const LETTER_Z_LOWER = 122;

function shiftChar(char, shift) {
  const code = char.charCodeAt(0);

  if (code >= LETTER_A_UPPER && code <= LETTER_Z_UPPER) {
    const offset = code - LETTER_A_UPPER;
    const wrapped = ((offset + shift) % 26 + 26) % 26;
    return String.fromCharCode(LETTER_A_UPPER + wrapped);
  }

  if (code >= LETTER_A_LOWER && code <= LETTER_Z_LOWER) {
    const offset = code - LETTER_A_LOWER;
    const wrapped = ((offset + shift) % 26 + 26) % 26;
    return String.fromCharCode(LETTER_A_LOWER + wrapped);
  }

  return char;
}

function normalizeShift(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toHexXor(input, key) {
  if (!key) return input;

  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const xorCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    out += xorCode.toString(16).padStart(2, "0");
  }
  return out;
}

function fromHexXor(hexInput, key) {
  if (!key) return hexInput;

  let out = "";
  for (let i = 0, j = 0; i < hexInput.length; i += 2, j += 1) {
    const byte = Number.parseInt(hexInput.slice(i, i + 2), 16);
    const xorCode = byte ^ key.charCodeAt(j % key.length);
    out += String.fromCharCode(xorCode);
  }
  return out;
}

function sanitizeKeyword(keyword) {
  return String(keyword || "").replace(/[^a-z]/gi, "");
}

function vigenereTransform(input, keyword, decrypt = false) {
  const cleanKeyword = sanitizeKeyword(keyword);
  if (!cleanKeyword) return input;

  let out = "";
  let keyIndex = 0;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const code = char.charCodeAt(0);
    const isUpper = code >= LETTER_A_UPPER && code <= LETTER_Z_UPPER;
    const isLower = code >= LETTER_A_LOWER && code <= LETTER_Z_LOWER;

    if (!isUpper && !isLower) {
      out += char;
      continue;
    }

    const keyChar = cleanKeyword[keyIndex % cleanKeyword.length].toLowerCase();
    const shift = keyChar.charCodeAt(0) - LETTER_A_LOWER;
    const signedShift = decrypt ? -shift : shift;

    out += shiftChar(char, signedShift);
    keyIndex += 1;
  }

  return out;
}

function railFenceEncrypt(input, rails) {
  const railCount = normalizeShift(rails, 3);
  if (railCount <= 1 || input.length <= 1) return input;

  const fence = Array.from({ length: railCount }, () => []);
  let row = 0;
  let direction = 1;

  for (let i = 0; i < input.length; i += 1) {
    fence[row].push(input[i]);

    if (row === 0) direction = 1;
    if (row === railCount - 1) direction = -1;

    row += direction;
  }

  return fence.map((chars) => chars.join("")).join("");
}

function railFenceDecrypt(input, rails) {
  const railCount = normalizeShift(rails, 3);
  if (railCount <= 1 || input.length <= 1) return input;

  const pattern = [];
  let row = 0;
  let direction = 1;

  for (let i = 0; i < input.length; i += 1) {
    pattern.push(row);

    if (row === 0) direction = 1;
    if (row === railCount - 1) direction = -1;

    row += direction;
  }

  const railLengths = Array(railCount).fill(0);
  for (let i = 0; i < pattern.length; i += 1) {
    railLengths[pattern[i]] += 1;
  }

  const railsData = Array(railCount).fill("");
  let index = 0;

  for (let r = 0; r < railCount; r += 1) {
    railsData[r] = input.slice(index, index + railLengths[r]);
    index += railLengths[r];
  }

  const railPositions = Array(railCount).fill(0);
  let out = "";

  for (let i = 0; i < pattern.length; i += 1) {
    const r = pattern[i];
    const pos = railPositions[r];
    out += railsData[r][pos];
    railPositions[r] += 1;
  }

  return out;
}

function toBase64(input) {
  if (typeof btoa === "function") {
    return btoa(input);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "binary").toString("base64");
  }

  throw new Error("No base64 encoder available in this runtime.");
}

function fromBase64(input) {
  if (typeof atob === "function") {
    return atob(input);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "base64").toString("binary");
  }

  throw new Error("No base64 decoder available in this runtime.");
}

const CIPHERS = {
  caesar: {
    name: "Caesar Cipher",
    description: "Shift letters by a fixed integer amount; non-letters are unchanged.",
    defaultConfig: { shift: 3 },
    configFields: [
      {
        key: "shift",
        label: "Shift",
        type: "number",
        placeholder: "3"
      }
    ],
    encrypt(input, config = {}) {
      const shift = normalizeShift(config.shift, 3);
      return String(input)
        .split("")
        .map((char) => shiftChar(char, shift))
        .join("");
    },
    decrypt(input, config = {}) {
      const shift = normalizeShift(config.shift, 3);
      return String(input)
        .split("")
        .map((char) => shiftChar(char, -shift))
        .join("");
    }
  },

  xor: {
    name: "XOR Cipher",
    description: "XOR character codes with a repeating key and encode the encrypted bytes as hex.",
    defaultConfig: { key: "key" },
    configFields: [
      {
        key: "key",
        label: "Key",
        type: "text",
        placeholder: "key"
      }
    ],
    encrypt(input, config = {}) {
      const key = String(config.key ?? "key");
      return toHexXor(String(input), key);
    },
    decrypt(input, config = {}) {
      const key = String(config.key ?? "key");
      return fromHexXor(String(input), key);
    }
  },

  vigenere: {
    name: "Vigenere Cipher",
    description: "Apply polyalphabetic shifts using a keyword; case is preserved and non-letters are skipped.",
    defaultConfig: { keyword: "secret" },
    configFields: [
      {
        key: "keyword",
        label: "Keyword",
        type: "text",
        placeholder: "secret"
      }
    ],
    encrypt(input, config = {}) {
      return vigenereTransform(String(input), config.keyword ?? "secret", false);
    },
    decrypt(input, config = {}) {
      return vigenereTransform(String(input), config.keyword ?? "secret", true);
    }
  },

  railfence: {
    name: "Rail Fence Cipher",
    description: "Write text in a zigzag across rails, then read row by row.",
    defaultConfig: { rails: 3 },
    configFields: [
      {
        key: "rails",
        label: "Rails",
        type: "number",
        placeholder: "3"
      }
    ],
    encrypt(input, config = {}) {
      return railFenceEncrypt(String(input), config.rails ?? 3);
    },
    decrypt(input, config = {}) {
      return railFenceDecrypt(String(input), config.rails ?? 3);
    }
  },

  base64: {
    name: "Base64",
    description: "Encode with btoa and decode with atob.",
    defaultConfig: {},
    configFields: [],
    encrypt(input) {
      return toBase64(String(input));
    },
    decrypt(input) {
      return fromBase64(String(input));
    }
  },

  reverse: {
    name: "Reverse",
    description: "Reverse the input string.",
    defaultConfig: {},
    configFields: [],
    encrypt(input) {
      return String(input).split("").reverse().join("");
    },
    decrypt(input) {
      return String(input).split("").reverse().join("");
    }
  }
};

export function testAllCiphers() {
  const sample = "Hello World 123!";
  const entries = Object.entries(CIPHERS);

  for (let i = 0; i < entries.length; i += 1) {
    const [key, cipher] = entries[i];
    const config = { ...cipher.defaultConfig };

    let passed = false;
    try {
      const encrypted = cipher.encrypt(sample, config);
      const decrypted = cipher.decrypt(encrypted, config);
      passed = decrypted === sample;
      console.assert(passed, `[${key}] round-trip failed`, {
        sample,
        encrypted,
        decrypted
      });
    } catch (error) {
      passed = false;
      console.assert(false, `[${key}] threw during round-trip`, error);
    }

    console.log(`${passed ? "PASS" : "FAIL"}: ${key}`);
  }
}

export default CIPHERS;
