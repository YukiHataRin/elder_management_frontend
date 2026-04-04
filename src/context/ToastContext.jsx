import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState(null);

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const requestConfirm = useCallback((message, title = '系統確認') => {
        return new Promise((resolve) => {
            setConfirmDialog({
                title,
                message,
                onConfirm: () => {
                    resolve(true);
                    setConfirmDialog(null);
                },
                onCancel: () => {
                    resolve(false);
                    setConfirmDialog(null);
                }
            });
        });
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast, requestConfirm }}>
            {children}
            
            {/* Toasts Container */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div 
                        key={toast.id} 
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-in-right bg-white min-w-[300px]
                            ${toast.type === 'success' ? 'border-green-200 text-green-800' : 
                              toast.type === 'error' ? 'border-rose-200 text-rose-800' : 
                              'border-sky-200 text-sky-800'}`}
                    >
                        {toast.type === 'success' && <CheckCircle className="text-green-500" size={20} />}
                        {toast.type === 'error' && <XCircle className="text-rose-500" size={20} />}
                        {toast.type === 'info' && <Info className="text-sky-500" size={20} />}
                        
                        <span className="flex-1 font-medium text-sm">{toast.message}</span>
                        
                        <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirm Dialog Overlay */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[9999] bg-text/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4 text-amber-500">
                                <div className="p-2 bg-amber-100 rounded-full">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-text">{confirmDialog.title}</h3>
                            </div>
                            <p className="text-text/70">{confirmDialog.message}</p>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                            <button 
                                onClick={confirmDialog.onCancel}
                                className="px-4 py-2 rounded-lg font-medium text-text/60 hover:bg-slate-200 transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={confirmDialog.onConfirm}
                                className="px-4 py-2 rounded-lg font-medium bg-rose-500 hover:bg-rose-600 text-white transition-colors shadow-sm"
                            >
                                確認
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    );
};
