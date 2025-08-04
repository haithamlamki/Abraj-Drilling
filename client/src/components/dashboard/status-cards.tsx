import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardStats {
  totalReports: number;
  pendingReports: number;
  approvedReports: number;
  qualityIssues: number;
}

export default function StatusCards() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-gray-200 p-3 rounded-full w-12 h-12"></div>
                <div className="ml-4 space-y-2">
                  <div className="bg-gray-200 h-4 w-20 rounded"></div>
                  <div className="bg-gray-200 h-6 w-12 rounded"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Reports",
      value: stats?.totalReports || 0,
      icon: "fas fa-file-alt",
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      testId: "card-total-reports",
    },
    {
      title: "Pending Review",
      value: stats?.pendingReports || 0,
      icon: "fas fa-clock",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      testId: "card-pending-reports",
    },
    {
      title: "Approved",
      value: stats?.approvedReports || 0,
      icon: "fas fa-check-circle",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      testId: "card-approved-reports",
    },
    {
      title: "Quality Issues",
      value: stats?.qualityIssues || 0,
      icon: "fas fa-exclamation-triangle",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      testId: "card-quality-issues",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <Card key={card.title} data-testid={card.testId}>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className={`${card.iconBg} p-3 rounded-full`}>
                <i className={`${card.icon} ${card.iconColor}`}></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900" data-testid={`value-${card.testId}`}>
                  {card.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
