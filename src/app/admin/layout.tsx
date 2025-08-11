"use client";

import { ReactNode, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import LogoPng from "../../../public/logo.png";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { filterNavByRole, isPathAllowed, NavItem } from "./navigation-config";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session, status } = useSession();
  const [signoutOpen, setSignoutOpen] = useState(false);
  const pathname = usePathname();

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    redirect("/login");
  }

  // Only allow Admin and Lead MR overall
  if (session.user?.role !== "ADMIN" && session.user?.role !== "LEAD_MR") {
    redirect("/unauthorized");
  }

  // Filter navigation by role
  const allowedNav = filterNavByRole(session.user.role);

  // Route-level guard: if current path belongs to a disallowed item, redirect to first allowed
  if (!isPathAllowed(pathname || "/admin", session.user.role)) {
    redirect(allowedNav[0]?.href ?? "/unauthorized");
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 h-16 flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <Link href="/admin" className="flex items-center space-x-3">
                <Image
                  src={LogoPng}
                  alt="SDP Ayurveda"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-md object-contain"
                  priority
                />
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    Admin Dashboard
                  </h1>
                  <p className="text-xs text-gray-500">SDP Ayurveda Management</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Search removed per request */}

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Notification bell removed per request */}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={session.user?.image || ""}
                      alt={session.user?.name || ""}
                    />
                    <AvatarFallback>
                      {session.user?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "A"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.user?.name || "Admin User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user?.email || "admin@sdp.com"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSignoutOpen(true)}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <AlertDialog
        open={signoutOpen}
        onOpenChange={setSignoutOpen}
        title="Sign out?"
        description="You will be returned to the login page."
        footer={
          <>
            <Button variant="outline" onClick={() => setSignoutOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              Sign out
            </Button>
          </>
        }
      />

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white border-r border-gray-200 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <div className="p-6">
            <div className="space-y-1">
              {allowedNav.map((item: NavItem) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="mr-3 h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Navigation Cards */}
          <div className="px-6 mt-8">
            <Separator className="mb-6" />
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quick Access
              </h3>
              {allowedNav.slice(0, 4).map((item: NavItem) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.name}
                    className="p-3 hover:shadow-sm transition-shadow cursor-pointer"
                  >
                    <Link href={item.href} className="block">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Icon className="h-4 w-4 text-gray-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </Card>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
