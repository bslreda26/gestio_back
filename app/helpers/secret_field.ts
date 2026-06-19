import encryption from '@adonisjs/core/services/encryption'

const ENCRYPTED_PREFIX = 'enc:'

export function encryptSecret(value: string): string {
  if (!value || value.startsWith(ENCRYPTED_PREFIX)) return value
  return `${ENCRYPTED_PREFIX}${encryption.encrypt(value)}`
}

export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(ENCRYPTED_PREFIX)) return value
  return encryption.decrypt(value.slice(ENCRYPTED_PREFIX.length)) as string
}
