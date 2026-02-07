
import React, { useState, useEffect } from 'react';
import { Settings, SurveyQuestion, AppUser } from '../types';
import { getSettings, saveSettings, backupData, restoreData, checkHealth, getSystemLogs, logAction, performFullRestore } from '../services/dataService';
import { Download, Upload, Settings as SettingsIcon, UserPlus, Trash2, Edit2, Key, List, Plus, ArrowUp, ArrowDown, CheckSquare, Square, Palette, Wifi, WifiOff, FileText, Activity, QrCode, Check, Mic, Languages, Sparkles, HardDrive } from 'lucide-react';
// @ts-ignore
import * as XLSX from 'xlsx';
import Header from './Header';

const formatLogDate = (iso: string) => { try { return new Date(iso).toLocaleString('fa-IR'); } catch { return iso; } };

const DeveloperPanel: React.FC = () => {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'questions' | 'backup' | 'general' | 'logs' | 'qr'>('users');
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [systemLogs, setSystemLogs] = useState<any[]>([]);
    const [testGeminiStatus, setTestGeminiStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [editingQuestion, setEditingQuestion] = useState<Partial<SurveyQuestion> | null>(null);
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<AppUser> | null>(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    const AVAILABLE_ICONS = ['Stethoscope', 'Activity', 'Thermometer', 'Heart', 'Pill', 'ShieldPlus', 'Syringe', 'Brain', 'Dna'];

    useEffect(() => { loadData(); checkConnection(); }, []);
    useEffect(() => { if (activeTab === 'logs') setSystemLogs(getSystemLogs()); }, [activeTab]);

    const loadData = async () => { setSettings(await getSettings()); };
    const checkConnection = async () => { setIsConnected(await checkHealth()); };
    const showMessage = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

    const handleSave = async (s: Settings) => {
        setSettings(s);
        await saveSettings(s);
        showMessage('ذخیره شد');
        if (!isConnected) setTimeout(() => window.dispatchEvent(new Event('storage')), 100);
    };

    const testGeminiApi = async () => {
        setTestGeminiStatus('loading');
        try {
            if(settings) await saveSettings(settings);
            const res = await fetch('/api/test-gemini', { method: 'POST' });
            if (res.ok) { setTestGeminiStatus('success'); showMessage('Gemini OK'); }
            else { setTestGeminiStatus('error'); alert('خطا در تست کلیدها'); }
        } catch (e: any) { setTestGeminiStatus('error'); alert(e.message); }
        finally { setTimeout(() => setTestGeminiStatus('idle'), 3000); }
    };

    const addGeminiKey = () => { if (!settings) return; setSettings({...settings, geminiApiKeys: [...(settings.geminiApiKeys || []), '']}); };
    const removeGeminiKey = (idx: number) => { if (!settings) return; const keys = [...(settings.geminiApiKeys || [])]; keys.splice(idx, 1); handleSave({...settings, geminiApiKeys: keys}); };
    const updateGeminiKey = (idx: number, val: string) => { if (!settings) return; const keys = [...(settings.geminiApiKeys || [])]; keys[idx] = val; setSettings({...settings, geminiApiKeys: keys}); };

    const saveUser = () => {
        if (!settings || !editingUser?.username || !editingUser?.name) return;
        let newUsers = [...settings.users];
        const idx = newUsers.findIndex(u => u.id === editingUser.id);
        const userObj: AppUser = { ...editingUser as AppUser, id: editingUser.id || `u${Date.now()}` };
        if (idx >= 0) newUsers[idx] = userObj; else newUsers.push(userObj);
        handleSave({...settings, users: newUsers});
        setShowUserModal(false);
    };

    const sortedQuestions = [...(settings?.questions || [])].sort((a,b) => a.order - b.order);

    if (!settings) return <div className="p-10 text-center font-bold">...</div>;

    return (
        <div className="min-h-screen pb-10">
            <Header title="پنل توسعه‌دهنده" showLogout />
            {message && <div className="fixed bottom-5 left-5 bg-emerald-600 text-white px-4 py-2 rounded-xl z-50 shadow-lg">{message}</div>}
            <div className="max-w-7xl mx-auto px-4 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="glass-panel p-4 rounded-3xl h-fit flex flex-col gap-2">
                        {[{id:'users', icon:UserPlus, label:'کاربران'},{id:'questions', icon:List, label:'سوالات'},{id:'qr', icon:QrCode, label:'لینک‌ها'},{id:'logs', icon:Activity, label:'گزارشات'},{id:'backup', icon:Download, label:'پشتیبان'},{id:'general', icon:SettingsIcon, label:'تنظیمات'}].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'hover:bg-white/40'}`}><tab.icon className="w-5 h-5" /> {tab.label}</button>
                        ))}
                    </div>
                    <div className="lg:col-span-3">
                        {activeTab === 'users' && (
                            <div className="glass-panel p-6 rounded-3xl animate-fade-in">
                                <div className="flex justify-between mb-6">
                                    <h2 className="text-2xl font-black flex items-center gap-2"><UserPlus className="w-6 h-6"/> مدیریت کاربران</h2>
                                    <button onClick={() => { setEditingUser({role:'staff', isPasswordEnabled:false}); setShowUserModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold">+ کاربر جدید</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {settings.users.map(u => (
                                        <div key={u.id} className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-2xl flex items-center justify-between border border-slate-200">
                                            <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full ${u.avatarColor || 'bg-slate-500'} flex items-center justify-center text-white font-bold`}>{u.name.charAt(0)}</div><div><p className="font-bold">{u.name}</p><p className="text-xs text-slate-500">{u.username} • <span className="text-blue-500">{u.title}</span></p></div></div>
                                            <div className="flex gap-1"><button onClick={()=>{setEditingUser(u); setShowUserModal(true);}} className="p-2 text-blue-500"><Edit2 className="w-4 h-4"/></button><button onClick={()=>{if(confirm('حذف؟')) handleSave({...settings, users: settings.users.filter(x=>x.id!==u.id)})}} className="p-2 text-red-500"><Trash2 className="w-4 h-4"/></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeTab === 'general' && (
                            <div className="glass-panel p-6 rounded-3xl space-y-6">
                                <div><label className="block mb-2 font-bold">نام سامانه</label><input className="w-full p-4 rounded-xl border bg-white dark:bg-slate-900" value={settings.brandName} onChange={e=>setSettings({...settings, brandName:e.target.value})} onBlur={()=>handleSave(settings)}/></div>
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border">
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-500"/> کلیدهای Gemini API</label>
                                        <button onClick={addGeminiKey} className="bg-emerald-500 text-white p-2 rounded-lg hover:scale-105 transition-all"><Plus className="w-5 h-5"/></button>
                                    </div>
                                    <div className="space-y-3">
                                        {(settings.geminiApiKeys || []).map((k, idx) => (
                                            <div key={idx} className="flex gap-2 animate-fade-in">
                                                <input className="flex-1 p-3 rounded-xl border bg-white dark:bg-slate-900 font-mono text-sm" value={k} onChange={e=>updateGeminiKey(idx, e.target.value)} onBlur={()=>handleSave(settings)} placeholder={`کلید شماره ${idx+1}`} type="password"/>
                                                <button onClick={()=>removeGeminiKey(idx)} className="p-3 bg-red-100 text-red-500 rounded-xl"><Trash2 className="w-5 h-5"/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={testGeminiApi} disabled={testGeminiStatus==='loading'} className="mt-4 w-full py-3 bg-teal-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                        {testGeminiStatus==='loading' ? 'در حال تست...' : <><Check className="w-5 h-5"/> تست و ذخیره نهایی</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showUserModal && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-panel w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900">
                        <h3 className="text-xl font-black mb-6">{editingUser.id ? 'ویرایش' : 'جدید'}</h3>
                        <div className="space-y-4">
                            <input className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800" placeholder="نام کامل" value={editingUser.name||''} onChange={e=>setEditingUser({...editingUser,name:e.target.value})}/>
                            <input className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono" placeholder="username" value={editingUser.username||''} onChange={e=>setEditingUser({...editingUser,username:e.target.value})}/>
                            <input className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800" placeholder="عنوان شغلی" value={editingUser.title||''} onChange={e=>setEditingUser({...editingUser,title:e.target.value})}/>
                            <select className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800" value={editingUser.role} onChange={e=>setEditingUser({...editingUser,role:e.target.value as any})}><option value="staff">پرسنل</option><option value="admin">مدیر</option></select>
                        </div>
                        <div className="flex gap-2 mt-6"><button onClick={()=>setShowUserModal(false)} className="flex-1 py-3 bg-slate-200 rounded-xl font-bold">لغو</button><button onClick={saveUser} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">ذخیره</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default DeveloperPanel;
