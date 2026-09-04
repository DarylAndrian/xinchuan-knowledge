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
  Book,
  BookOpen,
  Library,
  Folder,
  FolderOpen,
  Archive,
  Inbox,
  Layers,
  LayoutGrid,
  Compass,
  Globe,
  Lightbulb,
  GraduationCap,
  Briefcase,
  Heart,
  Star,
  Flag,
  Bookmark,
  Tag,
  Settings,
  Shield,
  Lock,
  KeyRound,
  Bell,
  Calendar,
  Clock,
  MessageSquare,
  Mail,
  Search,
  ChartColumn,
  Wallet,
  Landmark,
  Truck,
  ShoppingCart,
  Code,
  Server,
  Cloud,
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
  book: Book,
  "book-open": BookOpen,
  library: Library,
  folder: Folder,
  "folder-open": FolderOpen,
  archive: Archive,
  inbox: Inbox,
  layers: Layers,
  "layout-grid": LayoutGrid,
  compass: Compass,
  globe: Globe,
  lightbulb: Lightbulb,
  "graduation-cap": GraduationCap,
  briefcase: Briefcase,
  heart: Heart,
  star: Star,
  flag: Flag,
  bookmark: Bookmark,
  tag: Tag,
  settings: Settings,
  shield: Shield,
  lock: Lock,
  "key-round": KeyRound,
  bell: Bell,
  calendar: Calendar,
  clock: Clock,
  "message-square": MessageSquare,
  mail: Mail,
  search: Search,
  "chart-column": ChartColumn,
  wallet: Wallet,
  landmark: Landmark,
  truck: Truck,
  "shopping-cart": ShoppingCart,
  code: Code,
  server: Server,
  cloud: Cloud,
};

/** All icon names usable in the collection/page icon picker (lucide kebab-case). */
export const ICON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "book", label: "Book" },
  { value: "book-open", label: "Book open" },
  { value: "library", label: "Library" },
  { value: "folder", label: "Folder" },
  { value: "folder-open", label: "Folder open" },
  { value: "archive", label: "Archive" },
  { value: "inbox", label: "Inbox" },
  { value: "file-text", label: "Document" },
  { value: "layers", label: "Layers" },
  { value: "layout-grid", label: "Grid" },
  { value: "database", label: "Database" },
  { value: "server", label: "Server" },
  { value: "cloud", label: "Cloud" },
  { value: "code", label: "Code" },
  { value: "wrench", label: "Wrench" },
  { value: "settings", label: "Settings" },
  { value: "ruler", label: "Ruler" },
  { value: "target", label: "Target" },
  { value: "compass", label: "Compass" },
  { value: "globe", label: "Globe" },
  { value: "lightbulb", label: "Idea" },
  { value: "graduation-cap", label: "Academy" },
  { value: "rocket", label: "Rocket" },
  { value: "home", label: "Home" },
  { value: "building-2", label: "Company" },
  { value: "briefcase", label: "Briefcase" },
  { value: "landmark", label: "Bank" },
  { value: "wallet", label: "Wallet" },
  { value: "credit-card", label: "Card" },
  { value: "receipt", label: "Receipt" },
  { value: "shopping-cart", label: "Cart" },
  { value: "truck", label: "Truck" },
  { value: "chart-column", label: "Chart" },
  { value: "users", label: "Users" },
  { value: "message-square", label: "Message" },
  { value: "megaphone", label: "Megaphone" },
  { value: "mail", label: "Mail" },
  { value: "bell", label: "Bell" },
  { value: "calendar", label: "Calendar" },
  { value: "clock", label: "Clock" },
  { value: "search", label: "Search" },
  { value: "bookmark", label: "Bookmark" },
  { value: "tag", label: "Tag" },
  { value: "flag", label: "Flag" },
  { value: "star", label: "Star" },
  { value: "heart", label: "Heart" },
  { value: "shield", label: "Shield" },
  { value: "lock", label: "Lock" },
  { value: "key-round", label: "Key" },
];

export function isKnownIcon(name: string): boolean {
  return name in MAP;
}

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

/** Grid picker for collection / page icons. Uses Lucide (lucide-react). */
export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(32px, 1fr))" }}
    >
      {ICON_OPTIONS.map((opt) => {
        const Cmp = MAP[opt.value] || FileText;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            aria-label={`Icon: ${opt.label}`}
            onClick={() => onChange(opt.value)}
            className="grid h-8 w-8 place-items-center rounded border"
            style={{
              borderColor: active ? "var(--moss)" : "var(--rule-strong)",
              background: active ? "var(--surface)" : "var(--canvas)",
              color: active ? "var(--moss)" : "var(--ink-muted)",
              cursor: "pointer",
            }}
          >
            <Cmp size={15} />
          </button>
        );
      })}
    </div>
  );
}
