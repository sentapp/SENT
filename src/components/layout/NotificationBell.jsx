import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth/AuthContext';
import {
  fetchNotificationsForMissionary,
  markAllNotificationsRead,
} from '../../lib/notificationsRepository';

function IconBell({ className, active }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? '#4CAF7D' : '#555555'}
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function IconUserPlus({ className, color }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

function IconPrayer({ className, color }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 100 3m0-3a1.5 1.5 0 110 3m0-3v6M4 20h16" />
    </svg>
  );
}

function IconCalendar({ className, color }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconMessage({ className, color }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function notifIcon(type, isRead) {
  const color = isRead ? '#888888' : '#1A6B3C';
  const cls = 'h-3.5 w-3.5';
  const t = String(type || '');
  if (t.includes('supporter')) return <IconUserPlus className={cls} color={color} />;
  if (t.includes('prayer')) return <IconPrayer className={cls} color={color} />;
  if (t.includes('meeting')) return <IconCalendar className={cls} color={color} />;
  if (t.includes('comment')) return <IconMessage className={cls} color={color} />;
  return <IconBell className={cls} active={!isRead} />;
}

function formatNotifDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const btnRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    if (!supabase || !user?.id) return;
    const rows = await fetchNotificationsForMissionary(supabase, user.id, { limit: 20 });
    setNotifications(rows);
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    if (!supabase || !user?.id) return;
    await markAllNotificationsRead(supabase, user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [user?.id]);

  const markOneRead = useCallback(async (id) => {
    if (!supabase || !user?.id) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }, [user?.id]);

  function handleNotifClick(n) {
    if (!n.is_read) void markOneRead(n.id);
    setOpen(false);
    const t = String(n.type || '');
    if (t.includes('supporter')) navigate('/missionary/contacts');
    else if (t.includes('prayer')) navigate('/missionary/overview');
    else if (t.includes('meeting')) navigate('/missionary/meetings');
    else if (t.includes('comment')) navigate('/missionary/updates');
  }

  const clearAll = useCallback(async () => {
    if (!supabase || !user?.id) return;
    await supabase.from('notifications').delete().eq('missionary_id', user.id);
    setNotifications([]);
    setOpen(false);
  }, [user?.id]);

  useEffect(() => {
    if (!supabase || !user?.id) return undefined;
    loadNotifications();

    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `missionary_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev].slice(0, 20));
        },
      )
      .subscribe();

    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', handleClick);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('click', handleClick);
    };
  }, [user?.id, loadNotifications]);

  const unread = notifications.filter((n) => !n.is_read).length;

  const toggleOpen = () => {
    const next = !open;
    if (next && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 8, left: rect.left });
    }
    setOpen(next);
    if (next && unread > 0) void markAllRead();
  };

  if (!user?.id) return null;

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="relative flex cursor-pointer items-center border-0 bg-transparent p-1"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <IconBell className="h-5 w-5" active={unread > 0} />
        {unread > 0 ? (
          <span className="absolute right-0 top-0 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#E05050] px-0.5 text-[8px] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{ top: popupPos.top, left: popupPos.left }}
          className="fixed z-[200] w-[290px] overflow-hidden rounded-xl border border-[#E0E0E0] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
          role="dialog"
          aria-label="Notifications panel"
        >
          <div className="flex items-center justify-between border-b border-[#EEEEEE] px-3.5 py-2.5">
            <span className="text-[13px] font-medium text-[#111]">Notifications</span>
            {unread > 0 || notifications.length > 0 ? (
              <div className="flex gap-2">
                {unread > 0 ? (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="cursor-pointer border-0 bg-transparent text-[10px] text-[#888]"
                  >
                    Mark all read
                  </button>
                ) : null}
                {notifications.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void clearAll()}
                    className="cursor-pointer border-0 bg-transparent text-[10px] text-[#888]"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-xs text-[#BBB]">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`border-b border-[#F5F5F5] px-3.5 py-2.5 cursor-pointer hover:bg-[#F5F5F5] ${n.is_read ? 'bg-white' : 'bg-[#F8FDF9]'}`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        n.is_read ? 'bg-[#F5F5F5]' : 'bg-[#EDFAF2]'
                      }`}
                    >
                      {notifIcon(n.type, n.is_read)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#111]">{n.title}</p>
                      {n.body ? <p className="mt-0.5 text-[11px] text-[#888]">{n.body}</p> : null}
                      <p className="mt-0.5 text-[10px] text-[#BBB]">{formatNotifDate(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
