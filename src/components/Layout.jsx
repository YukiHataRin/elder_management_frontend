import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, Trophy, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
    const location = useLocation();
    const { user, isAdmin, isPending, logout } = useAuth();

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
            <aside className="w-64 bg-white border-r border-sky-100 flex flex-col shadow-sm hidden md:flex">
                <div className="h-16 flex items-center px-6 border-b border-sky-100">
                    <h1 className="text-xl font-bold text-primary font-lora truncate">Health Task Manager</h1>
                </div>
                <nav className="flex-1 py-4">
                    <ul>
                        {navItems.map((item) => {
                            const isActive = location.pathname.startsWith(item.path);
                            return (
                                <li key={item.path} className="px-3 mb-1">
                                    <Link
                                        to={item.path}
                                        className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-200 cursor-pointer ${isActive
                                                ? 'bg-primary-light/10 text-primary font-medium'
                                                : 'text-text/70 hover:bg-sky-50 hover:text-text'
                                            }`}
                                    >
                                        <span className={`${isActive ? 'text-primary' : 'text-text/50'}`}>
                                            {item.icon}
                                        </span>
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
                <div className="p-4 border-t border-sky-100 space-y-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {user?.display_name?.charAt(0) || '管'}
                        </div>
                        <div className="text-sm overflow-hidden">
                            <p className="font-medium text-text truncate">{user?.display_name || '未登入'}</p>
                            <p className="text-xs text-text/50">{getRoleName(user?.role_id)}</p>
                        </div>
                    </div>
                    {user && (
                        <button 
                            onClick={logout}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                            <LogOut size={16} />
                            <span>登出系統</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden h-14 bg-white border-b border-sky-100 flex items-center justify-between px-4">
                    <h1 className="font-bold text-primary font-lora">Health Task Manager</h1>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background/50">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
