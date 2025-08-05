import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { NptReport } from "@shared/schema";

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: reports = [] } = useQuery<NptReport[]>({
    queryKey: ['/api/npt-reports'],
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });
  
  // Filter for pending reports
  const pendingReports = reports.filter(report => report.status === 'Pending Review');

  const navItems = [
    {
      href: "/",
      icon: "fas fa-tachometer-alt",
      label: "Dashboard",
    },
    {
      href: "/npt-reports",
      icon: "fas fa-clipboard-list",
      label: "NPT Reports",
    },
    {
      href: "/file-upload",
      icon: "fas fa-upload",
      label: "Billing Upload",
    },
    {
      href: "/reports",
      icon: "fas fa-chart-bar",
      label: "Reports Dashboard",
    },
    {
      href: "/approvals",
      icon: "fas fa-check-circle",
      label: "Approvals",
      badge: pendingReports.length > 0 ? pendingReports.length : undefined,
      visible: user?.role === 'admin' || user?.role === 'supervisor',
    },
    {
      href: "/settings",
      icon: "fas fa-cog",
      label: "Settings",
    },
  ];

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  return (
    <nav className="bg-white w-64 shadow-sm h-screen">
      <div className="p-4">
        <ul className="space-y-2">
          {navItems
            .filter(item => item.visible !== false)
            .map((item) => (
            <li key={item.href}>
              <button
                onClick={() => handleNavigation(item.href)}
                className={cn(
                  "w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  location === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-gray-700 hover:bg-gray-50"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <i className={`${item.icon} mr-3`}></i>
                {item.label}
                {item.badge && (
                  <span className="ml-auto bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full" data-testid="badge-pending-count">
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
