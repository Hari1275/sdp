"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      router.push('/admin');
    }
  }, [session, router]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col items-center justify-center p-8">
      <main className="max-w-4xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12">
          <div className="mb-6">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              SDP Ayurveda
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-green-500 to-blue-600 mx-auto rounded-full"></div>
          </div>
          <h2 className="text-xl md:text-2xl text-gray-600 font-medium mb-8">
            Field Management Dashboard
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Comprehensive field management solution with GPS tracking, client visit management, 
            task assignment, and real-time performance analytics for Marketing Representatives.
          </p>
        </div>

        {/* Simplified: removed features grid */}

        {/* Simplified landing page: removed Project Status, Quick Links, and Technology Stack */}
      </main>

      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} SDP Ayurveda</p>
      </footer>
    </div>
  );
}
