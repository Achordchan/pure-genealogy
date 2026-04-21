import { FrontendShell } from "@/components/frontend-shell";

export default function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FrontendShell>{children}</FrontendShell>;
}
