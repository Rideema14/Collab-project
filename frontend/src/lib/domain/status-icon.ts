import {
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Inbox,
  ListTodo,
  Loader,
  OctagonAlert,
  PauseCircle,
  Rocket,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { StatusDef } from './types';

/**
 * Keyword → icon lookup, checked in order against the status name (case
 * insensitive, substring match). Lets common status names ("Backlog", "In
 * Review", "Blocked", "Done"…) get a recognisable glyph instead of a generic
 * circle, while still working for any custom name via the group fallback below.
 */
const KEYWORD_ICONS: [pattern: RegExp, icon: LucideIcon][] = [
  [/backlog/i, Inbox],
  [/block|stuck|hold|pause/i, PauseCircle],
  [/cancel|reject|wontfix|won't fix|abandon/i, XCircle],
  [/review|qa|test|approve/i, Eye],
  [/deploy|release|ship|launch/i, Rocket],
  [/progress|doing|active|wip/i, Loader],
  [/to ?do|next ?up|planned/i, ListTodo],
  [/block(ed|er)|risk|urgent|flag/i, OctagonAlert],
  [/done|complete|finish|closed|resolved/i, CheckCircle2],
];

/** Fallback icon per coarse status group, used when no keyword matches the name. */
const GROUP_ICONS: Record<StatusDef['group'], LucideIcon> = {
  not_started: Circle,
  active: Clock,
  done: CheckCircle2,
};

/** Picks a representative icon for a status — used as the board column's faint watermark. */
export function getStatusIcon(status: Pick<StatusDef, 'name' | 'group'>): LucideIcon {
  const match = KEYWORD_ICONS.find(([pattern]) => pattern.test(status.name));
  return match ? match[1] : GROUP_ICONS[status.group];
}
