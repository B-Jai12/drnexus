// lib/auth/session.ts
// Call these from your login/logout handlers

export function setSessionCookie(uid: string) {
  // 1 hour session — adjust as needed
  document.cookie = `firebase-session=${uid}; path=/; max-age=3600; SameSite=Strict`
}

export function clearSessionCookie() {
  document.cookie =
    "firebase-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
}