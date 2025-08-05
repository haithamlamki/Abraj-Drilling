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
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, Plus } from "lucide-react";
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
      return await apiRequest('POST', `/api/billing-convert`, { rows });
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
      const allowedTypes = ['.csv', '.xlsx', '.xls', '.txt', '.pdf'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!allowedTypes.includes(fileExtension)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload CSV, Excel, text, or PDF files only",
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
                    accept=".csv,.xlsx,.xls,.txt,.pdf"
                    onChange={handleFileSelect}
                    disabled={uploadMutation.isPending}
                    data-testid="input-file-upload"
                  />
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800">Intelligent One-Row Processing with PDF Support</p>
                        <p className="text-blue-700">
                          Our system automatically extracts complete NPT reports from each billing row in Excel, CSV or PDF files, including:
                          system identification, equipment failures, causes, actions, and proper classification.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200 mt-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-green-800">Advanced PDF Processing</p>
                        <p className="text-green-700">
                          PDF files are processed to extract billing data with intelligent NBT classification based on repair rates. 
                          The system demonstrates AI-powered extraction capabilities.
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Supported formats: CSV, Excel (.xlsx, .xls), Text files, PDF
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
                    <div className="text-center p-4 bg-orange-50 rounded">
                      <div className="text-2xl font-bold text-orange-600">
                        {currentResult.recognitionSummary?.abroadRows || currentResult.extractedData.filter(d => d.nbtType === 'Abroad').length}
                      </div>
                      <div className="text-sm text-gray-600">Abroad NPT</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded">
                      <div className="text-2xl font-bold text-purple-600">
                        {currentResult.recognitionSummary?.contractualRows || currentResult.extractedData.filter(d => d.nbtType === 'Contractual').length}
                      </div>
                      <div className="text-sm text-gray-600">Contractual</div>
                    </div>
                  </div>

                  {/* Enhanced Recognition Summary */}
                  {currentResult.recognitionSummary && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold">Intelligent Rate Recognition Summary</h4>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex justify-between items-center">
                          <span>Repair Rate:</span>
                          <Badge variant="destructive">{currentResult.recognitionSummary.repairRateRows}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Reduced Rate:</span>
                          <Badge variant="secondary">{currentResult.recognitionSummary.reducedRateRows}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Zero Rate:</span>
                          <Badge variant="outline">{currentResult.recognitionSummary.zeroRateRows}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Operation:</span>
                          <Badge variant="default">{currentResult.recognitionSummary.contractualRows}</Badge>
                        </div>
                      </div>
                    </div>
                  )}

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
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Intelligent Extraction Results - Preview (First 5 rows)</h4>
                        <p className="text-sm text-gray-500">
                          {currentResult.extractedData.length} total rows extracted
                        </p>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-gray-300 p-2 text-left text-xs">Rig</th>
                              <th className="border border-gray-300 p-2 text-left text-xs">Date</th>
                              <th className="border border-gray-300 p-2 text-left text-xs">Hours</th>
                              <th className="border border-gray-300 p-2 text-left text-xs">NBT Type</th>
                              <th className="border border-gray-300 p-2 text-left text-xs">Rate Type</th>
                              <th className="border border-gray-300 p-2 text-left text-xs">System</th>
                              <th className="border border-gray-300 p-2 text-left text-xs">Equipment</th>
                              <th className="border border-gray-300 p-2 text-left text-xs">Confidence</th>
                              <th className="border border-gray-300 p-2 text-left text-xs">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentResult.extractedData.slice(0, 5).map((row, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="border border-gray-300 p-2 font-medium">{row.rigNumber}</td>
                                <td className="border border-gray-300 p-2 text-sm">
                                  {row.date}
                                </td>
                                <td className="border border-gray-300 p-2 text-sm">{row.hours}</td>
                                <td className="border border-gray-300 p-2">
                                  <Badge variant={row.nbtType === 'Abroad' ? 'destructive' : 'secondary'}>
                                    {row.nbtType}
                                  </Badge>
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <Badge variant="outline" className="text-xs">
                                    {row.rateType}
                                  </Badge>
                                </td>
                                <td className="border border-gray-300 p-2 text-sm text-blue-600 font-medium">
                                  {row.extractedSystem || '-'}
                                </td>
                                <td className="border border-gray-300 p-2 text-sm">
                                  {row.extractedEquipment || '-'}
                                </td>
                                <td className="border border-gray-300 p-2">
                                  <div className="flex items-center gap-1">
                                    <div 
                                      className={`h-2 w-6 rounded ${
                                        (row.confidence || 0) > 0.8 ? 'bg-green-500' :
                                        (row.confidence || 0) > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                    />
                                    <span className="text-xs">
                                      {Math.round((row.confidence || 0) * 100)}%
                                    </span>
                                  </div>
                                </td>
                                <td className="border border-gray-300 p-2 max-w-xs truncate text-sm" title={row.description}>
                                  {row.description}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-4">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            // Export to CSV functionality
                            const csvContent = [
                              ['Date', 'Rig', 'Year', 'Month', 'Hours', 'NBT Type', 'Rate Type', 'System', 'Equipment', 'Confidence %', 'Description'],
                              ...currentResult.extractedData.map(row => [
                                row.date,
                                row.rigNumber,
                                row.year,
                                row.month,
                                row.hours,
                                row.nbtType,
                                row.rateType,
                                row.extractedSystem || '',
                                row.extractedEquipment || '',
                                Math.round((row.confidence || 0) * 100),
                                row.description.replace(/,/g, ';') // Replace commas to avoid CSV issues
                              ])
                            ].map(row => row.join(',')).join('\n');
                            
                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `extracted_npt_data_${currentResult.fileName.replace(/\.[^/.]+$/, '')}.csv`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          data-testid="button-export-csv"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export Detailed CSV
                        </Button>

                        <Button 
                          onClick={handleCreateReports}
                          disabled={createReportsMutation.isPending}
                          className="flex-1"
                          data-testid="button-create-reports"
                        >
                          {createReportsMutation.isPending ? "Creating Reports..." : 
                           `Create ${currentResult.extractedData.length} NPT Reports`}
                        </Button>
                      </div>
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
                              {new Date(upload.uploadDate).toLocaleDateString('en-GB').replace(/\//g, '-')}
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