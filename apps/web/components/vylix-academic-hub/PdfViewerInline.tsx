'use client';

import { useState } from 'react'

interface PdfViewerInlineProps {
  fileUrl: string
  onClose: () => void
}

export function PdfViewerInline({ fileUrl, onClose }: PdfViewerInlineProps) {
  const [numPages] = useState(0)

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs text-gray-400">{numPages > 0 ? `${numPages} pages` : 'Loading...'}</p>
        <button
          onClick={onClose}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Back to list
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-100 rounded-xl p-4">
        <embed
          src={fileUrl}
          type="application/pdf"
          className="w-full h-full min-h-[70vh] rounded-lg"
        />
      </div>
    </div>
  )
}
