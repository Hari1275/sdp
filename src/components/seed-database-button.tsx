"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export function SeedDatabaseButton() {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const response = await fetch('/api/seed');
      const result = await response.json();
      
      if (response.ok && result.success) {
        toast({
          title: 'Success',
          description: `Database seeded successfully! Created ${result.data?.regions} regions, ${result.data?.areas} areas, ${result.data?.users} users, ${result.data?.clients} clients.`
        });
        
        // Reload the page to show the new data
        window.location.reload();
      } else {
        throw new Error(result.error || 'Seeding failed');
      }
    } catch (error) {
      console.error('Seeding error:', error);
      toast({
        title: 'Error',
        description: `Failed to seed database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Button 
      onClick={handleSeed} 
      disabled={isSeeding}
      variant="outline"
      size="sm"
    >
      {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isSeeding ? 'Seeding Database...' : 'Seed Database'}
    </Button>
  );
}
