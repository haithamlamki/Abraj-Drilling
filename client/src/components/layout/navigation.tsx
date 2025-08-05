import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function Navigation() {
  const { user } = useAuth();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="bg-primary w-8 h-8 rounded flex items-center justify-center mr-3">
              <i className="fas fa-oil-well text-white text-sm"></i>
            </div>
            <h1 className="text-xl font-semibold text-gray-900" data-testid="text-app-title">Drilling Data Platform</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600" data-testid="text-user-info">
              <span>{user?.firstName} {user?.lastName}</span> - 
              <span className="capitalize"> {user?.role?.replace('_', ' ')}</span>
              {user?.rigId && <span> - Rig {user.rigId}</span>}
            </div>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/api/logout'}
              data-testid="button-logout"
              className="flex items-center gap-2"
            >
              <i className="fas fa-sign-out-alt"></i>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
