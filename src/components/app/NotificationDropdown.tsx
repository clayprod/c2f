'use client';

import { useNotifications } from '@/hooks/useNotifications';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

export function NotificationDropdown() {
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        loading
    } = useNotifications();

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return 'bx-check-circle text-green-500';
            case 'warning': return 'bx-error text-amber-500';
            case 'error': return 'bx-x-circle text-red-500';
            default: return 'bx-info-circle text-blue-500';
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none">
                    <i className='bx bx-bell text-xl'></i>
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between p-4 border-b">
                    <DropdownMenuLabel className="p-0 font-semibold">Notificações</DropdownMenuLabel>
                    {unreadCount > 0 && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                markAllAsRead();
                            }}
                            className="text-xs text-primary hover:underline font-medium"
                        >
                            Ler todas
                        </button>
                    )}
                </div>

                <ScrollArea className="h-80">
                    {loading ? (
                        <div className="flex items-center justify-center min-h-[200px] p-4">
                            <i className='bx bx-loader-alt bx-spin text-2xl text-muted-foreground'></i>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center text-muted-foreground">
                            <i className='bx bx-bell-off text-3xl mb-2 opacity-20'></i>
                            <p className="text-sm">Nenhuma notificação por aqui.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`group relative flex gap-3 p-4 hover:bg-muted/50 transition-colors border-b last:border-0 ${!notification.read ? 'bg-primary/5' : ''}`}
                                    onClick={() => !notification.read && markAsRead(notification.id)}
                                >
                                    <div className="flex-shrink-0 mt-1">
                                        <i className={`bx ${getIcon(notification.type)} text-xl`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0 pr-6">
                                        <p className={`text-sm font-medium leading-none mb-1 ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {notification.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                                            {notification.message}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/60">
                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                                        </p>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteNotification(notification.id);
                                        }}
                                        className="absolute top-4 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground transition-all"
                                    >
                                        <i className='bx bx-x'></i>
                                    </button>

                                    {notification.link && (
                                        <Link
                                            href={notification.link}
                                            className="absolute inset-0"
                                            onClick={() => !notification.read && markAsRead(notification.id)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-2 border-t text-center">
                    <Link
                        href="/app/notifications"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Ver todas as notificações
                    </Link>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
