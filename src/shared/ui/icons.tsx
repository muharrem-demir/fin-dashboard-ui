/**
 * Every icon the app uses, named once.
 *
 * Components import from here rather than from `lucide-react` directly for two reasons: the icon
 * vendor is swappable without touching a screen, and the semantic aliases below (`GainIcon`,
 * `OfflineIcon`) keep meaning at the call site — a table cell should say what it means, not which
 * arrow glyph it picked.
 */
export {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  Info,
  Minus,
  Monitor,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sun,
  TrendingDown,
  TrendingUp,
  Trash2,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

export { CandlestickChart as MarketIcon, Inbox as EmptyInboxIcon } from 'lucide-react';
