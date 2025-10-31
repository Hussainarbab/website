// In-memory store (replace with a database in production)

export const usersByEmail = new Map();

export function getUserByEmail(email) {
  return usersByEmail.get(email.toLowerCase());
}

export function saveUser(user) {
  usersByEmail.set(user.email.toLowerCase(), user);
  return user;
}

export function ensureUserDefaults(user) {
  user.points = user.points ?? 0;
  user.earnings = user.earnings ?? 0;
  user.rupeesFromPoints = user.rupeesFromPoints ?? 0;
  user.connectedAccounts = Array.isArray(user.connectedAccounts) ? user.connectedAccounts : [];
  return user;
}

