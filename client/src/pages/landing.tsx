import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="bg-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-oil-well text-2xl text-white"></i>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Drilling Data Platform</h2>
            <p className="mt-2 text-sm text-gray-600">Sign in to access your NPT reporting system</p>
          </div>
          
          <div className="mt-8">
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="w-full"
              data-testid="button-login"
            >
              Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
