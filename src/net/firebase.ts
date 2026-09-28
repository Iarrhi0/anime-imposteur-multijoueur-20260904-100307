// Connexion à Firebase (offre gratuite « Spark »), chargée seulement quand on ouvre un salon.
// Firebase sert UNIQUEMENT à se retrouver dans un salon et à synchroniser la partie :
// le vocal passe de téléphone à téléphone, et tout le salon est effacé à la fermeture.
import { firebaseConfig } from './firebase-config';

type FS = typeof import('firebase/firestore');

export interface FB {
  fs: FS;
  db: import('firebase/firestore').Firestore;
  uid: string;
}

let cache: Promise<FB> | null = null;

export function isConfigured(): boolean {
  return !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
}

export function fb(): Promise<FB> {
  if (!cache) {
    cache = (async () => {
      if (!isConfigured()) throw new Error('Firebase n’est pas configuré (src/net/firebase-config.ts).');
      const [{ initializeApp }, authMod, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
      const app = initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      const cred = auth.currentUser ? { user: auth.currentUser } : await authMod.signInAnonymously(auth);
      const db = fs.getFirestore(app);
      return { fs, db, uid: cred.user.uid };
    })().catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}

export function explainError(e: unknown): string {
  const msg = String((e as any)?.code ?? (e as Error)?.message ?? e);
  if (msg.includes('admin-restricted-operation') || msg.includes('operation-not-allowed'))
    return 'La connexion anonyme n’est pas activée dans Firebase (Authentication → Sign-in method → Anonyme).';
  if (msg.includes('permission-denied')) return 'Accès refusé par les règles Firestore. Publie le fichier firestore.rules (voir le guide).';
  if (msg.includes('unavailable') || msg.includes('network')) return 'Pas de connexion Internet.';
  if (msg.includes('not-found')) return 'Salon introuvable.';
  return msg;
}
