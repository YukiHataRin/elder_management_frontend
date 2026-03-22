import React from 'react';
import { Trophy, Coins, Settings, ArrowUpRight, ArrowDownRight, Users, Heart, Activity, Camera } from 'lucide-react';

const Gamification = () => {
    const rankingSystem = [
        { rank: 1, name: '林阿公', coins: 3450, trend: 'up', title: '健康模範生' },
        { rank: 2, name: '陳罔市', coins: 3220, trend: 'stable', title: '運動達人' },
        { rank: 3, name: '陳爺爺', coins: 2980, trend: 'up', title: '社交活耀' },
        { rank: 4, name: '李阿嬤', coins: 2850, trend: 'down', title: '' },
        { rank: 5, name: '王大明', coins: 1450, trend: 'up', title: '' },
    ];

    const rules = [
        { type: '肌少症 A級任務', icon: <Activity className="text-primary" size={20} />, coins: '+10', condition: '依規定完成並上傳佐證' },
        { type: '社會心理任務', icon: <Heart className="text-rose-500" size={20} />, coins: '+5', condition: '選擇任一任務並評分' },
        { type: '社會心理照片', icon: <Camera className="text-emerald-500" size={20} />, coins: '+5', condition: '附上社交或完成照片額外加碼' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-lora font-bold text-primary">內生激勵與排名機制</h2>
                <p className="text-text/60 mt-1">時間銀行(長照幣)發放匯率設定與全站榮譽榜</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Rules & Settings */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-100/50">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-text flex items-center space-x-2">
                                <Settings size={20} className="text-slate-500" />
                                <span>發放匯率設定</span>
                            </h3>
                            <button className="text-sm text-primary font-medium hover:text-primary-light transition-colors cursor-pointer">
                                編輯規則
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/30">
                                <div className="flex items-center space-x-3 mb-2 text-text/70 font-medium">
                                    <div className="p-2 bg-white rounded-lg shadow-sm text-primary"><Trophy size={16} /></div>
                                    <span>肌少症 A級任務</span>
                                </div>
                                <div className="text-sm text-text/50 mb-3 h-8">依規定完成並上傳佐證</div>
                                <div className="flex items-center justify-between border-t border-sky-100/50 pt-3">
                                    <span className="text-sm font-bold text-text">獎勵</span>
                                    <span className="text-lg font-bold text-amber-500 flex items-center">+10 <Coins size={16} className="ml-1" /></span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/30">
                                <div className="flex items-center space-x-3 mb-2 text-text/70 font-medium">
                                    <div className="p-2 bg-white rounded-lg shadow-sm text-rose-500"><Heart size={16} /></div>
                                    <span>社會心理任務</span>
                                </div>
                                <div className="text-sm text-text/50 mb-3 h-8">選擇任一任務並完成心情評分</div>
                                <div className="flex items-center justify-between border-t border-sky-100/50 pt-3">
                                    <span className="text-sm font-bold text-text">獎勵</span>
                                    <span className="text-lg font-bold text-amber-500 flex items-center">+5 <Coins size={16} className="ml-1" /></span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30">
                                <div className="flex items-center space-x-3 mb-2 text-emerald-700 font-medium">
                                    <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-500"><Trophy size={16} /></div>
                                    <span>上傳照片加碼</span>
                                </div>
                                <div className="text-sm text-emerald-600/70 mb-3 h-8">附上社交或完成照片額外加碼</div>
                                <div className="flex items-center justify-between border-t border-emerald-200/50 pt-3">
                                    <span className="text-sm font-bold text-emerald-700">獎勵</span>
                                    <span className="text-lg font-bold text-emerald-600 flex items-center">+5 <Coins size={16} className="ml-1" /></span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                            <strong>💡 應用場景：</strong> 長期累積變成「時間銀行」，可於兌換中心兌換紅十字會服務 (送餐/食物銀行) 或減免掛號費。
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-100/50">
                            <h4 className="font-bold text-text mb-2">團體賽進度 (據點 vs 據點)</h4>
                            <p className="text-sm text-text/50 mb-6">不同照護據點間的競賽分數統計</p>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-bold text-primary">信義區大安據點 (本區)</span>
                                        <span className="font-bold">2,450 分</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary w-[85%]"></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1 text-text/70">
                                        <span className="font-medium">松山區樂齡中心</span>
                                        <span className="font-bold">2,120 分</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-300 w-[70%]"></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1 text-text/70">
                                        <span className="font-medium">萬華區健康服務站</span>
                                        <span className="font-bold">1,890 分</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-300 w-[60%]"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-100/50">
                            <h4 className="font-bold text-text mb-2">自我進步率追蹤</h4>
                            <p className="text-sm text-text/50 mb-6">長者個人成長與突破指標 (較上月提升)</p>

                            <div className="flex items-center justify-center h-32 flex-col">
                                <div className="text-4xl font-bold text-cta mb-2">+18%</div>
                                <div className="text-sm text-text/60">整體個案平均進步率</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Global Leaderboard */}
                <div className="bg-gradient-to-b from-amber-50 to-white p-1 rounded-2xl shadow-sm border border-amber-100 lg:col-span-1">
                    <div className="bg-white rounded-[14px] p-6 h-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-amber-600 flex items-center space-x-2">
                                <Trophy size={20} className="text-amber-500" />
                                <span>全站榮譽榜 (本月)</span>
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {rankingSystem.map((user) => (
                                <div key={user.rank} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-slate-50">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm
                    ${user.rank === 1 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                            user.rank === 2 ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                                                user.rank === 3 ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                                    'bg-slate-50 text-slate-500 border border-slate-100'}`}
                                    >
                                        {user.rank}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center">
                                            <span className="font-bold text-text mr-2">{user.name}</span>
                                            {user.title && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                                                    {user.title}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-text/50 flex flex-col justify-start items-start mt-0.5" >
                                            <span className="font-bold text-amber-600 mr-2 flex items-center"><Coins size={10} className="mr-1" />{user.coins} 幣</span>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        {user.trend === 'up' && <ArrowUpRight size={16} className="text-cta inline-block" />}
                                        {user.trend === 'down' && <ArrowDownRight size={16} className="text-rose-500 inline-block" />}
                                        {user.trend === 'stable' && <span className="text-slate-300 font-bold inline-block w-4 text-center">-</span>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="w-full mt-6 py-2.5 text-sm font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors cursor-pointer">
                            查看完整榜單
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Gamification;
