import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileText, BarChart3, Shield, Users, Clock } from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: <FileText className="h-5 w-5" />,
      title: "NPT Reporting",
      description: "Create and manage Non-Productive Time reports with Excel-format data entry"
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: "Analytics Dashboard",
      description: "Visualize drilling operations data with comprehensive charts and insights"
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: "Role-Based Access",
      description: "Secure access control for Tool Pushers, DS, OSE, PME, and Supervisors"
    },
    {
      icon: <Clock className="h-5 w-5" />,
      title: "Workflow Automation",
      description: "Automated approval workflows with department-based routing"
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: "Secure Platform",
      description: "Enterprise-grade security with authenticated access and data protection"
    },
    {
      icon: <CheckCircle className="h-5 w-5" />,
      title: "Intelligent Processing",
      description: "AI-powered billing sheet processing with automatic NPT classification"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="bg-primary w-10 h-10 rounded flex items-center justify-center mr-3">
                <i className="fas fa-oil-well text-white text-lg"></i>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Drilling Data Platform</h1>
            </div>
            <Badge variant="secondary">v2.0</Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 items-center">
          {/* Left Column - Login Card */}
          <div>
            <Card className="w-full max-w-md mx-auto">
              <CardHeader className="text-center pb-2">
                <div className="bg-primary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-oil-well text-3xl text-white"></i>
                </div>
                <CardTitle className="text-2xl">Welcome Back</CardTitle>
                <CardDescription>
                  Sign in to access your NPT reporting and drilling data management system
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Button 
                  onClick={() => window.location.href = '/api/login'}
                  className="w-full py-6 text-lg"
                  size="lg"
                  data-testid="button-login"
                >
                  <Shield className="mr-2 h-5 w-5" />
                  Sign In with Secure Authentication
                </Button>
                
                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    By signing in, you agree to follow company data security policies
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t">
                  <div className="text-center text-sm text-muted-foreground">
                    <p className="font-medium mb-2">Supported Roles:</p>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      <Badge variant="outline">Tool Pusher</Badge>
                      <Badge variant="outline">DS</Badge>
                      <Badge variant="outline">OSE</Badge>
                      <Badge variant="outline">PME</Badge>
                      <Badge variant="outline">Supervisor</Badge>
                      <Badge variant="outline">Admin</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Features */}
          <div className="mt-10 lg:mt-0">
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-3xl font-bold text-gray-900">
                Streamline Your Drilling Operations
              </h2>
              <p className="mt-3 text-lg text-gray-600">
                Replace Excel-based NPT reporting with our comprehensive web platform featuring intelligent automation and real-time collaboration.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow-sm border">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary">
                        {feature.icon}
                      </div>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-gray-900">{feature.title}</h3>
                      <p className="mt-1 text-xs text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="fas fa-info-circle text-blue-400 mt-0.5"></i>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">New in Version 2.0</h3>
                  <div className="mt-2 text-xs text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Automated workflow system with role-based approvals</li>
                      <li>Enhanced PDF and Excel billing sheet processing</li>
                      <li>Multi-rig user management capabilities</li>
                      <li>Advanced analytics and reporting dashboard</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 w-full bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2025 Drilling Data Platform. All rights reserved.</p>
            <p className="mt-1">For support, contact your system administrator.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
