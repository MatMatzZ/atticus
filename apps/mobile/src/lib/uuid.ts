import { randomUUID } from 'expo-crypto';
/** Device-generated id: makes offline retries idempotent. */
export const newId = () => randomUUID();
