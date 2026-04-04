import React, { useState, useEffect } from 'react';
import { managementApi } from '../api/management';
import { Shield, UserCheck, UserX, Clock, Search, Filter, Users, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BackendUserManagement = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterRole, setFilterRole] = useState('');
    
    // Modal states for viewing manager's patients
    const [selectedManager, setSelectedManager] = useState(null);
    const [managerPatients, setManagerPatients] = useState([]);
    const [loadingPatients, setLoadingPatients] = useState(false);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        username: '',
        display_name: '',
        password: '',
        role_id: 2 // Default to Manager
    });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await managementApi.getBackendUsers(filterRole);
            setUsers(data);
        } catch (error) {
            console.error('Failed to fetch backend users', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, [filterRole]);

    const handleCreateBackendUser = async (e) => {
        e.preventDefault();
        try {
            await managementApi.createUser({
                ...createFormData,
                role_id: parseInt(createFormData.role_id),
                is_active: true
            });
            setShowCreateModal(false);
            setCreateFormData({ username: '', display_name: '', password: '', role_id: 2 });
            fetchUsers();
        } catch (error) {
            alert('建立帳號失敗: ' + error.message);
        }
    };

    const handleUpdateRole = async (userId, newRoleId) => {
        try {
            await managementApi.updateUserRole(userId, newRoleId);
            fetchUsers();
        } catch (error) {
            alert('更新角色失敗: ' + error.message);
        }
    };

    const fetchManagerPatients = async (manager) => {
        setSelectedManager(manager);
        setLoadingPatients(true);
        try {
            const data = await managementApi.getManagerAssignedUsers(manager.id);
            setManagerPatients(data);
        } catch (error) {
            console.error('Failed to fetch manager patients', error);
            setManagerPatients([]);
        }
        setLoadingPatients(false);
    };

    const getRoleBadge = (roleId) => {
        switch (roleId) {
            case 1: return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">超級管理員</span>;
            case 2: return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">個管師</span>;
            case 5: return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">待審核</span>;
            default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">未知 ({roleId})</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-lora font-bold text-primary">後端帳號管理</h2>
                    <p className="text-text/60 mt-1">審核及管理系統管理員與個案管理員帳號</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors cursor-pointer shadow-sm flex items-center space-x-2"
                >
                    <span>+ 新增後端帳號</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-sky-100/50 overflow-hidden">
                <div className="p-4 border-b border-sky-100/50 flex flex-col sm:flex-row gap-4 justify-between bg-sky-50/30">
                    <div className="flex space-x-2">
                        <select 
                            className="px-4 py-2 border border-sky-200 rounded-lg bg-white text-text/70 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                        >
                            <option value="">所有角色</option>
                            <option value="1">超級管理員</option>
                            <option value="2">個管師</option>
                            <option value="5">待審核</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-sky-50/50 text-text/60 text-sm font-medium border-b border-sky-100/50">
                                <th className="py-4 px-6">使用者名稱</th>
                                <th className="py-4 px-6">顯示名稱</th>
                                <th className="py-4 px-6">當前角色</th>
                                <th className="py-4 px-6 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-100/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="py-10 text-center text-text/40">載入中...</td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-10 text-center text-text/40">查無資料</td>
                                </tr>
                            ) : users.map((u) => (
                                <tr key={u.id} className="hover:bg-primary/5 transition-colors">
                                    <td className="py-4 px-6 font-medium text-text font-mono text-sm">{u.username}</td>
                                    <td className="py-4 px-6 text-text/70">{u.display_name}</td>
                                    <td className="py-4 px-6">{getRoleBadge(u.role_id)}</td>
                                    <td className="py-4 px-6">
                                        <div className="flex justify-center space-x-2">
                                            {u.role_id === 2 && (
                                                <button 
                                                    onClick={() => fetchManagerPatients(u)}
                                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center space-x-1"
                                                    title="查看負責病患"
                                                >
                                                    <Users size={18} />
                                                    <span className="text-xs font-bold">查看個案</span>
                                                </button>
                                            )}
                                            {u.role_id === 5 ? (
                                                <>
                                                    <button 
                                                        onClick={() => handleUpdateRole(u.id, 2)}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="核准為個管師"
                                                    >
                                                        <UserCheck size={20} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateRole(u.id, 1)}
                                                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                        title="核准為超級管理員"
                                                    >
                                                        <Shield size={20} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={async () => {
                                                        const newPassword = window.prompt(`重設 ${u.display_name} 的密碼:`, "");
                                                        if (newPassword) {
                                                            try {
                                                                await managementApi.updateUser(u.id, { password: newPassword });
                                                                alert('密碼重設成功');
                                                            } catch (e) { alert('重設失敗: ' + e.message); }
                                                        }
                                                    }}
                                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="重設密碼"
                                                >
                                                    <Clock size={20} />
                                                </button>
                                            )}
                                            {u.role_id !== 5 && u.role_id !== 1 && (
                                                <button 
                                                    onClick={() => handleUpdateRole(u.id, 5)}
                                                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="取消權限 (設為待審核)"
                                                >
                                                    <UserX size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Backend User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-sky-100">
                        <div className="p-6 border-b border-sky-100 bg-sky-50/50">
                            <h3 className="text-xl font-bold text-primary">建立後端管理帳號</h3>
                            <p className="text-sm text-text/50 mt-1">手動建立具備管理權限的帳號</p>
                        </div>
                        
                        <form onSubmit={handleCreateBackendUser} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text/60 ml-1">帳號 (Username)</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                                    placeholder="例如：manager_01"
                                    value={createFormData.username}
                                    onChange={(e) => setCreateFormData({...createFormData, username: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text/60 ml-1">顯示名稱 (Display Name)</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="例如：李專員"
                                    value={createFormData.display_name}
                                    onChange={(e) => setCreateFormData({...createFormData, display_name: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text/60 ml-1">初始密碼 (Password)</label>
                                <input
                                    required
                                    type="password"
                                    className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="請設定登入密碼"
                                    value={createFormData.password}
                                    onChange={(e) => setCreateFormData({...createFormData, password: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text/60 ml-1">指派角色</label>
                                <select
                                    className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={createFormData.role_id}
                                    onChange={(e) => setCreateFormData({...createFormData, role_id: e.target.value})}
                                >
                                    <option value={2}>個案管理師 (Manager)</option>
                                    <option value={1}>超級管理員 (Admin)</option>
                                </select>
                            </div>

                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 px-4 border border-sky-200 text-text/60 rounded-xl font-bold hover:bg-sky-50 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-shadow shadow-lg shadow-primary/20"
                                >
                                    建立帳號
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manager Patients Modal */}
            {selectedManager && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-sky-100">
                        <div className="p-6 border-b border-sky-100 flex justify-between items-center bg-sky-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-primary flex items-center space-x-2">
                                    <Users size={24} />
                                    <span>{selectedManager.display_name} 負責的個案</span>
                                </h3>
                                <p className="text-xs text-text/50 mt-1 font-mono">{selectedManager.username}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedManager(null)}
                                className="p-2 hover:bg-white rounded-full text-text/40 hover:text-text transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingPatients ? (
                                <div className="text-center py-10 text-text/40">載入病患清單中...</div>
                            ) : managerPatients.length === 0 ? (
                                <div className="text-center py-10 space-y-4 text-text/40">
                                    <p>目前尚未分配任何病患</p>
                                    <button 
                                        onClick={() => {
                                            setSelectedManager(null);
                                            navigate('/patients');
                                        }}
                                        className="text-primary text-sm font-bold hover:underline"
                                    >
                                        前往「個案管理」進行指派
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {managerPatients.map(patient => (
                                        <div 
                                            key={patient.id} 
                                            className="p-4 rounded-2xl border border-sky-100 hover:border-primary/30 hover:bg-primary/5 transition-all group cursor-pointer"
                                            onClick={() => navigate(`/patients/${patient.id}`)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-text">{patient.display_name}</p>
                                                    <p className="text-xs text-text/40 font-mono">{patient.username}</p>
                                                </div>
                                                <ArrowRight size={18} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="mt-3 flex space-x-2">
                                                <span className="px-2 py-0.5 bg-sky-100 text-primary text-[10px] font-bold rounded-md">
                                                    {patient.details?.sarcopenia_level || '未分級'} 級
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="p-6 border-t border-sky-100 bg-sky-50/20 text-right">
                            <button 
                                onClick={() => setSelectedManager(null)}
                                className="px-6 py-2 bg-white border border-sky-200 text-text/70 rounded-xl font-bold hover:bg-sky-50 transition-colors text-sm"
                            >
                                關閉
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BackendUserManagement;
