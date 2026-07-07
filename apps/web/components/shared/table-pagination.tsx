"use client";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TablePaginationProps = {
  pageNumber: number;
  pageSize: number;
  itemCount: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
};

export function TablePagination({
  pageNumber,
  pageSize,
  itemCount,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  pageSizeOptions = [10, 15, 25, 50],
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const rangeStart = itemCount === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const rangeEnd = (pageNumber - 1) * pageSize + itemCount;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        {itemCount === 0 ? (
          "No results on this page"
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{rangeStart}</span>
            {rangeEnd > rangeStart ? (
              <>
                –<span className="font-medium text-foreground">{rangeEnd}</span>
              </>
            ) : null}{" "}
            on page <span className="font-medium text-foreground">{pageNumber}</span>
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-18" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (canGoPrev) onPrev();
                }}
                className={cn(!canGoPrev && "pointer-events-none opacity-50")}
                aria-disabled={!canGoPrev}
              />
            </PaginationItem>
            <PaginationItem>
              <Button variant="outline" size="sm" className="min-w-9 pointer-events-none" tabIndex={-1}>
                {pageNumber}
              </Button>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (canGoNext) onNext();
                }}
                className={cn(!canGoNext && "pointer-events-none opacity-50")}
                aria-disabled={!canGoNext}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
