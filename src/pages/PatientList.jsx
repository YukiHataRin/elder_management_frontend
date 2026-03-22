import React, { useState, useEffect } from 'react';
import { Search, Filter, AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { managementApi } from '../api/management';
import { useToast } from '../context/ToastContext';

const PatientList = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showToast, requestConfirm } = useToast();

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const data = await managementApi.getPatients();
            setPatients(data);
        } catch (error) {
            console.error('Failed to fetch patients:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    const handleCreateUser = async () => {
        const username = window.prompt("請輸入新病患的帳號 (username):", "test_user_01");
        if (!username) return;
        const displayName = window.prompt("請輸入新病患的姓名 (display_name):", "王小明");
        if (!displayName) return;
        const password = window.prompt("請輸入密碼 (password):", "123456");
        if (!password) return;
        
        try {
            await managementApi.createUser({
                username,
                password,
                display_name: displayName,
                role_id: 3, // Role 3 = Patient
                is_active: true
            });
            showToast('新增病患成功', 'success');
            fetchPatients();
        } catch (error) {
            showToast('新增病患失敗: ' + error.message, 'error');
        }
    };

    const handleDeleteUser = async (e, id) => {
        e.stopPropagation();
        if (await requestConfirm('確定要刪除這個使用者嗎？此操作無法復原。')) {
            try {
                await managementApi.deleteUser(id);
                showToast('病患刪除成功', 'success');
                fetchPatients();
            } catch (error) {
                showToast('病患刪除失敗: ' + error.message, 'error');
            }
        }
    };

    const calculateAge = (birthday) => {
        if (!birthday) return 'N/A';
        const birthDate = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const getGradeColor = (grade) => {
        switch (grade?.toUpperCase()) {
            case 'A': return 'bg-rose-100 text-rose-700 border-rose-200'; // 最需干預
            case 'B': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'C': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'D': return 'bg-green-100 text-green-700 border-green-200'; // 最健康
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const filteredPatients = patients.filter(p => 
        p.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-lora font-bold text-primary">個案總覽清單</h2>
                    <p className="text-text/60 mt-1">管理並追蹤長者的健康狀態與任務進度</p>
                </div>
                <button 
                    onClick={handleCreateUser}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors cursor-pointer shadow-sm flex items-center space-x-2"
                >
                    <span>+ 新增個案</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-sky-100/50 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-sky-100/50 flex flex-col sm:flex-row gap-4 justify-between bg-sky-50/30">
                    <div className="relative w-full sm:w-80">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-text/40" />
                        </div>
                        <input
                            type="text"
                            placeholder="搜尋姓名、帳號..."
                            className="w-full pl-10 pr-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex space-x-2">
                        <button className="flex items-center space-x-2 px-4 py-2 border border-sky-200 rounded-lg bg-white text-text/70 hover:bg-sky-50 transition-colors cursor-pointer">
                            <Filter size={18} />
                            <span>篩選</span>
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-sky-50/50 text-text/60 text-sm font-medium border-b border-sky-100/50">
                                <th className="py-4 px-6">姓名</th>
                                <th className="py-4 px-6">帳號</th>
                                <th className="py-4 px-6">性別/年齡</th>
                                <th className="py-4 px-6">肌少症分級</th>
                                <th className="py-4 px-6">本週進度</th>
                                <th className="py-4 px-6">狀態標記</th>
                                <th className="py-4 px-6 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-100/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="py-10 text-center text-text/40">載入中...</td>
                                </tr>
                            ) : filteredPatients.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-10 text-center text-text/40">查無病患資料</td>
                                </tr>
                            ) : filteredPatients.map((patient) => (
                                <tr key={patient.id} className="hover:bg-primary/5 transition-colors group">
                                    <td className="py-4 px-6">
                                        <div className="font-bold text-text">{patient.display_name}</div>
                                    </td>
                                    <td className="py-4 px-6 text-text/70 font-mono text-sm">
                                        {patient.username}
                                    </td>
                                    <td className="py-4 px-6 text-text/70">
                                        {patient.details?.gender?.name || '未知'} | {calculateAge(patient.details?.birthday)}歲
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getGradeColor(patient.details?.sarcopenia_level)}`}>
                                            {patient.details?.sarcopenia_level || '未分級'} 級
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center space-x-3 w-32">
                                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full bg-primary`}
                                                    style={{ width: `0%` }} // 進度計算邏輯待補，目前後端 User schema 未直接提供
                                                ></div>
                                            </div>
                                            <span className="text-xs font-medium text-text/70 w-8">0%</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-xs text-text/40 italic">
                                        尚未串接警示邏輯
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <button
                                            onClick={() => navigate(`/patients/${patient.id}`)}
                                            className="inline-flex items-center justify-center p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                            title="檢視詳細資料"
                                        >
                                            <ArrowRight size={20} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteUser(e, patient.id)}
                                            className="inline-flex items-center justify-center p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer ml-1"
                                            title="刪除個案"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PatientList;
