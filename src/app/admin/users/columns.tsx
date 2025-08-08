"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, UserCheck, UserX, Eye } from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { DateDisplay } from "@/components/date-display";
import { UserDetailsModal } from "./user-details-modal";
import { useState } from "react";

type User = {
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

const ActionsCell = ({ user }: { user: User }) => {
  const { openUserSheet, deleteUser, toggleUserStatus } = useUserStore();
  const [showDetails, setShowDetails] = useState(false);

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
          <DropdownMenuItem onClick={() => setShowDetails(true)}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openUserSheet(user)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toggleUserStatus(user.id, user.status)}
          >
            {user.status === 'ACTIVE' ? (
              <>
                <UserX className="mr-2 h-4 w-4" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => deleteUser(user.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <UserDetailsModal 
        user={user}
        open={showDetails}
        onClose={() => setShowDetails(false)}
      />
    </>
  );
};

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "User",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
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
            <div className="text-sm text-muted-foreground">
              @{user.username}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Contact",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div>
          <div className="text-sm">{user.email || 'No email'}</div>
          <div className="text-sm text-muted-foreground">
            {user.phone || 'No phone'}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      return (
        <Badge variant={getRoleBadgeVariant(role)}>
          {role.replace('_', ' ')}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={getStatusBadgeVariant(status)}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ row }) => {
      const region = row.original.region;
      return region ? region.name : 'No region';
    },
  },
  {
    accessorKey: "leadMr",
    header: "Lead MR",
    cell: ({ row }) => {
      const leadMr = row.original.leadMr;
      return leadMr ? leadMr.name : 'No lead';
    },
  },
  {
    accessorKey: "_count",
    header: "Statistics",
    cell: ({ row }) => {
      const counts = row.original._count;
      return (
        <div className="text-sm">
          <div>Clients: {counts.clients}</div>
          <div>Tasks: {counts.assignedTasks}</div>
          <div>Team: {counts.teamMembers}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date;
      return (
        <DateDisplay 
          date={date} 
          format="MMM dd, yyyy" 
          className="text-sm" 
        />
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ActionsCell user={row.original} />,
  },
];
