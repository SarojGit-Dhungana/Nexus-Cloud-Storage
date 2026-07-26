import { useState } from 'react';
import { Users, UserPlus, MoreVertical, Shield, User as UserIcon, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  storage: string;
  lastActive: string;
  avatar?: string;
}

const mockUsers: UserData[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah.chen@company.com',
    role: 'admin',
    status: 'active',
    storage: '15.2 GB',
    lastActive: '2 min ago',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
  },
  {
    id: '2',
    name: 'John Doe',
    email: 'john.doe@company.com',
    role: 'user',
    status: 'active',
    storage: '8.7 GB',
    lastActive: '15 min ago',
  },
  {
    id: '3',
    name: 'Jane Smith',
    email: 'jane.smith@company.com',
    role: 'user',
    status: 'active',
    storage: '12.4 GB',
    lastActive: '1 hour ago',
  },
  {
    id: '4',
    name: 'Mike Johnson',
    email: 'mike.j@company.com',
    role: 'user',
    status: 'active',
    storage: '5.1 GB',
    lastActive: '3 hours ago',
  },
  {
    id: '5',
    name: 'Emily Davis',
    email: 'emily.d@company.com',
    role: 'user',
    status: 'inactive',
    storage: '2.3 GB',
    lastActive: '2 days ago',
  },
];

export function UserManagement() {
  const [users, setUsers] = useState<UserData[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMakeAdmin = (userId: string) => {
    setUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, role: 'admin' as const } : u)
    );
    toast.success('User promoted to admin');
  };

  const handleRemoveAdmin = (userId: string) => {
    setUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, role: 'user' as const } : u)
    );
    toast.success('Admin privileges removed');
  };

  const handleDeactivate = (userId: string) => {
    setUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, status: 'inactive' as const } : u)
    );
    toast.success('User deactivated');
  };

  const handleActivate = (userId: string) => {
    setUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, status: 'active' as const } : u)
    );
    toast.success('User activated');
  };

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'active').length;
  const adminUsers = users.filter(u => u.role === 'admin').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">User Management</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage users, roles, and permissions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalUsers}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Across all teams
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{activeUsers}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round((activeUsers / totalUsers) * 100)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <Shield className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{adminUsers}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              With full access
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Users</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <Button size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Storage Used</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === 'admin' ? 'default' : 'secondary'}
                      className={
                        user.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : ''
                      }
                    >
                      {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.status === 'active' ? 'default' : 'secondary'}
                      className={
                        user.status === 'active'
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                          : ''
                      }
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400">
                    {user.storage}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400">
                    {user.lastActive}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Profile</DropdownMenuItem>
                        <DropdownMenuItem>Edit User</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.role === 'user' ? (
                          <DropdownMenuItem onClick={() => handleMakeAdmin(user.id)}>
                            <Shield className="w-4 h-4 mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleRemoveAdmin(user.id)}>
                            Remove Admin
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {user.status === 'active' ? (
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(user.id)}
                            className="text-orange-600 dark:text-orange-400"
                          >
                            Deactivate User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleActivate(user.id)}
                            className="text-green-600 dark:text-green-400"
                          >
                            Activate User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
