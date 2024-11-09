import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { validateLocationForItem } from '@/lib/warehouse-logic';
import { Search, PackageCheck, Package, Filter } from 'lucide-react';
import type { Location } from '@/types/warehouse';

interface LocationSelectorProps {
  locations: Location[];
  weight: number;
  isGroundLevel: boolean;
  onLocationSelect: (location: Location) => void;
}

const MAX_GROUND_ITEMS = 6;

export function LocationSelector({ 
  locations, 
  weight,
  isGroundLevel,
  onLocationSelect 
}: LocationSelectorProps) {
  const [search, setSearch] = useState('');
  const [showAllGroundLocations, setShowAllGroundLocations] = useState(false);

  // Filter locations based on search and ground level requirement
  const filteredLocations = locations.filter(location => {
    const matchesSearch = !search.trim() || 
      location.code.toLowerCase().includes(search.toLowerCase()) ||
      `${location.row}${location.bay}`.toLowerCase().includes(search.toLowerCase());

    // Only show ground level locations (level '0') when isGroundLevel is true
    // Or show non-ground level locations when isGroundLevel is false
    const matchesLevel = isGroundLevel ? location.level === '0' : location.level !== '0';

    if (!matchesSearch || !matchesLevel) return false;

    // For ground level locations
    if (isGroundLevel) {
      const itemCount = location.stackedItems?.length || 0;
      if (showAllGroundLocations) {
        // Show all ground locations that aren't full
        return itemCount < MAX_GROUND_ITEMS;
      }
      // When not showing all, only show empty ground locations
      return itemCount === 0;
    }

    // For non-ground locations, only show empty ones
    return !location.currentWeight;
  });

  const getStatusBadge = (location: Location) => {
    if (location.level === '0') {
      const itemCount = location.stackedItems?.length || 0;
      return (
        <Badge variant="outline" className={cn(
          itemCount === 0 ? "bg-green-100 text-green-800" :
          itemCount >= MAX_GROUND_ITEMS ? "bg-red-100 text-red-800" :
          "bg-blue-100 text-blue-800"
        )}>
          {itemCount === 0 ? "Empty" : 
           itemCount >= MAX_GROUND_ITEMS ? "Full" :
           `${itemCount}/${MAX_GROUND_ITEMS} items`}
        </Badge>
      );
    }

    // For non-ground locations, show weight status
    const ratio = location.currentWeight / location.maxWeight;
    if (location.currentWeight === 0) {
      return <Badge variant="outline" className="bg-green-100 text-green-800">Empty</Badge>;
    }
    if (ratio >= 0.9) {
      return <Badge variant="outline" className="bg-red-100 text-red-800">Full</Badge>;
    }
    if (ratio >= 0.7) {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Heavy</Badge>;
    }
    return <Badge variant="outline" className="bg-blue-100 text-blue-800">In Use</Badge>;
  };

  const getProgressColor = (itemCount: number) => {
    if (itemCount === 0) return "bg-green-500";
    if (itemCount >= MAX_GROUND_ITEMS) return "bg-red-500";
    return "bg-blue-500";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isGroundLevel && (
          <div className="flex items-center gap-4 ml-4">
            <Button
              variant="outline"
              onClick={() => setShowAllGroundLocations(!showAllGroundLocations)}
              className={cn(
                "gap-2",
                showAllGroundLocations && "bg-primary/10"
              )}
            >
              <PackageCheck className="h-4 w-4" />
              {showAllGroundLocations ? "Show Empty Only" : "Show Available Spaces"}
            </Button>
            <Badge variant="outline" className="bg-primary/10">
              <PackageCheck className="h-4 w-4 mr-1" />
              Ground Level Only
            </Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredLocations.map((location) => {
          const error = validateLocationForItem(location, weight, isGroundLevel);
          const itemCount = location.stackedItems?.length || 0;
          const items = location.stackedItems || [];
          
          return (
            <Card 
              key={location.code}
              className={cn(
                "cursor-pointer transition-colors",
                error ? "opacity-50" : "hover:border-primary"
              )}
              onClick={() => {
                if (!error) {
                  onLocationSelect(location);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-semibold">{location.code}</div>
                    <div className="text-sm text-muted-foreground">
                      Row {location.row}, Bay {location.bay}, Level {location.level === '0' ? 'Ground' : location.level}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {location.level === '0' && (
                      <Badge variant="outline" className="bg-primary/10">
                        <PackageCheck className="h-4 w-4 mr-1" />
                        Ground
                      </Badge>
                    )}
                    {getStatusBadge(location)}
                  </div>
                </div>

                {location.level === '0' ? (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                      <span>Storage Capacity:</span>
                      <span>{itemCount}/{MAX_GROUND_ITEMS} items</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all",
                          getProgressColor(itemCount)
                        )}
                        style={{ 
                          width: `${(itemCount / MAX_GROUND_ITEMS) * 100}%` 
                        }}
                      />
                    </div>
                    {items.length > 0 && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {items.length} item{items.length !== 1 ? 's' : ''} stored
                      </div>
                    )}
                    {error && (
                      <div className="mt-2 text-sm text-destructive">
                        {error}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="text-sm text-muted-foreground">Weight Capacity:</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all",
                            error ? "bg-destructive" : "bg-primary"
                          )}
                          style={{ 
                            width: `${Math.min(100, ((location.currentWeight + weight) / location.maxWeight) * 100)}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {location.currentWeight + weight}/{location.maxWeight}kg
                      </span>
                    </div>
                    {error && (
                      <div className="mt-2 text-sm text-destructive">
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLocations.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {isGroundLevel ? 
            'No ground level locations available' : 
            'No matching locations found'}
        </div>
      )}
    </div>
  );
}