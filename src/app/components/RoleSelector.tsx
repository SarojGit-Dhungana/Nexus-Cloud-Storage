import { Shield, User, Cloud } from 'lucide-react';
import { PRODUCT_NAME } from '../lib/brand';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

interface RoleSelectorProps {
  onSelectRole: (role: 'admin' | 'user') => void;
}

export function RoleSelector({ onSelectRole }: RoleSelectorProps) {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-background p-4 nexus-industrial-shell">
      <div className="absolute inset-0 nexus-boot-glow" />
      <div className="relative w-full max-w-4xl">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 nexus-mark rounded-xl flex items-center justify-center">
              <Cloud className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-brand text-2xl sm:text-3xl leading-tight">{PRODUCT_NAME}</h1>
          </div>
          <p className="font-script text-primary mb-2">Access control</p>
          <p className="text-muted-foreground">
            Enterprise cloud storage and file sharing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2 hover:border-primary transition-all cursor-pointer group nexus-panel">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-primary/10 rounded-xl flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                  <User className="w-10 h-10 text-primary" />
                </div>

                <div>
                  <h2 className="font-display text-2xl mb-2">User Access</h2>
                  <p className="text-muted-foreground text-sm">
                    Access your files, share with others, and collaborate
                  </p>
                </div>

                <div className="space-y-2 text-sm text-left bg-secondary rounded-lg p-4">
                  {['Upload and manage files', 'Share files with others', 'Access shared content', 'Personal dashboard'].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>{item}</span>
                    </div>
                  ))}
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

          <Card className="border-2 hover:border-destructive transition-all cursor-pointer group nexus-panel">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-destructive/10 rounded-xl flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                  <Shield className="w-10 h-10 text-destructive" />
                </div>

                <div>
                  <h2 className="font-display text-2xl mb-2">Admin Access</h2>
                  <p className="text-muted-foreground text-sm">
                    Full control over users, storage, and analytics
                  </p>
                </div>

                <div className="space-y-2 text-sm text-left bg-secondary rounded-lg p-4">
                  {['All user capabilities', 'Analytics & reporting', 'User management', 'Storage monitoring'].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => onSelectRole('admin')}
                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  size="lg"
                >
                  Continue as Admin
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8 uppercase tracking-[0.12em]">
          {PRODUCT_NAME} · Role is set by your signed-in account
        </p>
      </div>
    </div>
  );
}
