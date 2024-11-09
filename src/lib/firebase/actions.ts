import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCached, setCache, invalidateCache } from './cache';

const COLLECTION = 'actions';
const CACHE_KEY = 'actions';

export interface WarehouseAction {
  id: string;
  itemId: string;
  itemCode: string;
  systemCode: string;
  description: string;
  category: string;
  weight: number;
  location?: string;
  actionType: 'in' | 'out';
  status: 'pending' | 'in-progress' | 'completed';
  timestamp: Timestamp;
  operator?: string;
  department?: string;
  metadata?: {
    quantity?: number;
    isGroundLevel?: boolean;
  };
}

interface CreateActionData {
  itemId: string;
  itemCode: string;
  systemCode: string;
  description: string;
  category: string;
  weight: number;
  location?: string;
  actionType: 'in' | 'out';
  status: 'pending' | 'in-progress' | 'completed';
  operator?: string;
  department?: string;
  metadata?: {
    quantity?: number;
    isGroundLevel?: boolean;
  };
}

export async function addAction(data: CreateActionData): Promise<string> {
  try {
    if (!data.itemId?.trim() || !data.itemCode?.trim() || !data.systemCode?.trim() || 
        !data.category?.trim() || !data.actionType || !data.status) {
      throw new Error('Missing required fields');
    }

    if (!['in', 'out'].includes(data.actionType)) {
      throw new Error('Invalid action type');
    }

    if (!['pending', 'in-progress', 'completed'].includes(data.status)) {
      throw new Error('Invalid status');
    }

    const actionData = {
      itemId: data.itemId.trim(),
      itemCode: data.itemCode.trim(),
      systemCode: data.systemCode.trim(),
      description: data.description?.trim() || '',
      category: data.category.trim(),
      weight: data.weight || 0,
      location: data.location?.trim() || null,
      actionType: data.actionType,
      status: data.status,
      operator: data.operator?.trim() || null,
      department: data.department?.trim() || null,
      metadata: data.metadata || null,
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), actionData);
    invalidateCache(CACHE_KEY);
    return docRef.id;
  } catch (error) {
    console.error('Error adding action:', error);
    throw error;
  }
}

export async function createGoodsInAction(data: {
  itemId: string;
  itemCode: string;
  systemCode: string;
  description: string;
  category: string;
  weight: number;
  location?: string;
  metadata?: {
    isGroundLevel?: boolean;
  };
}): Promise<string> {
  try {
    return await addAction({
      ...data,
      actionType: 'in',
      status: 'pending',
      metadata: {
        ...data.metadata,
        isGroundLevel: data.metadata?.isGroundLevel || false
      }
    });
  } catch (error) {
    console.error('Error creating goods-in action:', error);
    throw error;
  }
}

export async function updateAction(id: string, data: Partial<WarehouseAction>) {
  try {
    if (!id?.trim()) {
      throw new Error('Action ID is required');
    }

    if (data.status && !['pending', 'in-progress', 'completed'].includes(data.status)) {
      throw new Error('Invalid status');
    }

    const updateData = {
      ...data,
      timestamp: serverTimestamp(),
    };

    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, updateData);
    invalidateCache(CACHE_KEY);

    if (data.status === 'completed') {
      await deleteDoc(docRef);
    }
  } catch (error) {
    console.error('Error updating action:', error);
    throw error;
  }
}

export async function deleteAction(id: string) {
  try {
    if (!id?.trim()) {
      throw new Error('Action ID is required');
    }

    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
    invalidateCache(CACHE_KEY);
  } catch (error) {
    console.error('Error deleting action:', error);
    throw error;
  }
}

export async function getPendingActions() {
  try {
    const cached = getCached<WarehouseAction>(CACHE_KEY);
    if (cached) {
      return cached.filter(action => 
        action.status === 'pending' || action.status === 'in-progress'
      );
    }

    const q = query(
      collection(db, COLLECTION),
      where('status', 'in', ['pending', 'in-progress']),
      orderBy('timestamp', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const actions = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as WarehouseAction[];

    setCache(CACHE_KEY, actions);
    return actions;
  } catch (error) {
    console.error('Error getting pending actions:', error);
    return [];
  }
}

export function subscribeToActions(callback: (actions: WarehouseAction[]) => void) {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', 'in', ['pending', 'in-progress']),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const actions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as WarehouseAction[];
      callback(actions);
    }, (error) => {
      console.error('Error in actions subscription:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to actions:', error);
    callback([]);
    return () => {};
  }
}