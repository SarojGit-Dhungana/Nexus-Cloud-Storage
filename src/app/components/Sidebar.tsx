import {
  LayoutDashboard,
  Files,
  Share2,
  Trash2,
  Settings,
  Cloud,
  Users,
  BarChart3
} from 'lucide-react';
import { cn } from './ui/utils';
import type { SidebarView } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from './ui/badge';

interface SidebarProps {
  currentView: SidebarView;
  onViewChange: (view: SidebarView, subView?: string) => void;
}

const userNavigation = [
  { id: 'dashboard' as SidebarView, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'files' as SidebarView, label: 'My Files', icon: Files },
  { id: 'shared' as SidebarView, label: 'Shared', icon: Share2 },
  { id: 'trash' as SidebarView, label: 'Trash', icon: Trash2 },
];

const adminNavigation = [
  { id: 'dashboard' as SidebarView, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'files' as SidebarView, label: 'My Files', icon: Files },
  { id: 'shared' as SidebarView, label: 'Shared', icon: Share2 },
  { id: 'trash' as SidebarView, label: 'Trash', icon: Trash2 },
  { id: 'admin' as SidebarView, label: 'Analytics', icon: BarChart3, adminOnly: true, subView: 'analytics' },
  { id: 'admin' as SidebarView, label: 'User Management', icon: Users, adminOnly: true, subView: 'users' },
  { id: 'admin' as SidebarView, label: 'Settings', icon: Settings, adminOnly: true, subView: 'settings' },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { user } = useAuth();
  const navigation = user?.role === 'admin' ? adminNavigation : userNavigation;
  return (
    <div className="w-60 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg">NexusStorage</span>
          </div>
          {user?.role === 'admin' && (
            <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              Admin
            </Badge>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const isAdminSection = 'adminOnly' in item && item.adminOnly;

          return (
            <div key={`${item.id}-${index}`}>
              {index === 4 && user?.role === 'admin' && (
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Administration
                </div>
              )}
              <button
                onClick={() => onViewChange(item.id, 'subView' in item ? item.subView : undefined)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? isAdminSection
                      ? "bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-100"
                      : "bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/50 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Storage</span>
            <span className="font-medium">44 GB / 100 GB</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: '44%' }} />
          </div>
          <button className="w-full text-xs text-blue-600 dark:text-blue-400 hover:underline">
            Upgrade storage
          </button>
        </div>
      </div>
    </div>
  );
}
