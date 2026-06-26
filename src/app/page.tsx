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
  Calendar,
  ChevronDown,
  Download,
  CalendarDays,
  FileText,
  AlertOctagon,
  Edit2
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
  MonthDay,
  EmployeePreference
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

// Türkiye Sabit Resmi Tatilleri Yardımcı Fonksiyonu
const getTurkishHolidays = (month: number, year: number): number[] => {
  const holidays: number[] = [];
  if (month === 0) holidays.push(1); // 1 Ocak
  if (month === 3) holidays.push(23); // 23 Nisan
  if (month === 4) holidays.push(1); // 1 Mayıs
  if (month === 4) holidays.push(19); // 19 Mayıs
  if (month === 6) holidays.push(15); // 15 Temmuz
  if (month === 7) holidays.push(30); // 30 Ağustos
  if (month === 9) holidays.push(29); // 29 Ekim

  // 2026 ve 2027 yılları için Dini Bayram Tahminleri
  if (year === 2026) {
    if (month === 2) holidays.push(20, 21, 22); // Ramazan Bayramı
    if (month === 4) holidays.push(27, 28, 29, 30); // Kurban Bayramı
  } else if (year === 2027) {
    if (month === 2) holidays.push(9, 10, 11);
    if (month === 4) holidays.push(16, 17, 18, 19);
  }
  return holidays;
};

export default function ShiftPlannerPage() {
  // --- STATE ---
  const [employees, setEmployees] = useState<Employee[]>([
    { id: '1', name: 'Ahmet Yılmaz', isNightRestricted: false },
    { id: '2', name: 'Ayşe Kaya', isNightRestricted: false },
    { id: '3', name: 'Mehmet Demir', isNightRestricted: false },
    { id: '4', name: 'Fatma Çelik', isNightRestricted: false },
    { id: '5', name: 'Mustafa Şahin', isNightRestricted: false }
  ]);

  const [selectedMonth, setSelectedMonth] = useState<number>(5); // Haziran (5)
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, ShiftAssignment[]>>({});
  const [preferencesMap, setPreferencesMap] = useState<Record<string, EmployeePreference[]>>({});
  const [publicHolidaysMap, setPublicHolidaysMap] = useState<Record<string, number[]>>({});

  const [settings, setSettings] = useState<ShiftSettings>(DEFAULT_SHIFT_SETTINGS);
  const [ohsConfig, setOhsConfig] = useState<OHSConfig>(DEFAULT_OHS_CONFIG);
  const [requirements, setRequirements] = useState<Record<Exclude<ShiftType, 'off'>, number>>({
    morning: 1,
    afternoon: 1,
    night: 1
  });

  const [employeeInput, setEmployeeInput] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'settings' | 'preferences'>('settings');
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sekme Form Durumları
  const [leaveEmpId, setLeaveEmpId] = useState<string>('');
  const [leaveStart, setLeaveStart] = useState<number>(1);
  const [leaveEnd, setLeaveEnd] = useState<number>(1);

  const [prefEmpId, setPrefEmpId] = useState<string>('');
  const [prefDay, setPrefDay] = useState<number>(1);
  const [prefType, setPrefType] = useState<'preferred' | 'disliked'>('preferred');
  const [prefShift, setPrefShift] = useState<ShiftType>('morning');

  // localstorage yükleme kilidi
  const [isLoaded, setIsLoaded] = useState(false);

  // Çalışan İsmi Düzenleme Durumları
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editingEmpName, setEditingEmpName] = useState<string>('');

  // Yıllık İzin Modali Durumları
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveModalEmpId, setLeaveModalEmpId] = useState<string | null>(null);
  const [leaveModalStart, setLeaveModalStart] = useState<number>(1);
  const [leaveModalEnd, setLeaveModalEnd] = useState<number>(1);

  // --- DYNAMIC MONTH KEYS ---
  const currentMonthKey = `${selectedYear}-${selectedMonth}`;

  const monthDays = useMemo(() => {
    return getMonthDays(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // --- DERIVED MONTHLY STATES ---
  const assignments = useMemo(() => {
    return assignmentsMap[currentMonthKey] || [];
  }, [assignmentsMap, currentMonthKey]);

  const preferences = useMemo(() => {
    return preferencesMap[currentMonthKey] || [];
  }, [preferencesMap, currentMonthKey]);

  const activeHolidays = useMemo(() => {
    if (publicHolidaysMap[currentMonthKey] !== undefined) {
      return publicHolidaysMap[currentMonthKey];
    }
    return getTurkishHolidays(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, publicHolidaysMap, currentMonthKey]);

  // --- LOCALSTORAGE PERSISTENCE (HYDRATION SAFE) ---
  useEffect(() => {
    try {
      const storedEmployees = localStorage.getItem('vp_employees');
      const storedSettings = localStorage.getItem('vp_settings');
      const storedOhs = localStorage.getItem('vp_ohs');
      const storedReqs = localStorage.getItem('vp_reqs');
      const storedMonth = localStorage.getItem('vp_month');
      const storedYear = localStorage.getItem('vp_year');
      const storedAssignmentsMap = localStorage.getItem('vp_assignments_map');
      const storedPreferencesMap = localStorage.getItem('vp_preferences_map');
      const storedHolidaysMap = localStorage.getItem('vp_holidays_map');

      if (storedEmployees) setEmployees(JSON.parse(storedEmployees));
      if (storedSettings) setSettings(JSON.parse(storedSettings));
      if (storedOhs) setOhsConfig(JSON.parse(storedOhs));
      if (storedReqs) setRequirements(JSON.parse(storedReqs));
      if (storedMonth) setSelectedMonth(Number(storedMonth));
      if (storedYear) setSelectedYear(Number(storedYear));
      if (storedAssignmentsMap) setAssignmentsMap(JSON.parse(storedAssignmentsMap));
      if (storedPreferencesMap) setPreferencesMap(JSON.parse(storedPreferencesMap));
      if (storedHolidaysMap) setPublicHolidaysMap(JSON.parse(storedHolidaysMap));
    } catch (e) {
      console.error('Error loading state from localStorage', e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('vp_employees', JSON.stringify(employees));
  }, [employees, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('vp_settings', JSON.stringify(settings));
  }, [settings, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('vp_ohs', JSON.stringify(ohsConfig));
  }, [ohsConfig, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('vp_reqs', JSON.stringify(requirements));
  }, [requirements, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('vp_month', selectedMonth.toString());
  }, [selectedMonth, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('vp_year', selectedYear.toString());
  }, [selectedYear, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('vp_assignments_map', JSON.stringify(assignmentsMap));
  }, [assignmentsMap, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('vp_preferences_map', JSON.stringify(preferencesMap));
  }, [preferencesMap, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('vp_holidays_map', JSON.stringify(publicHolidaysMap));
  }, [publicHolidaysMap, isLoaded]);

  // --- INITIALIZE/SYNC MONTHLY ASSIGNMENTS ---
  useEffect(() => {
    if (!isLoaded || monthDays.length === 0) return;

    if (!assignmentsMap[currentMonthKey] || assignmentsMap[currentMonthKey].length === 0) {
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
      setAssignmentsMap(prev => ({
        ...prev,
        [currentMonthKey]: initialAssignments
      }));
    } else {
      // Çalışan listesi ile çizelgeyi eşitle
      const existing = assignmentsMap[currentMonthKey];
      const existingEmpIds = new Set(existing.map(a => a.employeeId));
      const currentEmpIds = new Set(employees.map(e => e.id));

      let updated = [...existing];
      let changed = false;

      // Silinen çalışanları temizle
      const filtered = updated.filter(a => currentEmpIds.has(a.employeeId));
      if (filtered.length !== updated.length) {
        updated = filtered;
        changed = true;
      }

      // Yeni eklenenleri tanımla
      employees.forEach(emp => {
        if (!existingEmpIds.has(emp.id)) {
          for (let d = 0; d < monthDays.length; d++) {
            updated.push({
              employeeId: emp.id,
              dayIndex: d,
              shiftType: 'off',
              isLocked: false
            });
          }
          changed = true;
        }
      });

      if (changed) {
        setAssignmentsMap(prev => ({
          ...prev,
          [currentMonthKey]: updated
        }));
      }
    }
  }, [currentMonthKey, employees, monthDays, isLoaded]);

  // Form elemanları için varsayılan çalışanları seç
  useEffect(() => {
    if (employees.length > 0) {
      if (!leaveEmpId || !employees.some(e => e.id === leaveEmpId)) {
        setLeaveEmpId(employees[0].id);
      }
      if (!prefEmpId || !employees.some(e => e.id === prefEmpId)) {
        setPrefEmpId(employees[0].id);
      }
    }
  }, [employees]);

  // --- DYNAMIC OHS VIOLATIONS ---
  const violations = useMemo(() => {
    return checkScheduleViolations(employees, assignments, settings, ohsConfig, requirements, monthDays, activeHolidays);
  }, [employees, assignments, settings, ohsConfig, requirements, monthDays, activeHolidays]);

  // Hücre bazlı ihlal eşleştirmesi
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

  // --- HANDLERS ---

  // Resmi Tatil İşaretleme
  const handleTogglePublicHoliday = (dayDate: number) => {
    const currentList = activeHolidays;
    let newList: number[];
    if (currentList.includes(dayDate)) {
      newList = currentList.filter(d => d !== dayDate);
    } else {
      newList = [...currentList, dayDate];
    }
    setPublicHolidaysMap(prev => ({
      ...prev,
      [currentMonthKey]: newList
    }));
  };

  // Çalışan Ekleme
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const name = employeeInput.trim();
    if (!name) return;

    const newEmp: Employee = {
      id: Date.now().toString(),
      name,
      isNightRestricted: false
    };

    setEmployees(prev => [...prev, newEmp]);
    setEmployeeInput('');
    setSuccessMsg(`"${name}" başarıyla eklendi.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Çalışan Silme
  const handleDeleteEmployee = (id: string, name: string) => {
    setEmployees(prev => prev.filter(emp => emp.id !== id));
    
    // assignmentsMap içindeki tüm aylardan bu çalışanı temizle
    setAssignmentsMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        updated[k] = updated[k].filter(a => a.employeeId !== id);
      });
      return updated;
    });

    // preferencesMap içindeki tüm aylardan temizle
    setPreferencesMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        updated[k] = updated[k].filter(p => p.employeeId !== id);
      });
      return updated;
    });

    setSuccessMsg(`"${name}" silindi.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Gece Vardiyası Kısıtlaması Değiştirme
  const handleToggleNightRestriction = (employeeId: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === employeeId) {
        return { ...emp, isNightRestricted: !emp.isNightRestricted };
      }
      return emp;
    }));
  };

  // Çalışan İsmi Düzenleme
  const handleRenameEmployee = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setEmployees(prev => prev.map(emp => {
      if (emp.id === id) {
        return { ...emp, name: trimmed };
      }
      return emp;
    }));
    setEditingEmpId(null);
    setSuccessMsg(`Çalışan ismi "${trimmed}" olarak güncellendi.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Yıllık İzin Girişi Yap (Modal)
  const handleApplyModalLeave = () => {
    if (!leaveModalEmpId) return;

    const startIdx = Math.min(leaveModalStart, leaveModalEnd) - 1;
    const endIdx = Math.max(leaveModalStart, leaveModalEnd) - 1;

    setAssignmentsMap(prev => {
      const current = prev[currentMonthKey] || [];
      const updated = current.map(a => {
        if (a.employeeId === leaveModalEmpId && a.dayIndex >= startIdx && a.dayIndex <= endIdx) {
          return {
            ...a,
            shiftType: 'off' as ShiftType,
            isLocked: true // İzin günü olarak kilitle
          };
        }
        return a;
      });
      return { ...prev, [currentMonthKey]: updated };
    });

    setIsLeaveModalOpen(false);
    const empName = employees.find(e => e.id === leaveModalEmpId)?.name || 'Çalışan';
    setSuccessMsg(`${empName} için ${startIdx + 1} - ${endIdx + 1} tarihleri arasında izin kaydedildi.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Çalışanın tüm izinlerini ve kilitlerini temizle
  const handleRemoveAllLeavesForEmp = (empId: string) => {
    setAssignmentsMap(prev => {
      const current = prev[currentMonthKey] || [];
      const updated = current.map(a => {
        if (a.employeeId === empId) {
          return {
            ...a,
            shiftType: 'off' as ShiftType,
            isLocked: false // Kilitleri kaldır, izinleri sıfırla
          };
        }
        return a;
      });
      return { ...prev, [currentMonthKey]: updated };
    });

    setIsLeaveModalOpen(false);
    const empName = employees.find(e => e.id === empId)?.name || 'Çalışan';
    setSuccessMsg(`${empName} için bu ayki tüm kilitler ve izinler kaldırıldı.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Hücre Değeri Değiştirme (Manuel Düzenleme)
  const handleCellChange = (employeeId: string, dayIndex: number, shiftType: ShiftType) => {
    setAssignmentsMap(prev => {
      const current = prev[currentMonthKey] || [];
      const updated = current.map(a => {
        if (a.employeeId === employeeId && a.dayIndex === dayIndex) {
          return {
            ...a,
            shiftType,
            isLocked: true // Manuel olarak hücre kilitlenir
          };
        }
        return a;
      });
      return { ...prev, [currentMonthKey]: updated };
    });
  };

  // Hücre Kilit Durumunu Değiştirme
  const handleToggleLock = (employeeId: string, dayIndex: number) => {
    setAssignmentsMap(prev => {
      const current = prev[currentMonthKey] || [];
      const updated = current.map(a => {
        if (a.employeeId === employeeId && a.dayIndex === dayIndex) {
          return { ...a, isLocked: !a.isLocked };
        }
        return a;
      });
      return { ...prev, [currentMonthKey]: updated };
    });
  };

  // Otomatik Vardiya Çizelgeleme Algoritması
  const handleAutoPlan = () => {
    setErrorMsg(null);
    const currentAssignments = assignmentsMap[currentMonthKey] || [];
    const locked = currentAssignments.filter(a => a.isLocked);
    
    // Algoritmayı tercihleri de hesaba katacak şekilde çalıştır
    const result = autoPlanShifts(employees, locked, settings, ohsConfig, requirements, monthDays, preferences);

    if (result) {
      setAssignmentsMap(prev => ({
        ...prev,
        [currentMonthKey]: result
      }));
      setSuccessMsg(`${MONTH_NAMES[selectedMonth]} ${selectedYear} vardiya planı başarıyla oluşturuldu!`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      setErrorMsg('Mevcut İSG kısıtlamaları, kilitler veya özel durumlar kapsamında geçerli bir çizelge bulunamadı. Lütfen kilitleri / tercihleri azaltmayı veya çalışan sayısını artırmayı deneyin.');
    }
  };

  // Taslağı Temizle (Kilitlenmeyenleri Sıfırla)
  const handleResetDraft = () => {
    setAssignmentsMap(prev => {
      const current = prev[currentMonthKey] || [];
      const updated = current.map(a => {
        if (a.isLocked) return a;
        return { ...a, shiftType: 'off' as ShiftType };
      });
      return { ...prev, [currentMonthKey]: updated };
    });
    setErrorMsg(null);
  };

  // Tümünü Sıfırla (Kilitleri de kaldır)
  const handleResetAll = () => {
    setAssignmentsMap(prev => {
      const current = prev[currentMonthKey] || [];
      const updated = current.map(a => ({
        ...a,
        shiftType: 'off' as ShiftType,
        isLocked: false
      }));
      return { ...prev, [currentMonthKey]: updated };
    });
    setErrorMsg(null);
    setSuccessMsg('Tüm çizelge ve kilitler sıfırlandı.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Toplu Yıllık İzin / Rapor Tanımlama
  const handleApplyBulkLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveEmpId) return;

    const startIdx = Math.min(leaveStart, leaveEnd) - 1;
    const endIdx = Math.max(leaveStart, leaveEnd) - 1;

    setAssignmentsMap(prev => {
      const current = prev[currentMonthKey] || [];
      const updated = current.map(a => {
        if (a.employeeId === leaveEmpId && a.dayIndex >= startIdx && a.dayIndex <= endIdx) {
          return {
            ...a,
            shiftType: 'off' as ShiftType,
            isLocked: true // İzin günü olarak kilitle
          };
        }
        return a;
      });
      return { ...prev, [currentMonthKey]: updated };
    });

    const empName = employees.find(e => e.id === leaveEmpId)?.name || 'Çalışan';
    setSuccessMsg(`${empName} için ${startIdx + 1} - ${endIdx + 1} tarihleri arasında izin kilitlendi.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Çalışan Tercihi Ekleme
  const handleAddPreference = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefEmpId) return;

    const newPref: EmployeePreference = {
      employeeId: prefEmpId,
      dayIndex: prefDay - 1,
      preferenceType: prefType,
      shiftType: prefShift
    };

    // Aynı günde aynı çalışanın başka tercihi varsa üzerine yaz
    setPreferencesMap(prev => {
      const current = prev[currentMonthKey] || [];
      const filtered = current.filter(p => !(p.employeeId === prefEmpId && p.dayIndex === (prefDay - 1)));
      return {
        ...prev,
        [currentMonthKey]: [...filtered, newPref]
      };
    });

    const empName = employees.find(e => e.id === prefEmpId)?.name || 'Çalışan';
    const prefLabel = prefType === 'preferred' ? 'İstiyor' : 'İstemiyor';
    const shiftLabel = prefShift === 'off' ? 'İzin' : (prefShift === 'morning' ? 'Sabah' : (prefShift === 'afternoon' ? 'Öğle' : 'Gece'));
    
    setSuccessMsg(`${empName} - Gün ${prefDay}: ${shiftLabel} vardiyası ${prefLabel} tercihi eklendi.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Çalışan Tercihi Silme
  const handleRemovePreference = (employeeId: string, dayIndex: number) => {
    setPreferencesMap(prev => {
      const current = prev[currentMonthKey] || [];
      const filtered = current.filter(p => !(p.employeeId === employeeId && p.dayIndex === dayIndex));
      return {
        ...prev,
        [currentMonthKey]: filtered
      };
    });
  };

  // Excel İçin Panoya Kopyalama (Zengin HTML)
  const handleCopyToClipboard = () => {
    const realDates = monthDays.map(d => {
      const dayStr = d.date < 10 ? '0' + d.date : d.date;
      const monthVal = selectedMonth + 1;
      const monthStr = monthVal < 10 ? '0' + monthVal : monthVal;
      return `${dayStr}.${monthStr}.${selectedYear}`;
    });

    // TSV content
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

    // Rich HTML Template for Excel
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
        let bgColor = '#f3f4f6'; // gray-100
        let textColor = '#374151'; // gray-700
        let isBold = 'normal';

        if (type === 'morning') {
          label = `${settings.morning.start} - ${settings.morning.end}`;
          bgColor = '#059669'; // strong emerald green
          textColor = '#ffffff'; // white
          isBold = 'bold';
        } else if (type === 'afternoon') {
          label = `${settings.afternoon.start} - ${settings.afternoon.end}`;
          bgColor = '#d97706'; // strong amber orange
          textColor = '#ffffff'; // white
          isBold = 'bold';
        } else if (type === 'night') {
          label = `${settings.night.start} - ${settings.night.end}`;
          bgColor = '#111827'; // pure dark gray / black
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
          table { border-collapse: collapse; }
          .cell-header, .cell-emp, .cell-shift { mso-width-source: userset; }
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
          navigator.clipboard.writeText(tsvContent)
            .then(() => {
              setCopySuccess(true);
              setTimeout(() => setCopySuccess(false), 3000);
            });
        });
    } catch {
      navigator.clipboard.writeText(tsvContent)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        });
    }
  };

  // Excel Dosyası Olarak İndirme (.xls)
  const handleDownloadExcel = () => {
    const realDates = monthDays.map(d => {
      const dayStr = d.date < 10 ? '0' + d.date : d.date;
      const monthVal = selectedMonth + 1;
      const monthStr = monthVal < 10 ? '0' + monthVal : monthVal;
      return `${dayStr}.${monthStr}.${selectedYear}`;
    });

    const headersHtml = `
      <tr style="background-color: #f1f3f4;">
        <th style="border:1px solid #a1a1aa;padding:6px 10px;text-align:left;font-weight:bold;background-color:#f1f3f4;color:#202124;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;white-space:nowrap;"></th>
        ${realDates.map(date => `<th style="border:1px solid #a1a1aa;padding:6px 10px;text-align:center;font-weight:bold;background-color:#f1f3f4;color:#202124;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;white-space:nowrap;">${date}</th>`).join('')}
      </tr>
    `;

    const rowsHtml = employees.map(emp => {
      const cellsHtml = monthDays.map((_, dIdx) => {
        const assign = assignments.find(a => a.employeeId === emp.id && a.dayIndex === dIdx);
        const type = assign ? assign.shiftType : 'off';
        
        let label = 'İzin';
        let bgColor = '#f3f4f6';
        let textColor = '#374151';
        let isBold = 'normal';

        if (type === 'morning') {
          label = `${settings.morning.start} - ${settings.morning.end}`;
          bgColor = '#059669';
          textColor = '#ffffff';
          isBold = 'bold';
        } else if (type === 'afternoon') {
          label = `${settings.afternoon.start} - ${settings.afternoon.end}`;
          bgColor = '#d97706';
          textColor = '#ffffff';
          isBold = 'bold';
        } else if (type === 'night') {
          label = `${settings.night.start} - ${settings.night.end}`;
          bgColor = '#111827';
          textColor = '#ffffff';
          isBold = 'bold';
        }

        return `
          <td style="border:1px solid #a1a1aa;padding:6px 10px;text-align:center;font-weight:${isBold};background-color:${bgColor};color:${textColor};font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;white-space:nowrap;">
            ${label}
          </td>
        `;
      }).join('');

      return `
        <tr>
          <td style="border:1px solid #a1a1aa;padding:6px 10px;text-align:left;font-weight:bold;background-color:#ffffff;color:#202124;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;white-space:nowrap;">
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
        <table style="border-collapse:collapse;">
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

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vardiya_programi_${selectedYear}_${selectedMonth + 1}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- STATS CALCULATION ---
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

  const shiftDurations = useMemo(() => {
    return {
      morning: getShiftDuration(settings.morning.start, settings.morning.end),
      afternoon: getShiftDuration(settings.afternoon.start, settings.afternoon.end),
      night: getShiftDuration(settings.night.start, settings.night.end)
    };
  }, [settings]);

  // Badge Styles
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
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white dark:bg-zinc-950 dark:text-zinc-100 print:bg-white print:text-black">
      
      {/* --- HEADER --- */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-30 dark:bg-zinc-900 dark:border-zinc-800 print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="h-9 w-9 rounded-lg bg-zinc-950 flex items-center justify-center text-white dark:bg-zinc-100 dark:text-zinc-900">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">İSG Aylık Vardiya Planlayıcı</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Yasal mevzuat ve tercihler uyumlu dinamik çizelgeleme</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            
            {/* AY / YIL SEÇİCİLER */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Calendar className="absolute left-3 h-4 w-4 text-zinc-500 pointer-events-none" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="appearance-none bg-white border border-zinc-200 rounded-lg pl-9 pr-8 py-2 text-sm font-semibold hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-zinc-950 transition-colors cursor-pointer select-none"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 h-4 w-4 text-zinc-500 pointer-events-none" />
              </div>

              <div className="relative flex items-center">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="appearance-none bg-white border border-zinc-200 rounded-lg pl-4 pr-8 py-2 text-sm font-semibold hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-zinc-950 transition-colors cursor-pointer select-none"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 h-4 w-4 text-zinc-500 pointer-events-none" />
              </div>
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
              <span>Ayarlar & Tercihler</span>
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
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400 print:hidden">
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
            <div className="bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 dark:bg-zinc-100 dark:text-zinc-900 print:hidden">
              <Check className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400 dark:text-emerald-600" />
              <p className="text-sm font-medium flex-1">{successMsg}</p>
              <button onClick={() => setSuccessMsg(null)} className="text-zinc-400 hover:text-zinc-200 dark:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* DYNAMIC VIOLATIONS LOG (TABLE OVERVIEW) */}
          {violations.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 dark:bg-amber-950/10 dark:border-amber-900/30 print:hidden">
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
          <div className="bg-white p-4 rounded-xl border border-zinc-200 flex flex-wrap gap-4 items-center justify-between dark:bg-zinc-900 dark:border-zinc-800 shadow-xs print:hidden">
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

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadExcel}
                className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-800 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" />
                Excel İndir (.xls)
              </button>

              <button
                onClick={handleCopyToClipboard}
                className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                  copySuccess 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Clipboard className="h-4 w-4" />
                {copySuccess ? 'Kopyalandı!' : 'Panoya Kopyala'}
              </button>
            </div>
          </div>

          {/* GRID TABLE CONTAINER */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs dark:bg-zinc-900 dark:border-zinc-800 print:border-none print:shadow-none">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full border-collapse text-left table-fixed">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800">
                    <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-40 sticky left-0 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-850 z-20">
                      Çalışan
                    </th>
                    {monthDays.map((day, idx) => {
                      const isHoliday = activeHolidays.includes(day.date);
                      return (
                        <th 
                          key={idx} 
                          onClick={() => handleTogglePublicHoliday(day.date)}
                          className={`p-3 text-[10px] font-bold uppercase tracking-wider text-center w-[130px] cursor-pointer transition-colors select-none ${
                            isHoliday 
                              ? 'bg-red-50 text-red-700 hover:bg-red-100 border-b-2 border-red-500 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/10' 
                              : (day.isWeekend ? 'bg-zinc-150/40 text-zinc-500 hover:bg-zinc-200/50 dark:bg-zinc-800/40' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/40')
                          }`}
                          title="Resmi Tatil olarak işaretlemek/kaldırmak için tıklayın"
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{day.formattedLabel}</span>
                            {isHoliday && (
                              <span className="text-[8px] bg-red-100 text-red-800 px-1 py-0.2 rounded font-medium dark:bg-red-900/50 dark:text-red-300 scale-90">
                                Tatil
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
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
                              <span className="truncate max-w-[100px] flex items-center gap-1.5">
                                {emp.name}
                                {emp.isNightRestricted && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="Gece Vardiyası Yasak!" />
                                )}
                              </span>
                              <button
                                onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 print:hidden"
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

                            // Hücre bazlı tercih kontrolü (küçük soft göstergeler)
                            const cellPref = preferences.find(p => p.employeeId === emp.id && p.dayIndex === dIdx);

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
                                    className={`absolute -top-1 -right-1 p-0.5 rounded-full border bg-white shadow-xs transition-opacity duration-205 print:hidden ${
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

                                  {/* Tercih Belirteci */}
                                  {cellPref && (
                                    <div 
                                      className={`absolute -top-1 -left-1 h-2 w-2 rounded-full ${
                                        cellPref.preferenceType === 'preferred' ? 'bg-emerald-500' : 'bg-red-500'
                                      }`}
                                      title={`Çalışan Tercihi: ${cellPref.shiftType === 'off' ? 'İzin' : cellPref.shiftType} ${cellPref.preferenceType === 'preferred' ? 'istiyor' : 'istemiyor'}`}
                                    />
                                  )}

                                  {/* İhlal Uyarı İkonu */}
                                  {isViolating && (
                                    <div 
                                      className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 flex items-center justify-center text-white cursor-help print:hidden"
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

          {/* EMPLOYEE ADDITION & LIMITS CARD */}
          <div className="bg-white p-5 rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs print:hidden">
            <h3 className="font-bold text-sm mb-3 text-zinc-800 dark:text-zinc-200">Çalışan Yönetimi</h3>
            <form onSubmit={handleAddEmployee} className="flex gap-2 max-w-md mb-4">
              <input
                type="text"
                value={employeeInput}
                onChange={(e) => setEmployeeInput(e.target.value)}
                placeholder="Çalışan Adı Soyadı"
                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800/50 dark:border-zinc-700 dark:focus:ring-zinc-300"
              />
              <button
                type="submit"
                className="bg-zinc-950 text-white hover:bg-zinc-800 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <UserPlus className="h-4 w-4" />
                Ekle
              </button>
            </form>

            {/* Çalışan Kısıt Yönetimi Listesi */}
            <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <h4 className="text-xs font-semibold text-zinc-500 mb-2 dark:text-zinc-400">Çalışanlar ve Özel Durumlar</h4>
              {employees.length === 0 ? (
                <p className="text-xs text-zinc-400">Henüz çalışan bulunmuyor.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {employees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-150 dark:bg-zinc-800/40 dark:border-zinc-850 dark:border-zinc-800 text-xs">
                      {editingEmpId === emp.id ? (
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRenameEmployee(emp.id, editingEmpName);
                          }}
                          className="flex items-center gap-1 flex-1"
                        >
                          <input
                            type="text"
                            value={editingEmpName}
                            onChange={(e) => setEditingEmpName(e.target.value)}
                            className="flex-1 bg-white border border-zinc-300 rounded px-1.5 py-0.5 text-xs focus:outline-hidden dark:bg-zinc-900 dark:border-zinc-700"
                            autoFocus
                          />
                          <button 
                            type="submit" 
                            className="text-emerald-600 hover:text-emerald-750 p-0.5"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setEditingEmpId(null)}
                            className="text-zinc-400 hover:text-zinc-600 p-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <span className="font-bold truncate max-w-[120px] text-zinc-800 dark:text-zinc-200">{emp.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Gece Yasak */}
                            <label className="flex items-center gap-1 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={emp.isNightRestricted || false}
                                onChange={() => handleToggleNightRestriction(emp.id)}
                                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 h-3.5 w-3.5 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer"
                              />
                              <span className="text-[10px] text-zinc-500 font-medium">Gece Yasak</span>
                            </label>

                            {/* Düzenle (Edit Name) */}
                            <button
                              onClick={() => {
                                setEditingEmpId(emp.id);
                                setEditingEmpName(emp.name);
                              }}
                              className="text-zinc-400 hover:text-zinc-700 transition-colors p-0.5"
                              title="İsmi Düzenle"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {/* İzin Tanımla (Annual Leave Modal Trigger) */}
                            <button
                              onClick={() => {
                                setLeaveModalEmpId(emp.id);
                                setLeaveModalStart(1);
                                setLeaveModalEnd(1);
                                setIsLeaveModalOpen(true);
                              }}
                              className="text-zinc-400 hover:text-zinc-700 transition-colors p-0.5"
                              title="Yıllık İzin Girişi"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                            </button>

                            {/* Sil (Delete) */}
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                              className="text-zinc-400 hover:text-red-600 transition-colors p-0.5"
                              title="Çalışanı Sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: SIDEBAR SETTINGS, RULES & PREFERENCES */}
        {isSettingsOpen && (
          <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300 print:hidden">
            
            {/* SIDEBAR TABS */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 pb-2.5 text-xs font-bold transition-all border-b-2 ${
                  activeTab === 'settings' 
                    ? 'border-zinc-950 text-zinc-950 dark:border-zinc-100 dark:text-zinc-100' 
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                Vardiya Ayarları
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`flex-1 pb-2.5 text-xs font-bold transition-all border-b-2 ${
                  activeTab === 'preferences' 
                    ? 'border-zinc-950 text-zinc-950 dark:border-zinc-100 dark:text-zinc-100' 
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                İzin & Tercihler
              </button>
            </div>

            {/* TAB CONTENT: SETTINGS */}
            {activeTab === 'settings' && (
              <>
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
                        className="w-16 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs text-right focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800/50 dark:border-zinc-700"
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
                        className="w-16 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-xs text-right focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800/50 dark:border-zinc-700"
                      />
                    </div>
                  </div>
                </div>

                {/* OHS RULES CARD */}
                <div className="bg-white p-5 rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs">
                  <h3 className="font-bold text-sm mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    İSG Kısıtları (Mevzuat)
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[10px] font-bold font-mono">1</div>
                      <div>
                        <h4 className="text-xs font-semibold">Haftalık 2 Gün İzin</h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Her takvim haftasında (Paz-Pzt) en az 2 gün izin yapılması yasal zorunluluktur.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[10px] font-bold font-mono">2</div>
                      <div>
                        <h4 className="text-xs font-semibold">11 Saat Kesintisiz Dinlenme</h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Vardiya geçişlerinde en az 11 saat kesintisiz dinlenme süresi sağlanmalıdır.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[10px] font-bold font-mono">3</div>
                      <div>
                        <h4 className="text-xs font-semibold">Gece Sınırı (7.5 Saat)</h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">İş kanununa göre gece çalışmaları 7.5 saati aşamaz. Aşarsa uyarı üretir.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[10px] font-bold font-mono">4</div>
                      <div>
                        <h4 className="text-xs font-semibold">Haftalık Maksimum 45 Saat</h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Haftalık toplam çalışma süresi 45 saati geçemez. Geçen personeller uyarı listesinde gösterilir.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* TAB CONTENT: PREFERENCES & LEAVES */}
            {activeTab === 'preferences' && (
              <>
                {/* BULK LEAVE / HEALTH REPORT */}
                <div className="bg-white p-5 rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs">
                  <h3 className="font-bold text-sm mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-zinc-500" />
                    Toplu İzin / Rapor Girişi
                  </h3>
                  <form onSubmit={handleApplyBulkLeave} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Çalışan</label>
                      <select
                        value={leaveEmpId}
                        onChange={(e) => setLeaveEmpId(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer"
                      >
                        {employees.map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">Başlangıç Günü</label>
                        <input
                          type="number"
                          min={1}
                          max={monthDays.length}
                          value={leaveStart}
                          onChange={(e) => setLeaveStart(Math.max(1, Math.min(monthDays.length, Number(e.target.value))))}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">Bitiş Günü</label>
                        <input
                          type="number"
                          min={1}
                          max={monthDays.length}
                          value={leaveEnd}
                          onChange={(e) => setLeaveEnd(Math.max(1, Math.min(monthDays.length, Number(e.target.value))))}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={employees.length === 0}
                      className="w-full bg-zinc-950 hover:bg-zinc-855 text-white rounded p-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
                    >
                      <Lock className="h-3 w-3" />
                      İzin Girişi Yap (Kilitle)
                    </button>
                  </form>
                </div>

                {/* ADD PREFERENCE (SOFT CONSTRAINT) */}
                <div className="bg-white p-5 rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs">
                  <h3 className="font-bold text-sm mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-zinc-500" />
                    Vardiya Tercihi Ekle
                  </h3>
                  <form onSubmit={handleAddPreference} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Çalışan</label>
                      <select
                        value={prefEmpId}
                        onChange={(e) => setPrefEmpId(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer"
                      >
                        {employees.map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">Gün</label>
                        <input
                          type="number"
                          min={1}
                          max={monthDays.length}
                          value={prefDay}
                          onChange={(e) => setPrefDay(Math.max(1, Math.min(monthDays.length, Number(e.target.value))))}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">Tercih Türü</label>
                        <select
                          value={prefType}
                          onChange={(e) => setPrefType(e.target.value as 'preferred' | 'disliked')}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer"
                        >
                          <option value="preferred">İstiyor</option>
                          <option value="disliked">İstemiyor</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Tercih Edilen Vardiya</label>
                      <select
                        value={prefShift}
                        onChange={(e) => setPrefShift(e.target.value as ShiftType)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-xs focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer"
                      >
                        <option value="morning">Sabah Vardiyası</option>
                        <option value="afternoon">Öğle Vardiyası</option>
                        <option value="night">Gece Vardiyası</option>
                        <option value="off">İzin</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={employees.length === 0}
                      className="w-full bg-zinc-950 hover:bg-zinc-800 text-white rounded p-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                      Tercih Ekle
                    </button>
                  </form>
                </div>

                {/* PREFERENCES LIST */}
                <div className="bg-white p-5 rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-xs">
                  <h3 className="font-bold text-sm mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-zinc-500" />
                    Aktif Tercihler ({preferences.length})
                  </h3>
                  {preferences.length === 0 ? (
                    <p className="text-xs text-zinc-400">Kayıtlı soft tercih bulunmuyor.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {preferences.map((p, idx) => {
                        const empName = employees.find(e => e.id === p.employeeId)?.name || 'Çalışan';
                        const shiftLabel = p.shiftType === 'off' ? 'İzin' : (p.shiftType === 'morning' ? 'Sabah' : (p.shiftType === 'afternoon' ? 'Öğle' : 'Gece'));
                        const typeLabel = p.preferenceType === 'preferred' ? 'İstiyor' : 'İstemiyor';
                        return (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-150 dark:bg-zinc-850 dark:border-zinc-800 text-[10px]">
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{empName}</p>
                              <p className="text-zinc-500 mt-0.5">Gün {p.dayIndex + 1} • {shiftLabel} ({typeLabel})</p>
                            </div>
                            <button
                              onClick={() => handleRemovePreference(p.employeeId, p.dayIndex)}
                              className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                              title="Tercihi Sil"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

          </aside>
        )}

      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-zinc-200 bg-white mt-auto dark:bg-zinc-900 dark:border-zinc-800 print:hidden">
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

      {/* YILLIK İZİN MODALİ */}
      {isLeaveModalOpen && leaveModalEmpId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl animate-in scale-in duration-200 text-left">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  Yıllık İzin Girişi
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1 dark:text-zinc-400">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {employees.find(e => e.id === leaveModalEmpId)?.name}
                  </span> için izin aralığı tanımlayın.
                </p>
              </div>
              <button 
                onClick={() => setIsLeaveModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-650 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">Başlangıç Günü</label>
                  <select
                    value={leaveModalStart}
                    onChange={(e) => setLeaveModalStart(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-250 rounded-lg p-2 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700 dark:focus:ring-zinc-300 cursor-pointer"
                  >
                    {monthDays.map(d => (
                      <option key={d.date} value={d.date}>{d.formattedLabel}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">Bitiş Günü</label>
                  <select
                    value={leaveModalEnd}
                    onChange={(e) => setLeaveModalEnd(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-250 rounded-lg p-2 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-zinc-950 dark:bg-zinc-800 dark:border-zinc-700 dark:focus:ring-zinc-300 cursor-pointer"
                  >
                    {monthDays.map(d => (
                      <option key={d.date} value={d.date}>{d.formattedLabel}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-850">
              <button
                onClick={() => handleRemoveAllLeavesForEmp(leaveModalEmpId)}
                className="bg-white border border-zinc-200 hover:bg-zinc-50 text-red-600 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800"
              >
                İzinleri Temizle
              </button>
              
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-850"
              >
                İptal
              </button>
              
              <button
                onClick={handleApplyModalLeave}
                className="bg-zinc-950 hover:bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Kaydet ve Kilitle
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
