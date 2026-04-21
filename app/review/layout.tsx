import { FrontendShell } from "@/components/frontend-shell";

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FrontendShell>{children}</FrontendShell>;
}
