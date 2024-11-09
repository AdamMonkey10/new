import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCached, setCache, invalidateCache } from './cache';
import type { Item } from '@/types/warehouse';

const COLLECTION = 'items';

interface CreateItemData {
  itemCode: string;
  systemCode: string;
  description: string;
  weight?: number;
  category: string;
  status: 'pending' | 'placed' | 'removed';
  metadata?: {
    coilNumber?: string;
    coilLength?: string;
    quantity?: number;
    location?: string;
  };
}

export async function addItem(data: CreateItemData): Promise<string> {
  try {
    if (!data.itemCode?.trim() || !data.systemCode?.trim() || !data.category?.trim()) {
      throw new Error('Missing required fields');
    }

    if (data.weight !== undefined && (isNaN(data.weight) || data.weight <= 0)) {
      throw new Error('Invalid weight value');
    }

    const itemData = {
      itemCode: data.itemCode.trim(),
      systemCode: data.systemCode.trim(),
      description: data.description?.trim() || '',
      weight: data.weight || 0,
      category: data.category.trim(),
      status: data.status,
      locationVerified: false,
      metadata: data.metadata || null,
      lastUpdated: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), itemData);
    invalidateCache('items');
    return docRef.id;
  } catch (error) {
    console.error('Error adding item:', error);
    throw error;
  }
}

export async function updateItem(id: string, data: Partial<Item>) {
  try {
    if (!id?.trim()) {
      throw new Error('Item ID is required');
    }

    if (data.weight !== undefined && (isNaN(data.weight) || data.weight < 0)) {
      throw new Error('Invalid weight value');
    }

    const validStatuses = ['pending', 'placed', 'removed'];
    if (data.status && !validStatuses.includes(data.status)) {
      throw new Error('Invalid status');
    }

    const updateData = {
      ...data,
      lastUpdated: serverTimestamp(),
    };

    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, updateData);
    invalidateCache('items');

    // If status is 'removed', delete the item
    if (data.status === 'removed') {
      const batch = writeBatch(db);
      batch.delete(docRef);
      await batch.commit();
    }
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
}

export async function deleteItem(id: string) {
  try {
    if (!id?.trim()) {
      throw new Error('Item ID is required');
    }

    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
    invalidateCache('items');
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
}

export async function getItems() {
  try {
    const cached = getCached<Item>('items');
    if (cached) return cached;

    const q = query(
      collection(db, COLLECTION),
      where('status', '!=', 'removed')
    );
    
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Item[];

    setCache('items', items);
    return items;
  } catch (error) {
    console.error('Error getting items:', error);
    return []; // Return empty array instead of throwing
  }
}

export async function getItemsByLocation(location: string) {
  try {
    if (!location?.trim()) {
      throw new Error('Location is required');
    }

    const q = query(
      collection(db, COLLECTION),
      where('location', '==', location.trim()),
      where('status', '==', 'placed')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Item[];
  } catch (error) {
    console.error('Error getting items by location:', error);
    return []; // Return empty array instead of throwing
  }
}

export async function getItemsByStatus(status: string) {
  try {
    if (!status?.trim()) {
      throw new Error('Status is required');
    }

    const validStatuses = ['pending', 'placed', 'removed'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const q = query(
      collection(db, COLLECTION),
      where('status', '==', status)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Item[];
  } catch (error) {
    console.error('Error getting items by status:', error);
    return []; // Return empty array instead of throwing
  }
}

export async function getItemBySystemCode(systemCode: string) {
  try {
    if (!systemCode?.trim()) {
      throw new Error('System code is required');
    }

    const q = query(
      collection(db, COLLECTION),
      where('systemCode', '==', systemCode.trim())
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as Item;
  } catch (error) {
    console.error('Error getting item by system code:', error);
    return null;
  }
}