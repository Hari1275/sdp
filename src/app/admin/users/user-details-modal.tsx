"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { DateDisplay } from '@/components/date-display';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Calendar,
  Users,
  Target
} from 'lucide-react';

type UserDetailsProps = {
  user: {
    id: string;
    username: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: 'MR' | 'LEAD_MR' | 'ADMIN';
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    regionId: string | null;
    region?: { id: string; name: string } | null;
    leadMrId: string | null;
    leadMr?: { id: string; name: string } | null;
    createdAt: Date;
    updatedAt: Date;
    _count: {
      clients: number;
      assignedTasks: number;
      teamMembers: number;
    };
  } | null;
  open: boolean;
  onClose: () => void;
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return 'destructive';
    case 'LEAD_MR':
      return 'secondary';
    case 'MR':
      return 'default';
    default:
      return 'default';
  }
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'INACTIVE':
      return 'secondary';
    case 'SUSPENDED':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export function UserDetailsModal({ user, open, onClose }: UserDetailsProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-muted-foreground">@{user.username}</div>
            </div>
          </DialogTitle>
          <DialogDescription>
            View comprehensive user information and statistics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Role */}
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(user.status)}>
              {user.status}
            </Badge>
            <Badge variant={getRoleBadgeVariant(user.role)}>
              {user.role.replace('_', ' ')}
            </Badge>
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {user.email || 'No email provided'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {user.phone || 'No phone provided'}
                </span>
              </div>
              {user.region && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.region.name}</span>
                </div>
              )}
              {user.leadMr && (
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Lead MR: {user.leadMr.name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Performance Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {user._count.clients}
                  </div>
                  <div className="text-xs text-muted-foreground">Clients</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {user._count.assignedTasks}
                  </div>
                  <div className="text-xs text-muted-foreground">Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {user._count.teamMembers}
                  </div>
                  <div className="text-xs text-muted-foreground">Team</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="ml-2 font-mono text-xs">{user.id}</span>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <div className="mt-1">
                    <DateDisplay 
                      date={user.createdAt} 
                      format="PPP 'at' p"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>
                  <div className="mt-1">
                    <DateDisplay 
                      date={user.updatedAt} 
                      format="PPP 'at' p"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role-specific Information */}
          {user.role === 'LEAD_MR' && user._count.teamMembers > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Leadership
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This Lead MR manages {user._count.teamMembers} team member{user._count.teamMembers !== 1 ? 's' : ''}.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
