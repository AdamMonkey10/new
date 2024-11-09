import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { findOptimalLocation } from '@/lib/warehouse-logic';
import { MapPin, ArrowRight } from 'lucide-react';
import { LocationSelector } from './location-selector';
import type { Location } from '@/types/warehouse';

interface LocationSuggestionProps {
  locations: Location[];
  weight: number;
  isGroundLevel: boolean;
  onLocationSelect: (location: Location) => void;
}

export function LocationSuggestion({ 
  locations, 
  weight, 
  isGroundLevel,
  onLocationSelect 
}: LocationSuggestionProps) {
  const [suggestedLocation, setSuggestedLocation] = useState<Location | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);

  useEffect(() => {
    const optimal = findOptimalLocation(locations, weight, isGroundLevel);
    setSuggestedLocation(optimal);
  }, [locations, weight, isGroundLevel]);

  const getWeightStatusColor = (currentWeight: number, maxWeight: number) => {
    if (currentWeight === 0) return 'bg-green-100 text-green-800';
    if (currentWeight >= maxWeight * 0.9) return 'bg-red-100 text-red-800';
    if (currentWeight >= maxWeight * 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  if (showAllLocations) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Select Location</h3>
          <Button variant="outline" onClick={() => setShowAllLocations(false)}>
            Back to Suggestion
          </Button>
        </div>
        <LocationSelector
          locations={locations}
          weight={weight}
          isGroundLevel={isGroundLevel}
          onLocationSelect={onLocationSelect}
        />
      </div>
    );
  }

  if (!suggestedLocation) {
    return (
      <div className="text-center py-8">
        <p className="text-lg text-muted-foreground">
          No suitable location found for this item.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Please check weight limits or try a different storage level.
        </p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => setShowAllLocations(true)}
        >
          View All Locations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Badge 
          variant="outline" 
          className="px-4 py-2 text-lg flex items-center gap-2 justify-center"
        >
          <MapPin className="h-5 w-5" />
          Suggested Location: {suggestedLocation.code}
        </Badge>
        <p className="mt-2 text-sm text-muted-foreground">
          Level {suggestedLocation.level} - Current Weight: {suggestedLocation.currentWeight}kg / {suggestedLocation.maxWeight}kg
        </p>
      </div>

      <div className="flex justify-center gap-4">
        <Button 
          size="lg"
          className="min-w-[200px]"
          onClick={() => onLocationSelect(suggestedLocation)}
        >
          Use This Location
        </Button>
        <Button 
          variant="outline"
          size="lg"
          onClick={() => setShowAllLocations(true)}
        >
          Select Different Location
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((location) => (
          <div
            key={location.code}
            className={`p-4 border rounded-lg ${
              location.code === suggestedLocation.code ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-semibold">{location.code}</div>
                <div className="text-sm text-muted-foreground">
                  Row {location.row}, Bay {location.bay}, Level {location.level}
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={getWeightStatusColor(location.currentWeight, location.maxWeight)}
              >
                {location.currentWeight}/{location.maxWeight}kg
              </Badge>
            </div>
            {location.code === suggestedLocation.code && (
              <Button
                className="w-full mt-4"
                onClick={() => onLocationSelect(location)}
              >
                Select Location
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}