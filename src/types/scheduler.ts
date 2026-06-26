export type ShiftType = 'morning' | 'afternoon' | 'night' | 'off';

export interface ShiftHours {
  start: string; // Örn: "08:00"
  end: string;   // Örn: "16:00"
}

export interface ShiftSettings {
  morning: ShiftHours;
  afternoon: ShiftHours;
  night: ShiftHours;
}

export interface Employee {
  id: string;
  name: string;
  isNightRestricted?: boolean; // Gece vardiyası yasak mı?
}

export interface EmployeePreference {
  employeeId: string;
  dayIndex: number; // 0 ile N-1 arası
  preferenceType: 'preferred' | 'disliked';
  shiftType: ShiftType;
}

export interface ShiftAssignment {
  employeeId: string;
  dayIndex: number; // 0 ile N-1 (gün sayısı - 1) arası
  shiftType: ShiftType;
  isLocked?: boolean; // Kullanıcı manuel ataması veya kilitli izinler
}

export interface ScheduleState {
  employees: Employee[];
  assignments: ShiftAssignment[];
  settings: ShiftSettings;
  month: number; // 0 - 11
  year: number;  // Örn: 2026
}

export interface MonthDay {
  date: number;          // 1, 2, ..., 31
  dayName: string;       // "Pazartesi", "Salı", ...
  isWeekend: boolean;    // Cumartesi veya Pazar mı?
  weekIndex: number;     // Hangi takvim haftasına dahil (0, 1, 2...)
  formattedLabel: string; // Örn: "01 Pzt"
}

// Hafta günleri tanımları
export const DAYS_OF_WEEK = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar'
] as const;

export interface OHSConfig {
  minWeeklyRestDays: number; // Varsayılan: 2
  minRestHoursBetweenShifts: number; // Varsayılan: 11
  maxNightShiftHours: number; // Varsayılan: 7.5
  maxDailyWorkHours: number; // Varsayılan: 11
  maxConsecutiveNightShifts: number; // Varsayılan: 3
}

export const DEFAULT_OHS_CONFIG: OHSConfig = {
  minWeeklyRestDays: 2,
  minRestHoursBetweenShifts: 11,
  maxNightShiftHours: 7.5,
  maxDailyWorkHours: 11,
  maxConsecutiveNightShifts: 3
};

export const DEFAULT_SHIFT_SETTINGS: ShiftSettings = {
  morning: { start: '08:30', end: '17:00' },
  afternoon: { start: '17:00', end: '01:00' },
  night: { start: '01:00', end: '08:30' }
};
