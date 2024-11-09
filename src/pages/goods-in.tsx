import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { addItem, getItems, updateItem } from '@/lib/firebase/items';
import { createGoodsInAction } from '@/lib/firebase/actions';
import { addMovement } from '@/lib/firebase/movements';
import { getCategories, updateCategoryQuantity, subscribeToCategory } from '@/lib/firebase/categories';
import { getLocations, updateLocation } from '@/lib/firebase/locations';
import { generateItemCode } from '@/lib/utils';
import { Barcode as BarcodeIcon, Printer, ArrowRight, MapPin, ArrowDownToLine, ArrowUpFromLine, PackageCheck } from 'lucide-react';
import { Barcode } from '@/components/barcode';
import { LocationSuggestion } from '@/components/location-suggestion';
import { StockLevelIndicator } from '@/components/stock-level-indicator';
import type { Category } from '@/lib/firebase/categories';
import type { Location } from '@/types/warehouse';

export default function GoodsIn() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    itemCode: '',
    description: '',
    weight: '',
    category: '',
    quantity: '',
    coilNumber: '',
    coilLength: '',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [activeTab, setActiveTab] = useState('in');
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isGroundLevel, setIsGroundLevel] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (formData.category) {
      const category = categories.find(c => c.id === formData.category);
      if (category?.id) {
        const unsubscribe = subscribeToCategory(category.id, (updatedCategory) => {
          if (updatedCategory) {
            setSelectedCategory(updatedCategory);
          }
        });
        return () => unsubscribe();
      }
    } else {
      setSelectedCategory(null);
    }
  }, [formData.category, categories]);

  const loadCategories = async () => {
    try {
      const fetchedCategories = await getCategories();
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const loadLocations = async () => {
    try {
      const fetchedLocations = await getLocations();
      setLocations(fetchedLocations);
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    }
  };

  const handleGoodsIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!selectedCategory) {
        throw new Error('Please select a category');
      }

      const systemCode = generateItemCode(formData.category, Date.now());
      setGeneratedCode(systemCode);

      // Handle Kanban-managed items (goodsIn = true)
      if (selectedCategory.kanbanRules?.goodsIn) {
        const quantity = parseInt(formData.quantity);
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error('Please enter a valid quantity');
        }

        await updateCategoryQuantity(selectedCategory.id, quantity);

        await addMovement({
          itemId: systemCode,
          type: 'IN',
          weight: 0,
          operator: 'System',
          reference: formData.itemCode,
          notes: `Added ${quantity} units of ${selectedCategory.name}`,
          quantity
        });

        toast.success(`Added ${quantity} units to inventory`);
      } 
      // Handle Raw Materials
      else if (selectedCategory.prefix === 'RAW') {
        const weight = parseFloat(formData.weight);
        const coilNumber = parseInt(formData.coilNumber);
        const coilLength = parseFloat(formData.coilLength);

        if (isNaN(weight) || weight <= 0) {
          throw new Error('Please enter a valid weight');
        }
        if (isNaN(coilNumber) || coilNumber <= 0) {
          throw new Error('Please enter a valid number of coils');
        }
        if (isNaN(coilLength) || coilLength <= 0) {
          throw new Error('Please enter a valid coil length');
        }

        const itemData = {
          itemCode: formData.itemCode,
          systemCode,
          description: `Coil: ${coilNumber}, Length: ${coilLength}ft`,
          weight,
          category: formData.category,
          status: 'pending',
          metadata: {
            coilNumber: coilNumber.toString(),
            coilLength: coilLength.toString(),
            isGroundLevel
          },
        };

        await addItem(itemData);

        await addMovement({
          itemId: systemCode,
          type: 'IN',
          weight,
          operator: 'System',
          reference: formData.itemCode,
          notes: `Raw Material: ${itemData.description}`
        });

        // Load locations and show location dialog
        await loadLocations();
        setShowLocationDialog(true);
      } 
      // Handle Default Items
      else {
        const weight = parseFloat(formData.weight);
        if (isNaN(weight) || weight <= 0) {
          throw new Error('Please enter a valid weight');
        }

        if (!formData.description.trim()) {
          throw new Error('Please enter a description');
        }

        const itemData = {
          itemCode: formData.itemCode,
          systemCode,
          description: formData.description,
          weight,
          category: formData.category,
          status: 'pending',
          metadata: {
            isGroundLevel
          }
        };

        await addItem(itemData);

        await addMovement({
          itemId: systemCode,
          type: 'IN',
          weight,
          operator: 'System',
          reference: formData.itemCode,
          notes: `Goods in: ${formData.description}`
        });

        // Load locations and show location dialog
        await loadLocations();
        setShowLocationDialog(true);
      }
    } catch (error) {
      console.error('Error processing goods in:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process goods in');
      setGeneratedCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleGoodsOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!selectedCategory) {
        throw new Error('Please select a category');
      }

      if (!formData.itemCode.trim()) {
        throw new Error('Reference code is required');
      }

      // Handle Kanban-managed items
      if (selectedCategory.kanbanRules?.goodsIn) {
        const quantity = parseInt(formData.quantity);
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error('Please enter a valid quantity');
        }

        if (quantity > selectedCategory.kanbanRules.currentQuantity) {
          throw new Error('Not enough stock available');
        }

        await updateCategoryQuantity(selectedCategory.id, -quantity);

        await addMovement({
          itemId: formData.itemCode,
          type: 'OUT',
          weight: 0,
          operator: 'System',
          reference: formData.itemCode,
          notes: `Removed ${quantity} units of ${selectedCategory.name}`,
          quantity
        });

        toast.success(`Removed ${quantity} units from inventory`);
        resetForm();
      } else {
        // For non-Kanban items, we need to find the item and update its status
        const items = await getItems();
        const item = items.find(i => 
          i.itemCode === formData.itemCode && 
          i.status === 'placed' &&
          i.category === selectedCategory.id
        );

        if (!item) {
          throw new Error('Item not found or already removed');
        }

        // Update item status to removed
        await updateItem(item.id, {
          status: 'removed',
          location: null
        });

        // Add movement record
        await addMovement({
          itemId: item.systemCode,
          type: 'OUT',
          weight: item.weight,
          operator: 'System',
          reference: item.itemCode,
          notes: `Removed from warehouse: ${item.description}`
        });

        toast.success('Item removed from inventory');
        resetForm();
      }
    } catch (error) {
      console.error('Error processing goods out:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process goods out');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = async (location: Location) => {
    setSelectedLocation(location);
    setShowLocationDialog(false);
    
    try {
      // Update location with new item
      const currentStackedItems = location.stackedItems || [];
      await updateLocation(location.id, {
        currentWeight: location.currentWeight + parseFloat(formData.weight),
        stackedItems: [...currentStackedItems, generatedCode],
        available: location.level === '0' ? true : location.currentWeight === 0
      });

      // Create action with location
      await createGoodsInAction({
        itemId: generatedCode,
        itemCode: formData.itemCode,
        systemCode: generatedCode,
        description: formData.description,
        category: formData.category,
        weight: parseFloat(formData.weight),
        location: location.code
      });

      toast.success('Location assigned successfully');
    } catch (error) {
      console.error('Error assigning location:', error);
      toast.error('Failed to assign location');
    }
  };

  const resetForm = () => {
    setFormData({
      itemCode: '',
      description: '',
      weight: '',
      category: '',
      quantity: '',
      coilNumber: '',
      coilLength: '',
    });
    setGeneratedCode('');
    setSelectedLocation(null);
    setIsGroundLevel(false);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svg = document.createElement('svg');
    JsBarcode(svg, generatedCode, {
      format: 'CODE128',
      width: 2,
      height: 100,
      displayValue: true,
      fontSize: 16,
      margin: 10,
    });

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode - ${generatedCode}</title>
          <style>
            body { 
              margin: 20px;
              font-family: Arial, sans-serif;
            }
            .container {
              max-width: 400px;
              margin: 0 auto;
              text-align: center;
            }
            .barcode svg {
              max-width: 100%;
            }
            .code {
              font-size: 24px;
              font-weight: bold;
              margin: 20px 0;
            }
            .details {
              margin: 20px 0;
              font-size: 16px;
              line-height: 1.5;
            }
            .location {
              margin-top: 20px;
              padding: 15px;
              border: 2px solid #0369a1;
              border-radius: 8px;
              background: #f0f9ff;
              color: #0369a1;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="barcode">
              ${svg.outerHTML}
            </div>
            <div class="code">${generatedCode}</div>
            <div class="details">
              <p><strong>Reference:</strong> ${formData.itemCode}</p>
              ${selectedCategory?.kanbanRules?.goodsIn ? `
                <p><strong>Quantity:</strong> ${formData.quantity}</p>
              ` : selectedCategory?.prefix === 'RAW' ? `
                <p><strong>Coils:</strong> ${formData.coilNumber}</p>
                <p><strong>Length:</strong> ${formData.coilLength}ft</p>
                <p><strong>Weight:</strong> ${formData.weight}kg</p>
              ` : `
                <p><strong>Description:</strong> ${formData.description}</p>
                <p><strong>Weight:</strong> ${formData.weight}kg</p>
              `}
            </div>
            ${selectedLocation ? `
              <div class="location">
                Location: ${selectedLocation.code}
              </div>
            ` : ''}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 100);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'in') {
      await handleGoodsIn(e);
    } else {
      await handleGoodsOut(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Stock Management</h1>
        <Button variant="outline" onClick={() => navigate('/picking')}>
          View Warehouse Actions
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="in" className="flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            Goods In
          </TabsTrigger>
          <TabsTrigger value="out" className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            Goods Out
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in">
          {generatedCode ? (
            <Card className="bg-primary/5 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarcodeIcon className="h-5 w-5" />
                  Generated Barcode
                </CardTitle>
                <CardDescription>
                  Print this barcode and attach it to the item
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center space-y-4">
                  <Barcode value={generatedCode} className="w-full max-w-md" />
                  <div className="text-center">
                    <div className="text-lg font-bold">{generatedCode}</div>
                    <div className="text-sm text-muted-foreground">
                      Reference: {formData.itemCode}
                    </div>
                    {selectedCategory?.kanbanRules?.goodsIn ? (
                      <div className="text-sm text-muted-foreground">
                        Added {formData.quantity} units
                      </div>
                    ) : selectedCategory?.prefix === 'RAW' ? (
                      <div className="text-sm text-muted-foreground">
                        Coils: {formData.coilNumber}, Length: {formData.coilLength}ft
                        <br />
                        Weight: {formData.weight}kg
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {formData.description}
                        <br />
                        Weight: {formData.weight}kg
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handlePrint} variant="outline">
                      <Printer className="h-4 w-4 mr-2" />
                      Print Barcode
                    </Button>
                    <Button onClick={resetForm} variant="default">
                      Process Next Item
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Receive Items</CardTitle>
                <CardDescription>
                  Enter the details of the items being received
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="itemCode">Reference Code</Label>
                      <Input
                        id="itemCode"
                        placeholder="Enter reference code"
                        value={formData.itemCode}
                        onChange={(e) =>
                          setFormData({ ...formData, itemCode: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Please select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedCategory?.kanbanRules?.goodsIn ? (
                      <div className="col-span-2 space-y-2">
                        {selectedCategory.kanbanRules && (
                          <StockLevelIndicator rules={selectedCategory.kanbanRules} />
                        )}
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          max={selectedCategory.kanbanRules.maxQuantity - selectedCategory.kanbanRules.currentQuantity}
                          placeholder="Enter quantity"
                          value={formData.quantity}
                          onChange={(e) =>
                            setFormData({ ...formData, quantity: e.target.value })
                          }
                          required
                        />
                        <div className="text-sm text-muted-foreground">
                          Available space: {selectedCategory.kanbanRules.maxQuantity - selectedCategory.kanbanRules.currentQuantity} units
                        </div>
                      </div>
                    ) : selectedCategory?.prefix === 'RAW' ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="coilNumber">Number of Coils</Label>
                          <Input
                            id="coilNumber"
                            type="number"
                            min="1"
                            placeholder="Enter number of coils"
                            value={formData.coilNumber}
                            onChange={(e) =>
                              setFormData({ ...formData, coilNumber: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coilLength">Length (ft)</Label>
                          <Input
                            id="coilLength"
                            type="number"
                            step="0.1"
                            placeholder="Enter length in feet"
                            value={formData.coilLength}
                            onChange={(e) =>
                              setFormData({ ...formData, coilLength: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="weight">Weight (kg)</Label>
                          <Input
                            id="weight"
                            type="number"
                            step="0.01"
                            placeholder="Enter weight"
                            value={formData.weight}
                            onChange={(e) =>
                              setFormData({ ...formData, weight: e.target.value })
                            }
                            required
                          />
                        </div>
                      </>
                    ) : selectedCategory && (
                      <>
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            placeholder="Enter item description"
                            value={formData.description}
                            onChange={(e) =>
                              setFormData({ ...formData, description: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="weight">Weight (kg)</Label>
                          <Input
                            id="weight"
                            type="number"
                            step="0.01"
                            placeholder="Enter weight"
                            value={formData.weight}
                            onChange={(e) =>
                              setFormData({ ...formData, weight: e.target.value })
                            }
                            required
                          />
                        </div>
                      </>
                    )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ground-level"
                      checked={isGroundLevel}
                      onCheckedChange={setIsGroundLevel}
                    />
                    <Label htmlFor="ground-level">Ground Level Storage</Label>
                  </div>

                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Processing...' : 'Process Goods In'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="out">
          <Card>
            <CardHeader>
              <CardTitle>Process Goods Out</CardTitle>
              <CardDescription>
                Remove items from managed inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Please select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCategory?.kanbanRules?.goodsIn && (
                    <>
                      <div className="space-y-2">
                        <StockLevelIndicator rules={selectedCategory.kanbanRules} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="itemCode">Reference</Label>
                        <Input
                          id="itemCode"
                          placeholder="Enter reference"
                          value={formData.itemCode}
                          onChange={(e) =>
                            setFormData({ ...formData, itemCode: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          max={selectedCategory.kanbanRules.currentQuantity}
                          placeholder="Enter quantity"
                          value={formData.quantity}
                          onChange={(e) =>
                            setFormData({ ...formData, quantity: e.target.value })
                          }
                          required
                        />
                        <div className="text-sm text-muted-foreground">
                          Available: {selectedCategory.kanbanRules.currentQuantity} units
                        </div>
                      </div>
                    </>
                  )}

                  {selectedCategory && !selectedCategory.kanbanRules?.goodsIn && (
                    <div className="space-y-2">
                      <Label htmlFor="itemCode">Reference Code</Label>
                      <Input
                        id="itemCode"
                        placeholder="Enter reference code"
                        value={formData.itemCode}
                        onChange={(e) =>
                          setFormData({ ...formData, itemCode: e.target.value })
                        }
                        required
                      />
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !selectedCategory}
                >
                  {loading ? 'Processing...' : 'Process Goods Out'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Location Selection Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Location</DialogTitle>
          </DialogHeader>
          <LocationSuggestion
            locations={locations}
            weight={parseFloat(formData.weight)}
            isGroundLevel={isGroundLevel}
            onLocationSelect={handleLocationSelect}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}