'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems?: number
  itemsPerPage?: number
  onPageChange: (page: number) => void
  loading?: boolean
  showItemsInfo?: boolean
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 10,
  onPageChange,
  loading = false,
  showItemsInfo = true,
  className
}: PaginationProps) {
  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxPagesToShow = 7
    const halfRange = Math.floor(maxPagesToShow / 2)

    let startPage = Math.max(1, currentPage - halfRange)
    let endPage = Math.min(totalPages, currentPage + halfRange)

    // Adjust if we're near the beginning or end
    if (currentPage <= halfRange) {
      endPage = Math.min(totalPages, maxPagesToShow)
    }
    if (currentPage + halfRange >= totalPages) {
      startPage = Math.max(1, totalPages - maxPagesToShow + 1)
    }

    // Always show first page
    if (startPage > 1) {
      pages.push(1)
      if (startPage > 2) pages.push('...')
    }

    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    // Always show last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages.push('...')
      pages.push(totalPages)
    }

    return pages
  }

  // Calculate items info
  const getItemsInfo = () => {
    if (!totalItems) return null
    const start = (currentPage - 1) * itemsPerPage + 1
    const end = Math.min(currentPage * itemsPerPage, totalItems)
    return `${start}-${end} จาก ${totalItems} รายการ`
  }

  if (totalPages <= 1) return null

  return (
    <div className={cn('flex items-center justify-between mt-4 px-2', className)}>
      <div className="text-sm text-gray-600">
        {showItemsInfo && totalItems ? (
          getItemsInfo()
        ) : (
          `หน้า ${currentPage} จาก ${totalPages}`
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* First page button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={!hasPrev || loading}
          className="h-8 w-8 p-0 hidden sm:flex"
          title="หน้าแรก"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev || loading}
          className="h-8 w-8 p-0"
          title="หน้าก่อนหน้า"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="px-2 text-gray-400">...</span>
            ) : (
              <Button
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(page as number)}
                disabled={loading}
                className="h-8 min-w-[32px] px-2"
              >
                {page}
              </Button>
            )}
          </React.Fragment>
        ))}

        {/* Next button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext || loading}
          className="h-8 w-8 p-0"
          title="หน้าถัดไป"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNext || loading}
          className="h-8 w-8 p-0 hidden sm:flex"
          title="หน้าสุดท้าย"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Hook for managing pagination state
export function usePagination<T>(items: T[], itemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = React.useState(1)

  const totalItems = items.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  // Reset to page 1 when items change significantly
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalItems, totalPages, currentPage])

  const paginatedItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return items.slice(start, end)
  }, [items, currentPage, itemsPerPage])

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }

  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    goToPage,
    setCurrentPage
  }
}
