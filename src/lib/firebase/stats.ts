import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function getDashboardStats() {
  try {
    // Get total items count
    const itemsQuery = query(
      collection(db, 'items'),
      where('status', '==', 'placed')
    );
    const itemsSnapshot = await getDocs(itemsQuery);
    const totalItems = itemsSnapshot.docs.length;

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    // Get today's movements
    const movementsQuery = query(
      collection(db, 'movements')
    );
    const movementsSnapshot = await getDocs(movementsQuery);
    
    // Filter and count movements in memory
    const movements = movementsSnapshot.docs.map(doc => ({
      type: doc.data().type,
      timestamp: doc.data().timestamp
    }));

    const todayMovements = movements.filter(m => 
      m.timestamp?.toDate() >= todayTimestamp.toDate()
    );

    const goodsInToday = todayMovements.filter(m => m.type === 'IN').length;
    const picksToday = todayMovements.filter(m => m.type === 'OUT').length;

    return {
      totalItems,
      goodsInToday,
      picksToday
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalItems: 0,
      goodsInToday: 0,
      picksToday: 0
    };
  }
}