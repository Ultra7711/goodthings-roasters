/* ══════════════════════════════════════════
   Admin Dashboard (/admin)
   - Group I-1 작업 전 placeholder. 진입 직후 빈 카드 + 향후 통계 배치 예정.
   ══════════════════════════════════════════ */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/admin/ui/card';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground">
          Good Things Roasters 운영 콘솔
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>오늘 주문</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              I-1 통계 그룹에서 채워질 예정.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>이번 주 매출</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              I-1 통계 그룹에서 채워질 예정.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>활성 정기배송</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              I-1 통계 그룹에서 채워질 예정.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
