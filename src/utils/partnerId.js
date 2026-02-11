import { collection, query, where, getDocs } from 'firebase/firestore';

// Generate a random 6-character alphanumeric partner ID
export function generatePartnerID() {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => CHARS.charAt(Math.floor(Math.random() * CHARS.length))).join('');
}

// Ensure uniqueness by checking existing users collection
export async function generateUniquePartnerID(firestore, maxAttempts = 100) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const id = generatePartnerID();
    const q = query(collection(firestore, 'users'), where('partnerID', '==', id));
    const snap = await getDocs(q);
    if (snap.empty) return id;
    attempts++;
  }
  // fallback to timestamp-based id (still uppercase, 6 chars)
  return ('X' + Date.now().toString(36).toUpperCase()).slice(0, 6);
}
