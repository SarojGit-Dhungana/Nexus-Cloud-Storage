import { Settings, HardDrive, Shield, Bell, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { toast } from 'sonner';

export function SystemSettings() {
  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">System Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Configure system-wide settings and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            <CardTitle>Storage Settings</CardTitle>
          </div>
          <CardDescription>
            Manage storage limits and allocation policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Default User Storage Limit</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Storage allocated to new users
              </p>
            </div>
            <div className="text-sm font-medium">50 GB</div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-cleanup Trash</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automatically delete files after 30 days
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>File Versioning</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Keep previous versions of files
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <CardTitle>Security Settings</CardTitle>
          </div>
          <CardDescription>
            Configure security and access control policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Require 2FA for all users
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Password Expiration</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Force password change every 90 days
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>IP Allowlisting</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Restrict access to specific IP addresses
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Encryption at Rest</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Encrypt all stored files
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <CardTitle>Notification Settings</CardTitle>
          </div>
          <CardDescription>
            Configure system-wide notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Send email alerts for important events
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Storage Alerts</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Notify admins when storage exceeds 80%
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Security Alerts</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Alert on suspicious activity
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            <CardTitle>General Settings</CardTitle>
          </div>
          <CardDescription>
            Configure general system preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Public File Sharing</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Allow users to create public share links
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>User Registration</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Allow new user self-registration
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Activity Logging</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track all user activities
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline">Reset to Defaults</Button>
        <Button onClick={handleSave}>Save Changes</Button>
      </div>
    </div>
  );
}
