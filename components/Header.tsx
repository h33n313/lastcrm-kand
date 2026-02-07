
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Moon, Sun, Home, LogOut, Clock, LogIn, Lock, UserCog } from 'lucide-react';
import Logo from './Logo';
import { getSettings, updateUserPassword } from '../services/dataService';
import { AppUser } from '../types';

interface Props { title?: string; showLogout?: boolean; }

const Header: React.FC<Props> = ({ title, showLogout }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDark, setIsDark] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') { setIsDark(true); document.documentElement.classList.add('dark'); }
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const openPasswordModal = async () => {
      const username = localStorage.getItem('user_username');
      if (!username) return;
      const settings = await getSettings();
      const user = settings.users.find(u => u.username === username);
      if (user) {
          setCurrentUser(user);
          setAllUsers(settings.users);
          setTargetUserId(user.id);
          setShowPasswordModal(true);
      }
  };

  const handlePasswordUpdate = async () => {
      if (!newPassword) return alert('رمز را وارد کنید');
      if (await updateUserPassword(targetUserId, newPassword)) {
          alert('انجام شد');
          setShowPasswordModal(false);
          setNewPassword('');
      } else alert('خطا');
  };

  // Logic: Mahlouji can only edit HIMSELF. Others follow hierarchy.
  const isMahlouji = currentUser?.username === 'mahlouji';
  const canManageOthers = !isMahlouji && currentUser && ['matlabi', 'kand', 'mostafavi'].includes(currentUser.username);
  
  const editableUsers = allUsers.filter(u => {
      if (!currentUser) return false;
      if (u.id === currentUser.id) return true;
      if (canManageOthers) return !['matlabi', 'kand', 'mostafavi'].includes(u.username);
      return false;
  });

  return (
    <div className="sticky top-0 z-50 px-4 pt-4 pb-2 w-full no-print">
      {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="glass-panel w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Lock className="w-6 h-6 text-blue-500"/> تغییر رمز</h3>
                  <div className="space-y-4">
                      {editableUsers.length > 1 ? (
                          <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)} className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 outline-none">
                              {editableUsers.map(u => <option key={u.id} value={u.id}>{u.name} {u.id === currentUser?.id ? '(خودم)' : ''}</option>)}
                          </select>
                      ) : <div className="p-3 bg-blue-50 rounded-xl font-bold text-sm">تغییر رمز برای: {currentUser?.name}</div>}
                      <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-3 rounded-xl border bg-white dark:bg-slate-900 text-center tracking-widest font-mono" placeholder="رمز جدید..."/>
                      <div className="flex gap-2 pt-4"><button onClick={() => setShowPasswordModal(false)} className="flex-1 py-2 rounded-xl bg-slate-200 font-bold">لغو</button><button onClick={handlePasswordUpdate} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold">ثبت</button></div>
                  </div>
              </div>
          </div>
      )}
      <div className="max-w-7xl mx-auto glass-panel rounded-[2rem] p-3 flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl border-b-2 border-emerald-500/20">
        <div className="flex items-center gap-2 w-full md:w-auto">
             <div className="glass-card px-5 py-2 rounded-2xl flex items-center gap-4 border border-emerald-500/20 min-w-[220px] justify-between">
                 <div className="flex flex-col"><span className="text-2xl font-black text-emerald-900 dark:text-emerald-100 font-['Lalezar'] leading-none pt-1">{currentTime.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span><span className="text-xs font-bold text-emerald-700 mt-1">{currentTime.toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
                 <Clock className="w-6 h-6 text-emerald-600" />
             </div>
        </div>
        <div className="order-3 md:order-2 flex justify-center">{location.pathname === '/' || location.pathname === '/login' ? <Logo size="md" /> : <h1 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-800 to-teal-700 dark:from-emerald-200 dark:to-teal-200">{title || <Logo size="sm" showText={true} />}</h1>}</div>
        <div className="flex items-center gap-3 order-2 md:order-3 justify-end w-full md:w-auto">
            {location.pathname !== '/' && !location.pathname.startsWith('/survey') && <button onClick={() => navigate('/')} className="p-3 bg-white/50 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all"><Home className="w-5 h-5"/></button>}
            {location.pathname === '/' && <button onClick={() => navigate('/login')} className="px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold">ورود</button>}
            {showLogout && <><button onClick={openPasswordModal} className="p-3 bg-white/50 rounded-2xl hover:bg-blue-500 hover:text-white transition-all"><UserCog className="w-5 h-5"/></button><button onClick={()=>{localStorage.clear(); navigate('/login');}} className="p-3 bg-white/50 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><LogOut className="w-5 h-5"/></button></>}
            <button onClick={toggleTheme} className="p-3 bg-orange-500 rounded-2xl text-white">{isDark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}</button>
        </div>
      </div>
    </div>
  );
};
export default Header;
