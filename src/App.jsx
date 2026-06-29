import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, AlertCircle, CheckCircle2, Clock, User, Search, X, MessageSquareWarning,
  ListTodo, Trash2, CheckSquare, Square, GripVertical, LayoutDashboard, ListFilter,
  Users, Briefcase, Calendar, Award, Cake, Mail, Phone, Edit2, Key, Bell, Sparkles, 
  MessageSquare, ChevronRight, Building2, Network, Save, Upload, Database, CalendarDays, 
  ChevronLeft, ArrowUpDown, FolderOpen, LogOut, UserPlus, LogIn, Folder, Tag, Grid, PlusCircle,
  Home, LayoutGrid, FolderKanban, Share2, Building
} from 'lucide-react';

// --- Firebase SDK Imports ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut 
} from 'firebase/auth';

// ============================================================================
// 🚨 본인의 Firebase Config 값
// ============================================================================
let firebaseConfig = {
  apiKey: "AIzaSyC0N5W7klrPoutFKOn1msN4xrUvaEj4FYY",
  authDomain: "teammanage-eb8bd.firebaseapp.com",
  projectId: "teammanage-eb8bd",
  storageBucket: "teammanage-eb8bd.firebasestorage.app",
  messagingSenderId: "337136106838",
  appId: "1:337136106838:web:a5a2d3f837f404f4426af7"
};

if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
}
const app_id_context = typeof __app_id !== 'undefined' ? __app_id : 'local-teamspace-app';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'default');
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const LAST_AUTH_EMAIL_KEY = 'teamspace_last_auth_email';
const GOOGLE_CALENDAR_CONFIG_KEY = 'teamspace_google_calendar_config';
const GOOGLE_CALENDAR_EVENTS_KEY = 'teamspace_google_calendar_events';
// ============================================================================

const getLastAuthEmail = () => {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(LAST_AUTH_EMAIL_KEY) || '';
};

const saveLastAuthEmail = (email) => {
  if (typeof localStorage === 'undefined') return;
  const trimmedEmail = email?.trim();
  if (trimmedEmail) localStorage.setItem(LAST_AUTH_EMAIL_KEY, trimmedEmail);
};

const STATUSES = {
  'todo': { label: '진행 예정', color: 'bg-slate-100', borderColor: 'border-slate-200', icon: Clock },
  'in-progress': { label: '진행 중', color: 'bg-blue-50', borderColor: 'border-blue-200', icon: Clock },
  'done': { label: '완료됨', color: 'bg-green-50', borderColor: 'border-green-200', icon: CheckCircle2 }
};

const PROJECT_COLORS = {
  'slate': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: '슬레이트' },
  'indigo': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', label: '인디고' },
  'emerald': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: '에메랄드' },
  'rose': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', label: '로즈' },
  'amber': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: '앰버' },
};

const RANKS = ['사원', '대리', '과장', '차장', '부장', '임원'];
const OWNER_ONLY_MENUS = ['members', 'org', 'workspaces'];
const ASSIGNEE_COLORS = [
  { bar: 'bg-indigo-500', chip: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { bar: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700 border-rose-200' },
  { bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700 border-amber-200' },
  { bar: 'bg-sky-500', chip: 'bg-sky-100 text-sky-700 border-sky-200' },
  { bar: 'bg-violet-500', chip: 'bg-violet-100 text-violet-700 border-violet-200' },
  { bar: 'bg-teal-500', chip: 'bg-teal-100 text-teal-700 border-teal-200' },
  { bar: 'bg-fuchsia-500', chip: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  { bar: 'bg-cyan-500', chip: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { bar: 'bg-lime-600', chip: 'bg-lime-100 text-lime-700 border-lime-200' },
];

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const isEmailLike = (email) => normalizeEmail(email).includes('@');

const getWorkspaceEmails = (workspace) => {
  const emails = [workspace?.ownerEmail, ...(workspace?.members || [])]
    .map(normalizeEmail)
    .filter(isEmailLike)
    .filter(Boolean);
  return [...new Set(emails)];
};

const getUserAccessKeys = (currentUser) => {
  if (!currentUser) return [];
  const email = normalizeEmail(currentUser.email);
  return [
    currentUser.uid ? `uid:${currentUser.uid}` : '',
    isEmailLike(email) ? `email:${email}` : ''
  ].filter(Boolean);
};

const getWorkspaceAccessKeys = (workspace) => {
  const keys = [
    workspace?.ownerId ? `uid:${workspace.ownerId}` : '',
    ...getWorkspaceEmails(workspace).map(email => `email:${email}`)
  ]
    .filter(Boolean);
  return [...new Set(keys)];
};

const normalizeWorkspaceData = (workspace) => {
  if (!workspace) return workspace;
  return {
    ...workspace,
    ownerEmail: isEmailLike(workspace.ownerEmail) ? normalizeEmail(workspace.ownerEmail) : (workspace.ownerEmail || ''),
    members: getWorkspaceEmails(workspace),
    accessKeys: getWorkspaceAccessKeys(workspace)
  };
};

const canAccessWorkspace = (workspace, currentUser) => {
  if (!currentUser) return false;
  if (workspace.ownerId === currentUser.uid) return true;
  const userAccessKeys = getUserAccessKeys(currentUser);
  if (userAccessKeys.some(key => workspace.accessKeys?.includes(key))) return true;
  const userEmail = normalizeEmail(currentUser.email);
  return Boolean(userEmail && getWorkspaceEmails(workspace).includes(userEmail));
};

const getPersonalWorkspaceName = (currentUser) => {
  const emailName = normalizeEmail(currentUser?.email).split('@')[0];
  const displayName = currentUser?.displayName?.trim();
  return `${displayName || emailName || '나'}의 워크스페이스`;
};

const createOwnedWorkspaceData = (currentUser, workspaceId, overrides = {}) => {
  const ownerEmail = normalizeEmail(currentUser?.email);
  return normalizeWorkspaceData({
    id: workspaceId,
    name: getPersonalWorkspaceName(currentUser),
    description: '개인 업무 관리를 위한 워크스페이스입니다.',
    ownerId: currentUser.uid,
    ownerEmail,
    members: ownerEmail ? [ownerEmail] : [],
    ...overrides
  });
};

const mergeById = (...lists) => {
  const merged = new Map();
  lists.flat().filter(Boolean).forEach(item => merged.set(item.id, item));
  return [...merged.values()];
};

const getWorkspaceAccessDocId = (workspaceId, email) => `${workspaceId}_${encodeURIComponent(normalizeEmail(email))}`;

const createWorkspaceAccessData = (workspace, email) => ({
  id: getWorkspaceAccessDocId(workspace.id, email),
  workspaceId: workspace.id,
  workspaceName: workspace.name || '',
  email: normalizeEmail(email),
  ownerId: workspace.ownerId || '',
  createdAt: new Date().toISOString().split('T')[0]
});

const hashString = (value) => {
  const text = value || '미지정';
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getAssigneeColor = (assignee) => ASSIGNEE_COLORS[hashString(assignee) % ASSIGNEE_COLORS.length];

// --- 헬퍼 함수 ---
const calculateAge = (birthday) => {
  if (!birthday) return null;
  const today = new Date();
  const birthDate = new Date(birthday);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const toDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getCompletedYears = (fromDate, toDateValue = getTodayDate()) => {
  const from = toDate(fromDate);
  if (!from) return 0;
  let years = toDateValue.getFullYear() - from.getFullYear();
  const monthDiff = toDateValue.getMonth() - from.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && toDateValue.getDate() < from.getDate())) years -= 1;
  return Math.max(0, years);
};

const calculateStatutoryAnnualLeave = (joinDate) => {
  const join = toDate(joinDate);
  if (!join) return 0;
  const today = getTodayDate();
  const years = getCompletedYears(joinDate, today);
  if (years < 1) {
    let months = (today.getFullYear() - join.getFullYear()) * 12 + today.getMonth() - join.getMonth();
    if (today.getDate() < join.getDate()) months -= 1;
    return Math.max(0, Math.min(11, months));
  }
  return Math.min(25, 15 + Math.floor((years - 1) / 2));
};

const getAnnualLeaveBase = (member) => {
  const parsed = Number(member?.annualLeaveBase);
  return Number.isFinite(parsed) ? parsed : calculateStatutoryAnnualLeave(member?.joinDate);
};

const eachDateInRange = (startDate, endDate) => {
  const dates = [];
  const current = toDate(startDate);
  const end = toDate(endDate || startDate);
  if (!current || !end) return dates;
  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const countBusinessDays = (startDate, endDate) => eachDateInRange(startDate, endDate)
  .filter(date => date.getDay() !== 0 && date.getDay() !== 6)
  .length;

const normalizeCalendarEvents = (events = []) => events.map((event, index) => {
  const summary = event.summary || '';
  const start = event.start?.date || event.start?.dateTime || '';
  const rawEnd = event.end?.date || event.end?.dateTime || start;
  const startDate = start.slice(0, 10);
  let endDate = rawEnd.slice(0, 10);
  if (event.end?.date && endDate) {
    const exclusiveEnd = new Date(endDate);
    exclusiveEnd.setDate(exclusiveEnd.getDate() - 1);
    endDate = exclusiveEnd.toISOString().slice(0, 10);
  }
  return {
    id: event.id || `calendar_${index}_${startDate}`,
    summary,
    description: event.description || '',
    startDate,
    endDate: endDate || startDate,
  };
}).filter(event => event.summary && event.startDate);

const getLeaveDaysFromEvent = (event) => {
  const text = `${event.summary || ''} ${event.description || ''}`;
  if (!/(연차|휴가|반차|오전반차|오후반차)/i.test(text)) return 0;
  if (/(반차|오전반차|오후반차)/i.test(text)) return 0.5;
  return countBusinessDays(event.startDate, event.endDate);
};

const getUsedAnnualLeaveDays = (member, events) => {
  const memberName = member?.name || '';
  if (!memberName) return 0;
  return events.reduce((total, event) => {
    const text = `${event.summary || ''} ${event.description || ''}`;
    if (!text.includes(memberName)) return total;
    return total + getLeaveDaysFromEvent(event);
  }, 0);
};

const formatLeaveDays = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0일';
  return `${Number.isInteger(number) ? number : number.toFixed(1)}일`;
};

const readStoredJson = (key, fallback) => {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || '') || fallback;
  } catch {
    return fallback;
  }
};

const extractGoogleCalendarApiKey = (data) => {
  if (!data || typeof data !== 'object') return '';
  return data.apiKey || data.key || data.API_KEY || data.googleApiKey || data.calendarApiKey || data.installed?.api_key || data.web?.api_key || '';
};

const calculateNextPromotionDate = (rank, joinDate, promotionDate) => {
  if (!joinDate || rank === '부장' || rank === '임원') return null;
  const yearsRequired = { '사원': 3, '대리': 3, '과장': 4, '차장': 4 };
  const reqYears = yearsRequired[rank];
  if (!reqYears) return null;

  const join = new Date(joinDate);
  const firstAprilAfterJoin = new Date(join.getFullYear(), 3, 1);
  const baseDate = promotionDate
    ? new Date(promotionDate)
    : join <= firstAprilAfterJoin
      ? firstAprilAfterJoin
      : new Date(join.getFullYear() + 1, 3, 1);
  let targetYear = baseDate.getFullYear() + reqYears;
  let targetDate = new Date(targetYear, 3, 1);

  const today = new Date();
  if (targetDate < today) {
    let nextYear = today.getFullYear();
    if (today.getMonth() > 3 || (today.getMonth() === 3 && today.getDate() >= 1)) {
      nextYear++;
    }
    targetDate = new Date(nextYear, 3, 1);
  }
  
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateLabel = (dateStr) => {
  if (!dateStr) return '계산 불가';
  const [year, month, day] = dateStr.split('-');
  return `${year}.${month}.${day}`;
};

const calculateDDay = (targetDate, status) => {
  if (!targetDate || status === 'done') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { label: `지연됨 (D+${Math.abs(diffDays)})`, color: 'bg-red-100 text-red-700', isUrgent: true };
  if (diffDays === 0) return { label: '오늘 마감', color: 'bg-orange-100 text-orange-700', isUrgent: true };
  if (diffDays <= 3) return { label: `D-${diffDays}`, color: 'bg-amber-100 text-amber-700', isUrgent: true };
  return { label: `D-${diffDays}`, color: 'bg-slate-100 text-slate-600', isUrgent: false };
};

export default function App() {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authForm, setAuthForm] = useState(() => ({ email: getLastAuthEmail(), password: '' }));

  const [currentMenu, setCurrentMenu] = useState('tasks');
  
  // 클라우드 전체 데이터
  const [allTasks, setAllTasks] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [allWorkspaces, setAllWorkspaces] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [workspaceStats, setWorkspaceStats] = useState({});
  
  // 현재 선택된 워크스페이스
  const [activeWorkspaceIdState, setActiveWorkspaceIdState] = useState(null);
  
  const setActiveWorkspaceId = (id) => {
    setActiveWorkspaceIdState(id);
    if (id) {
      setCurrentMenu('tasks'); 
      setSelectedProjectFilter('all');
      setSearchQuery('');
      setActiveTab('in-progress');
    }
  };
  const activeWorkspaceId = activeWorkspaceIdState;

  // 내가 접근 권한이 있는 워크스페이스만 필터링
  const myWorkspaces = useMemo(() => {
    if (!user) return [];
    return allWorkspaces.filter(ws => canAccessWorkspace(ws, user));
  }, [allWorkspaces, user]);
  const currentWorkspace = useMemo(() => allWorkspaces.find(w => w.id === activeWorkspaceId) || null, [allWorkspaces, activeWorkspaceId]);
  const isCurrentWorkspaceOwner = Boolean(user && currentWorkspace?.ownerId === user.uid);

  useEffect(() => {
    if (!user || myWorkspaces.length === 0 || !activeWorkspaceId) return;
    if (!myWorkspaces.some(ws => ws.id === activeWorkspaceId)) {
      setActiveWorkspaceId(null);
    }
  }, [activeWorkspaceId, myWorkspaces, user]);

  useEffect(() => {
    if (activeWorkspaceId && OWNER_ONLY_MENUS.includes(currentMenu) && !isCurrentWorkspaceOwner) {
      setCurrentMenu('tasks');
    }
  }, [activeWorkspaceId, currentMenu, isCurrentWorkspaceOwner]);

  // 현재 워크스페이스 기준으로 필터링된 데이터
  const tasks = useMemo(() => allTasks.filter(t => t.workspaceId === activeWorkspaceId), [allTasks, activeWorkspaceId]);
  const members = useMemo(() => allMembers.filter(m => m.workspaceId === activeWorkspaceId), [allMembers, activeWorkspaceId]);
  const departments = useMemo(() => allDepartments.filter(d => d.workspaceId === activeWorkspaceId), [allDepartments, activeWorkspaceId]);
  const projects = useMemo(() => allProjects.filter(p => p.workspaceId === activeWorkspaceId), [allProjects, activeWorkspaceId]);

  // UI 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('board');
  const [activeTab, setActiveTab] = useState('in-progress');
  const [taskSortOption, setTaskSortOption] = useState('default');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');
  
  // 캘린더 상태
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarFilterAssignee, setCalendarFilterAssignee] = useState('all');
  const [calendarFilterProject, setCalendarFilterProject] = useState('all');
  const [googleCalendarConfig, setGoogleCalendarConfig] = useState(() => readStoredJson(GOOGLE_CALENDAR_CONFIG_KEY, { apiKey: '', calendarId: '', year: String(new Date().getFullYear()) }));
  const [annualLeaveEvents, setAnnualLeaveEvents] = useState(() => readStoredJson(GOOGLE_CALENDAR_EVENTS_KEY, []));
  const [isCalendarSyncing, setIsCalendarSyncing] = useState(false);

  // 모달 상태
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isWsModalOpen, setIsWsModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [customAlert, setCustomAlert] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isConfirm: false, isWide: false });

  // 폼 상태
  const [editingTask, setEditingTask] = useState(null);
  const [taskFormData, setTaskFormData] = useState({
    title: '', projectId: '', assignee: '', description: '', status: 'todo', hasIssue: false, issueNote: '', subtasks: [], startDate: '', targetDate: ''
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [draggedSubtaskIdx, setDraggedSubtaskIdx] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const [editingMember, setEditingMember] = useState(null);
  const [memberFormData, setMemberFormData] = useState({
    name: '', rank: '사원', departmentId: '', role: '', joinDate: '', promotionDate: '', birthday: '', email: '', phone: '', annualLeaveBase: ''
  });
  
  const [orgFormData, setOrgFormData] = useState({ name: '', parentId: null });
  const [projectFormData, setProjectFormData] = useState({ id: '', name: '', color: 'indigo' });
  
  const [editingWs, setEditingWs] = useState(null);
  const [wsFormData, setWsFormData] = useState({ name: '', description: '' });
  
  // 워크스페이스 초대 관련
  const [inviteWs, setInviteWs] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');

  // AI & 기타
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const fileInputRef = useRef(null);
  const googleCalendarKeyInputRef = useRef(null);

  // --- 커스텀 알림 ---
  const showAlert = (title, message, isWide = false) => setCustomAlert({ isOpen: true, title, message, isConfirm: false, isWide });
  const showConfirm = (title, message, onConfirm) => setCustomAlert({ isOpen: true, title, message, onConfirm, isConfirm: true, isWide: false });
  const closeAlert = () => setCustomAlert({ isOpen: false, title: '', message: '', onConfirm: null, isConfirm: false, isWide: false });

  // ==========================================================================
  // 🔥 Firebase 연동 로직
  // ==========================================================================
  const getPath = (colName) => ['artifacts', app_id_context, 'public', 'data', colName];
  const docsFromSnapshot = (snap, colName = null) => snap.docs.map(d => {
    const data = { id: d.id, ...d.data() };
    return colName === 'workspaces' ? normalizeWorkspaceData(data) : data;
  });
  const isActiveWorkspaceAccessible = () => Boolean(user && activeWorkspaceId && myWorkspaces.some(ws => ws.id === activeWorkspaceId));

  const replaceById = (items, item) => {
    const exists = items.some(existing => existing.id === item.id);
    return exists ? items.map(existing => existing.id === item.id ? item : existing) : [...items, item];
  };

  const removeById = (items, id) => items.filter(item => item.id !== id);

  const syncLocalCollection = (colName, id, data, action = 'upsert') => {
    const update = action === 'delete'
      ? (items) => removeById(items, id)
      : (items) => replaceById(items, { ...data, id });

    if (colName === 'tasks') setAllTasks(update);
    if (colName === 'members') setAllMembers(update);
    if (colName === 'departments') setAllDepartments(update);
    if (colName === 'projects') setAllProjects(update);
    if (colName === 'workspaces') {
      const normalizedWorkspace = data ? normalizeWorkspaceData({ ...data, id }) : null;
      setAllWorkspaces(prev => action === 'delete'
        ? removeById(prev, id)
        : replaceById(prev, normalizedWorkspace)
      );
    }
  };

  const loadWorkspaceData = useCallback(async () => {
    if (!isActiveWorkspaceAccessible()) {
      setAllTasks([]);
      setAllMembers([]);
      setAllDepartments([]);
      setAllProjects([]);
      return;
    }

    const scopedQuery = (colName) => query(collection(db, ...getPath(colName)), where('workspaceId', '==', activeWorkspaceId));
    try {
      const collectionsToLoad = new Set(['tasks', 'projects']);
      if (currentMenu === 'calendar') collectionsToLoad.add('members');
      if (currentMenu === 'members' || currentMenu === 'org') {
        collectionsToLoad.add('members');
        collectionsToLoad.add('departments');
      }

      const loads = await Promise.all([...collectionsToLoad].map(async (colName) => [colName, docsFromSnapshot(await getDocs(scopedQuery(colName)))]));
      loads.forEach(([colName, docs]) => {
        if (colName === 'tasks') setAllTasks(docs);
        if (colName === 'members') setAllMembers(docs);
        if (colName === 'departments') setAllDepartments(docs);
        if (colName === 'projects') setAllProjects(docs);
      });
    } catch (err) {
      console.error(err);
      showAlert('데이터 조회 실패', '워크스페이스 데이터를 불러오지 못했습니다.');
    }
  }, [user, activeWorkspaceId, myWorkspaces, currentMenu]);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser?.email) saveLastAuthEmail(currentUser.email);
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setAllWorkspaces([]);
      return;
    }

    let cancelled = false;
    const loadWorkspaces = async () => {
      try {
        const wsRef = collection(db, ...getPath('workspaces'));
        const userEmail = normalizeEmail(user.email);
        const userAccessKeys = getUserAccessKeys(user);
        const workspaceResults = [];
        const queryErrors = [];

        const runWorkspaceQuery = async (workspaceQuery) => {
          try {
            workspaceResults.push(...docsFromSnapshot(await getDocs(workspaceQuery), 'workspaces'));
          } catch (error) {
            queryErrors.push(error);
          }
        };

        await runWorkspaceQuery(query(wsRef, where('ownerId', '==', user.uid)));
        if (userEmail) {
          try {
            const accessSnap = await getDocs(query(collection(db, ...getPath('workspaceAccess')), where('email', '==', userEmail)));
            const accessWorkspaceIds = [...new Set(accessSnap.docs.map(d => d.data().workspaceId).filter(Boolean))];
            const accessWorkspaces = await Promise.all(accessWorkspaceIds.map(async (workspaceId) => {
              const workspaceDoc = await getDoc(doc(db, ...getPath('workspaces'), workspaceId));
              return workspaceDoc.exists() ? normalizeWorkspaceData({ id: workspaceDoc.id, ...workspaceDoc.data() }) : null;
            }));
            workspaceResults.push(...accessWorkspaces.filter(Boolean));
          } catch (error) {
            queryErrors.push(error);
          }
        }
        for (const accessKey of userAccessKeys) {
          await runWorkspaceQuery(query(wsRef, where('accessKeys', 'array-contains', accessKey)));
        }
        if (userEmail) {
          await runWorkspaceQuery(query(wsRef, where('members', 'array-contains', userEmail)));
        }

        if (workspaceResults.length === 0 && queryErrors.length > 0) {
          throw queryErrors[0];
        }

        const mergedWorkspaces = mergeById(workspaceResults);

        if (mergedWorkspaces.length === 0 && user.uid) {
          const personalWsId = `personal_${user.uid}`;
          const personalWorkspace = createOwnedWorkspaceData(user, personalWsId);
          await setDoc(doc(db, ...getPath('workspaces'), personalWsId), personalWorkspace);
          mergedWorkspaces.push(personalWorkspace);
        }

        if (!cancelled) {
          setAllWorkspaces(mergedWorkspaces);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) showAlert('워크스페이스 조회 실패', '접근 가능한 워크스페이스를 불러오지 못했습니다.');
      }
    };

    loadWorkspaces();
    return () => { cancelled = true; };
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const syncWorkspaceAccessDocs = async (workspace) => {
    const normalizedWorkspace = normalizeWorkspaceData(workspace);
    await Promise.all(getWorkspaceEmails(normalizedWorkspace).map(email => {
      const accessData = createWorkspaceAccessData(normalizedWorkspace, email);
      return setDoc(doc(db, ...getPath('workspaceAccess'), accessData.id), accessData);
    }));
  };

  useEffect(() => {
    if (!user || myWorkspaces.length === 0) return;
    const ownedWorkspaces = myWorkspaces.filter(ws => ws.ownerId === user.uid);
    ownedWorkspaces.forEach(ws => {
      syncWorkspaceAccessDocs(ws).catch(console.error);
    });
  }, [user, myWorkspaces]);

  useEffect(() => {
    if (!user || myWorkspaces.length === 0) {
      setWorkspaceStats({});
      return;
    }

    let cancelled = false;
    const loadWorkspaceStats = async () => {
      const nextStats = {};
      await Promise.all(myWorkspaces.map(async (ws) => {
        try {
          const [tasksSnap, membersSnap] = await Promise.all([
            getDocs(query(collection(db, ...getPath('tasks')), where('workspaceId', '==', ws.id))),
            getDocs(query(collection(db, ...getPath('members')), where('workspaceId', '==', ws.id)))
          ]);
          nextStats[ws.id] = {
            tasks: tasksSnap.size,
            members: membersSnap.size
          };
        } catch (error) {
          console.error(error);
          nextStats[ws.id] = {
            tasks: allTasks.filter(t => t.workspaceId === ws.id).length,
            members: allMembers.filter(m => m.workspaceId === ws.id).length
          };
        }
      }));

      if (!cancelled) setWorkspaceStats(nextStats);
    };

    loadWorkspaceStats();
    return () => { cancelled = true; };
  }, [user, myWorkspaces, allTasks, allMembers]);

  const saveToFirebase = async (colName, id, data) => {
    if (!user) return;
    const dataToSave = colName === 'workspaces' ? normalizeWorkspaceData({ ...data, id }) : data;
    try {
      await setDoc(doc(db, ...getPath(colName), id), dataToSave);
      if (colName === 'workspaces') {
        await syncWorkspaceAccessDocs(dataToSave);
      }
      syncLocalCollection(colName, id, dataToSave);
    } catch (e) { console.error(e); showAlert("저장 실패", "클라우드 저장에 실패했습니다."); }
  };

  const deleteFromFirebase = async (colName, id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, ...getPath(colName), id));
      syncLocalCollection(colName, id, null, 'delete');
    } catch (e) { console.error(e); showAlert("삭제 실패", "클라우드 데이터 삭제에 실패했습니다."); }
  };

  // --- Auth Functions ---
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const email = authForm.email.trim();
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, authForm.password);
      } else {
        await createUserWithEmailAndPassword(auth, email, authForm.password);
      }
      saveLastAuthEmail(email);
      localStorage.removeItem('guest_mode');
      setAuthForm({ email, password: '' });
    } catch (error) {
      let msg = "오류가 발생했습니다.";
      if (error.code === 'auth/invalid-credential') msg = "이메일 또는 비밀번호가 올바르지 않습니다.";
      if (error.code === 'auth/email-already-in-use') msg = "이미 가입된 이메일입니다.";
      if (error.code === 'auth/weak-password') msg = "비밀번호는 6자리 이상이어야 합니다.";
      showAlert('인증 실패', msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user?.email) {
        saveLastAuthEmail(result.user.email);
        localStorage.removeItem('guest_mode');
        setAuthForm({ email: result.user.email, password: '' });
      }
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        showAlert('구글 로그인 실패', error.message);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGuestAuth = async () => {
    setIsAuthLoading(true);
    try {
      await signInAnonymously(auth);
      setAuthForm(prev => ({ email: getLastAuthEmail() || prev.email, password: '' }));
    } catch (error) {
      showAlert('게스트 로그인 실패', error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    showConfirm('로그아웃', '정말 로그아웃 하시겠습니까?', async () => {
      const lastEmail = user?.email || authForm.email || getLastAuthEmail();
      saveLastAuthEmail(lastEmail);
      localStorage.removeItem('guest_mode');
      setActiveWorkspaceId(null);
      setAuthMode('login');
      setAuthForm({ email: lastEmail, password: '' });
      await signOut(auth);
    });
  };

  // --- AI API ---
  const callGeminiAPI = async (prompt) => {
    if (!apiKey) {
      showAlert('API 키 필요', '우측 상단의 열쇠(🔑) 아이콘을 눌러 Gemini API 키를 먼저 등록해주세요.');
      return null;
    }
    
    setIsAiLoading(true);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    let retries = 0;
    const maxRetries = 5;
    const delays = [1000, 2000, 4000, 8000, 16000];

    while (retries <= maxRetries) {
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        setIsAiLoading(false);
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (error) {
        if (retries === maxRetries) {
          setIsAiLoading(false);
          showAlert('AI 호출 오류', `요청에 실패했습니다: ${error.message}`);
          return null;
        }
        await new Promise(res => setTimeout(res, delays[retries]));
        retries++;
      }
    }
  };

  const generateMorningBriefing = async () => {
    const activeTasks = tasks.filter(t => t.status !== 'done');
    if (activeTasks.length === 0) return showAlert('안내', '현재 워크스페이스에 진행 중인 업무가 없어 브리핑을 생성할 수 없습니다.');

    const prompt = `당신은 우리 팀의 활기찬 프로젝트 매니저입니다. 팀원들을 위해 오늘의 업무 브리핑을 작성해주세요.
    [현재 진행 중이거나 예정된 주요 업무 리스트]
    ${activeTasks.map(t => `- [담당: ${t.assignee}] ${t.title} (기한: ${t.targetDate || '미정'}) ${t.hasIssue ? '🚨(이슈 있음)' : ''}`).join('\n')}
    이 내용을 바탕으로 팀원들을 격려하고, 마감이 임박한 업무나 이슈가 있는 업무를 짚어주는 3~4문단의 짧고 활기찬 브리핑(적절한 이모지 포함)을 작성해주세요.`;
    
    const result = await callGeminiAPI(prompt);
    if (result) showAlert('✨ 팀 일일 브리핑', result, true);
  };

  const polishDescriptionAI = async () => {
    if (!taskFormData.description?.trim()) return showAlert('정보 부족', '다듬을 내용을 먼저 "상세 설명"에 조금이라도 입력해주세요.');
    const prompt = `다음은 업무의 초안 메모입니다. 이 내용을 바탕으로 더 전문적이고 명확한 형태(예: 배경, 목표, 주요 작업 등으로 나누어진 개조식)의 업무 설명으로 다듬어주세요:\n\n"${taskFormData.description}"`;
    const result = await callGeminiAPI(prompt);
    if (result) setTaskFormData(prev => ({ ...prev, description: result }));
  };

  const generateSubtasksAI = async () => {
    if (!taskFormData.title) return showAlert('정보 부족', '업무명을 먼저 입력해주세요.');
    const prompt = `당신은 효율적인 프로젝트 매니저입니다. 다음 업무를 수행하기 위한 구체적이고 실행 가능한 하위 작업(Subtask)을 3~5개 추천해주세요. 업무명: "${taskFormData.title}", 설명: "${taskFormData.description || '없음'}". 답변은 순수하게 하위 작업 목록만 "-" 기호로 시작해서 작성해주세요.`;
    const result = await callGeminiAPI(prompt);
    if (result) {
      const newTasks = result.split('\n').filter(line => line.trim().startsWith('-')).map(line => ({
        id: Math.random().toString(), title: line.replace(/^- /, '').trim(), completed: false
      }));
      setTaskFormData(prev => ({ ...prev, subtasks: [...(prev.subtasks || []), ...newTasks] }));
    }
  };

  const askAiTroubleshoot = async (task) => {
    const prompt = `당신은 시니어 개발자 및 팀 리더입니다. 팀원이 다음 업무에서 이슈를 겪고 있습니다. 업무: "${task.title}", 이슈내용: "${task.issueNote}". 이 이슈를 해결하기 위한 조언, 원인 파악 방법, 또는 체크리스트를 3~4줄로 요약해서 친절하게 제안해주세요.`;
    const result = await callGeminiAPI(prompt);
    if (result) showAlert('💡 AI 조언', result);
  };

  const generateGreetingAI = async (member, type) => {
    const typeText = type === 'birthday' ? '생일' : '진급';
    const prompt = `당신은 따뜻하고 센스있는 팀 리더입니다. 팀원인 ${member.name} ${member.rank}(직무: ${member.role})의 ${typeText}을 축하하는 사내 메신저용 메시지를 작성해주세요. 너무 길지 않게 이모지를 섞어서 친근하게 작성해주세요.`;
    const result = await callGeminiAPI(prompt);
    if (result) showAlert(`🎉 ${typeText} 축하 메시지 초안`, result, true);
  };

  // --- 데이터 백업 및 복원 ---
  const handleExportData = () => {
    const dataToSave = { tasks: allTasks, members: allMembers, departments: allDepartments, workspaces: allWorkspaces, projects: allProjects };
    const jsonStr = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TeamSpace_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsDataModalOpen(false);
    showAlert('백업 완료', '전체 데이터가 성공적으로 다운로드되었습니다.');
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (parsedData.tasks && parsedData.members && parsedData.departments) {
          showConfirm('데이터 업로드(복원)', '파일의 데이터를 클라우드 데이터베이스에 모두 업로드하시겠습니까?\n이 데이터는 즉시 덮어씌워지며 모두에게 공유됩니다.', async () => {
            setIsDataModalOpen(false);
            setIsAiLoading(true); 
            for (const ws of parsedData.workspaces || []) await saveToFirebase('workspaces', ws.id, ws);
            for (const p of parsedData.projects || []) await saveToFirebase('projects', p.id, p);
            for (const t of parsedData.tasks) await saveToFirebase('tasks', t.id, t);
            for (const m of parsedData.members) await saveToFirebase('members', m.id, m);
            for (const d of parsedData.departments) await saveToFirebase('departments', d.id, d);
            setIsAiLoading(false);
            showAlert('클라우드 업로드 완료', '모든 데이터가 성공적으로 클라우드에 복원되었습니다!');
          });
        } else {
          showAlert('복원 실패', '올바른 백업 파일 형식이 아닙니다.');
        }
      } catch (error) {
        showAlert('복원 실패', '파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const persistGoogleCalendarConfig = (nextConfig) => {
    setGoogleCalendarConfig(nextConfig);
    localStorage.setItem(GOOGLE_CALENDAR_CONFIG_KEY, JSON.stringify(nextConfig));
  };

  const handleGoogleCalendarKeyUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.private_key) {
          showAlert('키 파일 확인 필요', '서비스 계정 JSON이 감지되었습니다. Spark 플랜에서는 Google Cloud API Key JSON을 업로드해주세요.');
          return;
        }
        const extractedApiKey = extractGoogleCalendarApiKey(parsed);
        if (!extractedApiKey) {
          showAlert('API Key 없음', 'JSON 파일에서 apiKey, key, API_KEY 값을 찾지 못했습니다.');
          return;
        }
        persistGoogleCalendarConfig({ ...googleCalendarConfig, apiKey: extractedApiKey });
        showAlert('API Key 등록 완료', 'Google Calendar API Key를 로컬에 저장했습니다. 캘린더 ID를 입력한 뒤 동기화하세요.');
      } catch (error) {
        showAlert('키 파일 오류', 'Google Calendar API Key JSON 파일 형식을 확인해주세요.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const syncGoogleCalendarAnnualLeave = async () => {
    const apiKeyValue = googleCalendarConfig.apiKey?.trim();
    const calendarId = googleCalendarConfig.calendarId?.trim();
    const year = Number(googleCalendarConfig.year) || new Date().getFullYear();
    if (!apiKeyValue) return showAlert('API Key 필요', 'Google Calendar API Key JSON을 먼저 업로드해주세요.');
    if (!calendarId) return showAlert('캘린더 ID 필요', '연차 일정이 등록된 Google Calendar ID를 입력해주세요.');

    setIsCalendarSyncing(true);
    try {
      const timeMin = `${year}-01-01T00:00:00Z`;
      const timeMax = `${year + 1}-01-01T00:00:00Z`;
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set('key', apiKeyValue);
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '2500');

      const response = await fetch(url.toString());
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || 'Google Calendar API 호출에 실패했습니다.');
      }
      const normalizedEvents = normalizeCalendarEvents(data.items || []);
      setAnnualLeaveEvents(normalizedEvents);
      localStorage.setItem(GOOGLE_CALENDAR_EVENTS_KEY, JSON.stringify(normalizedEvents));
      localStorage.setItem(GOOGLE_CALENDAR_CONFIG_KEY, JSON.stringify(googleCalendarConfig));
      showAlert('캘린더 동기화 완료', `${year}년 캘린더 이벤트 ${normalizedEvents.length}건을 불러왔습니다.`);
    } catch (error) {
      showAlert('캘린더 동기화 실패', `${error.message}\nAPI Key 제한 설정, Calendar API 활성화, 캘린더 공개 설정, 캘린더 ID를 확인해주세요.`, true);
    } finally {
      setIsCalendarSyncing(false);
    }
  };

  // --- 워크스페이스 로직 ---
  const handleOpenWsModal = (ws = null) => {
    const isEvent = ws && ws.nativeEvent;
    const validWs = isEvent ? null : ws;

    if (validWs) {
      setEditingWs(validWs);
      setWsFormData({ name: validWs.name, description: validWs.description || '' });
    } else {
      setEditingWs(null);
      setWsFormData({ name: '', description: '' });
    }
    setIsWsModalOpen(true);
  };

  const handleWsSubmit = async (e) => {
    e.preventDefault();
    if (!wsFormData.name.trim()) return;
    const wsId = editingWs ? editingWs.id : `ws_${Date.now()}`;
    const ownerEmail = normalizeEmail(user.email);
    const wsData = editingWs 
      ? { ...editingWs, name: wsFormData.name, description: wsFormData.description }
      : { 
          id: wsId, 
          name: wsFormData.name, 
          description: wsFormData.description,
          ownerId: user.uid, 
          ownerEmail,
          members: ownerEmail ? [ownerEmail] : [] 
        };
        
    setIsWsModalOpen(false);
    await saveToFirebase('workspaces', wsId, wsData);
    if (!editingWs && !activeWorkspaceId) {
      setActiveWorkspaceId(wsId);
    }
  };

  const deleteWorkspace = (id) => {
    const targetWs = allWorkspaces.find(w => w.id === id);
    if (targetWs.ownerId !== user.uid) return showAlert('권한 없음', '워크스페이스 소유자만 삭제할 수 있습니다.');

    showConfirm('워크스페이스 삭제', '정말 이 워크스페이스를 삭제하시겠습니까?\n해당 워크스페이스에 속한 모든 업무와 팀원 데이터가 함께 삭제됩니다.', async () => {
      allTasks.filter(t => t.workspaceId === id).forEach(t => deleteFromFirebase('tasks', t.id));
      allProjects.filter(p => p.workspaceId === id).forEach(p => deleteFromFirebase('projects', p.id));
      allMembers.filter(m => m.workspaceId === id).forEach(m => deleteFromFirebase('members', m.id));
      allDepartments.filter(d => d.workspaceId === id).forEach(d => deleteFromFirebase('departments', d.id));
      
      await deleteFromFirebase('workspaces', id);
      if (activeWorkspaceId === id) setActiveWorkspaceId(null);
    });
  };

  // --- 워크스페이스 초대 로직 ---
  const handleOpenInviteModal = (ws) => {
    if (ws.ownerId !== user.uid) return showAlert('권한 없음', '워크스페이스 소유자만 멤버를 초대할 수 있습니다.');
    setInviteWs(ws);
    setInviteEmail('');
    setIsInviteModalOpen(true);
  };

  const handleInviteSubmit = async (e, workspace = inviteWs) => {
    e.preventDefault();
    if (!workspace) return;
    const email = normalizeEmail(inviteEmail);
    if (!email) return;
    if (!email.includes('@')) return showAlert('입력 확인', '올바른 이메일 주소를 입력해주세요.');
    if (getWorkspaceEmails(workspace).includes(email)) return showAlert('중복', '이미 초대된 이메일입니다.');
    
    const updatedMembers = [...getWorkspaceEmails(workspace), email];
    const updatedWorkspace = normalizeWorkspaceData({ ...workspace, members: updatedMembers });
    await saveToFirebase('workspaces', workspace.id, updatedWorkspace);
    
    setInviteWs(updatedWorkspace);
    setInviteEmail('');
    showAlert('초대 완료', `${email} 사용자를 성공적으로 초대했습니다.`);
  };

  const handleRemoveMember = async (emailToRemove, workspace = inviteWs) => {
    if (!workspace) return;
    const targetEmail = normalizeEmail(emailToRemove);
    if (targetEmail === normalizeEmail(workspace.ownerEmail)) return showAlert('불가', '소유자는 워크스페이스에서 제외할 수 없습니다.');
    
    const updatedMembers = getWorkspaceEmails(workspace).filter(email => email !== targetEmail);
    const updatedWorkspace = normalizeWorkspaceData({ ...workspace, members: updatedMembers });
    await saveToFirebase('workspaces', workspace.id, updatedWorkspace);
    await deleteDoc(doc(db, ...getPath('workspaceAccess'), getWorkspaceAccessDocId(workspace.id, targetEmail)));
    setInviteWs(updatedWorkspace);
  };

  // --- 프로젝트 로직 ---
  const handleOpenProjectModal = (project = null) => {
    const isEvent = project && project.nativeEvent;
    const validProject = isEvent ? null : project;

    if (validProject) setProjectFormData({ ...validProject });
    else setProjectFormData({ id: '', name: '', color: 'indigo' });
    setIsProjectModalOpen(true);
  };
  
  const handleProjectSubmit = async (e) => {
    e.preventDefault(); 
    if (!projectFormData.name.trim()) return;
    const projId = projectFormData.id || `proj_${Date.now()}`;
    const pData = { ...projectFormData, id: projId, workspaceId: activeWorkspaceId };
    setIsProjectModalOpen(false);
    await saveToFirebase('projects', projId, pData);
  };
  
  const deleteProject = (projectId) => {
    if (tasks.some(t => t.projectId === projectId)) return showAlert('삭제 불가', '이 폴더에 속한 업무가 존재합니다.');
    showConfirm('프로젝트 삭제', '이 프로젝트 폴더를 삭제하시겠습니까?', async () => {
      await deleteFromFirebase('projects', projectId);
      if (selectedProjectFilter === projectId) setSelectedProjectFilter('all');
      setIsProjectModalOpen(false);
    });
  };

  // --- 업무 로직 ---
  const handleOpenTaskModal = (task = null) => {
    const isEvent = task && (task.nativeEvent || task.target);
    const validTask = isEvent ? null : task;

    if (validTask && validTask.id) {
      setEditingTask(validTask);
      setTaskFormData({ ...validTask, subtasks: validTask.subtasks || [] });
    } else {
      setEditingTask(null);
      setTaskFormData({ 
        title: '', 
        projectId: selectedProjectFilter !== 'all' ? selectedProjectFilter : '', 
        assignee: '', 
        description: '', 
        status: activeTab || 'todo', 
        hasIssue: false, 
        issueNote: '', 
        subtasks: [], 
        startDate: '', 
        targetDate: '' 
      });
    }
    setNewSubtaskTitle('');
    setIsTaskModalOpen(true);
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskFormData.title?.trim()) return showAlert('필수 입력 누락', '업무명을 입력해주세요.');
    if (taskFormData.startDate && taskFormData.targetDate && taskFormData.startDate > taskFormData.targetDate) return showAlert('날짜 오류', '시작일자가 완료 목표일자보다 늦을 수 없습니다.');

    const dateStr = new Date().toISOString().split('T')[0];
    const taskId = editingTask ? editingTask.id : Date.now().toString();
    const taskData = { ...taskFormData, title: taskFormData.title.trim(), id: taskId, updatedAt: dateStr, workspaceId: activeWorkspaceId };
    
    setIsTaskModalOpen(false);
    await saveToFirebase('tasks', taskId, taskData);
    setCurrentMenu('tasks');
    setActiveTab(taskData.status || 'todo');
    setSearchQuery('');
    setSelectedProjectFilter(taskData.projectId || 'all');
  };

  const deleteTask = (id) => {
    showConfirm('업무 삭제', '정말 이 업무를 삭제하시겠습니까?\n클라우드에서도 영구 삭제됩니다.', async () => {
      setIsTaskModalOpen(false);
      await deleteFromFirebase('tasks', id);
    });
  };

  const handleTaskStatusChange = async (taskId, newStatus) => {
    const task = allTasks.find(t => t.id === taskId);
    if(task) {
      const updatedTask = { ...task, status: newStatus, updatedAt: new Date().toISOString().split('T')[0] };
      await saveToFirebase('tasks', taskId, updatedTask);
    }
  };

  const toggleTaskIssue = async (taskId) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task.hasIssue) {
      handleOpenTaskModal({ ...task, hasIssue: true });
    } else {
      const updatedTask = { ...task, hasIssue: false, issueNote: '' };
      await saveToFirebase('tasks', taskId, updatedTask);
    }
  };

  // --- 드래그 앤 드롭 ---
  const handleDragStart = (e, index) => { setDraggedSubtaskIdx(index); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (draggedSubtaskIdx === null || draggedSubtaskIdx === index) return;
    const newSubtasks = [...taskFormData.subtasks];
    const draggedItem = newSubtasks[draggedSubtaskIdx];
    newSubtasks.splice(draggedSubtaskIdx, 1);
    newSubtasks.splice(index, 0, draggedItem);
    setDraggedSubtaskIdx(index);
    setTaskFormData({ ...taskFormData, subtasks: newSubtasks });
  };
  const handleDragEnd = () => setDraggedSubtaskIdx(null);

  const handleCardDragStart = (e, taskId) => { e.dataTransfer.setData('taskId', taskId); setDraggedTaskId(taskId); };
  const handleCardDragEnd = () => { setDraggedTaskId(null); setDragOverColumn(null); };
  const handleColumnDragOver = (e, statusKey) => { e.preventDefault(); if (dragOverColumn !== statusKey) setDragOverColumn(statusKey); };
  const handleColumnDragLeave = () => setDragOverColumn(null);
  const handleColumnDrop = async (e, statusKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) await handleTaskStatusChange(taskId, statusKey);
  };

  // --- 팀원/조직 로직 ---
  const handleOpenMemberModal = (member = null) => {
    if (!isCurrentWorkspaceOwner) return showAlert('권한 없음', '워크스페이스 소유자만 팀원을 관리할 수 있습니다.');
    const isEvent = member && member.nativeEvent;
    const validMember = isEvent ? null : member;

    if (validMember) {
      setEditingMember(validMember);
      setMemberFormData({ annualLeaveBase: '', ...validMember });
    } else {
      setEditingMember(null);
      setMemberFormData({ name: '', rank: '사원', departmentId: departments.length > 0 ? departments[0].id : '', role: '', joinDate: '', promotionDate: '', birthday: '', email: '', phone: '', annualLeaveBase: '' });
    }
    setIsMemberModalOpen(true);
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    if (!isCurrentWorkspaceOwner) return showAlert('권한 없음', '워크스페이스 소유자만 팀원을 관리할 수 있습니다.');
    const memberId = editingMember ? editingMember.id : `m_${Date.now()}`;
    const annualLeaveBase = memberFormData.annualLeaveBase === '' ? '' : Number(memberFormData.annualLeaveBase);
    const memberData = { ...memberFormData, annualLeaveBase, id: memberId, workspaceId: activeWorkspaceId };
    setIsMemberModalOpen(false);
    await saveToFirebase('members', memberId, memberData);
  };

  const deleteMember = (id) => {
    if (!isCurrentWorkspaceOwner) return showAlert('권한 없음', '워크스페이스 소유자만 팀원을 관리할 수 있습니다.');
    showConfirm('팀원 삭제', '정말 이 팀원 정보를 삭제하시겠습니까?', async () => {
      setIsMemberModalOpen(false);
      await deleteFromFirebase('members', id);
    });
  };

  const handleOpenOrgModal = (parentId = null) => {
    if (!isCurrentWorkspaceOwner) return showAlert('권한 없음', '워크스페이스 소유자만 조직을 관리할 수 있습니다.');
    const isEvent = parentId && parentId.nativeEvent;
    setOrgFormData({ name: '', parentId: isEvent ? null : parentId });
    setIsOrgModalOpen(true);
  };

  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    if (!isCurrentWorkspaceOwner) return showAlert('권한 없음', '워크스페이스 소유자만 조직을 관리할 수 있습니다.');
    if (!orgFormData.name.trim()) return;
    const deptId = `dept_${Date.now()}`;
    const deptData = { id: deptId, name: orgFormData.name, parentId: orgFormData.parentId, workspaceId: activeWorkspaceId };
    setIsOrgModalOpen(false);
    await saveToFirebase('departments', deptId, deptData);
  };

  const deleteDepartment = (deptId) => {
    if (!isCurrentWorkspaceOwner) return showAlert('권한 없음', '워크스페이스 소유자만 조직을 관리할 수 있습니다.');
    if (departments.some(d => d.parentId === deptId)) return showAlert('삭제 불가', '하위 부서가 존재합니다. 하위 부서를 먼저 삭제한 후 다시 시도해주세요.');
    showConfirm('부서 삭제', '정말 이 부서를 삭제하시겠습니까?\n이 부서에 소속된 팀원들의 소속 정보가 사라질 수 있습니다.', async () => {
      await deleteFromFirebase('departments', deptId);
      members.filter(m => m.departmentId === deptId).forEach(async (m) => {
        await saveToFirebase('members', m.id, { ...m, departmentId: '' });
      });
    });
  };

  // --- 필터링, 정렬 및 리마인더 ---
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => 
      (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (t.assignee || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (selectedProjectFilter !== 'all') {
      result = result.filter(t => t.projectId === selectedProjectFilter);
    }

    result.sort((a, b) => {
      if (taskSortOption === 'issue') {
        if (a.hasIssue && !b.hasIssue) return -1;
        if (!a.hasIssue && b.hasIssue) return 1;
        const dateA = a.targetDate || '9999-12-31';
        const dateB = b.targetDate || '9999-12-31';
        return dateA.localeCompare(dateB);
      }
      if (taskSortOption === 'targetDate') return (a.targetDate || '9999-12-31').localeCompare(b.targetDate || '9999-12-31');
      if (taskSortOption === 'startDate') return (a.startDate || '9999-12-31').localeCompare(b.startDate || '9999-12-31');
      return 0; 
    });
    return result;
  }, [tasks, searchQuery, taskSortOption, selectedProjectFilter]);

  const filteredMembers = useMemo(() => members.filter(m => (m.name || '').toLowerCase().includes(memberSearchQuery.toLowerCase()) || (m.rank || '').includes(memberSearchQuery) || (m.role || '').toLowerCase().includes(memberSearchQuery.toLowerCase())), [members, memberSearchQuery]);
  const urgentTasks = useMemo(() => tasks.filter(t => {
    const dDay = calculateDDay(t.targetDate, t.status);
    return dDay && dDay.isUrgent;
  }), [tasks]);

  // --- 캘린더 렌더링 ---
  const changeMonth = (offset) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const daysArray = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const d = String(i).padStart(2, '0');
      const m = String(month + 1).padStart(2, '0');
      daysArray.push(`${year}-${m}-${d}`);
    }

    const calendarTasks = tasks.filter(t => 
      t.startDate && t.targetDate && 
      (calendarFilterAssignee === 'all' || t.assignee === calendarFilterAssignee) &&
      (calendarFilterProject === 'all' || t.projectId === calendarFilterProject)
    );

    const sortedTasks = [...calendarTasks].sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      return b.targetDate.localeCompare(a.targetDate);
    });

    const taskSlots = {};
    const occupiedSlots = []; 
    sortedTasks.forEach(task => {
      let assignedSlot = -1;
      for (let i = 0; i < occupiedSlots.length; i++) {
        if (!occupiedSlots[i] || occupiedSlots[i] < task.startDate) {
          assignedSlot = i;
          break;
        }
      }
      if (assignedSlot === -1) assignedSlot = occupiedSlots.length;
      occupiedSlots[assignedSlot] = task.targetDate;
      taskSlots[task.id] = assignedSlot;
    });

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
            <div key={day} className={`text-center py-3 text-sm font-bold ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-slate-600'}`}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(120px,_auto)]">
          {daysArray.map((dateStr, idx) => {
            if (!dateStr) return <div key={`empty-${idx}`} className="border-b border-r border-slate-200 bg-slate-50/30"></div>;

            const activeTasks = sortedTasks.filter(t => dateStr >= t.startDate && dateStr <= t.targetDate);
            const maxSlotInDay = activeTasks.length > 0 ? Math.max(...activeTasks.map(t => taskSlots[t.id])) : -1;
            
            const daySlots = [];
            for (let i = 0; i <= maxSlotInDay; i++) {
              daySlots.push(activeTasks.find(t => taskSlots[t.id] === i) || null);
            }

            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const dayNum = parseInt(dateStr.split('-')[2]);
            const dayOfWeek = new Date(dateStr).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <div key={dateStr} className={`border-b border-r border-slate-200 flex flex-col ${isToday ? 'bg-indigo-50/20' : ''}`}>
                <div className="p-1.5 pb-0">
                  <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>{dayNum}</div>
                </div>
                
                <div className="flex-1 flex flex-col gap-1 mt-1 pb-2">
                  {daySlots.map((t, index) => {
                    if (!t) return <div key={`empty-slot-${index}`} className="h-5"></div>;

                    const isStart = t.startDate === dateStr;
                    const isEnd = t.targetDate === dateStr;
                    
                    let barClass = '';
                    if (isStart && isEnd) barClass = 'mx-1.5 rounded-md'; 
                    else if (isStart) barClass = 'ml-1.5 -mr-[1px] rounded-l-md relative z-10'; 
                    else if (isEnd) barClass = 'mr-1.5 -ml-[1px] rounded-r-md relative z-10'; 
                    else barClass = '-mx-[1px] rounded-none relative z-10'; 

                    const assigneeColor = getAssigneeColor(t.assignee).bar;
                    const showTitle = isStart || dayOfWeek === 0 || dayNum === 1;

                    return (
                      <div key={t.id} onClick={() => handleOpenTaskModal(t)} className={`h-5 text-[10px] text-white px-2 flex items-center cursor-pointer hover:brightness-110 ${t.status === 'done' ? 'opacity-70' : ''} ${assigneeColor} ${barClass}`} title={`${t.title} (${t.assignee || '미지정'})`}>
                        {showTitle ? <span className="font-semibold truncate leading-none">{t.title}</span> : <span className="invisible">.</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOrganizationTree = (parentId = null, level = 0) => {
    const children = departments.filter(d => d.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div className={`${level > 0 ? 'ml-8 mt-3 pl-4 border-l-2 border-indigo-100' : ''} space-y-3`}>
        {children.map(dept => {
          const deptMembers = members.filter(m => m.departmentId === dept.id);
          return (
          <div key={dept.id} className="relative">
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${level === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}><Network className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold text-slate-800">{dept.name}</span>
                    <span className="ml-3 text-xs font-semibold text-slate-400">소속 팀원: {deptMembers.length}명</span>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenOrgModal(dept.id)} className="text-xs bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 하위 부서 추가</button>
                  <button onClick={() => deleteDepartment(dept.id)} className="text-xs bg-red-50 text-red-500 font-bold hover:bg-red-100 px-2 py-1.5 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>
              {deptMembers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-50 pl-11 flex flex-wrap gap-2">
                  {deptMembers.map(m => (
                    <div key={m.id} className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs px-2.5 py-1.5 rounded-lg border border-slate-100 transition-colors cursor-default" title={`${m.role}`}>
                      <div className="w-4 h-4 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold" style={{fontSize: '9px'}}>{(m.name||'유').substring(0, 1)}</div>
                      <span className="font-bold">{m.name}</span><span className="text-slate-400">{m.rank}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {renderOrganizationTree(dept.id, level + 1)}
          </div>
        )})}
      </div>
    );
  };

  const renderTaskCard = (task) => {
    const subtasks = task.subtasks || [];
    const completedCount = subtasks.filter(s => s.completed).length;
    const progress = subtasks.length === 0 ? 0 : Math.round((completedCount / subtasks.length) * 100);
    const dDay = calculateDDay(task.targetDate, task.status);
    const isDragging = draggedTaskId === task.id;
    const project = projects.find(p => p.id === task.projectId) || { name: '미지정', color: 'slate' };
    const pColor = PROJECT_COLORS[project?.color] || PROJECT_COLORS['slate'];

    return (
      <div 
        key={task.id} draggable onDragStart={(e) => handleCardDragStart(e, task.id)} onDragEnd={handleCardDragEnd}
        className={`group relative bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col h-full cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40 scale-95 ring-2 ring-indigo-500' : ''}`}
      >
        <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => handleOpenTaskModal(task)}
            className="p-1.5 rounded-lg bg-white/95 border border-slate-200 text-slate-400 shadow-sm hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
            title="업무 수정"
            aria-label="업무 수정"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => deleteTask(task.id)}
            className="p-1.5 rounded-lg bg-white/95 border border-slate-200 text-slate-400 shadow-sm hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
            title="업무 삭제"
            aria-label="업무 삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-between items-start mb-2.5">
          <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${pColor.bg} ${pColor.text} ${pColor.border}`}>
            <Tag className="w-2.5 h-2.5" /> {project.name}
          </div>
          <div className="flex gap-1.5 items-center pr-16">
            {dDay && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${dDay.color}`}>{dDay.label}</span>}
            {task.hasIssue && <span className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse flex items-center"><MessageSquareWarning className="w-2.5 h-2.5 mr-0.5" /> 이슈</span>}
          </div>
        </div>
        
        <h3 className="font-bold text-slate-800 mb-2 line-clamp-2">{task.title}</h3>
        
        <div className="flex justify-between items-center mb-3">
          <span className="inline-flex items-center gap-1 text-slate-500 text-[11px] font-medium"><User className="w-3 h-3" /> {task.assignee || '미지정'}</span>
          {(task.startDate || task.targetDate) && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Calendar className="w-3 h-3" /><span>{(task.startDate||'').slice(5)} ~ {(task.targetDate||'').slice(5)}</span>
            </div>
          )}
        </div>
        
        {subtasks.length > 0 && (
          <div className="mt-auto mb-3 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1.5 font-bold"><span>하위 업무 달성률</span><span>{progress}%</span></div>
            <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden"><div className={`h-1 rounded-full transition-all duration-300 ${progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div></div>
          </div>
        )}

        {task.hasIssue && task.issueNote && (
          <div className="mt-auto mb-3 bg-red-50 border border-red-100 rounded-lg p-2 text-xs text-red-700">
            <div className="flex gap-2 mb-2"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><p className="line-clamp-2">{task.issueNote}</p></div>
            <button onClick={() => askAiTroubleshoot(task)} className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-white px-2 py-1 rounded border border-red-200 w-fit text-[10px] ml-auto">
              <Sparkles className="w-3 h-3" /> AI 조언 구하기
            </button>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-auto">
          <select value={task.status} onChange={(e) => handleTaskStatusChange(task.id, e.target.value)} className="text-[11px] bg-white border border-slate-200 rounded py-1 px-1.5 text-slate-600 font-bold outline-none cursor-pointer hover:border-indigo-300">
            <option value="todo">진행 예정</option><option value="in-progress">진행 중</option><option value="done">완료됨</option>
          </select>
          <button onClick={() => toggleTaskIssue(task.id)} className={`p-1 rounded border transition-colors ${task.hasIssue ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-400 hover:text-red-500'}`}>
            <AlertCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // --- 화면 렌더링 컨트롤러 ---
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // --- 1. 첫 화면: 로그인 / 회원가입 ---
  if (!user || (user.isAnonymous === true && !localStorage.getItem('guest_mode'))) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 p-8 text-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <CheckCircle2 className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-2">TeamSpace</h1>
            <p className="text-indigo-100 text-sm font-medium">업무 관리를 위한 협업 대시보드</p>
          </div>
          
          <div className="p-8">
            <div className="flex gap-4 mb-6 border-b border-slate-100 pb-2">
              <button onClick={() => setAuthMode('login')} className={`flex-1 pb-2 font-bold text-sm transition-colors ${authMode === 'login' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>로그인</button>
              <button onClick={() => setAuthMode('signup')} className={`flex-1 pb-2 font-bold text-sm transition-colors ${authMode === 'signup' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>이메일로 가입</button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4" autoComplete="off">
              {/* 브라우저 강제 자동완성 방지용 가짜(Dummy) 인풋 */}
              <div style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute' }}>
                <input type="email" name="fake_email" tabIndex="-1" aria-hidden="true" />
                <input type="password" name="fake_password" tabIndex="-1" aria-hidden="true" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">이메일</label>
                <input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="name@company.com" autoComplete="off" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">비밀번호</label>
                <input type="password" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="비밀번호를 입력하세요" autoComplete="new-password"/>
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md hover:shadow-lg mt-2 flex items-center justify-center gap-2">
                {authMode === 'login' ? <><LogIn className="w-5 h-5"/> 로그인</> : <><UserPlus className="w-5 h-5"/> 회원가입</>}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-3 bg-white text-slate-400 font-medium">또는</span></div>
            </div>

            <div className="space-y-3">
              <button onClick={handleGoogleAuth} className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-3 shadow-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google 계정으로 계속하기
              </button>
              
              <button onClick={() => { localStorage.setItem('guest_mode', 'true'); handleGuestAuth(); }} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <User className="w-4 h-4"/> 게스트(체험) 모드로 둘러보기
              </button>
            </div>
          </div>
        </div>
        
        {customAlert.isOpen && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center p-6 transform transition-all">
              <h3 className="font-bold text-lg text-slate-800 mb-4 pb-2 border-b border-slate-100">{customAlert.title}</h3>
              <p className="text-slate-600 text-sm mb-6 whitespace-pre-wrap leading-relaxed">{customAlert.message}</p>
              <button onClick={closeAlert} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 w-full">확인</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 2. 워크스페이스 선택 랜딩 페이지 (허브) ---
  if (!activeWorkspaceId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans">
        
        {/* 상단 프로필 바 */}
        <div className="w-full max-w-5xl flex justify-end mb-10 mt-4">
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs">
                {user.email ? user.email.substring(0,1).toUpperCase() : 'G'}
              </div>
              <span className="text-sm font-bold text-slate-700">{user.email || '게스트 사용자'}</span>
            </div>
            <div className="w-px h-4 bg-slate-200"></div>
            <button onClick={handleLogout} className="text-sm font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
              <LogOut className="w-4 h-4"/> 로그아웃
            </button>
          </div>
        </div>

        <div className="text-center mb-10 mt-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-5">
            <Grid className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">TeamSpace Hub</h1>
          <p className="text-slate-500 font-medium">참여할 워크스페이스를 선택하거나 새롭게 만들어보세요.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">
          {myWorkspaces.map(ws => {
            const stats = workspaceStats[ws.id];
            const wsTasksCount = stats?.tasks ?? allTasks.filter(t => t.workspaceId === ws.id).length;
            const wsMembersCount = stats?.members ?? allMembers.filter(m => m.workspaceId === ws.id).length;
            const isOwner = ws.ownerId === user.uid;
            
            return (
              <div key={ws.id} onClick={() => setActiveWorkspaceId(ws.id)} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-500 hover:shadow-lg cursor-pointer transition-all flex flex-col items-center text-center relative group">
                <div className="absolute top-4 left-4">
                  {isOwner ? 
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded">소유자</span> : 
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded">멤버</span>
                  }
                </div>

                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isOwner && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenWsModal(ws); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                    </>
                  )}
                </div>
                
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform mt-2">
                  <FolderOpen className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-1">{ws.name}</h3>
                <p className="text-xs text-slate-400 font-medium mb-4">업무 {wsTasksCount}개 · 등록 팀원 {wsMembersCount}명</p>
                
                {ws.members && ws.members.length > 0 && (
                  <div className="flex -space-x-2 mt-auto">
                    {ws.members.slice(0, 3).map((email, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-600" title={email}>
                        {email.substring(0,1).toUpperCase()}
                      </div>
                    ))}
                    {ws.members.length > 3 && <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">+{ws.members.length - 3}</div>}
                  </div>
                )}
              </div>
            );
          })}
          
          {user.email && (
            <div onClick={() => handleOpenWsModal()} className="bg-slate-50/50 p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all flex flex-col items-center justify-center text-center text-slate-500 hover:text-indigo-600 min-h-[220px] group">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform border border-slate-100">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm">새 워크스페이스 만들기</span>
            </div>
          )}
        </div>

        <div className="text-center flex justify-center gap-4 mt-12">
          <button onClick={() => setIsDataModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-full text-slate-600 font-bold hover:bg-slate-50 shadow-sm transition-colors">
            <Database className="w-4 h-4" /> 전체 데이터 백업 / 복원
          </button>
        </div>

        {/* 워크스페이스 생성/수정 모달 */}
        {isWsModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
              <div className="p-5 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-indigo-600"/> {editingWs ? '워크스페이스 수정' : '새 조직 공간 만들기'}</h3>
                <button onClick={() => setIsWsModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
              </div>
              <form onSubmit={handleWsSubmit}>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">조직(워크스페이스) 이름 <span className="text-red-500">*</span></label>
                    <input type="text" autoFocus required value={wsFormData.name} onChange={e => setWsFormData({...wsFormData, name: e.target.value})} placeholder="예: 알파 디자인팀" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">설명</label>
                    <textarea value={wsFormData.description} onChange={e => setWsFormData({...wsFormData, description: e.target.value})} placeholder="공간에 대한 설명을 적어주세요." className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" rows="3"/>
                  </div>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-between rounded-b-2xl">
                  {editingWs ? <button type="button" onClick={() => deleteWorkspace(editingWs.id)} className="text-red-500 text-sm font-bold px-2 hover:bg-red-50 rounded">조직 삭제</button> : <div></div>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIsWsModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold bg-white">취소</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">저장</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* 공통 컴포넌트: 백업/복원 및 알림 모달 */}
        {isDataModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-left">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-5 border-b flex justify-between items-center"><h3 className="font-bold text-lg flex items-center gap-2"><Database className="w-5 h-5 text-indigo-600"/> 시스템 전체 데이터 백업/복원</h3><button onClick={() => setIsDataModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button></div>
              <div className="p-6 space-y-6">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><Save className="w-4 h-4"/> 내 PC로 데이터 내보내기</h4>
                  <p className="text-sm text-indigo-700/80 mb-4">생성된 모든 조직 공간(워크스페이스)의 데이터를 JSON으로 다운로드합니다.</p>
                  <button onClick={handleExportData} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-sm">백업 파일 다운로드</button>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Upload className="w-4 h-4"/> 다른 PC에서 데이터 불러오기</h4>
                  <p className="text-sm text-slate-500 mb-4">다운로드한 JSON 파일을 선택하여 전체 시스템 데이터를 덮어씁니다.</p>
                  <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" />
                  <button onClick={() => fileInputRef.current.click()} className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-lg text-sm">백업 파일 선택하기</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {customAlert.isOpen && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100] text-left">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${customAlert.isWide ? 'max-w-2xl text-left' : 'max-w-sm text-center'} p-6 transform transition-all`}>
              <h3 className="font-bold text-lg text-slate-800 mb-4 pb-2 border-b border-slate-100">{customAlert.title}</h3>
              <p className="text-slate-600 text-sm mb-6 whitespace-pre-wrap leading-relaxed">{customAlert.message}</p>
              <div className={`flex gap-3 ${customAlert.isWide ? 'justify-end' : 'justify-center'}`}>
                <button onClick={() => { if (customAlert.onConfirm) customAlert.onConfirm(); closeAlert(); }} className={`px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 ${customAlert.isConfirm ? 'flex-1' : customAlert.isWide ? '' : 'w-full'}`}>{customAlert.isConfirm ? '확인' : '닫기'}</button>
                {customAlert.isConfirm && <button onClick={closeAlert} className="flex-1 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200">취소</button>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: 메인 대시보드 (선택된 워크스페이스 내부)
  // ==========================================
  const currentWorkspaceName = currentWorkspace?.name || '알 수 없음';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* GNB */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sticky top-0 z-10 shadow-sm flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveWorkspaceId(null)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition-colors flex items-center gap-1.5" title="워크스페이스 선택">
              <Home className="w-5 h-5" />
              <span className="hidden lg:inline text-xs font-bold">워크스페이스</span>
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="font-black text-lg text-slate-800 flex items-center gap-2 px-2">
              <span className="text-indigo-600 hidden sm:inline">TeamSpace</span>
              <span className="text-slate-300 text-sm font-normal hidden sm:inline">|</span>
              <span className="text-sm font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md max-w-[150px] truncate">{currentWorkspaceName}</span>
            </div>
          </div>
          
          <div className="hidden md:flex gap-1 border-l border-slate-200 pl-4">
            <button onClick={() => setCurrentMenu('tasks')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${currentMenu === 'tasks' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}><LayoutDashboard className="w-4 h-4" /> 업무 보드</button>
            <button onClick={() => setCurrentMenu('projects')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${currentMenu === 'projects' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}><FolderKanban className="w-4 h-4" /> 프로젝트 관리</button>
            <button onClick={() => setCurrentMenu('calendar')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${currentMenu === 'calendar' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}><CalendarDays className="w-4 h-4" /> 일정 캘린더</button>
            {isCurrentWorkspaceOwner && (
              <>
                <button onClick={() => setCurrentMenu('members')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${currentMenu === 'members' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}><Users className="w-4 h-4" /> 팀원 관리</button>
                <button onClick={() => setCurrentMenu('org')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${currentMenu === 'org' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}><Building className="w-4 h-4" /> 조직 관리</button>
                <button onClick={() => setCurrentMenu('workspaces')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${currentMenu === 'workspaces' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}><Key className="w-4 h-4" /> 권한 설정</button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <select value={currentMenu} onChange={e => setCurrentMenu(e.target.value)} className="bg-slate-100 border border-slate-200 text-sm font-bold rounded-lg px-2 py-1 outline-none">
              <option value="tasks">업무 보드</option>
              <option value="projects">프로젝트</option>
              <option value="calendar">캘린더</option>
              {isCurrentWorkspaceOwner && <option value="members">팀원</option>}
              {isCurrentWorkspaceOwner && <option value="org">조직</option>}
              {isCurrentWorkspaceOwner && <option value="workspaces">권한 설정</option>}
            </select>
          </div>
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
              <Bell className="w-5 h-5" />
              {urgentTasks.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
              {urgentTasks.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-slate-50 font-bold text-sm">긴급 리마인더 (현재 조직)</div>
                <div className="max-h-64 overflow-y-auto">
                  {urgentTasks.length === 0 ? <div className="p-4 text-center text-sm text-slate-500">긴급한 업무가 없습니다.</div> :
                    urgentTasks.map(t => (
                      <div key={t.id} className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => { handleOpenTaskModal(t); setShowNotifications(false); }}>
                        <div className="flex justify-between items-start"><p className="text-sm font-bold text-slate-800 line-clamp-1">{t.title}</p><span className="text-xs text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">{calculateDDay(t.targetDate, t.status)?.label || ''}</span></div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setIsKeyModalOpen(true)} className={`p-2 rounded-full hidden sm:block ${apiKey ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-100 hover:text-slate-600'}`} title="API 키 설정"><Key className="w-5 h-5" /></button>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors" title="로그아웃">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="flex-1 p-4 sm:p-6 max-w-[1600px] mx-auto w-full">
        {/* 권한 설정 탭 */}
        {currentMenu === 'workspaces' && isCurrentWorkspaceOwner && (
          <div className="max-w-4xl mx-auto">
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="text-indigo-600 w-7 h-7" /> 권한 및 초대 설정</h1>
                <p className="text-sm text-slate-500 mt-2">현재 워크스페이스에 접속할 수 있는 사람의 이메일을 등록하세요.</p>
              </div>
            </header>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">초대된 계정 (이메일)</h3>
                <p className="text-sm text-slate-500 mt-1">여기에 등록된 이메일 계정으로 로그인한 사람만 이 워크스페이스를 볼 수 있습니다.</p>
              </div>
              <div className="p-6">
                {(() => {
                  const currentWs = allWorkspaces.find(w => w.id === activeWorkspaceId);
                  if (!currentWs) return null;
                  const isOwner = currentWs.ownerId === user.uid;
                  const allowedEmails = getWorkspaceEmails(currentWs);
                  const ownerEmail = normalizeEmail(currentWs.ownerEmail);

                  return (
                    <>
                      <div className="flex gap-2 mb-6">
                        <input type="email" placeholder="초대할 팀원의 이메일 주소 입력" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={!isOwner} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50" />
                        <button onClick={(e) => handleInviteSubmit(e, currentWs)} disabled={!isOwner} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                          <Mail className="w-4 h-4" /> 초대하기
                        </button>
                      </div>
                      {!isOwner && <p className="text-sm text-red-500 mb-4 font-bold flex items-center gap-1"><AlertCircle className="w-4 h-4"/> 소유자만 팀원을 초대할 수 있습니다.</p>}
                      <div className="space-y-2">
                        {allowedEmails.map((email, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs uppercase">{email.substring(0,1)}</div>
                              <div>
                                <span className="font-bold text-slate-800 block text-sm">{email}</span>
                                {email === ownerEmail && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">소유자</span>}
                              </div>
                            </div>
                            {isOwner && email !== ownerEmail && (
                              <button onClick={() => handleRemoveMember(email, currentWs)} className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg">제외</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* 프로젝트 관리 탭 */}
        {currentMenu === 'projects' && (
          <div>
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2"><FolderKanban className="text-indigo-600 w-7 h-7" /> 프로젝트 관리</h1>
                <p className="text-sm text-slate-500 mt-2">이 워크스페이스의 업무를 담을 프로젝트 폴더를 관리하세요.</p>
              </div>
              <button onClick={() => handleOpenProjectModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
                <Plus className="w-4 h-4" /> 새 프로젝트
              </button>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {projects.map(p => {
                const pTasks = tasks.filter(t => t.projectId === p.id);
                const pColor = PROJECT_COLORS[p.color] || PROJECT_COLORS['indigo'];
                return (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
                    <div className={`h-2.5 w-full ${pColor.bg.replace('100', '500')}`}></div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-6"><h3 className="font-bold text-lg text-slate-800 line-clamp-1">{p.name}</h3></div>
                      <div className="space-y-3 mt-auto">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 flex items-center gap-1.5"><ListTodo className="w-4 h-4"/> 등록 업무</span>
                          <span className="font-black text-lg text-slate-700">{pTasks.length}건</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 p-3 flex gap-2 bg-slate-50/50">
                      <button onClick={() => handleOpenProjectModal(p)} className="flex-1 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors">수정</button>
                      <button onClick={() => deleteProject(p.id)} className="flex-1 py-2 text-sm font-bold text-red-500 bg-white border border-red-100 hover:bg-red-50 rounded-xl transition-colors">삭제</button>
                    </div>
                  </div>
                );
              })}
              {projects.length === 0 && <div className="col-span-full py-10 text-center text-slate-500">생성된 프로젝트가 없습니다. 새 프로젝트를 만들어주세요.</div>}
            </div>
          </div>
        )}

        {/* 업무 대시보드 탭 */}
        {currentMenu === 'tasks' && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <aside className="w-64 shrink-0 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm sticky top-24 hidden lg:block">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-indigo-600"/> 내 프로젝트</h3>
              </div>
              <ul className="space-y-1">
                <li>
                  <button onClick={() => setSelectedProjectFilter('all')} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold flex justify-between items-center transition-colors ${selectedProjectFilter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <span>모든 업무 보기</span><span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedProjectFilter === 'all' ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>{tasks.length}</span>
                  </button>
                </li>
                {projects.map(p => {
                  const safeColor = PROJECT_COLORS[p.color] || PROJECT_COLORS['indigo'];
                  return (
                    <li key={p.id}>
                      <button onClick={() => setSelectedProjectFilter(p.id)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold flex justify-between items-center transition-colors ${selectedProjectFilter === p.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-2.5 h-2.5 rounded-full ${safeColor.bg.replace('100','400')}`}></div>
                          <span className="truncate">{p.name}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${selectedProjectFilter === p.id ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>{tasks.filter(t => t.projectId === p.id).length}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </aside>

            <div className="flex-1 min-w-0">
              <header className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div><h1 className="text-2xl font-bold flex items-center gap-2">{selectedProjectFilter === 'all' ? '모든 프로젝트 업무' : (projects.find(p=>p.id === selectedProjectFilter)?.name || '프로젝트')}</h1></div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="업무명 또는 담당자..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                  <button onClick={() => handleOpenTaskModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> 새 업무</button>
                </div>
              </header>
              
              <div className="lg:hidden mb-4 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                <Folder className="w-5 h-5 text-indigo-500 shrink-0 ml-1" />
                <select value={selectedProjectFilter} onChange={(e) => setSelectedProjectFilter(e.target.value)} className="w-full bg-transparent border-none text-sm font-bold text-slate-700 outline-none focus:ring-0 cursor-pointer">
                  <option value="all">모든 프로젝트 폴더 보기 ({tasks.length}건)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({tasks.filter(t=>t.projectId === p.id).length}건)</option>)}
                </select>
              </div>

              <div className="flex flex-wrap gap-4 mb-6 justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex gap-1">
                  <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${viewMode === 'board' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>한눈에 보기</button>
                  <button onClick={() => setViewMode('tabs')} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${viewMode === 'tabs' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>단계별 보기</button>
                </div>
                <div className="flex items-center gap-2 px-2">
                  <ListFilter className="w-4 h-4 text-slate-400" />
                  <select value={taskSortOption} onChange={(e) => setTaskSortOption(e.target.value)} className="border-none bg-transparent text-sm font-bold text-indigo-600 outline-none cursor-pointer">
                    <option value="default">등록순</option><option value="issue">이슈 우선</option><option value="targetDate">마감일순</option><option value="startDate">시작일순</option>
                  </select>
                </div>
              </div>
            
              {viewMode === 'board' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(STATUSES).map(([key, info]) => {
                    const columnTasks = filteredTasks.filter(t => t.status === key);
                    const StatusIcon = info.icon;
                    return (
                      <div key={key} onDragOver={(e) => handleColumnDragOver(e, key)} onDragLeave={handleColumnDragLeave} onDrop={(e) => handleColumnDrop(e, key)}
                        className={`rounded-2xl border p-4 min-h-[60vh] transition-colors duration-200 ${info.borderColor} ${info.color} ${dragOverColumn === key ? 'ring-2 ring-indigo-400 bg-indigo-50/50' : ''}`}>
                        <h2 className="font-bold mb-4 flex items-center gap-2"><StatusIcon className="w-4 h-4"/>{info.label}<span className="bg-white text-slate-600 text-xs py-0.5 px-2 rounded-full font-bold border border-slate-200 ml-auto">{columnTasks.length}</span></h2>
                        <div className="space-y-4">
                          {columnTasks.map(renderTaskCard)}
                          {columnTasks.length === 0 && (
                            <div className="text-center text-xs font-bold text-slate-400 bg-white/70 border border-dashed border-slate-200 rounded-xl py-8">
                              표시할 업무가 없습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                    {Object.entries(STATUSES).map(([key, info]) => (<button key={key} onClick={() => setActiveTab(key)} className={`px-4 py-2 rounded-t-lg text-sm font-bold relative ${activeTab === key ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500'}`}>{info.label}</button>))}
                  </div>
                  {filteredTasks.filter(t => t.status === activeTab).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">{filteredTasks.filter(t => t.status === activeTab).map(renderTaskCard)}</div>
                  ) : (
                    <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-16 text-center text-sm font-bold text-slate-400">
                      표시할 업무가 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 캘린더 탭 */}
        {currentMenu === 'calendar' && (
          <div>
            <header className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4">
              <div><h1 className="text-2xl font-bold flex items-center gap-2"><CalendarDays className="text-indigo-600 w-7 h-7" /> 일정 캘린더</h1></div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-slate-500 pl-2"><Folder className="w-3.5 h-3.5 inline mr-1"/>프로젝트:</span>
                  <select value={calendarFilterProject} onChange={e => setCalendarFilterProject(e.target.value)} className="border-none bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer w-32">
                    <option value="all">전체 (All)</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-slate-500 pl-2"><User className="w-3.5 h-3.5 inline mr-1"/>담당자:</span>
                  <select value={calendarFilterAssignee} onChange={e => setCalendarFilterAssignee(e.target.value)} className="border-none bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer w-24">
                    <option value="all">전체 (All)</option>
                    {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm ml-auto lg:ml-0">
                  <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><ChevronLeft className="w-4 h-4"/></button>
                  <span className="font-bold text-slate-800 min-w-[90px] text-center text-sm">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
                  <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><ChevronRight className="w-4 h-4"/></button>
                </div>
	              </div>
	            </header>
	            <div className="flex flex-wrap gap-2 mb-4">
	              {[...new Set(tasks.map(t => t.assignee || '미지정'))].map(name => {
	                const color = getAssigneeColor(name).chip;
	                return (
	                  <span key={name} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${color}`}>
	                    <span className={`w-2 h-2 rounded-full ${getAssigneeColor(name).bar}`}></span>
	                    {name}
	                  </span>
	                );
	              })}
	            </div>
	            {renderCalendar()}
	          </div>
	        )}

        {/* 팀원 관리 탭 */}
        {currentMenu === 'members' && isCurrentWorkspaceOwner && (
          <div>
            <header className="mb-6 flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="text-indigo-600 w-7 h-7" /> 팀원 관리</h1>
                <p className="text-sm text-slate-500 mt-2">입사일 기준 부여 연차와 Google Calendar API 일정으로 잔여연차를 계산합니다.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <input type="text" placeholder="이름/직급 검색..." value={memberSearchQuery} onChange={(e) => setMemberSearchQuery(e.target.value)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={() => handleOpenMemberModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> 팀원 등록</button>
              </div>
            </header>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
              <input type="file" accept=".json,application/json" ref={googleCalendarKeyInputRef} onChange={handleGoogleCalendarKeyUpload} className="hidden" />
              <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_120px_auto] gap-3 items-end">
                <button onClick={() => googleCalendarKeyInputRef.current?.click()} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50">
                  <Upload className="w-4 h-4" /> API Key JSON
                </button>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Google Calendar ID</label>
                  <input type="text" value={googleCalendarConfig.calendarId || ''} onChange={e => persistGoogleCalendarConfig({ ...googleCalendarConfig, calendarId: e.target.value })} placeholder="예: company.com_xxxxx@group.calendar.google.com" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">조회 연도</label>
                  <input type="number" value={googleCalendarConfig.year || ''} onChange={e => persistGoogleCalendarConfig({ ...googleCalendarConfig, year: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <button onClick={syncGoogleCalendarAnnualLeave} disabled={isCalendarSyncing} className="bg-emerald-600 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                  <CalendarDays className="w-4 h-4" /> {isCalendarSyncing ? '동기화 중' : '연차 동기화'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="font-bold text-slate-700">불러온 일정 {annualLeaveEvents.length}건</span>
                <span>API Key는 브라우저에서 사용되므로 HTTP referrer와 Calendar API 제한을 설정하세요.</span>
                <span>일정 제목/설명에 팀원 이름과 연차, 휴가, 반차 키워드가 함께 있어야 사용 연차로 계산됩니다.</span>
              </div>
            </div>
	            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
	              {filteredMembers.map(m => {
	                const age = calculateAge(m.birthday);
	                const dept = departments.find(d => d.id === m.departmentId);
	                const nextPromotionDate = calculateNextPromotionDate(m.rank, m.joinDate, m.promotionDate);
                  const annualLeaveBase = getAnnualLeaveBase(m);
                  const usedAnnualLeave = getUsedAnnualLeaveDays(m, annualLeaveEvents);
                  const remainingAnnualLeave = annualLeaveBase - usedAnnualLeave;
	                return (
	                  <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative group">
	                    <button onClick={() => handleOpenMemberModal(m)} className="absolute top-4 right-4 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100"><Edit2 className="w-4 h-4" /></button>
	                    <div className="text-center mb-5 mt-2"><div className="w-16 h-16 bg-gradient-to-tr from-indigo-100 to-blue-50 text-indigo-600 rounded-full flex items-center justify-center text-xl font-black mx-auto mb-3">{(m.name||'유').substring(0, 1)}</div><h3 className="font-bold text-lg text-slate-800">{m.name}</h3><p className="text-sm text-slate-500 font-medium mt-1.5">{m.rank} | {m.role} <br/>({dept?.name || '소속없음'})</p></div>
	                    <div className="grid grid-cols-2 gap-2 text-xs mb-4">
	                      <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
	                        <span className="block text-slate-400 font-bold mb-0.5">나이</span>
	                        <span className="font-bold text-slate-700">{age ? `${age}세` : '-'}</span>
	                      </div>
	                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
	                        <span className="block text-indigo-400 font-bold mb-0.5">다음 진급일</span>
	                        <span className="font-bold text-indigo-700">{formatDateLabel(nextPromotionDate)}</span>
	                      </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                          <span className="block text-emerald-500 font-bold mb-0.5">잔여 연차</span>
                          <span className={`font-bold ${remainingAnnualLeave < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatLeaveDays(remainingAnnualLeave)}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                          <span className="block text-slate-400 font-bold mb-0.5">부여/사용</span>
                          <span className="font-bold text-slate-700">{formatLeaveDays(annualLeaveBase)} / {formatLeaveDays(usedAnnualLeave)}</span>
                        </div>
	                    </div>
	                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2"><button onClick={() => generateGreetingAI(m, 'birthday')} className="flex-1 bg-slate-50 hover:bg-slate-100 py-2 rounded-lg text-xs font-bold flex justify-center text-slate-600"><Cake className="w-3.5 h-3.5 mr-1"/> 생일 축하</button></div>
	                  </div>
	                );
	              })}
            </div>
          </div>
        )}

        {/* 조직 관리 탭 */}
        {currentMenu === 'org' && isCurrentWorkspaceOwner && (
          <div className="max-w-4xl mx-auto">
            <header className="mb-8 flex justify-between items-end">
              <div><h1 className="text-2xl font-bold flex items-center gap-2"><Building className="text-indigo-600 w-7 h-7" /> 조직 관리</h1></div>
              <button onClick={() => handleOpenOrgModal(null)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"><Plus className="w-4 h-4" /> 최상위 부서 추가</button>
            </header>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              {departments.length === 0 ? <div className="text-center py-10 text-slate-500">등록된 부서가 없습니다.</div> : renderOrganizationTree(null, 0)}
            </div>
          </div>
        )}
      </main>

      {/* --- 각종 모달 --- */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-5 border-b flex justify-between items-center"><h3 className="font-bold text-lg">{projectFormData.id ? '프로젝트 수정' : '새 프로젝트 생성'}</h3><button onClick={() => setIsProjectModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button></div>
            <form onSubmit={handleProjectSubmit}>
              <div className="p-5 space-y-4">
                <div><label className="block text-sm font-bold mb-1">프로젝트 이름 *</label><input type="text" autoFocus required value={projectFormData.name} onChange={e => setProjectFormData({...projectFormData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                <div>
                  <label className="block text-sm font-bold mb-2">테마 색상</label>
                  <div className="flex gap-3">{Object.keys(PROJECT_COLORS).map(k => <button key={k} type="button" onClick={() => setProjectFormData({...projectFormData, color: k})} className={`w-8 h-8 rounded-full ${PROJECT_COLORS[k].bg.replace('100', '400')} ${projectFormData.color === k ? 'ring-2 ring-slate-400 scale-110' : 'opacity-60'}`} />)}</div>
                </div>
              </div>
              <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-2xl"><button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 bg-white border rounded-lg font-bold text-sm">취소</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm">저장</button></div>
            </form>
          </div>
        </div>
      )}

      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center"><h3 className="font-bold text-lg">{editingTask ? '업무 수정' : '새 업무 등록'}</h3><button onClick={() => setIsTaskModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button></div>
            <div className="p-5 overflow-y-auto space-y-5">
              <div><label className="block text-sm font-bold mb-1">업무명 *</label><input type="text" value={taskFormData.title || ''} onChange={e => setTaskFormData({...taskFormData, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-bold mb-1">소속 프로젝트</label><select value={taskFormData.projectId || ''} onChange={e => setTaskFormData({...taskFormData, projectId: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white outline-none"><option value="">선택 안 함</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="block text-sm font-bold mb-1">담당자</label><select value={taskFormData.assignee || ''} onChange={e => setTaskFormData({...taskFormData, assignee: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white"><option value="">선택 안 함</option>{members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}</select></div>
                <div><label className="block text-sm font-bold mb-1">상태</label><select value={taskFormData.status || 'todo'} onChange={e => setTaskFormData({...taskFormData, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white"><option value="todo">진행 예정</option><option value="in-progress">진행 중</option><option value="done">완료됨</option></select></div>
                <div><label className="block text-sm font-bold mb-1">시작일</label><input type="date" value={taskFormData.startDate || ''} onChange={e => setTaskFormData({...taskFormData, startDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-bold mb-1">목표일</label><input type="date" value={taskFormData.targetDate || ''} onChange={e => setTaskFormData({...taskFormData, targetDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1"><label className="block text-sm font-bold">상세 설명</label><button type="button" onClick={polishDescriptionAI} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100 font-bold flex items-center gap-1 hover:bg-indigo-100"><Sparkles className="w-3 h-3"/> AI 문장 다듬기</button></div>
                <textarea value={taskFormData.description || ''} onChange={e => setTaskFormData({...taskFormData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" rows="3"/>
              </div>
              <div className="border-t pt-5">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold">하위 업무</h4>
                  <button type="button" onClick={generateSubtasksAI} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-indigo-100"><Sparkles className="w-3 h-3"/> AI 업무 추천</button>
                </div>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={newSubtaskTitle || ''} onChange={e => setNewSubtaskTitle(e.target.value)} onKeyDown={e => {if(e.key === 'Enter') {e.preventDefault(); if(!newSubtaskTitle.trim())return; setTaskFormData({...taskFormData, subtasks: [...(taskFormData.subtasks || []), {id: Date.now().toString(), title: newSubtaskTitle, completed: false}]}); setNewSubtaskTitle('');}}} className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="작업 입력 후 Enter"/>
                </div>
                <ul className="space-y-2">
                  {taskFormData.subtasks?.map((sub, idx) => (
                    <li key={sub.id} draggable onDragStart={(e) => handleDragStart(e, idx)} onDragEnter={(e) => handleDragEnter(e, idx)} onDragOver={(e)=>e.preventDefault()} onDragEnd={handleDragEnd} className="flex items-center gap-3 p-2 border rounded-lg bg-slate-50">
                      <GripVertical className="w-4 h-4 text-slate-400 cursor-grab"/>
                      <input type="checkbox" checked={sub.completed} onChange={() => setTaskFormData({...taskFormData, subtasks: taskFormData.subtasks.map(s => s.id === sub.id ? {...s, completed: !s.completed} : s)})} className="w-4 h-4 rounded text-indigo-600"/>
                      <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-slate-400' : ''}`}>{sub.title}</span>
                      <button type="button" onClick={() => setTaskFormData({...taskFormData, subtasks: taskFormData.subtasks.filter(s => s.id !== sub.id)})} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-between rounded-b-2xl">{editingTask ? <button onClick={() => deleteTask(editingTask.id)} className="text-red-500 font-bold px-2 text-sm">삭제</button> : <div></div>}<div className="flex gap-2"><button onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 bg-white border rounded-lg text-sm font-bold">취소</button><button onClick={handleTaskSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">저장</button></div></div>
          </div>
        </div>
      )}

      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b flex justify-between items-center"><h3 className="font-bold text-lg">{editingMember ? '수정' : '등록'}</h3><button onClick={() => setIsMemberModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button></div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold mb-1">이름 *</label><input type="text" value={memberFormData.name || ''} onChange={e => setMemberFormData({...memberFormData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-bold mb-1">직급</label><select value={memberFormData.rank || ''} onChange={e => setMemberFormData({...memberFormData, rank: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <div className="col-span-2"><label className="block text-sm font-bold mb-1">소속 부서</label><select value={memberFormData.departmentId || ''} onChange={e => setMemberFormData({...memberFormData, departmentId: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm bg-white"><option value="">-- 선택 안 함 --</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div className="col-span-2"><label className="block text-sm font-bold mb-1">직무</label><input type="text" value={memberFormData.role || ''} onChange={e => setMemberFormData({...memberFormData, role: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-bold mb-1">입사일</label><input type="date" value={memberFormData.joinDate || ''} onChange={e => setMemberFormData({...memberFormData, joinDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
	                <div><label className="block text-sm font-bold mb-1">최근 진급일</label><input type="date" value={memberFormData.promotionDate || ''} onChange={e => setMemberFormData({...memberFormData, promotionDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
	                <div className="col-span-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5">
	                  <span className="block text-xs font-bold text-indigo-500 mb-1">다음 진급일</span>
	                  <span className="text-sm font-black text-indigo-800">
	                    {formatDateLabel(calculateNextPromotionDate(memberFormData.rank, memberFormData.joinDate, memberFormData.promotionDate))}
	                  </span>
	                </div>
	                <div className="col-span-2"><label className="block text-sm font-bold mb-1">생일</label><input type="date" value={memberFormData.birthday || ''} onChange={e => setMemberFormData({...memberFormData, birthday: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-sm font-bold mb-1">연차 입력</label><input type="number" step="0.5" value={memberFormData.annualLeaveBase ?? ''} onChange={e => setMemberFormData({...memberFormData, annualLeaveBase: e.target.value})} placeholder={String(calculateStatutoryAnnualLeave(memberFormData.joinDate))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
                    <span className="block text-xs font-bold text-emerald-500 mb-1">기준 부여 연차</span>
                    <span className="text-sm font-black text-emerald-800">{formatLeaveDays(getAnnualLeaveBase(memberFormData))}</span>
                  </div>
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-between rounded-b-2xl">{editingMember ? <button onClick={() => deleteMember(editingMember.id)} className="text-red-500 font-bold px-2 text-sm">삭제</button> : <div></div>}<div className="flex gap-2"><button onClick={() => setIsMemberModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold bg-white">취소</button><button onClick={handleMemberSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">저장</button></div></div>
          </div>
        </div>
      )}

      {isOrgModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-5 border-b flex justify-between items-center"><h3 className="font-bold text-lg">부서 추가</h3><button onClick={() => setIsOrgModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button></div>
            <form onSubmit={handleOrgSubmit}>
              <div className="p-5"><label className="block text-sm font-bold mb-1">부서명 *</label><input type="text" required value={orgFormData.name} onChange={e => setOrgFormData({...orgFormData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-2xl"><button type="button" onClick={() => setIsOrgModalOpen(false)} className="px-4 py-2 border bg-white rounded-lg text-sm font-bold">취소</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">추가</button></div>
            </form>
          </div>
        </div>
      )}

      {isKeyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Key className="w-5 h-5 text-indigo-600"/> Gemini API 키 설정</h3>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full px-3 py-2 border rounded-lg mb-6 mt-4" />
            <div className="flex justify-end gap-2"><button onClick={() => setIsKeyModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-lg font-bold text-sm">닫기</button><button onClick={() => { localStorage.setItem('gemini_api_key', apiKey); setIsKeyModalOpen(false); showAlert('저장 완료', 'API 키가 저장되었습니다.'); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm">저장</button></div>
          </div>
        </div>
      )}

      {customAlert.isOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100] text-left">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-all">
            <h3 className="font-bold text-lg text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-slate-600 text-sm mb-6 whitespace-pre-wrap">{customAlert.message}</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => { if (customAlert.onConfirm) customAlert.onConfirm(); closeAlert(); }} className={`px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold ${customAlert.isConfirm ? 'flex-1' : 'w-full'}`}>{customAlert.isConfirm ? '확인' : '닫기'}</button>
              {customAlert.isConfirm && <button onClick={closeAlert} className="flex-1 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold">취소</button>}
            </div>
          </div>
        </div>
      )}

      {isAiLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-[110]">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p className="font-bold text-indigo-800 animate-pulse">데이터를 처리하고 있습니다...</p>
        </div>
      )}
    </div>
  );
}
