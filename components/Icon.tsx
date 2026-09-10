"use client";

import { useMemo, useState } from "react";
import {
  Accessibility,
  Ambulance,
  Apple,
  Archive,
  Award,
  Banana,
  Banknote,
  BadgePercent,
  Beef,
  Beer,
  Bell,
  Bike,
  Bookmark,
  Book,
  BookOpen,
  Boxes,
  Briefcase,
  Bug,
  Building,
  Building2,
  Bus,
  BusFront,
  CableCar,
  Cake,
  CakeSlice,
  Calculator,
  Calendar,
  Camera,
  Candy,
  Car,
  Caravan,
  CarFront,
  Carrot,
  CarTaxiFront,
  ChartColumn,
  ChefHat,
  Cherry,
  CircleParking,
  Citrus,
  Clipboard,
  Clock,
  Cloud,
  CloudSun,
  Code,
  Coffee,
  Coins,
  Compass,
  Contact,
  Cookie,
  CookingPot,
  Copy,
  CreditCard,
  Croissant,
  Cpu,
  CupSoda,
  Database,
  Dessert,
  Donut,
  Download,
  Droplet,
  Drumstick,
  Egg,
  EggFried,
  Factory,
  FileCode,
  FileJson,
  FileText,
  Files,
  Film,
  Fish,
  Flag,
  Flame,
  Flower2,
  Folder,
  FolderOpen,
  Fuel,
  Gamepad2,
  Gift,
  GitBranch,
  GlassWater,
  Globe,
  GraduationCap,
  Grape,
  Ham,
  Hamburger,
  Handshake,
  Headphones,
  Heart,
  HeartHandshake,
  Highlighter,
  Home,
  Hospital,
  Hotel,
  IceCreamBowl,
  IceCreamCone,
  Image,
  Inbox,
  KeyRound,
  Landmark,
  Layers,
  LayoutGrid,
  Leaf,
  LeafyGreen,
  Library,
  Lightbulb,
  Link,
  Lock,
  Lollipop,
  Mail,
  Map,
  MapPin,
  MapPinned,
  Megaphone,
  MessageSquare,
  Milk,
  Monitor,
  Moon,
  Mountain,
  Music,
  Navigation,
  NotebookPen,
  Package,
  Palmtree,
  Paperclip,
  ParkingMeter,
  PenLine,
  Phone,
  PhoneCall,
  PiggyBank,
  Pizza,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Popcorn,
  Popsicle,
  Printer,
  Puzzle,
  Receipt,
  Rocket,
  Route,
  Ruler,
  Salad,
  Sandwich,
  School,
  Search,
  Send,
  Server,
  Settings,
  Share2,
  Shield,
  Ship,
  ShipWheel,
  ShoppingCart,
  Shrimp,
  Smartphone,
  Smile,
  Snowflake,
  Soup,
  Sparkles,
  Star,
  Store,
  Sun,
  Tablet,
  Tag,
  Target,
  Tent,
  Terminal,
  ThumbsUp,
  Ticket,
  TrafficCone,
  Train,
  TrainFront,
  Trees,
  Truck,
  TruckElectric,
  Umbrella,
  Upload,
  User,
  UserRound,
  Users,
  UsersRound,
  Utensils,
  UtensilsCrossed,
  Vegan,
  Video,
  Wallet,
  Warehouse,
  Wheat,
  Wifi,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

type IconGroup =
  | "knowledge"
  | "transport"
  | "food"
  | "business"
  | "people"
  | "communication"
  | "places"
  | "time"
  | "security"
  | "tech"
  | "nature";

type IconDef = {
  value: string;
  label: string;
  group: IconGroup;
  Cmp: LucideIcon;
};

const ICONS: IconDef[] = [
  // Knowledge
  { value: "book", label: "Book", group: "knowledge", Cmp: Book },
  { value: "book-open", label: "Book open", group: "knowledge", Cmp: BookOpen },
  { value: "library", label: "Library", group: "knowledge", Cmp: Library },
  { value: "folder", label: "Folder", group: "knowledge", Cmp: Folder },
  { value: "folder-open", label: "Folder open", group: "knowledge", Cmp: FolderOpen },
  { value: "archive", label: "Archive", group: "knowledge", Cmp: Archive },
  { value: "inbox", label: "Inbox", group: "knowledge", Cmp: Inbox },
  { value: "file-text", label: "Document", group: "knowledge", Cmp: FileText },
  { value: "files", label: "Files", group: "knowledge", Cmp: Files },
  { value: "clipboard", label: "Clipboard", group: "knowledge", Cmp: Clipboard },
  { value: "notebook-pen", label: "Notebook", group: "knowledge", Cmp: NotebookPen },
  { value: "layers", label: "Layers", group: "knowledge", Cmp: Layers },
  { value: "layout-grid", label: "Grid", group: "knowledge", Cmp: LayoutGrid },
  { value: "bookmark", label: "Bookmark", group: "knowledge", Cmp: Bookmark },
  { value: "tag", label: "Tag", group: "knowledge", Cmp: Tag },
  { value: "lightbulb", label: "Idea", group: "knowledge", Cmp: Lightbulb },
  { value: "graduation-cap", label: "Academy", group: "knowledge", Cmp: GraduationCap },
  { value: "ruler", label: "Ruler", group: "knowledge", Cmp: Ruler },

  // Transport — taxi first so it's easy to find
  { value: "car-taxi-front", label: "Taxi", group: "transport", Cmp: CarTaxiFront },
  { value: "car", label: "Car", group: "transport", Cmp: Car },
  { value: "car-front", label: "Car front", group: "transport", Cmp: CarFront },
  { value: "bus", label: "Bus", group: "transport", Cmp: Bus },
  { value: "bus-front", label: "Bus front", group: "transport", Cmp: BusFront },
  { value: "truck", label: "Truck", group: "transport", Cmp: Truck },
  { value: "truck-electric", label: "Electric truck", group: "transport", Cmp: TruckElectric },
  { value: "bike", label: "Bike", group: "transport", Cmp: Bike },
  { value: "ambulance", label: "Ambulance", group: "transport", Cmp: Ambulance },
  { value: "train", label: "Train", group: "transport", Cmp: Train },
  { value: "train-front", label: "Train front", group: "transport", Cmp: TrainFront },
  { value: "plane", label: "Plane", group: "transport", Cmp: Plane },
  { value: "plane-takeoff", label: "Takeoff", group: "transport", Cmp: PlaneTakeoff },
  { value: "plane-landing", label: "Landing", group: "transport", Cmp: PlaneLanding },
  { value: "ship", label: "Ship", group: "transport", Cmp: Ship },
  { value: "ship-wheel", label: "Helm", group: "transport", Cmp: ShipWheel },
  { value: "cable-car", label: "Cable car", group: "transport", Cmp: CableCar },
  { value: "caravan", label: "Caravan", group: "transport", Cmp: Caravan },
  { value: "fuel", label: "Fuel", group: "transport", Cmp: Fuel },
  { value: "map", label: "Map", group: "transport", Cmp: Map },
  { value: "map-pin", label: "Map pin", group: "transport", Cmp: MapPin },
  { value: "map-pinned", label: "Pinned", group: "transport", Cmp: MapPinned },
  { value: "navigation", label: "Navigate", group: "transport", Cmp: Navigation },
  { value: "route", label: "Route", group: "transport", Cmp: Route },
  { value: "traffic-cone", label: "Traffic cone", group: "transport", Cmp: TrafficCone },
  { value: "circle-parking", label: "Parking", group: "transport", Cmp: CircleParking },
  { value: "parking-meter", label: "Parking meter", group: "transport", Cmp: ParkingMeter },
  { value: "ticket", label: "Ticket", group: "transport", Cmp: Ticket },

  // Food
  { value: "utensils", label: "Food", group: "food", Cmp: Utensils },
  { value: "utensils-crossed", label: "Dining", group: "food", Cmp: UtensilsCrossed },
  { value: "cooking-pot", label: "Cooking", group: "food", Cmp: CookingPot },
  { value: "chef-hat", label: "Chef", group: "food", Cmp: ChefHat },
  { value: "pizza", label: "Pizza", group: "food", Cmp: Pizza },
  { value: "hamburger", label: "Burger", group: "food", Cmp: Hamburger },
  { value: "sandwich", label: "Sandwich", group: "food", Cmp: Sandwich },
  { value: "salad", label: "Salad", group: "food", Cmp: Salad },
  { value: "soup", label: "Soup", group: "food", Cmp: Soup },
  { value: "coffee", label: "Coffee", group: "food", Cmp: Coffee },
  { value: "cup-soda", label: "Soda", group: "food", Cmp: CupSoda },
  { value: "wine", label: "Wine", group: "food", Cmp: Wine },
  { value: "beer", label: "Beer", group: "food", Cmp: Beer },
  { value: "glass-water", label: "Water", group: "food", Cmp: GlassWater },
  { value: "ice-cream-cone", label: "Ice cream", group: "food", Cmp: IceCreamCone },
  { value: "ice-cream-bowl", label: "Sundae", group: "food", Cmp: IceCreamBowl },
  { value: "apple", label: "Apple", group: "food", Cmp: Apple },
  { value: "banana", label: "Banana", group: "food", Cmp: Banana },
  { value: "cherry", label: "Cherry", group: "food", Cmp: Cherry },
  { value: "grape", label: "Grape", group: "food", Cmp: Grape },
  { value: "citrus", label: "Citrus", group: "food", Cmp: Citrus },
  { value: "carrot", label: "Carrot", group: "food", Cmp: Carrot },
  { value: "beef", label: "Beef", group: "food", Cmp: Beef },
  { value: "fish", label: "Fish", group: "food", Cmp: Fish },
  { value: "shrimp", label: "Shrimp", group: "food", Cmp: Shrimp },
  { value: "ham", label: "Ham", group: "food", Cmp: Ham },
  { value: "drumstick", label: "Drumstick", group: "food", Cmp: Drumstick },
  { value: "egg", label: "Egg", group: "food", Cmp: Egg },
  { value: "egg-fried", label: "Fried egg", group: "food", Cmp: EggFried },
  { value: "cake", label: "Cake", group: "food", Cmp: Cake },
  { value: "cake-slice", label: "Cake slice", group: "food", Cmp: CakeSlice },
  { value: "cookie", label: "Cookie", group: "food", Cmp: Cookie },
  { value: "donut", label: "Donut", group: "food", Cmp: Donut },
  { value: "dessert", label: "Dessert", group: "food", Cmp: Dessert },
  { value: "popsicle", label: "Popsicle", group: "food", Cmp: Popsicle },
  { value: "popcorn", label: "Popcorn", group: "food", Cmp: Popcorn },
  { value: "lollipop", label: "Lollipop", group: "food", Cmp: Lollipop },
  { value: "candy", label: "Candy", group: "food", Cmp: Candy },
  { value: "croissant", label: "Croissant", group: "food", Cmp: Croissant },
  { value: "milk", label: "Milk", group: "food", Cmp: Milk },
  { value: "wheat", label: "Wheat", group: "food", Cmp: Wheat },
  { value: "leafy-green", label: "Greens", group: "food", Cmp: LeafyGreen },
  { value: "vegan", label: "Vegan", group: "food", Cmp: Vegan },

  // Business
  { value: "briefcase", label: "Briefcase", group: "business", Cmp: Briefcase },
  { value: "building-2", label: "Company", group: "business", Cmp: Building2 },
  { value: "store", label: "Store", group: "business", Cmp: Store },
  { value: "shopping-cart", label: "Cart", group: "business", Cmp: ShoppingCart },
  { value: "package", label: "Package", group: "business", Cmp: Package },
  { value: "boxes", label: "Boxes", group: "business", Cmp: Boxes },
  { value: "wallet", label: "Wallet", group: "business", Cmp: Wallet },
  { value: "credit-card", label: "Card", group: "business", Cmp: CreditCard },
  { value: "receipt", label: "Receipt", group: "business", Cmp: Receipt },
  { value: "landmark", label: "Bank", group: "business", Cmp: Landmark },
  { value: "banknote", label: "Banknote", group: "business", Cmp: Banknote },
  { value: "coins", label: "Coins", group: "business", Cmp: Coins },
  { value: "piggy-bank", label: "Savings", group: "business", Cmp: PiggyBank },
  { value: "badge-percent", label: "Percent", group: "business", Cmp: BadgePercent },
  { value: "calculator", label: "Calculator", group: "business", Cmp: Calculator },
  { value: "chart-column", label: "Chart", group: "business", Cmp: ChartColumn },
  { value: "handshake", label: "Handshake", group: "business", Cmp: Handshake },
  { value: "rocket", label: "Rocket", group: "business", Cmp: Rocket },
  { value: "target", label: "Target", group: "business", Cmp: Target },

  // People
  { value: "users", label: "Users", group: "people", Cmp: Users },
  { value: "users-round", label: "Team", group: "people", Cmp: UsersRound },
  { value: "user", label: "User", group: "people", Cmp: User },
  { value: "user-round", label: "Person", group: "people", Cmp: UserRound },
  { value: "contact", label: "Contact", group: "people", Cmp: Contact },
  { value: "smile", label: "Smile", group: "people", Cmp: Smile },
  { value: "thumbs-up", label: "Thumbs up", group: "people", Cmp: ThumbsUp },
  { value: "heart", label: "Heart", group: "people", Cmp: Heart },
  { value: "heart-handshake", label: "Care", group: "people", Cmp: HeartHandshake },
  { value: "star", label: "Star", group: "people", Cmp: Star },
  { value: "award", label: "Award", group: "people", Cmp: Award },
  { value: "accessibility", label: "Accessibility", group: "people", Cmp: Accessibility },
  { value: "flag", label: "Flag", group: "people", Cmp: Flag },

  // Communication
  { value: "message-square", label: "Message", group: "communication", Cmp: MessageSquare },
  { value: "megaphone", label: "Megaphone", group: "communication", Cmp: Megaphone },
  { value: "mail", label: "Mail", group: "communication", Cmp: Mail },
  { value: "phone", label: "Phone", group: "communication", Cmp: Phone },
  { value: "phone-call", label: "Call", group: "communication", Cmp: PhoneCall },
  { value: "video", label: "Video", group: "communication", Cmp: Video },
  { value: "headphones", label: "Headphones", group: "communication", Cmp: Headphones },
  { value: "send", label: "Send", group: "communication", Cmp: Send },
  { value: "share-2", label: "Share", group: "communication", Cmp: Share2 },
  { value: "bell", label: "Bell", group: "communication", Cmp: Bell },

  // Places
  { value: "home", label: "Home", group: "places", Cmp: Home },
  { value: "building", label: "Building", group: "places", Cmp: Building },
  { value: "factory", label: "Factory", group: "places", Cmp: Factory },
  { value: "hospital", label: "Hospital", group: "places", Cmp: Hospital },
  { value: "school", label: "School", group: "places", Cmp: School },
  { value: "hotel", label: "Hotel", group: "places", Cmp: Hotel },
  { value: "warehouse", label: "Warehouse", group: "places", Cmp: Warehouse },
  { value: "tent", label: "Tent", group: "places", Cmp: Tent },
  { value: "palmtree", label: "Palm", group: "places", Cmp: Palmtree },
  { value: "globe", label: "Globe", group: "places", Cmp: Globe },
  { value: "compass", label: "Compass", group: "places", Cmp: Compass },

  // Time
  { value: "calendar", label: "Calendar", group: "time", Cmp: Calendar },
  { value: "clock", label: "Clock", group: "time", Cmp: Clock },

  // Security
  { value: "shield", label: "Shield", group: "security", Cmp: Shield },
  { value: "lock", label: "Lock", group: "security", Cmp: Lock },
  { value: "key-round", label: "Key", group: "security", Cmp: KeyRound },
  { value: "settings", label: "Settings", group: "security", Cmp: Settings },
  { value: "wrench", label: "Wrench", group: "security", Cmp: Wrench },

  // Tech
  { value: "database", label: "Database", group: "tech", Cmp: Database },
  { value: "server", label: "Server", group: "tech", Cmp: Server },
  { value: "cloud", label: "Cloud", group: "tech", Cmp: Cloud },
  { value: "code", label: "Code", group: "tech", Cmp: Code },
  { value: "file-code", label: "File code", group: "tech", Cmp: FileCode },
  { value: "file-json", label: "JSON", group: "tech", Cmp: FileJson },
  { value: "terminal", label: "Terminal", group: "tech", Cmp: Terminal },
  { value: "cpu", label: "CPU", group: "tech", Cmp: Cpu },
  { value: "monitor", label: "Monitor", group: "tech", Cmp: Monitor },
  { value: "smartphone", label: "Phone device", group: "tech", Cmp: Smartphone },
  { value: "tablet", label: "Tablet", group: "tech", Cmp: Tablet },
  { value: "wifi", label: "Wi‑Fi", group: "tech", Cmp: Wifi },
  { value: "bug", label: "Bug", group: "tech", Cmp: Bug },
  { value: "git-branch", label: "Git", group: "tech", Cmp: GitBranch },
  { value: "image", label: "Image", group: "tech", Cmp: Image },
  { value: "camera", label: "Camera", group: "tech", Cmp: Camera },
  { value: "printer", label: "Printer", group: "tech", Cmp: Printer },
  { value: "paperclip", label: "Attachment", group: "tech", Cmp: Paperclip },
  { value: "link", label: "Link", group: "tech", Cmp: Link },
  { value: "download", label: "Download", group: "tech", Cmp: Download },
  { value: "upload", label: "Upload", group: "tech", Cmp: Upload },
  { value: "copy", label: "Copy", group: "tech", Cmp: Copy },
  { value: "pen-line", label: "Pen", group: "tech", Cmp: PenLine },
  { value: "highlighter", label: "Highlight", group: "tech", Cmp: Highlighter },
  { value: "search", label: "Search", group: "tech", Cmp: Search },

  // Nature / extras
  { value: "leaf", label: "Leaf", group: "nature", Cmp: Leaf },
  { value: "sun", label: "Sun", group: "nature", Cmp: Sun },
  { value: "moon", label: "Moon", group: "nature", Cmp: Moon },
  { value: "cloud-sun", label: "Weather", group: "nature", Cmp: CloudSun },
  { value: "flame", label: "Flame", group: "nature", Cmp: Flame },
  { value: "zap", label: "Zap", group: "nature", Cmp: Zap },
  { value: "droplet", label: "Drop", group: "nature", Cmp: Droplet },
  { value: "snowflake", label: "Snow", group: "nature", Cmp: Snowflake },
  { value: "mountain", label: "Mountain", group: "nature", Cmp: Mountain },
  { value: "trees", label: "Trees", group: "nature", Cmp: Trees },
  { value: "flower-2", label: "Flower", group: "nature", Cmp: Flower2 },
  { value: "umbrella", label: "Umbrella", group: "nature", Cmp: Umbrella },
  { value: "sparkles", label: "Sparkles", group: "nature", Cmp: Sparkles },
  { value: "gift", label: "Gift", group: "nature", Cmp: Gift },
  { value: "puzzle", label: "Puzzle", group: "nature", Cmp: Puzzle },
  { value: "gamepad-2", label: "Games", group: "nature", Cmp: Gamepad2 },
  { value: "music", label: "Music", group: "nature", Cmp: Music },
  { value: "film", label: "Film", group: "nature", Cmp: Film },
];

const MAP: Record<string, LucideIcon> = Object.fromEntries(ICONS.map((i) => [i.value, i.Cmp]));

const GROUP_SEARCH: Record<IconGroup, string> = {
  knowledge: "knowledge docs wiki notes",
  transport: "taxi cab ride travel transport car bus",
  food: "food dining eat restaurant meal drink",
  business: "business money finance sales",
  people: "people team user person",
  communication: "comms chat phone mail",
  places: "places location building",
  time: "time calendar clock",
  security: "security tools lock settings",
  tech: "tech code computer",
  nature: "nature weather extra",
};

const GROUPS: Array<{ id: IconGroup | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "transport", label: "Taxi & travel" },
  { id: "food", label: "Food" },
  { id: "knowledge", label: "Knowledge" },
  { id: "business", label: "Business" },
  { id: "people", label: "People" },
  { id: "communication", label: "Comms" },
  { id: "places", label: "Places" },
  { id: "tech", label: "Tech" },
  { id: "security", label: "Tools" },
  { id: "time", label: "Time" },
  { id: "nature", label: "More" },
];

/** All icon names usable in the collection/page icon picker (lucide kebab-case). */
export const ICON_OPTIONS: Array<{ value: string; label: string; group: string }> = ICONS.map(
  ({ value, label, group }) => ({ value, label, group })
);

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
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<IconGroup | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ICONS.filter((opt) => {
      if (group !== "all" && opt.group !== group) return false;
      if (!q) return true;
      return (
        opt.label.toLowerCase().includes(q) ||
        opt.value.includes(q) ||
        opt.group.includes(q) ||
        GROUP_SEARCH[opt.group].includes(q)
      );
    });
  }, [query, group]);

  const selected = ICONS.find((i) => i.value === value);

  return (
    <div className="icon-picker">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search icons… e.g. taxi, food"
        aria-label="Search icons"
        className="icon-picker-search"
      />
      <div className="icon-picker-groups" role="tablist" aria-label="Icon categories">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={group === g.id}
            className={group === g.id ? "is-active" : ""}
            onClick={() => setGroup(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div
        className="grid gap-1 icon-picker-grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(32px, 1fr))" }}
      >
        {filtered.map((opt) => {
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
              <opt.Cmp size={15} />
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="icon-picker-empty">No icons match “{query}”.</div>
      )}
      <div className="icon-picker-selected">
        {selected ? (
          <>
            <selected.Cmp size={13} /> {selected.label}
            <span>({selected.value})</span>
          </>
        ) : (
          value || "No icon"
        )}
      </div>
    </div>
  );
}
