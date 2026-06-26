import { 
  ShiftType, 
  ShiftSettings, 
  Employee, 
  ShiftAssignment, 
  OHSConfig, 
  DAYS_OF_WEEK,
  MonthDay,
  EmployeePreference
} from '../types/scheduler';

/**
 * Saati float değerine çevirir. Örn: "08:30" -> 8.5
 */
export function timeToFloat(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}

/**
 * İki vardiya arasındaki dinlenme süresini saat cinsinden hesaplar.
 * prevShift day N üzerinde, nextShift day N+1 üzerindedir.
 */
export function getRestHours(
  prevShift: Exclude<ShiftType, 'off'>,
  nextShift: Exclude<ShiftType, 'off'>,
  settings: ShiftSettings
): number {
  const prevHours = settings[prevShift];
  const nextHours = settings[nextShift];

  const prevStart = timeToFloat(prevHours.start);
  let prevEnd = timeToFloat(prevHours.end);
  const nextStart = timeToFloat(nextHours.start);

  // Eğer vardiya gece yarısını geçiyorsa bitiş saatine 24 eklenir
  if (prevEnd < prevStart) {
    prevEnd += 24;
  }

  // Ertesi günkü vardiya başlangıcı 24 saat eklenerek hesaplanır
  const nextStartAdjusted = nextStart + 24;

  return nextStartAdjusted - prevEnd;
}

/**
 * Belirli bir vardiya türünün süresini saat cinsinden hesaplar.
 */
export function getShiftDuration(startStr: string, endStr: string): number {
  const start = timeToFloat(startStr);
  let end = timeToFloat(endStr);
  if (end < start) {
    end += 24;
  }
  return end - start;
}

/**
 * Bir çalışanın yorgunluk/iş yükü skorunu hesaplar.
 * Bu skor, adil vardiya dağıtımı için kullanılır.
 */
export function calculateFatigueScore(
  employeeId: string,
  assignments: ShiftAssignment[],
  currentDayIndex: number
): number {
  let score = 0;
  
  const employeeAssignments = assignments.filter(
    (a) => a.employeeId === employeeId && a.dayIndex <= currentDayIndex
  );

  for (const assign of employeeAssignments) {
    switch (assign.shiftType) {
      case 'morning':
        score += 10;
        break;
      case 'afternoon':
        score += 12;
        break;
      case 'night':
        score += 20;
        break;
      case 'off':
        score += 0;
        break;
    }

    // Hafta sonu çalışması ekstra yorgunluk puanı ekler
    if (assign.dayIndex % 7 === 5 || assign.dayIndex % 7 === 6) { // Cumartesi veya Pazar
      if (assign.shiftType !== 'off') {
        score += 10;
      }
    }
  }

  return score;
}

/**
 * Seçilen ay ve yıla göre dinamik gün listesini ve takvim haftalarını hesaplar.
 * Hafta başlangıcı Pazartesi olarak kabul edilir.
 */
export function getMonthDays(month: number, year: number): MonthDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const list: MonthDay[] = [];
  
  let currentWeekIndex = 0;

  const shortDayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dayOfWeekSystem = dateObj.getDay(); // 0 (Pazar) - 6 (Cumartesi)
    
    // Pazartesi: 0, ..., Pazar: 6 formatına dönüştür
    const dayOfWeek = (dayOfWeekSystem + 6) % 7; 
    const dayName = DAYS_OF_WEEK[dayOfWeek];
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    // Eğer gün Pazartesi ise ve ilk gün değilse yeni bir takvim haftasına geç
    if (d > 1 && dayOfWeek === 0) {
      currentWeekIndex++;
    }

    const shortName = shortDayNames[dayOfWeekSystem];
    const formattedLabel = `${d < 10 ? '0' + d : d} ${shortName}`;

    list.push({
      date: d,
      dayName,
      isWeekend,
      weekIndex: currentWeekIndex,
      formattedLabel
    });
  }

  return list;
}

/**
 * Belirli bir takvim haftasındaki gün sayısına göre
 * yapılması gereken minimum izin günü sayısını orantılı olarak hesaplar.
 */
export function getRequiredOffDaysForWeek(weekIndex: number, monthDays: MonthDay[]): number {
  const daysInWeek = monthDays.filter(d => d.weekIndex === weekIndex).length;
  if (daysInWeek >= 5) return 2;
  if (daysInWeek >= 3) return 1;
  return 0; // 1 veya 2 günlük yarım haftalarda izin şartı aranmaz
}

/**
 * Otomatik planlama algoritması.
 * CSP (Kısıt Sağlama Problemi) Backtracking + Ceza/Yorgunluk Puanı heuristic'i kullanır.
 * Aylık gün sayısına (28-31) ve takvim haftası izinlerine göre çalışır.
 */
export function autoPlanShifts(
  employees: Employee[],
  lockedAssignments: ShiftAssignment[],
  settings: ShiftSettings,
  ohsConfig: OHSConfig,
  requirements: Record<Exclude<ShiftType, 'off'>, number>,
  monthDays: MonthDay[],
  preferences?: EmployeePreference[]
): ShiftAssignment[] | null {
  if (employees.length === 0 || monthDays.length === 0) return [];

  const totalDays = monthDays.length;
  const grid: Record<string, ShiftType[]> = {};
  const isCellLocked: Record<string, boolean[]> = {};

  employees.forEach((emp) => {
    grid[emp.id] = Array(totalDays).fill('off');
    isCellLocked[emp.id] = Array(totalDays).fill(false);
  });

  lockedAssignments.forEach((assign) => {
    if (grid[assign.employeeId] && assign.dayIndex < totalDays) {
      grid[assign.employeeId][assign.dayIndex] = assign.shiftType;
      isCellLocked[assign.employeeId][assign.dayIndex] = true;
    }
  });

  let steps = 0;
  const maxSteps = 60000; // Aylık planlama için arama sınırı artırıldı

  // Kısıt Kontrol Fonksiyonu
  function isValid(
    employeeId: string,
    dayIndex: number,
    shift: ShiftType
  ): boolean {
    if (shift === 'off') {
      return true;
    }

    // Gece Vardiyası Kısıtlaması (Özel Durum)
    if (shift === 'night') {
      const emp = employees.find((e) => e.id === employeeId);
      if (emp?.isNightRestricted) {
        return false;
      }
    }

    // 1. Günlük Çalışma Süresi Sınırı
    const duration = getShiftDuration(settings[shift].start, settings[shift].end);
    if (duration > ohsConfig.maxDailyWorkHours) {
      return false;
    }

    // 2. Dinlenme Süresi Kontrolü (11 Saat Kuralı) - Önceki Gün ile
    if (dayIndex > 0) {
      const prevShift = grid[employeeId][dayIndex - 1];
      if (prevShift !== 'off') {
        const rest = getRestHours(prevShift, shift, settings);
        if (rest < ohsConfig.minRestHoursBetweenShifts) {
          return false;
        }
      }
    }

    // 3. Dinlenme Süresi Kontrolü - Sonraki Gün ile (Eğer sonraki gün kilitliyse)
    if (dayIndex < totalDays - 1) {
      const nextShift = grid[employeeId][dayIndex + 1];
      if (nextShift !== 'off' && isCellLocked[employeeId][dayIndex + 1]) {
        const rest = getRestHours(shift, nextShift, settings);
        if (rest < ohsConfig.minRestHoursBetweenShifts) {
          return false;
        }
      }
    }

    // 4. Üst Üste Gece Vardiyası Sınırı (Rotasyon)
    if (shift === 'night') {
      let consecutiveNights = 1;
      
      let d = dayIndex - 1;
      while (d >= 0 && grid[employeeId][d] === 'night') {
        consecutiveNights++;
        d--;
      }
      
      d = dayIndex + 1;
      while (d < totalDays && grid[employeeId][d] === 'night') {
        consecutiveNights++;
        d++;
      }

      if (consecutiveNights > ohsConfig.maxConsecutiveNightShifts) {
        return false;
      }
    }

    // 5. Takvim Haftası İzin Günü Uygunluğu Kontrolü (Budama/Pruning)
    const currentWeek = monthDays[dayIndex].weekIndex;
    const requiredOffDays = getRequiredOffDaysForWeek(currentWeek, monthDays);

    let offDaysInWeek = 0;
    let remainingDaysInWeek = 0;

    for (let d = 0; d < totalDays; d++) {
      if (monthDays[d].weekIndex === currentWeek) {
        if (d < dayIndex) {
          if (grid[employeeId][d] === 'off') offDaysInWeek++;
        } else if (d > dayIndex) {
          // Gelecek günler
          if (isCellLocked[employeeId][d] && grid[employeeId][d] !== 'off') {
            // Eğer gelecek gün kilitliyse ve izin değilse, o gün izin yapılamaz
          } else {
            remainingDaysInWeek++;
          }
        }
      }
    }

    if (offDaysInWeek + remainingDaysInWeek < requiredOffDays) {
      return false; // Bu haftada hedeflenen izin günü sayısına ulaşmak artık imkansız
    }

    return true;
  }

  // Backtracking Arama Fonksiyonu
  function backtrack(day: number, shiftTypeIdx: number, assignedCount: number): boolean {
    steps++;
    if (steps > maxSteps) {
      return false;
    }

    const shiftsToFill: Exclude<ShiftType, 'off'>[] = ['morning', 'afternoon', 'night'];
    
    if (day >= totalDays) {
      // Tüm ayı doldurduk. Her hafta için izin kuralını son kez teyit et.
      const weekIndices = Array.from(new Set(monthDays.map(d => d.weekIndex)));
      
      for (const emp of employees) {
        for (const w of weekIndices) {
          const required = getRequiredOffDaysForWeek(w, monthDays);
          let offDays = 0;
          for (let d = 0; d < totalDays; d++) {
            if (monthDays[d].weekIndex === w && grid[emp.id][d] === 'off') {
              offDays++;
            }
          }
          if (offDays < required) {
            return false;
          }
        }
      }
      return true;
    }

    if (shiftTypeIdx >= shiftsToFill.length) {
      // Gün bitti. Atanmayanları 'off' yap ve izin durumlarını kontrol et
      const assignedForDay = new Set<string>();
      employees.forEach((emp) => {
        const currentShift = grid[emp.id][day];
        if (currentShift !== 'off' || isCellLocked[emp.id][day]) {
          assignedForDay.add(emp.id);
        }
      });

      const tempSaved: Record<string, ShiftType> = {};
      let isOffAssignmentsValid = true;

      for (const emp of employees) {
        if (!assignedForDay.has(emp.id)) {
          tempSaved[emp.id] = grid[emp.id][day];
          grid[emp.id][day] = 'off';
          if (!isValid(emp.id, day, 'off')) {
            isOffAssignmentsValid = false;
          }
        }
      }

      if (isOffAssignmentsValid) {
        if (backtrack(day + 1, 0, 0)) {
          return true;
        }
      }

      Object.keys(tempSaved).forEach((empId) => {
        grid[empId][day] = tempSaved[empId];
      });
      return false;
    }

    const currentShiftType = shiftsToFill[shiftTypeIdx];
    const requiredForShift = requirements[currentShiftType] || 0;

    let lockedCount = 0;
    employees.forEach((emp) => {
      if (isCellLocked[emp.id][day] && grid[emp.id][day] === currentShiftType) {
        lockedCount++;
      }
    });

    if (lockedCount >= requiredForShift) {
      return backtrack(day, shiftTypeIdx + 1, 0);
    }

    const neededToAssign = requiredForShift - lockedCount;

    if (assignedCount >= neededToAssign) {
      return backtrack(day, shiftTypeIdx + 1, 0);
    }

    const candidateEmployees = employees.filter((emp) => {
      if (isCellLocked[emp.id][day]) return false;
      
      let isAlreadyAssignedToday = false;
      for (let sIdx = 0; sIdx < shiftTypeIdx; sIdx++) {
        const sType = shiftsToFill[sIdx];
        if (grid[emp.id][day] === sType) {
          isAlreadyAssignedToday = true;
          break;
        }
      }
      return !isAlreadyAssignedToday;
    });

    const employeesWithFatigue = candidateEmployees.map((emp) => {
      const currentAssignments: ShiftAssignment[] = [];
      employees.forEach((e) => {
        for (let d = 0; d <= day; d++) {
          currentAssignments.push({
            employeeId: e.id,
            dayIndex: d,
            shiftType: grid[e.id][d]
          });
        }
      });
      
      let score = calculateFatigueScore(emp.id, currentAssignments, day);
      
      // Tercihleri (soft kısıt) heuristic olarak hesaba kat
      if (preferences) {
        const pref = preferences.find(p => p.employeeId === emp.id && p.dayIndex === day);
        if (pref) {
          if (pref.preferenceType === 'preferred' && pref.shiftType === currentShiftType) {
            score -= 100; // Önceliklendir
          } else if (pref.preferenceType === 'disliked' && pref.shiftType === currentShiftType) {
            score += 100; // Ertele
          } else if (pref.preferenceType === 'preferred' && pref.shiftType === 'off') {
            score += 80;  // İzin isteyen kişiye vardiya vermeyi ertele
          }
        }
      }

      return {
        emp,
        score
      };
    });

    employeesWithFatigue.sort((a, b) => a.score - b.score);

    for (const item of employeesWithFatigue) {
      const empId = item.emp.id;

      if (isValid(empId, day, currentShiftType)) {
        grid[empId][day] = currentShiftType;

        if (backtrack(day, shiftTypeIdx, assignedCount + 1)) {
          return true;
        }

        grid[empId][day] = 'off';
      }
    }

    return false;
  }

  const success = backtrack(0, 0, 0);

  if (!success) {
    return null;
  }

  const result: ShiftAssignment[] = [];
  employees.forEach((emp) => {
    for (let d = 0; d < totalDays; d++) {
      result.push({
        employeeId: emp.id,
        dayIndex: d,
        shiftType: grid[emp.id][d],
        isLocked: isCellLocked[emp.id][d]
      });
    }
  });

  return result;
}

export interface OHSViolation {
  employeeId?: string;
  dayIndex?: number;
  type: 'rest_period' | 'weekly_off' | 'night_limit' | 'consecutive_night' | 'shift_requirement' | 'weekly_hours_limit' | 'special_restriction' | 'holiday_warning';
  message: string;
}

export function checkScheduleViolations(
  employees: Employee[],
  assignments: ShiftAssignment[],
  settings: ShiftSettings,
  ohsConfig: OHSConfig,
  requirements: Record<Exclude<ShiftType, 'off'>, number>,
  monthDays: MonthDay[],
  publicHolidays?: number[]
): OHSViolation[] {
  const violations: OHSViolation[] = [];
  const totalDays = monthDays.length;
  if (totalDays === 0) return [];

  const grid: Record<string, ShiftType[]> = {};
  employees.forEach((emp) => {
    grid[emp.id] = Array(totalDays).fill('off');
  });

  assignments.forEach((assign) => {
    if (grid[assign.employeeId] && assign.dayIndex < totalDays) {
      grid[assign.employeeId][assign.dayIndex] = assign.shiftType;
    }
  });

  // 1. Gece vardiyası süre sınırı (7.5 saat) - Genel Ayar
  const nightDuration = getShiftDuration(settings.night.start, settings.night.end);
  if (nightDuration > ohsConfig.maxNightShiftHours) {
    violations.push({
      type: 'night_limit',
      message: `Gece vardiyası süresi (${nightDuration.toFixed(1)} saat), İSG yasal sınırı olan ${ohsConfig.maxNightShiftHours} saati aşıyor!`
    });
  }

  // Çalışan bazlı kurallar
  employees.forEach((emp) => {
    const empGrid = grid[emp.id];
    
    // Haftalık izin takibi için haftalık izin sayılarını biriktir
    const weekIndices = Array.from(new Set(monthDays.map(d => d.weekIndex)));
    const offDaysByWeek: Record<number, number> = {};
    weekIndices.forEach(w => {
      offDaysByWeek[w] = 0;
    });

    for (let d = 0; d < totalDays; d++) {
      const shift = empGrid[d];
      const weekIdx = monthDays[d].weekIndex;

      if (shift === 'off') {
        offDaysByWeek[weekIdx]++;
        continue;
      }

      // Gece Vardiyası Kısıtlaması (Özel Durum)
      if (shift === 'night' && emp.isNightRestricted) {
        violations.push({
          employeeId: emp.id,
          dayIndex: d,
          type: 'special_restriction',
          message: `${emp.name}: Gece vardiyası yasaktır (Özel durum).`
        });
      }

      // Resmi Tatil Çalışma Uyarısı
      if (publicHolidays && publicHolidays.includes(monthDays[d].date)) {
        violations.push({
          employeeId: emp.id,
          dayIndex: d,
          type: 'holiday_warning',
          message: `${emp.name}: ${monthDays[d].formattedLabel} resmi tatil gününde çalışıyor. Çift yevmiye veya ek izin verilmelidir.`
        });
      }

      // 2. Günlük çalışma süresi sınırı
      const duration = getShiftDuration(settings[shift].start, settings[shift].end);
      if (duration > ohsConfig.maxDailyWorkHours) {
        violations.push({
          employeeId: emp.id,
          dayIndex: d,
          type: 'night_limit',
          message: `${emp.name}: ${monthDays[d].formattedLabel} günü çalışma süresi (${duration.toFixed(1)} saat), günlük yasal limit olan ${ohsConfig.maxDailyWorkHours} saati aşıyor!`
        });
      }

      // 3. Dinlenme süresi (11 saat kuralı) - Önceki gün ile
      if (d > 0) {
        const prevShift = empGrid[d - 1];
        if (prevShift !== 'off') {
          const rest = getRestHours(prevShift, shift, settings);
          if (rest < ohsConfig.minRestHoursBetweenShifts) {
            violations.push({
              employeeId: emp.id,
              dayIndex: d,
              type: 'rest_period',
              message: `${emp.name}: ${monthDays[d - 1].formattedLabel} -> ${monthDays[d].formattedLabel} geçişinde kesintisiz dinlenme süresi yetersiz (${rest.toFixed(1)} saat). En az ${ohsConfig.minRestHoursBetweenShifts} saat olmalıdır.`
            });
          }
        }
      }

      // 4. Üst üste gece vardiyası sınırı (Rotasyon)
      if (shift === 'night') {
        let consecutive = 1;
        let prevD = d - 1;
        while (prevD >= 0 && empGrid[prevD] === 'night') {
          consecutive++;
          prevD--;
        }
        if (consecutive > ohsConfig.maxConsecutiveNightShifts) {
          violations.push({
            employeeId: emp.id,
            dayIndex: d,
            type: 'consecutive_night',
            message: `${emp.name}: Üst üste ${consecutive} gün gece vardiyasında çalışıyor. Yasal limit en fazla ${ohsConfig.maxConsecutiveNightShifts} gündür!`
          });
        }
      }
    }

    // 5. Haftalık İzin Günü Uygunluğu Kontrolü (Hafta bazlı)
    weekIndices.forEach(w => {
      const required = getRequiredOffDaysForWeek(w, monthDays);
      const actual = offDaysByWeek[w];
      if (actual < required) {
        violations.push({
          employeeId: emp.id,
          type: 'weekly_off',
          message: `${emp.name}: ${w + 1}. takvim haftasında en az ${required} gün izin yapmalıdır (Mevcut: ${actual} gün).`
        });
      }
    });

    // 45 Saat Kuralı Kontrolü
    weekIndices.forEach(w => {
      let weeklyHours = 0;
      for (let d = 0; d < totalDays; d++) {
        if (monthDays[d].weekIndex === w) {
          const shift = empGrid[d];
          if (shift !== 'off') {
            weeklyHours += getShiftDuration(settings[shift].start, settings[shift].end);
          }
        }
      }
      if (weeklyHours > 45) {
        violations.push({
          employeeId: emp.id,
          type: 'weekly_hours_limit',
          message: `${emp.name}: ${w + 1}. takvim haftasında toplam çalışma süresi (${weeklyHours.toFixed(1)} saat), 45 saat yasal sınırını aşıyor!`
        });
      }
    });
  });

  // 6. Operasyonel Vardiya İhtiyacı Kontrolü (Gerekli çalışan sayısı)
  for (let d = 0; d < totalDays; d++) {
    const shiftCounts: Record<Exclude<ShiftType, 'off'>, number> = {
      morning: 0,
      afternoon: 0,
      night: 0
    };

    employees.forEach((emp) => {
      const shift = grid[emp.id][d];
      if (shift !== 'off') {
        shiftCounts[shift]++;
      }
    });

    const shifts: Exclude<ShiftType, 'off'>[] = ['morning', 'afternoon', 'night'];
    shifts.forEach((sType) => {
      const req = requirements[sType] || 0;
      const count = shiftCounts[sType];
      if (count < req) {
        let sName = 'Sabah';
        if (sType === 'afternoon') sName = 'Öğle';
        if (sType === 'night') sName = 'Gece';
        violations.push({
          dayIndex: d,
          type: 'shift_requirement',
          message: `${monthDays[d].formattedLabel} günü ${sName} vardiyasında yetersiz çalışan var (Gereken: ${req}, Atanan: ${count}).`
        });
      }
    });
  }

  return violations;
}
