import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Phone, MapPin, Activity, CheckCircle, XCircle, Heart, Star, Send, Loader2, UserPlus, FileText, Search, SlidersHorizontal, RotateCcw, Edit3, ClipboardCheck, ClipboardList, Eye, Trash2, Download, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { managementApi } from '../api/management';
import { formsApi } from '../api/forms';
import { getQuestionnaireFieldGroups } from '../utils/questionnaire';
import { buildQuestionnaireXlsxFilename, downloadBlob } from '../utils/download';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { apiFetchBlob } from '../api/client'; // Import apiFetchBlob

const MISSION_LOGS_PAGE_SIZE = 20;
const TEXT_PREVIEW_EXTENSIONS = ['txt', 'log', 'md', 'csv', 'json'];
const TEXT_PREVIEW_MAX_CHARS = 20000;

// Helper component to display mission return media
const MissionMediaDisplay = ({ assetId, mimeType, assetData }) => {
    const mediaContainerRef = useRef(null);
    const [mediaUrl, setMediaUrl] = useState(null);
    const [loadingMedia, setLoadingMedia] = useState(true);
    const [errorMedia, setErrorMedia] = useState(false);
    const [fetchedMimeType, setFetchedMimeType] = useState('');
    const [shouldLoadMedia, setShouldLoadMedia] = useState(false);
    const [textContent, setTextContent] = useState(null);
    const [textTruncated, setTextTruncated] = useState(false);

    useEffect(() => {
        const container = mediaContainerRef.current;
        if (!container || shouldLoadMedia) return undefined;

        if (typeof IntersectionObserver === 'undefined') {
            setShouldLoadMedia(true);
            return undefined;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setShouldLoadMedia(true);
                observer.disconnect();
            }
        }, { rootMargin: '240px 0px' });

        observer.observe(container);
        return () => observer.disconnect();
    }, [shouldLoadMedia]);

    useEffect(() => {
        let objectUrl = null;
        let disposed = false;
        const controller = new AbortController();

        if (!shouldLoadMedia) return undefined;
        
        const fetchMedia = async () => {
            setLoadingMedia(true);
            setErrorMedia(false);
            setTextContent(null);
            setTextTruncated(false);
            try {
                // 1. 確定檔案路徑 (urlPath)
                let urlPath = assetData?.url || (typeof assetId === 'string' && (assetId.includes('/') || assetId.includes('\\')) ? assetId : null);
                
                // 如果只有數字 ID，必須先請求資產資訊以獲取 URL
                if (!urlPath && assetId) {
                    try {
                        const assetInfo = await managementApi.getAsset(assetId);
                        urlPath = assetInfo.url;
                    } catch (e) {
                        console.error('Failed to get asset info:', e);
                        throw e;
                    }
                }

                if (!urlPath) {
                    setLoadingMedia(false);
                    return;
                }

                // 2. 透過 /assets/url/ 獲取實際檔案 Blob
                // 使用 encodeURIComponent 確保路徑中的斜線被正確處理
                const fetchPath = `/assets/url/${encodeURIComponent(urlPath)}`;
                const blob = await apiFetchBlob(fetchPath, { signal: controller.signal });

                if (disposed) return;

                const fileExtension = urlPath.split('.').pop()?.toLowerCase() || '';
                const responseMimeType = (blob.type || mimeType || '').toLowerCase();
                const isTextFile = responseMimeType.startsWith('text/')
                    || responseMimeType === 'application/json'
                    || TEXT_PREVIEW_EXTENSIONS.includes(fileExtension);

                if (blob.type && blob.type !== 'application/octet-stream') {
                    setFetchedMimeType(blob.type);
                }

                if (isTextFile) {
                    const bytes = await blob.arrayBuffer();
                    if (disposed) return;

                    let decodedText;
                    try {
                        decodedText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                    } catch {
                        decodedText = new TextDecoder('big5').decode(bytes);
                    }
                    setTextContent(decodedText.slice(0, TEXT_PREVIEW_MAX_CHARS));
                    setTextTruncated(decodedText.length > TEXT_PREVIEW_MAX_CHARS);
                }
                
                objectUrl = URL.createObjectURL(blob);
                setMediaUrl(objectUrl);
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch media asset:', error);
                setErrorMedia(true);
            } finally {
                if (!disposed) setLoadingMedia(false);
            }
        };

        fetchMedia();

        return () => {
            disposed = true;
            controller.abort();
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [assetId, assetData, mimeType, shouldLoadMedia]);

    if (!shouldLoadMedia) {
        return (
            <div
                ref={mediaContainerRef}
                aria-label="成果媒體等待載入"
                className="h-24 w-full animate-pulse rounded-lg border border-slate-100 bg-slate-50"
            />
        );
    }

    if (loadingMedia) {
        return (
            <div className="flex items-center justify-center h-24 w-full bg-slate-50 text-slate-400 rounded-lg">
                <Loader2 size={20} className="animate-spin mr-2" /> 載入中...
            </div>
        );
    }

    if (errorMedia) {
        return (
            <div className="flex items-center justify-center h-24 w-full bg-rose-50 text-rose-400 rounded-lg">
                <XCircle size={20} className="mr-2" /> 載入失敗
            </div>
        );
    }

    if (!mediaUrl) return null;

    // 取得路徑與副檔名
    const path = assetData?.url || assetId || '';
    const ext = typeof path === 'string' ? path.split('.').pop().toLowerCase() : '';
    const currentMime = (fetchedMimeType || mimeType || '').toLowerCase();
    const fileName = typeof path === 'string' ? path.split('/').pop() : `file_${assetId}`;
    
    // 類型判斷
    const isImage = currentMime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
    const isVideo = currentMime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
    const isAudio = currentMime.startsWith('audio/') || ['mp3', 'wav', 'aac', 'm4a'].includes(ext);
    const isText = currentMime.startsWith('text/')
        || currentMime === 'application/json'
        || TEXT_PREVIEW_EXTENSIONS.includes(ext);

    if (isText) {
        return (
            <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="min-w-0 truncate text-xs font-bold text-slate-600">{fileName}</span>
                    <a
                        href={mediaUrl}
                        download={fileName}
                        aria-label={`下載 ${fileName}`}
                        title="下載文字檔"
                        className="shrink-0 rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
                    >
                        <Download size={16} />
                    </a>
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words px-3 py-3 text-sm leading-6 text-slate-700">
                    {textContent || '（空白檔案）'}
                </pre>
                {textTruncated && (
                    <p className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        內容較長，畫面僅顯示前 {TEXT_PREVIEW_MAX_CHARS.toLocaleString()} 字；可下載查看完整內容。
                    </p>
                )}
            </div>
        );
    } else if (isImage) {
        return <img src={mediaUrl} alt="任務成果" className="max-h-60 w-auto rounded-lg shadow-sm border border-slate-200 object-contain mx-auto" />;
    } else if (isVideo) {
        return (
            <video controls className="max-h-60 w-auto rounded-lg shadow-sm border border-slate-200 mx-auto">
                <source src={mediaUrl} type={currentMime.startsWith('video/') ? currentMime : `video/${ext || 'mp4'}`} />
                您的瀏覽器不支援影片播放。
            </video>
        );
    } else if (isAudio) {
        return (
            <div className="w-full p-2 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 mb-2 uppercase flex items-center gap-1">
                    <Activity size={10} /> 錄音成果回傳
                </span>
                <audio controls className="w-full h-10">
                    <source src={mediaUrl} type={currentMime.startsWith('audio/') ? currentMime : `audio/${ext || 'mpeg'}`} />
                </audio>
            </div>
        );
    } else {
        return (
            <a href={mediaUrl} download={fileName} className="flex flex-col items-center justify-center p-4 bg-primary/5 text-primary rounded-xl border border-primary/20 hover:bg-primary/10 transition-colors w-full">
                <FileText size={24} className="mb-2" />
                <span className="font-medium text-center truncate w-full px-2">{fileName}</span>
                <span className="text-[10px] opacity-60 mt-1 uppercase">{ext || 'FILE'}</span>
            </a>
        );
    }
};

const getQuestionnaireFieldMeta = (template) => {
    const metas = [];
    const seen = new Set();
    getQuestionnaireFieldGroups(template || {}).forEach(group => {
        group.fields.forEach(field => {
            if (!field?.id || seen.has(field.id)) return;
            seen.add(field.id);
            metas.push({
                id: field.id,
                label: field.label || field.id,
                section: group.title,
                options: Array.isArray(field.options)
                    ? Object.fromEntries(field.options.map(option => [String(option.value), option.label ?? option.value]))
                    : {},
            });
        });
    });
    return metas;
};

const formatQuestionnaireAnswer = (value, fieldMeta) => {
    if (value === undefined || value === null || value === '') return '未填';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (Array.isArray(value)) return value.map(item => formatQuestionnaireAnswer(item, fieldMeta)).join('、');
    const optionLabel = fieldMeta?.options?.[String(value)];
    return String(optionLabel ?? value);
};

const formatQuestionnaireScoreValue = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
        return numberValue.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
    }
    return String(value);
};

const getQuestionnaireScoreSummary = (response) => {
    const totalScore = formatQuestionnaireScoreValue(response?.score_json?.total_score);
    const componentScores = response?.score_json?.component_scores;
    const assessmentGroups = response?.assessment_result_json?.matched_groups;
    const scoreGroupLabels = response?.score_json?.matched_group_labels;
    const parts = [];

    if (totalScore !== null) parts.push(`總分：${totalScore} 分`);
    if (Array.isArray(assessmentGroups) && assessmentGroups.length > 0) {
        const labels = assessmentGroups.map(group => group?.label || group?.code).filter(Boolean);
        if (labels.length > 0) parts.push(`收案分類：${labels.join('、')}`);
    } else if (Array.isArray(scoreGroupLabels) && scoreGroupLabels.length > 0) {
        parts.push(`收案分類：${scoreGroupLabels.filter(Boolean).join('、')}`);
    }
    if (componentScores && typeof componentScores === 'object' && !Array.isArray(componentScores)) {
        Object.entries(componentScores).forEach(([label, value]) => {
            const score = formatQuestionnaireScoreValue(value);
            if (score !== null) parts.push(`${label}：${score} 分`);
        });
    }

    return parts.join(' / ');
};

const getQuestionnaireFillerLabel = (response) => {
    if (!response) return '尚未記錄';
    const name = response.filled_by_display_name;
    const username = response.filled_by_username;
    const role = response.filled_by_role_name;
    const identity = [name, username ? `@${username}` : null].filter(Boolean).join(' ');
    return [identity || `使用者 #${response.filled_by_user_id}`, role].filter(Boolean).join(' / ');
};

const VISIT_OPTIONS = ['V1', 'V2', 'V3', 'V4'];
const VISIT_META = {
    V1: {
        label: 'V1',
        title: 'V1 初評資料',
        className: 'border-rose-100 bg-rose-50/70',
        badgeClassName: 'border-rose-200 bg-white text-rose-700',
        accentClassName: 'bg-rose-400',
    },
    V2: {
        label: 'V2',
        title: 'V2 追蹤資料',
        className: 'border-amber-100 bg-amber-50/70',
        badgeClassName: 'border-amber-200 bg-white text-amber-700',
        accentClassName: 'bg-amber-400',
    },
    V3: {
        label: 'V3',
        title: 'V3 追蹤資料',
        className: 'border-sky-100 bg-sky-50/70',
        badgeClassName: 'border-sky-200 bg-white text-sky-700',
        accentClassName: 'bg-sky-400',
    },
    V4: {
        label: 'V4',
        title: 'V4 結案資料',
        className: 'border-emerald-100 bg-emerald-50/70',
        badgeClassName: 'border-emerald-200 bg-white text-emerald-700',
        accentClassName: 'bg-emerald-400',
    },
    OTHER: {
        label: '未分 Visit',
        title: '未分 Visit',
        className: 'border-slate-100 bg-slate-50/70',
        badgeClassName: 'border-slate-200 bg-white text-slate-600',
        accentClassName: 'bg-slate-300',
    },
};

const normalizeVisit = (visit) => {
    const normalized = String(visit || '').trim().toUpperCase();
    return VISIT_OPTIONS.includes(normalized) ? normalized : 'OTHER';
};

const buildVisitGroups = (responses) => {
    const grouped = [...VISIT_OPTIONS, 'OTHER'].map(visit => ({
        visit,
        meta: VISIT_META[visit],
        responses: [],
    }));
    const byVisit = Object.fromEntries(grouped.map(group => [group.visit, group]));
    responses.forEach(response => {
        byVisit[normalizeVisit(response.visit)]?.responses.push(response);
    });
    return grouped.filter(group => group.responses.length > 0);
};

const getQuestionnaireAssessmentDate = (response) => {
    const value = response?.assessment_date || response?.answers_json?.assessment_date || '';
    return typeof value === 'string' ? value.slice(0, 10) : '';
};

const formatQuestionnaireDate = (dateString) => {
    if (!dateString) return '未設定';
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
};

const getComparisonResponseLabel = (response) => [
    `回覆 #${response.id}`,
    normalizeVisit(response.visit) === 'OTHER' ? '未分 Visit' : normalizeVisit(response.visit),
    formatQuestionnaireDate(getQuestionnaireAssessmentDate(response)),
].join(' / ');


const PatientDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isAdmin, user } = useAuth();
    const { showToast, requestConfirm } = useToast();
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get('tab');
        return ['tasks', 'health', 'notifications'].includes(tab) ? tab : 'tasks';
    });
    const [taskSubTab, setTaskSubTab] = useState('assigned'); // 'assigned' or 'history'
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Assignment states
    const [caseManagers, setCaseManagers] = useState([]);
    const [selectedManagerIds, setSelectedManagerIds] = useState([]);
    const [isAssigning, setIsAssigning] = useState(false);
    
    // Mission states
    const [assignedMissions, setAssignedMissions] = useState([]);
    const [missionLogs, setMissionLogs] = useState([]);
    const [missionReturns, setMissionReturns] = useState([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);

    const [isAddMissionModalOpen, setIsAddMissionModalOpen] = useState(false);
    const [allMissions, setAllMissions] = useState([]);
    const [selectedMissionIds, setSelectedMissionIds] = useState([]);
    const [isCompulsory, setIsCompulsory] = useState(false);
    const [isSubmittingMissions, setIsSubmittingMissions] = useState(false);
    const [missionAssignSearch, setMissionAssignSearch] = useState('');
    const [missionAssignDomainFilter, setMissionAssignDomainFilter] = useState('all');
    const [missionAssignTypeFilter, setMissionAssignTypeFilter] = useState('all');

    // Batch Edit states
    const [isEditingMissions, setIsEditingMissions] = useState(false);
    const [selectedEditMissionIds, setSelectedEditMissionIds] = useState([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    
    // New states for Mission Logs filtering
    const [logFilterStatus, setLogFilterStatus] = useState('all'); // 'all', 'completed', 'uncompleted', 'in_progress'
    const [logFilterTime, setLogFilterTime] = useState('all'); // 'all', 'week', 'month'
    const [logFilterReturn, setLogFilterReturn] = useState('all'); // 'all', 'with_return', 'without_return'
    const [logFilterKeyword, setLogFilterKeyword] = useState('');
    const [logPage, setLogPage] = useState(1);

    // Notifications state
    const [notifications, setNotifications] = useState([]);
    const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
    const [newNotifTitle, setNewNotifTitle] = useState('');
    const [newNotifContent, setNewNotifContent] = useState('');
    const [isSendingNotif, setIsSendingNotif] = useState(false);

    // Questionnaire states
    const [questionnaireTemplates, setQuestionnaireTemplates] = useState([]);
    const [questionnaireResponses, setQuestionnaireResponses] = useState([]);
    const [archivedQuestionnaireResponses, setArchivedQuestionnaireResponses] = useState([]);
    const [isQuestionnairesLoading, setIsQuestionnairesLoading] = useState(false);
    const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
    const [questionnaireSearch, setQuestionnaireSearch] = useState('');
    const [questionnaireCategoryFilter, setQuestionnaireCategoryFilter] = useState('all');
    const [selectedQuestionnaireIds, setSelectedQuestionnaireIds] = useState([]);
    const [selectedQuestionnaireVisit, setSelectedQuestionnaireVisit] = useState('V1');
    const [isDispatchingQuestionnaires, setIsDispatchingQuestionnaires] = useState(false);
    const [questionnaireComparison, setQuestionnaireComparison] = useState(null);
    const [comparingResponseId, setComparingResponseId] = useState(null);
    const [openQuestionnaireActionMenu, setOpenQuestionnaireActionMenu] = useState(null);
    const [comparisonBaseResponse, setComparisonBaseResponse] = useState(null);
    const [comparisonSelectedResponseIds, setComparisonSelectedResponseIds] = useState([]);
    const [comparisonVisitFilters, setComparisonVisitFilters] = useState([...VISIT_OPTIONS, 'OTHER']);
    const [comparisonStatusFilter, setComparisonStatusFilter] = useState('all');
    const [comparisonDateFrom, setComparisonDateFrom] = useState('');
    const [comparisonDateTo, setComparisonDateTo] = useState('');
    const [comparisonKeyword, setComparisonKeyword] = useState('');
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [isComparingQuestionnaires, setIsComparingQuestionnaires] = useState(false);

    useEffect(() => {
        if (!openQuestionnaireActionMenu) return undefined;
        const closeMenu = () => setOpenQuestionnaireActionMenu(null);
        window.addEventListener('resize', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
        return () => {
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
        };
    }, [openQuestionnaireActionMenu]);

    const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
    const [isSavingPatient, setIsSavingPatient] = useState(false);
    const [editPatientForm, setEditPatientForm] = useState({
        username: '',
        display_name: '',
        password: '',
        birthday: '',
        gender_id: 1,
        nation_id: '',
        sarcopenia_level: 'E',
        phone_number: '',
        address: '',
        is_psychiatric: false,
        is_dental: false
    });

    const getManagerIds = useCallback((user) => (user?.managers || []).map(m => String(m.id)), []);

    const fetchDetail = useCallback(async () => {
        await Promise.resolve();
        setLoading(true);
        try {
            const [data, assignments] = await Promise.all([
                managementApi.getPatientDetail(id),
                managementApi.getUserManagerAssignments(id)
            ]);
            const patientWithManagers = {
                ...data,
                managers: (assignments || []).map(assignment => assignment.manager).filter(Boolean)
            };
            setPatient(patientWithManagers);
            setSelectedManagerIds(getManagerIds(patientWithManagers));
        } catch (error) {
            console.error('Failed to fetch patient detail:', error);
        }
        setLoading(false);
    }, [id, getManagerIds]);

    const fetchManagers = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const data = await managementApi.getBackendUsers(2); // Role 2 = Case Managers
            setCaseManagers(data);
        } catch (error) {
            console.error('Failed to fetch managers:', error);
        }
    }, [isAdmin]);

    const fetchMissions = useCallback(async () => {
        try {
            const data = await managementApi.getMissionsElective();
            const userMissions = data.filter(m => String(m.user_id) === String(id));
            setAssignedMissions(userMissions);
        } catch (error) {
            console.error('Failed to fetch assigned missions:', error);
        }
    }, [id]);

    const fetchLogs = useCallback(async () => {
        await Promise.resolve();
        setIsLogsLoading(true);
        try {
            const [userLogs, userReturns] = await Promise.all([
                managementApi.getMissionLogs(id),
                managementApi.getMissionReturns(id)
            ]);

            setMissionLogs(userLogs || []);
            setMissionReturns(userReturns || []);
        } catch (error) {
            console.error('Failed to fetch mission logs:', error);
        } finally {
            setIsLogsLoading(false);
        }
    }, [id]);

    const fetchNotifications = useCallback(async () => {
        await Promise.resolve();
        setIsNotificationsLoading(true);
        try {
            const data = await managementApi.getUserNotifications(id);
            if (Array.isArray(data)) {
                setNotifications(data.sort((a, b) => new Date(b.send_at) - new Date(a.send_at)));
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setIsNotificationsLoading(false);
        }
    }, [id]);

    const fetchQuestionnaireData = useCallback(async () => {
        await Promise.resolve();
        setIsQuestionnairesLoading(true);
        try {
            const [templates, responses, archivedResponses] = await Promise.all([
                formsApi.listQuestionnaires(),
                formsApi.listSubjectResponsesByBackendUser(id),
                formsApi.listArchivedResponses({ subjectBackendUserId: id })
            ]);

            setQuestionnaireTemplates(Array.isArray(templates) ? templates : []);
            setQuestionnaireResponses(
                Array.isArray(responses)
                    ? [...responses].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
                    : []
            );
            setArchivedQuestionnaireResponses(
                Array.isArray(archivedResponses)
                    ? [...archivedResponses].sort((a, b) => new Date(b.archived_at || b.updated_at || b.created_at) - new Date(a.archived_at || a.updated_at || a.created_at))
                    : []
            );
            setQuestionnaireComparison(prev => {
                if (!prev || !Array.isArray(responses)) return prev;
                return responses.some(response => response.id === prev.baseResponseId) ? prev : null;
            });
        } catch (error) {
            console.error('Failed to fetch questionnaire data:', error);
            showToast('載入問卷資料失敗: ' + error.message, 'error');
        } finally {
            setIsQuestionnairesLoading(false);
        }
    }, [id, showToast]);

    const handleChangeActiveTab = (tab) => {
        setActiveTab(tab);
        if (tab === 'tasks') {
            setSearchParams({});
        } else {
            setSearchParams({ tab });
        }
    };

    const getQuestionnaireSubjectId = () => patient?.details?.nation_id?.trim();

    const getResponsesForTemplate = (templateId) => questionnaireResponses.filter(response => (
        String(response.template_id) === String(templateId)
    ));

    const handleOpenQuestionnaireModal = () => {
        if (!getQuestionnaireSubjectId()) {
            showToast('此個案尚未填寫身分/代碼，請先編輯個案資料', 'error');
            setActiveTab('health');
            setSearchParams({ tab: 'health' });
            return;
        }

        setQuestionnaireSearch('');
        setQuestionnaireCategoryFilter('all');
        setSelectedQuestionnaireIds([]);
        setSelectedQuestionnaireVisit('V1');
        setIsQuestionnaireModalOpen(true);
    };

    const toggleSelectedQuestionnaire = (templateId) => {
        setSelectedQuestionnaireIds(prev => (
            prev.includes(templateId)
                ? prev.filter(id => id !== templateId)
                : [...prev, templateId]
        ));
    };

    const handleDispatchQuestionnaires = async () => {
        const nationId = getQuestionnaireSubjectId();
        if (!nationId) return showToast('請先補上個案身分/代碼', 'error');
        if (selectedQuestionnaireIds.length === 0) return showToast('請選擇至少一份問卷', 'error');

        setIsDispatchingQuestionnaires(true);
        try {
            const today = new Date().toISOString().slice(0, 10);
            const createdResponses = await Promise.all(selectedQuestionnaireIds.map(templateId => formsApi.createDraft(templateId, {
                subject_nation_id: nationId,
                subject_backend_user_id: parseInt(id),
                answers_json: {
                    subject_code: nationId,
                    visit: selectedQuestionnaireVisit,
                    assessment_date: today
                }
            })));

            await fetchQuestionnaireData(nationId);
            setIsQuestionnaireModalOpen(false);
            setSelectedQuestionnaireIds([]);
            setActiveTab('health');
            setSearchParams({ tab: 'health' });

            showToast(`已派發 ${createdResponses.length} 份問卷`, 'success');
        } catch (error) {
            console.error('Failed to dispatch questionnaires:', error);
            showToast('派發問卷失敗: ' + error.message, 'error');
        } finally {
            setIsDispatchingQuestionnaires(false);
        }
    };

    const openQuestionnaireCompareModal = (baseResponse) => {
        setComparisonBaseResponse(baseResponse);
        setComparisonSelectedResponseIds([baseResponse.id]);
        setComparisonVisitFilters([...VISIT_OPTIONS, 'OTHER']);
        setComparisonStatusFilter('all');
        setComparisonDateFrom('');
        setComparisonDateTo('');
        setComparisonKeyword('');
        setIsComparisonModalOpen(true);
    };

    const closeQuestionnaireCompareModal = () => {
        if (isComparingQuestionnaires) return;
        setIsComparisonModalOpen(false);
        setComparisonBaseResponse(null);
    };

    const normalizeComparisonResult = (result, includeUnchanged) => ({
        baseResponseId: comparisonBaseResponse?.id,
        templateTitle: result.template_title || getQuestionnaireTemplate(comparisonBaseResponse?.template_id)?.title || comparisonBaseResponse?.template_title || `問卷 #${comparisonBaseResponse?.template_id}`,
        comparedResponses: result.responses || [],
        rows: (result.differences || []).map(row => ({
            field_id: row.field_id,
            section: row.section,
            label: row.label,
            values: row.values || [],
            isDifferent: Boolean(row.is_different ?? row.isDifferent),
            hasAnyValue: Boolean(row.has_any_value ?? row.hasAnyValue),
        })),
        noPeers: false,
        canCompare: result.can_compare !== false,
        reason: result.reason,
        responseIds: result.responses?.map(response => response.id) || [],
        includeUnchanged,
    });

    const runQuestionnaireComparison = async (responseIds = comparisonSelectedResponseIds, includeUnchanged = false) => {
        const nationId = getQuestionnaireSubjectId();
        if (!nationId) return showToast('此個案尚未填寫身分/代碼，無法比對問卷', 'error');
        if (responseIds.length < 2) return showToast('請至少選擇兩筆同一份問卷紀錄', 'error');

        setIsComparingQuestionnaires(true);
        setComparingResponseId(comparisonBaseResponse?.id || null);
        try {
            const result = await formsApi.compareSubjectResponses(nationId, responseIds, { includeUnchanged });
            const normalized = normalizeComparisonResult(result, includeUnchanged);
            setQuestionnaireComparison(normalized);
            setIsComparisonModalOpen(false);
            if (normalized.canCompare === false) {
                showToast(normalized.reason || '這些問卷紀錄無法比對', 'error');
            } else if (!includeUnchanged && normalized.rows.length === 0) {
                showToast('目前沒有不一致的填答內容', 'info');
            }
        } catch (error) {
            console.error('Failed to compare questionnaire responses:', error);
            showToast('比對問卷失敗: ' + error.message, 'error');
        } finally {
            setIsComparingQuestionnaires(false);
            setComparingResponseId(null);
        }
    };

    const rerunQuestionnaireComparison = (includeUnchanged) => {
        if (!questionnaireComparison?.responseIds?.length) return;
        runQuestionnaireComparison(questionnaireComparison.responseIds, includeUnchanged);
    };

    const handleArchiveQuestionnaireResponse = async (responseId) => {
        const confirmed = await requestConfirm('確定要封存這份問卷嗎？封存後不會出現在一般問卷列表、比對與資料檢核清單，可從已封存區域還原。', '封存問卷');
        if (!confirmed) return;

        try {
            await formsApi.archiveResponse(responseId, { archive_reason: '使用者從個案問卷列表封存' });
            showToast('問卷已封存', 'success');
            fetchQuestionnaireData(getQuestionnaireSubjectId());
        } catch (error) {
            console.error('Failed to archive questionnaire response:', error);
            showToast('封存問卷失敗: ' + error.message, 'error');
        }
    };

    const handleDeleteQuestionnaireDraft = async (responseId) => {
        const confirmed = await requestConfirm('確定要刪除這份問卷草稿嗎？刪除後無法從列表還原。', '刪除草稿');
        if (!confirmed) return;

        try {
            await formsApi.deleteDraft(responseId);
            showToast('問卷草稿已刪除', 'success');
            fetchQuestionnaireData(getQuestionnaireSubjectId());
        } catch (error) {
            console.error('Failed to delete questionnaire draft:', error);
            showToast('刪除問卷草稿失敗: ' + error.message, 'error');
        }
    };

    const handleRestoreQuestionnaireResponse = async (responseId) => {
        const confirmed = await requestConfirm('確定要還原這份已封存問卷嗎？還原後會回到一般問卷列表。', '還原問卷');
        if (!confirmed) return;

        try {
            await formsApi.restoreResponse(responseId);
            showToast('問卷已還原', 'success');
            fetchQuestionnaireData(getQuestionnaireSubjectId());
        } catch (error) {
            console.error('Failed to restore questionnaire response:', error);
            showToast('還原問卷失敗: ' + error.message, 'error');
        }
    };

    const handleDownloadQuestionnaireXlsx = async (response, template) => {
        if (response.status !== 'submitted') {
            showToast('只有已送出的問卷可以下載 XLSX', 'error');
            return;
        }

        try {
            const blob = await formsApi.downloadResponseXlsx(response.id);
            downloadBlob(blob, buildQuestionnaireXlsxFilename({
                subjectName: patient?.display_name,
                subjectNationId: response.subject_nation_id || patient?.details?.nation_id,
                templateTitle: template?.title || response.template_title || `問卷_${response.template_id}`,
                submittedAt: response.submitted_at,
            }));
        } catch (error) {
            console.error('Failed to download questionnaire xlsx:', error);
            showToast('下載問卷 XLSX 失敗: ' + error.message, 'error');
        }
    };

    const handleDownloadQuestionnairePdf = async (response, template) => {
        try {
            const blob = await formsApi.downloadResponsePdf(response.id);
            downloadBlob(blob, `${patient?.display_name || '個案'}_${template?.title || response.template_title || `問卷_${response.template_id}`}_${response.id}.pdf`);
        } catch (error) {
            console.error('Failed to download questionnaire pdf:', error);
            showToast('下載問卷 PDF 失敗: ' + error.message, 'error');
        }
    };

    const toggleQuestionnaireActionMenu = (event, response) => {
        event.stopPropagation();
        if (openQuestionnaireActionMenu?.id === response.id) {
            setOpenQuestionnaireActionMenu(null);
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 176;
        const menuHeight = response.status === 'submitted' ? 280 : 230;
        const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
        const opensUp = rect.bottom + menuHeight + 12 > window.innerHeight;
        const top = opensUp ? Math.max(12, rect.top - menuHeight - 8) : rect.bottom + 8;
        setOpenQuestionnaireActionMenu({ id: response.id, top, left });
    };

    const handleSendNotification = async (e) => {
        if (e) e.preventDefault();
        if (!newNotifTitle.trim() || !newNotifContent.trim()) {
            return showToast('請輸入通知標題與內容', 'error');
        }

        setIsSendingNotif(true);
        try {
            await managementApi.createNotification({
                title: newNotifTitle,
                content: newNotifContent,
                user_id: parseInt(id)
            });
            showToast('通知已發送', 'success');
            setNewNotifTitle('');
            setNewNotifContent('');
            fetchNotifications();
        } catch (error) {
            console.error('Failed to send notification:', error);
            showToast('發送失敗', 'error');
        } finally {
            setIsSendingNotif(false);
        }
    };

    const handleDeleteNotification = async (notifId) => {
        const confirmed = await requestConfirm('確認刪除', '確定要撤回這則通知嗎？');
        if (!confirmed) return;

        try {
            await managementApi.deleteNotification(notifId);
            showToast('通知已刪除', 'success');
            fetchNotifications();
        } catch (error) {
            console.error('Failed to delete notification:', error);
            showToast('刪除失敗', 'error');
        }
    };

    const fetchAllMissions = useCallback(async () => {
        try {
            const data = await managementApi.getMissions();
            if (Array.isArray(data)) setAllMissions(data);
        } catch (error) {
            console.error('Failed to fetch all missions:', error);
        }
    }, []);

    useEffect(() => {
        fetchDetail();
        fetchManagers();
        fetchMissions();
        fetchLogs();
        fetchAllMissions();
        fetchNotifications();
    }, [fetchAllMissions, fetchDetail, fetchLogs, fetchManagers, fetchMissions, fetchNotifications]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (['tasks', 'health', 'notifications'].includes(tab) && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [activeTab, searchParams]);

    useEffect(() => {
        if (patient) {
            fetchQuestionnaireData();
        }
    }, [fetchQuestionnaireData, patient]);

    const toggleSelectedManager = (managerId) => {
        const value = String(managerId);
        setSelectedManagerIds(prev => (
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
        ));
    };

    const handleSaveManagers = async () => {
        const originalIds = getManagerIds(patient);
        const nextIds = selectedManagerIds.map(String);
        const idsToAdd = nextIds.filter(managerId => !originalIds.includes(managerId));
        const idsToRemove = originalIds.filter(managerId => !nextIds.includes(managerId));

        if (idsToAdd.length === 0 && idsToRemove.length === 0) return;

        setIsAssigning(true);
        try {
            await Promise.all([
                ...idsToAdd.map(managerId => managementApi.assignUser({
                    manager_id: parseInt(managerId),
                    user_id: parseInt(id)
                })),
                ...idsToRemove.map(managerId => managementApi.unassignUser({
                    manager_id: parseInt(managerId),
                    user_id: parseInt(id)
                }))
            ]);
            showToast('個管師指派已更新', 'success');
            fetchDetail();
        } catch (error) {
            showToast('更新指派失敗: ' + error.message, 'error');
            fetchDetail();
        } finally {
            setIsAssigning(false);
        }
    };

    const handleUnassignManager = async (managerId) => {
        if (!(await requestConfirm('確定要解除此個管師的指派嗎？'))) return;
        setIsAssigning(true);
        try {
            await managementApi.unassignUser({
                manager_id: parseInt(managerId),
                user_id: parseInt(id)
            });
            showToast('解除指派成功', 'success');
            fetchDetail();
        } catch (error) {
            showToast('解除指派失敗: ' + error.message, 'error');
            fetchDetail();
        } finally {
            setIsAssigning(false);
        }
    };

    const handleOpenEditPatient = () => {
        const details = patient?.details || {};
        setEditPatientForm({
            username: patient?.username || '',
            display_name: patient?.display_name || '',
            password: '',
            birthday: details.birthday || '',
            gender_id: details.gender_id || 1,
            nation_id: details.nation_id || '',
            sarcopenia_level: details.sarcopenia_level || 'E',
            phone_number: details.phone_number || '',
            address: details.address || '',
            is_psychiatric: details.is_psychiatric === true,
            is_dental: details.is_dental === true
        });
        setIsEditPatientModalOpen(true);
    };

    const handleSavePatient = async (e) => {
        e.preventDefault();
        if (!editPatientForm.username.trim() || !editPatientForm.display_name.trim()) {
            return showToast('請輸入姓名與帳號', 'error');
        }

        const payload = {
            username: editPatientForm.username.trim(),
            display_name: editPatientForm.display_name.trim(),
            details: {
                birthday: editPatientForm.birthday || null,
                gender_id: parseInt(editPatientForm.gender_id),
                nation_id: editPatientForm.nation_id,
                sarcopenia_level: editPatientForm.sarcopenia_level,
                phone_number: editPatientForm.phone_number,
                address: editPatientForm.address,
                is_psychiatric: editPatientForm.is_psychiatric,
                is_dental: editPatientForm.is_dental
            }
        };

        if (editPatientForm.password.trim()) {
            payload.password = editPatientForm.password.trim();
        }

        setIsSavingPatient(true);
        try {
            await managementApi.updateUser(id, payload);
            showToast('個案資料已更新', 'success');
            setIsEditPatientModalOpen(false);
            fetchDetail();
        } catch (error) {
            showToast('更新失敗: ' + error.message, 'error');
        } finally {
            setIsSavingPatient(false);
        }
    };

    const handleOpenAddMission = () => {
        setSelectedMissionIds([]);
        setIsCompulsory(false);
        setMissionAssignSearch('');
        setMissionAssignDomainFilter('all');
        setMissionAssignTypeFilter('all');
        setIsAddMissionModalOpen(true);
    };

    const handleAssignMissions = async () => {
        if (selectedMissionIds.length === 0) return showToast('請選擇至少一項任務', 'error');
        setIsSubmittingMissions(true);
        try {
            await Promise.all(selectedMissionIds.map(async (mId) => {
                // 1. 指派任務
                await managementApi.assignMission({
                    mission_id: mId,
                    user_id: parseInt(id),
                    is_compulsory: isCompulsory
                });
                
                // 2. 如果是必修，自動幫病患開啟/領取該任務起始狀態
                if (isCompulsory) {
                    await managementApi.createMissionLogForUser(mId, parseInt(id));
                }
            }));
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

    const getMissionDetails = (missionId) => {
        return allMissions.find(m => String(m.id || m.mission_id) === String(missionId));
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

    const formatLogDate = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString('zh-TW', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const getMissionLogDate = (log) => {
        const dateString = log?.updated_at || log?.assigned_at || log?.created_at;
        if (!dateString) return null;
        const date = new Date(dateString);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const getMissionLogReturnId = (missionReturn) => (
        missionReturn?.mission_log_id ?? missionReturn?.mission_log?.id
    );

    const getMissionLogReturns = (log) => missionReturns.filter(ret => (
        String(getMissionLogReturnId(ret)) === String(log.id)
    ));

    const getLogStatusMeta = (statusId) => {
        if (statusId === 2) return { label: '已完成', value: 'completed', className: 'text-cta bg-green-50 border-green-100' };
        if (statusId === 3) return { label: '進行中', value: 'in_progress', className: 'text-blue-600 bg-blue-50 border-blue-100' };
        return { label: '未完成', value: 'uncompleted', className: 'text-orange-600 bg-orange-50 border-orange-100' };
    };

    const clearLogFilters = () => {
        setLogFilterStatus('all');
        setLogFilterTime('all');
        setLogFilterReturn('all');
        setLogFilterKeyword('');
        setLogPage(1);
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

    const assignedMissionIds = new Set(assignedMissions.map(am => String(am.mission_id)));
    const missionMatchesAssignFilters = (m) => {
        const keyword = missionAssignSearch.trim().toLowerCase();
        const matchesKeyword = !keyword || [
            m.title,
            m.name,
            m.description,
            m.desc,
            m.detail,
            m.health_domain?.name,
            m.mission_type?.name,
        ].filter(Boolean).join(' ').toLowerCase().includes(keyword);
        const matchesDomain = missionAssignDomainFilter === 'all' || String(m.health_domain_id || m.health_domain?.id) === String(missionAssignDomainFilter);
        const matchesType = missionAssignTypeFilter === 'all' || String(m.mission_type_id || m.mission_type?.id) === String(missionAssignTypeFilter);
        return matchesKeyword && matchesDomain && matchesType;
    };
    const isMissionAssigned = (m) => assignedMissionIds.has(String(m.id || m.mission_id));
    // Filter out missions that are already assigned
    const availableMissions = allMissions.filter(m => !isMissionAssigned(m));
    const missionAssignDomainOptions = ['all', ...new Map(
        availableMissions
            .filter(m => m.health_domain)
            .map(m => [String(m.health_domain.id), m.health_domain])
    ).values()];
    const missionAssignTypeOptions = ['all', ...new Map(
        availableMissions
            .filter(m => m.mission_type)
            .map(m => [String(m.mission_type.id), m.mission_type])
    ).values()];
    const filteredAvailableMissions = availableMissions.filter(missionMatchesAssignFilters);
    const filteredAssignedMissions = allMissions.filter(m => isMissionAssigned(m) && missionMatchesAssignFilters(m));

    const details = patient.details || {};
    const questionnaireSubjectId = details.nation_id?.trim();
    const questionnaireCategoryOptions = ['all', ...new Set(questionnaireTemplates.map(template => template.category || '未分類'))];
    const filteredQuestionnaireTemplates = questionnaireTemplates.filter(template => {
        const keyword = questionnaireSearch.trim().toLowerCase();
        const matchesKeyword = !keyword || [
            template.title,
            template.code,
            template.category,
            template.sequence_group,
            template.source_path,
        ].filter(Boolean).join(' ').toLowerCase().includes(keyword);

        const matchesCategory = questionnaireCategoryFilter === 'all' || (template.category || '未分類') === questionnaireCategoryFilter;
        return matchesKeyword && matchesCategory;
    });
    const questionnaireDraftCount = questionnaireResponses.filter(response => response.status === 'draft').length;
    const questionnaireSubmittedCount = questionnaireResponses.filter(response => response.status === 'submitted').length;
    const questionnaireVisitGroups = buildVisitGroups(questionnaireResponses);
    const getQuestionnaireTemplate = (templateId) => questionnaireTemplates.find(template => String(template.id) === String(templateId));
    const comparisonTemplateTitle = comparisonBaseResponse
        ? getQuestionnaireTemplate(comparisonBaseResponse.template_id)?.title || comparisonBaseResponse.template_title || `問卷 #${comparisonBaseResponse.template_id}`
        : '';
    const comparisonCandidateResponses = comparisonBaseResponse
        ? questionnaireResponses
            .filter(response => String(response.template_id) === String(comparisonBaseResponse.template_id))
            .sort((a, b) => {
                const aDate = getQuestionnaireAssessmentDate(a) || a.submitted_at || a.updated_at || a.created_at || '';
                const bDate = getQuestionnaireAssessmentDate(b) || b.submitted_at || b.updated_at || b.created_at || '';
                return String(bDate).localeCompare(String(aDate));
            })
        : [];
    const filteredComparisonCandidates = comparisonCandidateResponses.filter(response => {
        const visit = normalizeVisit(response.visit);
        if (!comparisonVisitFilters.includes(visit)) return false;
        if (comparisonStatusFilter !== 'all' && response.status !== comparisonStatusFilter) return false;

        const assessmentDate = getQuestionnaireAssessmentDate(response);
        if (comparisonDateFrom && (!assessmentDate || assessmentDate < comparisonDateFrom)) return false;
        if (comparisonDateTo && (!assessmentDate || assessmentDate > comparisonDateTo)) return false;

        const keyword = comparisonKeyword.trim().toLowerCase();
        if (!keyword) return true;
        const searchable = [
            response.id,
            response.status,
            response.visit,
            getQuestionnaireAssessmentDate(response),
            getQuestionnaireFillerLabel(response),
            response.filled_by_username,
            response.filled_by_display_name,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(keyword);
    });
    const selectedComparisonSet = new Set(comparisonSelectedResponseIds.map(String));
    const submittedFilteredComparisonIds = filteredComparisonCandidates
        .filter(response => response.status === 'submitted')
        .map(response => response.id);
    const canRunComparison = comparisonSelectedResponseIds.length >= 2 && !isComparingQuestionnaires;

    const getQuestionnaireStatusMeta = (status) => {
        if (status === 'submitted') {
            return { label: '已送出', className: 'bg-green-50 text-green-700 border-green-100' };
        }
        return { label: '草稿待填', className: 'bg-amber-50 text-amber-700 border-amber-100' };
    };

    const statusFilterOptions = [
        { value: 'all', label: '全部', count: missionLogs.length },
        { value: 'completed', label: '已完成', count: missionLogs.filter(log => log.mission_status_id === 2).length },
        { value: 'in_progress', label: '進行中', count: missionLogs.filter(log => log.mission_status_id === 3).length },
        { value: 'uncompleted', label: '未完成', count: missionLogs.filter(log => log.mission_status_id === 1 || ![2, 3].includes(log.mission_status_id)).length },
    ];

    const hasActiveLogFilters = logFilterStatus !== 'all' || logFilterTime !== 'all' || logFilterReturn !== 'all' || logFilterKeyword.trim() !== '';

    const filteredMissionLogs = missionLogs.filter(log => {
        // Status Filter
        if (logFilterStatus === 'completed' && log.mission_status_id !== 2) return false;
        if (logFilterStatus === 'in_progress' && log.mission_status_id !== 3) return false;
        if (logFilterStatus === 'uncompleted' && [2, 3].includes(log.mission_status_id)) return false;

        // Time Filter
        if (logFilterTime !== 'all') {
            const logDate = getMissionLogDate(log);
            if (!logDate) return false;
            const now = new Date();
            if (logFilterTime === 'week') {
                const weekAgo = new Date(now.setDate(now.getDate() - 7));
                if (logDate < weekAgo) return false;
            } else if (logFilterTime === 'month') {
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
                if (logDate < monthAgo) return false;
            }
        }

        const relevantReturns = getMissionLogReturns(log);
        if (logFilterReturn === 'with_return' && relevantReturns.length === 0) return false;
        if (logFilterReturn === 'without_return' && relevantReturns.length > 0) return false;

        const keyword = logFilterKeyword.trim().toLowerCase();
        if (keyword) {
            const mission = getMissionDetails(log.mission_id);
            const searchableText = [
                mission?.title,
                mission?.name,
                mission?.desc,
                mission?.description,
                mission?.health_domain?.name,
                mission?.mission_type?.name,
                log.note,
                log.mission_id,
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchableText.includes(keyword)) return false;
        }

        return true;
    }).sort((a, b) => (getMissionLogDate(b)?.getTime() || 0) - (getMissionLogDate(a)?.getTime() || 0));
    const totalLogPages = Math.max(1, Math.ceil(filteredMissionLogs.length / MISSION_LOGS_PAGE_SIZE));
    const currentLogPage = Math.min(logPage, totalLogPages);
    const paginatedMissionLogs = filteredMissionLogs.slice(
        (currentLogPage - 1) * MISSION_LOGS_PAGE_SIZE,
        currentLogPage * MISSION_LOGS_PAGE_SIZE
    );
    const firstVisibleLogNumber = filteredMissionLogs.length === 0
        ? 0
        : ((currentLogPage - 1) * MISSION_LOGS_PAGE_SIZE) + 1;
    const lastVisibleLogNumber = Math.min(currentLogPage * MISSION_LOGS_PAGE_SIZE, filteredMissionLogs.length);

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
                            details.sarcopenia_level === 'D' ? 'bg-green-100 text-green-700 border-green-200' :
                            details.sarcopenia_level === 'E' ? 'bg-green-100 text-green-700 border-green-200' :
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
                            <div className="flex items-center space-x-2 mt-1">
                                <span className="text-text/60">{details.gender?.name === 'male' ? '男性' : details.gender?.name === 'female' ? '女性' : '未知'}</span>
                                <span className="text-text/20">|</span>
                                <span className="font-bold text-primary">{calculateAge(details.birthday)} 歲</span>
                            </div>
                            <p className="text-[10px] font-mono text-text/30 mt-2 uppercase tracking-wider">帳號: {patient.username}</p>
                        </div>

                        <div className="space-y-4 text-sm border-t border-sky-100/50 pt-6">
                            <div className="flex items-start space-x-3 text-text/80">
                                <div className="p-1.5 bg-sky-50 rounded-lg text-primary">
                                    <Phone size={14} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-text/40 uppercase">聯絡電話</p>
                                    <p className="font-medium">{details.phone_number || '未提供'}</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3 text-text/80">
                                <div className="p-1.5 bg-sky-50 rounded-lg text-primary">
                                    <MapPin size={14} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-text/40 uppercase">居住地址</p>
                                    <p className="font-medium text-xs leading-relaxed">{details.address || '未提供'}</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3 text-text/80">
                                <div className="p-1.5 bg-sky-50 rounded-lg text-primary">
                                    <Activity size={14} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-text/40 uppercase">出生日期</p>
                                    <p className="font-medium">{details.birthday || '未提供'}</p>
                                </div>
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
                                onClick={handleOpenEditPatient}
                                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-sky-50 text-primary border border-sky-200 rounded-xl font-medium hover:bg-sky-100 transition-colors cursor-pointer text-sm"
                            >
                                <Edit3 size={16} />
                                <span>編輯個案資料/密碼</span>
                            </button>
                            <button 
                                onClick={handleOpenAddMission}
                                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-colors cursor-pointer text-sm"
                            >
                                <Send size={16} />
                                <span>派發新任務</span>
                            </button>
                            <button
                                onClick={handleOpenQuestionnaireModal}
                                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-cta text-white rounded-xl font-medium hover:bg-green-600 transition-colors cursor-pointer text-sm"
                            >
                                <ClipboardCheck size={16} />
                                <span>派發問卷</span>
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
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-bold text-purple-700 ml-1">負責個管師</label>
                                        <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                            已選 {selectedManagerIds.length} 位
                                        </span>
                                    </div>
                                    {(patient.managers && patient.managers.length > 0) ? (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {patient.managers.map(manager => (
                                                <span key={manager.id} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-purple-100 px-2.5 py-1 text-xs font-bold text-purple-800">
                                                    {manager.display_name}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUnassignManager(manager.id)}
                                                        disabled={isAssigning}
                                                        className="text-purple-300 hover:text-rose-500 disabled:opacity-40"
                                                        title="解除此個管師"
                                                    >
                                                        <XCircle size={13} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mb-3 rounded-lg border border-dashed border-purple-100 bg-white/70 py-3 text-center text-xs text-purple-300">
                                            尚未指派任何個管師
                                        </p>
                                    )}
                                    <div className="max-h-56 overflow-y-auto rounded-xl border border-purple-100 bg-white p-2 space-y-1">
                                        {caseManagers.length === 0 ? (
                                            <p className="py-5 text-center text-xs text-text/40">目前沒有可指派的個管師</p>
                                        ) : caseManagers.map(manager => {
                                            const managerId = String(manager.id);
                                            const checked = selectedManagerIds.includes(managerId);
                                            return (
                                                <label
                                                    key={manager.id}
                                                    className={`flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                                                        checked ? 'bg-purple-50 border-purple-200' : 'bg-white border-transparent hover:border-purple-100'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-200 cursor-pointer"
                                                        checked={checked}
                                                        disabled={isAssigning}
                                                        onChange={() => toggleSelectedManager(managerId)}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-text truncate">{manager.display_name}</p>
                                                        <p className="text-[10px] text-text/40 truncate">@{manager.username}</p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSaveManagers}
                                    disabled={isAssigning}
                                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                                        isAssigning
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                        : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-200 cursor-pointer'
                                    }`}
                                >
                                    {isAssigning ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <>
                                            <UserPlus size={16} />
                                            <span>儲存指派</span>
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-purple-400 text-center italic">
                                    註：可同時指派多位個管師管理此病患
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
                                onClick={() => handleChangeActiveTab('tasks')}
                            >
                                任務執行紀錄
                            </button>
                            <button
                                className={`flex-1 py-4 text-center font-bold text-sm transition-colors cursor-pointer ${activeTab === 'health' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text/50 hover:bg-sky-50'}`}
                                onClick={() => handleChangeActiveTab('health')}
                            >
                                健康數據與問卷
                            </button>
                            <button
                                className={`flex-1 py-4 text-center font-bold text-sm transition-colors cursor-pointer ${activeTab === 'notifications' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text/50 hover:bg-sky-50'}`}
                                onClick={() => handleChangeActiveTab('notifications')}
                            >
                                通知管理
                            </button>
                        </div>

                        <div className="p-6 relative">
                            {activeTab === 'notifications' && (
                                <div className="space-y-8">
                                    {/* 發送新通知 */}
                                    <div className="bg-sky-50/50 p-6 rounded-2xl border border-sky-100 shadow-sm">
                                        <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                                            <Send size={20} />
                                            發送新推播通知
                                        </h3>
                                        <form onSubmit={handleSendNotification} className="space-y-4">
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-text/60 ml-1">通知標題</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="例如：提醒填寫每日飲食紀錄"
                                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        value={newNotifTitle}
                                                        onChange={(e) => setNewNotifTitle(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-text/60 ml-1">通知內容</label>
                                                    <textarea 
                                                        rows="3"
                                                        placeholder="請輸入詳細的通知訊息..."
                                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                                        value={newNotifContent}
                                                        onChange={(e) => setNewNotifContent(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <button 
                                                    type="submit"
                                                    disabled={isSendingNotif || !newNotifTitle.trim() || !newNotifContent.trim()}
                                                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-all shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {isSendingNotif ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                                    發送通知
                                                </button>
                                            </div>
                                        </form>
                                    </div>

                                    {/* 歷史通知列表 */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-text/80 flex items-center justify-between border-b border-sky-100 pb-2">
                                            <span>歷史發送紀錄</span>
                                            <span className="text-sm font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{notifications.length}</span>
                                        </h3>

                                        {isNotificationsLoading ? (
                                            <div className="flex flex-col items-center justify-center py-10 text-primary">
                                                <Loader2 size={32} className="animate-spin mb-3" />
                                                <p>載入通知紀錄中...</p>
                                            </div>
                                        ) : notifications.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-text/30 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                                                <Send size={48} className="mb-4 opacity-20" />
                                                <p>目前尚無任何通知發送紀錄</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-4">
                                                {notifications.map(notif => (
                                                    <div key={notif.id} className="bg-white p-5 rounded-2xl border border-sky-50 shadow-sm hover:border-sky-200 transition-colors group relative">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-bold text-text text-lg pr-12">{notif.title}</h4>
                                                            <button 
                                                                onClick={() => handleDeleteNotification(notif.id)}
                                                                className="absolute top-4 right-4 p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                title="撤回通知"
                                                            >
                                                                <XCircle size={20} />
                                                            </button>
                                                        </div>
                                                        <p className="text-text/70 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{notif.content}</p>
                                                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                                <CheckCircle size={10} className="text-cta" /> 已成功推送
                                                            </span>
                                                            <span className="text-xs text-text/40">{formatLogDate(notif.send_at)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'tasks' && (
                            <div className="space-y-4">
                                <div className="flex mb-4">
                                    <button
                                        className={`flex-1 py-2 text-center text-sm font-medium rounded-l-lg transition-colors ${taskSubTab === 'assigned' ? 'bg-primary text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                        onClick={() => setTaskSubTab('assigned')}
                                    >
                                        待執行任務
                                    </button>
                                    <button
                                        className={`flex-1 py-2 text-center text-sm font-medium rounded-r-lg transition-colors ${taskSubTab === 'history' ? 'bg-primary text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                        onClick={() => setTaskSubTab('history')}
                                    >
                                        歷史執行紀錄
                                    </button>
                                </div>

                                {taskSubTab === 'assigned' && (
                                    <>
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
                                    </>
                                )}

                                {taskSubTab === 'history' && (
                                    <>
                                        <div className="mb-5 space-y-4 border-b border-sky-100 pb-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <h3 className="font-bold text-lg text-primary flex items-center space-x-2">
                                                    <span>歷史執行紀錄</span>
                                                    <span className="text-sm font-bold bg-sky-100 text-primary px-2 py-0.5 rounded-full">{missionLogs.length}</span>
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs font-bold text-text/50">
                                                    <SlidersHorizontal size={15} />
                                                    <span>目前顯示 {filteredMissionLogs.length} / {missionLogs.length} 筆</span>
                                                </div>
                                            </div>

                                            <div className="rounded-xl border border-sky-100 bg-slate-50/70 p-3 space-y-3">
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="flex flex-wrap gap-2" role="group" aria-label="依任務狀態篩選">
                                                        {statusFilterOptions.map(option => (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                onClick={() => {
                                                                    setLogFilterStatus(option.value);
                                                                    setLogPage(1);
                                                                }}
                                                                className={`min-h-10 px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                                                                    logFilterStatus === option.value
                                                                        ? 'bg-primary text-white border-primary shadow-sm'
                                                                        : 'bg-white text-text/60 border-slate-200 hover:border-primary/30 hover:text-primary'
                                                                }`}
                                                            >
                                                                {option.label}
                                                                <span className={`ml-1 ${logFilterStatus === option.value ? 'text-white/80' : 'text-text/35'}`}>({option.count})</span>
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={clearLogFilters}
                                                        disabled={!hasActiveLogFilters}
                                                        className="min-h-10 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-text/60 hover:text-primary hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                                    >
                                                        <RotateCcw size={14} />
                                                        清除篩選
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    <label className="space-y-1">
                                                        <span className="text-[11px] font-bold text-text/50">搜尋任務</span>
                                                        <div className="relative">
                                                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
                                                            <input
                                                                type="search"
                                                                className="w-full min-h-10 pl-9 pr-3 border border-sky-100 rounded-lg text-sm text-text/80 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                                                                placeholder="任務名稱、領域、備註"
                                                                value={logFilterKeyword}
                                                                onChange={(e) => {
                                                                    setLogFilterKeyword(e.target.value);
                                                                    setLogPage(1);
                                                                }}
                                                            />
                                                        </div>
                                                    </label>
                                                    <label className="space-y-1">
                                                        <span className="text-[11px] font-bold text-text/50">時間範圍</span>
                                                        <select 
                                                            className="w-full min-h-10 px-3 border border-sky-100 rounded-lg text-sm font-medium text-text/70 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                                                            value={logFilterTime}
                                                            onChange={(e) => {
                                                                setLogFilterTime(e.target.value);
                                                                setLogPage(1);
                                                            }}
                                                        >
                                                            <option value="all">全部時間</option>
                                                            <option value="week">最近一週</option>
                                                            <option value="month">最近一個月</option>
                                                        </select>
                                                    </label>
                                                    <label className="space-y-1">
                                                        <span className="text-[11px] font-bold text-text/50">成果回傳</span>
                                                        <select 
                                                            className="w-full min-h-10 px-3 border border-sky-100 rounded-lg text-sm font-medium text-text/70 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                                                            value={logFilterReturn}
                                                            onChange={(e) => {
                                                                setLogFilterReturn(e.target.value);
                                                                setLogPage(1);
                                                            }}
                                                        >
                                                            <option value="all">全部紀錄</option>
                                                            <option value="with_return">有成果回傳</option>
                                                            <option value="without_return">無成果回傳</option>
                                                        </select>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        {isLogsLoading ? (
                                            <div className="flex flex-col items-center justify-center py-10 text-primary">
                                                <Loader2 size={32} className="animate-spin mb-3" />
                                                <p>載入執行紀錄中...</p>
                                            </div>
                                        ) : missionLogs.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-10 text-text/40 bg-sky-50/30 rounded-xl border-2 border-dashed border-sky-100">
                                                <FileText size={48} className="mb-4 opacity-50 text-sky-300" />
                                                <p>此病患尚未有任何任務執行紀錄</p>
                                            </div>
                                        ) : filteredMissionLogs.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-10 text-text/40 bg-sky-50/30 rounded-xl border border-sky-100">
                                                <p>沒有符合篩選條件的紀錄</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-4">
                                                {paginatedMissionLogs.map(log => {
                                                    const mission = getMissionDetails(log.mission_id);
                                                    const relevantReturns = getMissionLogReturns(log);
                                                    const statusMeta = getLogStatusMeta(log.mission_status_id);

                                                    return (
                                                        <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                    {mission?.health_domain?.name || '未知領域'} - {mission?.mission_type?.name || '未知類型'}
                                                                </span>
                                                                <span className="text-xs text-text/50">{formatLogDate(getMissionLogDate(log))}</span>
                                                            </div>
                                                            {mission?.return_types?.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    <span className="text-[9px] text-text/40 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 italic">需回傳：</span>
                                                                    {mission.return_types.map((rt, idx) => (
                                                                        <span key={idx} className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 font-medium">
                                                                            {rt.file_type?.name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            <h4 className="font-bold text-text text-lg">{mission?.title || mission?.name || '未知任務'}</h4>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
                                                                <div className="bg-sky-50/50 p-2 rounded-lg border border-sky-100/50">
                                                                    <p className="text-[10px] text-text/50 block">期待度</p>
                                                                    <span className="font-bold text-primary">{log.expectation_score || 'N/A'}</span> <span className="text-[10px] text-text/40">/ 5</span>
                                                                </div>
                                                                <div className="bg-sky-50/50 p-2 rounded-lg border border-sky-100/50">
                                                                    <p className="text-[10px] text-text/50 block">滿意度</p>
                                                                    <span className="font-bold text-primary">{log.satisfaction_score || 'N/A'}</span> <span className="text-[10px] text-text/40">/ 5</span>
                                                                </div>
                                                                <div className="bg-sky-50/50 p-2 rounded-lg border border-sky-100/50">
                                                                    <p className="text-[10px] text-text/50 block">困難度</p>
                                                                    <span className="font-bold text-primary">{log.difficulty_score || 'N/A'}</span> <span className="text-[10px] text-text/40">/ 5</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-between items-center text-xs border-t border-slate-50 pt-2">
                                                                <p className="text-text/70">狀態: 
                                                                    <span className={`inline-flex ml-1 px-2 py-0.5 rounded-full border font-bold ${statusMeta.className}`}>
                                                                        {statusMeta.label}
                                                                    </span>
                                                                </p>
                                                                <div className="text-right text-[10px] text-text/40">
                                                                    <p>指派: {formatLogDate(log.assigned_at)}</p>
                                                                    {log.updated_at && log.updated_at !== log.assigned_at && <p>更新: {formatLogDate(log.updated_at)}</p>}
                                                                </div>
                                                            </div>
                                                            {log.note && (
                                                                <div className="bg-slate-50 p-3 rounded-lg text-sm text-text/80 border border-slate-100">
                                                                    個管師備註：{log.note}
                                                                </div>
                                                            )}
                                                            {relevantReturns.length > 0 && (
                                                                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                                                    <p className="text-sm font-bold text-text/80">成果回傳：</p>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        {relevantReturns.map((ret, rIdx) => {
                                                                            const hasFile = ret.file_path || ret.data_asset_id || ret.data_asset;
                                                                            return (
                                                                                <div key={ret.id || rIdx} className={`${hasFile ? 'border border-slate-100 rounded-lg p-2 flex flex-col items-center' : 'col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100'}`}>
                                                                                    {hasFile ? (
                                                                                        <>
                                                                                            <MissionMediaDisplay 
                                                                                                assetId={ret.file_path || ret.data_asset_id} 
                                                                                                mimeType={ret.extension || ret.mime_type || ret.file_type?.name}
                                                                                                assetData={ret.data_asset}
                                                                                            />
                                                                                            {ret.note && <p className="text-xs text-text/60 mt-2 text-center italic">「{ret.note}」</p>}
                                                                                        </>
                                                                                    ) : (
                                                                                        <div className="flex items-start space-x-2">
                                                                                            <div className="bg-primary/10 p-1.5 rounded-md text-primary mt-0.5">
                                                                                                <FileText size={14} />
                                                                                            </div>
                                                                                            <div>
                                                                                                <p className="text-[10px] text-text/40 font-bold uppercase mb-1">文字回傳內容</p>
                                                                                                <p className="text-sm text-text/80 leading-relaxed font-medium">{ret.note || '無文字描述'}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {totalLogPages > 1 && (
                                                    <nav
                                                        aria-label="歷史執行紀錄分頁"
                                                        className="sticky bottom-3 z-10 flex min-h-14 items-center justify-between gap-3 rounded-lg border border-sky-100 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
                                                    >
                                                        <button
                                                            type="button"
                                                            title="上一頁"
                                                            aria-label="上一頁"
                                                            disabled={currentLogPage === 1}
                                                            onClick={() => setLogPage(page => Math.max(1, page - 1))}
                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-primary transition-colors hover:border-primary/30 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-35"
                                                        >
                                                            <ChevronLeft size={18} />
                                                        </button>
                                                        <div className="min-w-0 text-center">
                                                            <p className="text-xs font-bold text-primary">
                                                                第 {currentLogPage} / {totalLogPages} 頁
                                                            </p>
                                                            <p className="text-[10px] text-text/45">
                                                                顯示第 {firstVisibleLogNumber}–{lastVisibleLogNumber} 筆，共 {filteredMissionLogs.length} 筆
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            title="下一頁"
                                                            aria-label="下一頁"
                                                            disabled={currentLogPage === totalLogPages}
                                                            onClick={() => setLogPage(page => Math.min(totalLogPages, page + 1))}
                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-primary transition-colors hover:border-primary/30 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-35"
                                                        >
                                                            <ChevronRight size={18} />
                                                        </button>
                                                    </nav>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            )}
                            {activeTab === 'health' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-4 rounded-2xl border border-sky-100 bg-sky-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                                                <ClipboardList size={20} />
                                                個案問卷
                                            </h3>
                                            <p className="mt-1 text-sm text-text/55">
                                                以身分/代碼 {questionnaireSubjectId || '未設定'} 查詢草稿與已送出紀錄
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleOpenQuestionnaireModal}
                                            disabled={!questionnaireSubjectId}
                                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <ClipboardCheck size={17} />
                                            派發問卷
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="rounded-2xl border border-sky-100 bg-white p-4">
                                            <p className="text-xs font-bold text-text/40">問卷庫</p>
                                            <p className="mt-1 text-2xl font-bold text-primary">{questionnaireTemplates.length}</p>
                                        </div>
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                                            <p className="text-xs font-bold text-amber-700/70">待填草稿</p>
                                            <p className="mt-1 text-2xl font-bold text-amber-700">{questionnaireDraftCount}</p>
                                        </div>
                                        <div className="rounded-2xl border border-green-100 bg-green-50/60 p-4">
                                            <p className="text-xs font-bold text-green-700/70">已送出</p>
                                            <p className="mt-1 text-2xl font-bold text-green-700">{questionnaireSubmittedCount}</p>
                                        </div>
                                    </div>

                                    {!questionnaireSubjectId && (
                                        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                                            此個案尚未填寫身分/代碼，請先點左側「編輯個案資料/密碼」補上身分/代碼後再派發問卷。
                                        </div>
                                    )}

                                    {isComparisonModalOpen && comparisonBaseResponse && (
                                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/45 p-4 backdrop-blur-sm">
                                            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                                                <div className="flex items-start justify-between gap-4 border-b border-sky-100 px-5 py-4">
                                                    <div>
                                                        <p className="text-xs font-bold text-primary/60">同一個案 / 同一份問卷比對</p>
                                                        <h3 className="mt-1 text-xl font-bold text-primary">{comparisonTemplateTitle}</h3>
                                                        <p className="mt-1 text-sm text-text/45">
                                                            基準：{getComparisonResponseLabel(comparisonBaseResponse)} / {getQuestionnaireFillerLabel(comparisonBaseResponse)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={closeQuestionnaireCompareModal}
                                                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-white text-text/45 hover:bg-sky-50"
                                                        aria-label="關閉比對視窗"
                                                    >
                                                        <XCircle size={20} />
                                                    </button>
                                                </div>

                                                <div className="space-y-4 overflow-y-auto px-5 py-4">
                                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
                                                        <div>
                                                            <label className="text-xs font-bold text-text/45">搜尋紀錄</label>
                                                            <div className="relative mt-1">
                                                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
                                                                <input
                                                                    type="search"
                                                                    value={comparisonKeyword}
                                                                    onChange={event => setComparisonKeyword(event.target.value)}
                                                                    placeholder="填答者、回覆 ID、Visit、狀態"
                                                                    className="min-h-11 w-full rounded-xl border border-sky-100 bg-sky-50/30 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-text/45">狀態</label>
                                                            <select
                                                                value={comparisonStatusFilter}
                                                                onChange={event => setComparisonStatusFilter(event.target.value)}
                                                                className="mt-1 min-h-11 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-bold text-text/70 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                            >
                                                                <option value="all">全部狀態</option>
                                                                <option value="submitted">已送出</option>
                                                                <option value="draft">草稿</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-text/45">評估日期</label>
                                                            <div className="mt-1 grid grid-cols-2 gap-2">
                                                                <input
                                                                    type="date"
                                                                    value={comparisonDateFrom}
                                                                    onChange={event => setComparisonDateFrom(event.target.value)}
                                                                    className="min-h-11 rounded-xl border border-sky-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                />
                                                                <input
                                                                    type="date"
                                                                    value={comparisonDateTo}
                                                                    onChange={event => setComparisonDateTo(event.target.value)}
                                                                    className="min-h-11 rounded-xl border border-sky-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="text-xs font-bold text-text/45">Visit</p>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {[...VISIT_OPTIONS, 'OTHER'].map(visit => {
                                                                const active = comparisonVisitFilters.includes(visit);
                                                                const meta = VISIT_META[visit];
                                                                return (
                                                                    <button
                                                                        key={visit}
                                                                        type="button"
                                                                        onClick={() => setComparisonVisitFilters(prev => (
                                                                            active
                                                                                ? prev.filter(item => item !== visit)
                                                                                : [...prev, visit]
                                                                        ))}
                                                                        className={`inline-flex min-h-9 items-center rounded-xl border px-3 py-1.5 text-xs font-bold ${active ? meta.badgeClassName : 'border-slate-200 bg-white text-text/40 hover:bg-slate-50'}`}
                                                                    >
                                                                        {meta.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-3 rounded-xl border border-sky-100 bg-sky-50/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="text-sm">
                                                            <p className="font-bold text-text">已選 {comparisonSelectedResponseIds.length} 筆</p>
                                                            <p className="mt-1 text-xs text-text/45">
                                                                顯示 {filteredComparisonCandidates.length} / {comparisonCandidateResponses.length} 筆候選；全選只會勾選目前篩選結果中的已送出紀錄。
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setComparisonSelectedResponseIds(prev => [...new Set([...prev, ...submittedFilteredComparisonIds])])}
                                                                disabled={submittedFilteredComparisonIds.length === 0}
                                                                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/20 bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                全選已送出
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setComparisonSelectedResponseIds([comparisonBaseResponse.id])}
                                                                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-text/60 hover:bg-slate-50"
                                                            >
                                                                只保留基準
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="overflow-hidden rounded-xl border border-sky-100">
                                                        {filteredComparisonCandidates.length === 0 ? (
                                                            <div className="p-6 text-center text-sm font-bold text-text/40">沒有符合篩選條件的同問卷紀錄。</div>
                                                        ) : (
                                                            <div className="max-h-[40vh] divide-y divide-sky-100 overflow-y-auto">
                                                                {filteredComparisonCandidates.map(response => {
                                                                    const checked = selectedComparisonSet.has(String(response.id));
                                                                    const statusMeta = getQuestionnaireStatusMeta(response.status);
                                                                    return (
                                                                        <label key={response.id} className="flex cursor-pointer items-start gap-3 bg-white px-4 py-3 hover:bg-sky-50/60">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={() => setComparisonSelectedResponseIds(prev => (
                                                                                    checked
                                                                                        ? prev.filter(responseId => String(responseId) !== String(response.id))
                                                                                        : [...prev, response.id]
                                                                                ))}
                                                                                className="mt-1 h-4 w-4 rounded border-sky-200 text-primary focus:ring-primary/20"
                                                                            />
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <p className="font-bold text-text">{getComparisonResponseLabel(response)}</p>
                                                                                    {response.id === comparisonBaseResponse.id && (
                                                                                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">基準</span>
                                                                                    )}
                                                                                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                                                                                </div>
                                                                                <p className="mt-1 text-xs text-text/45">
                                                                                    填答者：{getQuestionnaireFillerLabel(response)} / 建立：{formatLogDate(response.created_at)} / 更新：{formatLogDate(response.updated_at || response.created_at)}
                                                                                </p>
                                                                            </div>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-3 border-t border-sky-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                    <p className="text-xs font-bold text-text/45">
                                                        至少選 2 筆才能比對；草稿可手動選取，但不會被全選自動勾入。
                                                    </p>
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={closeQuestionnaireCompareModal}
                                                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-text/60 hover:bg-slate-50"
                                                        >
                                                            取消
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => runQuestionnaireComparison(comparisonSelectedResponseIds, false)}
                                                            disabled={!canRunComparison}
                                                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {isComparingQuestionnaires ? <Loader2 size={16} className="animate-spin" /> : <SlidersHorizontal size={16} />}
                                                            開始比對
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {questionnaireComparison && (
                                        <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-text">問卷交叉比對</p>
                                                    <p className="mt-1 text-xs text-text/45">{questionnaireComparison.templateTitle}</p>
                                                    <p className="mt-1 text-xs text-text/40">
                                                        已選 {questionnaireComparison.comparedResponses.length} 筆 / {questionnaireComparison.includeUnchanged ? '顯示全部欄位' : '僅顯示差異欄位'}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => rerunQuestionnaireComparison(false)}
                                                        disabled={!questionnaireComparison.includeUnchanged || isComparingQuestionnaires}
                                                        className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-bold ${!questionnaireComparison.includeUnchanged ? 'border-primary bg-primary text-white' : 'border-sky-100 bg-white text-primary hover:bg-sky-50'} disabled:cursor-not-allowed disabled:opacity-60`}
                                                    >
                                                        差異欄位
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => rerunQuestionnaireComparison(true)}
                                                        disabled={questionnaireComparison.includeUnchanged || isComparingQuestionnaires}
                                                        className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-bold ${questionnaireComparison.includeUnchanged ? 'border-primary bg-primary text-white' : 'border-sky-100 bg-white text-primary hover:bg-sky-50'} disabled:cursor-not-allowed disabled:opacity-60`}
                                                    >
                                                        全部欄位
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQuestionnaireComparison(null)}
                                                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-text/60 hover:bg-slate-50"
                                                    >
                                                        關閉比對
                                                    </button>
                                                </div>
                                            </div>

                                            {questionnaireComparison.canCompare === false ? (
                                                <div className="mt-4 rounded-xl border border-dashed border-rose-100 bg-rose-50/60 p-4 text-sm font-bold text-rose-700">
                                                    {questionnaireComparison.reason || '這些問卷紀錄無法比對。'}
                                                </div>
                                            ) : (
                                                <div className="mt-4 space-y-4">
                                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                                        {questionnaireComparison.comparedResponses.map((item, index) => {
                                                            const statusMeta = getQuestionnaireStatusMeta(item.status);
                                                            return (
                                                                <div key={item.id} className={`rounded-xl border px-3 py-2 text-xs ${index === 0 ? 'border-primary/20 bg-primary/5 text-primary' : 'border-slate-100 bg-slate-50 text-text/55'}`}>
                                                                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                                                        <span className="font-bold">{index === 0 ? '基準紀錄' : '比對紀錄'}</span>
                                                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                                                                    </div>
                                                                    <p className="font-bold">{getComparisonResponseLabel(item)}</p>
                                                                    <p className="mt-1">填答者：{getQuestionnaireFillerLabel(item)}</p>
                                                                    <p className="mt-1 text-text/40">送出：{formatLogDate(item.submitted_at) || '尚未送出'}</p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {questionnaireComparison.rows.length === 0 ? (
                                                        <div className="rounded-xl border border-dashed border-sky-100 bg-sky-50/40 p-4 text-sm font-bold text-text/50">
                                                            {questionnaireComparison.includeUnchanged ? '目前沒有可顯示的填答欄位。' : '目前沒有不一致的填答內容。'}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {questionnaireComparison.rows.map(row => (
                                                                <div key={row.field_id} className={`rounded-xl border p-3 ${row.isDifferent ? 'border-amber-100 bg-amber-50/60' : 'border-slate-100 bg-slate-50/70'}`}>
                                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                                        {row.section && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-primary">{row.section}</span>}
                                                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.isDifferent ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                            {row.isDifferent ? '不一致' : '一致'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm font-bold text-text">{row.label}</p>
                                                                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                                                        {row.values.map(value => (
                                                                            <div key={`${row.field_id}-${value.response_id}`} className="rounded-lg border border-white bg-white px-3 py-2">
                                                                                <p className="text-[11px] font-bold text-text/40">
                                                                                    回覆 #{value.response_id} / {getQuestionnaireFillerLabel(value)}
                                                                                </p>
                                                                                <p className="mt-1 text-sm font-bold text-text">{value.display_value}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isQuestionnairesLoading ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-primary">
                                            <Loader2 size={32} className="animate-spin mb-3" />
                                            <p>載入問卷紀錄中...</p>
                                        </div>
                                    ) : questionnaireResponses.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sky-100 bg-sky-50/30 py-12 text-text/40">
                                            <FileText size={48} className="mb-4 text-sky-300 opacity-70" />
                                            <p className="font-medium">此個案尚未派發或填寫任何問卷</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {questionnaireVisitGroups.map(group => {
                                                const draftCount = group.responses.filter(response => response.status === 'draft').length;
                                                const submittedCount = group.responses.filter(response => response.status === 'submitted').length;
                                                return (
                                                    <section key={group.visit} className={`overflow-hidden rounded-2xl border ${group.meta.className}`}>
                                                        <div className="flex flex-col gap-3 border-b border-white/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`h-10 w-2 rounded-full ${group.meta.accentClassName}`} />
                                                                <div>
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${group.meta.badgeClassName}`}>
                                                                            {group.meta.label}
                                                                        </span>
                                                                        <h4 className="text-base font-bold text-text">{group.meta.title}</h4>
                                                                    </div>
                                                                    <p className="mt-1 text-xs font-bold text-text/45">
                                                                        共 {group.responses.length} 筆，草稿 {draftCount} 筆，已送出 {submittedCount} 筆
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-3 p-4">
                                                            {group.responses.map(response => {
                                                                const template = getQuestionnaireTemplate(response.template_id);
                                                                const statusMeta = getQuestionnaireStatusMeta(response.status);
                                                                return (
                                                                    <div key={response.id} className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                                                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                                                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusMeta.className}`}>
                                                                                        {statusMeta.label}
                                                                                    </span>
                                                                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${group.meta.badgeClassName}`}>
                                                                                        {group.meta.label}
                                                                                    </span>
                                                                                    <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs font-bold text-text/45">
                                                                                        {template?.category || response.template_title || '未分類'}
                                                                                    </span>
                                                                                </div>
                                                                                <h4 className="text-lg font-bold text-text">
                                                                                    {template?.title || response.template_title || `問卷 #${response.template_id}`}
                                                                                </h4>
                                                                                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-text/45 sm:grid-cols-2">
                                                                                    <p>建立：{formatLogDate(response.created_at)}</p>
                                                                                    <p>更新：{formatLogDate(response.updated_at || response.created_at)}</p>
                                                                                    <p>問卷 ID：{response.template_id}</p>
                                                                                    <p>回覆 ID：{response.id}</p>
                                                                                    <p>填答者：{getQuestionnaireFillerLabel(response)}</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="relative shrink-0">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(event) => toggleQuestionnaireActionMenu(event, response)}
                                                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-100 bg-white text-primary transition-colors hover:bg-sky-50"
                                                                                    aria-label="問卷操作"
                                                                                >
                                                                                    <MoreVertical size={18} />
                                                                                </button>
                                                                                {openQuestionnaireActionMenu?.id === response.id && (
                                                                                    <div
                                                                                        className="fixed z-[1000] w-44 overflow-hidden rounded-xl border border-sky-100 bg-white py-1 text-sm shadow-xl"
                                                                                        style={{ top: openQuestionnaireActionMenu.top, left: openQuestionnaireActionMenu.left }}
                                                                                    >
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setOpenQuestionnaireActionMenu(null);
                                                                                                navigate(`/patients/${id}/questionnaires/${response.template_id}/fill?responseId=${response.id}`);
                                                                                            }}
                                                                                            className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-text/70 hover:bg-sky-50"
                                                                                        >
                                                                                            <Edit3 size={16} />
                                                                                            {response.status === 'submitted' ? '檢視問卷' : '填寫問卷'}
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setOpenQuestionnaireActionMenu(null);
                                                                                                openQuestionnaireCompareModal(response);
                                                                                            }}
                                                                                            disabled={comparingResponseId === response.id}
                                                                                            className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-primary hover:bg-sky-50 disabled:cursor-wait disabled:opacity-60"
                                                                                        >
                                                                                            {comparingResponseId === response.id ? <Loader2 size={16} className="animate-spin" /> : <SlidersHorizontal size={16} />}
                                                                                            比對問卷
                                                                                        </button>
                                                                                        {response.status === 'submitted' && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setOpenQuestionnaireActionMenu(null);
                                                                                                    handleDownloadQuestionnaireXlsx(response, template);
                                                                                                }}
                                                                                                className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-green-700 hover:bg-green-50"
                                                                                            >
                                                                                                <Download size={16} />
                                                                                                下載 XLSX
                                                                                            </button>
                                                                                        )}
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setOpenQuestionnaireActionMenu(null);
                                                                                                handleDownloadQuestionnairePdf(response, template);
                                                                                            }}
                                                                                            className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-primary hover:bg-sky-50"
                                                                                        >
                                                                                            <Download size={16} />
                                                                                            下載 PDF
                                                                                        </button>
                                                                                        {response.status === 'draft' ? (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setOpenQuestionnaireActionMenu(null);
                                                                                                    handleDeleteQuestionnaireDraft(response.id);
                                                                                                }}
                                                                                                className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-rose-600 hover:bg-rose-50"
                                                                                            >
                                                                                                <Trash2 size={16} />
                                                                                                刪除草稿
                                                                                            </button>
                                                                                        ) : (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setOpenQuestionnaireActionMenu(null);
                                                                                                    handleArchiveQuestionnaireResponse(response.id);
                                                                                                }}
                                                                                                className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-rose-600 hover:bg-rose-50"
                                                                                            >
                                                                                                <Trash2 size={16} />
                                                                                                封存問卷
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {response.score_json && (
                                                                            <div className="mt-4 rounded-xl border border-green-100 bg-green-50/60 p-3 text-xs text-green-800">
                                                                                <p className="font-bold">評分紀錄</p>
                                                                                <p className="mt-2 rounded-lg bg-white p-2 font-bold text-text/75">
                                                                                    {getQuestionnaireScoreSummary(response) || '已有評分紀錄'}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </section>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {archivedQuestionnaireResponses.length > 0 && (
                                        <details className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                            <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">已封存問卷</p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        共 {archivedQuestionnaireResponses.length} 筆，封存後不會出現在一般列表、比對與資料檢核清單。
                                                    </p>
                                                </div>
                                                <span className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition-colors group-open:bg-slate-100">
                                                    點擊展開 / 收合
                                                </span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                {archivedQuestionnaireResponses.map(response => {
                                                    const template = getQuestionnaireTemplate(response.template_id);
                                                    return (
                                                        <div key={response.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-text">{template?.title || response.template_title || `問卷 #${response.template_id}`}</p>
                                                                <p className="mt-1 text-xs text-text/45">
                                                                    回覆 #{response.id} / {getQuestionnaireStatusMeta(response.status).label} / 填答者：{getQuestionnaireFillerLabel(response)}
                                                                </p>
                                                                <p className="mt-1 text-xs text-text/35">
                                                                    封存：{formatLogDate(response.archived_at)}{response.archive_reason ? ` / ${response.archive_reason}` : ''}
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRestoreQuestionnaireResponse(response.id)}
                                                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                                            >
                                                                <RotateCcw size={16} />
                                                                還原
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Questionnaire Assignment Modal */}
            {isQuestionnaireModalOpen && (
                <div className="fixed inset-0 bg-text/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-sky-100 flex justify-between items-center bg-sky-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-primary font-lora">派發問卷給此個案</h3>
                                <p className="text-sm text-text/50 mt-1">派發會先建立草稿，之後可由個管師線上填寫</p>
                            </div>
                            <button
                                onClick={() => setIsQuestionnaireModalOpen(false)}
                                disabled={isDispatchingQuestionnaires}
                                className="text-text/50 hover:text-text transition-colors cursor-pointer p-1 disabled:opacity-40"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 space-y-5">
                            <div className="grid grid-cols-1 gap-3 rounded-xl border border-sky-100 bg-sky-50/50 p-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-bold text-text/45">派發對象</p>
                                    <p className="mt-1 font-bold text-text">{patient.display_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-text/45">身分/代碼</p>
                                    <p className="mt-1 font-mono font-bold text-primary">{questionnaireSubjectId}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_160px_220px]">
                                <label className="min-w-0 space-y-1">
                                    <span className="text-xs font-bold text-text/50">搜尋問卷</span>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
                                        <input
                                            type="search"
                                            className="w-full min-w-0 min-h-11 rounded-xl border border-sky-100 bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            placeholder="問卷名稱、分類、代碼"
                                            value={questionnaireSearch}
                                            onChange={(event) => setQuestionnaireSearch(event.target.value)}
                                        />
                                    </div>
                                </label>
                                <label className="min-w-0 space-y-1">
                                    <span className="text-xs font-bold text-text/50">Visit</span>
                                    <select
                                        className="h-11 w-full min-w-0 max-w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={selectedQuestionnaireVisit}
                                        onChange={(event) => setSelectedQuestionnaireVisit(event.target.value)}
                                    >
                                        {VISIT_OPTIONS.map(visit => (
                                            <option key={visit} value={visit}>{visit}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="min-w-0 space-y-1">
                                    <span className="text-xs font-bold text-text/50">分類</span>
                                    <select
                                        className="h-11 w-full min-w-0 max-w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={questionnaireCategoryFilter}
                                        onChange={(event) => setQuestionnaireCategoryFilter(event.target.value)}
                                    >
                                        {questionnaireCategoryOptions.map(category => (
                                            <option key={category} value={category}>{category === 'all' ? '全部分類' : category}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                                <p className="text-sm font-bold text-text/60">
                                    可派發問卷 {filteredQuestionnaireTemplates.length} 份
                                </p>
                                <p className="text-sm font-bold text-primary">已選 {selectedQuestionnaireIds.length} 份</p>
                            </div>

                            {isQuestionnairesLoading ? (
                                <div className="flex items-center justify-center py-12 text-primary">
                                    <Loader2 size={28} className="animate-spin mr-2" />
                                    載入問卷庫中...
                                </div>
                            ) : filteredQuestionnaireTemplates.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-sky-100 bg-sky-50/40 py-10 text-center text-text/40">
                                    沒有符合條件的問卷
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {filteredQuestionnaireTemplates.map(template => {
                                        const existingResponses = getResponsesForTemplate(template.id);
                                        const latestDraft = existingResponses.find(response => response.status === 'draft');
                                        const checked = selectedQuestionnaireIds.includes(template.id);
                                        return (
                                            <div
                                                key={template.id}
                                                className={`rounded-xl border p-4 transition-colors ${
                                                    checked
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-sky-100 bg-white hover:border-primary/30'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1 h-4 w-4 rounded text-primary focus:ring-primary/20"
                                                        checked={checked}
                                                        disabled={isDispatchingQuestionnaires}
                                                        onChange={() => toggleSelectedQuestionnaire(template.id)}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-2 flex flex-wrap gap-2">
                                                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-primary">
                                                                {template.category || '未分類'}
                                                            </span>
                                                            {template.sequence_group && (
                                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-text/45">
                                                                    {template.sequence_group}
                                                                </span>
                                                            )}
                                                            {template.has_scoring && (
                                                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                                    含評分
                                                                </span>
                                                            )}
                                                            {existingResponses.length > 0 && (
                                                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                                    已有 {existingResponses.length} 筆
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="font-bold text-text">{template.title}</h4>
                                                        <p className="mt-1 text-xs text-text/45">
                                                            {template.source_file_type?.toUpperCase()} / {template.extraction_status} / ID {template.id}
                                                        </p>
                                                    </div>
                                                    {latestDraft && (
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/patients/${id}/questionnaires/${template.id}/fill?responseId=${latestDraft.id}`)}
                                                            className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-light"
                                                        >
                                                            最新草稿
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-sky-100 flex flex-col gap-3 bg-slate-50 sm:flex-row sm:justify-end">
                            <button
                                onClick={() => setIsQuestionnaireModalOpen(false)}
                                disabled={isDispatchingQuestionnaires}
                                className="min-h-11 px-5 py-2 text-text/70 font-bold hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200 bg-white disabled:opacity-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDispatchQuestionnaires}
                                disabled={isDispatchingQuestionnaires || selectedQuestionnaireIds.length === 0}
                                className="min-h-11 px-5 py-2 font-bold rounded-xl transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary-light disabled:bg-slate-300 disabled:cursor-not-allowed"
                            >
                                {isDispatchingQuestionnaires ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                                確認派發
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Patient Modal */}
            {isEditPatientModalOpen && (
                <div className="fixed inset-0 bg-text/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-sky-100 flex justify-between items-center bg-sky-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-primary font-lora">編輯個案資料</h3>
                                <p className="text-sm text-text/50 mt-1">密碼留空代表不變更密碼</p>
                            </div>
                            <button
                                onClick={() => setIsEditPatientModalOpen(false)}
                                disabled={isSavingPatient}
                                className="text-text/50 hover:text-text transition-colors cursor-pointer p-1 disabled:opacity-40"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSavePatient} className="overflow-y-auto p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">姓名</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={editPatientForm.display_name}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, display_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">帳號</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={editPatientForm.username}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, username: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">重設密碼</label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="留空代表不變更"
                                        value={editPatientForm.password}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, password: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">身分/代碼</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={editPatientForm.nation_id}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, nation_id: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">生日</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={editPatientForm.birthday}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, birthday: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">性別</label>
                                    <select
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={editPatientForm.gender_id}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, gender_id: e.target.value })}
                                    >
                                        <option value={1}>男性</option>
                                        <option value={2}>女性</option>
                                        <option value={3}>其他</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">肌少等級</label>
                                    <select
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={editPatientForm.sarcopenia_level}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, sarcopenia_level: e.target.value })}
                                    >
                                        {['A', 'B', 'C', 'D', 'E'].map(level => (
                                            <option key={level} value={level}>{level}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">聯絡電話</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={editPatientForm.phone_number}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, phone_number: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text/60 ml-1">居住地址</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-sky-100 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={editPatientForm.address}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, address: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-sky-100 bg-sky-50/30 p-4">
                                <label className="flex items-center gap-3 text-sm font-bold text-text/70">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                        checked={editPatientForm.is_psychiatric}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, is_psychiatric: e.target.checked })}
                                    />
                                    心理問題
                                </label>
                                <label className="flex items-center gap-3 text-sm font-bold text-text/70">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                        checked={editPatientForm.is_dental}
                                        onChange={(e) => setEditPatientForm({ ...editPatientForm, is_dental: e.target.checked })}
                                    />
                                    口腔問題
                                </label>
                            </div>
                            <div className="flex justify-end gap-3 border-t border-sky-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditPatientModalOpen(false)}
                                    disabled={isSavingPatient}
                                    className="px-5 py-2.5 border border-sky-200 text-text/60 rounded-xl font-bold hover:bg-sky-50 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingPatient}
                                    className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingPatient ? '儲存中...' : '儲存變更'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Multiple Mission Assignment Modal */}
            {isAddMissionModalOpen && (
                <div className="fixed inset-0 bg-text/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-sky-100 flex justify-between items-center bg-sky-50/50">
                            <h3 className="text-xl font-bold text-primary font-lora">指派任務給此病患</h3>
                            <button onClick={() => setIsAddMissionModalOpen(false)} className="text-text/50 hover:text-text transition-colors cursor-pointer p-1">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto">
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

                                <div className="rounded-xl border border-sky-100 bg-slate-50/70 p-3 space-y-3">
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                        <label className="min-w-0 space-y-1 md:col-span-1">
                                            <span className="text-[11px] font-bold text-text/50">搜尋任務</span>
                                            <div className="relative">
                                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/35" />
                                                <input
                                                    type="search"
                                                    className="w-full min-w-0 min-h-10 rounded-lg border border-sky-100 bg-white pl-9 pr-3 text-sm text-text/80 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    placeholder="名稱、描述、領域"
                                                    value={missionAssignSearch}
                                                    onChange={(event) => setMissionAssignSearch(event.target.value)}
                                                />
                                            </div>
                                        </label>
                                        <label className="min-w-0 space-y-1">
                                            <span className="text-[11px] font-bold text-text/50">Health Domain</span>
                                            <select
                                                className="h-10 w-full min-w-0 max-w-full rounded-lg border border-sky-100 bg-white px-3 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                value={missionAssignDomainFilter}
                                                onChange={(event) => setMissionAssignDomainFilter(event.target.value)}
                                            >
                                                {missionAssignDomainOptions.map(option => (
                                                    option === 'all'
                                                        ? <option key="all" value="all">全部領域</option>
                                                        : <option key={option.id} value={option.id}>{option.name}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="min-w-0 space-y-1">
                                            <span className="text-[11px] font-bold text-text/50">執行模式</span>
                                            <select
                                                className="h-10 w-full min-w-0 max-w-full rounded-lg border border-sky-100 bg-white px-3 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                value={missionAssignTypeFilter}
                                                onChange={(event) => setMissionAssignTypeFilter(event.target.value)}
                                            >
                                                {missionAssignTypeOptions.map(option => (
                                                    option === 'all'
                                                        ? <option key="all" value="all">全部模式</option>
                                                        : <option key={option.id} value={option.id}>{option.name}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-bold text-text/45">
                                        <span>顯示 {filteredAvailableMissions.length} / {availableMissions.length} 項可指派任務</span>
                                        {(missionAssignSearch || missionAssignDomainFilter !== 'all' || missionAssignTypeFilter !== 'all') && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMissionAssignSearch('');
                                                    setMissionAssignDomainFilter('all');
                                                    setMissionAssignTypeFilter('all');
                                                }}
                                                className="text-primary hover:underline"
                                            >
                                                清除篩選
                                            </button>
                                        )}
                                    </div>
                                    {filteredAssignedMissions.length > 0 && (
                                        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                            <span className="font-bold">已有 {filteredAssignedMissions.length} 項符合條件但已指派：</span>
                                            <span>
                                                {filteredAssignedMissions.slice(0, 3).map(m => m.title || m.name || '未命名任務').join('、')}
                                                {filteredAssignedMissions.length > 3 ? ` 等 ${filteredAssignedMissions.length} 項` : ''}
                                            </span>
                                            <span className="block text-amber-700/80">請在「目前指派的任務」區塊檢視或取消指派。</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="max-h-48 overflow-y-auto border border-sky-100 rounded-lg p-2 bg-slate-50">
                                    {availableMissions.length === 0 ? (
                                        <p className="text-xs text-text/40 text-center py-4">目前任務庫尚無資料，或所有任務皆已指派給此病患。</p>
                                    ) : filteredAvailableMissions.length === 0 ? (
                                        <p className="text-xs text-text/40 text-center py-4">沒有符合篩選條件的任務。</p>
                                    ) : (
                                        filteredAvailableMissions.map(m => (
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
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        <span className="text-text/40 text-[10px] bg-slate-100 px-1 py-0.5 rounded inline-block">
                                                            {m.health_domain?.name || m.category || '未分類領域'}
                                                        </span>
                                                        <span className="text-text/40 text-[10px] bg-slate-100 px-1 py-0.5 rounded inline-block">
                                                            {m.mission_type?.name || m.type || '一般任務'}
                                                        </span>
                                                    </div>
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
