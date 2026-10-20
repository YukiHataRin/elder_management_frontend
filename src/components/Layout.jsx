import { Link, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { Bell, Clock, HeartHandshake, KeyRound, Users, ClipboardList, Trophy, Settings, LogOut, X, FileText, Megaphone, MessagesSquare, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { managementApi } from '../api/management';
import { managerNotificationsApi } from '../api/managerNotifications';

const careOutreachEnabled = import.meta.env.VITE_CARE_OUTREACH_ENABLED === 'true';

const Layout = ({ children }) => {
    const location = useLocation();
    const { user, isAdmin, isPending, logout } = useAuth();
    const { showToast } = useToast();
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [notificationUnread, setNotificationUnread] = useState(0);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        try {
            return window.localStorage.getItem('elder-sidebar-collapsed') === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem('elder-sidebar-collapsed', String(isSidebarCollapsed));
        } catch {
            // The sidebar still works when browser storage is unavailable.
        }
    }, [isSidebarCollapsed]);

    useEffect(() => {
        setIsMobileSidebarOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!isMobileSidebarOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setIsMobileSidebarOpen(false);
        };
        const handleResize = () => {
            if (window.innerWidth >= 768) setIsMobileSidebarOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleResize);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleResize);
        };
    }, [isMobileSidebarOpen]);

    const refreshNotificationCount = useCallback(async () => {
        if (![1, 2].includes(user?.role_id)) return;
        try {
            const result = await managerNotificationsApi.getUnreadCount();
            setNotificationUnread(result.unread || 0);
        } catch {
            // The notification page will show a detailed error when opened.
        }
    }, [user?.role_id]);

    useEffect(() => {
        refreshNotificationCount();
        const timer = window.setInterval(refreshNotificationCount, 60000);
        window.addEventListener('manager-notifications-updated', refreshNotificationCount);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('manager-notifications-updated', refreshNotificationCount);
        };
    }, [refreshNotificationCount]);

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (!passwordForm.password) return showToast('請輸入新密碼', 'error');
        if (passwordForm.password !== passwordForm.confirm) return showToast('兩次輸入的密碼不一致', 'error');

        setIsUpdatingPassword(true);
        try {
            await managementApi.updateMyPassword(passwordForm.password);
            showToast('密碼已更新', 'success');
            setPasswordForm({ password: '', confirm: '' });
            setShowPasswordModal(false);
        } catch (error) {
            showToast('密碼更新失敗: ' + error.message, 'error');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    // 如果是待審核角色 (Role 5)，顯示專屬提示頁面，不顯示選單
    if (isPending) {
        return (
            <div className="min-h-screen bg-sky-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-sky-100">
                    <div className="mx-auto h-20 w-20 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-6">
                        <Clock size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-primary mb-2">帳號審核中</h2>
                    <p className="text-text/60 mb-8">
                        您的帳號 (ID: {user?.username}) 尚未通過審核。<br />
                        請聯繫系統管理員為您指派角色（管理員或個管師）。
                    </p>
                    <button 
                        onClick={logout}
                        className="w-full py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center space-x-2"
                    >
                        <LogOut size={20} />
                        <span>切換帳號登出</span>
                    </button>
                </div>
            </div>
        );
    }

    const navItems = [
        { path: '/patients', label: '個案管理', icon: <Users size={20} /> },
        { path: '/notifications', label: '通知中心', icon: <Bell size={20} />, badge: notificationUnread },
        { path: '/push-campaigns', label: '推播訊息', icon: <Megaphone size={20} /> },
        ...(careOutreachEnabled ? [{ path: '/care-outreach', label: '關懷案件', icon: <HeartHandshake size={20} /> }] : []),
        { path: '/chats', label: 'AI 對話紀錄', icon: <MessagesSquare size={20} /> },
        { path: '/questionnaires', label: '問卷管理', icon: <FileText size={20} /> },
        { path: '/tasks', label: '任務庫管理', icon: <ClipboardList size={20} /> },
        { path: '/gamification', label: '內生激勵與排名', icon: <Trophy size={20} /> },
    ];

    if (isAdmin) {
        navItems.push({ path: '/admin/users', label: '帳號審核管理', icon: <Settings size={20} /> });
    }

    const getRoleName = (roleId) => {
        switch (roleId) {
            case 1: return '超級管理員';
            case 2: return '個案管理師';
            case 5: return '待審核帳號';
            default: return '使用者';
        }
    };

    return (
        <div className="flex bg-background min-h-screen antialiased">
            {/* Sidebar */}
            <aside
                className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} hidden flex-none flex-col border-r border-sky-100 bg-white shadow-sm transition-[width] duration-200 md:flex`}
            >
                <div className={`h-16 flex items-center border-b border-sky-100 ${isSidebarCollapsed ? 'justify-center px-3' : 'justify-between gap-2 px-4'}`}>
                    {!isSidebarCollapsed && (
                        <h1 className="min-w-0 truncate font-lora text-xl font-bold text-primary">Health Task Manager</h1>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
                        aria-label={isSidebarCollapsed ? '展開側邊欄' : '收合側邊欄'}
                        aria-expanded={!isSidebarCollapsed}
                        title={isSidebarCollapsed ? '展開側邊欄' : '收合側邊欄'}
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-text/50 transition-colors hover:bg-sky-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                    </button>
                </div>
                <nav className="flex-1 py-4">
                    <ul>
                        {navItems.map((item) => {
                            const isActive = location.pathname.startsWith(item.path);
                            return (
                                <li key={item.path} className={`${isSidebarCollapsed ? 'px-2' : 'px-3'} mb-1`}>
                                    <Link
                                        to={item.path}
                                        title={isSidebarCollapsed ? item.label : undefined}
                                        aria-label={isSidebarCollapsed ? item.label : undefined}
                                        className={`relative flex h-11 items-center rounded-lg transition-colors duration-200 cursor-pointer ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${isActive
                                                ? 'bg-primary-light/10 text-primary font-medium'
                                                : 'text-text/70 hover:bg-sky-50 hover:text-text'
                                            }`}
                                    >
                                        <span className={`flex-none ${isActive ? 'text-primary' : 'text-text/50'}`}>
                                            {item.icon}
                                        </span>
                                        {!isSidebarCollapsed && <span className="min-w-0 truncate">{item.label}</span>}
                                        {item.badge > 0 && (
                                            <span className={`${isSidebarCollapsed ? 'absolute right-1 top-1' : 'ml-auto'} min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 text-white`}>
                                                {item.badge > 99 ? '99+' : item.badge}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
                <div className={`${isSidebarCollapsed ? 'p-3' : 'p-4'} border-t border-sky-100 space-y-4`}>
                    <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`} title={isSidebarCollapsed ? `${user?.display_name || '未登入'}｜${getRoleName(user?.role_id)}` : undefined}>
                        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                            {user?.display_name?.charAt(0) || '管'}
                        </div>
                        {!isSidebarCollapsed && (
                            <div className="min-w-0 overflow-hidden text-sm">
                                <p className="truncate font-medium text-text">{user?.display_name || '未登入'}</p>
                                <p className="text-xs text-text/50">{getRoleName(user?.role_id)}</p>
                            </div>
                        )}
                    </div>
                    {user && (
                        <div className="space-y-2">
                            <button
                                onClick={() => setShowPasswordModal(true)}
                                aria-label={isSidebarCollapsed ? '修改密碼' : undefined}
                                title={isSidebarCollapsed ? '修改密碼' : undefined}
                                className={`flex h-9 w-full items-center rounded-lg text-sm text-text/70 transition-colors hover:bg-sky-50 cursor-pointer ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-3'}`}
                            >
                                <KeyRound size={16} className="flex-none" />
                                {!isSidebarCollapsed && <span>修改密碼</span>}
                            </button>
                            <button 
                                onClick={logout}
                                aria-label={isSidebarCollapsed ? '登出系統' : undefined}
                                title={isSidebarCollapsed ? '登出系統' : undefined}
                                className={`flex h-9 w-full items-center rounded-lg text-sm text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-3'}`}
                            >
                                <LogOut size={16} className="flex-none" />
                                {!isSidebarCollapsed && <span>登出系統</span>}
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Header */}
                <header className="flex h-14 items-center justify-between border-b border-sky-100 bg-white px-3 md:hidden">
                    <button
                        type="button"
                        onClick={() => setIsMobileSidebarOpen(true)}
                        aria-label="開啟導覽選單"
                        aria-expanded={isMobileSidebarOpen}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-primary transition-colors hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <Menu size={22} />
                    </button>
                    <h1 className="min-w-0 truncate px-2 font-lora font-bold text-primary">Health Task Manager</h1>
                    <Link to="/notifications" aria-label="開啟通知中心" className="relative rounded-lg p-2 text-primary hover:bg-sky-50">
                        <Bell size={21} />
                        {notificationUnread > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                                {notificationUnread > 99 ? '99+' : notificationUnread}
                            </span>
                        )}
                    </Link>
                </header>

                {/* Mobile Navigation Drawer */}
                <div
                    className={`fixed inset-0 z-40 md:hidden ${isMobileSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    aria-hidden={!isMobileSidebarOpen}
                    inert={!isMobileSidebarOpen}
                >
                    <button
                        type="button"
                        onClick={() => setIsMobileSidebarOpen(false)}
                        aria-label="關閉導覽選單"
                        tabIndex={isMobileSidebarOpen ? 0 : -1}
                        className={`absolute inset-0 bg-black/35 transition-opacity duration-200 ${isMobileSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
                    />
                    <aside className={`relative flex h-full w-[min(82vw,20rem)] flex-col bg-white shadow-xl transition-transform duration-200 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                        <div className="flex h-14 items-center justify-between border-b border-sky-100 px-4">
                            <h2 className="truncate font-lora text-lg font-bold text-primary">Health Task Manager</h2>
                            <button
                                type="button"
                                onClick={() => setIsMobileSidebarOpen(false)}
                                aria-label="關閉導覽選單"
                                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-text/50 hover:bg-sky-50 hover:text-primary"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <nav className="flex-1 overflow-y-auto py-4">
                            <ul>
                                {navItems.map((item) => {
                                    const isActive = location.pathname.startsWith(item.path);
                                    return (
                                        <li key={item.path} className="mb-1 px-3">
                                            <Link
                                                to={item.path}
                                                className={`relative flex h-11 items-center gap-3 rounded-lg px-3 transition-colors ${isActive
                                                        ? 'bg-primary-light/10 font-medium text-primary'
                                                        : 'text-text/70 hover:bg-sky-50 hover:text-text'
                                                    }`}
                                            >
                                                <span className={`flex-none ${isActive ? 'text-primary' : 'text-text/50'}`}>{item.icon}</span>
                                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                                {item.badge > 0 && (
                                                    <span className="min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 text-white">
                                                        {item.badge > 99 ? '99+' : item.badge}
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>
                        <div className="space-y-4 border-t border-sky-100 p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                                    {user?.display_name?.charAt(0) || '管'}
                                </div>
                                <div className="min-w-0 text-sm">
                                    <p className="truncate font-medium text-text">{user?.display_name || '未登入'}</p>
                                    <p className="text-xs text-text/50">{getRoleName(user?.role_id)}</p>
                                </div>
                            </div>
                            {user && (
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMobileSidebarOpen(false);
                                            setShowPasswordModal(true);
                                        }}
                                        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-50 px-3 text-sm text-text/70"
                                    >
                                        <KeyRound size={16} />
                                        <span>修改密碼</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={logout}
                                        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-50 px-3 text-sm text-rose-600"
                                    >
                                        <LogOut size={16} />
                                        <span>登出系統</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background/50">
                    {children}
                </div>
            </main>
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-sky-100 bg-sky-50/50 px-5 py-4">
                            <h3 className="font-bold text-primary">修改我的密碼</h3>
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                disabled={isUpdatingPassword}
                                className="rounded-lg p-1 text-text/40 hover:bg-white hover:text-text disabled:opacity-40"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdatePassword} className="space-y-4 p-5">
                            <div className="space-y-1">
                                <label className="ml-1 text-xs font-bold text-text/60">新密碼</label>
                                <input
                                    type="password"
                                    className="w-full rounded-xl border border-sky-100 bg-sky-50/30 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={passwordForm.password}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="ml-1 text-xs font-bold text-text/60">確認新密碼</label>
                                <input
                                    type="password"
                                    className="w-full rounded-xl border border-sky-100 bg-sky-50/30 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={passwordForm.confirm}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    disabled={isUpdatingPassword}
                                    className="flex-1 rounded-xl border border-sky-200 px-4 py-2.5 font-bold text-text/60 hover:bg-sky-50 disabled:opacity-50"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdatingPassword}
                                    className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-bold text-white hover:bg-primary-light disabled:opacity-50"
                                >
                                    {isUpdatingPassword ? '更新中...' : '儲存'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
