import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  addDoc,
  increment
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const dbService = {
  async getDocument<T>(path: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, path, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as T) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
      return null;
    }
  },

  async getCollection<T>(path: string, constraints: any[] = []): Promise<T[]> {
    try {
      const colRef = collection(db, path);
      const q = query(colRef, ...constraints);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async setDocument(path: string, id: string, data: any) {
    try {
      console.log(`Setting document: ${path}/${id}`, data);
      await setDoc(doc(db, path, id), { ...data, updatedAt: Timestamp.now() }, { merge: true });
      console.log(`Successfully set document: ${path}/${id}`);
    } catch (error) {
      console.error(`Error setting document ${path}/${id}:`, error);
      handleFirestoreError(error, OperationType.WRITE, `${path}/${id}`);
    }
  },

  async addDocument(path: string, data: any) {
    try {
      const colRef = collection(db, path);
      return await addDoc(colRef, { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateDocument(path: string, id: string, data: any) {
    try {
      await updateDoc(doc(db, path, id), { ...data, updatedAt: Timestamp.now() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
    }
  },

  async incrementField(path: string, id: string, field: string, value: number) {
    try {
      await updateDoc(doc(db, path, id), { [field]: increment(value), updatedAt: Timestamp.now() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
    }
  },

  async deleteDocument(path: string, id: string) {
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
    }
  },

  async clearCollection(path: string) {
    try {
      console.log(`Clearing collection: ${path}`);
      const colRef = collection(db, path);
      const querySnapshot = await getDocs(colRef);
      console.log(`Found ${querySnapshot.docs.length} documents to delete in ${path}`);
      const deletePromises = querySnapshot.docs.map(doc => {
        console.log(`Deleting doc: ${doc.id} from ${path}`);
        return deleteDoc(doc.ref);
      });
      await Promise.all(deletePromises);
      console.log(`Successfully cleared collection: ${path}`);
    } catch (error) {
      console.error(`Error clearing collection ${path}:`, error);
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  subscribeToCollection<T>(path: string, constraints: any[], callback: (data: T[]) => void) {
    const colRef = collection(db, path);
    const q = query(colRef, ...constraints);
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeToDocument<T>(path: string, id: string, callback: (data: T | null) => void) {
    const docRef = doc(db, path, id);
    return onSnapshot(docRef, (docSnap) => {
      callback(docSnap.exists() ? (docSnap.data() as T) : null);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
    });
  }
};
