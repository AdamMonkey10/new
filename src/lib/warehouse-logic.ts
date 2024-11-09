import type { Location } from '@/types/warehouse';

// Weight limits per level (in kg)
export const LEVEL_MAX_WEIGHTS = {
  '0': Infinity, // Ground level - no weight limit for stacking
  '1': 1500,     // First level
  '2': 1000,     // Second level
  '3': 750,      // Third level
  '4': 500,      // Fourth level
};

// Maximum items per ground level location
const MAX_GROUND_ITEMS = 6;

export function validateLocationForItem(location: Location, weight: number, isGroundLevel: boolean): string | null {
  if (!location.available) {
    return 'Location is not available';
  }

  if (!location.verified) {
    return 'Location is not verified';
  }

  // For ground level storage
  if (isGroundLevel) {
    if (location.level !== '0') {
      return 'Item must be stored at ground level';
    }
    // Check if we've hit the maximum item limit
    const currentItems = location.stackedItems?.length || 0;
    if (currentItems >= MAX_GROUND_ITEMS) {
      return `Ground location has reached maximum capacity (${MAX_GROUND_ITEMS} items)`;
    }
    return null;
  }

  // For non-ground level storage
  if (location.level === '0') {
    return 'Item cannot be stored at ground level';
  }

  const newWeight = location.currentWeight + weight;
  if (newWeight > location.maxWeight) {
    return `Weight (${weight}kg) exceeds location capacity (${location.maxWeight - location.currentWeight}kg available)`;
  }

  return null;
}

export function findOptimalLocation(locations: Location[], weight: number, isGroundLevel: boolean = false): Location | null {
  // Filter for available and verified locations first
  const availableLocations = locations.filter(loc => loc.available && loc.verified);
  
  if (availableLocations.length === 0) {
    return null;
  }

  // For ground level storage
  if (isGroundLevel) {
    return availableLocations
      .filter(loc => 
        loc.level === '0' && 
        (loc.stackedItems?.length || 0) < MAX_GROUND_ITEMS
      )
      .sort((a, b) => {
        // Sort by number of stacked items (prefer locations with fewer items)
        const aStacked = a.stackedItems?.length || 0;
        const bStacked = b.stackedItems?.length || 0;
        if (aStacked !== bStacked) {
          return aStacked - bStacked;
        }
        // Then by row/bay for proximity
        const aDistance = (a.row.charCodeAt(0) - 'A'.charCodeAt(0)) * 100 + parseInt(a.bay);
        const bDistance = (b.row.charCodeAt(0) - 'A'.charCodeAt(0)) * 100 + parseInt(b.bay);
        return aDistance - bDistance;
      })[0] || null;
  }

  // For regular storage
  const validLocations = availableLocations.filter(loc => {
    if (loc.level === '0') return false;
    return (loc.currentWeight + weight) <= loc.maxWeight;
  });

  if (validLocations.length === 0) {
    return null;
  }

  // Score and sort locations
  return validLocations
    .map(location => ({
      location,
      score: calculateLocationScore(location, weight)
    }))
    .sort((a, b) => a.score - b.score)
    .map(scored => scored.location)[0];
}

function calculateLocationScore(location: Location, weight: number): number {
  const levelNum = parseInt(location.level);
  const levelMaxWeight = LEVEL_MAX_WEIGHTS[location.level as keyof typeof LEVEL_MAX_WEIGHTS];
  const currentLevelWeight = location.currentWeight;
  const newLevelWeight = currentLevelWeight + weight;
  
  // Base distance score
  const rowScore = (location.row.charCodeAt(0) - 'A'.charCodeAt(0)) * 100;
  const bayScore = parseInt(location.bay) - 1;
  const distanceScore = rowScore + bayScore;

  // Weight utilization score
  const utilizationScore = Math.abs(levelMaxWeight - newLevelWeight) * 2;
  
  // Height penalty (prefer lower levels for heavier items)
  const heightPenalty = weight * levelNum * 3;

  return distanceScore + utilizationScore + heightPenalty;
}