import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FileUpload() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900" data-testid="text-file-upload-title">Billing Sheet Upload</h2>
              <Button 
                variant="outline"
                onClick={() => window.history.back()}
                data-testid="button-back"
              >
                Back to Dashboard
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Upload Billing Documents</CardTitle>
                <p className="text-sm text-gray-600">Upload PDF or Excel billing sheets for automatic NPT extraction and classification.</p>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
                  <i className="fas fa-cloud-upload-alt text-gray-400 text-4xl mb-4"></i>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Drop files here or click to upload</h4>
                  <p className="text-sm text-gray-600 mb-4">Supports PDF and Excel formats (Max 10MB per file)</p>
                  <Button data-testid="button-select-files">
                    Select Files
                  </Button>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center">
                    <i className="fas fa-info-circle text-primary mr-3"></i>
                    <div>
                      <p className="text-sm font-medium text-primary-foreground">File Upload Feature</p>
                      <p className="text-sm text-primary/80">Billing sheet processing and NPT extraction will be implemented in the next phase.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
