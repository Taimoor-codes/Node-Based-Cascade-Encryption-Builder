import CIPHERS from "./ciphers.js";

function cloneConfig(config) {
  return { ...config };
}

function ensureCipherKey(cipherKey) {
  const cipher = CIPHERS[cipherKey];
  if (!cipher) {
    throw new Error(`Unknown cipherKey: ${cipherKey}`);
  }
  return cipher;
}

function createUniqueId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createNode(cipherKey) {
  const cipher = ensureCipherKey(cipherKey);
  return {
    id: createUniqueId(),
    cipherKey,
    config: cloneConfig(cipher.defaultConfig)
  };
}

export function addNode(pipeline, cipherKey) {
  return [...pipeline, createNode(cipherKey)];
}

export function removeNode(pipeline, nodeId) {
  return pipeline.filter((node) => node.id !== nodeId);
}

export function moveNode(pipeline, nodeId, direction) {
  const index = pipeline.findIndex((node) => node.id === nodeId);
  if (index === -1) return [...pipeline];

  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const targetIndex = Math.min(Math.max(index + delta, 0), pipeline.length - 1);

  if (targetIndex === index) return [...pipeline];

  const next = [...pipeline];
  const [node] = next.splice(index, 1);
  next.splice(targetIndex, 0, node);
  return next;
}

export function updateNodeConfig(pipeline, nodeId, newConfig) {
  return pipeline.map((node) => {
    if (node.id !== nodeId) return node;
    return {
      ...node,
      config: cloneConfig(newConfig || {})
    };
  });
}

export function runEncrypt(pipeline, plaintext) {
  const steps = [];
  let current = String(plaintext);

  for (let i = 0; i < pipeline.length; i += 1) {
    const node = pipeline[i];
    const cipher = ensureCipherKey(node.cipherKey);
    const output = cipher.encrypt(current, node.config);

    steps.push({
      nodeId: node.id,
      cipherKey: node.cipherKey,
      input: current,
      output
    });

    current = output;
  }

  return steps;
}

export function runDecrypt(pipeline, ciphertext) {
  const steps = [];
  let current = String(ciphertext);

  for (let i = pipeline.length - 1; i >= 0; i -= 1) {
    const node = pipeline[i];
    const cipher = ensureCipherKey(node.cipherKey);
    const output = cipher.decrypt(current, node.config);

    steps.push({
      nodeId: node.id,
      cipherKey: node.cipherKey,
      input: current,
      output
    });

    current = output;
  }

  return steps;
}

function testPipelineStateManager() {
  const original = "Hello World";

  let pipeline = [];
  pipeline = addNode(pipeline, "caesar");
  pipeline = addNode(pipeline, "xor");
  pipeline = addNode(pipeline, "vigenere");

  pipeline = updateNodeConfig(pipeline, pipeline[0].id, { shift: 3 });
  pipeline = updateNodeConfig(pipeline, pipeline[1].id, { key: "abc" });
  pipeline = updateNodeConfig(pipeline, pipeline[2].id, { keyword: "test" });

  const encryptSteps = runEncrypt(pipeline, original);
  const encryptedFinal =
    encryptSteps.length > 0 ? encryptSteps[encryptSteps.length - 1].output : original;

  const decryptSteps = runDecrypt(pipeline, encryptedFinal);
  const decryptedFinal =
    decryptSteps.length > 0 ? decryptSteps[decryptSteps.length - 1].output : encryptedFinal;

  console.log("Pipeline:", pipeline);
  console.log("Encrypt steps:", encryptSteps);
  console.log("Decrypt steps:", decryptSteps);

  const passed = decryptedFinal === original;
  console.assert(passed, "Pipeline round-trip failed", {
    original,
    encryptedFinal,
    decryptedFinal
  });
  console.log(`${passed ? "PASS" : "FAIL"}: pipeline round-trip`);
}

if (typeof window === "undefined") {
  testPipelineStateManager();
}
