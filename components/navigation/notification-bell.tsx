"use client"

import { useEffect } from "react"
import { useAccessContext, isLegacyABCOperationalContext } from "@/features/five-s/administration/access-v4-context"
import { getAuthenticatedDemoActor } from "@/lib/demo-session"
import { Bell } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useCurrentUser } from "@/lib/current-user"
import { useAdminUsers } from "@/features/five-s/administration/store"
import { evaluateActionAttention, retryActionAttention, useActionAttentionStorageError } from "@/lib/actions/action-attention-store"
import { useActionStore } from "@/lib/actions/action-store"
import { markNotificationRead, useNotifications, useNotificationStorageError, retryNotificationPersistence } from "@/lib/notifications/notification-store"

/**
 * Notification entry point. Real events (audit assigned, corrective action
 * due, etc.) land here once the Notifications feature ships — for now this
 * renders the shell with an empty state.
 */
function NotificationBell() {
  const currentUser = useCurrentUser()
  const { context, error, ready } = useAccessContext()
  const profile = getAuthenticatedDemoActor()?.user
  if (!ready || !profile || error || !isLegacyABCOperationalContext(context) || currentUser.isSuperAdmin || (!context && profile?.accessModel === "v3")) return <Button variant="ghost" size="icon" disabled aria-label="Notifications unavailable in this administration context" title="Operational notifications are unavailable in this administration context"><Bell className="size-4" /></Button>
  return <LegacyNotificationBell />
}
function LegacyNotificationBell() {
  const currentUser = useCurrentUser()
  const actions = useActionStore()
  const adminUsers = useAdminUsers()
  const notifications = useNotifications(currentUser.id)
  const notificationError = useNotificationStorageError()
  const attentionError = useActionAttentionStorageError()
  const storageError = notificationError ?? attentionError
  const unreadCount = notifications.filter((item) => !item.read).length

  useEffect(() => {
    evaluateActionAttention(actions, adminUsers)
  }, [actions, adminUsers])

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            title={storageError ? "Notification delivery paused: browser storage unavailable" : undefined}
            aria-label={storageError ? "Notifications: browser storage unavailable" : "Notifications"}
          />
        }
      >
        <Bell className="size-4" />
        {storageError && <span aria-hidden="true" className="absolute right-1 top-1 size-2 rounded-full bg-amber-500" />}
        {unreadCount > 0 && (
          <Badge
            variant="danger"
            className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
          >
            {unreadCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[calc(100dvh-4.5rem)] w-[calc(100vw-1.5rem)] max-w-80 overflow-y-auto">
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        {storageError && (
          <div role="status" className="mb-3 space-y-2 text-sm">
            <p>{storageError} Notification delivery is paused; existing records are preserved.</p>
            <Button variant="outline" size="sm" onClick={() => { retryNotificationPersistence(); retryActionAttention(actions, adminUsers) }}>Retry notifications</Button>
          </div>
        )}
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{storageError ? "Saved notifications are unavailable or empty." : "You’re all caught up."}</p>
        ) : (
          <div className="-mx-2 mt-1 max-h-80 overflow-y-auto">
            {notifications.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => markNotificationRead(item.id)}
                className="block rounded-md px-2 py-2.5 transition-colors hover:bg-muted"
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.read ? "bg-muted-foreground/30" : "bg-primary"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.message}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { NotificationBell }
