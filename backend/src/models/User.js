import bcrypt from 'bcryptjs';

/** Hash plain password for storage. Use when creating a new user. */
export function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

/** Compare plain password with stored hash. */
export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
