'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Lock, 
  Unlock, 
  Settings, 
  Check, 
  AlertTriangle, 
  Clipboard, 
  RefreshCw, 
  UserPlus, 
  Info, 
  X,
  Sparkles,
  Calendar
} from 'lucide-react';
import { 
  ShiftType, 
  ShiftSettings, 
  Employee, 
  ShiftAssignment, 
  OHSConfig, 
  DAYS_OF_WEEK, 
  DEFAULT_OHS_CONFIG, 
  DEFAULT_SHIFT_SETTINGS,
  MonthDay
} from '../types/scheduler';
import { 
  autoPlanShifts, 
  checkScheduleViolations, 
  getShiftDuration, 
  getMonthDays,
  OHSViolation 
} from '../utils/scheduler';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const YEARS = [2026, 2027, 2028, 2029, 2030];

export default function ShiftPlannerPage() {
  // --- STATE ---
  const [employees, setEmployees] = useState<Employee[]>([
    { id: '1', name: 'Ahmet Yılmaz' },
    { id: '2', name: 'Ayşe Kaya' },
    { id: '3', name: 'Mehmet Demir' },
    { id: '4', name: 'Fatma Çelik' },
    { id: '5', name: 'Mustafa Şahin' }
  ]);

  const [selectedMonth, setSelectedMonth] = useState<number>(5); // Haziran (5)
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [settings, setSettings] = useState<ShiftSettings>(DEFAULT_SHIFT_SETTINGS);
  const [ohsConfig, setOhsConfig] = useState<OHSConfig>(DEFAULT_OHS_CONFIG);
  const [requirements, setRequirements] = useState<Record<Exclude<ShiftType, 'off'>, number>>({
    morning: 1,
    afternoon: 1,
    night: 1
  });

  const [employeeInput, setEmployeeInput] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- DYNAMIC MONTH DAYS ---
  const monthDays = useMemo(() => {
    return getMonthDays(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // --- INITIALIZE SCHEDULE FOR SELECTED MONTH ---
  useEffect(() => {
    const initialAssignments: ShiftAssignment[] = [];
    employees.forEach(emp => {
      for (let d = 0; d < monthDays.length; d++) {
        initialAssignments.push({
          employeeId: emp.id,
          dayIndex: d,
          shiftType: 'off',
          isLocked: false
        });
      }
    });
    setAssignments(initialAssignments);
    setErrorMsg(null);
  }, [selectedMonth, selectedYear]);

  // --- DYNAMIC OHS VIOLATIONS ---
  const violations = useMemo(() => {
    return checkScheduleViolations(employees, assignments, settings, ohsConfig, requirements, monthDays);
  }, [employees, assignments, settings, ohsConfig, requirements, monthDays]);

  // Hücre bazlı ihlal bulma (Kırmızı çerçeve ve açıklama için)
  const cellViolationsMap = useMemo(() => {
    const map: Record<string, OHSViolation[]> = {};
    violations.forEach(v => {
      if (v.employeeId !== undefined && v.dayIndex !== undefined) {
        const key = `${v.employeeId}-${v.dayIndex}`;
        if (!map[key]) map[key] = [];
        map[key].push(v);
      }
    });
    return map;
  }, [violations]);

  // --- ACTIONS ---

  // Çalışan Ekleme
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const name = employeeInput.trim();
    if (!name) return;

    const newEmp: Employee = {
      id: Date.now().toString(),
      name
    };

    setEmployees(prev => [...prev, newEmp]);
    
    // Yeni çalışanın atamalarını ekle
    setAssignments(prev => {
      const next = [...prev];
      for (let d = 0; d < monthDays.length; d++) {
        next.push({
          employeeId: newEmp.id,
          dayIndex: d,
          shiftType: 'off',
          isLocked: false
        });
      }
      return next;
    });

    setEmployeeInput('');
    setSuccessMsg(`"${name}" başarıyla eklendi.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Çalışan Silme
  const handleDeleteEmployee = (id: string, name: string) => {
    setEmployees(prev => prev.filter(emp => emp.id !== id));
    setAssignments(prev => prev.filter(a => a.employeeId !== id));
    setSuccessMsg(`"${name}" silindi.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Hücre Değeri Değiştirme (Manuel Düzenleme)
  const handleCellChange = (employeeId: string, dayIndex: number, shiftType: ShiftType) => {
    setAssignments(prev => prev.map(a => {
      if (a.employeeId === employeeId && a.dayIndex === dayIndex) {
        return {
          ...a,
          shiftType,
          isLocked: true // Manuel müdahalelerde hücre kilitlenir
        };
      }
      return a;
    }));
  };

  // Hücre Kilit Durumunu Değiştirme
  const handleToggleLock = (employeeId: string, dayIndex: number) => {
    setAssignments(prev => prev.map(a => {
      if (a.employeeId === employeeId && a.dayIndex === dayIndex) {
        return { ...a, isLocked: !a.isLocked };
      }
      return a;
    }));
  };

  // Otomatik Vardiya Çizelgeleme Algoritmasını Çalıştırma
  const handleAutoPlan = () => {
    setErrorMsg(null);
    const locked = assignments.filter(a => a.isLocked);
    
    // Algoritmayı çalıştır
    const result = autoPlanShifts(employees, locked, settings, ohsConfig, requirements, monthDays);

    if (result) {
      setAssignments(result);
      setSuccessMsg(`${MONTH_NAMES[selectedMonth]} ${selectedYear} vardiya planı başarıyla oluşturuldu!`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      setErrorMsg('Mevcut İSG kısıtlamaları ve manuel kilitler kapsamında geçerli bir çizelge bulunamadı. Lütfen kilitleri azaltmayı veya çalışan sayısını artırmayı deneyin.');
    }
  };

  // Sadece Kilitli Olmayanları Sıfırla (Temizle)
  const handleResetDraft = () => {
    setAssignments(prev => prev.map(a => {
      if (a.isLocked) return a;
      return { ...a, shiftType: 'off' };
    }));
    setErrorMsg(null);
  };

  // Tümünü Sıfırla (Kilitleri de Kaldır)
  const handleResetAll = () => {
    setAssignments(prev => prev.map(a => ({
      ...a,
      shiftType: 'off',
      isLocked: false
    })));
    setErrorMsg(null);
    setSuccessMsg('Tüm çizelge ve kilitler sıfırlandı.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Excel İçin Panoya Kopyalama (Zengin HTML ve TSV Desteği)
  const handleCopyToClipboard = () => {
    // Gerçek tarihleri hesapla (Örn: 01.06.2026)
    const realDates = monthDays.map(d => {
      const dayStr = d.date < 10 ? '0' + d.date : d.date;
      const monthVal = selectedMonth + 1;
      const monthStr = monthVal < 10 ? '0' + monthVal : monthVal;
      return `${dayStr}.${monthStr}.${selectedYear}`;
    });

    // TSV Formatı (Düz metin) - İstek üzerine sol üst "Çalışan" yazısı kaldırıldı ve saat aralıkları eklendi
    const headersTsv = ['', ...realDates];
    const rowsTsv = employees.map(emp => {
      const empRow = [emp.name];
      for (let d = 0; d < monthDays.length; d++) {
        const assign = assignments.find(a => a.employeeId === emp.id && a.dayIndex === d);
        const type = assign ? assign.shiftType : 'off';
        let label = 'İzin';
        if (type === 'morning') label = `${settings.morning.start} - ${settings.morning.end}`;
        if (type === 'afternoon') label = `${settings.afternoon.start} - ${settings.afternoon.end}`;
        if (type === 'night') label = `${settings.night.start} - ${settings.night.end}`;
        empRow.push(label);
      }
      return empRow.join('\t');
    });
    const tsvContent = [headersTsv.join('\t'), ...rowsTsv].join('\n');

    // Excel/Google Sheets için Renkli, Otomatik Genişlikli ve Yüksek Okunabilirlikli HTML Formatı (Saat aralıklı)
    const tableWidth = 180 + monthDays.length * 140;

    const colGroupHtml = `
      <colgroup>
        <col width="180" style="mso-width-source:userset;width:135pt;" />
        ${monthDays.map(() => `<col width="140" style="mso-width-source:userset;width:105pt;" />`).join('')}
      </colgroup>
    `;

    const headersHtml = `
      <tr style="background-color: #f1f3f4; height: 25pt;">
        <th class="cell-header" width="180" style="mso-width-source:userset;width:135pt;min-width:180px;border:1px solid #a1a1aa;padding:6px 10px;text-align:left;font-weight:bold;background-color:#f1f3f4;color:#202124;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;white-space:nowrap;"></th>
        ${realDates.map(date => `<th class="cell-header" width="140" style="mso-width-source:userset;width:105pt;min-width:140px;border:1px solid #a1a1aa;padding:6px 10px;text-align:center;font-weight:bold;background-color:#f1f3f4;color:#202124;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;white-space:nowrap;">${date}</th>`).join('')}
      </tr>
    `;

    const rowsHtml = employees.map(emp => {
      const cellsHtml = monthDays.map((_, dIdx) => {
        const assign = assignments.find(a => a.employeeId === emp.id && a.dayIndex === dIdx);
        const type = assign ? assign.shiftType : 'off';
        
        let label = 'İzin';
        let bgColor = '#edf2f7'; // soft cool gray (gray-100)
        let textColor = '#4a5568'; // slate gray
        let isBold = 'normal';

        if (type === 'morning') {
          label = `${settings.morning.start} - ${settings.morning.end}`;
          bgColor = '#c6f6d5'; // distinct emerald-100 green
          textColor = '#1c452e'; // dark forest green
          isBold = 'bold';
        } else if (type === 'afternoon') {
          label = `${settings.afternoon.start} - ${settings.afternoon.end}`;
          bgColor = '#fef08a'; // distinct amber-200 yellow
          textColor = '#744210'; // dark brown/amber
          isBold = 'bold';
        } else if (type === 'night') {
          label = `${settings.night.start} - ${settings.night.end}`;
          bgColor = '#18181b'; // deep zinc-900 black
          textColor = '#ffffff'; // white
          isBold = 'bold';
        }

        return `
          <td class="cell-shift" width="140" style="mso-width-source:userset;width:105pt;min-width:140px;border:1px solid #a1a1aa;padding:6px 10px;text-align:center;font-weight:${isBold};background-color:${bgColor};color:${textColor};font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;white-space:nowrap;">
            ${label}
          </td>
        `;
      }).join('');

      return `
        <tr style="height: 25pt;">
          <td class="cell-emp" width="180" style="mso-width-source:userset;width:135pt;min-width:180px;border:1px solid #a1a1aa;padding:6px 10px;text-align:left;font-weight:bold;background-color:#ffffff;color:#202124;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;white-space:nowrap;">
            ${emp.name}
          </td>
          ${cellsHtml}
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <style>
          <!--
          table {
            border-collapse: collapse;
          }
          .cell-header {
            mso-width-source: userset;
          }
          .cell-emp {
            mso-width-source: userset;
          }
          .cell-shift {
            mso-width-source: userset;
          }
          -->
        </style>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${MONTH_NAMES[selectedMonth]} ${selectedYear}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body>
        <table style="border-collapse:collapse;table-layout:fixed;width:${tableWidth}px;" width="${tableWidth}">
          ${colGroupHtml}
          <thead>
            ${headersHtml}
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Clipboard API ile HTML ve Düz metni beraber kopyala
    try {
      const blobHtml = new Blob([htmlContent], { type: 'text/html' });
      const blobText = new Blob([tsvContent], { type: 'text/plain' });
      const data = [
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText
        })
      ];

      navigator.clipboard.write(data)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        })
        .catch(() => {
          // write fallback
          navigator.clipboard.writeText(tsvContent)
            .then(() => {
              setCopySuccess(true);
              setTimeout(() => setCopySuccess(false), 3000);
            });
        });
    } catch {
      // genel fallback
      navigator.clipboard.writeText(tsvContent)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        });
    }
  };

  // --- STATS CALCULATION ---
  // Çalışan bazında toplam çalışma saatleri ve izin günleri hesabı
  const employeeStats = useMemo(() => {
    const stats: Record<string, { workHours: number; offDays: number }> = {};
    
    employees.forEach(emp => {
      stats[emp.id] = { workHours: 0, offDays: 0 };
    });

    assignments.forEach(a => {
      if (!stats[a.employeeId] || a.dayIndex >= monthDays.length) return;

      if (a.shiftType === 'off') {
        stats[a.employeeId].offDays++;
      } else {
        const duration = getShiftDuration(settings[a.shiftType].start, settings[a.shiftType].end);
        stats[a.employeeId].workHours += duration;
      }
    });

    return stats;
  }, [employees, assignments, settings, monthDays]);

  // Vardiya saatleri kontrolü (İSG Süreleri)
  const shiftDurations = useMemo(() => {
    return {
      morning: getShiftDuration(settings.morning.start, settings.morning.end),
      afternoon: getShiftDuration(settings.afternoon.start, settings.afternoon.end),
      night: getShiftDuration(settings.night.start, settings.night.end)
    };
  }, [settings]);

  // Hücrelerin renklendirme sınıflarını döndürür
  const getShiftBadgeStyles = (type: ShiftType, isViolating: boolean) => {
    let baseClass = "w-full text-xs font-semibold px-2 py-1.5 rounded border transition-all duration-200 cursor-pointer ";
    
    if (isViolating) {
      baseClass += "ring-2 ring-red-500 border-red-500 ";
    }

    switch (type) {
      case 'morning':
        return baseClass + "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
      case 'afternoon':
        return baseClass + "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50";
      case 'night':
        return baseClass + "bg-zinc-950 text-zinc-50 border-zinc-800 hover:bg-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800";
      case 'off':
        return baseClass + "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200/80 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-800/70";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white dark:bg-zinc-950 dark:text-zinc-100">
      
      {/* --- HEADER --- */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-30 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="h-9 w-9 rounded-lg bg-zinc-950 flex items-center justify-center text-white dark:bg-zinc-100 dark:text-zinc-900">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">İSG Aylık Vardiya Planlayıcı</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Yasal mevzuat uyumlu dinamik aylık çizelgeleme</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            
            {/* AY / YIL SEÇİCİLER */}
            <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg dark:bg-zinc-850">
              <Calendar className="h-4 w-4 text-zinc-500 ml-2" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent border-0 text-sm font-semibold py-1 px-2 focus:ring-0 focus:outline-hidden cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent border-0 text-sm font-semibold py-1 px-2 focus:ring-0 focus:outline-hidden cursor-pointer"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-200 ${
                isSettingsOpen 
                  ? 'bg-zinc-100 border-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100' 
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Ayarlar & Kurallar</span>
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN LAYOUT --- */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* LEFT COLUMN: MAIN WORKSPACE */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          
          {/* CONTROL TOASTS */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Planlama Hatası</h3>
                <p className="text-xs mt-1 text-red-700 dark:text-red-400/80">{errorMsg}</p>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 dark:bg-zinc-100 dark:text-zinc-900">
              <Check className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400 dark:text-emerald-600" />
              <p className="text-sm font-medium flex-1">{successMsg}</p>
              <button onClick={() => setSuccessMsg(null)} className="text-zinc-400 hover:text-zinc-200 dark:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* DYNAMIC VIOLATIONS LOG (TABLE OVERVIEW) */}
          {violations.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 dark:bg-amber-950/10 dark:border-amber-900/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="font-bold text-sm text-amber-800 dark:text-amber-400">
                  {MONTH_NAMES[selectedMonth]} Ayı İSG & Plan Uyarıları ({violations.length})
                </h3>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-2">
                {violations.map((v, idx) => (
                  <div key={idx} className="text-xs text-amber-800/90 flex gap-1.5 dark:text-amber-400/90">
                    <span>•</span>
                    <span>{v.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MAIN ACTIONS BAR */}
          <div className="bg-white p-4 rounded-xl border border-zinc-200 flex flex-wrap gap-4 items-center justify-between dark:bg-zinc-900 dark:border-zinc-800 shadow-xs">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleAutoPlan}
                className="bg-zinc-950 text-white hover:bg-zinc-800 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-sm dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Sparkles className="h-4 w-4" />
                Otomatik Planla
              </button>
              
              <button
                onClick={handleResetDraft}
                className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" />
                Taslağı Temizle
              </button>

              <button
                onClick={handleResetAll}
                className="bg-white border border-zinc-200 hover:bg-zinc-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800"
              >
                Tümünü Sıfırla
              </button>
            </div>

            <button
              onClick={handleCopyToClipboard}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                copySuccess 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Clipboard className="h-4 w-4" />
              {copySuccess ? 'Kopyalandı!' : 'Panoya Kopyala (Excel İçin)'}
            </button>
          </div>

          {/* GRID TABLE CONTAINER */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs dark:bg-zinc-900 dark:border-zinc-800">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full border-collapse text-left table-fixed">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800">
                    {/* Sabit sütun */}
                    <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-40 sticky left-0 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-850 z-20">
                      Çalışan
                    </th>
                    {monthDays.map((day, idx) => (
                      <th 
                        key={idx} 
                        className={`p-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center w-[130px] ${
                          day.isWeekend ? 'bg-zinc-150/40 dark:bg-zinc-800/40' : ''
                        }`}
                      >
                        {day.formattedLabel}
                      </th>
                    ))}
                    <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-24 bg-zinc-50 dark:bg-zinc-900 z-10">
                      Toplam Süre
                    </th>
                    <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-20 bg-zinc-50 dark:bg-zinc-900 z-10">
                      İzin
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={monthDays.length + 3} className="p-8 text-center text-sm text-zinc-500">
                        Henüz çalışan eklenmemiş. Aşağıdaki panelden çalışan ekleyebilirsiniz.
                      </td>
                    </tr>
                  ) : (
                    employees.map(emp => {
                      const stats = employeeStats[emp.id] || { workHours: 0, offDays: 0 };
                      return (
                        <tr key={emp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                          
                          {/* Sabit Sütun (Çalışan İsmi) */}
                          <td className="p-3 font-semibold text-sm text-zinc-900 sticky left-0 bg-white dark:bg-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-850 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center justify-between group">
                              <span className="truncate max-w-[100px]">{emp.name}</span>
                              <button
                                onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                title="Çalışanı Sil"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Günler */}
                          {monthDays.map((day, dIdx) => {
                            const assign = assignments.find(a => a.employeeId === emp.id && a.dayIndex === dIdx);
                            const shiftType = assign ? assign.shiftType : 'off';
                            const isLocked = assign ? assign.isLocked : false;
                            
                            const key = `${emp.id}-${dIdx}`;
                            const cellViolations = cellViolationsMap[key] || [];
                            const isViolating = cellViolations.length > 0;

                            return (
                              <td key={dIdx} className={`p-1.5 min-w-[130px] ${day.isWeekend ? 'bg-zinc-50/40 dark:bg-zinc-800/10' : ''}`}>
                                <div className="relative group">
                                  
                                  {/* Hücre Seçim Menüsü */}
                                  <select
                                    value={shiftType}
                                    onChange={(e) => handleCellChange(emp.id, dIdx, e.target.value as ShiftType)}
                                    className={getShiftBadgeStyles(shiftType, isViolating)}
                                    title={isViolating ? cellViolations.map(v => v.message).join('\n') : undefined}
                                  >
                                    <option value="morning">Sabah</option>
                                    <option value="afternoon">Öğle</option>
                                    <option value="night">Gece</option>
                                    <option value="off">İzin</option>
                                  </select>

                                  {/* Kilit İkonu */}
                                  <button
                                    onClick={() => handleToggleLock(emp.id, dIdx)}
                                    className={`absolute -top-1 -right-1 p-0.5 rounded-full border bg-white shadow-xs transition-opacity duration-200 ${
                                      isLocked 
                                        ? 'border-zinc-800 text-zinc-900 opacity-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100' 
                                        : 'border-zinc-200 text-zinc-400 opacity-0 group-hover:opacity-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:text-zinc-300'
                                    }`}
                                    title={isLocked ? 'Hücre Kilitli' : 'Hücreyi Kilitle'}
                                  >
                                    {isLocked ? (
                                      <Lock className="h-2 w-2" />
                                    ) : (
                                      <Unlock className="h-2 w-2" />
                                    )}
                                  </button>

                                  {/* İhlal Uyarı İkonu */}
                                  {isViolating && (
                                    <div 
                                      className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 flex items-center justify-center text-white cursor-help"
                                      title={cellViolations.map(v => v.message).join('\n')}
                                    >
                                      <span className="text-[9px] font-bold">!</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Toplam Süre */}
                          <td className="p-3 text-right font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                            {stats.workHours.toFixed(1)} sa
                          </td>

                          {/* İzin */}
                          <td className="p-3 text-right font-semibold text-xs text-zinc-500">
                            <span>{stats.offDays} gün</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* EMPLOYEE ADDITION CARD */}
          <div className="bg-white p-5 rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs">
            <h3 className="font-bold text-sm mb-3 text-zinc-800 dark:text-zinc-200">Çalışan Yönetimi</h3>
            <form onSubmit={handleAddEmployee} className="flex gap-2 max-w-md">
              <input
                type="text"
                value={employeeInput}
                onChange={(e) => setEmployeeInput(e.target.value)}
                placeholder="Çalışan Adı Soyadı"
                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800/50 dark:border-zinc-700 dark:focus:ring-zinc-300"
              />
              <button
                type="submit"
                className="bg-zinc-950 text-white hover:bg-zinc-855 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <UserPlus className="h-4 w-4" />
                Ekle
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: SIDEBAR SETTINGS & RULES */}
        {isSettingsOpen && (
          <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
            
            {/* SHIFT HOURS CARD */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4 text-zinc-500" />
                  Standart Saatler
                </h3>
              </div>

              <div className="space-y-4">
                {/* Sabah Vardiyası */}
                <div>
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">Sabah Vardiyası (Yeşil)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-400">Başlangıç</span>
                      <input
                        type="text"
                        value={settings.morning.start}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          morning: { ...prev.morning, start: e.target.value }
                        }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400">Bitiş</span>
                      <input
                        type="text"
                        value={settings.morning.end}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          morning: { ...prev.morning, end: e.target.value }
                        }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Süre: {shiftDurations.morning.toFixed(1)} saat</span>
                </div>

                {/* Öğle Vardiyası */}
                <div>
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">Öğle Vardiyası (Sarı)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-400">Başlangıç</span>
                      <input
                        type="text"
                        value={settings.afternoon.start}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          afternoon: { ...prev.afternoon, start: e.target.value }
                        }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400">Bitiş</span>
                      <input
                        type="text"
                        value={settings.afternoon.end}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          afternoon: { ...prev.afternoon, end: e.target.value }
                        }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Süre: {shiftDurations.afternoon.toFixed(1)} saat</span>
                </div>

                {/* Gece Vardiyası */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Gece Vardiyası (Siyah)</label>
                    {shiftDurations.night > ohsConfig.maxNightShiftHours && (
                      <span className="text-[10px] font-bold text-red-500">7.5 saati aşıyor!</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-400">Başlangıç</span>
                      <input
                        type="text"
                        value={settings.night.start}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          night: { ...prev.night, start: e.target.value }
                        }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400">Bitiş</span>
                      <input
                        type="text"
                        value={settings.night.end}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          night: { ...prev.night, end: e.target.value }
                        }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Süre: {shiftDurations.night.toFixed(1)} saat</span>
                </div>
              </div>
            </div>

            {/* OPERATIONAL REQUIREMENTS CARD */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs">
              <h3 className="font-bold text-sm mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                <Info className="h-4 w-4 text-zinc-500" />
                Günlük Vardiya İhtiyacı
              </h3>
              <p className="text-xs text-zinc-500 mb-4">Her gün ilgili vardiyada bulunması gereken minimum çalışan sayıları.</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Sabah Vardiyası:</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={requirements.morning}
                    onChange={(e) => setRequirements(prev => ({ ...prev, morning: Math.max(0, Number(e.target.value)) }))}
                    className="w-16 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs text-right focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Öğle Vardiyası:</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={requirements.afternoon}
                    onChange={(e) => setRequirements(prev => ({ ...prev, afternoon: Math.max(0, Number(e.target.value)) }))}
                    className="w-16 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs text-right focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Gece Vardiyası:</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={requirements.night}
                    onChange={(e) => setRequirements(prev => ({ ...prev, night: Math.max(0, Number(e.target.value)) }))}
                    className="w-16 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs text-right focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                  />
                </div>
              </div>
            </div>

            {/* OHS RULES & COMPLIANCE RULES */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs">
              <h3 className="font-bold text-sm mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                İSG Kısıtları (Kanun & İSG)
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[10px] font-bold font-mono">1</div>
                  <div>
                    <h4 className="text-xs font-semibold">Haftalık 2 Gün İzin</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Her takvim haftasında (Pazartesi-Pazar) en az 2 gün izin yapılması zorunludur.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[10px] font-bold font-mono">2</div>
                  <div>
                    <h4 className="text-xs font-semibold">11 Saat Kesintisiz Dinlenme</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Vardiya geçişlerinde iki mesai arasında en az 11 saat kesintisiz dinlenme süresi sağlanmalıdır.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[10px] font-bold font-mono">3</div>
                  <div>
                    <h4 className="text-xs font-semibold">Gece Sınırı (7.5 Saat)</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">İş kanununa göre gece çalışmaları 7.5 saati aşamaz. Aşarsa sistem uyarı üretir.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[10px] font-bold font-mono">4</div>
                  <div>
                    <h4 className="text-xs font-semibold">Gece Rotasyon Sınırı</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Bir çalışan arka arkaya en fazla {ohsConfig.maxConsecutiveNightShifts} gece çalışabilir, ardından rotasyona tabi tutulur.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[10px] font-bold font-mono">5</div>
                  <div>
                    <h4 className="text-xs font-semibold">Günlük Maksimum Mesai</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Bir çalışanın günlük toplam çalışma süresi 11 saati hiçbir koşulda aşamaz.</p>
                  </div>
                </div>
              </div>
            </div>

          </aside>
        )}

      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-zinc-200 bg-white mt-auto dark:bg-zinc-900 dark:border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
          <span>
            <a 
              href="https://semihaydin.dev" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-zinc-900 transition-colors underline underline-offset-4 dark:hover:text-zinc-100"
            >
              semih aydın tarafından yapılmıştır.
            </a>
          </span>
        </div>
      </footer>

    </div>
  );
}
