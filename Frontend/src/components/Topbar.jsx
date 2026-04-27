import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationAPI } from '../services/api';
import ThemeToggle from './ThemeToggle';

export default function Topbar() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await notificationAPI.getAll(true);
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationAPI.getUnreadCount();
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications([]);
      setUnreadCount(0);
      setShowNotifications(false);
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  const getRoleDetail = () => {
    if (user?.role === 'head_nurse' && user?.profile?.department) {
      return `Head Nurse - ${user.profile.department}`;
    }
    if (user?.role === 'specialist' && user?.profile?.specialty) {
      return `Specialist - ${user.profile.specialty}`;
    }
    return user?.role === 'head_nurse' ? 'Head Nurse' : user?.role;
  };

  return (
    <header className="sticky top-0 z-30 bg-bg-card backdrop-blur-md border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-serif text-xl text-white">
            Integrated <span className="text-primary">Specialist</span> System
          </h2>
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
            {getRoleDetail()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 rounded-lg border border-border hover:border-primary transition-colors relative"
            >
              <i className="fas fa-bell text-text-body"></i>
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-bg-card border border-border rounded-lg shadow-xl z-50">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-medium">Notifications</h3>
                    {notifications.length > 0 && (
                      <button onClick={markAllAsRead} className="text-xs text-primary hover:underline">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-text-muted py-4">No new notifications</p>
                    ) : (
                      notifications.map((notif, index) => (
                        <div key={index} className="p-3 border-b border-border hover:bg-sky-mid">
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-text-muted">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 hover:bg-sky-mid rounded-lg p-2 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-light to-primary-dark flex items-center justify-center text-white font-bold">
                {user?.full_name?.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="text-sm hidden md:block">{user?.full_name}</span>
              <i className="fas fa-chevron-down text-xs text-text-muted"></i>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-bg-card border border-border rounded-lg shadow-xl z-50">
                  <div className="p-3 border-b border-border">
                    <p className="font-medium">{user?.full_name}</p>
                    <p className="text-xs text-text-muted capitalize">
                      {user?.role === 'head_nurse' ? 'Head Nurse' : user?.role}
                    </p>
                    {user?.role === 'head_nurse' && user?.profile?.department && (
                      <p className="text-xs text-primary mt-1">{user.profile.department}</p>
                    )}
                    {user?.role === 'specialist' && user?.profile?.specialty && (
                      <p className="text-xs text-primary mt-1">{user.profile.specialty}</p>
                    )}
                  </div>
                  <Link
                    to="/notifications"
                    className="block p-3 hover:bg-sky-mid text-sm"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <i className="fas fa-bell mr-2"></i> Notifications
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left p-3 hover:bg-red-bg text-red-500 text-sm"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}