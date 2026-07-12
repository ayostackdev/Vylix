export interface Course {
  id: string
  code: string
  title: string
  color: string
  level: string
  documentCount: number
}

export interface Department {
  id: string
  code: string
  name: string
  color: string
  courses: Course[]
}

export const DEPARTMENTS: Department[] = [
  {
    id: 'dept-stats',
    code: 'STA',
    name: 'Statistics',
    color: '#8b5cf6',
    courses: [
      { id: 'c-sta-201', code: 'STA 201', title: 'Probability I', color: '#8b5cf6', level: '200L', documentCount: 6 },
      { id: 'c-sta-202', code: 'STA 202', title: 'Probability II', color: '#7c3aed', level: '200L', documentCount: 5 },
      { id: 'c-sta-211', code: 'STA 211', title: 'Statistical Inference I', color: '#a855f7', level: '200L', documentCount: 4 },
      { id: 'c-sta-301', code: 'STA 301', title: 'Regression Analysis', color: '#9333ea', level: '300L', documentCount: 7 },
      { id: 'c-sta-302', code: 'STA 302', title: 'Time Series Analysis', color: '#6b21a8', level: '300L', documentCount: 5 },
      { id: 'c-sta-303', code: 'STA 303', title: 'Design of Experiments', color: '#a21caf', level: '300L', documentCount: 4 },
      { id: 'c-sta-304', code: 'STA 304', title: 'Sampling Techniques', color: '#d946ef', level: '300L', documentCount: 6 },
      { id: 'c-sta-305', code: 'STA 305', title: 'Multivariate Analysis', color: '#e879f9', level: '300L', documentCount: 4 },
      { id: 'c-sta-401', code: 'STA 401', title: 'Stochastic Processes', color: '#7e22ce', level: '400L', documentCount: 5 },
      { id: 'c-sta-402', code: 'STA 402', title: 'Nonparametric Statistics', color: '#581c87', level: '400L', documentCount: 3 },
      { id: 'c-sta-403', code: 'STA 403', title: 'Bayesian Statistics', color: '#3b0764', level: '400L', documentCount: 4 },
      { id: 'c-sta-404', code: 'STA 404', title: 'Statistical Computing', color: '#6d28d9', level: '400L', documentCount: 6 },
    ],
  },
  {
    id: 'dept-physics',
    code: 'PHY',
    name: 'Physics',
    color: '#f59e0b',
    courses: [
      { id: 'c-phy-101', code: 'PHY 101', title: 'General Physics I (Mechanics)', color: '#f59e0b', level: '100L', documentCount: 8 },
      { id: 'c-phy-102', code: 'PHY 102', title: 'General Physics II (Thermal)', color: '#d97706', level: '100L', documentCount: 6 },
      { id: 'c-phy-103', code: 'PHY 103', title: 'General Physics Lab I', color: '#fbbf24', level: '100L', documentCount: 4 },
      { id: 'c-phy-201', code: 'PHY 201', title: 'Mechanics', color: '#f59e0b', level: '200L', documentCount: 7 },
      { id: 'c-phy-202', code: 'PHY 202', title: 'Electromagnetism I', color: '#eab308', level: '200L', documentCount: 6 },
      { id: 'c-phy-203', code: 'PHY 203', title: 'Waves and Optics', color: '#ca8a04', level: '200L', documentCount: 5 },
      { id: 'c-phy-204', code: 'PHY 204', title: 'Modern Physics', color: '#a16207', level: '200L', documentCount: 4 },
      { id: 'c-phy-301', code: 'PHY 301', title: 'Electromagnetism II', color: '#eab308', level: '300L', documentCount: 6 },
      { id: 'c-phy-302', code: 'PHY 302', title: 'Quantum Mechanics I', color: '#854d0e', level: '300L', documentCount: 7 },
      { id: 'c-phy-303', code: 'PHY 303', title: 'Thermodynamics', color: '#f59e0b', level: '300L', documentCount: 5 },
      { id: 'c-phy-304', code: 'PHY 304', title: 'Mathematical Methods for Physics', color: '#b45309', level: '300L', documentCount: 6 },
      { id: 'c-phy-401', code: 'PHY 401', title: 'Quantum Mechanics II', color: '#78350f', level: '400L', documentCount: 5 },
      { id: 'c-phy-402', code: 'PHY 402', title: 'Nuclear Physics', color: '#92400e', level: '400L', documentCount: 4 },
      { id: 'c-phy-403', code: 'PHY 403', title: 'Solid State Physics', color: '#b45309', level: '400L', documentCount: 6 },
      { id: 'c-phy-404', code: 'PHY 404', title: 'Geophysics', color: '#78716c', level: '400L', documentCount: 3 },
    ],
  },
  {
    id: 'dept-chemistry',
    code: 'CHM',
    name: 'Chemistry',
    color: '#10b981',
    courses: [
      { id: 'c-chm-101', code: 'CHM 101', title: 'General Chemistry I', color: '#10b981', level: '100L', documentCount: 7 },
      { id: 'c-chm-102', code: 'CHM 102', title: 'General Chemistry Lab I', color: '#059669', level: '100L', documentCount: 4 },
      { id: 'c-chm-201', code: 'CHM 201', title: 'Organic Chemistry I', color: '#34d399', level: '200L', documentCount: 6 },
      { id: 'c-chm-202', code: 'CHM 202', title: 'Inorganic Chemistry I', color: '#6ee7b7', level: '200L', documentCount: 5 },
      { id: 'c-chm-203', code: 'CHM 203', title: 'Physical Chemistry I', color: '#047857', level: '200L', documentCount: 6 },
      { id: 'c-chm-204', code: 'CHM 204', title: 'Analytical Chemistry I', color: '#065f46', level: '200L', documentCount: 4 },
      { id: 'c-chm-301', code: 'CHM 301', title: 'Organic Chemistry II', color: '#059669', level: '300L', documentCount: 7 },
      { id: 'c-chm-302', code: 'CHM 302', title: 'Inorganic Chemistry II', color: '#10b981', level: '300L', documentCount: 5 },
      { id: 'c-chm-303', code: 'CHM 303', title: 'Physical Chemistry II', color: '#34d399', level: '300L', documentCount: 6 },
      { id: 'c-chm-304', code: 'CHM 304', title: 'Analytical Chemistry II', color: '#6ee7b7', level: '300L', documentCount: 4 },
      { id: 'c-chm-401', code: 'CHM 401', title: 'Polymer Chemistry', color: '#022c22', level: '400L', documentCount: 4 },
      { id: 'c-chm-402', code: 'CHM 402', title: 'Environmental Chemistry', color: '#064e3b', level: '400L', documentCount: 3 },
      { id: 'c-chm-403', code: 'CHM 403', title: 'Industrial Chemistry', color: '#065f46', level: '400L', documentCount: 5 },
      { id: 'c-chm-404', code: 'CHM 404', title: 'Research Methods in Chemistry', color: '#047857', level: '400L', documentCount: 3 },
    ],
  },
  {
    id: 'dept-mathematics',
    code: 'MTH',
    name: 'Mathematics',
    color: '#3b82f6',
    courses: [
      { id: 'c-mth-101', code: 'MTH 101', title: 'Elementary Mathematics I', color: '#3b82f6', level: '100L', documentCount: 8 },
      { id: 'c-mth-102', code: 'MTH 102', title: 'Elementary Mathematics II', color: '#60a5fa', level: '100L', documentCount: 7 },
      { id: 'c-mth-103', code: 'MTH 103', title: 'Introductory Algebra', color: '#93c5fd', level: '100L', documentCount: 5 },
      { id: 'c-mth-201', code: 'MTH 201', title: 'Mathematical Methods I', color: '#2563eb', level: '200L', documentCount: 6 },
      { id: 'c-mth-202', code: 'MTH 202', title: 'Real Analysis I', color: '#1d4ed8', level: '200L', documentCount: 6 },
      { id: 'c-mth-203', code: 'MTH 203', title: 'Linear Algebra I', color: '#1e40af', level: '200L', documentCount: 5 },
      { id: 'c-mth-204', code: 'MTH 204', title: 'Differential Equations', color: '#3b82f6', level: '200L', documentCount: 7 },
      { id: 'c-mth-301', code: 'MTH 301', title: 'Real Analysis II', color: '#1e3a5f', level: '300L', documentCount: 5 },
      { id: 'c-mth-302', code: 'MTH 302', title: 'Complex Analysis', color: '#172554', level: '300L', documentCount: 6 },
      { id: 'c-mth-303', code: 'MTH 303', title: 'Abstract Algebra', color: '#1e40af', level: '300L', documentCount: 5 },
      { id: 'c-mth-304', code: 'MTH 304', title: 'Topology', color: '#2563eb', level: '300L', documentCount: 4 },
      { id: 'c-mth-305', code: 'MTH 305', title: 'Numerical Analysis', color: '#60a5fa', level: '300L', documentCount: 6 },
      { id: 'c-mth-401', code: 'MTH 401', title: 'Functional Analysis', color: '#0f172a', level: '400L', documentCount: 4 },
      { id: 'c-mth-402', code: 'MTH 402', title: 'Measure Theory', color: '#020617', level: '400L', documentCount: 4 },
      { id: 'c-mth-403', code: 'MTH 403', title: 'Algebraic Topology', color: '#1e293b', level: '400L', documentCount: 3 },
      { id: 'c-mth-404', code: 'MTH 404', title: 'Partial Differential Equations', color: '#334155', level: '400L', documentCount: 5 },
    ],
  },
]

export function getDepartmentByCourseId(courseId: string): Department | undefined {
  return DEPARTMENTS.find(dept => dept.courses.some(c => c.id === courseId))
}

export function getCourseById(courseId: string): Course | undefined {
  for (const dept of DEPARTMENTS) {
    const course = dept.courses.find(c => c.id === courseId)
    if (course) return course
  }
  return undefined
}

export function getCoursesByLevel(level: string): Course[] {
  return DEPARTMENTS.flatMap(d => d.courses).filter(c => c.level === level)
}
