import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, User, Lock, AlertCircle } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // 登入後跳轉回原本想去的頁面，或預設到個案管理
    const from = location.state?.from?.pathname || "/patients";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            await login(username, password);
            navigate(from, { replace: true });
        } catch (err) {
            setError(err.message || '登入失敗，請檢查帳號密碼');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-sky-50 px-4">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-sky-100">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4">
                        <LogIn size={32} />
                    </div>
                    <h2 className="text-3xl font-lora font-bold text-primary">管理系統登入</h2>
                    <p className="mt-2 text-text/60">Health Task Manager 總管理平台</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl flex items-center space-x-2 text-sm">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text/40">
                                <User size={20} />
                            </div>
                            <input
                                type="text"
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-sky-200 rounded-xl leading-5 bg-white placeholder-text/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary sm:text-sm transition-all"
                                placeholder="帳號"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text/40">
                                <Lock size={20} />
                            </div>
                            <input
                                type="password"
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-sky-200 rounded-xl leading-5 bg-white placeholder-text/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary sm:text-sm transition-all"
                                placeholder="密碼"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all shadow-lg shadow-primary/20 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {isSubmitting ? '登入中...' : '確認登入'}
                        </button>
                    </div>
                </form>

                <div className="text-center text-xs text-text/40">
                    <p>© 2026 Health Task Manager. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
