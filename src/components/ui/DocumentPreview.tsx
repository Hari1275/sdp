import { useState } from 'react';
import Image from 'next/image';
import { S3_BASE_URL } from '@/lib/s3-utils';

interface DocumentPreviewProps {
  documentLink?: string | null;
  className?: string;
}

/**
 * A component to preview documents (images/PDFs) stored in S3
 */
export function DocumentPreview({ documentLink, className = '' }: DocumentPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!documentLink) {
    return null;
  }

  // Convert relative path to full URL if needed
  const fullUrl = documentLink.startsWith('http')
    ? documentLink
    : `${S3_BASE_URL}/${documentLink}`;
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(documentLink);
  const isPDF = /\.pdf$/i.test(documentLink);

  // Render thumbnail/preview
  const renderPreview = () => {
    if (isImage) {
      return (
        <div className="relative h-14 w-14 cursor-pointer" onClick={() => setIsOpen(true)}>
          <Image
            src={fullUrl}
            alt="Document preview"
            fill
            className="object-cover rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
          />
        </div>
      );
    }
    if (isPDF) {
      return (
        <svg
          className="h-14 w-14 text-gray-500 cursor-pointer hover:text-gray-700 transition-colors duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          onClick={() => setIsOpen(true)}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    }
    return null;
  };

  // Render modal content
  const renderModalContent = () => {
    if (isImage) {
      return (
        <div className="relative w-full h-[600px]">
          <Image
            src={fullUrl}
            alt="Document preview"
            fill
            className="object-contain rounded-lg shadow-lg"
          />
        </div>
      );
    }
    if (isPDF) {
      return (
        <iframe
          src={fullUrl}
          className="w-full h-[600px] rounded-lg shadow-lg"
          title="PDF preview"
        />
      );
    }
    return null;
  };

  return (
    <div className={className}>
      {renderPreview()}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-xl font-semibold">Document Preview</h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500"
                onClick={() => setIsOpen(false)}
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-8 flex-1 overflow-auto min-h-[400px] flex items-center justify-center bg-gray-50">
              {renderModalContent()}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <span className="flex-1 text-sm text-gray-500 self-center">{documentLink.split('/').pop()}</span>
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Download
              </a>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 transition-colors duration-200"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}