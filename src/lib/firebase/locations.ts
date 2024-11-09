import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCached, setCache, invalidateCache } from './cache';
import { LEVEL_MAX_WEIGHTS } from '../warehouse-logic';
import type { Location } from '@/types/warehouse';

const COLLECTION = 'locations';
const CACHE_KEY = 'locations';
const MAX_GROUND_ITEMS = 6;

let locationListener: (() => void) | null = null;

function isLocationFull(location: Location): boolean {
  // Ground level locations can stack multiple items
  if (location.level === '0') {
    const itemCount = location.stackedItems?.length || 0;
    return itemCount >= MAX_GROUND_ITEMS;
  }
  // Other levels can only hold one item
  return location.currentWeight > 0;
}

function isLocationAvailable(location: Location): boolean {
  if (!location.verified) return false;
  return !isLocationFull(location);
}

export async function initializeLocationsListener() {
  if (locationListener) {
    locationListener();
  }

  try {
    const q = query(collection(db, COLLECTION));
    locationListener = onSnapshot(q, (snapshot) => {
      const locations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        ...(doc.data().level === '0' && {
          maxWeight: Infinity,
          stackedItems: doc.data().stackedItems || [],
          available: !isLocationFull({ ...doc.data(), id: doc.id })
        })
      })) as Location[];
      setCache(CACHE_KEY, locations);
    }, (error) => {
      console.error('Error in locations listener:', error);
      invalidateCache(CACHE_KEY);
    });
  } catch (error) {
    console.error('Error initializing locations listener:', error);
  }
}

export async function getAvailableLocations(requiredWeight: number) {
  try {
    const cached = getCached<Location>(CACHE_KEY);
    if (cached) {
      return cached.filter(loc => {
        if (!isLocationAvailable(loc)) return false;
        
        // For non-ground locations, check weight capacity
        if (loc.level !== '0') {
          return loc.currentWeight + requiredWeight <= loc.maxWeight;
        }
        
        return true; // Ground locations don't have weight limits
      });
    }

    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const locations = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      ...(doc.data().level === '0' && {
        maxWeight: Infinity,
        stackedItems: doc.data().stackedItems || [],
        available: !isLocationFull({ ...doc.data(), id: doc.id })
      })
    })) as Location[];

    setCache(CACHE_KEY, locations);

    return locations.filter(loc => {
      if (!isLocationAvailable(loc)) return false;
      if (loc.level !== '0') {
        return loc.currentWeight + requiredWeight <= loc.maxWeight;
      }
      return true;
    });
  } catch (error) {
    console.error('Error getting available locations:', error);
    throw error;
  }
}

export async function addLocation(location: Omit<Location, 'id'>) {
  try {
    const maxWeight = location.level === '0' ? Infinity : LEVEL_MAX_WEIGHTS[location.level as keyof typeof LEVEL_MAX_WEIGHTS];
    
    const locationWithDefaults = {
      ...location,
      maxWeight,
      currentWeight: 0,
      available: true,
      verified: true,
      stackedItems: [],
      lastUpdated: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION), locationWithDefaults);
    invalidateCache(CACHE_KEY);
    return docRef.id;
  } catch (error) {
    console.error('Error adding location:', error);
    throw error;
  }
}

export async function updateLocation(id: string, data: Partial<Location>) {
  try {
    const locationRef = doc(db, COLLECTION, id);
    const locationSnap = await getDoc(locationRef);
    
    if (!locationSnap.exists()) {
      throw new Error('Location not found');
    }

    const location = locationSnap.data() as Location;
    const isGroundLevel = location.level === '0';
    const updatedStackedItems = data.stackedItems || location.stackedItems || [];
    const itemCount = updatedStackedItems.length;

    // Calculate new current weight
    const newCurrentWeight = typeof data.currentWeight === 'number' ? data.currentWeight : location.currentWeight;

    const updateData = {
      ...data,
      currentWeight: Math.max(0, newCurrentWeight), // Ensure weight never goes below 0
      available: isGroundLevel ? itemCount < MAX_GROUND_ITEMS : newCurrentWeight === 0,
      lastUpdated: serverTimestamp(),
      stackedItems: updatedStackedItems
    };

    await updateDoc(locationRef, updateData);
    invalidateCache(CACHE_KEY);
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
}

export async function getLocations() {
  try {
    const cached = getCached<Location>(CACHE_KEY);
    if (cached) return cached;

    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const locations = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      ...(doc.data().level === '0' && {
        maxWeight: Infinity,
        stackedItems: doc.data().stackedItems || [],
        available: !isLocationFull({ ...doc.data(), id: doc.id })
      })
    })) as Location[];

    setCache(CACHE_KEY, locations);
    return locations;
  } catch (error) {
    console.error('Error getting locations:', error);
    throw error;
  }
}

export async function getLocationByCode(code: string) {
  try {
    const cached = getCached<Location>(CACHE_KEY);
    if (cached) {
      const location = cached.find(loc => loc.code === code);
      if (location) {
        return {
          ...location,
          ...(location.level === '0' && {
            maxWeight: Infinity,
            stackedItems: location.stackedItems || [],
            available: !isLocationFull(location)
          })
        };
      }
    }

    const q = query(collection(db, COLLECTION), where('code', '==', code));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return null;

    const doc = querySnapshot.docs[0];
    const location = {
      id: doc.id,
      ...doc.data(),
      ...(doc.data().level === '0' && {
        maxWeight: Infinity,
        stackedItems: doc.data().stackedItems || [],
        available: !isLocationFull({ ...doc.data(), id: doc.id })
      })
    } as Location;

    return location;
  } catch (error) {
    console.error('Error getting location by code:', error);
    throw error;
  }
}

export async function addItemToGroundLocation(locationId: string, itemId: string) {
  try {
    const batch = writeBatch(db);
    const locationRef = doc(db, COLLECTION, locationId);
    const locationSnap = await getDoc(locationRef);
    
    if (!locationSnap.exists()) {
      throw new Error('Location not found');
    }

    const location = locationSnap.data() as Location;
    const currentItems = location.stackedItems?.length || 0;

    if (currentItems >= MAX_GROUND_ITEMS) {
      throw new Error('Location is full');
    }

    batch.update(locationRef, {
      stackedItems: arrayUnion(itemId),
      available: currentItems + 1 < MAX_GROUND_ITEMS,
      lastUpdated: serverTimestamp()
    });

    await batch.commit();
    invalidateCache(CACHE_KEY);
  } catch (error) {
    console.error('Error adding item to ground location:', error);
    throw error;
  }
}

export async function removeItemFromGroundLocation(locationId: string, itemId: string) {
  try {
    const batch = writeBatch(db);
    const locationRef = doc(db, COLLECTION, locationId);
    const locationSnap = await getDoc(locationRef);
    
    if (!locationSnap.exists()) {
      throw new Error('Location not found');
    }

    batch.update(locationRef, {
      stackedItems: arrayRemove(itemId),
      available: true,
      lastUpdated: serverTimestamp()
    });

    await batch.commit();
    invalidateCache(CACHE_KEY);
  } catch (error) {
    console.error('Error removing item from ground location:', error);
    throw error;
  }
}

// Initialize the locations listener when the module is imported
initializeLocationsListener();