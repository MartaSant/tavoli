import bcrypt from 'bcryptjs'

const ROUNDS = 10

export const PinHasher = {
  hash(pin: string): string {
    return bcrypt.hashSync(pin, ROUNDS)
  },

  verify(pin: string, hash: string): boolean {
    try {
      return bcrypt.compareSync(pin, hash)
    } catch {
      return false
    }
  },
}
