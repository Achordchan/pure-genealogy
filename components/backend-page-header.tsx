import { BackendNav } from "@/components/backend-nav";

export function BackendPageHeader({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: { href: string; label: string; badgeCount?: number }[];
}) {
  return (
    <div className="mb-6 space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">后台管理</p>
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <BackendNav items={items} className="overflow-x-auto pb-1" />
    </div>
  );
}
