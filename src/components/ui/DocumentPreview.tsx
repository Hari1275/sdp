import { useState } from 'react';
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
        <img
          src={fullUrl}
          alt="Document preview"
          className="h-10 w-10 object-cover cursor-pointer rounded"
          onClick={() => setIsOpen(true)}
        />
      );
    }
    if (isPDF) {
      return (
        <svg
          className="h-10 w-10 text-gray-500 cursor-pointer"
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
        <img
          src={fullUrl}
          alt="Document preview"
          className="max-w-full max-h-[80vh] object-contain"
        />
      );
    }
    if (isPDF) {
      return (
        <iframe
          src={fullUrl}
          className="w-full h-[80vh]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">Document Preview</h3>
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
            <div className="p-4">
              {renderModalContent()}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 p-4 border-t">
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Download
              </a>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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