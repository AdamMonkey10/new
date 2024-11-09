import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { addAction } from '@/lib/firebase/actions';
import { getDepartments } from '@/lib/firebase/departments';
import type { Item } from '@/types/warehouse';

interface Department {
  id: string;
  name: string;
}

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item;
  onComplete: () => void;
}

export function DepartmentDialog({
  open,
  onOpenChange,
  item,
  onComplete,
}: DepartmentDialogProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadDepartments();
    }
  }, [open]);

  const loadDepartments = async () => {
    try {
      const deptList = await getDepartments();
      setDepartments(deptList);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const handleSubmit = async () => {
    if (!selectedDepartment) {
      toast.error('Please select a department');
      return;
    }

    if (!item?.id || !item?.itemCode || !item?.systemCode) {
      toast.error('Invalid item data');
      return;
    }

    setLoading(true);
    try {
      await addAction({
        itemId: item.id,
        itemCode: item.itemCode,
        systemCode: item.systemCode,
        description: item.description,
        category: item.category,
        weight: item.weight,
        location: item.location,
        actionType: 'out',
        status: 'pending',
        department: selectedDepartment,
        metadata: {
          isGroundLevel: item.metadata?.isGroundLevel || false
        }
      });

      toast.success('Added to pick list');
      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating pick action:', error);
      toast.error('Failed to add to pick list');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Department</DialogTitle>
          <DialogDescription>
            Choose the department this item is needed for
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select
            value={selectedDepartment}
            onValueChange={setSelectedDepartment}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={loading || !selectedDepartment}
          >
            {loading ? 'Adding...' : 'Add to Pick List'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}