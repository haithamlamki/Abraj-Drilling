import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { BillingUploadResult, BillingSheetRow } from "@shared/billingTypes";

interface UploadedFile {
  id: string;
  fileName: string;
  uploadDate: string;
  status: string;
  result?: BillingUploadResult;
}

export default function FileUpload() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentResult, setCurrentResult] = useState<BillingUploadResult | null>(null);

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

  // Fetch upload history
  const { data: uploadHistory = [] } = useQuery<UploadedFile[]>({
    queryKey: ['/api/billing-uploads'],
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<BillingUploadResult> => {
      const formData = new FormData();
      formData.append('file', file);
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('POST', '/api/billing-upload');
        xhr.send(formData);
      });
    },
    onSuccess: (result) => {
      setCurrentResult(result);
      setUploadProgress(0);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['/api/billing-uploads'] });
      
      toast({
        title: "Upload Successful",
        description: `Processed ${result.processedRows} of ${result.totalRows} rows`,
      });
    },
    onError: (error) => {
      setUploadProgress(0);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Create NPT reports from processed data
  const createReportsMutation = useMutation({
    mutationFn: async (rows: BillingSheetRow[]) => {
      return await apiRequest(`/api/billing-convert`, {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success", 
        description: "NPT reports created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/npt-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setCurrentResult(null);
    },
    onError: (error) => {
      toast({
        title: "Error Creating Reports",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['.csv', '.xlsx', '.xls', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!allowedTypes.includes(fileExtension)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload CSV, Excel, or text files only",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setCurrentResult(null);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleCreateReports = () => {
    if (currentResult?.extractedData) {
      createReportsMutation.mutate(currentResult.extractedData);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'Failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'Processing':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

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
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Billing Sheet Upload</h1>
              <Badge variant="outline">Automated NPT Extraction</Badge>
            </div>

            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Billing Sheet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file-upload">Select Billing Sheet File</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleFileSelect}
                    disabled={uploadMutation.isPending}
                    data-testid="input-file-upload"
                  />
                  <p className="text-sm text-gray-500">
                    Supported formats: CSV, Excel (.xlsx, .xls), Text files
                  </p>
                </div>

                {selectedFile && (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </AlertDescription>
                  </Alert>
                )}

                {uploadMutation.isPending && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                <Button 
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="w-full"
                  data-testid="button-upload"
                >
                  {uploadMutation.isPending ? "Processing..." : "Upload & Process"}
                </Button>
              </CardContent>
            </Card>

            {/* Processing Results */}
            {currentResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Processing Results: {currentResult.fileName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded">
                      <div className="text-2xl font-bold text-blue-600">{currentResult.totalRows}</div>
                      <div className="text-sm text-gray-600">Total Rows</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded">
                      <div className="text-2xl font-bold text-green-600">{currentResult.processedRows}</div>
                      <div className="text-sm text-gray-600">Processed</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded">
                      <div className="text-2xl font-bold text-red-600">{currentResult.errors.length}</div>
                      <div className="text-sm text-gray-600">Errors</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded">
                      <div className="text-2xl font-bold text-purple-600">
                        {currentResult.extractedData.filter(d => d.nbtType === 'Abroad').length}
                      </div>
                      <div className="text-sm text-gray-600">Abroad NPT</div>
                    </div>
                  </div>

                  {currentResult.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-semibold">Processing Errors:</div>
                        <ul className="list-disc list-inside mt-1">
                          {currentResult.errors.slice(0, 5).map((error, index) => (
                            <li key={index} className="text-sm">{error}</li>
                          ))}
                          {currentResult.errors.length > 5 && (
                            <li className="text-sm">... and {currentResult.errors.length - 5} more</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {currentResult.extractedData.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-semibold">Extracted Data Preview (First 5 rows):</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-gray-300 p-2 text-left">Rig</th>
                              <th className="border border-gray-300 p-2 text-left">Date</th>
                              <th className="border border-gray-300 p-2 text-left">Hours</th>
                              <th className="border border-gray-300 p-2 text-left">NBT Type</th>
                              <th className="border border-gray-300 p-2 text-left">Equipment</th>
                              <th className="border border-gray-300 p-2 text-left">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentResult.extractedData.slice(0, 5).map((row, index) => (
                              <tr key={index}>
                                <td className="border border-gray-300 p-2">{row.rigNumber}</td>
                                <td className="border border-gray-300 p-2">
                                  {new Date(row.date).toLocaleDateString()}
                                </td>
                                <td className="border border-gray-300 p-2">{row.hours}</td>
                                <td className="border border-gray-300 p-2">
                                  <Badge variant={row.nbtType === 'Abroad' ? 'destructive' : 'secondary'}>
                                    {row.nbtType}
                                  </Badge>
                                </td>
                                <td className="border border-gray-300 p-2">
                                  {row.extractedEquipment || '-'}
                                </td>
                                <td className="border border-gray-300 p-2 max-w-xs truncate">
                                  {row.description}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <Button 
                        onClick={handleCreateReports}
                        disabled={createReportsMutation.isPending}
                        className="w-full"
                        data-testid="button-create-reports"
                      >
                        {createReportsMutation.isPending ? "Creating Reports..." : 
                         `Create ${currentResult.extractedData.length} NPT Reports`}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Upload History */}
            <Card>
              <CardHeader>
                <CardTitle>Upload History</CardTitle>
              </CardHeader>
              <CardContent>
                {uploadHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No uploads yet</p>
                ) : (
                  <div className="space-y-2">
                    {uploadHistory.map((upload) => (
                      <div key={upload.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(upload.status)}
                          <div>
                            <div className="font-medium">{upload.fileName}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(upload.uploadDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={upload.status === 'Completed' ? 'default' : 'secondary'}>
                            {upload.status}
                          </Badge>
                          {upload.result && (
                            <span className="text-sm text-gray-500">
                              {upload.result.processedRows}/{upload.result.totalRows} rows
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}