import {
  Users,
  MapPin,
  Building2,
  CheckSquare,
  BarChart3,
} from "lucide-react";

export type UserRole = "MR" | "LEAD_MR" | "ADMIN";

export type NavItem = {
  name: string;
  href: string;
  icon: any;
  description: string;
  roles: UserRole[];
};

export const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: BarChart3,
    description: "System overview and statistics",
    roles: ["ADMIN", "LEAD_MR"],
  },
  {
    name: "User Management",
    href: "/admin/users",
    icon: Users,
    description: "Manage system users and roles",
    roles: ["ADMIN"],
  },
  {
    name: "Regions & Areas",
    href: "/admin/regions",
    icon: MapPin,
    description: "Manage geographical regions",
    roles: ["ADMIN"],
  },
  {
    name: "Clients",
    href: "/admin/clients",
    icon: Building2,
    description: "Healthcare facility management",
    roles: ["ADMIN"],
  },
  {
    name: "Tasks",
    href: "/admin/tasks",
    icon: CheckSquare,
    description: "Task assignment and tracking",
    roles: ["ADMIN", "LEAD_MR"],
  },
  {
    name: "Reports",
    href: "/admin/reports",
    icon: BarChart3,
    description: "Reporting dashboard and exports",
    roles: ["ADMIN", "LEAD_MR"],
  },
  {
    name: "Tracking",
    href: "/admin/tracking",
    icon: MapPin,
    description: "Live GPS tracking",
    roles: ["ADMIN", "LEAD_MR"],
  },
];

export function filterNavByRole(role: UserRole): NavItem[] {
  return navigation.filter((item) => item.roles.includes(role));
}

export function isPathAllowed(pathname: string, role: UserRole): boolean {
  const matches = navigation.filter((n) => pathname.startsWith(n.href));
  if (matches.length === 0) return true; // default allow for unknown paths under /admin
  // Choose the most specific match (longest href)
  const item = matches.sort((a, b) => b.href.length - a.href.length)[0];
  return item.roles.includes(role);
}


