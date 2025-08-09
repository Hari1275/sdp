"use client";

import React, { useState, useCallback } from 'react';
import { Client } from '@/types';
import { useClientStore } from '@/store/client-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye, 
  MapPin, 
  Phone, 
  Building2,
  TrendingUp,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { ClientDetailsModal } from './client-details-modal';
import { formatDistanceToNow } from 'date-fns';
import { ClientOnly } from '@/components/client-only';

interface ClientTableProps {
  clients: Client[];
  isLoading: boolean;
  searchQuery?: string;
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

const ActionsCell = ({ client }: { client: Client }) => {
  const { openClientSheet, deleteClient } = useClientStore();
  const [showDetails, setShowDetails] = useState(false);
  
  console.log('[ActionsCell] Rendering for client:', client.id, 'showDetails:', showDetails);

  const handleDelete = useCallback(async () => {
    if (window.confirm(`Are you sure you want to delete ${client.name}?`)) {
      try {
        await deleteClient(client.id);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  }, [client.id, client.name, deleteClient]);

  const openMaps = useCallback(() => {
    if (client.latitude && client.longitude) {
      const url = `https://www.google.com/maps?q=${client.latitude},${client.longitude}`;
      window.open(url, '_blank');
    }
  }, [client.latitude, client.longitude]);

  const handleViewDetails = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[ActionsCell] View Details clicked for client:', client.id, client.name, 'current showDetails:', showDetails);
    setShowDetails(true);
  }, [client.id, client.name, showDetails]);

  const handleCloseModal = useCallback(() => {
    console.log('[ActionsCell] Closing modal for client:', client.id);
    setShowDetails(false);
  }, [client.id]);

  const handleEditClient = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openClientSheet(client);
  }, [client, openClientSheet]);

  const handleOpenMaps = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMaps();
  }, [openMaps]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDelete();
  }, [handleDelete]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleViewDetails}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEditClient}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Client
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {client.latitude && client.longitude && (
            <DropdownMenuItem onClick={handleOpenMaps}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Maps
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600"
            onClick={handleDeleteClick}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <ClientDetailsModal 
        client={client}
        open={showDetails}
        onClose={handleCloseModal}
      />
    </>
  );
};

export function ClientTable({ clients, isLoading, searchQuery }: ClientTableProps) {

  // Enhanced safety checks with multiple fallbacks
  const safeClients = React.useMemo(() => {
    if (!clients) {
      console.warn('[ClientTable] No clients data provided');
      return [];
    }
    if (!Array.isArray(clients)) {
      console.warn('[ClientTable] Clients data is not an array:', typeof clients);
      return [];
    }
    // Filter out invalid client objects
    return clients.filter((client) => {
      if (!client || typeof client !== 'object') {
        console.warn('[ClientTable] Invalid client object:', client);
        return false;
      }
      if (!client.id) {
        console.warn('[ClientTable] Client missing ID:', client);
        return false;
      }
      if (!client.name) {
        console.warn('[ClientTable] Client missing name:', client);
        return false;
      }
      return true;
    });
  }, [clients]);

  // Debug logging
  React.useEffect(() => {
    console.log('[ClientTable] Render state:', {
      isLoading,
      clientsProvided: !!clients,
      clientsType: typeof clients,
      clientsLength: Array.isArray(clients) ? clients.length : 'N/A',
      safeClientsLength: safeClients.length,
      searchQuery
    });
  }, [isLoading, clients, safeClients.length, searchQuery]);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Loading skeleton */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
            <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
            </div>
            <div className="h-6 bg-gray-200 rounded w-16 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (safeClients.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {isLoading ? 'Loading clients...' : 'No clients found'}
        </h3>
        <p className="text-gray-500 mb-4">
          {searchQuery 
            ? `No clients match "${searchQuery}". Try adjusting your search.`
            : clients === null || clients === undefined 
              ? "Loading client data..."
              : "Get started by adding your first client."
          }
        </p>
        {!searchQuery && !isLoading && (
          <Button onClick={() => useClientStore.getState().openClientSheet()}>
            Add First Client
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Business Type</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>MR</TableHead>
            <TableHead>Business</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {safeClients.map((client) => {
            // Additional per-client safety checks
            const clientName = client.name || 'Unknown Client';
            const clientPhone = client.phone || null;
            const clientBusinessType = client.businessType || 'CLINIC';
            const clientAddress = client.address || null;
            const clientAreaName = client.area?.name || 'Unknown Area';
            const clientRegionName = client.region?.name || 'Unknown Region';
            const clientMRName = client.mr?.name || 'Unknown MR';
            const clientBusinessCount = client._count?.businessEntries || 0;
            const clientCreatedAt = client.createdAt ? new Date(client.createdAt) : new Date();
            
            return (
            <TableRow key={client.id || Math.random()}>
              {/* Client Name & Avatar */}
              <TableCell>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={getBusinessTypeColor(clientBusinessType)}>
                      {clientName.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || 'CL'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{clientName}</div>
                    {clientAddress && (
                      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {clientAddress}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>

              {/* Contact Information */}
              <TableCell>
                <div className="space-y-1">
                  {clientPhone ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {clientPhone}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No phone</span>
                  )}
                </div>
              </TableCell>

              {/* Business Type */}
              <TableCell>
                <Badge variant={getBusinessTypeBadgeVariant(clientBusinessType)}>
                  {clientBusinessType.replace('_', ' ')}
                </Badge>
              </TableCell>

              {/* Location */}
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {clientAreaName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {clientRegionName}
                  </div>
                </div>
              </TableCell>

              {/* Marketing Representative */}
              <TableCell>
                <div className="text-sm font-medium">{clientMRName}</div>
              </TableCell>

              {/* Business Statistics */}
              <TableCell>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-sm font-medium">
                    {clientBusinessCount}
                  </span>
                  <span className="text-xs text-muted-foreground">entries</span>
                </div>
              </TableCell>

              {/* Created Date */}
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <ClientOnly fallback={<span>Loading...</span>}>
                    {formatDistanceToNow(clientCreatedAt, { addSuffix: true })}
                  </ClientOnly>
                </div>
              </TableCell>

              {/* Actions */}
              <TableCell className="text-right">
                <ActionsCell client={client} />
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
