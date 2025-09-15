"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  VisibilityState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Settings2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  onPaginationChange?: (page: number, limit: number) => void;
  onFilterChange?: (filters: { search?: string; role?: string; status?: string; }) => void;
  currentFilters?: {
    search: string;
    role: string;
    status: string;
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pagination,
  onPaginationChange,
  onFilterChange,
  currentFilters,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [searchValue, setSearchValue] = useState<string>(currentFilters?.search || "");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>(currentFilters?.search || "");
  const [roleFilter, setRoleFilter] = useState<string>(currentFilters?.role || "all");
  const [statusFilter, setStatusFilter] = useState<string>(currentFilters?.status || "all");
  const onFilterChangeRef = useRef(onFilterChange);
  const lastFiltersRef = useRef({ search: currentFilters?.search || "", role: currentFilters?.role || "all", status: currentFilters?.status || "all" });

  // Keep ref updated
  useEffect(() => {
    onFilterChangeRef.current = onFilterChange;
  });

  // Debounce search input to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Trigger search when debounced value changes (but only if values actually changed)
  useEffect(() => {
    const currentFilters = { search: debouncedSearchValue, role: roleFilter, status: statusFilter };
    const lastFilters = lastFiltersRef.current;
    
    if (onFilterChangeRef.current && 
        (currentFilters.search !== lastFilters.search || 
         currentFilters.role !== lastFilters.role || 
         currentFilters.status !== lastFilters.status)) {
      lastFiltersRef.current = currentFilters;
      onFilterChangeRef.current(currentFilters);
    }
  }, [debouncedSearchValue, roleFilter, statusFilter]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Only use client-side pagination if no server-side pagination is provided
    ...(pagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    // Only use client-side filtering if no server-side filtering is provided
    ...(!onFilterChange ? { getFilteredRowModel: getFilteredRowModel() } : {}),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: pagination?.limit || 10,
      },
    },
    manualPagination: !!pagination, // Use server-side pagination when provided
    manualFiltering: !!onFilterChange, // Use server-side filtering when provided
    pageCount: pagination?.totalPages || -1,
  });

  const handleSearchChange = (search: string) => {
    setSearchValue(search);
    if (!onFilterChange) {
      // Fall back to client-side filtering for immediate response
      table.getColumn("name")?.setFilterValue(search);
    }
    // Server-side filtering is handled by the debounced useEffect
  };

  const handleRoleFilter = (role: string) => {
    setRoleFilter(role);
    if (!onFilterChange) {
      // Fall back to client-side filtering
      if (role === "all") {
        table.getColumn("role")?.setFilterValue("");
      } else {
        table.getColumn("role")?.setFilterValue(role);
      }
    }
    // Server-side filtering is handled by the debounced useEffect
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    if (!onFilterChange) {
      // Fall back to client-side filtering
      if (status === "all") {
        table.getColumn("status")?.setFilterValue("");
      } else {
        table.getColumn("status")?.setFilterValue(status);
      }
    }
    // Server-side filtering is handled by the debounced useEffect
  };

  const getResponsiveColumnClass = (columnId: string) => {
    const hideOnMobile = new Set([
      "email",
      "region",
      "leadMr",
      "_count",
      "createdAt",
    ]);
    return hideOnMobile.has(columnId) ? "hidden md:table-cell" : "";
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchValue}
              onChange={(event) => handleSearchChange(event.target.value)}
              className="pl-8 w-full sm:max-w-sm"
            />
          </div>
          <Select value={roleFilter} onValueChange={handleRoleFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="LEAD_MR">Lead MR</SelectItem>
              <SelectItem value="MR">MR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Badge variant="secondary">
            {pagination
              ? `${pagination.total} users`
              : `${table.getFilteredRowModel().rows.length} users`}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="mr-2 h-4 w-4" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "px-4",
                        getResponsiveColumnClass(header.column.id)
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-4",
                        getResponsiveColumnClass(cell.column.id)
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${
              pagination?.limit || table.getState().pagination.pageSize
            }`}
            onValueChange={(value) => {
              if (pagination && onPaginationChange) {
                onPaginationChange(1, Number(value)); // Reset to page 1 when changing page size
              } else {
                table.setPageSize(Number(value));
              }
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue
                placeholder={
                  pagination?.limit || table.getState().pagination.pageSize
                }
              />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8 w-full sm:w-auto">
          <div className="flex w-[100px] items-center justify-center text-sm font-medium mx-auto sm:mx-0">
            Page {pagination?.page || table.getState().pagination.pageIndex + 1}{" "}
            of {pagination?.totalPages || table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => {
                if (pagination && onPaginationChange) {
                  onPaginationChange(pagination.page - 1, pagination.limit);
                } else {
                  table.previousPage();
                }
              }}
              disabled={
                pagination ? !pagination.hasPrev : !table.getCanPreviousPage()
              }
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => {
                if (pagination && onPaginationChange) {
                  onPaginationChange(pagination.page + 1, pagination.limit);
                } else {
                  table.nextPage();
                }
              }}
              disabled={
                pagination ? !pagination.hasNext : !table.getCanNextPage()
              }
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
