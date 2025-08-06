import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import NptReports from "@/pages/npt-reports";
import NptReportsBulk from "@/pages/npt-reports-bulk";
import FileUpload from "@/pages/file-upload";
import Approvals from "@/pages/approvals";
import PendingApprovals from "@/pages/pending-approvals";
import NptReportDetail from "@/pages/npt-report-detail";
import Settings from "@/pages/settings";
import Reports from "@/pages/reports";
import MonthlyReports from "@/pages/monthly-reports";
import MonthlyTimeline from "@/pages/monthly-timeline";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/npt-reports" component={NptReports} />
          <Route path="/npt-reports/:id" component={NptReportDetail} />
          <Route path="/npt-reports-bulk" component={NptReportsBulk} />
          <Route path="/file-upload" component={FileUpload} />
          <Route path="/approvals" component={Approvals} />
          <Route path="/pending-approvals" component={PendingApprovals} />
          <Route path="/reports" component={Reports} />
          <Route path="/monthly-reports" component={MonthlyReports} />
          <Route path="/monthly-reports/:id/timeline" component={MonthlyTimeline} />
          <Route path="/settings" component={Settings} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Check if it's an API error
      if (event.reason?.message?.includes('401')) {
        console.log('Unauthorized error detected, redirecting to login...');
        window.location.href = '/api/login';
      }
      
      // Prevent the error from being logged to the console again
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
