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

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">GPS Tracking</h3>
            <p className="text-gray-600 text-sm">
              Real-time location tracking with automated kilometer calculation and route optimization.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Client Management</h3>
            <p className="text-gray-600 text-sm">
              Comprehensive client database with visit tracking and business transaction recording.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Analytics & Reports</h3>
            <p className="text-gray-600 text-sm">
              Detailed performance metrics, daily summaries, and comprehensive reporting dashboard.
            </p>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Project Status</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Next.js Setup</span>
                <span className="text-green-600 font-medium">✓ Complete</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Database Schema</span>
                <span className="text-green-600 font-medium">✓ Complete</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Schema Testing</span>
                <span className="text-green-600 font-medium">✓ Complete</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">API Routes</span>
                <span className="text-amber-600 font-medium">⚠ In Progress</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Dashboard UI</span>
                <span className="text-amber-600 font-medium">⚠ In Progress</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Quick Links</h3>
            <div className="space-y-3">
              <a 
                href="/api/health" 
                className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                target="_blank"
              >
                <div className="font-medium text-gray-800">API Health Check</div>
                <div className="text-sm text-gray-600">Test database connection</div>
              </a>
              <a 
                href="/api/db-test" 
                className="block p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-left"
                target="_blank"
              >
                <div className="font-medium text-blue-800">Database Schema Test</div>
                <div className="text-sm text-blue-600">Run comprehensive database tests</div>
              </a>
              <a 
                href="/api/seed" 
                className="block p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-left"
                target="_blank"
              >
                <div className="font-medium text-green-800">Database Seeding</div>
                <div className="text-sm text-green-600">Populate with sample data</div>
              </a>
              <a 
                href="/dashboard" 
                className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <div className="font-medium text-gray-800">Dashboard</div>
                <div className="text-sm text-gray-600">Access management interface</div>
              </a>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Technology Stack</h3>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">Next.js 15</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">TypeScript</span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Prisma</span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">MongoDB</span>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">Tailwind CSS</span>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">shadcn/ui</span>
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">Zod</span>
          </div>
        </div>
      </main>

      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>© 2024 SDP Ayurveda. Production-ready field management solution.</p>
      </footer>
    </div>
  );
}
