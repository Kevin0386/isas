import React, { useState, useEffect } from 'react';
import { notificationAPI } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await notificationAPI.getAll();
      setNotifications(response.data);
    } catch (error) {
      toast.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'appointment_reminder':
        return 'fa-calendar-check text-green-500';
      case 'appointment_scheduled':
        return 'fa-calendar-plus text-primary';
      case 'appointment_cancelled':
        return 'fa-calendar-times text-red-500';
      case 'referral_received':
        return 'fa-file-medical text-blue-500';
      case 'referral_assigned':
        return 'fa-user-md text-yellow-500';
      default:
        return 'fa-bell text-text-muted';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-serif text-2xl text-white">Notifications</h1>
        {notifications.some(n => !n.is_read) && (
          <button
            onClick={markAllAsRead}
            className="text-primary hover:underline text-sm"
          >
            <i className="fas fa-check-double mr-1"></i>
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-6">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-bell-slash text-4xl text-text-muted mb-3"></i>
            <p className="text-text-muted">No notifications</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 border border-border rounded-lg transition-colors ${
                  !notification.is_read ? 'bg-primary/5 border-primary/30 cursor-pointer' : ''
                }`}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <i className={`fas ${getIcon(notification.type)} text-xl`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{notification.title}</h3>
                        <p className="text-sm text-text-muted mt-1">{notification.message}</p>
                      </div>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}