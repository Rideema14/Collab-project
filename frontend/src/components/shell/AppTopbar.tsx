'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Hash,
  Home,
  Inbox,
  LayoutGrid,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Sun,
  Users,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setMobileSidebarOpen, toggleCommandPalette, openTask } from '@/store/slices/uiSlice';
import {
  addSpace,
  addList,
  addWorkspace,
  DEFAULT_SPACE_ID,
  DEFAULT_STATUS_SET_ID,
} from '@/store/slices/hierarchySlice';
import { useCreateProjectMutation, useCreateTaskMutation } from '@/store/api/backendApi';
import {
  selectActiveWorkspaceId,
  selectHierarchy,
  selectLists,
  selectSpaces,
} from '@/store/selectors';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { Kbd } from '@/components/ui/Misc';
import { Magnetic } from '@/components/ui/Motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { NotificationCenter } from './NotificationCenter';
import { UserProfileMenu } from './UserProfileMenu';

export function AppTopbar() {
  const dispatch = useAppDispatch();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="glass z-dropdown flex h-14 shrink-0 items-center gap-2 rounded-2xl px-3 shadow-glass sm:px-4">
      <button
        type="button"
        onClick={() => dispatch(setMobileSidebarOpen(true))}
        aria-label="Open sidebar"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-text-muted transition-colors hover:bg-glass-border hover:text-text md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Breadcrumb />

      <button
        type="button"
        onClick={() => dispatch(toggleCommandPalette())}
        className="group ml-2 hidden h-9 items-center gap-2 rounded-xl border border-glass-border bg-glass px-3 text-sm text-text-subtle transition-colors hover:border-border-strong lg:flex lg:w-72"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        {/* Search icon-only on smaller screens */}
        <button
          type="button"
          onClick={() => dispatch(toggleCommandPalette())}
          aria-label="Search"
          className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition-colors hover:bg-glass-border hover:text-text lg:hidden"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        {/* New — create menu (task / project / space / workspace) */}
        <CreateMenu />

        <Divider />

        

        <Magnetic strength={0.25}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition-colors hover:bg-glass-border hover:text-text"
          >
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </Magnetic>

        <NotificationCenter />
        <UserProfileMenu />
      </div>
    </header>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 hidden h-6 w-px bg-glass-border sm:block" />;
}

/**
 * The "New" create menu. Each item creates a real entity: a task in the current
 * (or first) list, a backend project + client list, a client space, or a new
 * workspace — then navigates where it makes sense.
 */
function CreateMenu() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const lists = useAppSelector(selectLists);
  const spaces = useAppSelector(selectSpaces);
  const activeWsId = useAppSelector(selectActiveWorkspaceId);
  const activeListId = useAppSelector((s) => s.ui.activeListId);
  const [createProject] = useCreateProjectMutation();
  const [createTask] = useCreateTaskMutation();

  const now = () => new Date().toISOString();
  const firstSpaceId = spaces[0]?.id ?? DEFAULT_SPACE_ID;

  async function newProject(): Promise<string | null> {
    const project = await createProject({ name: 'New Project' }).unwrap().catch(() => null);
    if (!project) return null;
    const action = dispatch(
      addList({ backendProjectId: project.id, spaceId: firstSpaceId, folderId: null, name: 'New Project', createdAt: now() })
    );
    router.push(`/list/${action.payload.id}`);
    return action.payload.id;
  }

  async function newTask() {
    // Add to the list you're viewing, else the first one; if there are none, make a project first.
    const target = lists.find((l) => l.id === activeListId) ?? lists[0];
    if (!target) {
      await newProject();
      return;
    }
    const task = await createTask({
      projectId: target.backendProjectId,
      title: 'New task',
      assigneeId: null,
      dueDate: null,
    })
      .unwrap()
      .catch(() => null);
    router.push(`/list/${target.id}`);
    if (task) dispatch(openTask(task.id));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-xl bg-gradient-brand px-3 text-sm font-medium text-white shadow-glow transition-opacity hover:opacity-90 sm:flex"
        >
          <Plus className="h-4 w-4" />
          New
          <ChevronDown className="h-3.5 w-3.5 opacity-80" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        <DropdownMenuItem onSelect={() => void newTask()}>
          <CheckSquare className="h-4 w-4 text-text-subtle" /> New task
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void newProject()}>
          <Hash className="h-4 w-4 text-text-subtle" /> New project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            dispatch(
              addSpace({ workspaceId: activeWsId, name: 'New Space', statusSetId: DEFAULT_STATUS_SET_ID, createdAt: now() })
            )
          }
        >
          <Box className="h-4 w-4 text-text-subtle" /> New space
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => dispatch(addWorkspace({ name: 'New Workspace', createdAt: now() }))}>
          <LayoutGrid className="h-4 w-4 text-text-subtle" /> New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const STATIC_CRUMBS: Record<string, { label: string; icon: typeof Home }> = {
  '/home': { label: 'Home', icon: Home },
  '/inbox': { label: 'Inbox', icon: Inbox },
  '/chat': { label: 'Chat', icon: MessageSquare },
  '/people': { label: 'People', icon: Users },
};

/**
 * Live location context — workspace → current page (or space → list). Uses a
 * colored status dot for lists/spaces rather than an emoji, and real chevron
 * separators, so the bar reads like a proper app breadcrumb.
 */
function Breadcrumb() {
  const pathname = usePathname();
  const workspaces = useAppSelector(selectHierarchy).workspaces;
  const activeWsId = useAppSelector(selectActiveWorkspaceId);
  const lists = useAppSelector(selectLists);
  const spaces = useAppSelector(selectSpaces);
  const wsName = (workspaces.find((w) => w.id === activeWsId) ?? workspaces[0])?.name ?? 'Workspace';

  let trail: { label: string; dot?: string; icon?: typeof Home }[] = [];
  const listMatch = pathname.match(/^\/list\/(.+)$/);
  if (listMatch) {
    const list = lists.find((l) => l.id === listMatch[1]);
    const space = list ? spaces.find((s) => s.id === list.spaceId) : undefined;
    if (space) trail.push({ label: space.name, dot: statusColors(space.hue).solid });
    trail.push({
      label: list?.name ?? 'List',
      dot: list ? statusColors(space?.hue ?? 211).solid : undefined,
    });
  } else {
    const crumb = STATIC_CRUMBS[pathname] ?? { label: 'Home', icon: Home };
    trail = [{ label: crumb.label, icon: crumb.icon }];
  }

  const last = trail[trail.length - 1];

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="hidden max-w-[9rem] shrink-0 truncate font-medium text-text-muted md:inline">{wsName}</span>
      {trail.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-text-subtle md:inline" />
          {crumb.dot ? (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: crumb.dot }} />
          ) : crumb.icon ? (
            <crumb.icon className="h-4 w-4 shrink-0 text-text-subtle" />
          ) : null}
          <span
            className={cnCrumb(crumb === last)}
          >
            {crumb.label}
          </span>
        </span>
      ))}
    </nav>
  );
}

function cnCrumb(isLast: boolean): string {
  return isLast ? 'truncate font-semibold text-text' : 'truncate text-text-muted';
}
