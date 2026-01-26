'use client';

import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function NotificationsPage() {
    const {
        notifications,
        loading,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useNotifications();

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return 'bx-check-circle text-positive';
            case 'warning': return 'bx-error text-amber-500';
            case 'error': return 'bx-x-circle text-negative';
            default: return 'bx-info-circle text-blue-500';
        }
    };

    return (
        <div className="container mx-auto py-6 max-w-4xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Notificações</h1>
                    <p className="text-muted-foreground">Gerencie seus alertas e avisos do sistema.</p>
                </div>
                {unreadCount > 0 && (
                    <Button onClick={markAllAsRead} variant="outline" className="flex items-center gap-2">
                        <i className='bx bx-check-double'></i>
                        Marcar todas como lidas
                    </Button>
                )}
            </div>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <ScrollArea className="h-[calc(100vh-250px)]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <i className='bx bx-loader-alt bx-spin text-4xl text-primary mb-4'></i>
                            <p className="text-muted-foreground">Carregando notificações...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                                <i className='bx bx-bell-off text-4xl text-muted-foreground/40'></i>
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Sem notificações</h3>
                            <p className="text-muted-foreground max-w-xs">
                                Você não tem nenhuma notificação no momento. Novas mensagens aparecerão aqui.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`flex gap-4 p-6 transition-colors hover:bg-muted/30 relative group ${!notification.read ? 'bg-primary/5' : ''}`}
                                >
                                    <div className="flex-shrink-0 mt-1">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border`}>
                                            <i className={`bx ${getIcon(notification.type)} text-xl`}></i>
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0 pr-10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className={`font-semibold ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                {notification.title}
                                            </h4>
                                            {!notification.read && (
                                                <Badge variant="default" className="h-2 w-2 rounded-full p-0 min-w-0" />
                                            )}
                                        </div>
                                        <p className="text-muted-foreground text-sm mb-3">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
                                            <span className="flex items-center gap-1">
                                                <i className='bx bx-time-five'></i>
                                                {format(new Date(notification.created_at), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                            </span>
                                            {notification.link && (
                                                <Link
                                                    href={notification.link}
                                                    className="text-primary hover:underline font-medium flex items-center gap-1"
                                                >
                                                    Ver detalhes
                                                    <i className='bx bx-right-arrow-alt'></i>
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!notification.read && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                title="Marcar como lida"
                                                onClick={() => markAsRead(notification.id)}
                                            >
                                                <i className='bx bx-check'></i>
                                            </Button>
                                        )}
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            title="Excluir"
                                            onClick={() => deleteNotification(notification.id)}
                                        >
                                            <i className='bx bx-trash'></i>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </Card>
        </div>
    );
}
