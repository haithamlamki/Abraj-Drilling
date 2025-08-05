import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import NptFormMulti from "@/components/npt/npt-form-multi";
import type { BillingSheetRow } from "@shared/billingTypes";

export default function NptReportsBulk() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Get billing data from session storage
  const billingData = sessionStorage.getItem('allBillingData');
  const parsedBillingData: BillingSheetRow[] = billingData ? JSON.parse(billingData) : [];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900" data-testid="text-npt-bulk-title">
              Create Multiple NPT Reports
            </h2>
            
            <NptFormMulti billingData={parsedBillingData} />
          </div>
        </div>
      </div>
    </div>
  );
}