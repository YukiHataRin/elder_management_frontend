import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, PlayCircle, BookOpen, Brain, Activity, Droplet, Users, X, Loader2 } from 'lucide-react';
import { managementApi } from '../api/management';
import { useToast } from '../context/ToastContext';

const TaskManager = () => {
    const { showToast, requestConfirm } = useToast();
    
    // API state
    const [missions, setMissions] = useState([]);
    const [patients, setPatients] = useState([]);
    const [allAssignments, setAllAssignments] = useState([]);
    const [isLoadingMissions, setIsLoadingMissions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Dynamic categories from API
    const [dynamicCategories, setDynamicCategories] = useState([]);
    const [activeCategoryId, setActiveCategoryId] = useState(null);
    const [availableMissionTypes, setAvailableMissionTypes] = useState([]);

    // UI State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [publishTask, setPublishTask] = useState(null);

    // Publish form state
    const [selectedPatientIds, setSelectedPatientIds] = useState([]);
    const [isCompulsory, setIsCompulsory] = useState(false);

    // New task form state
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDomainId, setNewTaskDomainId] = useState('');
    const [newTaskTypeId, setNewTaskTypeId] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);

    const fetchMissionsAndPatients = async () => {
        setIsLoadingMissions(true);
        try {
            const [missionsData, patientsData, assignmentsData] = await Promise.all([
                managementApi.getMissions(),
                managementApi.getPatients(),
                managementApi.getMissionsElective()
            ]);
            
            if (Array.isArray(missionsData)) {
                setMissions(missionsData);
                
                // 動態提取唯一的健康領域
                const domains = {};
                const types = {};
                missionsData.forEach(m => {
                    if (m.health_domain) domains[m.health_domain.id] = m.health_domain;
                    if (m.mission_type) types[m.mission_type.id] = m.mission_type;
                });
                
                const sortedDomains = Object.values(domains);
                setDynamicCategories(sortedDomains);
                setAvailableMissionTypes(Object.values(types));
                
                // 預設選中第一個領域
                if (sortedDomains.length > 0 && !activeCategoryId) {
                    setActiveCategoryId(sortedDomains[0].id);
                }
            }
            if (Array.isArray(patientsData)) setPatients(patientsData);
            if (Array.isArray(assignmentsData)) setAllAssignments(assignmentsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
        setIsLoadingMissions(false);
    };

    useEffect(() => {
        fetchMissionsAndPatients();
    }, []);

    const combinedTasks = missions
        .filter(m => m.health_domain_id === activeCategoryId)
        .map(m => ({
            id: m.id,
            title: m.name,
            target: '自訂',
            type: m.mission_type?.name || '一般任務',
            desc: m.detail || '',
            isBackend: true
        }));

    const handleCreateMission = async () => {
        if (!newTaskTitle) return showToast('請輸入任務名稱', 'error');
        if (!newTaskDomainId) return showToast('請選擇任務領域', 'error');
        if (!newTaskTypeId) return showToast('請選擇執行模式', 'error');
        
        setIsSubmitting(true);
        try {
            const missionData = {
                name: newTaskTitle,
                detail: newTaskDesc,
                health_domain_id: parseInt(newTaskDomainId),
                mission_type_id: parseInt(newTaskTypeId)
            };
            const createdMission = await managementApi.createMission(missionData);
            const missionId = createdMission.id;

            if (selectedFile && missionId) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                const assetData = await managementApi.createAsset(formData);
                const assetId = assetData.id;

                if (assetId) {
                    await managementApi.createMissionDataRelation({
                        mission_id: missionId,
                        data_asset_id: assetId
                    });
                }
            }

            showToast('任務建立成功！', 'success');
            setIsAddModalOpen(false);
            setNewTaskTitle('');
            setNewTaskDesc('');
            setSelectedFile(null);
            fetchMissionsAndPatients();
        } catch (error) {
            showToast('任務建立失敗: ' + error.message, 'error');
        }
        setIsSubmitting(false);
    };

    const handleOpenPublish = (task) => {
        setPublishTask(task);
        setSelectedPatientIds([]);
        setIsCompulsory(false);
    };

    const handleAssignMission = async () => {
        if (selectedPatientIds.length === 0) return showToast('請至少選擇一位病患', 'error');
        setIsSubmitting(true);
        try {
            await Promise.all(selectedPatientIds.map(uid => 
                managementApi.assignMission({
                    mission_id: publishTask.id || publishTask.mission_id,
                    user_id: uid,
                    is_compulsory: isCompulsory
                })
            ));
            
            showToast('任務發布成功！', 'success');
            setPublishTask(null);
        } catch (error) {
            showToast('發布失敗: ' + error.message, 'error');
        }
        setIsSubmitting(false);
    };

    const alreadyAssignedUserIds = publishTask 
        ? allAssignments.filter(a => String(a.mission_id) === String(publishTask.id || publishTask.mission_id)).map(a => a.user_id) 
        : [];
    const availablePatients = patients.filter(p => !alreadyAssignedUserIds.includes(p.id));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-lora font-bold text-primary">APP 任務庫管理</h2>
                    <p className="text-text/60 mt-1">管理與指派推送至長者端 APP 的健康任務</p>
                </div>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors cursor-pointer shadow-sm flex items-center space-x-2"
                >
                    <Plus size={18} />
                    <span>新增任務</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-sky-100/50 overflow-hidden">
                <div className="flex overflow-x-auto border-b border-sky-100/50 bg-sky-50/20">
                    {dynamicCategories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategoryId(cat.id)}
                            className={`flex items-center space-x-2 px-6 py-4 font-bold text-sm transition-colors border-b-2 whitespace-nowrap cursor-pointer
                                ${activeCategoryId === cat.id
                                    ? `border-primary text-primary bg-primary/5`
                                    : 'border-transparent text-text/50 hover:bg-sky-50'
                                }`}
                        >
                            <span>{cat.name}</span>
                        </button>
                    ))}
                    {dynamicCategories.length === 0 && (
                        <div className="px-6 py-4 text-sm text-text/40 italic">尚無動態分類資料</div>
                    )}
                </div>

                <div className="p-4 border-b border-sky-100/50 flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="relative w-full sm:w-80">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-text/40" />
                        </div>
                        <input
                            type="text"
                            placeholder="搜尋任務名稱..."
                            className="w-full pl-10 pr-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                        />
                    </div>
                </div>

                <div className="p-6">
                    {isLoadingMissions ? (
                        <div className="py-10 text-center text-text/40 flex justify-center"><Loader2 size={32} className="animate-spin" /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {combinedTasks.map((task, idx) => (
                                <div key={task.id || idx} className="relative group bg-white border border-sky-100 shadow-sm rounded-xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all flex flex-col h-full">
                                    <div className="p-5 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                                {task.type}
                                            </span>
                                        </div>

                                        <h3 className="font-bold text-lg text-text mb-2 line-clamp-1" title={task.title}>{task.title}</h3>
                                        <p className="text-text/70 text-sm line-clamp-3 h-14 mb-4">{task.desc}</p>
                                    </div>

                                    <div className="bg-sky-50/50 p-3 flex justify-end gap-2 border-t border-sky-100 auto-mt">
                                        <button 
                                            onClick={async () => {
                                                if(await requestConfirm('確定刪除此任務？')) {
                                                    managementApi.deleteMission(task.id)
                                                    .then(() => {
                                                        showToast('任務已刪除', 'success');
                                                        fetchMissionsAndPatients();
                                                    })
                                                    .catch(e => showToast(e.message, 'error'));
                                                }
                                            }}
                                            className="px-3 py-1.5 text-sm font-medium text-text/70 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                        >
                                            刪除
                                        </button>
                                        <button 
                                            onClick={() => handleOpenPublish(task)}
                                            className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-white rounded-md transition-colors cursor-pointer border border-transparent hover:border-primary/20 backdrop-blur-sm"
                                        >
                                            發布指派
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <div 
                                onClick={() => setIsAddModalOpen(true)}
                                className="bg-sky-50/30 border-2 border-dashed border-sky-200 rounded-xl flex flex-col items-center justify-center min-h-[220px] text-text/40 hover:bg-sky-50 hover:text-primary hover:border-primary/40 transition-colors cursor-pointer group"
                            >
                                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Plus size={24} className="text-text/40 group-hover:text-primary transition-colors" />
                                </div>
                                <span className="font-medium text-sm">新增 {dynamicCategories.find(c => c.id === activeCategoryId)?.name || '任務'}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 bg-text/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-sky-100 flex justify-between items-center bg-sky-50/50">
                            <h3 className="text-xl font-bold text-primary font-lora">新增任務</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-text/50 hover:text-text transition-colors cursor-pointer p-1">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-text mb-1">任務名稱 <span className="text-rose-500">*</span></label>
                                <input 
                                    type="text" 
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="輸入任務名稱" 
                                    className="w-full px-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-text mb-1">任務領域 <span className="text-rose-500">*</span></label>
                                    <select 
                                        value={newTaskDomainId}
                                        onChange={(e) => setNewTaskDomainId(e.target.value)}
                                        className="w-full px-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                                    >
                                        <option value="">選擇領域...</option>
                                        {dynamicCategories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-text mb-1">執行模式 <span className="text-rose-500">*</span></label>
                                    <select 
                                        value={newTaskTypeId}
                                        onChange={(e) => setNewTaskTypeId(e.target.value)}
                                        className="w-full px-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                                    >
                                        <option value="">選擇模式...</option>
                                        {availableMissionTypes.map(type => (
                                            <option key={type.id} value={type.id}>{type.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-text mb-1">任務描述</label>
                                <textarea 
                                    rows="3" 
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                    placeholder="描述任務內容與執行方式..." 
                                    className="w-full px-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-text mb-1">衛教教材上傳 (Assets API)</label>
                                <label className="border-2 border-dashed border-sky-200 rounded-lg p-6 flex flex-col items-center justify-center text-text/50 hover:bg-sky-50 transition-colors cursor-pointer w-full relative">
                                    <Plus size={32} className="mb-2 text-primary/50" />
                                    <span className="text-sm font-medium">{selectedFile ? selectedFile.name : '點擊上傳圖片或影片'}</span>
                                    <span className="text-xs mt-1">支援 JPG, PNG, MP4 格式</span>
                                    <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setSelectedFile(e.target.files[0])} />
                                </label>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-sky-100 flex justify-end space-x-3 bg-slate-50">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-5 py-2 text-text/70 font-medium hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200 bg-white" disabled={isSubmitting}>
                                取消
                            </button>
                            <button onClick={handleCreateMission} disabled={isSubmitting} className="px-5 py-2 bg-primary text-white font-medium hover:bg-primary-light rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-2">
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                                <span>建立並儲存</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {publishTask && (
                <div className="fixed inset-0 bg-text/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-sky-100 flex justify-between items-center bg-sky-50/50">
                            <h3 className="text-xl font-bold text-primary font-lora">發布與指派任務</h3>
                            <button onClick={() => setPublishTask(null)} className="text-text/50 hover:text-text transition-colors cursor-pointer p-1">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                                <p className="text-xs text-text/50 font-bold mb-1">指派目標任務</p>
                                <p className="font-bold text-text flex items-center space-x-2">
                                    <span className="text-primary">{publishTask.title}</span>
                                    <span className="text-xs font-bold bg-white px-2 py-0.5 rounded text-text/50 border border-sky-100">ID: {publishTask.id}</span>
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-bold text-text text-sm border-b border-sky-100 pb-2">選擇指派對象 (病患清單)</h4>
                                
                                <div className="max-h-48 overflow-y-auto border border-sky-100 rounded-lg p-2 bg-slate-50">
                                    {availablePatients.length === 0 ? (
                                        <p className="text-xs text-text/40 text-center py-4">所有病患皆已指派此任務，或尚無病患資料。</p>
                                    ) : (
                                        availablePatients.map(p => (
                                            <label key={p.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded cursor-pointer transition-colors border-b border-slate-100 last:border-0 hover:shadow-sm">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer" 
                                                    checked={selectedPatientIds.includes(p.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedPatientIds([...selectedPatientIds, p.id]);
                                                        else setSelectedPatientIds(selectedPatientIds.filter(id => id !== p.id));
                                                    }}
                                                />
                                                <span className="text-sm font-bold text-text/80">{p.display_name} <span className="text-text/40 text-xs font-normal font-mono ml-1">@{p.username}</span></span>
                                            </label>
                                        ))
                                    )}
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="rounded text-cta focus:ring-cta/20 w-4 h-4 cursor-pointer" 
                                            checked={isCompulsory}
                                            onChange={(e) => setIsCompulsory(e.target.checked)} 
                                        />
                                        <span className="text-sm font-bold text-text">設為必修推播強制任務</span>
                                    </label>
                                    <p className="text-xs text-text/50 mt-1 pl-6">長者 APP 端將會顯示紅點提示並置頂於任務列表。</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-sky-100 flex justify-end space-x-3 bg-slate-50">
                            <button onClick={() => setPublishTask(null)} disabled={isSubmitting} className="px-5 py-2 text-text/70 font-medium hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200 bg-white">
                                取消
                            </button>
                            <button onClick={handleAssignMission} disabled={isSubmitting} className="px-5 py-2 bg-cta text-white font-medium hover:bg-green-600 rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-2">
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                                <span>儲存並指派 ({selectedPatientIds.length}人)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskManager;
