import {
  Wrench,
  Users,
  Target,
  Megaphone,
  Building2,
  Rocket,
  CreditCard,
  Receipt,
  Home,
  Ruler,
  FileText,
  Database,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  wrench: Wrench,
  users: Users,
  target: Target,
  megaphone: Megaphone,
  "building-2": Building2,
  rocket: Rocket,
  "credit-card": CreditCard,
  receipt: Receipt,
  home: Home,
  ruler: Ruler,
  "file-text": FileText,
  database: Database,
};

export default function Icon({
  name,
  size = 15,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Cmp = MAP[name] || FileText;
  return <Cmp size={size} className={className} />;
}
