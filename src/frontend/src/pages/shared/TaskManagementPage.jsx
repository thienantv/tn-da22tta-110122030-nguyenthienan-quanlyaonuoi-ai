import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { showToast } from '../../utils/toast';
import { taskService, productService, pondService, userService } from '../../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'PENDING', label: 'Chờ xử lý' },
    { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
    { value: 'CANCELLED', label: 'Đã hủy' },
    { value: 'OVERDUE', label: 'Quá hạn' },
];

const TASK_TYPE_OPTIONS = [
    { value: '1', label: 'Cải tạo & Xử lý nước đầu vụ' },
    { value: '2', label: 'Cho tôm ăn (kèm trộn thuốc)' },
    { value: '3', label: 'Xử lý nước & Đáy trong vụ' },
    { value: '4', label: 'Xi phong đáy & Thay nước' },
    { value: '5', label: 'Đo môi trường nước' },
    { value: '6', label: 'Thu hoạch tôm' },
    { value: '7', label: 'Các công việc khác' },
];

const CHART_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981'];
const normalize = (v) => String(v || '').trim().toUpperCase();

const formatDate = (v) => {
    if (!v) return '-';
    const date = new Date(v);
    return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
};

const formatForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date - offset)).toISOString().slice(0, 16);
};

const getTaskDurationHours = (typeId) => {
    switch (String(typeId)) {
        case '1': return 4;
        case '2': return 1;
        case '3': return 2;
        case '4': return 2;
        case '5': return 1;
        case '6': return 8;
        case '7': return 2;
        default: return 2;
    }
};

const calculateDueDate = (startStr, typeId) => {
    if (!startStr || !typeId) return startStr;
    const d = new Date(startStr);
    if (Number.isNaN(d.getTime())) return '';
    d.setHours(d.getHours() + getTaskDurationHours(typeId));
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

const getComputedStatus = (task) => {
    if (!task) return 'UNKNOWN';
    const baseStatus = normalize(task.status);
    if (['COMPLETED', 'CANCELLED'].includes(baseStatus)) return baseStatus;
    if (task.due_date && new Date(task.due_date) < new Date()) return 'OVERDUE';
    return baseStatus;
};

const canDeleteTask = (task) => {
    if (!task) return false;
    const originalStatus = String(task.status || '').toUpperCase();
    if (originalStatus !== 'PENDING') return false;
    if (!task.start_date) return false;
    return new Date().getTime() < new Date(task.start_date).getTime();
};

const getStatusBadge = (task) => {
    const status = getComputedStatus(task);
    switch (status) {
        case 'PENDING': return <span className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-black uppercase tracking-wide rounded shadow-sm whitespace-nowrap">Chờ xử lý</span>;
        case 'IN_PROGRESS': return <span className="px-2 py-1 bg-sky-50 text-sky-600 border border-sky-200 text-[10px] font-black uppercase tracking-wide rounded shadow-sm whitespace-nowrap">Đang làm</span>;
        case 'COMPLETED': return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-black uppercase tracking-wide rounded shadow-sm whitespace-nowrap">Hoàn thành</span>;
        case 'CANCELLED': return <span className="px-2 py-1 bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-black uppercase tracking-wide rounded shadow-sm whitespace-nowrap">Đã hủy</span>;
        case 'OVERDUE': return <span className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-black uppercase tracking-wide rounded shadow-sm whitespace-nowrap animate-pulse">Quá hạn</span>;
        default: return <span className="px-2 py-1 bg-slate-50 text-slate-500 border border-slate-200 text-[10px] font-black uppercase tracking-wide rounded shadow-sm whitespace-nowrap">{status}</span>;
    }
};

const Sparkline = ({ color }) => (
    <svg className="w-full h-8 opacity-60" viewBox="0 0 100 30" preserveAspectRatio="none">
        <path d="M0 25 Q 20 5, 40 15 T 70 10 T 100 20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700">
                {payload[0].payload.label}: <span className="text-emerald-400">{payload[0].value}</span>
            </div>
        );
    }
    return null;
};

// ============================================================================
// COMPONENT: KÉO THẢ CHUỘT
// ============================================================================
const DraggableRow = ({ children }) => {
    const scrollRef = useRef(null);
    let isDown = false;
    let startX;
    let scrollLeft;

    const handleMouseDown = (e) => {
        isDown = true;
        scrollRef.current.classList.add('cursor-grabbing');
        startX = e.pageX - scrollRef.current.offsetLeft;
        scrollLeft = scrollRef.current.scrollLeft;
    };
    const handleMouseLeave = () => { isDown = false; scrollRef.current.classList.remove('cursor-grabbing'); };
    const handleMouseUp = () => { isDown = false; scrollRef.current.classList.remove('cursor-grabbing'); };
    const handleMouseMove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 1.5;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    return (
        <div ref={scrollRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} className="flex-1 p-4 overflow-x-auto cursor-grab scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            <div className="flex gap-4 w-max min-w-full pb-2">{children}</div>
        </div>
    );
};

// ============================================================================
// COMPONENT (REACT.MEMO): TỐI ƯU HIỆU NĂNG
// ============================================================================
const TaskCard = React.memo(({ task, readOnly, onSelect, onEdit, onDelete }) => {
    const isUnassignedSOP = !(task.assigned_workers_list?.length > 0);
    const isOverdue = getComputedStatus(task) === 'OVERDUE';

    return (
        <div className={`w-[280px] shrink-0 bg-white rounded-xl border shadow-sm hover:shadow-md transition-all flex flex-col relative group overflow-hidden ${isUnassignedSOP ? 'border-amber-300' : (isOverdue ? 'border-rose-300' : 'border-slate-200 hover:border-sky-300')}`}>
            {isUnassignedSOP && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>}
            {isOverdue && !isUnassignedSOP && <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 animate-pulse"></div>}

            <div className="px-3.5 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[120px]" title={task.type_name || task.task_type}>
                    {task.type_name || task.task_type}
                </span>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border shadow-sm ${isOverdue ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-700'}`}>
                    {formatDate(task.start_date).split(' ')[1]} - {formatDate(task.due_date).split(' ')[1]}
                </span>
            </div>

            <div className="px-3.5 py-3 flex-1">
                <h3 className="font-extrabold text-slate-800 text-[14px] leading-tight line-clamp-2 mb-2" title={task.task_title}>{task.task_title}</h3>
                <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                        <span>📍</span> <strong>{task.pond_name || '-'}</strong>
                    </div>
                    <div className="scale-90 origin-right">{getStatusBadge(task)}</div>
                </div>
            </div>

            <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex-1 overflow-hidden pr-2">
                    {isUnassignedSOP ? (
                        <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 uppercase flex items-center gap-1 w-max">
                            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span></span>
                            Cần phân công
                        </span>
                    ) : (
                        <div className="flex items-center gap-1.5" title={task.assigned_workers_list.map(w => w.full_name).join(', ')}>
                            <div className="flex -space-x-1.5 shrink-0">
                                {task.assigned_workers_list.slice(0, 3).map((w, idx) => (
                                    <div key={idx} className="w-5 h-5 rounded-full bg-slate-300 border border-white flex items-center justify-center text-[8px] font-bold text-slate-700 shadow-sm">
                                        {w.full_name.charAt(0)}
                                    </div>
                                ))}
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 truncate">
                                {task.assigned_workers_list.length > 3 ? `+${task.assigned_workers_list.length - 3}` : task.assigned_workers_list[0].full_name.split(' ').pop()}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex gap-1 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onSelect(task)} className="w-7 h-7 rounded bg-white border border-slate-200 text-slate-500 hover:bg-sky-50 hover:text-sky-600 flex items-center justify-center shadow-sm" title="Xem chi tiết">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    {!readOnly && getComputedStatus(task) === 'PENDING' && (
                        <button onClick={() => onEdit(task)} className={`w-7 h-7 rounded border flex items-center justify-center shadow-sm ${isUnassignedSOP ? 'bg-amber-500 border-amber-600 text-white hover:bg-amber-600 animate-bounce' : 'bg-white border-slate-200 text-slate-500 hover:bg-amber-50 hover:text-amber-600'}`} title="Chỉnh sửa / Phân công">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                    )}
                    {!readOnly && canDeleteTask(task) && (
                        <button onClick={() => onDelete(task.task_id)} className="w-7 h-7 rounded border bg-white border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center shadow-sm" title="Xóa công việc">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});


// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
const TaskManagementPage = ({
    mode = 'technician',
    readOnly = false,
    canComplete = false,
    showWorkerFilter = true,
    showEngineerFilter = false,
    pageTitle = 'Quản lý công việc',
    pageSubtitle = 'Phân phối Kịch bản SOP & Tiến độ thực địa'
}) => {
    const [tasks, setTasks] = useState([]);
    const [ponds, setPonds] = useState([]);
    const [products, setProducts] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [matrixPonds, setMatrixPonds] = useState([]);
    const [engineersList, setEngineersList] = useState([]);

    const [loading, setLoading] = useState(true);
    const [loadingPonds, setLoadingPonds] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(7); // Mặc định hiển thị theo Tuần (7 ngày)

    const [selectedTask, setSelectedTask] = useState(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const [filterPond, setFilterPond] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterSeason, setFilterSeason] = useState('');
    const [filterWorker, setFilterWorker] = useState('');
    const [filterEngineer, setFilterEngineer] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');

    const [reportNote, setReportNote] = useState('');

    const initialForm = { task_type: '', assignments: [], task_title: '', description: '', start_date: '', due_date: '', materials: [{ product_id: '', quantity: '' }] };
    const [form, setForm] = useState(initialForm);
    const [editForm, setEditForm] = useState({ task_id: '', type_id: '', task_title: '', description: '', start_date: '', due_date: '', assigned_workers: [], materials: [] });

    const isProductRequired = useMemo(() => ['1', '2', '3'].includes(String(form.task_type)), [form.task_type]);
    const isEditProductRequired = useMemo(() => ['1', '2', '3'].includes(String(editForm?.type_id || editForm?.task_type)), [editForm?.type_id, editForm?.task_type]);

    const getFilteredProducts = useCallback((typeId) => {
        if (!typeId) return products;
        const type = String(typeId);

        return products.filter(p => {
            const catCode = String(p.category_code || '').toUpperCase();
            if (type === '2') return ['CAT-THUC-AN', 'CAT-THUOC', 'CAT-KHOANG-VITAMIN', 'CAT-VI-SINH'].includes(catCode);
            if (type === '1' || type === '3') return ['CAT-HOA-CHAT', 'CAT-VI-SINH', 'CAT-KHOANG-VITAMIN'].includes(catCode);
            return true;
        });
    }, [products]);

    const handleAddMaterial = (isEdit = false) => {
        if (isEdit) setEditForm(prev => ({ ...prev, materials: [...prev.materials, { product_id: '', quantity: '' }] }));
        else setForm(prev => ({ ...prev, materials: [...prev.materials, { product_id: '', quantity: '' }] }));
    };

    const handleRemoveMaterial = (index, isEdit = false) => {
        if (isEdit) setEditForm(prev => ({ ...prev, materials: prev.materials.filter((_, i) => i !== index) }));
        else setForm(prev => ({ ...prev, materials: prev.materials.filter((_, i) => i !== index) }));
    };

    const handleMaterialChange = (index, field, value, isEdit = false) => {
        if (isEdit) {
            setEditForm(prev => {
                const newMaterials = [...prev.materials];
                newMaterials[index][field] = value;
                return { ...prev, materials: newMaterials };
            });
        } else {
            setForm(prev => {
                const newMaterials = [...prev.materials];
                newMaterials[index][field] = value;
                return { ...prev, materials: newMaterials };
            });
        }
    };

    const fetchTasks = useCallback(async () => {
        try {
            setLoading(true);
            const res = await taskService.getAllTasks();
            setTasks(res?.data?.data || []);
        } catch {
            showToast({ title: 'Không tải được danh sách', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSelectTask = useCallback((task) => setSelectedTask(task), []);

    const handleOpenEdit = useCallback((task) => {
        const mappedMaterials = task.materials_list && task.materials_list.length > 0
            ? task.materials_list.map(m => ({ product_id: String(m.product_id), quantity: m.quantity }))
            : [{ product_id: '', quantity: '' }];

        setEditForm({
            ...task,
            start_date: formatForInput(task.start_date),
            due_date: formatForInput(task.due_date),
            assigned_workers: task.assigned_workers_list ? task.assigned_workers_list.map(w => w.worker_id) : [],
            materials: mappedMaterials
        });
        setIsEditOpen(true);
    }, []);

    const handleDeleteTask = useCallback(async (taskId) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa công việc này? Thao tác này không thể hoàn tác.')) return;
        try {
            await taskService.deleteTask(taskId);
            showToast({ title: 'Đã xóa công việc khỏi lịch trình', type: 'success' });
            setSelectedTask(null);
            fetchTasks();
        } catch (error) {
            showToast({ title: error?.response?.data?.message || 'Lỗi hệ thống khi xóa công việc', type: 'error' });
        }
    }, [fetchTasks]);

    const handleCreateTask = async () => {
        try {
            await taskService.createTasks(form);
            showToast({ title: 'Giao việc thành công!', type: 'success' });
            setIsCreateOpen(false);
            fetchTasks();
        } catch (error) { showToast({ title: 'Lỗi giao việc', type: 'error' }); }
    };

    const handleUpdateTask = async () => {
        try {
            await taskService.updateTask(editForm.task_id, editForm);
            showToast({ title: 'Cập nhật kế hoạch thành công!', type: 'success' });
            setIsEditOpen(false);
            fetchTasks();
        } catch (error) { showToast({ title: 'Lỗi cập nhật', type: 'error' }); }
    };

    const handleCompleteTask = async (taskId) => {
        try {
            await taskService.completeTask(taskId, { note: reportNote });
            showToast({ title: 'Đã báo cáo hoàn thành', type: 'success' });
            setSelectedTask(null);
            setReportNote('');
            fetchTasks();
        } catch (error) { showToast({ title: error?.response?.data?.message || 'Lỗi báo cáo thực địa', type: 'error' }); }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                await fetchTasks();
                if (!readOnly && mode === 'technician') {
                    const [prodRes, workerRes, pondRes] = await Promise.all([
                        productService.getProducts(),
                        taskService.getWorkersStatus(),
                        pondService.getAllPonds()
                    ]);
                    setProducts(prodRes?.data?.data || []);
                    setWorkers(workerRes?.data?.data || []);
                    setPonds(pondRes?.data?.data || []);
                } else if (mode === 'owner') {
                    const [pondRes, userRes] = await Promise.all([pondService.getAllPonds(), userService.getAllUsers()]);
                    setPonds(pondRes?.data?.data || []);
                    const allUsers = userRes?.data?.data || [];
                    setEngineersList(allUsers.filter(u => normalize(u.role_name) === 'TECHNICIAN' || normalize(u.role) === 'TECHNICIAN'));
                    setWorkers(allUsers.filter(u => normalize(u.role_name) === 'WORKER' || normalize(u.role) === 'WORKER'));
                }
            } catch (err) { showToast({ title: 'Lỗi khởi tạo dữ liệu', type: 'error' }); }
            finally { setLoading(false); }
        };
        loadInitialData();
    }, [fetchTasks, readOnly, mode]);

    const availableSeasons = useMemo(() => {
        let filtered = tasks;
        if (filterPond) {
            filtered = filtered.filter(t => String(t.pond_id) === String(filterPond));
        }
        const uniqueIds = [...new Set(filtered.map(t => t.season_id).filter(Boolean))];
        return uniqueIds.map(id => ({ id, name: tasks.find(t => t.season_id === id)?.season_name || `Mùa vụ ${id}` }));
    }, [tasks, filterPond]);

    const engineers = useMemo(() => [...new Set(tasks.map(t => t.assigned_by).filter(Boolean))].map(id => ({ id, name: tasks.find(t => t.assigned_by === id)?.creator_name || `Kỹ sư ID: ${id}` })), [tasks]);

    // 🌟 ĐÃ NÂNG CẤP: LỌC AO 'DANG_XU_LY' NẾU TYPE LÀ '1' VÀ LOẠI BỎ HẠN CHẾ VỀ NHÂN CÔNG BẬN
    const handleTypeChange = async (e) => {
        if (readOnly) return;
        const typeCode = e.target.value?.trim() || '';
        let newStart = form.start_date;
        let newDue = form.due_date;

        if (typeCode) {
            if (!newStart) {
                const now = new Date();
                newStart = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            }
            newDue = calculateDueDate(newStart, typeCode);
        }

        setForm(prev => ({
            ...prev, task_type: typeCode, start_date: newStart || prev.start_date, due_date: newDue || prev.due_date,
            assignments: [], materials: [{ product_id: '', quantity: '' }]
        }));

        setMatrixPonds([]);
        if (!typeCode) return;

        setLoadingPonds(true);
        try {
            if (String(typeCode) === '1') {
                // NẾU LÀ CÔNG VIỆC SỐ 1: Bỏ qua Backend, dùng Frontend Ponds State để lấy trọn vẹn Ao ĐANG XỬ LÝ (vì chưa có vụ nuôi)
                const xuLyPonds = ponds.filter(p => {
                    const status = String(p.status || '').toUpperCase();
                    const usage = String(p.usage_status || '').toUpperCase();
                    return (status === 'DANG_XU_LY' || status === 'DANG_CAI_TAO') && usage !== 'NGUNG_SU_DUNG';
                });
                setMatrixPonds(xuLyPonds);
            } else {
                const res = await taskService.getPondsByType(parseInt(typeCode, 10));
                setMatrixPonds(res?.data?.data || []);
            }
        } catch (err) { showToast({ title: 'Lỗi tải danh sách ao', type: 'error' }); }
        finally { setLoadingPonds(false); }
    };

    const toggleAssignment = (workerId, pondId) => {
        setForm(prev => {
            const isChecked = prev.assignments.some(a => a.worker_id === workerId && a.pond_id === pondId);
            if (isChecked) {
                // Hủy check
                return { ...prev, assignments: prev.assignments.filter(a => !(a.worker_id === workerId && a.pond_id === pondId)) };
            }
            // Thêm check - Đã bỏ giới hạn 1 nhân viên 1 ao
            return { ...prev, assignments: [...prev.assignments, { worker_id: workerId, pond_id: pondId }] };
        });
    };

    const handleResetFilters = () => {
        setFilterPond('');
        setFilterType('');
        setFilterSeason('');
        setFilterWorker('');
        setFilterEngineer('');
        setFilterStatus('ALL');
        setCurrentPage(1);
    };

    const hasActiveFilters = filterType || filterPond || filterSeason || filterEngineer || filterWorker || filterStatus !== 'ALL';

    const stats = useMemo(() => {
        const computedTasks = tasks.map(t => ({ ...t, computedStatus: getComputedStatus(t) }));
        return {
            total: computedTasks.length,
            pending: computedTasks.filter(t => t.computedStatus === 'PENDING').length,
            progress: computedTasks.filter(t => t.computedStatus === 'IN_PROGRESS').length,
            completed: computedTasks.filter(t => t.computedStatus === 'COMPLETED').length,
            overdue: computedTasks.filter(t => t.computedStatus === 'OVERDUE').length,
        };
    }, [tasks]);

    const unassignedUpcomingTasks = useMemo(() => {
        const now = new Date();
        const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);

        return tasks.filter(t => {
            if (getComputedStatus(t) !== 'PENDING') return false;
            if (t.assigned_workers_list?.length > 0) return false;
            if (!t.start_date) return false;

            const taskStart = new Date(t.start_date);
            return taskStart >= tomorrowStart && taskStart <= tomorrowEnd;
        });
    }, [tasks]);

    const taskStatusChartData = [
        { label: 'Đang thực hiện', value: stats.progress, color: '#0ea5e9' },
        { label: 'Chờ xử lý', value: stats.pending, color: '#f59e0b' },
        { label: 'Hoàn thành', value: stats.completed, color: '#10b981' },
        { label: 'Quá hạn', value: stats.overdue, color: '#f43f5e' },
    ].filter(d => d.value > 0);

    const taskTypeChartData = useMemo(() => {
        const counts = {};
        tasks.forEach(t => { const l = t.type_name || t.task_type || 'Khác'; counts[l] = (counts[l] || 0) + 1; });
        return Object.keys(counts).map((key, idx) => ({ label: key, value: counts[key], color: CHART_COLORS[idx % CHART_COLORS.length] }));
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const matchType = !filterType || String(task.type_id) === String(filterType);
            const matchPond = !filterPond || String(task.pond_id) === String(filterPond);
            const matchSeason = !filterSeason || String(task.season_id) === String(filterSeason);
            const matchEngineer = !filterEngineer || String(task.assigned_by) === String(filterEngineer);
            const matchWorker = !filterWorker ||
                (filterWorker === 'UNASSIGNED'
                    ? !(task.assigned_workers_list?.length > 0)
                    : (task.assigned_workers_list && task.assigned_workers_list.some(w => String(w.worker_id) === String(filterWorker))));
            const matchStatus = filterStatus === 'ALL' || String(getComputedStatus(task)) === String(filterStatus);
            return matchType && matchPond && matchSeason && matchEngineer && matchWorker && matchStatus;
        }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    }, [tasks, filterType, filterPond, filterSeason, filterEngineer, filterWorker, filterStatus]);

    const tasksGroupedByDate = useMemo(() => {
        const groups = {};
        filteredTasks.forEach(t => {
            const dateObj = new Date(t.start_date || t.due_date);
            let dateStr = 'Khác';
            if (!Number.isNaN(dateObj.getTime())) {
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                dateStr = `${yyyy}-${mm}-${dd}`;
            }
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(t);
        });

        return Object.keys(groups).sort((a, b) => {
            if (a === 'Khác') return 1;
            if (b === 'Khác') return -1;
            return new Date(a) - new Date(b);
        }).map(key => ({ dateStr: key, tasks: groups[key] }));
    }, [filteredTasks]);

    const totalPages = Math.max(1, Math.ceil(tasksGroupedByDate.length / pageSize));
    const safePage = Math.min(Math.max(currentPage, 1), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, tasksGroupedByDate.length);
    const paginatedGroups = tasksGroupedByDate.slice(startIndex, endIndex);

    const getCalendarDateInfo = (dateStr) => {
        if (dateStr === 'Khác') return { dayOfWeek: 'Chưa rõ', dateInfo: 'Không có hạn chót', isToday: false };
        const [y, m, d] = dateStr.split('-');
        const dateObj = new Date(y, m - 1, d);
        const today = new Date();
        const tDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffDays = Math.round((dateObj - tDate) / (1000 * 60 * 60 * 24));
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        let dayOfWeek = days[dateObj.getDay()];
        if (diffDays === 0) dayOfWeek = 'Hôm nay';
        else if (diffDays === 1) dayOfWeek = 'Ngày mai';
        else if (diffDays === -1) dayOfWeek = 'Hôm qua';

        return {
            dayOfWeek,
            dateInfo: dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            isToday: diffDays === 0,
            isPast: diffDays < 0
        };
    };

    if (loading && tasks.length === 0) return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">

            {/* HEADER */}
            <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">{pageTitle}</h1>
                    <p className="text-slate-500 font-medium mt-1.5">{pageSubtitle}</p>
                </div>

                {!readOnly && (
                    <div className="relative z-10 w-full md:w-auto">
                        <button onClick={() => setIsCreateOpen(true)} className="w-full md:w-auto px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2">
                            <span className="text-xl leading-none">+</span> Giao việc (Ma trận)
                        </button>
                    </div>
                )}
            </div>

            {/* THÔNG BÁO NHẮC NHỞ PHÂN CÔNG SOP */}
            {!readOnly && unassignedUpcomingTasks.length > 0 && (
                <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 md:p-5 rounded-r-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-2xl shadow-inner animate-bounce">⏰</div>
                        <div>
                            <h3 className="text-amber-900 font-extrabold text-lg">Nhắc nhở Phân công SOP</h3>
                            <p className="text-amber-800 font-medium mt-0.5">Bạn có <strong className="text-2xl text-amber-600 mx-1.5">{unassignedUpcomingTasks.length}</strong> công việc SOP <strong className="text-amber-900 bg-amber-200 px-1 rounded">TRONG NGÀY MAI</strong> chưa có nhân sự thực hiện.</p>
                        </div>
                    </div>
                    <button onClick={() => {
                        handleResetFilters();
                        setFilterStatus('PENDING');
                        setFilterWorker('UNASSIGNED');
                        setPageSize(7);
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }} className="w-full md:w-auto px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-black rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap">
                        Lọc & Phân công ngay
                    </button>
                </div>
            )}

            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5 mb-6">
                <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Tổng công việc</span><div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">📋</div></div>
                    <strong className="block text-3xl font-black text-slate-800">{stats.total}</strong>
                    <div className="mt-2"><Sparkline color="#94a3b8" /></div>
                </div>
                <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Chờ xử lý</span><div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">⌛</div></div>
                    <strong className="block text-3xl font-black text-slate-800">{stats.pending}</strong>
                    <div className="mt-2"><Sparkline color="#f59e0b" /></div>
                </div>
                <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Đang thực hiện</span><div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-500">🔄</div></div>
                    <strong className="block text-3xl font-black text-slate-800">{stats.progress}</strong>
                    <div className="mt-2"><Sparkline color="#0ea5e9" /></div>
                </div>
                <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Hoàn thành</span><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">✅</div></div>
                    <strong className="block text-3xl font-black text-slate-800">{stats.completed}</strong>
                    <div className="mt-2"><Sparkline color="#10b981" /></div>
                </div>
                <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Quá hạn</span><div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">⚠️</div></div>
                    <strong className="block text-3xl font-black text-slate-800">{stats.overdue}</strong>
                    <div className="mt-2"><Sparkline color="#f43f5e" /></div>
                </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
                <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
                    {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
                    <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Công việc theo Trạng thái</h3>
                    <div className="flex-1 flex items-center relative z-0">
                        <div className="w-1/2 h-[180px]">
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie data={taskStatusChartData} innerRadius="65%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                                        {taskStatusChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 pl-6 flex flex-col gap-3 justify-center">
                            {taskStatusChartData.map(item => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div><span className="text-sm font-bold text-slate-500">{item.label}</span></div>
                                    <span className="text-base font-black text-slate-800">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
                    {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
                    <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Tỷ lệ phân loại công việc</h3>
                    <div className="flex-1 h-[180px] relative z-0">
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={taskTypeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={40}>
                                    {taskTypeChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* POND SELECTOR (LỌC THEO AO TRƯỚC TIÊN) */}
            <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-2 scrollbar-hide">
                <button
                    onClick={() => { setFilterPond(''); setCurrentPage(1); }}
                    className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${filterPond === '' ? 'bg-slate-800 text-white shadow-md scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                >
                    Tất cả khu vực
                </button>
                {ponds.map((pond) => {
                    const isActive = String(filterPond) === String(pond.pond_id);
                    return (
                        <button
                            key={pond.pond_id}
                            onClick={() => { setFilterPond(pond.pond_id); setCurrentPage(1); }}
                            className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${isActive ? 'bg-slate-800 text-white shadow-md scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                        >
                            {pond.pond_name || pond.pond_code || `Ao ${pond.pond_id}`}
                        </button>
                    )
                })}
            </div>

            {/* TABLE & FILTERS */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden relative mb-12">
                {loading && (
                    <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm flex items-center justify-center transition-all">
                        <div className="flex flex-col items-center">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
                            <span className="font-bold text-slate-600">Đang tải dữ liệu...</span>
                        </div>
                    </div>
                )}

                <div className="p-5 border-b border-slate-100 flex flex-wrap gap-3 bg-slate-50/30 items-center">
                    <select
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold outline-none shadow-sm cursor-pointer flex-1 min-w-[180px] transition-colors ${filterType ? 'bg-sky-50 border-sky-300 text-sky-800 border' : 'bg-white border-slate-200 text-slate-600 border'}`}
                    >
                        <option value="">Tất cả loại công việc</option>
                        {TASK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>

                    <select
                        value={filterSeason}
                        onChange={(e) => { setFilterSeason(e.target.value); setCurrentPage(1); }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold outline-none shadow-sm cursor-pointer flex-1 min-w-[150px] transition-colors ${filterSeason ? 'bg-sky-50 border-sky-300 text-sky-800 border' : 'bg-white border-slate-200 text-slate-600 border'}`}
                    >
                        <option value="">{filterPond ? `Tất cả mùa vụ của ao này` : 'Tất cả mùa vụ'}</option>
                        {availableSeasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    {showEngineerFilter && (
                        <select
                            value={filterEngineer}
                            onChange={(e) => { setFilterEngineer(e.target.value); setCurrentPage(1); }}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold outline-none shadow-sm cursor-pointer flex-1 min-w-[150px] transition-colors ${filterEngineer ? 'bg-sky-50 border-sky-300 text-sky-800 border' : 'bg-white border-slate-200 text-slate-600 border'}`}
                        >
                            <option value="">Tất cả kỹ sư</option>
                            {(readOnly && engineersList.length > 0 ? engineersList.map(e => ({ id: e.user_id, name: e.full_name })) : engineers).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    )}

                    {showWorkerFilter && (
                        <select
                            value={filterWorker}
                            onChange={(e) => { setFilterWorker(e.target.value); setCurrentPage(1); }}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold outline-none shadow-sm cursor-pointer flex-1 min-w-[150px] transition-colors ${filterWorker ? (filterWorker === 'UNASSIGNED' ? 'bg-amber-100 border-amber-400 text-amber-900 border' : 'bg-sky-50 border-sky-300 text-sky-800 border') : 'bg-white border-slate-200 text-slate-600 border'}`}
                        >
                            <option value="">Tất cả nhân công</option>
                            <option value="UNASSIGNED" className="font-bold text-amber-600">⚠️ Chưa phân công</option>
                            {workers.filter(w => !w.role_name || normalize(w.role_name) === 'WORKER' || normalize(w.role) === 'WORKER').map(w => <option key={w.worker_id || w.user_id} value={w.worker_id || w.user_id}>{w.full_name}</option>)}
                        </select>
                    )}

                    <select
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold outline-none shadow-sm cursor-pointer flex-1 min-w-[160px] transition-colors ${filterStatus !== 'ALL' ? 'bg-sky-50 border-sky-300 text-sky-800 border' : 'bg-white border-slate-200 text-slate-600 border'}`}
                    >
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>

                    {hasActiveFilters && (
                        <button
                            onClick={handleResetFilters}
                            className="px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 hover:border-rose-300 rounded-xl text-sm font-black transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            Bỏ lọc
                        </button>
                    )}
                </div>

                <div className="bg-white overflow-hidden relative">
                    {tasksGroupedByDate.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                            <span className="text-6xl mb-4">📭</span>
                            <h3 className="font-extrabold text-xl text-slate-600">Không tìm thấy công việc</h3>
                            <p className="font-medium mt-1">Thử thay đổi bộ lọc ở trên xem sao.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col divide-y divide-slate-200">
                            {paginatedGroups.map((group) => {
                                const { dayOfWeek, dateInfo, isToday, isPast } = getCalendarDateInfo(group.dateStr);

                                return (
                                    <div key={group.dateStr} className="flex flex-col md:flex-row group/row hover:bg-slate-50/30 transition-colors">
                                        <div className={`w-full md:w-[150px] lg:w-[180px] shrink-0 p-4 md:p-6 border-b md:border-b-0 md:border-r border-slate-200 flex flex-row md:flex-col items-center md:items-start justify-between md:justify-center gap-2 transition-colors ${isToday ? 'bg-sky-50/80' : 'bg-slate-50'}`}>
                                            <div className="flex flex-col items-start">
                                                <div className={`text-lg font-black ${isToday ? 'text-sky-600' : (isPast ? 'text-slate-400' : 'text-slate-700')}`}>
                                                    {dayOfWeek}
                                                </div>
                                                <div className="text-sm font-bold text-slate-500">{dateInfo}</div>
                                            </div>
                                            {isToday && (
                                                <span className="px-2.5 py-1 bg-sky-100 text-sky-700 text-[10px] font-black uppercase rounded-lg border border-sky-200 shadow-sm">
                                                    Hôm nay
                                                </span>
                                            )}
                                        </div>

                                        <DraggableRow>
                                            {group.tasks.map(t => (
                                                <TaskCard
                                                    key={t.task_id}
                                                    task={t}
                                                    readOnly={readOnly}
                                                    onSelect={handleSelectTask}
                                                    onEdit={handleOpenEdit}
                                                    onDelete={handleDeleteTask}
                                                />
                                            ))}
                                        </DraggableRow>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* 🌟 NÂNG CẤP: ĐỒNG BỘ PHÂN TRANG UI CHO TASK VỚI CÁC TRANG KHÁC */}
                <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-600 font-medium bg-white">
                    <div className="flex items-center gap-3">
                        <span>Nhóm theo</span>
                        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 outline-none bg-slate-50 focus:border-sky-500 shadow-sm font-bold cursor-pointer">
                            <option value={1}>1 Ngày</option>
                            <option value={7}>7 Ngày (Tuần)</option>
                            <option value={30}>30 Ngày (Tháng)</option>
                            <option value={365}>Tất cả (Năm)</option>
                        </select>
                        <span>({tasksGroupedByDate.length > 0 ? startIndex + 1 : 0} - {endIndex} / {tasksGroupedByDate.length} mốc ngày)</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(p => p - 1)} disabled={safePage <= 1} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Trước</button>
                        <div className="flex items-center justify-center px-4 py-2 bg-sky-50 text-sky-700 font-bold rounded-xl border border-sky-100 shadow-inner">{safePage} / {totalPages || 1}</div>
                        <button onClick={() => setCurrentPage(p => p + 1)} disabled={safePage >= totalPages} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Sau</button>
                    </div>
                </div>
            </div>

            {/* MODAL CHI TIẾT */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setSelectedTask(null)}>
                    <div className="bg-white max-w-3xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Chi tiết Kế hoạch</h2>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedTask(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2 pb-2">
                            {mode !== 'worker' && <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Mã công việc</span><strong className="text-base text-sky-600">#{selectedTask.task_code || '-'}</strong></div>}
                            <div className={`bg-slate-50 p-4 rounded-2xl border border-slate-100 ${mode === 'worker' ? 'col-span-2' : ''}`}><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Loại công việc</span><strong className="text-base text-slate-800">{selectedTask.type_name || selectedTask.task_type || '-'}</strong></div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Tiêu đề</span><strong className="text-lg text-slate-800">{selectedTask.task_title || '-'}</strong></div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ao thực hiện</span><strong className="text-base text-emerald-600">{selectedTask.pond_name || '-'}</strong></div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Thuộc Mùa vụ</span>
                                <strong className="text-base text-slate-800">
                                    {selectedTask?.season_name || 'Chung'}
                                </strong>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Bắt đầu</span><strong className="text-base text-slate-800">{formatDate(selectedTask.start_date)}</strong></div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Hạn chót</span><strong className="text-base text-slate-800">{formatDate(selectedTask.due_date)}</strong></div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-2">Trạng thái</span>{getStatusBadge(selectedTask)}</div>

                            {selectedTask.materials_list && selectedTask.materials_list.length > 0 ? (
                                <div className="bg-sky-50 p-4 rounded-2xl border border-sky-200 col-span-2">
                                    <span className="text-xs font-bold text-sky-600 uppercase block mb-2">Vật tư chỉ định xuất kho</span>
                                    <div className="flex flex-col gap-2">
                                        {selectedTask.materials_list.map((m, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-sky-100 shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                                    <span className="text-slate-800 font-bold text-sm">{m.product_name}</span>
                                                </div>
                                                <div className="text-sm font-medium text-slate-600">
                                                    Định mức: <strong className="text-lg text-sky-600 ml-1">{m.quantity}</strong> {m.unit}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300 col-span-2 text-slate-500 font-medium italic text-sm">Công việc không yêu cầu xuất kho vật tư.</div>
                            )}

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Mô tả / Hướng dẫn</span><p className="text-sm text-slate-700 m-0 whitespace-pre-line bg-white p-3 rounded-xl border border-slate-200">{selectedTask.description || '-'}</p></div>

                            {mode !== 'worker' && (
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 col-span-2 flex flex-col gap-3">
                                    <span className="text-xs font-bold text-amber-700 uppercase block">Chi tiết phân công & Báo cáo</span>
                                    {(selectedTask.assigned_workers_list || []).length > 0 ? selectedTask.assigned_workers_list.map(w => (
                                        <div key={w.worker_id} className="bg-white p-3 rounded-xl border border-amber-100 flex flex-col gap-2">
                                            <div className="flex justify-between items-center"><strong className="text-sm text-slate-800">Công nhân: <span className="text-amber-600">{w.full_name}</span></strong><span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100">{w.worker_status || 'ASSIGNED'}</span></div>
                                            {w.completed_at && <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">✓ Hoàn thành: <strong>{formatDate(w.completed_at)}</strong></div>}
                                            {w.note && <div className="text-xs text-slate-700 bg-slate-100 p-2 rounded-lg border-l-2 border-slate-300"><strong>Ghi chú:</strong> {w.note}</div>}
                                        </div>
                                    )) : <span className="text-sm text-rose-500 italic font-bold">⚠️ Công việc này do SOP tạo nhưng Kỹ sư CHƯA gán công nhân!</span>}
                                </div>
                            )}

                            {canComplete && ['IN_PROGRESS', 'OVERDUE', 'PENDING'].includes(normalize(selectedTask.status)) && (
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 col-span-2 mt-2">
                                    <label className={`text-sm font-bold block mb-2 ${getComputedStatus(selectedTask) === 'OVERDUE' ? 'text-rose-600' : 'text-slate-800'}`}>📝 Báo cáo thực địa {getComputedStatus(selectedTask) === 'OVERDUE' && '(Bắt buộc giải trình)'}</label>
                                    <textarea className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-100 outline-none text-sm resize-none mb-3" rows="3" placeholder="Nhập ghi chú kết quả công việc..." value={reportNote} onChange={e => setReportNote(e.target.value)} />
                                    <button onClick={() => handleCompleteTask(selectedTask.task_id)} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-md">✓ XÁC NHẬN HOÀN THÀNH</button>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
                            <button onClick={() => setSelectedTask(null)} className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng hộp thoại</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TẠO MỚI */}
            {!readOnly && isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setIsCreateOpen(false)}>
                    <div className="bg-white max-w-5xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Phân công Công việc (Hệ Ma trận)</h2>
                            <button onClick={() => setIsCreateOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
                        </div>

                        <div className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex flex-col gap-4 flex-1 overflow-y-auto pr-2 pb-2 scrollbar-hide">

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-slate-700">Loại công việc <span className="text-rose-500">*</span></label>
                                    <select value={form.task_type} onChange={handleTypeChange} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-emerald-700 bg-white shadow-sm cursor-pointer">
                                        <option value="">-- Chọn loại công việc để tải ma trận ao thích hợp --</option>
                                        {TASK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>

                                {/* BẢNG MA TRẬN */}
                                {form.task_type && (
                                    <div className="flex flex-col border border-slate-200 rounded-[16px] shadow-sm relative mt-2 mb-2 overflow-hidden bg-white min-h-[250px]">
                                        {loadingPonds && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                                            </div>
                                        )}

                                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 font-bold text-slate-700 text-sm flex justify-between items-center shrink-0">
                                            <span>Ma trận Phân công (Nhân công × Ao nuôi đang hoạt động)</span>
                                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 shadow-sm">
                                                Đã chọn: {form.assignments.length}
                                            </span>
                                        </div>

                                        <div className="flex-1 overflow-auto max-h-[300px]">
                                            <table className="w-full text-center border-collapse">
                                                <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-4 border-r border-slate-200 text-left font-bold text-slate-600 bg-slate-50 w-[180px]">Nhân sự</th>
                                                        {matrixPonds.map(p => (
                                                            <th key={p.pond_id} className="px-3 py-4 text-xs font-bold text-slate-600 whitespace-nowrap bg-slate-50" title={p.pond_name}>
                                                                {p.pond_code || p.pond_name}
                                                            </th>
                                                        ))}
                                                        {matrixPonds.length === 0 && !loadingPonds && (
                                                            <th colSpan={100} className="px-4 py-4 text-sm font-medium text-slate-400 italic bg-slate-50 text-left">
                                                                {form.task_type === '1'
                                                                    ? '⚠️ Không có ao nào đang ở trạng thái "Đang xử lý" để thực hiện việc cải tạo đầu vụ này.'
                                                                    : 'Không có ao phù hợp cho loại công việc này.'}
                                                            </th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {workers.map(w => {
                                                        const wId = Number(w.worker_id || w.user_id);
                                                        const isBusy = normalize(w.work_status) === 'BUSY';
                                                        return (
                                                            <tr key={wId} className={`transition-colors hover:bg-slate-50/80`}>
                                                                <td className="px-4 py-3 border-r border-slate-200 text-left bg-white sticky left-0 z-0">
                                                                    <strong className="block text-slate-800 text-sm">{w.full_name}</strong>
                                                                    {/* 🌟 NÂNG CẤP: Chuyển màu nhãn báo hiệu nhân công có lịch bận nhưng không khóa checkbox */}
                                                                    <span className={`text-[10px] font-bold uppercase mt-1 inline-block px-1.5 py-0.5 rounded ${isBusy ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                                        {isBusy ? '● Có lịch bận' : '● Rảnh rỗi'}
                                                                    </span>
                                                                </td>
                                                                {matrixPonds.map(p => {
                                                                    const pId = Number(p.pond_id);
                                                                    const isChecked = form.assignments.some(a => a.worker_id === wId && a.pond_id === pId);

                                                                    return (
                                                                        <td key={pId} className="px-3 py-3 align-middle text-center">
                                                                            <div className="flex items-center justify-center h-full">
                                                                                {/* 🌟 NÂNG CẤP: Gỡ bỏ thuộc tính disabled để cho phép chọn thoải mái nhiều ao */}
                                                                                <input type="checkbox" checked={isChecked} onChange={() => toggleAssignment(wId, pId)} className="w-4 h-4 cursor-pointer text-emerald-500 focus:ring-emerald-500 rounded border-slate-300" />
                                                                            </div>
                                                                        </td>
                                                                    )
                                                                })}
                                                                {matrixPonds.length === 0 && !loadingPonds && <td></td>}
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-slate-700">Tiêu đề công việc <span className="text-rose-500">*</span></label>
                                    <input value={form.task_title} onChange={e => setForm({ ...form, task_title: e.target.value })} placeholder="VD: Cho tôm ăn cử sáng..." className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none shadow-sm" />
                                </div>

                                {/* 🌟 NÂNG CẤP: DÒNG ĐỘNG (DYNAMIC ROWS) CHO XUẤT KHO VẬT TƯ */}
                                {isProductRequired && (
                                    <div className="flex flex-col gap-4 bg-sky-50/50 p-4 rounded-xl border border-sky-100">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-sky-800">Vật tư chỉ định xuất kho (Trộn cám/thuốc)</label>
                                            <button type="button" onClick={() => handleAddMaterial(false)} className="text-xs font-bold text-sky-600 bg-sky-100 hover:bg-sky-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1 active:scale-95">
                                                <span className="text-base leading-none">+</span> Thêm vật tư
                                            </button>
                                        </div>

                                        {form.materials.map((mat, idx) => (
                                            <div key={idx} className="grid grid-cols-12 gap-3 items-end bg-white p-3 rounded-xl border border-sky-100 shadow-sm relative">
                                                <div className="col-span-12 sm:col-span-6 flex flex-col gap-1.5">
                                                    <span className="text-xs font-bold text-slate-500">Sản phẩm {idx + 1}</span>
                                                    <select value={mat.product_id} onChange={e => handleMaterialChange(idx, 'product_id', e.target.value, false)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 outline-none shadow-sm cursor-pointer text-sm font-medium">
                                                        <option value="">-- Chọn sản phẩm --</option>
                                                        {getFilteredProducts(form.task_type).map(p => (
                                                            <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-6 sm:col-span-3 flex flex-col gap-1.5">
                                                    <span className="text-xs font-bold text-slate-500">Số lượng/Ao</span>
                                                    <input type="number" step="0.01" value={mat.quantity} onChange={e => handleMaterialChange(idx, 'quantity', e.target.value, false)} placeholder="VD: 5.5" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 outline-none shadow-sm text-sm font-medium" />
                                                </div>
                                                <div className="col-span-4 sm:col-span-2 flex flex-col gap-1.5">
                                                    <span className="text-xs font-bold text-slate-500">Đơn vị</span>
                                                    <input type="text" value={products.find(p => String(p.product_id) === String(mat.product_id))?.unit || '-'} disabled className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-bold outline-none cursor-not-allowed text-sm text-center" />
                                                </div>
                                                <div className="col-span-2 sm:col-span-1 flex justify-end pb-1">
                                                    <button type="button" onClick={() => handleRemoveMaterial(idx, false)} disabled={form.materials.length === 1} className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 disabled:opacity-30 transition-colors">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-bold text-slate-700">Bắt đầu <span className="text-rose-500">*</span></label>
                                        <input
                                            type="datetime-local"
                                            value={form.start_date}
                                            onChange={e => {
                                                const newStart = e.target.value;
                                                setForm({
                                                    ...form,
                                                    start_date: newStart,
                                                    due_date: calculateDueDate(newStart, form.task_type) || form.due_date
                                                });
                                            }}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none shadow-sm cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-bold text-slate-700">
                                            Hạn chót <span className="text-rose-500">*</span>
                                            {form.task_type && <span className="text-emerald-600 text-xs ml-1 font-medium">(Gợi ý: +{getTaskDurationHours(form.task_type)}h)</span>}
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={form.due_date}
                                            onChange={e => setForm({ ...form, due_date: e.target.value })}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none shadow-sm cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-slate-700">Hướng dẫn kỹ thuật <span className="text-rose-500">*</span></label>
                                    <textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Chi tiết các bước..." className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none resize-none shadow-sm" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 shrink-0">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
                                <button type="button" onClick={handleCreateTask} disabled={!form.assignments.length || !form.start_date || !form.due_date} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-md">Kích hoạt ({form.assignments.length})</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CHỈNH SỬA / GÁN VIỆC */}
            {!readOnly && isEditOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setIsEditOpen(false)}>
                    <div className="bg-white max-w-2xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>

                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Cấu hình Kế hoạch & Nhân sự</h2>
                                <p className="text-sm text-emerald-600 font-bold mt-1">Gán Công nhân & Vật tư xuất kho để bắt đầu làm việc</p>
                            </div>
                            <button onClick={() => setIsEditOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
                        </div>

                        <div className="flex flex-col gap-5 overflow-y-auto pr-2 pb-2">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-slate-700">Phân công Nhân sự phụ trách <span className="text-rose-500">*</span></label>
                                <div className="grid grid-cols-2 gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200">
                                    {workers.map(w => {
                                        const wId = Number(w.worker_id || w.user_id);
                                        const isChecked = editForm.assigned_workers.includes(wId);
                                        return (
                                            <label key={wId} className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${isChecked ? 'bg-amber-100 border-amber-500 text-amber-800 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
                                                <input type="checkbox" checked={isChecked} onChange={(e) => {
                                                    if (e.target.checked) setEditForm({ ...editForm, assigned_workers: [...editForm.assigned_workers, wId] });
                                                    else setEditForm({ ...editForm, assigned_workers: editForm.assigned_workers.filter(id => id !== wId) });
                                                }} className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500" />
                                                <span className="text-sm">{w.full_name}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* 🌟 NÂNG CẤP BẢNG SỬA: DÒNG ĐỘNG (DYNAMIC ROWS) */}
                            {isEditProductRequired && (
                                <div className="flex flex-col gap-4 bg-sky-50 p-4 rounded-xl border border-sky-200">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-sky-800">Chỉ định xuất kho</label>
                                        <button type="button" onClick={() => handleAddMaterial(true)} className="text-xs font-bold text-sky-600 bg-sky-100 hover:bg-sky-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1 active:scale-95">
                                            <span className="text-base leading-none">+</span> Thêm vật tư
                                        </button>
                                    </div>

                                    {editForm.materials.map((mat, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-3 items-end bg-white p-3 rounded-xl border border-sky-100 shadow-sm relative">
                                            <div className="col-span-12 sm:col-span-6 flex flex-col gap-1.5">
                                                <span className="text-xs font-bold text-slate-500">Sản phẩm {idx + 1}</span>
                                                <select value={mat.product_id} onChange={e => handleMaterialChange(idx, 'product_id', e.target.value, true)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 outline-none shadow-sm cursor-pointer text-sm font-medium">
                                                    <option value="">-- Chọn sản phẩm kho --</option>
                                                    {getFilteredProducts(editForm.type_id).map(p => (
                                                        <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-6 sm:col-span-3 flex flex-col gap-1.5">
                                                <span className="text-xs font-bold text-slate-500">Số lượng</span>
                                                <input type="number" step="0.01" value={mat.quantity} onChange={e => handleMaterialChange(idx, 'quantity', e.target.value, true)} placeholder="VD: 5.5" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-100 outline-none shadow-sm text-sm font-medium" />
                                            </div>
                                            <div className="col-span-4 sm:col-span-2 flex flex-col gap-1.5">
                                                <span className="text-xs font-bold text-slate-500">Đơn vị</span>
                                                <input type="text" value={products.find(p => String(p.product_id) === String(mat.product_id))?.unit || '-'} disabled className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-bold outline-none cursor-not-allowed text-sm text-center" />
                                            </div>
                                            <div className="col-span-2 sm:col-span-1 flex justify-end pb-1">
                                                <button type="button" onClick={() => handleRemoveMaterial(idx, true)} disabled={editForm.materials.length === 1} className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 disabled:opacity-30 transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Tiêu đề <span className="text-rose-500">*</span></label><input value={editForm.task_title} onChange={e => setEditForm({ ...editForm, task_title: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none" /></div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Bắt đầu <span className="text-rose-500">*</span></label><input type="datetime-local" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none" /></div>
                                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Hạn chót <span className="text-rose-500">*</span></label><input type="datetime-local" value={editForm.due_date} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none" /></div>
                            </div>

                            <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Hướng dẫn <span className="text-rose-500">*</span></label><textarea rows="3" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none resize-none" /></div>
                        </div>

                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 shrink-0">
                            <button onClick={() => setIsEditOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
                            <button onClick={handleUpdateTask} disabled={!editForm.task_title || !editForm.description || !editForm.start_date || !editForm.due_date || editForm.assigned_workers.length === 0} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-md">Lưu Kế hoạch</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskManagementPage;