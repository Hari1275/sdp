'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ShieldX, ArrowLeft, LogOut } from 'lucide-react'

export default function UnauthorizedPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const handleGoBack = () => {
    router.back()
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  const getRoleBasedHomePage = () => {
    if (!session?.user?.role) return '/dashboard'
    
    switch (session.user.role) {
      case 'ADMIN':
        return '/admin'
      case 'LEAD_MR':
        return '/lead-mr'
      case 'MR':
        return '/dashboard/mr'
      default:
        return '/dashboard'
    }
  }

  const handleGoHome = () => {
    router.push(getRoleBasedHomePage())
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <ShieldX className="w-10 h-10 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Access Denied
        </h1>

        {/* Message */}
        <div className="mb-8 space-y-2">
          <p className="text-lg text-gray-600">
            You don&apos;t have permission to access this page.
          </p>
          {session?.user && (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              <p>Signed in as: <strong>{session.user.name}</strong></p>
              <p>Role: <strong>{session.user.role}</strong></p>
              {session.user.region && (
                <p>Region: <strong>{session.user.region.name}</strong></p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleGoHome}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to My Dashboard
          </button>

          <div className="flex space-x-3">
            <button
              onClick={handleGoBack}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Go Back
            </button>

            <button
              onClick={handleSignOut}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-sm text-gray-500">
          <p>
            If you believe this is an error, please contact your administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
