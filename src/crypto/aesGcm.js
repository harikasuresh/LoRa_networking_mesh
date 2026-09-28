const encoder = new TextEncoder()
const decoder = new TextDecoder()

const KEY_SEED = 'secure-lora-mesh-ops-128'
const KEY_SALT = 'field-mesh-key-salt'

async function getAesKey() {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(KEY_SEED),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(KEY_SALT),
      iterations: 120_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptAesGcm(message) {
  const key = await getAesKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(message),
  )

  return {
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertext)),
  }
}

export async function decryptAesGcm(packet) {
  const key = await getAesKey()
  const iv = Uint8Array.from(packet.iv || [])
  const ciphertext = Uint8Array.from(packet.ciphertext || [])

  const plainText = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )

  return decoder.decode(plainText)
}
