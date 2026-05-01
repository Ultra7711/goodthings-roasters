import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/admin/ui/card';

type Props = {
  title: string;
  description: string;
  group: string;
};

export default function AdminPlaceholder({ title, description, group }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Construction className="size-10 text-muted-foreground" />
          <p className="text-sm font-medium">구현 예정</p>
          <p className="text-xs text-muted-foreground">Group {group}</p>
        </CardContent>
      </Card>
    </div>
  );
}
