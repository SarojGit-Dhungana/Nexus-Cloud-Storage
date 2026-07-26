import { Shield, User, Cloud } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

interface RoleSelectorProps {
  onSelectRole: (role: 'admin' | 'user') => void;
}

export function RoleSelector({ onSelectRole }: RoleSelectorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Cloud className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold">NexusStorage</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Enterprise cloud storage and file sharing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2 hover:border-blue-500 dark:hover:border-blue-400 transition-all cursor-pointer group">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-950 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>

                <div>
                  <h2 className="text-2xl font-semibold mb-2">User Access</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Access your files, share with others, and collaborate
                  </p>
                </div>

                <div className="space-y-2 text-sm text-left bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>Upload and manage files</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>Share files with others</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>Access shared content</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>Personal dashboard</span>
                  </div>
                </div>

                <Button
                  onClick={() => onSelectRole('user')}
                  className="w-full"
                  size="lg"
                >
                  Continue as User
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-purple-500 dark:hover:border-purple-400 transition-all cursor-pointer group">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-950 dark:to-pink-950 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Shield className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                </div>

                <div>
                  <h2 className="text-2xl font-semibold mb-2">Admin Access</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Full control over users, storage, and analytics
                  </p>
                </div>

                <div className="space-y-2 text-sm text-left bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span>All user capabilities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span>Analytics & reporting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span>User management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span>Storage monitoring</span>
                  </div>
                </div>

                <Button
                  onClick={() => onSelectRole('admin')}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                >
                  Continue as Admin
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
          This is a demo. In production, role would be determined by authentication.
        </p>
      </div>
    </div>
  );
}
