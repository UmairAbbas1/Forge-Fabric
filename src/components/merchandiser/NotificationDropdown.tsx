import { Link } from "@tanstack/react-router";
import { CheckCheck, Inbox, ArrowRight, Clock, AlertCircle, FileCheck, Tag } from "lucide-react";
import type { NotificationLog } from "../../lib/types";

interface NotificationDropdownProps {
  notifications: NotificationLog[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationDropdownProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "new_submission":
      case "submission_assigned":
        return <Inbox className="w-4 h-4 text-amber-600" />;
      case "update_request":
      case "update_request_submitted":
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case "cut_sheet_approved":
        return <FileCheck className="w-4 h-4 text-emerald-600" />;
      default:
        return <Tag className="w-4 h-4 text-sky-600" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-neutral-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-50/80 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-neutral-900">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-amber-700 font-medium transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-neutral-100">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-neutral-400">
            <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => onMarkAsRead(n.id)}
              className={`p-3.5 transition-colors cursor-pointer flex gap-3 hover:bg-neutral-50 ${
                !n.opened ? "bg-amber-50/40" : ""
              }`}
            >
              <div className="mt-0.5 flex-shrink-0 p-1.5 bg-neutral-100 rounded-lg h-fit">
                {getIcon(n.notification_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <p className={`text-xs font-medium ${!n.opened ? "text-neutral-900 font-semibold" : "text-neutral-700"}`}>
                    {n.subject}
                  </p>
                  {!n.opened && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1" />}
                </div>
                {n.body && (
                  <p className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">{n.body}</p>
                )}
                <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-1.5">
                  <Clock className="w-3 h-3" />
                  <span>{formatRelativeTime(n.sent_at)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-2.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs">
        <Link
          to="/submissions"
          onClick={onClose}
          className="text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1 hover:underline"
        >
          Submissions Inbox <ArrowRight className="w-3 h-3" />
        </Link>
        <Link
          to="/update-requests"
          onClick={onClose}
          className="text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-1 hover:underline"
        >
          Update Board <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
