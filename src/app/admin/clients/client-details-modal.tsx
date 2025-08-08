"use client";

import { useEffect } from 'react';
import { Client } from '@/types';
import { useClientStore } from '@/store/client-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Phone, 
  MapPin, 
  User, 
  Calendar,
  TrendingUp,
  ExternalLink,
  FileText,
  DollarSign,
  Activity,
  BarChart3
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ClientDetailsModalProps {
  client: Client | null;
  open: boolean;
  onClose: () => void;
}

const getBusinessTypeBadgeVariant = (businessType: string) => {
  switch (businessType) {
    case 'HOSPITAL':
      return 'destructive';
    case 'CLINIC':
      return 'default';
    case 'PHARMACY':
      return 'secondary';
    case 'MEDICAL_STORE':
      return 'outline';
    default:
      return 'outline';
  }
};

const getBusinessTypeColor = (businessType: string) => {
  switch (businessType) {
    case 'HOSPITAL':
      return 'text-red-600';
    case 'CLINIC':
      return 'text-blue-600';
    case 'PHARMACY':
      return 'text-green-600';
    case 'MEDICAL_STORE':
      return 'text-purple-600';
    default:
      return 'text-gray-600';
  }
};

export function ClientDetailsModal({ client, open, onClose }: ClientDetailsModalProps) {
  const { fetchBusinessHistory, businessHistory, isLoading } = useClientStore();
  
  useEffect(() => {
    if (open && client) {
      // Fetch business history when modal opens
      fetchBusinessHistory(client.id);
    }
  }, [open, client, fetchBusinessHistory]);

  if (!client) return null;

  const openMaps = () => {
    if (client.latitude && client.longitude) {
      const url = `https://www.google.com/maps?q=${client.latitude},${client.longitude}`;
      window.open(url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={getBusinessTypeColor(client.businessType)}>
                {client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-lg">{client.name}</div>
              <div className="text-sm text-muted-foreground">
                {client.address}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Comprehensive client information and business history
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="business">Business History</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Client Status and Type */}
            <div className="flex items-center gap-2">
              <Badge variant={getBusinessTypeBadgeVariant(client.businessType)}>
                {client.businessType.replace('_', ' ')}
              </Badge>
              <Badge variant="outline">
                Active Client
              </Badge>
            </div>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    {client.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">Phone</div>
                          <div className="text-sm text-muted-foreground">{client.phone}</div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Location</div>
                        <div className="text-sm text-muted-foreground">
                          {client.area.name}, {client.region.name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Marketing Representative</div>
                        <div className="text-sm text-muted-foreground">{client.mr.name}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Created</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(client.createdAt), 'PPP')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Last Updated</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(client.updatedAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Business Entries</div>
                        <div className="text-sm text-muted-foreground">
                          {client._count?.businessEntries || 0} total entries
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {client.notes && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm font-medium">Notes</div>
                    </div>
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      {client.notes}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="space-y-6 mt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : businessHistory ? (
              <div className="space-y-6">
                {/* Business Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Business</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ₹{businessHistory.statistics.totalAmount.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {businessHistory.statistics.totalEntries} entries
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Average Deal</CardTitle>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ₹{Math.round(businessHistory.statistics.averageAmount).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        per transaction
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${
                        businessHistory.statistics.growthRate > 0 ? 'text-green-600' : 
                        businessHistory.statistics.growthRate < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {businessHistory.statistics.growthRate > 0 ? '+' : ''}
                        {businessHistory.statistics.growthRate}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        vs last month
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {businessHistory.recentActivity.last7Days}
                        </div>
                        <div className="text-sm text-muted-foreground">Last 7 days</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {businessHistory.recentActivity.last30Days}
                        </div>
                        <div className="text-sm text-muted-foreground">Last 30 days</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">
                          {businessHistory.businessEntries.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Recent entries</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Business Entries List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent Business Entries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {businessHistory.businessEntries.length > 0 ? (
                      <div className="space-y-3">
                        {businessHistory.businessEntries.slice(0, 5).map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">₹{entry.amount.toLocaleString()}</div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(entry.createdAt), 'PPP')}
                              </div>
                              {entry.notes && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {entry.notes}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{entry.mr.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No business entries found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Unable to load business history</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="location" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Address</div>
                    <div className="text-sm text-muted-foreground">
                      {client.address || 'No address provided'}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Region & Area</div>
                    <div className="text-sm text-muted-foreground">
                      {client.area.name}, {client.region.name}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">GPS Coordinates</div>
                    <div className="text-sm text-muted-foreground">
                      {client.latitude.toFixed(6)}, {client.longitude.toFixed(6)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Actions</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openMaps}
                      className="w-full"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in Maps
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Map placeholder - in a real app, you'd integrate with a map service */}
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">Map integration would go here</p>
                    <p className="text-xs">
                      Coordinates: {client.latitude.toFixed(6)}, {client.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
