'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AtSign, Hash, Megaphone, Pin, PinOff, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useGetUsersQuery } from '@/store/api/backendApi';
import {
  selectActiveChannelId,
  selectChatChannels,
  selectChatMessages,
  selectSessionUser,
} from '@/store/selectors';
import {
  addChannel,
  openDm,
  sendMessage,
  setActiveChannel,
  setPinned,
  deleteMessage,
  dmChannelId,
} from '@/store/slices/chatSlice';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { Avatar } from '@/components/domain/AvatarStack';
import type { ChatMessage } from '@/store/slices/chatSlice';

/**
 * Team chat — group channels, private direct messages, and broadcast announcements
 * (posted to every group channel at once). Client-persisted and synced over the
 * realtime bus. Fully theme-token styled.
 */
export function ChatView() {
  const dispatch = useAppDispatch();
  const channels = useAppSelector(selectChatChannels);
  const activeId = useAppSelector(selectActiveChannelId);
  const messages = useAppSelector(selectChatMessages(activeId));
  const user = useAppSelector(selectSessionUser);
  const { data: users } = useGetUsersQuery();

  const activeChannel = channels.find((c) => c.id === activeId) ?? channels[0];
  const groupChannels = channels.filter((c) => c.kind === 'channel');
  const people = (users ?? []).filter((u) => u.id !== user?.id);

  const [draft, setDraft] = useState('');
  const [addingChannel, setAddingChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [announceOpen, setAnnounceOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevChannel = useRef(activeId);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Jump instantly when switching channels; glide smoothly for new messages.
    const switched = prevChannel.current !== activeId;
    prevChannel.current = activeId;
    el.scrollTo({ top: el.scrollHeight, behavior: switched ? 'auto' : 'smooth' });
  }, [messages.length, activeId]);

  const groups = useMemo(() => groupMessages(messages), [messages]);
  const pinned = useMemo(() => messages.filter((m) => m.pinned), [messages]);

  const togglePin = (m: ChatMessage) =>
    dispatch(setPinned({ channelId: activeId, messageId: m.id, pinned: !m.pinned }));
  const removeMessage = (m: ChatMessage) => dispatch(deleteMessage({ channelId: activeId, messageId: m.id }));

  function send() {
    const body = draft.trim();
    if (!body || !user) return;
    dispatch(sendMessage({ channelId: activeId, authorId: user.id, authorName: user.name, body, createdAt: new Date().toISOString() }));
    setDraft('');
  }

  function createChannel() {
    const name = channelName.trim();
    if (name) dispatch(addChannel({ name, createdAt: new Date().toISOString() }));
    setChannelName('');
    setAddingChannel(false);
  }

  const isDm = activeChannel?.kind === 'dm';

  return (
    <div className="flex h-full min-h-0">
      {/* Channel rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-muted/40 sm:flex">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-base font-semibold text-text">Chat</h1>
          <button
            type="button"
            aria-label="New channel"
            onClick={() => setAddingChannel(true)}
            className="grid h-6 w-6 place-items-center rounded-md text-text-subtle transition-colors hover:bg-glass-border hover:text-text"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {/* Announcement */}
          <button
            type="button"
            onClick={() => setAnnounceOpen(true)}
            className="mb-2 flex w-full items-center gap-2 rounded-lg border border-[color:var(--color-primary)]/25 bg-primary-soft px-2.5 py-2 text-sm font-medium text-primary transition-opacity hover:opacity-90"
          >
            <Megaphone className="h-4 w-4" /> Announcement
          </button>

          {/* Channels */}
          <Section label="Channels" />
          {groupChannels.map((ch) => (
            <RailButton
              key={ch.id}
              active={ch.id === activeId}
              onClick={() => dispatch(setActiveChannel(ch.id))}
              leading={<Hash className="h-4 w-4 shrink-0 opacity-70" />}
              label={ch.name}
            />
          ))}
          {addingChannel && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createChannel();
              }}
              className="px-1 py-1"
            >
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                onBlur={() => (channelName.trim() ? createChannel() : setAddingChannel(false))}
                placeholder="channel-name"
                className="h-8 w-full rounded-md border border-primary bg-surface px-2 text-sm text-text outline-none"
              />
            </form>
          )}

          {/* Direct messages */}
          <Section label="Direct messages" />
          {people.length === 0 && <p className="px-2 py-1 text-xs text-text-subtle">No teammates yet</p>}
          {people.map((p) => {
            const dmId = user ? dmChannelId(user.id, p.id) : '';
            return (
              <RailButton
                key={p.id}
                active={dmId === activeId}
                onClick={() =>
                  user && dispatch(openDm({ selfId: user.id, otherId: p.id, otherName: p.name, createdAt: new Date().toISOString() }))
                }
                leading={<Avatar person={p} size={20} />}
                label={p.name}
              />
            );
          })}
        </div>
      </aside>

      {/* Thread */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-5">
          {isDm ? (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-glass-border text-[11px] font-semibold text-text-muted">
              {initials(activeChannel?.name ?? '?')}
            </span>
          ) : (
            <Hash className="h-4 w-4 text-text-subtle" />
          )}
          <h2 className="font-semibold text-text">{activeChannel?.name}</h2>
          <span className="text-xs text-text-subtle">
            · {isDm ? 'private' : `${messages.length} messages`}
          </span>
        </header>

        {/* Pinned strip */}
        {pinned.length > 0 && (
          <div className="shrink-0 border-b border-border bg-surface-muted/50 px-5 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
              <Pin className="h-3 w-3" /> Pinned · {pinned.length}
            </div>
            <div className="space-y-1">
              {pinned.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <span className="shrink-0 font-medium text-text">{m.authorName}:</span>
                  <span className="min-w-0 flex-1 truncate text-text-muted">{m.body}</span>
                  <button
                    type="button"
                    aria-label="Unpin"
                    onClick={() => togglePin(m)}
                    className="shrink-0 text-text-subtle transition-colors hover:text-text"
                  >
                    <PinOff className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {groups.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="text-sm font-medium text-text">No messages yet</p>
                <p className="mt-1 text-xs text-text-subtle">
                  {isDm ? `Start a private chat with ${activeChannel?.name}.` : `Say hello in #${activeChannel?.name}.`}
                </p>
              </div>
            </div>
          ) : (
            groups.map((g) =>
              g.isAnnouncement ? (
                <div
                  key={g.id}
                  className="flex animate-fade-in items-start gap-2.5 rounded-xl border border-[color:var(--color-primary)]/25 bg-primary-soft px-3 py-2.5"
                >
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">Announcement</span>
                      <span className="text-[11px] text-text-subtle">
                        {g.authorName} · {relativeTime(g.createdAt)}
                      </span>
                    </div>
                    {g.messages.map((m) => (
                      <MessageRow
                        key={m.id}
                        message={m}
                        canDelete={user?.id === m.authorId}
                        onPin={() => togglePin(m)}
                        onDelete={() => removeMessage(m)}
                        bodyClass="text-text"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div key={g.id} className="flex animate-fade-in gap-3">
                  <Avatar person={{ id: g.authorId, name: g.authorName }} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-text">{g.authorName}</span>
                      <span className="text-[11px] text-text-subtle">{relativeTime(g.createdAt)}</span>
                      {user?.id === g.authorId && (
                        <span className="rounded bg-primary-soft px-1.5 text-[10px] font-medium text-primary">you</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {g.messages.map((m) => (
                        <MessageRow
                          key={m.id}
                          message={m}
                          canDelete={user?.id === m.authorId}
                          onPin={() => togglePin(m)}
                          onDelete={() => removeMessage(m)}
                          bodyClass="text-text-muted"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-surface px-3 py-2 focus-within:border-primary">
            <RecipientPicker />
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={isDm ? `Message ${activeChannel?.name}` : `Message #${activeChannel?.name}`}
              className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim()}
              aria-label="Send message"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-brand text-primary-fg shadow-glow transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 px-1 text-[11px] text-text-subtle">Enter to send · Shift+Enter for a new line</p>
        </div>
      </section>

      {announceOpen && <AnnounceModal onClose={() => setAnnounceOpen(false)} />}
    </div>
  );
}

/** Compose an announcement broadcast to every group channel. */
function AnnounceModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const channels = useAppSelector(selectChatChannels);
  const user = useAppSelector(selectSessionUser);
  const [body, setBody] = useState('');
  const groupChannels = channels.filter((c) => c.kind === 'channel');

  function broadcast() {
    const text = body.trim();
    if (!text || !user) return;
    const createdAt = new Date().toISOString();
    for (const ch of groupChannels) {
      dispatch(
        sendMessage({ channelId: ch.id, authorId: user.id, authorName: user.name, body: text, createdAt, isAnnouncement: true })
      );
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-modal grid place-items-center bg-overlay p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface-raised p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
            <Megaphone className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text">New announcement</h3>
            <p className="text-xs text-text-subtle">Sent to all {groupChannels.length} channels.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-text-subtle hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <textarea
          autoFocus
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share an update with the whole team…"
          className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-glass-border">
            Cancel
          </button>
          <button
            type="button"
            onClick={broadcast}
            disabled={!body.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-1.5 text-sm font-medium text-primary-fg shadow-glow transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Megaphone className="h-4 w-4" /> Send to everyone
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Composer "left corner" recipient picker — search a teammate by name or email and
 * jump straight into a private DM with them, ready to type your message.
 */
function RecipientPicker() {
  const dispatch = useAppDispatch();
  const { data: users } = useGetUsersQuery();
  const user = useAppSelector(selectSessionUser);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const people = (users ?? []).filter((u) => u.id !== user?.id);
  const query = q.trim().toLowerCase();
  const filtered = query
    ? people.filter((p) => p.name.toLowerCase().includes(query) || p.email.toLowerCase().includes(query))
    : people;

  function pick(person: { id: number; name: string }) {
    if (user) {
      dispatch(openDm({ selfId: user.id, otherId: person.id, otherName: person.name, createdAt: new Date().toISOString() }));
    }
    setOpen(false);
    setQ('');
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Direct message a teammate"
        title="Direct message"
        className={cn(
          'grid h-8 w-8 place-items-center rounded-lg transition-colors',
          open ? 'bg-primary-selected text-primary-on-selected' : 'text-text-subtle hover:bg-surface-muted hover:text-text'
        )}
      >
        <AtSign className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-dropdown" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-dropdown mb-2 w-72 rounded-xl border border-border bg-surface-raised p-2 shadow-lg">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
              <Search className="h-4 w-4 shrink-0 text-text-subtle" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or email…"
                className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
              />
            </div>
            <div className="mt-1 max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-text-subtle">No people found</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-glass-border"
                  >
                    <Avatar person={p} size={28} />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text">{p.name}</p>
                      <p className="truncate text-xs text-text-subtle">{p.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ label }: { label: string }) {
  return <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">{label}</p>;
}

function RailButton({
  active,
  onClick,
  leading,
  label,
}: {
  active: boolean;
  onClick: () => void;
  leading: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
        active ? 'bg-primary-selected font-medium text-primary-on-selected' : 'text-text-muted hover:bg-surface-muted hover:text-text'
      )}
    >
      {leading}
      <span className="truncate">{label}</span>
    </button>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** A single message line with hover pin/delete actions and a pinned marker. */
function MessageRow({
  message,
  canDelete,
  onPin,
  onDelete,
  bodyClass,
}: {
  message: ChatMessage;
  canDelete: boolean;
  onPin: () => void;
  onDelete: () => void;
  bodyClass: string;
}) {
  return (
    <div className="group/msg -mx-2 flex items-start gap-2 rounded-md px-2 transition-colors hover:bg-glass-border/40">
      <p className={cn('min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed', bodyClass)}>
        {message.pinned && <Pin className="mr-1 inline h-3 w-3 -translate-y-px text-primary" />}
        {message.body}
      </p>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
        <button
          type="button"
          aria-label={message.pinned ? 'Unpin message' : 'Pin message'}
          onClick={onPin}
          className={cn(
            'grid h-6 w-6 place-items-center rounded transition-colors hover:bg-glass-border hover:text-text',
            message.pinned ? 'text-primary' : 'text-text-subtle'
          )}
        >
          {message.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
        {canDelete && (
          <button
            type="button"
            aria-label="Delete message"
            onClick={onDelete}
            className="grid h-6 w-6 place-items-center rounded text-text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

interface MessageGroup {
  id: string;
  authorId: number;
  authorName: string;
  createdAt: string;
  messages: ChatMessage[];
  isAnnouncement: boolean;
}

/** Collapse consecutive same-author messages (within ~5 min) into one block. */
function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    const sameRun =
      last &&
      !last.isAnnouncement &&
      !m.isAnnouncement &&
      last.authorId === m.authorId &&
      new Date(m.createdAt).getTime() - new Date(last.createdAt).getTime() < 5 * 60 * 1000;
    if (sameRun) last.messages.push(m);
    else
      groups.push({
        id: m.id,
        authorId: m.authorId,
        authorName: m.authorName,
        createdAt: m.createdAt,
        messages: [m],
        isAnnouncement: Boolean(m.isAnnouncement),
      });
  }
  return groups;
}
