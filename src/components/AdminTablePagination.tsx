import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface AdminTablePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function buildPaginationItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) {
    items.push("ellipsis");
  }

  for (let i = start; i <= end; i += 1) {
    items.push(i);
  }

  if (end < totalPages - 1) {
    items.push("ellipsis");
  }

  items.push(totalPages);
  return items;
}

export function AdminTablePagination({ page, totalPages, onPageChange }: AdminTablePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const paginationItems = buildPaginationItems(page, totalPages);

  return (
    <Pagination className="justify-end py-3">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            className={page === 1 ? "pointer-events-none opacity-50" : ""}
            onClick={(event) => {
              event.preventDefault();
              if (page > 1) {
                onPageChange(page - 1);
              }
            }}
          />
        </PaginationItem>

        {paginationItems.map((item, index) => (
          <PaginationItem key={`${item}-${index}`}>
            {item === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                isActive={item === page}
                onClick={(event) => {
                  event.preventDefault();
                  onPageChange(item);
                }}
              >
                {item}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            href="#"
            className={page === totalPages ? "pointer-events-none opacity-50" : ""}
            onClick={(event) => {
              event.preventDefault();
              if (page < totalPages) {
                onPageChange(page + 1);
              }
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
