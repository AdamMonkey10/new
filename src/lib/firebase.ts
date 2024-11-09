import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  CACHE_SIZE_UNLIMITED, 
  enableIndexedDbPersistence, 
  enableMultiTabIndexedDbPersistence,
  getFirestore
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyB5VLN7KUd3CpJsc2ubKikvRJkd_hat4u8",
  authDomain: "warehouseapp-b85de.firebaseapp.com",
  projectId: "warehouseapp-b85de",
  storageBucket: "warehouseapp-b85de.appspot.com",
  messagingSenderId: "535089462672",
  appId: "1:535089462672:web:edb68bd9ee8609a51dc715",
  measurementId: "G-315TGMCNN3"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings optimized for offline support
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true,
});

// Initialize Functions
const functions = getFunctions(app);

// Enable offline persistence with enhanced error handling
if (typeof window !== 'undefined') {
  try {
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, fallback to single-tab persistence
        return enableIndexedDbPersistence(db);
      } else if (err.code === 'unimplemented') {
        console.warn('Firebase persistence not available in this browser');
      }
    });
  } catch (error) {
    console.warn('Error initializing persistence:', error);
  }
}

// Initialize Analytics only in browser environment
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { db, analytics, functions };
export default app;