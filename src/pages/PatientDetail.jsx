import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, MapPin, Activity, CheckCircle, XCircle, Camera, Heart, Star, Send, Loader2, UserPlus, UserMinus } from 'lucide-react';
import { managementApi } from '../api/management';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PatientDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const { showToast, requestConfirm } = useToast();
    const [activeTab, setActiveTab] = useState('tasks');
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Assignment states
    const [caseManagers, setCaseManagers] = useState([]);
    const [selectedManager, setSelectedManager] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    
    // Mission states
    const [assignedMissions, setAssignedMissions] = useState([]);

    const [isAddMissionModalOpen, setIsAddMissionModalOpen] = useState(false);
    const [allMissions, setAllMissions] = useState([]);
    const [selectedMissionIds, setSelectedMissionIds] = useState([]);
    const [isCompulsory, setIsCompulsory] = useState(false);
    const [isSubmittingMissions, setIsSubmittingMissions] = useState(false);

    // Batch Edit states
    const [isEditingMissions, setIsEditingMissions] = useState(false);
    const [selectedEditMissionIds, setSelectedEditMissionIds] = useState([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const data = await managementApi.getPatientDetail(id);
            setPatient(data);
        } catch (error) {
            console.error('Failed to fetch patient detail:', error);
        }
        setLoading(false);
    };

    const fetchManagers = async () => {
        if (!isAdmin) return;
        try {
            const data = await managementApi.getBackendUsers(2); // Role 2 = Case Managers
            setCaseManagers(data);
        } catch (error) {
            console.error('Failed to fetch managers:', error);
        }
    };

    const fetchMissions = async () => {
        try {
            const data = await managementApi.getMissionsElective();
            const userMissions = data.filter(m => String(m.user_id) === String(id));
            setAssignedMissions(userMissions);
        } catch (error) {
            console.error('Failed to fetch assigned missions:', error);
        }
    };

    const fetchAllMissions = async () => {
        try {
            const data = await managementApi.getMissions();
            if (Array.isArray(data)) setAllMissions(data);
        } catch (error) {
            console.error('Failed to fetch all missions:', error);
        }
    };

    useEffect(() => {
        fetchDetail();
        fetchManagers();
        fetchMissions();
        fetchAllMissions();
    }, [id]);

    const handleAssign = async () => {
        if (!selectedManager) return;
        setIsAssigning(true);
        try {
            await managementApi.assignUser({
                manager_id: parseInt(selectedManager),
                user_id: parseInt(id)
            });
            showToast('分配成功', 'success');
            fetchDetail(); // Refresh to show updated managers if backend returns them
        } catch (error) {
            showToast('分配失敗: ' + error.message, 'error');
        }
        setIsAssigning(false);
    };

    const handleUnassign = async () => {
        if (!(await requestConfirm('確定要解除此病患的個管師指派嗎？'))) return;
        setIsAssigning(true);
        try {
            await managementApi.unassignUser({
                user_id: parseInt(id)
            });
            showToast('解除指派成功', 'success');
            fetchDetail();
        } catch (error) {
            showToast('解除指派失敗: ' + error.message, 'error');
        }
        setIsAssigning(false);
    };

    const handleOpenAddMission = () => {
        setSelectedMissionIds([]);
        setIsCompulsory(false);
        setIsAddMissionModalOpen(true);
    };

    const handleAssignMissions = async () => {
        if (selectedMissionIds.length === 0) return showToast('請選擇至少一項任務', 'error');
        setIsSubmittingMissions(true);
        try {
            await Promise.all(selectedMissionIds.map(mId => 
                managementApi.assignMission({
                    mission_id: mId,
                    user_id: parseInt(id),
                    is_compulsory: isCompulsory
                })
            ));
            showToast('任務派發成功！', 'success');
            setIsAddMissionModalOpen(false);
            fetchMissions(); // Re-fetch assigned missions
        } catch (e) {
            showToast('任務派發失敗: ' + e.message, 'error');
        }
        setIsSubmittingMissions(false);
    };

    // Batch Actions
    const handleBatchProcess = async (action) => {
        if (selectedEditMissionIds.length === 0) return showToast('請至少選擇一項任務', 'error');
        
        if (action === 'delete') {
            if (!(await requestConfirm(`確定要刪除這 ${selectedEditMissionIds.length} 項指派任務嗎？`))) return;
        }

        setIsBatchProcessing(true);
        try {
            await Promise.all(selectedEditMissionIds.map(mId => {
                if (action === 'delete') {
                    return managementApi.deleteMissionElective(mId, parseInt(id));
                } else if (action === 'compulsory') {
                    return managementApi.updateMissionElective(mId, parseInt(id), true);
                } else if (action === 'elective') {
                    return managementApi.updateMissionElective(mId, parseInt(id), false);
                }
            }));
            
            showToast(action === 'delete' ? '批量刪除成功！' : '批量更新成功！', 'success');
            setIsEditingMissions(false);
            setSelectedEditMissionIds([]);
            fetchMissions();
        } catch (e) {
            showToast('批量處理失敗: ' + e.message, 'error');
        }
        setIsBatchProcessing(false);
    };

    const toggleEditMission = (mId) => {
        if (selectedEditMissionIds.includes(mId)) {
            setSelectedEditMissionIds(selectedEditMissionIds.filter(v => v !== mId));
        } else {
            setSelectedEditMissionIds([...selectedEditMissionIds, mId]);
        }
    };

    const toggleSelectAllMissions = () => {
        if (selectedEditMissionIds.length === assignedMissions.length) {
            setSelectedEditMissionIds([]);
        } else {
            setSelectedEditMissionIds(assignedMissions.map(m => m.mission_id));
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

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-primary space-y-4">
                <Loader2 size={40} className="animate-spin" />
                <p className="font-medium">載入病患資料中...</p>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="text-center py-20">
                <h3 className="text-xl font-bold text-text/60">找不到該病患資料</h3>
                <button 
                    onClick={() => navigate('/patients')}
                    className="mt-4 text-primary font-medium hover:underline"
                >
                    返回個案列表
                </button>
            </div>
        );
    }

    // Filter out missions that are already assigned
    const availableMissions = allMissions.filter(m => !assignedMissions.some(am => am.mission_id === (m.id || m.mission_id)));

    const details = patient.details || {};

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate('/patients')}
                    className="p-2 rounded-xl hover:bg-white/60 text-text/60 transition-colors cursor-pointer"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-lora font-bold text-primary flex items-center space-x-3">
                        <span>{patient.display_name}</span>
                        <span className={`px-3 py-1 text-sm font-bold rounded-full border ${
                            details.sarcopenia_level === 'A' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                            details.sarcopenia_level === 'B' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                            'bg-sky-100 text-primary border-sky-200'
                        }`}>
                            肌少症 {details.sarcopenia_level || '未分級'} 級
                        </span>
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-100/50">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 border-4 border-white shadow-sm">
                                <User size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-text">{patient.display_name}</h3>
                            <p className="text-text/60">{details.gender?.name || '未知'} | {calculateAge(details.birthday)} 歲</p>
                            <p className="text-xs text-text/40 mt-1">帳號: {patient.username}</p>
                        </div>

                        <div className="space-y-4 text-sm">
                            <div className="flex items-start space-x-3 text-text/80">
                                <Phone size={16} className="text-primary mt-0.5" />
                                <span>{details.phone_number || '未提供電話'}</span>
                            </div>
                            <div className="flex items-start space-x-3 text-text/80">
                                <MapPin size={16} className="text-primary mt-0.5" />
                                <span>{details.address || '未提供地址'}</span>
                            </div>
                            <div className="pt-4 border-t border-sky-100/50">
                                <p className="text-text/70 italic">尚無健康背景備註</p>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-amber-700 font-bold">
                                <Star size={18} className="fill-amber-400" />
                                <span>長照幣累積</span>
                            </div>
                            <span className="text-lg font-bold text-amber-600">{details.points || 0}</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-100/50">
                        <h4 className="font-bold text-text mb-4">個管師操作</h4>
                        <div className="space-y-3">
                            <button 
                                onClick={handleOpenAddMission}
                                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors cursor-pointer text-sm"
                            >
                                <Send size={16} />
                                <span>派發新任務/問卷</span>
                            </button>
                            <button className="w-full flex items-center justify-center space-x-2 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-medium hover:bg-rose-100 transition-colors cursor-pointer text-sm">
                                <Heart size={16} />
                                <span>關懷介入</span>
                            </button>
                        </div>
                    </div>

                    {/* Super Admin Assignment Section */}
                    {isAdmin && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100/50 bg-purple-50/10">
                            <h4 className="font-bold text-purple-900 mb-4 flex items-center space-x-2">
                                <UserPlus size={18} />
                                <span>個案分配管理</span>
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-purple-700 mb-1.5 ml-1">選擇負責個管師</label>
                                    <select 
                                        className="w-full px-3 py-2 border border-purple-100 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                                        value={selectedManager}
                                        onChange={(e) => setSelectedManager(e.target.value)}
                                        disabled={isAssigning}
                                    >
                                        <option value="">-- 請選擇個管師 --</option>
                                        {caseManagers.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.display_name} ({m.username})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button 
                                    onClick={handleAssign}
                                    disabled={isAssigning || !selectedManager}
                                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                                        isAssigning || !selectedManager 
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                        : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-200 cursor-pointer'
                                    }`}
                                >
                                    {isAssigning ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <>
                                            <UserPlus size={16} />
                                            <span>確認指派</span>
                                        </>
                                    )}
                                </button>
                                <button 
                                    onClick={handleUnassign}
                                    disabled={isAssigning}
                                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                                        isAssigning 
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                        : 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 cursor-pointer'
                                    }`}
                                >
                                    <UserMinus size={16} />
                                    <span>解除所有指派</span>
                                </button>
                                <p className="text-[10px] text-purple-400 text-center italic">
                                    註：指派後該個管師即可管理此病患
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Task & Feedback History */}
                <div className="md:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-sky-100/50 overflow-hidden">
                        <div className="flex border-b border-sky-100/50">
                            <button
                                className={`flex-1 py-4 text-center font-bold text-sm transition-colors cursor-pointer ${activeTab === 'tasks' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text/50 hover:bg-sky-50'}`}
                                onClick={() => setActiveTab('tasks')}
                            >
                                任務執行紀錄
                            </button>
                            <button
                                className={`flex-1 py-4 text-center font-bold text-sm transition-colors cursor-pointer ${activeTab === 'health' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text/50 hover:bg-sky-50'}`}
                                onClick={() => setActiveTab('health')}
                            >
                                健康數據與問卷
                            </button>
                        </div>

                        <div className="p-6 relative">
                            {activeTab === 'tasks' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-4 border-b border-sky-100 pb-2">
                                        <h3 className="font-bold text-lg text-primary flex items-center space-x-2">
                                            <span>目前指派的任務</span>
                                            <span className="text-sm font-bold bg-sky-100 text-primary px-2 py-0.5 rounded-full">{assignedMissions.length}</span>
                                        </h3>
                                        
                                        {assignedMissions.length > 0 && (
                                            isEditingMissions ? (
                                                <div className="flex items-center space-x-3">
                                                    <button 
                                                        onClick={toggleSelectAllMissions}
                                                        className="text-sm text-primary font-medium hover:underline cursor-pointer"
                                                    >
                                                        {selectedEditMissionIds.length === assignedMissions.length ? '取消全選' : '全選'}
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setIsEditingMissions(false);
                                                            setSelectedEditMissionIds([]);
                                                        }}
                                                        className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                                                    >
                                                        完成編輯
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setIsEditingMissions(true)}
                                                    className="px-3 py-1.5 text-primary bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-bold transition-colors cursor-pointer border border-primary/20"
                                                >
                                                    批量編輯
                                                </button>
                                            )
                                        )}
                                    </div>

                                    {assignedMissions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-text/40 bg-sky-50/30 rounded-xl border-2 border-dashed border-sky-100">
                                            <Activity size={48} className="mb-4 opacity-50 text-sky-300" />
                                            <p>此病患尚未被指派任何任務</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
                                            {assignedMissions.map((assignment, idx) => (
                                                <div key={idx} 
                                                     onClick={() => isEditingMissions && toggleEditMission(assignment.mission_id)}
                                                     className={`bg-white p-4 rounded-xl border shadow-sm relative overflow-hidden transition-all ${
                                                        isEditingMissions ? 'cursor-pointer hover:border-primary/50' : ''
                                                     } ${selectedEditMissionIds.includes(assignment.mission_id) ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-sky-100'}`}
                                                >
                                                    {assignment.is_compulsory && (
                                                        <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                                                            必修推播
                                                        </div>
                                                    )}
                                                    <div className="flex items-start space-x-3">
                                                        {isEditingMissions && (
                                                            <div className="pt-1">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-4 h-4 text-primary rounded focus:ring-primary/20 cursor-pointer pointer-events-none"
                                                                    checked={selectedEditMissionIds.includes(assignment.mission_id)}
                                                                    readOnly
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                    {assignment.mission?.type || '一般任務'}
                                                                </span>
                                                                {!isEditingMissions && (
                                                                    <button 
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            if(await requestConfirm('確定要取消指派此任務給該病患嗎？')) {
                                                                                try {
                                                                                    await managementApi.deleteMissionElective(assignment.mission_id, id);
                                                                                    fetchMissions();
                                                                                    showToast('取消指派成功', 'success');
                                                                                } catch(err) { showToast('取消指派失敗: ' + err.message, 'error'); }
                                                                            }
                                                                        }}
                                                                        className="text-text/30 hover:text-rose-500 transition-colors p-1"
                                                                        title="取消指派此任務"
                                                                    >
                                                                        <XCircle size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <h4 className="font-bold text-text mb-1">{assignment.mission?.title || assignment.mission?.name || '未知任務'}</h4>
                                                            <p className="text-xs text-text/60 line-clamp-2 mb-3">{assignment.mission?.description || assignment.mission?.desc || '沒有描述'}</p>
                                                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                                                <span className="text-primary font-medium bg-primary/10 px-2 py-1 rounded">未執行</span>
                                                                <span className="text-text/40">任務 ID: {assignment.mission_id}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Batch Action Bar */}
                                    {isEditingMissions && (
                                        <div className="absolute bottom-6 left-6 right-6 bg-slate-800 text-white p-3 rounded-xl shadow-lg flex items-center justify-between animate-fade-in z-10">
                                            <div className="text-sm font-bold px-2">
                                                已選取 <span className="text-primary-light text-lg px-1">{selectedEditMissionIds.length}</span> 項
                                            </div>
                                            <div className="flex space-x-2">
                                                <button 
                                                    onClick={() => handleBatchProcess('elective')}
                                                    disabled={selectedEditMissionIds.length === 0 || isBatchProcessing}
                                                    className="px-3 py-1.5 text-sm font-medium bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    設為選修
                                                </button>
                                                <button 
                                                    onClick={() => handleBatchProcess('compulsory')}
                                                    disabled={selectedEditMissionIds.length === 0 || isBatchProcessing}
                                                    className="px-3 py-1.5 text-sm font-medium bg-cta hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    設為必修
                                                </button>
                                                <div className="w-px bg-slate-600 mx-1"></div>
                                                <button 
                                                    onClick={() => handleBatchProcess('delete')}
                                                    disabled={selectedEditMissionIds.length === 0 || isBatchProcessing}
                                                    className="px-3 py-1.5 text-sm font-medium bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors text-white disabled:opacity-50 flex items-center space-x-1"
                                                >
                                                    {isBatchProcessing ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                                                    <span>批量刪除</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeTab === 'health' && (
                                <div className="flex flex-col items-center justify-center py-10 text-text/40">
                                    <Activity size={48} className="mb-4 opacity-50" />
                                    <p>暫無最新健康評估資料</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Multiple Mission Assignment Modal */}
            {isAddMissionModalOpen && (
                <div className="fixed inset-0 bg-text/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-sky-100 flex justify-between items-center bg-sky-50/50">
                            <h3 className="text-xl font-bold text-primary font-lora">指派任務給此病患</h3>
                            <button onClick={() => setIsAddMissionModalOpen(false)} className="text-text/50 hover:text-text transition-colors cursor-pointer p-1">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                                <p className="text-xs text-text/50 font-bold mb-1">指派對象</p>
                                <p className="font-bold text-text flex items-center space-x-2">
                                    <span className="text-primary">{patient.display_name}</span>
                                    <span className="text-xs font-bold bg-white px-2 py-0.5 rounded text-text/50 border border-sky-100">@{patient.username}</span>
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-bold text-text text-sm border-b border-sky-100 pb-2">1. 設定派發條件</h4>
                                <div className="pt-2 pb-4">
                                    <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-3 rounded-lg border border-slate-200 hover:bg-white transition-colors">
                                        <input 
                                            type="checkbox" 
                                            className="rounded text-cta focus:ring-cta/20 w-4 h-4 cursor-pointer" 
                                            checked={isCompulsory}
                                            onChange={(e) => setIsCompulsory(e.target.checked)} 
                                        />
                                        <div>
                                            <span className="text-sm font-bold text-text block">設為必修推播強制任務</span>
                                            <p className="text-xs text-text/50 mt-0.5">指派後在使用者的 APP 會標示紅點並置頂。</p>
                                        </div>
                                    </label>
                                </div>

                                <h4 className="font-bold text-text text-sm border-b border-sky-100 pb-2 flex justify-between">
                                    <span>2. 選擇要指派的任務 (可多選)</span>
                                    <span className="text-primary text-xs">已選 {selectedMissionIds.length} 項</span>
                                </h4>
                                
                                <div className="max-h-48 overflow-y-auto border border-sky-100 rounded-lg p-2 bg-slate-50">
                                    {availableMissions.length === 0 ? (
                                        <p className="text-xs text-text/40 text-center py-4">目前任務庫尚無資料，或所有任務皆已指派給此病患。</p>
                                    ) : (
                                        availableMissions.map(m => (
                                            <label key={m.id || m.mission_id} className="flex items-start space-x-3 p-2 hover:bg-white rounded cursor-pointer transition-colors border-b border-slate-100 last:border-0 hover:shadow-sm">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer mt-0.5" 
                                                    checked={selectedMissionIds.includes(m.id || m.mission_id)}
                                                    onChange={(e) => {
                                                        const mId = m.id || m.mission_id;
                                                        if (e.target.checked) setSelectedMissionIds([...selectedMissionIds, mId]);
                                                        else setSelectedMissionIds(selectedMissionIds.filter(id => id !== mId));
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <span className="text-sm font-bold text-text/80 block">{m.title || m.name || '未命名任務'}</span>
                                                    <span className="text-text/40 text-[10px] bg-slate-100 px-1 py-0.5 rounded mt-1 inline-block">{m.type || m.category || '一般任務'}</span>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-sky-100 flex justify-end space-x-3 bg-slate-50">
                            <button onClick={() => setIsAddMissionModalOpen(false)} disabled={isSubmittingMissions} className="px-5 py-2 text-text/70 font-medium hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200 bg-white">
                                取消
                            </button>
                            <button 
                                onClick={handleAssignMissions} 
                                disabled={isSubmittingMissions || selectedMissionIds.length === 0} 
                                className={`px-5 py-2 font-medium rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-2 ${
                                    selectedMissionIds.length === 0 ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-primary text-white hover:bg-primary-light'
                                }`}
                            >
                                {isSubmittingMissions ? <Loader2 size={16} className="animate-spin" /> : null}
                                <span>確認派發</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDetail;
