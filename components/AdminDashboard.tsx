
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TimeRange, Feedback } from '../types';
import { getFeedbackData, calculateAnalytics, getSettings, deleteFeedback, saveFeedback, logAction, isLeap, dateToAbsoluteDays, toPersianDigits } from '../services/dataService';
import { Search, Hash, Trash2, Activity, CheckCircle, AlertTriangle, Filter, User, Timer, ArrowUpDown, ArrowUp, ArrowDown, X, Edit, FileText, Printer, Volume2, ChevronDown, ChevronUp, Folder } from 'lucide-react';
// @ts-ignore
import jalaali from 'jalaali-js';
import Header from './Header';
import SurveyForm from './SurveyForm';

const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<Feedback[]>([]);
  const [filteredData, setFilteredData] = useState<Feedback[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.WEEKLY);
  const [filterSource, setFilterSource] = useState('All'); 
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [viewMode, setViewMode] = useState<'default' | 'urgent'>('default');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedPatient, setSelectedPatient] = useState<Feedback | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showNpsInfo, setShowNpsInfo] = useState(false);
  const currentJ = jalaali.toJalaali(new Date());
  const [sDate, setSDate] = useState({y: currentJ.jy, m: currentJ.jm, d: 1});
  const [eDate, setEDate] = useState({y: currentJ.jy, m: currentJ.jm, d: currentJ.jd});

  const currentUserUsername = localStorage.getItem('user_username');
  const isMahlouji = currentUserUsername === 'mahlouji';

  useEffect(() => { getSettings().then(s => { setSettings(s); loadData(); }); }, []);
  useEffect(() => { applyFilters(); }, [data, timeRange, sDate, eDate, filterSource, search]);

  const loadData = async () => { const res = await getFeedbackData(); setData(res.filter(d => d.status === 'final')); };
  const applyFilters = () => {
      let temp = [...data];
      if (timeRange === TimeRange.CUSTOM) {
          const startNum = sDate.y * 10000 + sDate.m * 100 + sDate.d;
          const endNum = eDate.y * 10000 + eDate.m * 100 + eDate.d;
          temp = temp.filter(d => { const jd = jalaali.toJalaali(new Date(d.createdAt)); return (jd.jy * 10000 + jd.jm * 100 + jd.jd) >= startNum && (jd.jy * 10000 + jd.jm * 100 + jd.jd) <= endNum; });
      }
      if (filterSource !== 'All') {
          if (filterSource === 'public') temp = temp.filter(d => d.source === 'public');
          else temp = temp.filter(d => d.registrarUsername === filterSource.replace('user-', ''));
      }
      if (search) {
          const t = search.toLowerCase();
          temp = temp.filter(d => d.patientInfo.name.includes(t) || d.patientInfo.nationalId.includes(t) || d.ward.includes(t));
      }
      setFilteredData(temp);
      if (settings) setAnalytics(calculateAnalytics(temp, settings.questions));
  };

  const groupedData = useMemo(() => {
      let sorted = (viewMode === 'urgent' ? analytics?.urgentList : filteredData) || [];
      const groups: { main: Feedback, children: Feedback[] }[] = [];
      const nidMap = new Map();
      sorted.forEach(item => {
          const nid = item.patientInfo.nationalId;
          if (nid && nidMap.has(nid)) groups[nidMap.get(nid)].children.push(item);
          else { groups.push({ main: item, children: [] }); nidMap.set(nid, groups.length - 1); }
      });
      return groups;
  }, [filteredData, viewMode, analytics]);

  const paginatedGroups = groupedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(groupedData.length / itemsPerPage);

  const handleDelete = async (id: string) => {
      if (isMahlouji) return;
      if(confirm('حذف شود؟')) { await deleteFeedback(id); logAction('WARN', `Deleted: ${id}`); loadData(); setSelectedPatient(null); }
  };

  const formatDate = (iso: string) => { if (!iso) return ['-', '']; const parts = new Date(iso).toLocaleString('fa-IR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).split(' '); return parts; };
  const calculateAge = (bd: string) => { try { const [y] = bd.split('/').map(Number); return toPersianDigits(jalaali.toJalaali(new Date()).jy - y) + ' سال'; } catch { return '-'; } };

  const questions = settings?.questions?.sort((a:any, b:any) => a.order - b.order) || [];

  return (
    <div className="min-h-screen pb-20 bg-slate-50 dark:bg-transparent">
      <Header title="داشبورد مدیریت" showLogout />
      
      {selectedPatient && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto no-print">
              <div className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-3xl flex flex-col relative overflow-hidden bg-white dark:bg-slate-900 border">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                      <div><h2 className="text-2xl font-black">{selectedPatient.patientInfo.name}</h2><p className="text-xs font-bold text-slate-500">ثبت توسط: {selectedPatient.registrarName}</p></div>
                      <div className="flex gap-2"><button onClick={()=>window.print()} className="p-2 bg-slate-200 rounded-full"><Printer className="w-5 h-5"/></button><button onClick={()=>{setSelectedPatient(null); setIsEditing(false);}} className="p-2 bg-slate-200 rounded-full hover:bg-red-500 hover:text-white"><X className="w-6 h-6"/></button></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                      {isEditing && !isMahlouji ? (
                          <SurveyForm source="staff" initialData={selectedPatient} onSuccess={()=>{setIsEditing(false); setSelectedPatient(null); loadData();}} />
                      ) : (
                          <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                  <InfoItem label="کد ملی" value={toPersianDigits(selectedPatient.patientInfo.nationalId)} /><InfoItem label="موبایل" value={toPersianDigits(selectedPatient.patientInfo.mobile)} /><InfoItem label="بخش" value={selectedPatient.ward} />
                              </div>
                              <div className="space-y-4">
                                  {questions.map((q: any) => (
                                      <div key={q.id} className="border-b pb-3">
                                          <p className="text-sm font-bold text-slate-500">{q.text}</p>
                                          <p className="font-bold text-lg">{renderSimpleAnswer(q, selectedPatient.answers[q.id])}</p>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
                  {!isEditing && (
                      <div className="p-4 border-t bg-slate-50/80 flex justify-end gap-3 no-print">
                          {!isMahlouji && (
                              <><button onClick={()=>handleDelete(selectedPatient.id)} className="px-6 py-3 rounded-xl bg-red-100 text-red-600 font-bold hover:bg-red-200 flex items-center gap-2"><Trash2 className="w-5 h-5"/> حذف</button>
                              <button onClick={()=>setIsEditing(true)} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center gap-2"><Edit className="w-5 h-5"/> ویرایش</button></>
                          )}
                          {isMahlouji && <p className="text-xs text-slate-400 font-bold self-center">دسترسی شما فقط مشاهده است.</p>}
                      </div>
                  )}
              </div>
          </div>
      )}

      <div className="max-w-[95%] mx-auto px-4 mt-8 space-y-6">
          <div className="glass-panel p-5 rounded-3xl flex flex-col xl:flex-row gap-6 justify-between items-center no-print">
               <div className="flex gap-4 items-center">
                    <select value={timeRange} onChange={e=>setTimeRange(e.target.value as any)} className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl font-bold"><option value="today">امروز</option><option value="weekly">هفته</option><option value="monthly">ماه</option><option value="custom">بازه</option></select>
                    {timeRange === 'custom' && <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl animate-fade-in"><PDatePicker val={sDate} setVal={setSDate} /><span className="text-slate-400">تا</span><PDatePicker val={eDate} setVal={setEDate} /></div>}
               </div>
               <div className="flex gap-3 w-full xl:w-auto">
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جستجو نام یا کد ملی..." className="flex-1 p-3 rounded-2xl bg-white dark:bg-slate-800 border outline-none"/>
                    <select value={filterSource} onChange={e=>setFilterSource(e.target.value)} className="p-3 rounded-2xl border font-bold"><option value="All">همه</option>{settings?.users.filter((u:any)=>u.role==='staff').map((u:any)=><option key={u.id} value={`user-${u.username}`}>{u.name}</option>)}</select>
               </div>
          </div>

          <div className="glass-panel rounded-3xl overflow-hidden shadow-xl">
               <div className="overflow-x-auto">
                   <table className="w-full text-right">
                       <thead className="bg-slate-100 text-slate-500 font-bold text-sm">
                           <tr><th className="p-5 w-10 text-center">#</th><th>نام بیمار</th><th>کد ملی</th><th>موبایل</th><th>بخش</th><th className="text-center">تاریخ</th><th>ثبت کننده</th></tr>
                       </thead>
                       <tbody className="text-sm font-medium">
                           {paginatedGroups.map((g, i) => (
                               <tr key={g.main.id} onClick={()=>setSelectedPatient(g.main)} className="border-t hover:bg-blue-50/50 cursor-pointer transition-colors">
                                   <td className="p-5 text-center text-slate-400">{(currentPage-1)*itemsPerPage+i+1}</td>
                                   <td className="p-5 font-bold text-lg text-blue-600">{g.main.patientInfo.name}</td>
                                   <td className="p-5 font-mono">{toPersianDigits(g.main.patientInfo.nationalId)}</td>
                                   <td className="p-5 font-mono">{toPersianDigits(g.main.patientInfo.mobile)}</td>
                                   <td className="p-5">{g.main.ward}</td>
                                   <td className="p-5 text-center">{toPersianDigits(formatDate(g.main.createdAt)[0])}</td>
                                   <td className="p-5"><span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">{g.main.registrarName}</span></td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
          </div>
      </div>
    </div>
  );
};

const renderSimpleAnswer = (q: any, val: any) => {
    if (val === undefined || val === null) return '-';
    if (q.type === 'yes_no') return val ? <span className="text-emerald-500">بله</span> : <span className="text-red-500">خیر</span>;
    if (q.type === 'likert') return toPersianDigits(val);
    if (q.type === 'nps') return <span className={`px-2 py-0.5 rounded ${val>=9?'bg-green-100 text-green-700':val<=6?'bg-red-100 text-red-700':'bg-yellow-100'}`}>{toPersianDigits(val)}</span>;
    return val;
};
const InfoItem = ({label, value}: any) => (<div><span className="block text-xs text-slate-500 mb-1">{label}</span><span className="font-bold">{value || '-'}</span></div>);
const PDatePicker = ({val, setVal}: any) => { const months = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"]; return (<div className="flex gap-1" dir="ltr"><select value={val.y} onChange={e=>setVal({...val, y: +e.target.value})} className="bg-transparent text-xs font-bold outline-none">{Array.from({length: 50}, (_,i) => 1380+i).map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select><span>/</span><select value={val.m} onChange={e=>setVal({...val, m: +e.target.value})} className="bg-transparent text-xs font-bold outline-none">{months.map((m,i) => <option key={i} value={i+1}>{m}</option>)}</select><span>/</span><select value={val.d} onChange={e=>setVal({...val, d: +e.target.value})} className="bg-transparent text-xs font-bold outline-none">{Array.from({length: 31}, (_,i) => i+1).map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select></div>) };

export default AdminDashboard;
