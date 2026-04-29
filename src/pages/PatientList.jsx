import React, { useState, useEffect } from 'react';
import { Search, Filter, AlertTriangle, ArrowRight, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { managementApi } from '../api/management';
import { useToast } from '../context/useToast';
import { useAuth } from '../context/useAuth';

const PatientList = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showToast, requestConfirm } = useToast();
    const { isAdmin } = useAuth();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        display_name: '',
        birthday: '',
        gender_id: 1,
        nation_id: '',
        sarcopenia_level: 'E',
        phone_number: '',
        address: '',
        role_id: 3,
        is_psychiatric: false,
        is_dental: false
    });

    const [managers, setManagers] = useState([]);
    const [missionLogs, setMissionLogs] = useState([]);
    const [assignedMissions, setAssignedMissions] = useState([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTargetPatient, setAssignTargetPatient] = useState(null);
    const [selectedManagerIds, setSelectedManagerIds] = useState([]);
    const [isAssigningManagers, setIsAssigningManagers] = useState(false);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const [patientsData, managersData, missionsData] = await Promise.all([
                managementApi.getPatients(),
                isAdmin ? managementApi.getBackendUsers(2) : Promise.resolve([]),
                managementApi.getMissionsElective()
            ]);
            
            setPatients(patientsData || []);
            setManagers(managersData || []);
            setAssignedMissions(missionsData || []);

            // Iteratively fetch mission logs for each patient
            if (patientsData && patientsData.length > 0) {
                const logsPromises = patientsData.map(p => 
                    managementApi.getMissionLogs(p.id).catch(() => [])
                );
                const logsDataArray = await Promise.all(logsPromises);
                setMissionLogs(logsDataArray.flat());
            } else {
                setMissionLogs([]);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    const getManagerIds = (patient) => (patient?.managers || []).map(m => String(m.id));

    const handleOpenAssignModal = (patient) => {
        setAssignTargetPatient(patient);
        setSelectedManagerIds(getManagerIds(patient));
        setShowAssignModal(true);
    };

    const toggleSelectedManager = (managerId) => {
        const id = String(managerId);
        setSelectedManagerIds(prev => (
            prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
        ));
    };

    const handleAssignManager = async () => {
        if (!assignTargetPatient) return;

        const originalIds = getManagerIds(assignTargetPatient);
        const nextIds = selectedManagerIds.map(String);
        const idsToAdd = nextIds.filter(managerId => !originalIds.includes(managerId));
        const idsToRemove = originalIds.filter(managerId => !nextIds.includes(managerId));

        if (idsToAdd.length === 0 && idsToRemove.length === 0) {
            setShowAssignModal(false);
            return;
        }

        setIsAssigningManagers(true);
        try {
            await Promise.all([
                ...idsToAdd.map(managerId => managementApi.assignUser({
                    user_id: assignTargetPatient.id,
                    manager_id: parseInt(managerId)
                })),
                ...idsToRemove.map(managerId => managementApi.unassignUser({
                    user_id: assignTargetPatient.id,
                    manager_id: parseInt(managerId)
                }))
            ]);
            showToast('個管師指派已更新', 'success');
            setShowAssignModal(false);
            fetchPatients();
        } catch (error) {
            showToast('更新指派失敗: ' + error.message, 'error');
            fetchPatients();
        } finally {
            setIsAssigningManagers(false);
        }
    };

    const handleUnassignManager = async (patientId, managerId) => {
        if (await requestConfirm('確定要解除此個管師的指派嗎？')) {
            try {
                await managementApi.unassignUser({
                    user_id: patientId,
                    manager_id: managerId
                });
                showToast('解除指派成功', 'success');
                fetchPatients();
            } catch (error) {
                showToast('解除失敗: ' + error.message, 'error');
            }
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await managementApi.createUser({
                username: formData.username,
                password: formData.password,
                display_name: formData.display_name,
                role_id: parseInt(formData.role_id),
                is_active: true,
                details: {
                    birthday: formData.birthday,
                    gender_id: parseInt(formData.gender_id),
                    nation_id: formData.nation_id,
                    sarcopenia_level: formData.sarcopenia_level,
                    phone_number: formData.phone_number,
                    address: formData.address,
                    is_psychiatric: formData.is_psychiatric,
                    is_dental: formData.is_dental,
                    points: 0
                }
            });
            showToast('新增病患成功', 'success');
            setShowCreateModal(false);
            setFormData({
                username: '',
                password: '',
                display_name: '',
                birthday: '',
                gender_id: 1,
                nation_id: '',
                sarcopenia_level: 'E',
                phone_number: '',
                address: '',
                role_id: 3,
                is_psychiatric: false,
                is_dental: false
            });
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
        if (!birthday) return '??';
        const birthDate = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age > 0 ? age : 0;
    };

    const getGradeColor = (grade) => {
        switch (grade?.toUpperCase()) {
            case 'A': return 'bg-rose-100 text-rose-700 border-rose-200'; // 最需干預
            case 'B': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'C': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'D':
            case 'E': return 'bg-green-100 text-green-700 border-green-200'; // 最健康
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getIllnessStatusColor = (status) => {
        const s = String(status).toLowerCase();
        if (s.includes('critical') || s.includes('high')) return 'bg-rose-100 text-rose-700 border-rose-200';
        if (s.includes('warning') || s.includes('medium')) return 'bg-orange-100 text-orange-700 border-orange-200';
        return 'bg-sky-100 text-sky-700 border-sky-200';
    };

    const [activeTab, setActiveTab] = useState('all'); // 'all', 'experimental', 'control'
    const [subFilter, setSubFilter] = useState('all'); // 'all', 'psychiatric', 'dental', 'sarcopenia'

    const filteredPatients = patients.filter(p => {
        const matchesSearch = p.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            p.username.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;

        // 第一層：組別過濾
        const matchesTab = activeTab === 'all' || 
                          (activeTab === 'experimental' && p.role?.name === '實驗組') ||
                          (activeTab === 'control' && p.role?.name === '對照組');
        
        if (!matchesTab) return false;

        // 第二層：特徵過濾
        switch (subFilter) {
            case 'psychiatric':
                return p.details?.is_psychiatric === true;
            case 'dental':
                return p.details?.is_dental === true;
            case 'sarcopenia':
                return p.details?.sarcopenia_level && ['A', 'B', 'C', 'D'].includes(p.details.sarcopenia_level);
            default:
                return true;
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-lora font-bold text-primary">個案總覽清單</h2>
                    <p className="text-text/60 mt-1">管理並追蹤長者的健康狀態與任務進度</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors cursor-pointer shadow-sm flex items-center space-x-2"
                >
                    <span>+ 新增個案</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-sky-100/50 overflow-hidden">
                {/* 第一層標籤：組別 */}
                <div className="px-4 pt-4 border-b border-sky-100/50 flex space-x-4 bg-sky-50/10">
                    <button 
                        onClick={() => setActiveTab('all')}
                        className={`pb-3 px-2 text-sm font-bold transition-all cursor-pointer relative ${activeTab === 'all' ? 'text-primary' : 'text-text/40 hover:text-text/60'}`}
                    >
                        全部 ({patients.length})
                        {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                    </button>
                    <button 
                        onClick={() => setActiveTab('experimental')}
                        className={`pb-3 px-2 text-sm font-bold transition-all cursor-pointer relative ${activeTab === 'experimental' ? 'text-primary' : 'text-text/40 hover:text-text/60'}`}
                    >
                        實驗組 ({patients.filter(p => p.role?.name === '實驗組').length})
                        {activeTab === 'experimental' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                    </button>
                    <button 
                        onClick={() => setActiveTab('control')}
                        className={`pb-3 px-2 text-sm font-bold transition-all cursor-pointer relative ${activeTab === 'control' ? 'text-primary' : 'text-text/40 hover:text-text/60'}`}
                    >
                        對照組 ({patients.filter(p => p.role?.name === '對照組').length})
                        {activeTab === 'control' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                    </button>
                </div>

                {/* 第二層標籤：健康特徵細分 */}
                <div className="px-4 py-3 border-b border-sky-100/30 flex flex-wrap gap-2 bg-white">
                    <span className="text-xs font-bold text-text/40 flex items-center mr-2 uppercase tracking-wider">特徵篩選:</span>
                    <button 
                        onClick={() => setSubFilter('all')}
                        className={`px-3 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${subFilter === 'all' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-text/50 border-sky-100 hover:border-sky-300'}`}
                    >
                        全部特徵
                    </button>
                    <button 
                        onClick={() => setSubFilter('psychiatric')}
                        className={`px-3 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${subFilter === 'psychiatric' ? 'bg-rose-500 text-white border-rose-500 shadow-sm' : 'bg-white text-text/50 border-sky-100 hover:border-rose-200'}`}
                    >
                        心理問題 ({patients.filter(p => {
                            const inGroup = activeTab === 'all' || (activeTab === 'experimental' && p.role?.name === '實驗組') || (activeTab === 'control' && p.role?.name === '對照組');
                            return inGroup && p.details?.is_psychiatric === true;
                        }).length})
                    </button>
                    <button 
                        onClick={() => setSubFilter('dental')}
                        className={`px-3 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${subFilter === 'dental' ? 'bg-sky-500 text-white border-sky-500 shadow-sm' : 'bg-white text-text/50 border-sky-100 hover:border-sky-300'}`}
                    >
                        口腔保健 ({patients.filter(p => {
                            const inGroup = activeTab === 'all' || (activeTab === 'experimental' && p.role?.name === '實驗組') || (activeTab === 'control' && p.role?.name === '對照組');
                            return inGroup && p.details?.is_dental === true;
                        }).length})
                    </button>
                    <button 
                        onClick={() => setSubFilter('sarcopenia')}
                        className={`px-3 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${subFilter === 'sarcopenia' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-text/50 border-sky-100 hover:border-amber-200'}`}
                    >
                        肌少症風險 ({patients.filter(p => {
                            const inGroup = activeTab === 'all' || (activeTab === 'experimental' && p.role?.name === '實驗組') || (activeTab === 'control' && p.role?.name === '對照組');
                            return inGroup && p.details?.sarcopenia_level && ['A', 'B', 'C', 'D'].includes(p.details.sarcopenia_level);
                        }).length})
                    </button>
                </div>

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

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-sky-50/50 text-text/60 text-sm font-medium border-b border-sky-100/50">
                                <th className="py-4 px-6">姓名</th>
                                <th className="py-4 px-6">帳號</th>
                                <th className="py-4 px-6">性別/年齡</th>
                                <th className="py-4 px-6">肌少症分級</th>
                                <th className="py-4 px-6">目前個管師</th>
                                <th className="py-4 px-6">健康特徵</th>
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
                                        <span className="font-medium">{patient.details?.gender?.name === 'male' ? '男' : patient.details?.gender?.name === 'female' ? '女' : '未知'}</span>
                                        <span className="mx-2 text-text/20">|</span>
                                        <span className="font-bold text-primary">{calculateAge(patient.details?.birthday)}</span>
                                        <span className="text-xs ml-0.5">歲</span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getGradeColor(patient.details?.sarcopenia_level)}`}>
                                            {patient.details?.sarcopenia_level || '未分級'} 級
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        {(patient.managers && patient.managers.length > 0) ? (
                                            <div className="flex flex-col gap-1">
                                                {patient.managers.map(m => (
                                                    <span key={m.id} className="text-sm font-bold text-primary flex items-center gap-2">
                                                        {m.display_name}
                                                        {isAdmin && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleUnassignManager(patient.id, m.id); }} className="text-rose-400 hover:text-rose-600 cursor-pointer p-0.5" title="解除指派"><X size={14} /></button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-text/40 italic">尚未指派</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6">
                                        {patient.illnesses && patient.illnesses.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {patient.illnesses.map((ill, i) => (
                                                    <span key={i} className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getIllnessStatusColor(ill.illness_status)}`}>
                                                        {ill.illness_type?.name || '特徵'} {ill.illness_status ? `(${ill.illness_status})` : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-text/40 italic">無特殊狀態</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-center whitespace-nowrap">
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleOpenAssignModal(patient)}
                                                className="px-3 py-1.5 text-xs font-bold bg-sky-100 text-sky-700 hover:bg-sky-200 rounded-md transition-colors cursor-pointer mr-2"
                                                title="指派個管師"
                                            >
                                                指派個管師
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigate(`/patients/${patient.id}`)}
                                            className="inline-flex items-center justify-center p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                            title="檢視詳細資料"
                                        >
                                            <ArrowRight size={20} />
                                        </button>
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => handleDeleteUser(e, patient.id)}
                                                className="inline-flex items-center justify-center p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer ml-1"
                                                title="刪除個案"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Patient Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-sky-100 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-sky-100 bg-sky-50/50">
                            <h3 className="text-xl font-bold text-primary">新增個案資料</h3>
                            <p className="text-sm text-text/50 mt-1">請輸入病患的基本帳號與健康分級資訊</p>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">姓名 (Display Name)</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="例如：王大明"
                                        value={formData.display_name}
                                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">帳號 (Username)</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                                        placeholder="例如：user_01"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text/60 ml-1">登入密碼 (Password)</label>
                                <input
                                    required
                                    type="password"
                                    className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="建議 6 位數以上"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">生日 (Birthday)</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={formData.birthday}
                                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">性別</label>
                                    <select
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={formData.gender_id}
                                        onChange={(e) => setFormData({ ...formData, gender_id: e.target.value })}
                                    >
                                        <option value={1}>男性</option>
                                        <option value={2}>女性</option>
                                        <option value={3}>其他</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">聯絡電話</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="例如：0912345678"
                                        value={formData.phone_number}
                                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">居住地址</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="居住縣市與街道"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">肌少症分級</label>
                                    <select
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={formData.sarcopenia_level}
                                        onChange={(e) => setFormData({ ...formData, sarcopenia_level: e.target.value })}
                                    >
                                        <option value="A">A 級</option>
                                        <option value="B">B 級</option>
                                        <option value="C">C 級</option>
                                        <option value="D">D 級</option>
                                        <option value="E">E 級 (沒有風險)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">身分證字號 (Nation ID)</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="用於系統索引"
                                        value={formData.nation_id}
                                        onChange={(e) => setFormData({ ...formData, nation_id: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">分組 (Group)</label>
                                    <select
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={formData.role_id}
                                        onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                    >
                                        <option value={3}>實驗組 (Experimental)</option>
                                        <option value={4}>對照組 (Control)</option>
                                    </select>
                                </div>
                                <div className="space-y-2 pt-5">
                                    <label className="flex items-center space-x-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-primary rounded border-sky-200 focus:ring-primary"
                                            checked={formData.is_psychiatric}
                                            onChange={(e) => setFormData({...formData, is_psychiatric: e.target.checked})}
                                        />
                                        <span className="text-sm font-bold text-text/80 group-hover:text-primary transition-colors">具心理問題風險</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-primary rounded border-sky-200 focus:ring-primary"
                                            checked={formData.is_dental}
                                            onChange={(e) => setFormData({...formData, is_dental: e.target.checked})}
                                        />
                                        <span className="text-sm font-bold text-text/80 group-hover:text-primary transition-colors">具口腔保健風險</span>
                                    </label>
                                </div>
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
                                    className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-shadow shadow-lg shadow-primary/20 cursor-pointer"
                                >
                                    確認新增
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Manager Modal */}
            {showAssignModal && assignTargetPatient && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-sky-100 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-sky-100 bg-sky-50/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-primary">指派個管師</h3>
                                <p className="text-sm text-text/50 mt-1">對象: {assignTargetPatient.display_name}</p>
                            </div>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                disabled={isAssigningManagers}
                                className="text-text/40 hover:text-text cursor-pointer p-1 disabled:opacity-40"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-text/70">選擇個管師</label>
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        已選 {selectedManagerIds.length} 位
                                    </span>
                                </div>
                                <div className="max-h-72 overflow-y-auto rounded-xl border border-sky-100 bg-slate-50 p-2 space-y-1">
                                    {managers.length === 0 ? (
                                        <p className="py-6 text-center text-sm text-text/40">目前沒有可指派的個管師</p>
                                    ) : managers.map(m => {
                                        const managerId = String(m.id);
                                        const checked = selectedManagerIds.includes(managerId);
                                        return (
                                            <label
                                                key={m.id}
                                                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                                    checked ? 'bg-primary/5 border-primary/30' : 'bg-white border-transparent hover:border-sky-200'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20 cursor-pointer"
                                                    checked={checked}
                                                    disabled={isAssigningManagers}
                                                    onChange={() => toggleSelectedManager(managerId)}
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-text truncate">{m.display_name}</p>
                                                    <p className="text-xs text-text/40 truncate">@{m.username}</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={() => setShowAssignModal(false)}
                                    disabled={isAssigningManagers}
                                    className="flex-1 py-2.5 px-4 border border-sky-200 text-text/60 rounded-xl font-bold hover:bg-sky-50 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleAssignManager}
                                    disabled={isAssigningManagers}
                                    className="flex-1 py-2.5 px-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-shadow shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isAssigningManagers ? '儲存中...' : '儲存指派'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientList;
