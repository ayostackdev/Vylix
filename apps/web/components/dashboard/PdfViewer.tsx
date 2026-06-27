'use client';

import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
}

export function PdfViewer({ fileUrl }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    if (fileUrl.startsWith('blob:')) {
      fetch(fileUrl).then((r) => r.arrayBuffer()).then(setFileData);
    }
  }, [fileUrl]);

  if (!fileData && fileUrl.startsWith('blob:')) {
    return <p className="text-white text-sm mt-10">Loading PDF...</p>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 flex flex-col items-center p-4">
      <Document
        file={fileData || fileUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<p className="text-gray-500 text-sm mt-10">Loading PDF...</p>}
        error={<p className="text-red-400 text-sm mt-10">Failed to load PDF</p>}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            className="mb-4 shadow-lg"
            width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 32 : 800, 800)}
          />
        ))}
      </Document>
    </div>
  );
}
